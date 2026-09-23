package com.arthunt.core.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class DeepLinksTest {
    @Test
    fun `parses the native arthunt join scheme`() {
        assertEquals("abc-123", DeepLinks.parseEventId("arthunt://join/abc-123"))
    }

    @Test
    fun `parses the web share link query param`() {
        assertEquals(
            "abc-123",
            DeepLinks.parseEventId("https://augmented-reality-treasure-hunt.vercel.app/?event=abc-123")
        )
    }

    @Test
    fun `parses the web link with extra query params around event`() {
        assertEquals("xyz", DeepLinks.parseEventId("https://augmented-reality-treasure-hunt.vercel.app/?utm_source=qr&event=xyz&foo=bar"))
    }

    @Test
    fun `parses a percent-encoded event id`() {
        assertEquals("a b", DeepLinks.parseEventId("https://example.com/?event=a%20b"))
    }

    @Test
    fun `returns null for unrelated schemes or hosts`() {
        assertNull(DeepLinks.parseEventId("https://example.com/"))
        assertNull(DeepLinks.parseEventId("mailto:someone@example.com"))
        assertNull(DeepLinks.parseEventId("not a uri at all"))
    }

    @Test
    fun `returns null when arthunt scheme is missing the join segment`() {
        assertNull(DeepLinks.parseEventId("arthunt://portal"))
    }

    @Test
    fun `returns null for blank event id`() {
        assertNull(DeepLinks.parseEventId("https://example.com/?event="))
    }
}
