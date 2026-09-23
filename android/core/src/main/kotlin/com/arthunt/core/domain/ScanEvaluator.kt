package com.arthunt.core.domain

import com.arthunt.core.model.Player

/** `customPath[detectedMarkers.size]`, falling back to `detectedMarkers.size` (linear) — ports `updateHUDClue`/`onTargetFound` on the web. */
fun expectedNextMarkerIndex(player: Player): Int =
    player.customPath.getOrElse(player.detectedMarkers.size) { player.detectedMarkers.size }

/** Result of scanning marker index [markerIndex] (0-based), see `js/ar-engine.js#onTargetFound`. */
sealed class ScanResult {
    /** This marker number was already recorded earlier; content may still be shown, nothing changes. */
    data object AlreadyFound : ScanResult()

    /** Scanned out of the required sequence: content hidden, `wrong_scan` should be logged, nothing recorded. */
    data object Wrong : ScanResult()

    /** Correct next marker, recorded. Quest not yet complete. */
    data class Correct(val updatedPlayer: Player) : ScanResult()

    /** Correct next marker, recorded, and it was the last one: `endTime` is set (once) on [updatedPlayer]. */
    data class CorrectAndComplete(val updatedPlayer: Player) : ScanResult()
}

/**
 * Ports the "BLOCKCHAIN VALIDATION" block of `js/ar-engine.js#onTargetFound`:
 * evaluates scanning marker index [markerIndex] (0-based; its 1-based number
 * is `markerIndex + 1`) against [player]'s expected next marker.
 *
 * @param totalMarkers total marker count for this event, to detect completion.
 * @param now epoch ms used for `endTime` on completion; injectable for tests.
 */
fun evaluateScan(
    player: Player,
    markerIndex: Int,
    totalMarkers: Int,
    now: Long = System.currentTimeMillis(),
): ScanResult {
    val markerNumber = markerIndex + 1

    if (markerNumber in player.detectedMarkers) return ScanResult.AlreadyFound

    val expected = expectedNextMarkerIndex(player)
    if (markerIndex != expected) return ScanResult.Wrong

    val updated = player.withAppendedDetectedMarker(markerNumber)
    val complete = updated.detectedMarkers.size >= totalMarkers
    return if (complete) {
        // "set endTime once": never overwrite an endTime that's already set.
        val withEnd = if (updated.endTime == null) updated.withEndTime(now) else updated
        ScanResult.CorrectAndComplete(withEnd)
    } else {
        ScanResult.Correct(updated)
    }
}
