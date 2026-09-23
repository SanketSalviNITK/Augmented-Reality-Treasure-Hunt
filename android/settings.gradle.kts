pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "arthunt-android"

// `:core` is pure Kotlin/JVM and only ever needs Maven Central, so it builds
// and tests even where Google Maven (dl.google.com) is unreachable:
//   ./gradlew -PcoreOnly :core:test
// `:app` (the Android application, needs the AGP + Google Maven artifacts)
// is included unless that property is set. CI builds both; local sandboxes
// without Google Maven access pass -PcoreOnly.
include(":core")

if (!providers.gradleProperty("coreOnly").isPresent) {
    include(":app")
}
