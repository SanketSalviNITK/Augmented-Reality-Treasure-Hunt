# ARTHunt Android — Architecture & Build Plan

A standalone native Android app (Kotlin + ARCore) for the ARTHunt treasure hunt,
covering both roles (**Creator** and **Hunter**) and sharing the **same Supabase
backend** as the web app. Web and Android hunters can join the same hunt; all
research data lands in the same tables.

This document is the single source of truth for the Android codebase. Anything
that touches shared data MUST stay byte-compatible with the web app (see
"Shared data contract").

---

## 1. Decisions

| Area | Choice | Why |
|---|---|---|
| Language | Kotlin 2.x | Standard for modern Android |
| UI | Jetpack Compose + Material 3, Navigation Compose | Declarative, one Activity |
| Architecture | MVVM: `ViewModel` + `StateFlow`; repository interfaces | Testable, simple |
| DI | Manual `AppContainer` (no Hilt) | Fewer moving parts |
| Backend | `supabase-kt` (postgrest-kt, storage-kt) + Ktor Android engine | Official community Kotlin client |
| Serialization | kotlinx.serialization (`ignoreUnknownKeys = true`, `explicitNulls = false`) | Tolerates web-only fields |
| AR | ARCore **Augmented Images** + SceneView (`io.github.sceneview:arsceneview`) | Native image tracking + glTF rendering |
| 3D formats | glTF/GLB only (Filament) | Web-only formats fall back (see §5) |
| Camera (creator capture) | CameraX | Marker photos |
| Offline | Room outbox + WorkManager sync (milestone M3) | Hunts are outdoors |
| Min / target SDK | minSdk 24, target/compile SDK 35 | ARCore requires 24+ |
| AR requirement | `ar_optional` in manifest; AR screens check `ArCoreApk.checkAvailability` | App still installs on non-AR phones (creator features work) |
| Package | `com.arthunt.app` | |

## 2. Repository layout

```
android/                      ← Gradle root (settings.gradle.kts, gradle/libs.versions.toml, gradlew)
  core/                       ← PURE Kotlin/JVM module — no Android or Google-Maven deps
    src/main/kotlin/com/arthunt/core/
      model/                  ← @Serializable shared-contract classes (§3)
      domain/                 ← game rules (§4)
      repo/                   ← EventRepository, TelemetryRepository, StorageRepository, FeedbackRepository (interfaces)
      supabase/               ← Supabase implementations (supabase-kt, Ktor)
      fake/                   ← in-memory implementations (tests + "demo mode")
      config/                 ← AppConfig
    src/test/kotlin/          ← unit tests: contract round-trip fixtures, rules, fakes
  app/                        ← Android application (depends on :core)
    src/main/java/com/arthunt/app/
      ArthuntApp.kt           ← Application, builds AppContainer
      MainActivity.kt         ← single Activity, Compose NavHost, deep-link intake
      di/AppContainer.kt
      ui/                     ← screens by feature: setup/, portal/, hunter/, creator/, ar/, common/
      ar/                     ← ARCore/SceneView integration
      sensing/                ← WiFi RSSI, battery, network, location samplers (M3)
    src/main/assets/models/   ← bundled GLB exports of the 11 library assets
.github/workflows/android.yml ← CI: :core tests, assembleDebug, app unit tests, lint, uploads APK
```

The Android project lives in the same repository as the web app so the schema,
library assets, and docs stay in one place.

**Why `:core` is separate:** it depends only on Maven Central (Kotlin,
kotlinx.serialization, supabase-kt, Ktor), so it compiles and tests anywhere —
including environments without Google Maven access — with
`./gradlew -PcoreOnly :core:test`. `settings.gradle.kts` includes `:app` only
when `coreOnly` is not set, and the Android Gradle Plugin is declared only in
`app/build.gradle.kts`, so a core-only build never resolves Google artifacts.

## 3. Shared data contract (must match the web app exactly)

Supabase tables (see `/schema.sql`):

- `events(id uuid, data jsonb, created_at)` — one row per hunt; everything in `data`.
- `telemetry(id bigint, event_id uuid, participant text, kind text, marker int, ts timestamptz, data jsonb)` — append-only.
- `feedback(id uuid, data jsonb, created_at)` — `data` = `{ immersion, usability, engagement, stability }`, each an int 1–5.
- Storage bucket `ar-assets`, folders: `markers/`, `models/`, `live-photos/`, `floorplans/`, `compiled/`. Files get a random name and are referenced by public URL.

`events.data` shape (all fields optional when reading — old events may lack any of them):

```jsonc
{
  "name": "Campus Hunt",
  "status": "active",                 // "active" | "inactive"; missing = active
  "timeLimit": 0,                     // minutes, 0 = unlimited
  "theme": "standard",                // "standard" | "cyberpunk" | "minimalist"
  "markers": [{
    "type": "model",                  // "model" | "text"
    "scale": 0.5,
    "color": "#a78bfa",               // text-card colour
    "text": "…",                      // text-card message
    "hint": "…",                      // riddle shown before this marker
    "imageUrl": "https://…/markers/x.jpg",
    "modelUrl": "library:chest",      // "library:<id>" OR public URL of an uploaded model
    "modelFileName": "Treasure Chest (built-in)",
    "pos": { "x": 0.25, "y": 0.75 }   // optional normalized floor-plan position
  }],
  "settings": {
    "silentDashcam": true, "mandatoryConsent": true, "anonymizeHunters": false,
    "randomizedPathing": true, "telemetryFrequency": 1000
  },
  "floorPlanUrl": "https://…",        // optional
  "compiledMindUrl": "https://…",     // WEB-ONLY (MindAR); Android ignores it
  "players": [{
    "name": "Alice", "age": "30",     // age is a STRING in existing data
    "detectedMarkers": [1, 3],        // 1-based marker numbers, in scan order
    "customPath": [0, 2, 1],          // 0-based marker indices = required scan order
    "startTime": 1760000000000, "endTime": 1760000900000,   // epoch ms
    "avatarId": 17,                   // 1–50 → assets/avatar-<n>.svg
    "hintsUsed": 1,
    "capturedPhotos": [{ "marker": 1, "imageUrl": "https://…", "timestamp": 1760000100000, "type": "dashcam" }] // or "selfie"
  }]
}
```

