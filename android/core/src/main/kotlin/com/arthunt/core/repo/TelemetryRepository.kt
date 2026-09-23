package com.arthunt.core.repo

import com.arthunt.core.model.TelemetryRow
import kotlinx.serialization.json.JsonObject

/**
 * `public.telemetry` access. [log] mirrors the web's `logTelemetry`: it is
 * fire-and-forget (never suspends the caller on the network round-trip, never
 * throws) -- implementations launch their own write and swallow/log errors.
 */
interface TelemetryRepository {
    fun log(eventId: String, participant: String, kind: String, marker: Int? = null, data: JsonObject? = null)
    suspend fun list(eventId: String? = null): List<TelemetryRow>
}
