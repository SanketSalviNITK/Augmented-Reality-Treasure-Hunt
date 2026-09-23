package com.arthunt.core.model

import kotlinx.serialization.json.JsonObject

/**
 * One row of `public.telemetry` (append-only). `kind` is one of `join`,
 * `scan`, `wrong_scan`, `hint`, `complete`, `net_sample` (web), or the
 * Android-only `wifi_scan` (M3). `marker` is the 1-based marker number the
 * event concerns, when applicable.
 */
data class TelemetryRow(
    val id: Long? = null,
    val eventId: String?,
    val participant: String?,
    val kind: String,
    val marker: Int? = null,
    val ts: String? = null,
    val data: JsonObject? = null,
)
