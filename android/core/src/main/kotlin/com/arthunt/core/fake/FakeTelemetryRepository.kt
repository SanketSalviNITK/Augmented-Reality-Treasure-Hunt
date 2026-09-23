package com.arthunt.core.fake

import com.arthunt.core.model.TelemetryRow
import com.arthunt.core.repo.TelemetryRepository
import java.util.concurrent.atomic.AtomicLong
import kotlinx.serialization.json.JsonObject

/** Thread-safe in-memory [TelemetryRepository]. [log] is synchronous here (there's no real network hop to avoid blocking on). */
class FakeTelemetryRepository : TelemetryRepository {
    private val rows = java.util.Collections.synchronizedList(mutableListOf<TelemetryRow>())
    private val nextId = AtomicLong(1)

    override fun log(eventId: String, participant: String, kind: String, marker: Int?, data: JsonObject?) {
        rows.add(
            TelemetryRow(
                id = nextId.getAndIncrement(),
                eventId = eventId,
                participant = participant,
                kind = kind,
                marker = marker,
                ts = java.time.Instant.now().toString(),
                data = data,
            )
        )
    }

    override suspend fun list(eventId: String?): List<TelemetryRow> =
        synchronized(rows) { rows.toList() }.filter { eventId == null || it.eventId == eventId }
}
