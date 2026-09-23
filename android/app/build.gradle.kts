import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

// SUPABASE_URL / SUPABASE_ANON_KEY -> BuildConfig, read from local.properties
// first (gitignored, for local dev), then from Gradle/CI properties. Blank by
// default: the app falls back to its setup screen / Demo mode (see
// docs/ANDROID_ARCHITECTURE.md §6).
val localProperties = Properties().apply {
    val f = rootProject.file("local.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

fun configString(key: String): String =
    localProperties.getProperty(key) ?: providers.gradleProperty(key).getOrElse("")

android {
    namespace = "com.arthunt.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.arthunt.app"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0-m0"

        buildConfigField("String", "SUPABASE_URL", "\"${configString("SUPABASE_URL")}\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"${configString("SUPABASE_ANON_KEY")}\"")

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation(project(":core"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.datastore.preferences)

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    debugImplementation(libs.compose.ui.tooling)

    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.android)

    implementation(platform(libs.supabase.bom))
    implementation(libs.supabase.postgrest)
    implementation(libs.supabase.storage)
    implementation(libs.ktor.client.okhttp)

    // Declared per docs/ANDROID_ARCHITECTURE.md §1/§6 for the AR milestones
    // (M1+); unused by M0's screens.
    implementation(libs.arcore)

    testImplementation(kotlin("test"))
    androidTestImplementation(libs.androidx.core.ktx)
}
