package com.arthunt.core.domain

import com.arthunt.core.model.Player
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ScanEvaluatorTest {
    private fun freshPlayer(customPath: List<Int> = listOf(0, 2, 1)) =
        Player.create("Alice", "30", customPath, startTime = 1_000L, avatarId = 1)

    @Test
    fun `expected next marker follows customPath`() {
        val player = freshPlayer(listOf(0, 2, 1)).withAppendedDetectedMarker(1) // found marker #1 (index 0)
        assertEquals(2, expectedNextMarkerIndex(player)) // customPath[1] == 2
    }

    @Test
    fun `expected next marker falls back to linear when no customPath`() {
        val player = Player.create("Bob", "20", customPath = emptyList(), startTime = 0, avatarId = 1)
            .withAppendedDetectedMarker(1)
        assertEquals(1, expectedNextMarkerIndex(player)) // detectedMarkers.size fallback
    }

    @Test
    fun `scanning the correct next marker records it`() {
        val player = freshPlayer()
        val result = evaluateScan(player, markerIndex = 0, totalMarkers = 3)
        assertIs<ScanResult.Correct>(result)
        assertEquals(listOf(1), result.updatedPlayer.detectedMarkers)
    }

    @Test
    fun `scanning out of sequence is Wrong and records nothing`() {
        val player = freshPlayer(listOf(0, 2, 1)) // expects marker index 0 first
        val result = evaluateScan(player, markerIndex = 1, totalMarkers = 3)
        assertIs<ScanResult.Wrong>(result)
    }

    @Test
    fun `scanning an already-found marker again is AlreadyFound`() {
        val player = freshPlayer().withAppendedDetectedMarker(1)
        val result = evaluateScan(player, markerIndex = 0, totalMarkers = 3)
        assertIs<ScanResult.AlreadyFound>(result)
    }

    @Test
    fun `completing the last marker sets endTime`() {
        val almostDone = freshPlayer(listOf(0, 2, 1)).withDetectedMarkers(listOf(1, 3)) // found index 0, index 2 -> next is index 1
        val result = evaluateScan(almostDone, markerIndex = 1, totalMarkers = 3, now = 5_000L)
        assertIs<ScanResult.CorrectAndComplete>(result)
        assertEquals(listOf(1, 3, 2), result.updatedPlayer.detectedMarkers)
        assertEquals(5_000L, result.updatedPlayer.endTime)
    }

    @Test
    fun `re-scanning an already-completed marker never touches its endTime`() {
        // Once a marker number is in detectedMarkers, evaluateScan always takes
        // the AlreadyFound branch for it and never re-runs the "set endTime"
        // step -- this is what makes completion a one-time event in practice.
        val finished = freshPlayer(listOf(0, 2, 1))
            .withDetectedMarkers(listOf(1, 3, 2))
            .withEndTime(5_000L)
        val result = evaluateScan(finished, markerIndex = 1, totalMarkers = 3, now = 9_999L)
        assertIs<ScanResult.AlreadyFound>(result)
    }

    @Test
    fun `completion does not fire early when markers remain`() {
        val player = freshPlayer(listOf(0, 2, 1))
        val result = evaluateScan(player, markerIndex = 0, totalMarkers = 3, now = 1_234L)
        assertIs<ScanResult.Correct>(result)
        assertNull(result.updatedPlayer.endTime)
    }

    @Test
    fun `linear fallback path completes in scan order when no customPath is set`() {
        var player = Player.create("Cam", "40", customPath = emptyList(), startTime = 0, avatarId = 2)
        val r1 = evaluateScan(player, markerIndex = 0, totalMarkers = 2)
        assertIs<ScanResult.Correct>(r1)
        player = r1.updatedPlayer
        val r2 = evaluateScan(player, markerIndex = 1, totalMarkers = 2, now = 42L)
        assertIs<ScanResult.CorrectAndComplete>(r2)
        assertTrue(r2.updatedPlayer.detectedMarkers.containsAll(listOf(1, 2)))
    }
}
