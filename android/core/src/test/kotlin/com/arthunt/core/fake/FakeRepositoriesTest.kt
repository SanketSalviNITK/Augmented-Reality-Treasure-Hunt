package com.arthunt.core.fake

import com.arthunt.core.model.EventData
import com.arthunt.core.model.Feedback
import com.arthunt.core.model.Marker
import kotlinx.coroutines.test.runTest
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
