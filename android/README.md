# ARTHunt Android

Native Android app for the ARTHunt treasure hunt (Kotlin + Jetpack Compose +
ARCore), sharing the same Supabase backend as the web app in the repo root.
See [`../docs/ANDROID_ARCHITECTURE.md`](../docs/ANDROID_ARCHITECTURE.md) for
the full architecture and milestone plan -- this is milestone **M0**:
project scaffolding, the shared data models + game rules, repository
interfaces with Supabase and fake (in-memory/Demo mode) implementations, and
a portal screen with placeholder Creator/Hunter destinations.

## Modules

- **`:core`** -- pure Kotlin/JVM, no Android dependency. Shared-contract
  models (`model/`), game rules (`domain/`), repository interfaces (`repo/`),
  Supabase implementations (`supabase/`), in-memory fakes (`fake/`), and
  `config/AppConfig`. Builds and tests with only Maven Central, so it works
  even where Google Maven (`dl.google.com`) is unreachable.
- **`:app`** -- the Android application. Depends on `:core`; adds Compose UI,
  DataStore-backed config, and (from M1 onward) ARCore/CameraX.

## Build

### Android Studio

Open the `android/` folder as the project root.

### Command line

```sh
cd android
./gradlew assembleDebug      # needs Google Maven (dl.google.com) reachable
./gradlew installDebug       # build + install on a connected device/emulator
```

### `:core` only (no Google Maven needed)

If your network can't reach `dl.google.com`, `:core` still builds and tests
on Maven Central alone:

```sh
cd android
./gradlew -PcoreOnly :core:test
```

`-PcoreOnly` also makes `settings.gradle.kts` skip including `:app`
entirely, so nothing in the build ever tries to resolve an Android/Google
Maven artifact.

## Configuration

The app needs a Supabase project URL and anon key. In order of precedence:

1. **`BuildConfig`** (baked in at build time) -- set `SUPABASE_URL` and
   `SUPABASE_ANON_KEY` in `android/local.properties` (gitignored):
   ```properties
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   ```
   or pass them as Gradle properties (e.g. `-PSUPABASE_URL=... -PSUPABASE_ANON_KEY=...`,
   handy for CI). When either is set this way, it always wins over whatever
   is saved on-device.
2. **On-device setup screen** -- if no `BuildConfig` credentials are baked
   in, the app shows a setup screen on first launch to enter and save a
   URL/key (persisted in DataStore).

### Demo mode

From the same setup screen, **Try Demo Mode** skips Supabase entirely and
runs the app against in-memory fake repositories (`core/fake/`) -- useful
for trying the app, or for CI/manual testing, without a real backend. No
data persists between app launches in Demo mode.

## CI

[`.github/workflows/android.yml`](../.github/workflows/android.yml) runs on
every push touching `android/**`: `:core:test`, `:app:assembleDebug`,
`:app:lintDebug` (non-blocking), and uploads the debug APK as the
`arthunt-debug-apk` artifact. `:app` is built in CI (not locally in this
sandbox) because it needs Google Maven for AGP/AndroidX/ARCore artifacts --
see `docs/ANDROID_ARCHITECTURE.md` §8.
