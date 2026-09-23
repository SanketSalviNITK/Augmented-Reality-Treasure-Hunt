package com.arthunt.core.model

import kotlinx.serialization.Serializable

/** One dashcam or selfie photo captured during a hunt, stored on a [Player]. */
@Serializable
data class CapturedPhoto(
    val marker: Int,
    val imageUrl: String,
    val timestamp: Long,
    val type: String = "dashcam", // "dashcam" | "selfie"
)
