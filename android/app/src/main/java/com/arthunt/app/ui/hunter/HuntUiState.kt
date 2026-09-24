package com.arthunt.app.ui.hunter

import com.arthunt.core.model.Marker

/*
 * M1 contract between the hunt logic (HunterViewModel) and the AR screen
 * (ui/ar/ArHuntScreen). The ViewModel owns and emits HuntUiState; the AR
 * screen only renders it and reports raw detections back:
 *
 *   @Composable
 *   fun ArHuntScreen(
 *       state: HuntUiState,
 *       onMarkerDetected: (markerIndex: Int) -> Unit, // 0-based index into state.markers
 *       onUseHint: () -> Unit,
 *       onStopHunt: () -> Unit,
 *       onFeedbackShown: (feedbackId: Long) -> Unit,
 *   )
 *
 * The ViewModel decides whether a detection is correct, wrong, or already
 * found (core domain `evaluateScan`), logs telemetry, and saves progress.
 * The AR screen shows a marker's reward only when its number is in
 * `detectedMarkerNumbers`, mirroring the web app (wrong markers stay hidden).
 */

/** Everything the AR hunt screen needs to render, as one immutable snapshot. */
data class HuntUiState(
    val eventId: String,
    val eventName: String,
    /** All markers of the event, in event order (index = marker number - 1). */
    val markers: List<Marker>,
    val foundCount: Int,
    val totalCount: Int,
    /** 1-based marker numbers this hunter has correctly scanned. */
    val detectedMarkerNumbers: Set<Int>,
    /** 1-based position of the current target in the hunter's path ("Marker 2 of 5"). */
    val clueNumber: Int,
    /** Riddle for the current target; null when the creator gave none. */
    val clueText: String?,
    /** Current target's marker image URL once a hint was used for it; otherwise null. */
    val hintImageUrl: String?,
    /** Milliseconds left on the hunt timer; null when the hunt has no time limit. */
    val remainingMillis: Long?,
    val leaderboard: List<LeaderboardEntry>,
    val isComplete: Boolean,
    /** True in Demo mode: the AR screen shows "simulate scan" controls for testing without printed markers. */
    val demoMode: Boolean,
    /** Transient message for the HUD (toast/snackbar); acknowledge with onFeedbackShown(id). */
    val feedback: HuntFeedback? = null,
)

data class LeaderboardEntry(
    val rank: Int,
    val name: String,
    val score: Int,
    val found: Int,
    val total: Int,
    val isMe: Boolean,
    val finished: Boolean,
)

data class HuntFeedback(
    /** Unique per message so the same text can be shown twice. */
    val id: Long,
    val kind: Kind,
    val message: String,
) {
    enum class Kind { Correct, Wrong, AlreadyFound, Complete, Info, Error }
}
