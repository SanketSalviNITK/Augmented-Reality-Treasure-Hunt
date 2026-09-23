package com.arthunt.core.domain

import kotlin.random.Random

/**
 * Ports `joinEvent`'s path generation from the web app 1:1 (main.js).
 *
 * - `randomizedPathing == false` -> linear `[0, 1, ..., n-1]`.
 * - Otherwise -> `[0] + FisherYatesShuffle([1, ..., n-1])`: marker 0 is
 *   always scanned first, the rest are shuffled ("Blockchain Path" in the
 *   web app's logging).
 *
 * [random] is injectable so tests can assert exact shuffles.
 */
object PathGenerator {
    fun generatePath(
        markerCount: Int,
        randomizedPathing: Boolean,
        random: Random = Random.Default,
    ): List<Int> {
        require(markerCount >= 0) { "markerCount must be >= 0" }
        if (markerCount == 0) return emptyList()

        if (!randomizedPathing) {
            return (0 until markerCount).toList()
        }

        val targets = (1 until markerCount).toMutableList()
        // Fisher-Yates, matching the web's loop exactly (i from last down to 1).
        for (i in targets.indices.reversed()) {
            if (i == 0) break
            val j = random.nextInt(i + 1)
            val tmp = targets[i]
            targets[i] = targets[j]
            targets[j] = tmp
        }
        return listOf(0) + targets
    }
}
