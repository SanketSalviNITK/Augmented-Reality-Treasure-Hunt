package com.arthunt.core.model

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.put

/**
 * One marker/target in an event's `markers` array.
 *
 * Shared-contract rule (see `docs/ANDROID_ARCHITECTURE.md` §3): the web app
 * has fields Android doesn't model yet (e.g. `library:` model URLs are just
 * carried through [modelUrl] as an opaque string; some events may carry
 * other web-only keys in the future). To never drop them, [Marker] keeps the
 * raw [JsonObject] it was parsed from and every typed property reads from
 * it; [toJson] returns that same object, so a Marker nobody has modified
 * serializes back byte-for-byte (modulo key order). `withX(...)` mutators
 * (used by the M2 creator flow) copy [raw] and overwrite only the key they
 * change, leaving every other key -- known or not -- intact.
 */
@ConsistentCopyVisibility
data class Marker internal constructor(val raw: JsonObject) {
    val type: String get() = raw.strOr("type", "model") // "model" | "text"
    val scale: Double? get() = raw.doubleOrNull("scale")
    val color: String? get() = raw.str("color")
    val text: String? get() = raw.str("text")
    val hint: String? get() = raw.str("hint")
    val imageUrl: String? get() = raw.str("imageUrl")

    /** `"library:<id>"` for a bundled model, or a public URL of an uploaded one. */
    val modelUrl: String? get() = raw.str("modelUrl")
    val modelFileName: String? get() = raw.str("modelFileName")

    /** Normalized floor-plan pin, if the creator placed one. */
    val pos: MarkerPos?
        get() = raw.objOrNull("pos")?.let { json.decodeFromJsonElement(MarkerPos.serializer(), it) }

    val isLibraryModel: Boolean get() = modelUrl?.startsWith("library:") == true
    val libraryModelId: String? get() = modelUrl?.removePrefix("library:")?.takeIf { isLibraryModel }

    fun toJson(): JsonObject = raw

    fun withHint(hint: String?): Marker = Marker(raw.withField("hint", hint))
    fun withImageUrl(url: String): Marker = Marker(raw.withField("imageUrl", url))
    fun withPos(pos: MarkerPos?): Marker =
        Marker(raw.withField("pos", pos?.let { json.encodeToJsonElement(MarkerPos.serializer(), it) }))

    companion object {
        fun fromJson(raw: JsonObject): Marker = Marker(raw)

        fun create(
            type: String,
            imageUrl: String,
            scale: Double = 0.5,
            color: String? = null,
            text: String? = null,
            hint: String? = null,
            modelUrl: String? = null,
            modelFileName: String? = null,
            pos: MarkerPos? = null,
        ): Marker = Marker(
            buildJsonObject {
                put("type", type)
                put("scale", scale)
                color?.let { put("color", it) }
                text?.let { put("text", it) }
                hint?.let { put("hint", it) }
                put("imageUrl", imageUrl)
                modelUrl?.let { put("modelUrl", it) }
                modelFileName?.let { put("modelFileName", it) }
                pos?.let { put("pos", json.encodeToJsonElement(MarkerPos.serializer(), it)) }
            }
        )
    }
}
