package com.arthunt.app.ui.ar

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.SystemClock
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.weight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.arthunt.app.ar.AugmentedImageDbBuilder
import com.arthunt.app.ar.MarkerImageLoader
import com.arthunt.app.ar.RewardFactory
import com.arthunt.app.ui.hunter.HuntFeedback
import com.arthunt.app.ui.hunter.HuntUiState
import com.arthunt.app.ui.hunter.LeaderboardEntry
import com.google.ar.core.ArCoreApk
import com.google.ar.core.Config
import com.google.ar.core.exceptions.UnavailableException
import io.github.sceneview.ar.ARScene
import io.github.sceneview.ar.arcore.getUpdatedAugmentedImages
import io.github.sceneview.ar.arcore.isTracking
import io.github.sceneview.ar.node.AnchorNode
import io.github.sceneview.node.Node
import io.github.sceneview.rememberEngine
import io.github.sceneview.rememberMaterialLoader
import io.github.sceneview.rememberModelLoader
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

// How long a marker has to stay in full tracking before we call onMarkerDetected again for it.
// The ViewModel is idempotent about repeat detections, but this keeps us from spamming it 60x/sec.
private const val DETECTION_DEBOUNCE_MILLIS = 2_000L
private const val TIMER_WARNING_MILLIS = 60_000L
private const val FEEDBACK_BANNER_MILLIS = 2_200L

/**
 * The AR half of the hunter flow (M1, see docs/ANDROID_ARCHITECTURE.md §5 and the contract in
 * `ui/hunter/HuntUiState.kt`). Renders [state] and reports raw marker detections; the ViewModel
 * that owns [state] decides whether a detection is correct, wrong, or already found.
 */
@Composable
fun ArHuntScreen(
    state: HuntUiState,
    onMarkerDetected: (markerIndex: Int) -> Unit,
    onUseHint: () -> Unit,
    onStopHunt: () -> Unit,
    onFeedbackShown: (feedbackId: Long) -> Unit,
) {
    val context = LocalContext.current

    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.CAMERA,
            ) == PackageManager.PERMISSION_GRANTED,
        )
    }
    var cameraPermissionDenied by remember { mutableStateOf(false) }
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        hasCameraPermission = granted
        if (!granted) cameraPermissionDenied = true
    }

    val arSupport = rememberArSupportState()

    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        when {
            !hasCameraPermission -> CameraPermissionGate(
                denied = cameraPermissionDenied,
                onRequest = { permissionLauncher.launch(Manifest.permission.CAMERA) },
                state = state,
                onMarkerDetected = onMarkerDetected,
            )

            arSupport == ArSupport.CHECKING -> LoadingOverlay("Checking AR support…")

            arSupport == ArSupport.UNSUPPORTED -> ArUnsupportedGate(
                state = state,
                onMarkerDetected = onMarkerDetected,
            )

            else -> ArHuntSceneContent(
                state = state,
                onMarkerDetected = onMarkerDetected,
                onUseHint = onUseHint,
                onStopHunt = onStopHunt,
                onFeedbackShown = onFeedbackShown,
            )
        }
    }
}

// ---------------------------------------------------------------------------------------------
// ARCore availability + install flow
// ---------------------------------------------------------------------------------------------

private enum class ArSupport { CHECKING, SUPPORTED, UNSUPPORTED }

/**
 * Checks [ArCoreApk.checkAvailability] (polling while it's still doing its own async check),
 * requests an ARCore install/update when needed, and re-checks on every `ON_RESUME` -- covers
 * both "just installed ARCore from the Play Store prompt" and "the device turned out not to
 * support it at all".
 */
