package com.arthunt.core.fake

import com.arthunt.core.model.EventData
import com.arthunt.core.model.Feedback
import com.arthunt.core.model.Marker
import com.arthunt.core.model.Player
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import java.util.concurrent.CountDownLatch
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class FakeRepositoriesTest {
    private fun sampleEvent() = EventData.create(
        name = "Test Hunt",
        markers = listOf(
            Marker.create(type = "model", imageUrl = "https://example.com/1.jpg", modelUrl = "library:chest"),
            Marker.create(type = "model", imageUrl = "https://example.com/2.jpg", modelUrl = "library:coin"),
        ),
    )

    @Test
    fun `event repository insert then get round-trips`() = runTest {
        val repo = FakeEventRepository()
        val inserted = repo.insert(sampleEvent())
        assertNotNull(inserted.id)

        val fetched = repo.get(inserted.id)
        assertEquals("Test Hunt", fetched?.data?.name)
        assertEquals(2, fetched?.data?.markers?.size)
    }

    @Test
    fun `event repository update replaces stored data`() = runTest {
        val repo = FakeEventRepository()
        val row = repo.insert(sampleEvent())

        val withPlayer = row.data.withStatus("inactive")
        repo.update(row.id, withPlayer)

        assertEquals("inactive", repo.get(row.id)?.data?.status)
    }

    @Test
    fun `event repository list returns newest first`() = runTest {
        val repo = FakeEventRepository()
        val first = repo.insert(sampleEvent())
        val second = repo.insert(sampleEvent().withStatus("inactive"))

        val all = repo.list()
        assertEquals(listOf(second.id, first.id), all.map { it.id })
    }

    @Test
    fun `event repository get on unknown id returns null`() = runTest {
        val repo = FakeEventRepository()
        assertNull(repo.get("does-not-exist"))
    }

    @Test
    fun `updatePlayer upserts by name and preserves markers and settings`() = runTest {
        val repo = FakeEventRepository()
        val row = repo.insert(sampleEvent())

        val alice = Player.create("Alice", "30", listOf(0, 1), startTime = 1_000L, avatarId = 4)
        repo.updatePlayer(row.id, alice)
        assertEquals(listOf("Alice"), repo.get(row.id)?.data?.players?.map { it.name })

        // Calling it again for the same name replaces, not duplicates, that player.
        val aliceProgressed = alice.withAppendedDetectedMarker(1)
        repo.updatePlayer(row.id, aliceProgressed)
        val players = repo.get(row.id)!!.data.players
        assertEquals(1, players.size)
        assertEquals(listOf(1), players.single().detectedMarkers)

        // Markers/name from the original event are untouched.
        assertEquals("Test Hunt", repo.get(row.id)?.data?.name)
        assertEquals(2, repo.get(row.id)?.data?.markers?.size)
    }

    @Test
    fun `updatePlayer run concurrently for two different players saves both`() {
        val repo = FakeEventRepository()
        val row = runBlocking { repo.insert(sampleEvent()) }

        val alice = Player.create("Alice", "30", emptyList(), startTime = 1_000L, avatarId = 1)
        val bob = Player.create("Bob", "25", emptyList(), startTime = 2_000L, avatarId = 2)

        val latch = CountDownLatch(2)
        val threads = listOf(alice, bob).map { player ->
            Thread {
                runBlocking { repo.updatePlayer(row.id, player) }
                latch.countDown()
            }
        }
        threads.forEach { it.start() }
        latch.await()

        val names = runBlocking { repo.get(row.id)?.data?.players?.map { it.name }?.toSet() }
        assertEquals(setOf("Alice", "Bob"), names)
    }

    @Test
    fun `updatePlayer preserves unknown fields on the event and on other players`() = runTest {
        val repo = FakeEventRepository()
        val raw = buildJsonObject {
            put("name", JsonPrimitive("Legacy Hunt"))
            put("legacyFlag", JsonPrimitive(true)) // unknown to Android's EventData
            put("markers", JsonArray(emptyList()))
            put(
                "players",
                JsonArray(
                    listOf(
                        buildJsonObject {
                            put("name", JsonPrimitive("Bob"))
                            put("age", JsonPrimitive("25"))
                            put("notes", JsonPrimitive("vip")) // unknown to Android's Player
                            put("detectedMarkers", JsonArray(emptyList()))
                            put("customPath", JsonArray(emptyList()))
                            put("startTime", JsonPrimitive(500L))
                            put("avatarId", JsonPrimitive(9))
                            put("hintsUsed", JsonPrimitive(0))
                        }
                    )
                ),
            )
        }
        val row = repo.insert(EventData.fromJson(raw))

        val alice = Player.create("Alice", "30", emptyList(), startTime = 1_000L, avatarId = 1)
        repo.updatePlayer(row.id, alice)

        val updatedJson = repo.get(row.id)!!.data.toJson()
        assertEquals(JsonPrimitive(true), updatedJson["legacyFlag"])
        val bobJson = (updatedJson["players"] as JsonArray).first { (it as kotlinx.serialization.json.JsonObject)["name"] == JsonPrimitive("Bob") }
        assertEquals(JsonPrimitive("vip"), (bobJson as kotlinx.serialization.json.JsonObject)["notes"])
    }

    @Test
    fun `telemetry repository log is synchronous and listable`() = runTest {
        val repo = FakeTelemetryRepository()
        repo.log("event-1", "Alice", "join")
        repo.log("event-1", "Alice", "scan", marker = 1)
        repo.log("event-2", "Bob", "join")

        val forEvent1 = repo.list("event-1")
        assertEquals(2, forEvent1.size)
        assertEquals(listOf("join", "scan"), forEvent1.map { it.kind })

        assertEquals(3, repo.list().size)
    }

    @Test
    fun `feedback repository stores submissions`() = runTest {
        val repo = FakeFeedbackRepository()
        repo.submit(Feedback(immersion = 5, usability = 4, engagement = 5, stability = 3))
        assertEquals(1, repo.all.size)
        assertEquals(5, repo.all.first().immersion)
    }

    @Test
    fun `storage repository returns a usable url for uploaded bytes`() = runTest {
        val repo = FakeStorageRepository()
        val url = repo.upload("hello".toByteArray(), folder = "markers", fileExtension = "jpg")
        assertTrue(url.startsWith("demo://ar-assets/markers/"))
        assertTrue(url.endsWith(".jpg"))
    }
}
