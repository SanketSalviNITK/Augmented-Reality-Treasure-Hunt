package com.arthunt.app.ar

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ConcurrentHashMap

/**
 * Downloads marker images to [Bitmap]s off the main thread, with a simple in-memory cache keyed
 * by URL so the same marker image is only fetched/decoded once per process.
 *
 * Used both to build the ARCore [com.google.ar.core.AugmentedImageDatabase]
 * ([AugmentedImageDbBuilder]) and to show the hint image in the HUD
 * (`ui/ar/ArHuntScreen.kt`).
 *
 * Supports plain `http(s)://` URLs (Supabase storage's public marker URLs) and `data:` URLs
 * (base64-encoded images some demo/local events may carry, matching the web app).
 */
object MarkerImageLoader {
    private val cache = ConcurrentHashMap<String, Bitmap>()

    /** Returns null if the URL is blank, unreachable, or not decodable as an image; never throws. */
    suspend fun load(url: String?): Bitmap? {
        if (url.isNullOrBlank()) return null
        cache[url]?.let { return it }
        return withContext(Dispatchers.IO) {
            runCatching { decode(url) }.getOrNull()?.also { cache[url] = it }
        }
    }

    private fun decode(url: String): Bitmap? =
        if (url.startsWith("data:")) decodeDataUrl(url) else decodeRemote(url)

    private fun decodeDataUrl(url: String): Bitmap? {
        val marker = ";base64,"
        val markerIndex = url.indexOf(marker)
        if (markerIndex == -1) return null
        val bytes = Base64.decode(url.substring(markerIndex + marker.length), Base64.DEFAULT)
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
    }

    private fun decodeRemote(url: String): Bitmap? {
        val connection = URL(url).openConnection() as HttpURLConnection
        return try {
            connection.connectTimeout = 15_000
            connection.readTimeout = 15_000
            connection.doInput = true
            connection.connect()
            if (connection.responseCode !in 200..299) return null
            connection.inputStream.use { input ->
                val bytes = input.readBytes()
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            }
        } finally {
            connection.disconnect()
        }
    }

    /** Clears the in-memory cache, e.g. when leaving a hunt to free the decoded bitmaps. */
    fun clear() {
        cache.clear()
    }
}
