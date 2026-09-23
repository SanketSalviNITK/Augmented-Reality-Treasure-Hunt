package com.arthunt.core.model

import kotlinx.serialization.Serializable

/**
 * Normalized floor-plan position of a marker, `0.0..1.0` on each axis.
 * Optional — only present when the creator pinned the marker on a venue
 * floor plan (web-only feature so far; Android just carries it through).
 */
@Serializable
data class MarkerPos(
    val x: Double,
    val y: Double,
)