Rules: unknown fields must survive a read-modify-write round trip (keep a raw
`JsonObject` alongside the typed model, or merge updates into the raw object) so
Android never deletes data that the web app wrote.

Telemetry `kind` values: `join`, `scan`, `wrong_scan`, `hint`, `complete`,
`net_sample` (web), plus Android-only `wifi_scan` (M3; `data` =
`{ aps: [{ bssidHash, rssi, freq }], found }`, BSSID hashed with SHA-256 — never
store raw BSSIDs).

## 4. Game rules (port 1:1 from the web app into `domain/`)

- **Path generation** on first join: `randomizedPathing == false` → `[0, 1, …, n-1]`;
  otherwise `[0] + FisherYatesShuffle([1, …, n-1])` (marker 0 is always first).
- **Expected next marker** = `customPath[detectedMarkers.size]` (fallback: `detectedMarkers.size`).
- **On detecting marker index `i`** (number `i+1`):
  already in `detectedMarkers` → just show it; `i != expected` → wrong scan
  (hide content, log `wrong_scan`, show "re-read your clue"); otherwise append
  `i+1`, log `scan`, and if all found set `endTime` once and log `complete`.
- **Score** = `100 × found − 50 × hintsUsed`. Leaderboard order: score desc, then `startTime` asc.
- **Hint** ("Give up?", −50): reveals the current target's marker image; `hintsUsed += 1`, log `hint`.
- **Timer**: if `timeLimit > 0`, remaining = `timeLimit·60000 − (now − startTime)`; at 0 → end hunt, set `endTime`.
- **Anonymized display name** (when `anonymizeHunters`): `Hunter_<avatarId>`.
- **Join order**: identity (name + age) → consent (if `mandatoryConsent != false`) → only THEN create/update the player record. Event `settings` override local defaults.
- **Admin access**: same code as web (`ARTHunt321`) for compatibility — known weakness, to be replaced by Supabase Auth on both platforms together.

## 5. AR & 3D

- Build an `AugmentedImageDatabase` at runtime from the event's marker images
  (downloaded bitmaps; physical width 0.15 m default). Images that ARCore rejects
  for low feature quality are reported to the user by marker number.
- Creator-side: when a marker photo is captured, run the same quality check
  (`AugmentedImageDatabase.addImage` throws on unusable images) so creators get
  instant "this marker won't track" feedback.
- Rewards: `library:<id>` → bundled `assets/models/<id>.glb` (exported once from the
  web's procedural builders); uploaded `.glb/.gltf` URL → loaded directly; any
  other uploaded format → fallback to the `chest` model with a one-line notice;
  `text` markers → a rounded card plane (bitmap texture) in the marker's colour.
  Library models idle-spin like on the web.

## 6. Configuration

`SUPABASE_URL` / `SUPABASE_ANON_KEY` come from `local.properties` or Gradle
properties → `BuildConfig`. If blank, the app shows a setup screen (like the
web's) that saves them to DataStore, and offers **Demo mode** (fake in-memory
repositories) so the app is fully usable without a backend.

## 7. Milestones

| # | Scope | Verified by |
|---|---|---|
| **M0** | Gradle project, CI workflow, shared-contract models, repository interfaces + Supabase & fake implementations, `domain/` game rules, config/setup + demo mode, portal screen | CI green: build + unit tests (contract round-trip fixtures, rules) |
| **M1 Hunter** | Browse hunts, deep links (`arthunt://join/<id>` + `https://<web-host>/?event=<id>`), identity + consent gates, ARCore Augmented Images session, rewards, HUD (clue, progress, hint, timer, leaderboard), telemetry, post-hunt leaderboard + questionnaire | CI + manual test on an ARCore phone |
| **M2 Creator** | Admin gate, dashboard (events, archive, reset, delete, share link + QR), create wizard (CameraX capture/crop, quality check, asset library, model upload, riddles, floor-plan pinning), save/upload, live monitor | CI + manual test |
| **M3 Native research** | WiFi RSSI scanning (`wifi_scan`), network/battery/location sampling, dashcam capture, Room outbox + WorkManager offline sync, power saver | CI + manual test |
| **M4 Release** | Release signing, App Links (`assetlinks.json` on the web host), icon/splash, Play Store listing checklist | CI release build |

## 8. Build & verification environment

- The Claude cloud sandbox currently cannot reach `dl.google.com` (Google Maven),
  so `:app` builds run in **GitHub Actions** (`.github/workflows/android.yml`),
  which also uploads the debug APK as a downloadable artifact. `:core` builds and
  tests locally (`./gradlew -PcoreOnly :core:test`).
- AR tracking cannot run in CI; each milestone ends with a manual test on a real
  ARCore-supported phone using that APK.
