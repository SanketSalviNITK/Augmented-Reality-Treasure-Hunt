package com.arthunt.core.domain

import com.arthunt.core.model.Player

/** `score = 100 × found − 50 × hintsUsed` (same formula used everywhere on the web: HUD, live monitor, post-hunt leaderboard). */
fun score(foundCount: Int, hintsUsed: Int): Int = foundCount * 100 - hintsUsed * 50

fun score(player: Player): Int = score(player.detectedMarkers.size, player.hintsUsed)

/**
 * Leaderboard order: score descending, then `startTime` ascending (earlier
 * joiners rank higher on ties) — ports the sort used by
 * `renderHunterLeaderboard`, `renderLiveMonitorLeaderboard` and
 * `renderPostHuntLeaderboard`.
 */
fun leaderboardOrder(players: List<Player>): List<Player> =
    players.sortedWith(
        compareByDescending<Player> { score(it) }.thenBy { it.startTime ?: 0L }
    )

/** "Give up?" hint: -50 to score via `hintsUsed += 1`. Caller is responsible for logging the `hint` telemetry event. */
fun applyHint(player: Player): Player = player.withHintsUsed(player.hintsUsed + 1)

/** `Hunter_<avatarId>` when `settings.anonymizeHunters`, else the player's real name. */
fun displayName(player: Player, anonymize: Boolean): String =
    if (anonymize) "Hunter_${player.avatarId ?: "X"}" else player.name

/**
 * Remaining time in ms, or `null` if the event has no time limit
 * (`timeLimitMinutes <= 0`). Ports `startQuestTimer`'s countdown math;
 * `<= 0` means time is up.
 */
fun remainingMillis(timeLimitMinutes: Int, startTime: Long, now: Long = System.currentTimeMillis()): Long? {
    if (timeLimitMinutes <= 0) return null
    val limitMs = timeLimitMinutes * 60_000L
    return limitMs - (now - startTime)
}
