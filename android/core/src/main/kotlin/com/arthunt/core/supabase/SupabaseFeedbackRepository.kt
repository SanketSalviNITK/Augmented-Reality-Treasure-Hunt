package com.arthunt.core.supabase

import com.arthunt.core.model.Feedback
import com.arthunt.core.repo.FeedbackRepository
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.encodeToJsonElement

class SupabaseFeedbackRepository(private val client: SupabaseClient) : FeedbackRepository {
    override suspend fun submit(feedback: Feedback) {
        val data = Json.encodeToJsonElement(Feedback.serializer(), feedback) as JsonObject
        client.from("feedback").insert(FeedbackInsertDto(data))
    }
}
