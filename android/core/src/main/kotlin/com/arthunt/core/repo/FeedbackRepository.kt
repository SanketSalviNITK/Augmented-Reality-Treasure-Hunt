package com.arthunt.core.repo

import com.arthunt.core.model.Feedback

/** `public.feedback` access. */
interface FeedbackRepository {
    suspend fun submit(feedback: Feedback)
}
