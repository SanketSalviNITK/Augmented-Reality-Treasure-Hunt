package com.arthunt.core.domain

import com.arthunt.core.model.Player
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ScoringTest {
    private fun player(name: String, found: Int, hints: Int, startTime: Long, avatarId: Int = 1) =
        Player.create(name, "20", customPath = (0 until found + 1).toList(), startTime = startTime, avatarId = avatarId)
            .withDetectedMarkers((1..found).toList())
            .withHintsUsed(hints)

    @Test
    fun `score is 100 per marker minus 50 per hint`() {
        assertEquals(300, score(foundCount = 3, hintsUsed = 0))
        assertEquals(250, score(foundCount = 3, hintsUsed = 1))
        assertEquals(0, score(foundCount = 1, hintsUsed = 2))
        assertEquals(-50, score(foundCount = 0, hintsUsed = 1))
    }

    @Test
    fun `leaderboard orders by score descending`() {
        val a = player("Alice", found = 3, hints = 0, startTime = 100)
        val b = player("Bob", found = 1, hints = 0, startTime = 50)
        val ordered = leaderboardOrder(listOf(b, a))
        assertEquals(listOf("Alice", "Bob"), ordered.map { it.name })
    }

    @Test
    fun `leaderboard breaks score ties by earlier startTime first`() {
        val a = player("Alice", found = 2, hints = 0, startTime = 500)
        val b = player("Bob", found = 2, hints = 0, startTime = 100)
        val ordered = leaderboardOrder(listOf(a, b))
        assertEquals(listOf("Bob", "Alice"), ordered.map { it.name })
    }

    @Test
    fun `hint use is worth negative fifty and increments hintsUsed`() {
        val p = player("Alice", found = 1, hints = 0, startTime = 0)
        val hinted = applyHint(p)
        assertEquals(1, hinted.hintsUsed)
        assertEquals(score(p) - 50, score(hinted))
    }

    @Test
    fun `anonymized display name uses avatar id`() {
        val p = player("Alice", found = 0, hints = 0, startTime = 0, avatarId = 17)
        assertEquals("Hunter_17", displayName(p, anonymize = true))
        assertEquals("Alice", displayName(p, anonymize = false))
    }

    @Test
    fun `remaining time counts down and null means unlimited`() {
        assertNull(remainingMillis(timeLimitMinutes = 0, startTime = 0, now = 10_000))
        assertEquals(10 * 60_000L, remainingMillis(timeLimitMinutes = 10, startTime = 1_000, now = 1_000))
        assertEquals(5 * 60_000L, remainingMillis(timeLimitMinutes = 10, startTime = 0, now = 5 * 60_000L))
    }

    @Test
    fun `remaining time goes to and past zero when the limit is exceeded`() {
        val remaining = remainingMillis(timeLimitMinutes = 5, startTime = 0, now = 6 * 60_000L)
        assertEquals(-1 * 60_000L, remaining)
    }
}
