package com.arthunt.core.domain

import com.arthunt.core.model.EventData
import com.arthunt.core.model.EventSettings
import com.arthunt.core.model.Marker
import com.arthunt.core.model.Player
import kotlin.random.Random
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

class JoinPlannerTest {
    private fun eventWith(
        markerCount: Int = 3,
        timeLimit: Int = 0,
        randomizedPathing: Boolean = true,
    ) = EventData.create(
        name = "Test Hunt",
        markers = (0 until markerCount).map {
            Marker.create(type = "model", imageUrl = "https://example.com/$it.jpg", modelUrl = "library:chest")
        },
        timeLimit = timeLimit,
        settings = EventSettings(randomizedPathing = randomizedPathing),
    )

    @Test
    fun `no existing player creates a New one with a generated path, avatar and startTime`() {
        val outcome = JoinPlanner.plan(
            event = eventWith(markerCount = 4, randomizedPathing = false),
            existing = null,
            name = "Alice",
            age = "30",
            now = 5_000L,
            random = Random(1),
        )

        val player = assertIs<JoinOutcome.New>(outcome).player
        assertEquals("Alice", player.name)
        assertEquals("30", player.age)
        assertEquals(listOf(0, 1, 2, 3), player.customPath) // linear, randomizedPathing = false
        assertEquals(5_000L, player.startTime)
        assertTrue(player.avatarId in 1..50)
        assertEquals(0, player.hintsUsed)
        assertTrue(player.detectedMarkers.isEmpty())
    }

    @Test
    fun `no existing player honors randomizedPathing from event settings`() {
        val outcome = JoinPlanner.plan(
            event = eventWith(markerCount = 5, randomizedPathing = true),
            existing = null,
            name = "Bob",
            age = "22",
            now = 0L,
            random = Random(42),
        )
        val player = assertIs<JoinOutcome.New>(outcome).player
        assertEquals(0, player.customPath.first()) // marker 0 always first
        assertEquals((0 until 5).toSet(), player.customPath.toSet())
    }

    @Test
    fun `existing player who found every marker shows results, regardless of time left`() {
        val existing = Player.create("Alice", "30", listOf(0, 1, 2), startTime = 0L, avatarId = 1)
            .withDetectedMarkers(listOf(1, 2, 3))
        val outcome = JoinPlanner.plan(
            event = eventWith(markerCount = 3, timeLimit = 60),
            existing = existing,
            name = "Alice",
            age = "30",
            now = 1_000L,
        )
        val shown = assertIs<JoinOutcome.ShowResults>(outcome).player
        assertEquals(existing, shown)
    }

    @Test
    fun `existing player whose time limit expired shows results even if unfinished`() {
        val existing = Player.create("Alice", "30", listOf(0, 1, 2), startTime = 0L, avatarId = 1)
            .withDetectedMarkers(listOf(1))
        val outcome = JoinPlanner.plan(
            event = eventWith(markerCount = 3, timeLimit = 10), // 10 minutes = 600_000 ms
            existing = existing,
            name = "Alice",
            age = "30",
            now = 600_000L, // exactly at the limit
        )
        assertIs<JoinOutcome.ShowResults>(outcome)
    }

    @Test
    fun `existing player still within the time limit is not shown results`() {
        val existing = Player.create("Alice", "30", listOf(0, 1, 2), startTime = 0L, avatarId = 1)
            .withDetectedMarkers(listOf(1))
        val outcome = JoinPlanner.plan(
            event = eventWith(markerCount = 3, timeLimit = 10),
            existing = existing,
            name = "Alice",
            age = "30",
            now = 599_999L,
        )
        assertIs<JoinOutcome.Resume>(outcome)
    }

    @Test
    fun `existing player who exited early resumes with endTime cleared and progress kept`() {
        val existing = Player.create("Alice", "30", listOf(0, 1, 2), startTime = 100L, avatarId = 7)
            .withDetectedMarkers(listOf(1))
            .withEndTime(9_999L)
        val outcome = JoinPlanner.plan(
            event = eventWith(markerCount = 3),
            existing = existing,
            name = "Alice",
            age = "30",
            now = 50_000L,
        )
        val resumed = assertIs<JoinOutcome.Resume>(outcome).player
        assertNull(resumed.endTime)
        assertEquals(listOf(1), resumed.detectedMarkers) // progress kept
        assertEquals(100L, resumed.startTime) // startTime kept, not reset
    }

    @Test
    fun `existing player still mid-hunt (no endTime) resumes unchanged`() {
        val existing = Player.create("Alice", "30", listOf(0, 1, 2), startTime = 100L, avatarId = 7)
            .withDetectedMarkers(listOf(1))
        val outcome = JoinPlanner.plan(
            event = eventWith(markerCount = 3),
            existing = existing,
            name = "Alice",
            age = "30",
            now = 50_000L,
        )
        val resumed = assertIs<JoinOutcome.Resume>(outcome).player
        assertEquals(existing, resumed)
    }

    @Test
    fun `legacy player without a startTime resumes with a fresh startTime and backfilled avatar`() {
        // Simulates a player record written before startTime/avatarId existed.
        val legacyNoStart = legacyPlayerMissingStartAndAvatar("Cam", "40")

        val outcome = JoinPlanner.plan(
            event = eventWith(markerCount = 2),
            existing = legacyNoStart,
            name = "Cam",
            age = "40",
            now = 77_000L,
            random = Random(3),
        )
        val resumed = assertIs<JoinOutcome.Resume>(outcome).player
        assertEquals(77_000L, resumed.startTime)
        assertTrue(resumed.avatarId != null && resumed.avatarId!! in 1..50)
        assertNull(resumed.endTime)
    }

    // Legacy player records predate `startTime`/`avatarId` entirely -- built
    // directly from a raw JSON object with those keys absent, the same shape
    // `Player.fromJson` would produce reading such a row back from Supabase.
    private fun legacyPlayerMissingStartAndAvatar(name: String, age: String) = Player.fromJson(
        kotlinx.serialization.json.buildJsonObject {
            put("name", kotlinx.serialization.json.JsonPrimitive(name))
            put("age", kotlinx.serialization.json.JsonPrimitive(age))
            put("detectedMarkers", kotlinx.serialization.json.JsonArray(emptyList()))
            put("customPath", kotlinx.serialization.json.JsonArray(emptyList()))
        }
    )
}
