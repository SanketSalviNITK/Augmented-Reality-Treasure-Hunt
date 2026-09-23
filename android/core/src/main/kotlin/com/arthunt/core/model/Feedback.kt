package com.arthunt.core.model

import kotlinx.serialization.Serializable

/**
 * `feedback.data` — post-hunt questionnaire, each rating 1-5. Matches the
 * shape the web app writes in `saveFeedbackToDB`.
 */
@Serializable
data class Feedback(
    val immersion: Int,
    val usability: Int,
    val engagement: Int,
    val stability: Int,
)
