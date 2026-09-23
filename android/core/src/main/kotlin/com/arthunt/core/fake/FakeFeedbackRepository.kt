package com.arthunt.core.fake

import com.arthunt.core.model.Feedback
import com.arthunt.core.repo.FeedbackRepository

/** Thread-safe in-memory [FeedbackRepository]. */
class FakeFeedbackRepository : FeedbackRepository {
    private val submissions = java.util.Collections.synchronizedList(mutableListOf<Feedback>())

    val all: List<Feedback> get() = synchronized(submissions) { submissions.toList() }

    override suspend fun submit(feedback: Feedback) {
        submissions.add(feedback)
    }
}
