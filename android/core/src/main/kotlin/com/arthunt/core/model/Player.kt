package com.arthunt.core.model

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.put

/**
 * One hunter's record inside an event's `players` array.
 *
 * Shared-contract rule (see `docs/ANDROID_ARCHITECTURE.md` §3): this is the
 * object Android mutates most (appending to `detectedMarkers`, setting
 * `endTime`, bumping `hintsUsed`, appending `capturedPhotos`) while the web
 * app may have written fields Android doesn't know about. Like [Marker] and
 * [EventData], [Player] keeps the raw [JsonObject] it was parsed from;
 * `withX(...)` mutators copy [raw] and overwrite only the key they change,
 * so every other key -- known or not -- survives a read-modify-write cycle.
 *
 * Field notes: `age` is a string (matches existing web-written data, not a
 * number); `detectedMarkers` holds 1-based marker numbers in scan order;
 * `customPath` holds 0-based marker indices, the required scan order;
 * `startTime`/`endTime` are epoch-millisecond longs.
 */
@ConsistentCopyVisibility
data class Player internal constructor(val raw: JsonObject) {
    val name: String get() = raw.strOr("name", "")
    val age: String? get() = raw.str("age")

    /** 1-based marker numbers, in the order this player scanned them. */
    val detectedMarkers: List<Int> get() = raw.intList("detectedMarkers")

    /** 0-based marker indices = the required scan order for this player. */
    val customPath: List<Int> get() = raw.intList("customPath")

    val startTime: Long? get() = raw.longOrNull("startTime")
    val endTime: Long? get() = raw.longOrNull("endTime")
    val avatarId: Int? get() = raw.intOrNull("avatarId")
    val hintsUsed: Int get() = raw.intOrNull("hintsUsed") ?: 0
    val capturedPhotos: List<CapturedPhoto>
        get() = raw.arrOrNull("capturedPhotos")?.map { json.decodeFromJsonElement(CapturedPhoto.serializer(), it) }
            ?: emptyList()

    fun toJson(): JsonObject = raw

    fun withDetectedMarkers(markers: List<Int>): Player = Player(raw.withIntArray("detectedMarkers", markers))
    fun withCustomPath(path: List<Int>): Player = Player(raw.withIntArray("customPath", path))
    fun withStartTime(t: Long): Player = Player(raw.withField("startTime", t))
    fun withEndTime(t: Long?): Player = Player(raw.withField("endTime", t))
    fun withAvatarId(id: Int): Player = Player(raw.withField("avatarId", id))
    fun withHintsUsed(n: Int): Player = Player(raw.withField("hintsUsed", n))

    fun withCapturedPhotos(photos: List<CapturedPhoto>): Player = Player(
        raw.withField(
            "capturedPhotos",
            JsonArray(photos.map { json.encodeToJsonElement(CapturedPhoto.serializer(), it) })
        )
    )

    fun withAppendedDetectedMarker(markerNumber: Int): Player = withDetectedMarkers(detectedMarkers + markerNumber)

    fun withAppendedCapturedPhoto(photo: CapturedPhoto): Player = withCapturedPhotos(capturedPhotos + photo)

    companion object {
        fun fromJson(raw: JsonObject): Player = Player(raw)

        /** A freshly-joined player, as created by `joinEvent` on the web. */
        fun create(
            name: String,
            age: String,
            customPath: List<Int>,
            startTime: Long,
            avatarId: Int,
        ): Player = Player(
            buildJsonObject {
                put("name", name)
                put("age", age)
                put("detectedMarkers", JsonArray(emptyList()))
                put("customPath", JsonArray(customPath.map { kotlinx.serialization.json.JsonPrimitive(it) }))
                put("startTime", startTime)
                put("avatarId", avatarId)
                put("hintsUsed", 0)
            }
        )
    }
}
