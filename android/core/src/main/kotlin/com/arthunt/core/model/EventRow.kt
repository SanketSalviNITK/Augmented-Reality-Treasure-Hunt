package com.arthunt.core.model

/**
 * A row of `public.events`: `id`, its `data` JSONB blob (see [EventData]),
 * and `created_at` (kept as the raw ISO-8601 string Postgrest returns --
 * Android never needs to do date arithmetic on it in M0).
 */
data class EventRow(
    val id: String,
    val data: EventData,
    val createdAt: String? = null,
)
