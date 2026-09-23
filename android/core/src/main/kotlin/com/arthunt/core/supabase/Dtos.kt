package com.arthunt.core.supabase

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

/** Wire shape of a `public.events` row. */
@Serializable
internal data class EventRowDto(
    val id: String,
    val data: JsonObject,
    @SerialName("created_at") val createdAt: String? = null,
)

/** Insert body for `public.events` -- `id`/`created_at` are server-generated. */
@Serializable
internal data class EventInsertDto(val data: JsonObject)

/** Insert body for `public.telemetry` -- `id`/`ts` are server-generated. */
@Serializable
internal data class TelemetryInsertDto(
    @SerialName("event_id") val eventId: String,
    val participant: String,
    val kind: String,
    val marker: Int? = null,
    val data: JsonObject? = null,
)

/** Wire shape of a `public.telemetry` row. */
@Serializable
internal data class TelemetryRowDto(
    val id: Long,
    @SerialName("event_id") val eventId: String? = null,
    val participant: String? = null,
    val kind: String,
    val marker: Int? = null,
    val ts: String? = null,
    val data: JsonObject? = null,
)

/** Insert body for `public.feedback`. */
@Serializable
internal data class FeedbackInsertDto(val data: JsonObject)
