package com.arthunt.core.model

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.put

/**
 * The `events.data` JSONB blob (see `/schema.sql`, `docs/ANDROID_ARCHITECTURE.md`
 * §3). Every field is optional when reading -- older events may lack
 * `players`, `settings` or `status` entirely.
 *
 * Shared-contract rule: this app must never delete data the web app wrote,
 * including fields it doesn't model at all (`compiledMindUrl` -- MindAR-only,
 * ignored on Android; future fields neither app has been updated for yet).
 * [EventData] keeps the raw [JsonObject] it was parsed from; every typed
 * property is a read-only view onto it, and every `withX(...)` mutator
 * returns a new [EventData] built by copying [raw] and overwriting only the
 * key it changes. [toJson] returns that merged object -- what repositories
 * actually send back to Supabase -- so unknown keys always survive a
 * read-modify-write cycle untouched.
 */
@ConsistentCopyVisibility
data class EventData internal constructor(val raw: JsonObject) {
    val name: String get() = raw.strOr("name", "")

    /** "active" | "inactive"; missing means active. */
    val status: String get() = raw.strOr("status", "active")
    val isActive: Boolean get() = status != "inactive"

    /** Minutes; 0 = unlimited. */
    val timeLimit: Int get() = raw.intOrNull("timeLimit") ?: 0

    /** "standard" | "cyberpunk" | "minimalist". */
    val theme: String get() = raw.strOr("theme", "standard")

    val markers: List<Marker>
        get() = raw.arrOrNull("markers")?.map { Marker.fromJson(it as JsonObject) } ?: emptyList()

    val settings: EventSettings?
        get() = raw.objOrNull("settings")?.let { json.decodeFromJsonElement(EventSettings.serializer(), it) }

    val floorPlanUrl: String? get() = raw.str("floorPlanUrl")

    /** WEB-ONLY (MindAR precompiled target buffer). Android ignores it but never drops it. */
    val compiledMindUrl: String? get() = raw.str("compiledMindUrl")

    val players: List<Player>
        get() = raw.arrOrNull("players")?.map { Player.fromJson(it as JsonObject) } ?: emptyList()

    fun toJson(): JsonObject = raw

    fun withPlayers(players: List<Player>): EventData =
        EventData(raw.withField("players", JsonArray(players.map { it.toJson() })))

    fun withPlayer(updated: Player): EventData {
        val existing = players
        val idx = existing.indexOfFirst { it.name == updated.name }
        val next = if (idx >= 0) existing.toMutableList().apply { this[idx] = updated } else existing + updated
        return withPlayers(next)
    }

    fun withStatus(status: String): EventData = EventData(raw.withField("status", status))
    fun withMarkers(markers: List<Marker>): EventData =
        EventData(raw.withField("markers", JsonArray(markers.map { it.toJson() })))
    fun withFloorPlanUrl(url: String?): EventData = EventData(raw.withField("floorPlanUrl", url))
    fun withSettings(settings: EventSettings): EventData =
        EventData(raw.withField("settings", json.encodeToJsonElement(EventSettings.serializer(), settings)))

    companion object {
        fun fromJson(raw: JsonObject): EventData = EventData(raw)

        fun create(
            name: String,
            markers: List<Marker>,
            timeLimit: Int = 0,
            theme: String = "standard",
            settings: EventSettings = EventSettings(),
        ): EventData = EventData(
            buildJsonObject {
                put("name", name)
                put("status", "active")
                put("timeLimit", timeLimit)
                put("theme", theme)
                put("markers", JsonArray(markers.map { it.toJson() }))
                put("settings", json.encodeToJsonElement(EventSettings.serializer(), settings))
                put("players", JsonArray(emptyList()))
            }
        )
    }
}
