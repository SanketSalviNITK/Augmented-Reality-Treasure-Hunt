package com.arthunt.app.ar

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.Color as AndroidColor
import com.arthunt.core.model.Marker
import com.google.android.filament.Engine
import io.github.sceneview.loaders.MaterialLoader
import io.github.sceneview.loaders.ModelLoader
import io.github.sceneview.math.Scale
import io.github.sceneview.math.Size
import io.github.sceneview.model.ModelInstance
import io.github.sceneview.node.ModelNode
import io.github.sceneview.node.Node
import io.github.sceneview.node.PlaneNode
import io.github.sceneview.texture.ImageTexture
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private const val FALLBACK_LIBRARY_MODEL_ID = "chest"
private const val LIBRARY_MODEL_ASSET_FOLDER = "models"

// Idle-spin rate for library/uploaded models, matching the web app's slowly-rotating reward
// preview (docs/ANDROID_ARCHITECTURE.md §5).
private const val SPIN_DEGREES_PER_SECOND = 18f

// Every model is normalized to ~this size (its largest dimension, in meters) before the marker's
// own `scale` is applied, so a chest and a tiny uploaded gem read as roughly the same size in AR.
private const val MODEL_NORMALIZED_SIZE_METERS = 0.25f

private const val TEXT_CARD_WIDTH_METERS = 0.22f
private const val TEXT_CARD_HEIGHT_METERS = 0.14f
private const val DEFAULT_TEXT_CARD_COLOR = "#a78bfa"

/**
 * A built reward node, plus an optional one-line notice for the HUD when a fallback was used
 * (e.g. "Using the treasure chest -- the uploaded model couldn't be loaded.").
 */
data class RewardResult(val node: Node, val notice: String? = null)

/**
 * Builds the AR reward shown above a detected marker (docs/ANDROID_ARCHITECTURE.md §5):
 * - `library:<id>` -> the bundled `assets/models/<id>.glb`, idle-spinning.
 * - an uploaded `.glb`/`.gltf` URL -> loaded over the network, idle-spinning.
 * - any other uploaded model format, or any load failure -> falls back to the bundled chest model
 *   with a one-line notice.
 * - `type == "text"` -> a flat rounded card (a plane textured with a canvas-drawn bitmap: the
 *   marker's `color` as background, white `text`), matching the web app's text-card reward.
 *
 * Must be called from a coroutine that can resume on the engine's owning thread (the network/asset
 * I/O below runs on [Dispatchers.IO], but node/texture construction always happens back on the
 * caller's original dispatcher) -- see `ui/ar/ArHuntScreen.kt`, which calls this from
 * `rememberCoroutineScope()` (main thread).
 */
object RewardFactory {

    suspend fun create(
        marker: Marker,
        engine: Engine,
        modelLoader: ModelLoader,
        materialLoader: MaterialLoader,
    ): RewardResult = if (marker.type == "text") {
        RewardResult(createTextCardNode(marker, engine, materialLoader))
    } else {
        createModelReward(marker, engine, modelLoader)
    }

    private suspend fun createModelReward(
        marker: Marker,
        engine: Engine,
        modelLoader: ModelLoader,
    ): RewardResult {
        val libraryId = marker.libraryModelId
        val modelUrl = marker.modelUrl

        val (instance, notice) = when {
            libraryId != null -> {
                val loaded = loadLibraryModel(modelLoader, libraryId)
                if (loaded != null) {
                    loaded to null
                } else {
                    loadLibraryModel(modelLoader, FALLBACK_LIBRARY_MODEL_ID) to
                        "Using the treasure chest -- the \"$libraryId\" model couldn't be loaded."
                }
            }

            modelUrl != null && (modelUrl.endsWith(".glb", ignoreCase = true) ||
                modelUrl.endsWith(".gltf", ignoreCase = true)) -> {
                val loaded = withContext(Dispatchers.IO) {
                    runCatching { modelLoader.loadModelInstance(modelUrl) }.getOrNull()
                }
                if (loaded != null) {
                    loaded to null
                } else {
                    loadLibraryModel(modelLoader, FALLBACK_LIBRARY_MODEL_ID) to
                        "Using the treasure chest -- the uploaded model couldn't be loaded."
                }
            }

            else -> {
                val name = marker.modelFileName?.let { " (\"$it\")" } ?: ""
                loadLibraryModel(modelLoader, FALLBACK_LIBRARY_MODEL_ID) to
                    "Using the treasure chest -- this marker's uploaded model$name isn't a " +
                    "format the app can render."
            }
        }

        val userScale = (marker.scale ?: 0.5).toFloat().coerceAtLeast(0.01f)
        val node = if (instance != null) {
            SpinningModelNode(instance, scaleToUnits = MODEL_NORMALIZED_SIZE_METERS).apply {
                scale = Scale(userScale)
            }
        } else {
            // Both the requested model and the chest fallback failed (e.g. a corrupt/missing
            // bundled asset) -- show an empty node rather than crash the AR session.
            Node(engine)
        }
        return RewardResult(node, notice)
    }

