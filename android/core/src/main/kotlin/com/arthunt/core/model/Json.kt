package com.arthunt.core.model

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull

/**
 * Shared JSON config for every `@Serializable` model in this package.
 *
 * `ignoreUnknownKeys` + `explicitNulls = false` let Android read `events.data`
 * blobs written by the web app (or by older versions of either app) without
 * choking on fields it doesn't model yet — see the shared-contract note on
 * [EventData], [Marker] and [Player] for how those fields are preserved on
 * write, not just tolerated on read.
 */
internal val json: Json = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
    encodeDefaults = true
    isLenient = true
}

// --- small helpers for reading/writing raw JsonObject "documents" without
// --- round-tripping through a fully-typed @Serializable class (which would
// --- drop any key that class doesn't declare). Used by EventData, Marker and
// --- Player; see their KDoc for the round-trip contract this supports.

internal fun JsonObject.str(key: String): String? = this[key]?.jsonPrimitive?.contentOrNull
internal fun JsonObject.strOr(key: String, default: String): String = str(key) ?: default
internal fun JsonObject.intOrNull(key: String): Int? = this[key]?.jsonPrimitive?.intOrNull
internal fun JsonObject.longOrNull(key: String): Long? = this[key]?.jsonPrimitive?.longOrNull
internal fun JsonObject.doubleOrNull(key: String): Double? = this[key]?.jsonPrimitive?.doubleOrNull
internal fun JsonObject.boolOrNull(key: String): Boolean? = this[key]?.jsonPrimitive?.booleanOrNull
internal fun JsonObject.objOrNull(key: String): JsonObject? = (this[key] as? JsonObject) ?: this[key]?.takeIf { it != kotlinx.serialization.json.JsonNull }?.jsonObject
internal fun JsonObject.arrOrNull(key: String): JsonArray? = (this[key] as? JsonArray) ?: this[key]?.takeIf { it != kotlinx.serialization.json.JsonNull }?.jsonArray
internal fun JsonObject.intList(key: String): List<Int> =
    arrOrNull(key)?.map { it.jsonPrimitive.intOrNull ?: 0 } ?: emptyList()

/** Returns a copy of [this] with [key] set to [value] (or removed, if [value] is null). */
internal fun JsonObject.withField(key: String, value: kotlinx.serialization.json.JsonElement?): JsonObject {
    val map = LinkedHashMap(this)
    if (value == null) map.remove(key) else map[key] = value
    return JsonObject(map)
}

internal fun JsonObject.withField(key: String, value: String?): JsonObject =
    withField(key, value?.let { JsonPrimitive(it) })

internal fun JsonObject.withField(key: String, value: Int?): JsonObject =
    withField(key, value?.let { JsonPrimitive(it) })

internal fun JsonObject.withField(key: String, value: Long?): JsonObject =
    withField(key, value?.let { JsonPrimitive(it) })

internal fun JsonObject.withIntArray(key: String, values: List<Int>): JsonObject =
    withField(key, JsonArray(values.map { JsonPrimitive(it) }))