@Composable
private fun rememberArSupportState(): ArSupport {
    val context = LocalContext.current
    val activity = context as? Activity
    val lifecycleOwner = LocalLifecycleOwner.current

    var support by remember { mutableStateOf(ArSupport.CHECKING) }
    var installRequested by remember { mutableStateOf(false) }
    var resumeTrigger by remember { mutableStateOf(0) }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) resumeTrigger++
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    LaunchedEffect(resumeTrigger) {
        if (support == ArSupport.SUPPORTED) return@LaunchedEffect
        while (true) {
            val availability = ArCoreApk.getInstance().checkAvailability(context)
            if (availability.isTransient) {
                delay(200)
                continue
            }
            support = when {
                !availability.isSupported -> ArSupport.UNSUPPORTED
                availability == ArCoreApk.Availability.SUPPORTED_INSTALLED -> ArSupport.SUPPORTED
                activity == null -> ArSupport.UNSUPPORTED
                else -> {
                    // SUPPORTED_NOT_INSTALLED / SUPPORTED_APK_TOO_OLD: ask Play Store to
                    // install/update it. INSTALL_REQUESTED launches Play Store and pauses us;
                    // the ON_RESUME observer above re-runs this effect when we come back.
                    try {
                        val status = ArCoreApk.getInstance()
                            .requestInstall(activity, !installRequested)
                        installRequested = true
                        if (status == ArCoreApk.InstallStatus.INSTALLED) {
                            ArSupport.SUPPORTED
                        } else {
                            ArSupport.CHECKING
                        }
                    } catch (e: UnavailableException) {
                        ArSupport.UNSUPPORTED
                    }
                }
            }
            return@LaunchedEffect
        }
    }

    return support
}

// ---------------------------------------------------------------------------------------------
// Gate screens (permission / AR unsupported) -- demo mode still gets its simulate controls here
// ---------------------------------------------------------------------------------------------

@Composable
private fun CameraPermissionGate(
    denied: Boolean,
    onRequest: () -> Unit,
    state: HuntUiState,
    onMarkerDetected: (Int) -> Unit,
) {
    val context = LocalContext.current
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp)
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            "Camera access needed",
            style = MaterialTheme.typography.headlineSmall,
            color = Color.White,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            if (denied) {
                "Camera permission was denied. ARTHunt needs it to scan markers in AR -- " +
                    "open Settings to grant it."
            } else {
                "ARTHunt uses the camera to find and scan treasure markers in AR."
            },
            style = MaterialTheme.typography.bodyMedium,
            color = Color.White.copy(alpha = 0.8f),
        )
        Spacer(Modifier.height(16.dp))
        if (denied) {
            Button(onClick = {
                context.startActivity(
                    Intent(
                        Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.fromParts("package", context.packageName, null),
                    ),
                )
            }) { Text("Open Settings") }
        } else {
            Button(onClick = onRequest) { Text("Grant camera access") }
        }
        if (state.demoMode) {
            Spacer(Modifier.height(24.dp))
            DemoSimulatePanel(state = state, onMarkerDetected = onMarkerDetected)
        }
    }
}

@Composable
private fun ArUnsupportedGate(
    state: HuntUiState,
    onMarkerDetected: (Int) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp)
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            "AR isn't available on this device",
            style = MaterialTheme.typography.headlineSmall,
            color = Color.White,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            "This phone doesn't support ARCore, so markers can't be scanned in AR here.",
            style = MaterialTheme.typography.bodyMedium,
            color = Color.White.copy(alpha = 0.8f),
        )
        if (state.demoMode) {
            Spacer(Modifier.height(24.dp))
            Text(
                "Demo mode is on, so you can still try the hunt below.",
                style = MaterialTheme.typography.bodySmall,
                color = Color.White.copy(alpha = 0.6f),
            )
            Spacer(Modifier.height(12.dp))
            DemoSimulatePanel(state = state, onMarkerDetected = onMarkerDetected)
        }
    }
}

@Composable
private fun LoadingOverlay(message: String) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        CircularProgressIndicator(color = Color.White)
        Spacer(Modifier.height(12.dp))
        Text(message, color = Color.White)
    }
}