    private suspend fun loadLibraryModel(modelLoader: ModelLoader, id: String): ModelInstance? =
        withContext(Dispatchers.IO) {
            runCatching {
                modelLoader.createModelInstance("$LIBRARY_MODEL_ASSET_FOLDER/$id.glb")
            }.getOrNull()
        }

    private fun createTextCardNode(
        marker: Marker,
        engine: Engine,
        materialLoader: MaterialLoader,
    ): Node {
        val bitmap = drawTextCardBitmap(marker.text.orEmpty(), marker.color)
        val texture = ImageTexture.Builder().bitmap(bitmap).build(engine)
        val materialInstance = materialLoader.createImageInstance(texture)
        val userScale = (marker.scale ?: 0.5).toFloat().coerceAtLeast(0.01f)
        return PlaneNode(
            engine = engine,
            size = Size(x = TEXT_CARD_WIDTH_METERS, y = TEXT_CARD_HEIGHT_METERS),
            materialInstance = materialInstance,
        ).apply { scale = Scale(userScale) }
    }

    private fun drawTextCardBitmap(text: String, colorHex: String?): Bitmap {
        val width = 512
        val height = 320
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        val backgroundColor = runCatching { AndroidColor.parseColor(colorHex) }
            .getOrDefault(AndroidColor.parseColor(DEFAULT_TEXT_CARD_COLOR))
        val backgroundPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = backgroundColor }
        val corner = 48f
        canvas.drawRoundRect(
            RectF(0f, 0f, width.toFloat(), height.toFloat()), corner, corner, backgroundPaint,
        )

        val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = AndroidColor.WHITE
            textSize = 40f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            textAlign = Paint.Align.CENTER
        }
        drawWrappedText(canvas, text.ifBlank { "You found it!" }, textPaint, width, height)
        return bitmap
    }

    private fun drawWrappedText(canvas: Canvas, text: String, paint: Paint, width: Int, height: Int) {
        val maxWidth = width - 64f
        val words = text.trim().split(Regex("\\s+"))
        val lines = mutableListOf<String>()
        var line = StringBuilder()
        for (word in words) {
            val candidate = if (line.isEmpty()) word else "$line $word"
            if (paint.measureText(candidate) > maxWidth && line.isNotEmpty()) {
                lines += line.toString()
                line = StringBuilder(word)
            } else {
                line = StringBuilder(candidate)
            }
        }
        if (line.isNotEmpty()) lines += line.toString()

        val lineHeight = paint.textSize * 1.3f
        val startY = height / 2f - (lines.size - 1) * lineHeight / 2f
        lines.forEachIndexed { index, l ->
            canvas.drawText(l, width / 2f, startY + index * lineHeight, paint)
        }
    }
}

/** A [ModelNode] that idle-spins slowly around Y, like the library reward previews on the web app. */
private class SpinningModelNode(
    modelInstance: ModelInstance,
    scaleToUnits: Float?,
) : ModelNode(modelInstance = modelInstance, scaleToUnits = scaleToUnits) {

    private var startTimeNanos: Long? = null

    override fun onFrame(frameTimeNanos: Long) {
        super.onFrame(frameTimeNanos)
        val start = startTimeNanos ?: frameTimeNanos.also { startTimeNanos = it }
        val elapsedSeconds = (frameTimeNanos - start) / 1_000_000_000f
        rotation = rotation.copy(y = (elapsedSeconds * SPIN_DEGREES_PER_SECOND) % 360f)
    }
}
