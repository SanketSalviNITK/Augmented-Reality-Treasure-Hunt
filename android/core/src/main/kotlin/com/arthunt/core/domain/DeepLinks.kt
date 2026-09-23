package com.arthunt.core.domain

import java.net.URI
import java.net.URLDecoder

/**
 * Pure parsing for the two deep-link shapes M1 routes to the hunter screen:
 * - `arthunt://join/<id>` (native)
 * - `https://<web-host>/?event=<id>` (the web app's own share link, e.g.
 *   `https://augmented-reality-treasure-hunt.vercel.app/?event=<id>`)
 *
 * Kept in `:core` (no Android dependency needed) so it's unit-testable
 * without instrumentation; [com.arthunt.app.MainActivity] just calls
 * [parseEventId] on the incoming `Intent`'s data URI.
 */
object DeepLinks {
    fun parseEventId(uri: String): String? {
        val parsed = runCatching { URI(uri) }.getOrNull() ?: return null

        return when (parsed.scheme?.lowercase()) {
            "arthunt" -> parseArthuntScheme(parsed)
            "http", "https" -> parseWebQueryParam(parsed)
            else -> null
        }
    }

    private fun parseArthuntScheme(uri: URI): String? {
        // "arthunt://join/<id>" can parse with host="join" (opaque-ish authority)
        // or, depending on JVM URI quirks, with host=null and path="/join/<id>"
        // (or even opaque scheme-specific-part "join/<id>" with no "//"). Handle all three.
        val host = uri.host
        val path = uri.path
        if (host == "join") {
            return path?.trim('/')?.takeIf { it.isNotBlank() }?.substringBefore('/')
        }
        val segments = (path ?: uri.schemeSpecificPart ?: "")
            .trim('/')
            .split('/')
            .filter { it.isNotBlank() }
        return if (segments.size >= 2 && segments[0] == "join") segments[1] else null
    }

    private fun parseWebQueryParam(uri: URI): String? {
        val query = uri.rawQuery ?: return null
        for (pair in query.split('&')) {
            val idx = pair.indexOf('=')
            if (idx < 0) continue
            val key = pair.substring(0, idx)
            if (key != "event") continue
            val value = pair.substring(idx + 1)
            val decoded = runCatching { URLDecoder.decode(value, "UTF-8") }.getOrDefault(value)
            return decoded.takeIf { it.isNotBlank() }
        }
        return null
    }
}
