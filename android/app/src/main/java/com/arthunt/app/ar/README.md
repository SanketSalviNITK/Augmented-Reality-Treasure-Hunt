# AR hunt (M1)

How the AR half of the hunter flow works, what to test it on, and how to print markers for a
manual test. See `docs/ANDROID_ARCHITECTURE.md` §5 for the design this implements, and
`ui/hunter/HuntUiState.kt` for the contract between this package and the hunt-logic ViewModel.

## How it works

1. **`MarkerImageLoader`** downloads each marker's `imageUrl` (or decodes a `data:` URL) to a
   `Bitmap`, cached in memory by URL.
2. Once every marker's bitmap is ready, `ui/ar/ArHuntScreen.kt` mounts SceneView's `ARScene`
   composable. In its `sessionConfiguration` callback (the first point an ARCore `Session`
   exists), **`AugmentedImageDbBuilder`** builds an `AugmentedImageDatabase` from those bitmaps
   (physical width `0.15m`) and installs it on the session `Config`. Each entry is named by the
   marker's 0-based index, so a tracked image maps straight back to a marker. Images ARCore
   rejects (`ImageInsufficientQualityException`, e.g. low-detail/blurry photos) are collected and
   shown to the hunter as "these markers might not track well".
3. Every frame, `onSessionUpdated` looks at `frame.getUpdatedAugmentedImages()`. For each image in
   full tracking, it calls `onMarkerDetected(markerIndex)` (debounced to once per 2s per marker --
   the ViewModel decides if it's correct, wrong, or already found) and creates an `AnchorNode` at
   the image's center pose the first time it's seen.
4. **`RewardFactory`** builds the reward node attached to that anchor: the bundled library glTF, an
   uploaded `.glb`/`.gltf` loaded over the network, a canvas-drawn text card, or a fallback chest
   with a one-line notice if loading fails. The node is only visible once the marker's number is
   in `state.detectedMarkerNumbers` (the ViewModel's confirmed detections) -- a wrong scan never
   shows a reward, matching the web app.
5. `ArHuntScreen` also handles the runtime camera permission, the ARCore availability/install
   check, the HUD (clue, hint, timer, leaderboard, stop), and a demo-mode panel that calls
   `onMarkerDetected` directly so the flow is testable without printed markers or an AR-capable
   device.

## Dependencies

`io.github.sceneview:arsceneview:2.2.1` (ARCore Augmented Images + glTF/Filament rendering,
Jetpack Compose). See the version-choice rationale in `gradle/libs.versions.toml` next to the
`sceneview` version, and the task report for the exact API signatures relied on.

## Testing on a device

- Needs a real **ARCore-supported** phone (`https://developers.google.com/ar/devices`) with
  Google Play Services for AR installed/up to date -- the emulator does not support ARCore's
  camera-based image tracking. On an unsupported phone the screen falls back to a friendly
  "AR isn't available" message; with **Demo mode** on, the simulate-scan panel still works there
  (and everywhere else) without any camera/AR at all.
- Build and install the debug APK from CI (`.github/workflows/android.yml`) or locally with
  Google Maven access: `./gradlew :app:assembleDebug`.
- Grant the camera permission when prompted.

## Printing test markers

Any of an event's marker images (`markers[].imageUrl` in `events.data`, see
`docs/ANDROID_ARCHITECTURE.md` §3) works as a physical marker:

1. Download the image and print it at roughly **15cm wide** (the physical width this app tells
   ARCore to expect -- `MARKER_PHYSICAL_WIDTH_METERS` in `AugmentedImageDbBuilder.kt`). A different
   printed size still tracks, just less precisely.
2. Use a well-lit, flat, non-glossy print -- ARCore's image tracking relies on visual feature
   detail, so a low-detail or blurry image is exactly what shows up in the "might not track well"
   notice.
3. Point the camera at the printed marker and hold it steady for a moment; the reward appears
   once ARCore reaches full tracking.

For a quick check without printing anything, create/open an event with **Demo mode** enabled and
use the "Simulate scan #n" buttons instead.
