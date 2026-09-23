package com.arthunt.core.model

import com.arthunt.core.domain.PathGenerator
import com.arthunt.core.domain.applyHint
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Shared-contract fixtures (`docs/ANDROID_ARCHITECTURE.md` §3): parses
 * realistic `events.data` blobs -- including web-only fields Android doesn't
 * model (`compiledMindUrl`, marker `pos`, `library:` model URLs) and one
 * legacy event missing `players`/`settings`/`status` entirely -- then
 * performs a typical Android read-modify-write (add a player / append a
 * detected marker / apply a hint) and asserts every unknown field is still
 * present, byte-for-byte, in the re-serialized JSON.
 *
 * Uses this package's own internal JsonObject helpers (str/intList/arrOrNull/
 * ...) to inspect raw JSON without needing a separate parsing path.
 */
class ContractRoundTripTest {
    private val parser = Json { ignoreUnknownKeys = true }

    private fun loadFixture(name: String): JsonObject {
        val text = requireNotNull(javaClass.classLoader.getResourceAsStream(name)) { "missing fixture $name" }
            .bufferedReader().readText()
        return parser.parseToJsonElement(text) as JsonObject
    }

    private fun JsonObject.players(): List<JsonObject> = arrOrNull("players")!!.map { it as JsonObject }
    private fun JsonObject.markers(): List<JsonObject> = arrOrNull("markers")!!.map { it as JsonObject }

    @Test
    fun `full event survives a player add and marker scan untouched in unknown fields`() {
        val raw = loadFixture("event_full.json")
        val data = EventData.fromJson(raw)

        // Sanity: web-only / not-yet-modeled fields are readable.
        assertEquals("https://xyzcompany.supabase.co/storage/v1/object/public/ar-assets/compiled/targets.mind", data.compiledMindUrl)
        assertEquals(MarkerPos(0.25, 0.75), data.markers[0].pos)
        assertEquals("chest", data.markers[0].libraryModelId)

        // Modify: append a detected marker for Alice (existing player).
        val alice = data.players.first { it.name == "Alice" }
        val updatedAlice = alice.withAppendedDetectedMarker(2)
        var updated = data.withPlayer(updatedAlice)

        // Modify: add a brand-new player joining the hunt.
        val newPlayer = Player.create(name = "Dee", age = "19", customPath = listOf(0, 1, 2), startTime = 1760000200000, avatarId = 9)
        updated = updated.withPlayers(updated.players + newPlayer)

        val json = updated.toJson()

        // The two changes actually landed.
        val aliceJson = json.players().first { it.str("name") == "Alice" }
        // Alice started with [1, 3] (see event_full.json); appending 2 keeps scan order.
        assertEquals(listOf(1, 3, 2), aliceJson.intList("detectedMarkers"))
        assertTrue(json.players().any { it.str("name") == "Dee" })

        // Everything Android doesn't model survived untouched.
        assertEquals(raw["compiledMindUrl"], json["compiledMindUrl"])
        assertEquals(raw["floorPlanUrl"], json["floorPlanUrl"])
        assertEquals(raw.markers()[0]["pos"], json.markers()[0]["pos"])
        assertEquals(raw.markers()[0]["modelUrl"], json.markers()[0]["modelUrl"])
        // Alice's captured photo (a field Android didn't touch on this player) survived.
        assertEquals(raw.players()[0]["capturedPhotos"], aliceJson["capturedPhotos"])
        // Bob (untouched player) is byte-for-byte identical.
        assertEquals(raw.players()[1], json.players().first { it.str("name") == "Bob" })
    }

    @Test
    fun `legacy event missing players settings and status still parses with documented defaults`() {
        val raw = loadFixture("event_minimal_legacy.json")
        val data = EventData.fromJson(raw)

        assertEquals("active", data.status) // missing -> active
        assertTrue(data.isActive)
        assertEquals(0, data.timeLimit)
        assertEquals("standard", data.theme)
        assertTrue(data.players.isEmpty())
        assertEquals(null, data.settings)
        assertEquals(2, data.markers.size)
        assertEquals("coin", data.markers[0].libraryModelId)

        // Now the first hunter ever joins this old event.
        val path = PathGenerator.generatePath(data.markers.size, randomizedPathing = false)
        val player = Player.create("First Hunter", "28", path, 1760000300000, 5)
        val updated = data.withPlayers(listOf(player))

        val json = updated.toJson()
        assertEquals(1, json.players().size)
        // Original marker data, still with no "settings"/"status" keys, untouched.
        assertEquals(raw["markers"], json["markers"])
        assertTrue("settings" !in json)
        assertTrue("status" !in json)
    }

    @Test
    fun `inactive event with unknown top-level marker and player fields keeps them on write`() {
        val raw = loadFixture("event_inactive_with_extras.json")
        val data = EventData.fromJson(raw)

        assertEquals("inactive", data.status)
        assertTrue(!data.isActive)

        val charlie = data.players.first()
        val hinted = applyHint(charlie)
        val updated = data.withPlayer(hinted)
        val json = updated.toJson()

        // Unknown top-level fields are preserved (EventData never touches keys it doesn't write).
        assertEquals(raw["experimentId"], json["experimentId"])
        assertEquals(raw["researcherNotes"], json["researcherNotes"])
        // Unknown field on the marker survives (markers array wasn't touched at all).
        assertEquals(raw["markers"], json["markers"])

        // The hint mutation actually landed...
        val charlieJson = json.players().first()
        assertEquals(3, charlieJson.intOrNull("hintsUsed"))
        // ...while the unknown "consentGiven" field on that same player survives it.
        assertEquals(true, charlieJson["consentGiven"]?.let { (it as kotlinx.serialization.json.JsonPrimitive).boolean })
    }
}
