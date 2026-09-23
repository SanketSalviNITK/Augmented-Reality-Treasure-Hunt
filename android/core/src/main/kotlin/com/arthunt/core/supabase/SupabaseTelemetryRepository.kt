package com.arthunt.core.supabase

import com.arthunt.core.model.TelemetryRow
import com.arthunt.core.repo.TelemetryRepository
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject

/**
 * [TelemetryRepository] backed by `public.telemetry`. [log] mirrors the
 * web's `logTelemetry`: fire-and-forget, using its own [scope] so a slow or
 * failed network round-trip never blocks gameplay and never throws into the
 * caller.
 */
class SupabaseTelemetryRepository(
    private val client: SupabaseClient,
    private val scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.IO),
) : TelemetryRepository {

    override fun log(eventId: String, participant: String, kind: String, marker: Int?, data: JsonObject?) {
        scope.launch {
            runCatching {
                client.from("telemetry").insert(
                    TelemetryInsertDto(eventId = eventId, participant = participant, kind = kind, marker = marker, data = data)
                )
            }
        }
    }

    override suspend fun list(eventId: String?): List<TelemetryRow> =
        client.from("telemetry")
            .select {
                order("ts", Order.ASCENDING)
                if (eventId != null) filter { eq("event_id", eventId) }
            }
            .decodeList<TelemetryRowDto>()
            .map { it.toModel() }

    private fun TelemetryRowDto.toModel() =
        TelemetryRow(id = id, eventId = eventId, participant = participant, kind = kind, marker = marker, ts = ts, data = data)
}
