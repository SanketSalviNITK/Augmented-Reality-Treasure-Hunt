package com.arthunt.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Same accents the web app uses (style.css :root), see docs/ANDROID_ARCHITECTURE.md §1.
val ArtBackground = Color(0xFF050508)
val ArtSurface = Color(0xFF0F0F16)
val ArtViolet = Color(0xFFA78BFA)
val ArtCyan = Color(0xFF06B6D4)
val ArtEmerald = Color(0xFF10B981)
val ArtTextSecondary = Color(0xFFB3B3C0)

private val ArtHuntDarkColors = darkColorScheme(
    primary = ArtViolet,
    onPrimary = Color(0xFF1A1330),
    secondary = ArtCyan,
    onSecondary = Color(0xFF00272E),
    tertiary = ArtEmerald,
    onTertiary = Color(0xFF00281B),
    background = ArtBackground,
    onBackground = Color(0xFFF2F2F7),
    surface = ArtSurface,
    onSurface = Color(0xFFF2F2F7),
    surfaceVariant = Color(0xFF1A1A24),
    onSurfaceVariant = ArtTextSecondary,
    error = Color(0xFFF87171),
)

/** ARTHunt's Material 3 theme -- dark only, matching the web app (it has no light mode either). */
@Composable
fun ArtHuntTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = ArtHuntDarkColors,
        typography = MaterialTheme.typography,
        content = content,
    )
}
