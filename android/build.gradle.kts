// Root build script. Deliberately declares NO Android Gradle Plugin here —
// only plugins that `:core` (pure Kotlin/JVM) needs are applied (and only
// with apply false; each subproject applies what it actually uses). This
// keeps a `:core`-only build (see settings.gradle.kts) from ever needing to
// resolve the AGP or any Google Maven artifact.
plugins {
    alias(libs.plugins.kotlin.jvm) apply false
    alias(libs.plugins.kotlin.serialization) apply false
}
