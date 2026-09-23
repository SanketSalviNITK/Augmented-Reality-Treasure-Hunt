// Root build script. All Gradle plugins are put on the ROOT buildscript
// classpath so they share one classloader: the Kotlin Android plugin must be
// able to see the Android Gradle Plugin's classes, and a plugin already on
// the classpath can't also be requested with a version by a subproject.
// Subprojects apply plugins by id only (no versions).
//
// The Android Gradle Plugin is added only when :app is part of the build, so
// a `-PcoreOnly` build (see settings.gradle.kts) never resolves anything from
// Google Maven. Keep these versions in sync with gradle/libs.versions.toml.
buildscript {
    val coreOnly = gradle.startParameter.projectProperties.containsKey("coreOnly")
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
    dependencies {
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.0.21")
        classpath("org.jetbrains.kotlin:kotlin-serialization:2.0.21")
        classpath("org.jetbrains.kotlin:compose-compiler-gradle-plugin:2.0.21")
        if (!coreOnly) {
            classpath("com.android.tools.build:gradle:8.7.3")
        }
    }
}
