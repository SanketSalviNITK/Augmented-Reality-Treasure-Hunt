package com.arthunt.core.domain

import com.arthunt.core.model.EventData
import com.arthunt.core.model.Player
import kotlin.random.Random

/**
 * Result of [JoinPlanner.plan]: what a hunter's tap on "Join" should do next.
 * Never writes anything itself -- the caller (`HunterViewModel`) decides how
 * to persist it via [com.arthunt.core.repo.EventRepository.updatePlayer].
 */
sealed class JoinOutcome {
    /** Rejoining a player who already finished, or whose time limit has expired: skip straight to the post-hunt standings, no hunt starts. */
    data class ShowResults(val player: Player) : JoinOutcome()

    /** Rejoining a player who exited early with time/markers left: resume with their existing progress and `startTime`. */
    data class Resume(val player: Player) : JoinOutcome()

    /** First time this name has joined this event: a freshly generated path, avatar and `startTime`. */
    data class New(val player: Player) : JoinOutcome()
}

/**
 * Pure decision function for `joinEvent` (main.js), ported 1:1 including the
 * CURRENT (post-fix) rejoin rules from `docs/ANDROID_ARCHITECTURE.md` §4:
 *
 * - Found all markers, OR the event's time limit has expired -> [JoinOutcome.ShowResults]
 *   (checked BEFORE consent -- the caller must not show the consent gate for this case).
 * - Exited early (`endTime` set, not complete, time left) -> [JoinOutcome.Resume]:
 *   `endTime` cleared, progress and `startTime` kept.
 * - A legacy player record with no `startTime` at all (joined before this
 *   field existed) -> [JoinOutcome.Resume] with a fresh `startTime` (and a
 *   freshly assigned avatar if it never got one either), matching
 *   `joinEvent`'s `else if (!playerRecord.startTime)` fallback.
 * - No existing player by that name -> [JoinOutcome.New]: path via
 *   [PathGenerator] (honoring `settings.randomizedPathing`), `startTime = now`,
 *   a random `avatarId` in 1..50, zero hints, no detected markers.
 *
 * Nothing here talks to a repository: [event] and [existing] are read-only
 * snapshots the caller already has (or just fetched), and [now]/[random] are
 * injectable so this is exhaustively unit-testable.
 */
object JoinPlanner {
    fun plan(
        event: EventData,
        existing: Player?,
        name: String,
        age: String,
        now: Long = System.currentTimeMillis(),
        random: Random = Random.Default,
    ): JoinOutcome =
        if (existing != null) planExisting(event, existing, now, random) else planNew(event, name, age, now, random)

    private fun planExisting(event: EventData, existing: Player, now: Long, random: Random): JoinOutcome {
        val markerCount = event.markers.size
        val foundAll = markerCount > 0 && existing.detectedMarkers.size >= markerCount
        val start = existing.startTime
        val timeLimit = event.timeLimit
        val expired = timeLimit > 0 && start != null && (now - start) >= timeLimit * 60_000L

        if (foundAll || expired) return JoinOutcome.ShowResults(existing)

        // Legacy player, never given a startTime: start the clock now (and
        // backfill an avatar if that's missing too), same as the web's
        // one-time "first real join" fallback for old records.
        if (start == null) {
            var resumed = existing.withStartTime(now)
            if (existing.avatarId == null) resumed = resumed.withAvatarId(randomAvatarId(random))
            return JoinOutcome.Resume(resumed)
        }

        // Exited early with time/markers left -> resume where they left off.
        if (existing.endTime != null) return JoinOutcome.Resume(existing.withEndTime(null))

        // Still mid-hunt (e.g. rejoining the same still-open session): nothing to change.
        return JoinOutcome.Resume(existing)
    }

    private fun planNew(event: EventData, name: String, age: String, now: Long, random: Random): JoinOutcome {
        val randomizedPathing = event.settings?.randomizedPathing ?: true
        val path = PathGenerator.generatePath(event.markers.size, randomizedPathing, random)
        val player = Player.create(
            name = name,
            age = age,
            customPath = path,
            startTime = now,
            avatarId = randomAvatarId(random),
        )
        return JoinOutcome.New(player)
    }

    private fun randomAvatarId(random: Random): Int = 1 + random.nextInt(50)
}
