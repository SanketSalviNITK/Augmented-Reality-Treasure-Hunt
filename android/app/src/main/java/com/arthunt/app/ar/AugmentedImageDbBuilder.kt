package com.arthunt.app.ar

import android.graphics.Bitmap
import com.google.ar.core.AugmentedImageDatabase
import com.google.ar.core.Session
import com.google.ar.core.exceptions.ImageInsufficientQualityException

/** Physical size we tell ARCore to expect printed/displayed markers at (see docs §5). */
const val MARKER_PHYSICAL_WIDTH_METERS = 0.15f

data class AugmentedImageDbResult(
    val database: AugmentedImageDatabase,
    /** 1-based marker numbers ARCore couldn't track: missing image, low feature quality, or a
     *  bad width/format. The AR screen shows these to the hunter so they know not to rely on them. */
    val rejectedMarkerNumbers: List<Int>,
)

/**
 * Builds an [AugmentedImageDatabase] from the event's already-downloaded marker bitmaps.
 *
 * Each image is added under the name `"<markerIndex>"` (its 0-based [markers] index) rather than
 * relying on the database's insertion order, so a tracked [com.google.ar.core.AugmentedImage] can
 * always be mapped straight back to a marker even though some markers are skipped (missing image,
 * or ARCore rejects it) and therefore never make it into the database.
 *
 * Must be called with an already-created ARCore [Session] (an [AugmentedImageDatabase] needs one),
 * so this runs from `ARScene`'s `sessionConfiguration` callback -- by then [bitmaps] must already
 * be downloaded (this function itself does no network I/O and isn't suspending).
 */
object AugmentedImageDbBuilder {

    fun build(
        session: Session,
        markerCount: Int,
        bitmaps: Map<Int, Bitmap>,
    ): AugmentedImageDbResult {
        val database = AugmentedImageDatabase(session)
        val rejected = mutableListOf<Int>()
        for (index in 0 until markerCount) {
            val bitmap = bitmaps[index]
            if (bitmap == null) {
                rejected += index + 1
                continue
            }
            val rejectedNumber = addImage(database, index, bitmap)
            if (rejectedNumber != null) rejected += rejectedNumber
        }
        return AugmentedImageDbResult(database, rejected)
    }

    /** Returns the 1-based marker number if ARCore rejected the image, null on success. */
    private fun addImage(database: AugmentedImageDatabase, markerIndex: Int, bitmap: Bitmap): Int? {
        // ARCore only accepts ARGB_8888 bitmaps; a downloaded JPEG/PNG can decode to other configs.
        val argb = if (bitmap.config == Bitmap.Config.ARGB_8888) {
            bitmap
        } else {
            bitmap.copy(Bitmap.Config.ARGB_8888, false) ?: return markerIndex + 1
        }
        return try {
            database.addImage(markerIndex.toString(), argb, MARKER_PHYSICAL_WIDTH_METERS)
            null
        } catch (e: ImageInsufficientQualityException) {
            markerIndex + 1
        } catch (e: IllegalArgumentException) {
            // ARCore also throws this for a malformed bitmap / non-positive width.
            markerIndex + 1
        }
    }
}