@Composable
private fun DemoSimulatePanel(state: HuntUiState, onMarkerDetected: (Int) -> Unit) {
    var expanded by remember { mutableStateOf(true) }
    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF1A1A24))) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "Demo mode -- simulate scans",
                    style = MaterialTheme.typography.titleSmall,
                    color = Color.White,
                )
                TextButton(onClick = { expanded = !expanded }) {
                    Text(if (expanded) "Hide" else "Show", color = Color.White)
                }
            }
            if (expanded) {
                Spacer(Modifier.height(8.dp))
                state.markers.forEachIndexed { index, _ ->
                    OutlinedButton(
                        onClick = { onMarkerDetected(index) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                    ) {
                        Text("Simulate scan #${index + 1}")
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------------------------
// The real AR scene + HUD
// ---------------------------------------------------------------------------------------------

@Composable
private fun ArHuntSceneContent(
    state: HuntUiState,
    onMarkerDetected: (Int) -> Unit,
    onUseHint: () -> Unit,
    onStopHunt: () -> Unit,
    onFeedbackShown: (Long) -> Unit,
) {
    val engine = rememberEngine()
    val modelLoader = rememberModelLoader(engine)
    val materialLoader = rememberMaterialLoader(engine)
    // Top-level scene nodes (one AnchorNode per detected marker). rememberEngine/ModelLoader/
    // MaterialLoader and ARScene's own AndroidView already tear down all GL/Filament resources
    // (engine, loaders, the ARCore session) when this composable leaves composition -- that's
    // the AR session cleanup this screen needs; we just drop our own references below.
    val sceneChildNodes = remember { mutableStateListOf<Node>() }
    val coroutineScope = rememberCoroutineScope()

    // Marker images must be downloaded *before* the session configures its AugmentedImageDatabase
    // (building the database needs an already-created ARCore Session, so it happens synchronously
    // inside ARScene's sessionConfiguration callback -- see below).
    val markerBitmaps by produceState<Map<Int, Bitmap>?>(initialValue = null, state.markers) {
        value = state.markers
            .mapIndexed { index, marker -> index to marker.imageUrl }
            .map { (index, url) -> async { index to MarkerImageLoader.load(url) } }
            .awaitAll()
            .mapNotNull { (index, bitmap) -> bitmap?.let { index to it } }
            .toMap()
    }

    var rejectedMarkerNumbers by remember { mutableStateOf<List<Int>>(emptyList()) }
    var rewardNotices by remember { mutableStateOf<List<String>>(emptyList()) }
    var sessionErrorMessage by remember { mutableStateOf<String?>(null) }

    val anchorsByMarker = remember { mutableStateMapOf<Int, AnchorNode>() }
    // Plain (non-Compose-state) bookkeeping: only ever touched from the per-frame AR callback.
    val rewardStarted = remember { HashMap<Int, Boolean>() }
    val lastDetectedAtMs = remember { HashMap<Int, Long>() }

    // Show/hide each marker's reward as the ViewModel confirms (or un-confirms) detections.
    LaunchedEffect(state.detectedMarkerNumbers) {
        anchorsByMarker.forEach { (index, anchorNode) ->
            val visible = (index + 1) in state.detectedMarkerNumbers
            anchorNode.childNodes.forEach { it.isVisible = visible }
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            anchorsByMarker.clear()
            MarkerImageLoader.clear()
        }
    }

    val bitmaps = markerBitmaps
    Box(modifier = Modifier.fillMaxSize()) {
        if (bitmaps == null) {
            LoadingOverlay("Loading markers…")
        } else {
            ARScene(
                modifier = Modifier.fillMaxSize(),
                engine = engine,
                modelLoader = modelLoader,
                materialLoader = materialLoader,
                childNodes = sceneChildNodes,
                planeRenderer = false,
                sessionConfiguration = { session, config ->
                    // Autofocus is enabled automatically once the session resumes (SceneView
                    // does this itself); we only need to wire up image tracking here.
                    config.planeFindingMode = Config.PlaneFindingMode.DISABLED
                    val result = AugmentedImageDbBuilder.build(session, state.markers.size, bitmaps)
                    config.augmentedImageDatabase = result.database
                    rejectedMarkerNumbers = result.rejectedMarkerNumbers
                },
                onSessionFailed = { exception ->
                    sessionErrorMessage = exception.message ?: exception.javaClass.simpleName
                },
                onSessionUpdated = { _, frame ->
                    val now = SystemClock.elapsedRealtime()
                    for (image in frame.getUpdatedAugmentedImages()) {
                        val markerIndex = image.name.toIntOrNull() ?: continue
                        if (!image.isTracking) continue

                        val lastDetectedAt = lastDetectedAtMs[markerIndex] ?: 0L
                        if (now - lastDetectedAt >= DETECTION_DEBOUNCE_MILLIS) {
                            lastDetectedAtMs[markerIndex] = now
                            onMarkerDetected(markerIndex)
                        }

                        if (anchorsByMarker[markerIndex] == null) {
                            val anchor = image.createAnchor(image.centerPose)
                            val anchorNode = AnchorNode(engine = engine, anchor = anchor)
                            anchorsByMarker[markerIndex] = anchorNode
                            sceneChildNodes.add(anchorNode)

                            if (rewardStarted[markerIndex] != true) {
                                rewardStarted[markerIndex] = true
                                val marker = state.markers.getOrNull(markerIndex)
                                if (marker != null) {
                                    coroutineScope.launch {
                                        val reward = RewardFactory.create(
                                            marker = marker,
                                            engine = engine,
                                            modelLoader = modelLoader,
                                            materialLoader = materialLoader,
                                        )
                                        anchorNode.addChildNode(reward.node)
                                        reward.node.isVisible =
                                            (markerIndex + 1) in state.detectedMarkerNumbers
                                        reward.notice?.let { notice ->
                                            if (notice !in rewardNotices) {
                                                rewardNotices = rewardNotices + notice
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
            )
        }

        ArHuntHud(
            state = state,
            rejectedMarkerNumbers = rejectedMarkerNumbers,
            notices = rewardNotices,
            sessionErrorMessage = sessionErrorMessage,
            onUseHint = onUseHint,
            onStopHunt = onStopHunt,
            onFeedbackShown = onFeedbackShown,
            onMarkerDetected = onMarkerDetected,
        )
    }
}

// ---------------------------------------------------------------------------------------------
// HUD overlay
// ---------------------------------------------------------------------------------------------

@Composable
private fun ArHuntHud(
    state: HuntUiState,
    rejectedMarkerNumbers: List<Int>,
    notices: List<String>,
    sessionErrorMessage: String?,
    onUseHint: () -> Unit,
    onStopHunt: () -> Unit,
    onFeedbackShown: (Long) -> Unit,
    onMarkerDetected: (Int) -> Unit,
) {
    var showLeaderboard by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.Black.copy(alpha = 0.55f))
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                Text(state.eventName, style = MaterialTheme.typography.titleMedium, color = Color.White)
                Text(
                    "${state.foundCount}/${state.totalCount} found",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.White.copy(alpha = 0.8f),
                )
            }
            state.remainingMillis?.let { TimerBadge(it) }
            TextButton(onClick = onStopHunt) { Text("Stop", color = Color.White) }
        }

        Spacer(Modifier.weight(1f))

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
        ) {
            if (sessionErrorMessage != null) {
                NoticeCard("AR error: $sessionErrorMessage", isError = true)
                Spacer(Modifier.height(8.dp))
            }
            if (rejectedMarkerNumbers.isNotEmpty()) {
                NoticeCard(
                    "These markers might not track well: " +
                        rejectedMarkerNumbers.sorted().joinToString(", ") { "#$it" },
                )
                Spacer(Modifier.height(8.dp))
            }
            notices.forEach { notice ->
                NoticeCard(notice)
                Spacer(Modifier.height(8.dp))
            }

            if (!state.isComplete) {
                ClueCard(state = state, onUseHint = onUseHint)
            } else {
                NoticeCard("Hunt complete! Check the leaderboard below.")
            }
            Spacer(Modifier.height(12.dp))

            TextButton(onClick = { showLeaderboard = !showLeaderboard }) {
                Text(if (showLeaderboard) "Hide leaderboard" else "Leaderboard", color = Color.White)
            }
            if (showLeaderboard) {
                Spacer(Modifier.height(8.dp))
                LeaderboardPanel(state.leaderboard)
            }

            if (state.demoMode) {
                Spacer(Modifier.height(12.dp))
                DemoSimulatePanel(state = state, onMarkerDetected = onMarkerDetected)
            }
        }
    }

    state.feedback?.let { feedback ->
        FeedbackBanner(feedback = feedback, onDismissed = { onFeedbackShown(feedback.id) })
    }
}

@Composable
private fun TimerBadge(remainingMillis: Long) {
    val isLow = remainingMillis <= TIMER_WARNING_MILLIS
    Text(
        formatMillis(remainingMillis),
        style = MaterialTheme.typography.titleMedium,
        color = if (isLow) Color(0xFFF87171) else Color.White,
    )
}

@Composable
private fun ClueCard(state: HuntUiState, onUseHint: () -> Unit) {
    val hintBitmap by produceState<Bitmap?>(initialValue = null, state.hintImageUrl) {
        value = MarkerImageLoader.load(state.hintImageUrl)
    }

    Card(colors = CardDefaults.cardColors(containerColor = Color(0xF01A1A24))) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                "Marker ${state.clueNumber} of ${state.totalCount}",
                style = MaterialTheme.typography.titleSmall,
                color = Color.White,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                state.clueText ?: "Search for the hidden marker!",
                style = MaterialTheme.typography.bodyMedium,
                color = Color.White.copy(alpha = 0.85f),
            )
            hintBitmap?.let { bitmap ->
                Spacer(Modifier.height(12.dp))
                Image(
                    bitmap = bitmap.asImageBitmap(),
                    contentDescription = "What this marker looks like",
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(140.dp),
                )
            }
            Spacer(Modifier.height(12.dp))
            OutlinedButton(onClick = onUseHint) {
                // U+2212 minus sign, matching the web app's hint button label.
                Text("Give up? (−50 pts)")
            }
        }
    }
}

@Composable
private fun LeaderboardPanel(entries: List<LeaderboardEntry>) {
    Card(colors = CardDefaults.cardColors(containerColor = Color(0xF01A1A24))) {
        Column(modifier = Modifier.padding(12.dp)) {
            if (entries.isEmpty()) {
                Text("No scores yet.", color = Color.White.copy(alpha = 0.7f))
            } else {
                entries.forEach { entry ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(
                            "${entry.rank}. ${entry.name}${if (entry.isMe) " (you)" else ""}",
                            color = Color.White,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        Text(
                            "${entry.score} pts (${entry.found}/${entry.total})" +
                                if (entry.finished) " ✓" else "",
                            color = Color.White.copy(alpha = 0.8f),
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun NoticeCard(message: String, isError: Boolean = false) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = if (isError) Color(0xCCF87171) else Color(0xCC1A1A24),
        ),
    ) {
        Text(
            message,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            style = MaterialTheme.typography.bodySmall,
            color = Color.White,
        )
    }
}

@Composable
private fun FeedbackBanner(feedback: HuntFeedback, onDismissed: () -> Unit) {
    LaunchedEffect(feedback.id) {
        delay(FEEDBACK_BANNER_MILLIS)
        onDismissed()
    }
    val color = when (feedback.kind) {
        HuntFeedback.Kind.Correct, HuntFeedback.Kind.Complete -> Color(0xFF10B981)
        HuntFeedback.Kind.Wrong, HuntFeedback.Kind.Error -> Color(0xFFF87171)
        HuntFeedback.Kind.AlreadyFound, HuntFeedback.Kind.Info -> Color(0xFF06B6D4)
    }
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(top = 96.dp, start = 24.dp, end = 24.dp),
        contentAlignment = Alignment.TopCenter,
    ) {
        Card(colors = CardDefaults.cardColors(containerColor = color)) {
            Text(
                feedback.message,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                color = Color.White,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

private fun formatMillis(ms: Long): String {
    val totalSeconds = (ms / 1000).coerceAtLeast(0)
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return "%d:%02d".format(minutes, seconds)
}
