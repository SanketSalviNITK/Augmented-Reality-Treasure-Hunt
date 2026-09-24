package com.arthunt.app.ui.hunter

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.arthunt.app.di.AppContainer
import com.arthunt.app.di.Repositories
import com.arthunt.core.domain.JoinOutcome
import com.arthunt.core.domain.JoinPlanner
import com.arthunt.core.domain.ScanResult
import com.arthunt.core.domain.applyHint
import com.arthunt.core.domain.displayName
import com.arthunt.core.domain.evaluateScan
import com.arthunt.core.domain.expectedNextMarkerIndex
import com.arthunt.core.domain.leaderboardOrder
import com.arthunt.core.domain.remainingMillis
import com.arthunt.core.domain.score
import com.arthunt.core.model.EventData
import com.arthunt.core.model.EventRow
import com.arthunt.core.model.Player
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

private const val LEADERBOARD_REFRESH_MS = 5_000L
private const val WRONG_SCAN_DEBOUNCE_MS = 4_000L
private const val WRONG_SCAN_MESSAGE = "Not this one! Re-read your current clue"

/**
 * Owns the whole non-AR hunter flow (see [HunterScreenState]) plus the game
 * state the AR screen renders ([HuntUiState], via [huntState]). Ports the
 * CURRENT join/game rules from `docs/ANDROID_ARCHITECTURE.md` §3-4 and
 * `main.js` (`joinEvent`, `requireIdentity`, `requireConsent`,
 * `#btn-use-hint`, `startQuestTimer`/`handleTimesUp`, `#btn-stop-ar`,
 * `renderHunterLeaderboard`, `renderPostHuntLeaderboard`,
 * `#btn-submit-feedback`) onto Android.
 *
 * All game-rule decisions are delegated to `:core` (`JoinPlanner`,
 * `evaluateScan`, `applyHint`, `leaderboardOrder`, ...); this class is
 * orchestration and persistence only.
 */
class HunterViewModel(
    private val repositories: Repositories,
    private val demoMode: Boolean,
) : ViewModel() {

    private val _screenState = MutableStateFlow<HunterScreenState>(HunterScreenState.Loading)
    val screenState: StateFlow<HunterScreenState> = _screenState.asStateFlow()

    private val _huntState = MutableStateFlow<HuntUiState?>(null)
    val huntState: StateFlow<HuntUiState?> = _huntState.asStateFlow()

    // Cached full event list, independent of `screenState` so we can restore
    // Browse (with its list intact) from any later step.
    private var loadedEvents: List<EventRow> = emptyList()

    // Identity is collected once per app session and reused across hunts,
    // mirroring the web's `state.player`.
    private var sessionName: String? = null
    private var sessionAge: String? = null

    // The hunt currently being joined/played.
    private var currentEvent: EventRow? = null
    private var currentPlayer: Player? = null

    // A join decided by JoinPlanner but not yet written (waiting on consent).
    private var pendingJoinEvent: EventRow? = null
    private var pendingJoinPlayer: Player? = null

    // Marker index -> ms timestamp of the last "wrong scan" toast shown for it.
    private val lastWrongToastAt = HashMap<Int, Long>()

    // The marker index a hint has been revealed for (cleared once that target is found).
    private var hintRevealedForIndex: Int? = null

    private var feedbackSeq = 0L

    private var timerJob: Job? = null
    private var leaderboardJob: Job? = null

    init {
        loadEvents()
    }

    // ─── Browse ────────────────────────────────────────────────────────

    fun loadEvents() {
        viewModelScope.launch {
            _screenState.value = when (val current = _screenState.value) {
                is HunterScreenState.Browse -> current.copy(isRefreshing = true)
                else -> HunterScreenState.Loading
            }
            runCatching { repositories.events.list() }
                .onSuccess { rows ->
                    loadedEvents = rows.filter { it.data.isActive }
                    _screenState.value = HunterScreenState.Browse(events = loadedEvents)
                }
                .onFailure { err ->
                    _screenState.value = HunterScreenState.Browse(
                        events = loadedEvents,
                        error = "Could not load hunts: ${err.message ?: "unknown error"}",
                    )
                }
        }
    }

    /** A deep link (`arthunt://join/<id>` or the web share link) arrived with this event id. */
    fun onDeepLink(eventId: String) {
        viewModelScope.launch {
            val row = runCatching { repositories.events.get(eventId) }.getOrNull()
            when {
                row == null -> _screenState.value = HunterScreenState.Browse(loadedEvents, error = "That hunt could not be found.")
                !row.data.isActive -> _screenState.value = HunterScreenState.Browse(loadedEvents, error = "That hunt is no longer active.")
                else -> beginJoin(row)
            }
        }
    }

    fun onJoinClicked(eventId: String) {
        val row = loadedEvents.find { it.id == eventId } ?: return
        viewModelScope.launch { beginJoin(row) }
    }

    private suspend fun beginJoin(row: EventRow) {
        currentEvent = row
        val name = sessionName
        val age = sessionAge
        if (name == null || age == null) {
            _screenState.value = HunterScreenState.Identity(eventId = row.id, eventName = row.data.name)
        } else {
            proceedAfterIdentity(row.id, name, age)
        }
    }

    // ─── Identity ──────────────────────────────────────────────────────

    fun submitIdentity(name: String, age: String) {
        val trimmedName = name.trim()
        val trimmedAge = age.trim()
        if (trimmedName.isEmpty() || trimmedAge.isEmpty()) {
            val current = _screenState.value as? HunterScreenState.Identity ?: return
            _screenState.value = current.copy(error = "Please enter your name and age.")
            return
        }
        val eventId = currentEvent?.id ?: (_screenState.value as? HunterScreenState.Identity)?.eventId ?: return
        sessionName = trimmedName
        sessionAge = trimmedAge
        viewModelScope.launch { proceedAfterIdentity(eventId, trimmedName, trimmedAge) }
    }

    fun cancelIdentity() {
        currentEvent = null
        _screenState.value = HunterScreenState.Browse(loadedEvents)
    }

    private suspend fun proceedAfterIdentity(eventId: String, name: String, age: String) {
        val latest = runCatching { repositories.events.get(eventId) }.getOrNull()
        if (latest == null) {
            _screenState.value = HunterScreenState.Browse(loadedEvents, error = "That hunt could not be found.")
            return
        }
        currentEvent = latest

        val existing = latest.data.players.find { it.name == name }
        val outcome = JoinPlanner.plan(event = latest.data, existing = existing, name = name, age = age)

        val player = when (outcome) {
            is JoinOutcome.ShowResults -> {
                currentPlayer = outcome.player
                showResults()
                return
            }
            is JoinOutcome.New -> outcome.player
            is JoinOutcome.Resume -> outcome.player
        }

        pendingJoinEvent = latest
        pendingJoinPlayer = player

        // Event settings (snapshotted on the event) override local defaults; mandatoryConsent defaults true.
        val mandatoryConsent = latest.data.settings?.mandatoryConsent ?: true
        if (mandatoryConsent) {
            _screenState.value = HunterScreenState.Consent(eventId = latest.id, eventName = latest.data.name)
        } else {
            commitJoinAndStart(latest, player)
        }
    }

    // ─── Consent ───────────────────────────────────────────────────────

    fun agreeConsent() {
        val event = pendingJoinEvent ?: return
        val player = pendingJoinPlayer ?: return
        pendingJoinEvent = null
        pendingJoinPlayer = null
        viewModelScope.launch { commitJoinAndStart(event, player) }
    }

    /** Declining returns to the hunt list with no database write. */
    fun declineConsent() {
        pendingJoinEvent = null
        pendingJoinPlayer = null
        currentEvent = null
        _screenState.value = HunterScreenState.Browse(loadedEvents)
    }

    private suspend fun commitJoinAndStart(event: EventRow, player: Player) {
        repositories.events.updatePlayer(event.id, player)
        currentEvent = event.copy(data = event.data.withPlayer(player))
        currentPlayer = player
        lastWrongToastAt.clear()
        hintRevealedForIndex = null
        repositories.telemetry.log(event.id, player.name, "join")

        _screenState.value = HunterScreenState.Hunting
        emitHuntUiState()
        startTimerLoop()
        startLeaderboardLoop()
    }

    // ─── Hunting ───────────────────────────────────────────────────────

    fun onMarkerDetected(markerIndex: Int) {
        val event = currentEvent ?: return
        val player = currentPlayer ?: return
        val totalMarkers = event.data.markers.size

        when (val result = evaluateScan(player, markerIndex, totalMarkers)) {
            is ScanResult.AlreadyFound -> {
                // Nothing changes; just re-emit (e.g. timer tick) without a new toast.
                emitHuntUiState()
            }

            is ScanResult.Wrong -> {
                repositories.telemetry.log(event.id, player.name, "wrong_scan", marker = markerIndex + 1)
                val now = System.currentTimeMillis()
                val lastToast = lastWrongToastAt[markerIndex]
                if (lastToast == null || now - lastToast >= WRONG_SCAN_DEBOUNCE_MS) {
                    lastWrongToastAt[markerIndex] = now
                    emitHuntUiState(buildFeedback(HuntFeedback.Kind.Wrong, WRONG_SCAN_MESSAGE))
                } else {
                    emitHuntUiState()
                }
            }

            is ScanResult.Correct -> {
                currentPlayer = result.updatedPlayer
                hintRevealedForIndex = null
                repositories.telemetry.log(event.id, player.name, "scan", marker = markerIndex + 1)
                viewModelScope.launch { repositories.events.updatePlayer(event.id, result.updatedPlayer) }
                emitHuntUiState(buildFeedback(HuntFeedback.Kind.Correct, "Marker found!"))
            }

            is ScanResult.CorrectAndComplete -> {
                currentPlayer = result.updatedPlayer
                hintRevealedForIndex = null
                repositories.telemetry.log(event.id, player.name, "scan", marker = markerIndex + 1)
                repositories.telemetry.log(event.id, player.name, "complete")
                viewModelScope.launch { repositories.events.updatePlayer(event.id, result.updatedPlayer) }
                // Stop the countdown -- completion doesn't race the timer for the exit; the AR
                // screen's own UI decides when to call onStopHunt() from here.
                timerJob?.cancel()
                emitHuntUiState(buildFeedback(HuntFeedback.Kind.Complete, "Quest complete! Great work."))
            }
        }
    }

    fun useHint() {
        val event = currentEvent ?: return
        val player = currentPlayer ?: return
        val total = event.data.markers.size
        if (player.detectedMarkers.size >= total) return

        val expectedIndex = expectedNextMarkerIndex(player)
        val target = event.data.markers.getOrNull(expectedIndex) ?: return

        val updated = applyHint(player)
        currentPlayer = updated
        hintRevealedForIndex = expectedIndex

        repositories.telemetry.log(event.id, player.name, "hint", marker = expectedIndex + 1)
        viewModelScope.launch { repositories.events.updatePlayer(event.id, updated) }

        emitHuntUiState(buildFeedback(HuntFeedback.Kind.Info, "Hint revealed! Check the marker image below."))
    }

    /** Stops the hunt (manual "stop" from the AR screen, or a confirmed back-press): sets `endTime` once, saves, and shows results. */
    fun stopHunt() {
        viewModelScope.launch {
            val event = currentEvent ?: return@launch
            val player = currentPlayer ?: return@launch
            if (player.endTime == null) {
                val updated = player.withEndTime(System.currentTimeMillis())
                currentPlayer = updated
                repositories.events.updatePlayer(event.id, updated)
            }
            showResults()
        }
    }

    fun onFeedbackShown(feedbackId: Long) {
        val current = _huntState.value ?: return
        if (current.feedback?.id == feedbackId) {
            _huntState.value = current.copy(feedback = null)
        }
    }

    private fun buildFeedback(kind: HuntFeedback.Kind, message: String): HuntFeedback =
        HuntFeedback(id = feedbackSeq++, kind = kind, message = message)

    private fun emitHuntUiState(newFeedback: HuntFeedback? = null) {
        val event = currentEvent ?: return
        val player = currentPlayer ?: return
        val eventData = event.data
        val markers = eventData.markers
        val total = markers.size
        val found = player.detectedMarkers.size
        val expectedIndex = expectedNextMarkerIndex(player)
        val currentTarget = markers.getOrNull(expectedIndex)
        val anonymize = eventData.settings?.anonymizeHunters ?: false

        _huntState.value = HuntUiState(
            eventId = event.id,
            eventName = eventData.name,
            markers = markers,
            foundCount = found,
            totalCount = total,
            detectedMarkerNumbers = player.detectedMarkers.toSet(),
            clueNumber = found + 1,
            clueText = currentTarget?.hint,
            hintImageUrl = if (hintRevealedForIndex == expectedIndex) currentTarget?.imageUrl else null,
            remainingMillis = remainingMillis(eventData.timeLimit, player.startTime ?: 0L),
            leaderboard = buildLeaderboard(eventData, player, anonymize),
            isComplete = total > 0 && found >= total,
            demoMode = demoMode,
            feedback = newFeedback ?: _huntState.value?.feedback,
        )
    }

    private fun startTimerLoop() {
        timerJob?.cancel()
        val event = currentEvent ?: return
        if (event.data.timeLimit <= 0) return
        timerJob = viewModelScope.launch {
            while (isActive) {
                val player = currentPlayer ?: break
                val remaining = remainingMillis(event.data.timeLimit, player.startTime ?: 0L)
                if (remaining != null && remaining <= 0) {
                    endHuntDueToTimeout()
                    break
                }
                emitHuntUiState()
                delay(1_000)
            }
        }
    }

    // Runs INSIDE timerJob's own coroutine (called right before it `break`s out
    // of its loop): must not cancel timerJob itself -- self-cancelling here
    // would mark this very coroutine Cancelling and abort the suspend calls
    // below (updatePlayer / showResultsCore) partway through. leaderboardJob
    // is a different job, safe to cancel from here.
    private suspend fun endHuntDueToTimeout() {
        val event = currentEvent ?: return
        val player = currentPlayer ?: return
        if (player.endTime == null) {
            val updated = player.withEndTime(System.currentTimeMillis())
            currentPlayer = updated
            repositories.events.updatePlayer(event.id, updated)
        }
        leaderboardJob?.cancel()
        showResultsCore()
        timerJob = null // the loop is about to `break` on its own; clear the now-stale reference
    }

    private fun startLeaderboardLoop() {
        leaderboardJob?.cancel()
        leaderboardJob = viewModelScope.launch {
            while (isActive) {
                delay(LEADERBOARD_REFRESH_MS)
                refreshLeaderboardWhileHunting()
            }
        }
    }

    private suspend fun refreshLeaderboardWhileHunting() {
        val event = currentEvent ?: return
        val latest = runCatching { repositories.events.get(event.id) }.getOrNull() ?: return
        // Keep our own in-progress player authoritative (the periodic fetch may
        // race an in-flight updatePlayer save); everyone else's data refreshes.
        currentEvent = latest
        emitHuntUiState()
    }

    // ─── Results ───────────────────────────────────────────────────────

    /** Entry point for every caller EXCEPT the timer's own coroutine (see [endHuntDueToTimeout]). */
    private suspend fun showResults() {
        timerJob?.cancel()
        leaderboardJob?.cancel()
        showResultsCore()
    }

    private suspend fun showResultsCore() {
        val base = currentEvent ?: return
        val myPlayer = currentPlayer ?: return

        val latest = runCatching { repositories.events.get(base.id) }.getOrNull() ?: base
        currentEvent = latest
        val me = latest.data.players.find { it.name == myPlayer.name } ?: myPlayer
        currentPlayer = me

        _screenState.value = resultsState(latest.data, me)
    }

    /** Manual refresh of the post-hunt leaderboard (pull-to-refresh / sync button). */
    fun refreshResults() {
        viewModelScope.launch { showResults() }
    }

    private fun resultsState(eventData: EventData, me: Player): HunterScreenState.Results {
        val anonymize = eventData.settings?.anonymizeHunters ?: false
        return HunterScreenState.Results(
            eventId = currentEvent?.id ?: "",
            eventName = eventData.name,
            leaderboard = buildLeaderboard(eventData, me, anonymize),
            found = me.detectedMarkers.size,
            total = eventData.markers.size,
            hintsUsed = me.hintsUsed,
            score = score(me),
        )
    }

    private fun buildLeaderboard(eventData: EventData, me: Player, anonymize: Boolean): List<LeaderboardEntry> {
        val players = eventData.players.toMutableList()
        val idx = players.indexOfFirst { it.name == me.name }
        if (idx >= 0) players[idx] = me else players.add(me)

        val total = eventData.markers.size
        return leaderboardOrder(players).mapIndexed { i, p ->
            LeaderboardEntry(
                rank = i + 1,
                name = displayName(p, anonymize),
                score = score(p),
                found = p.detectedMarkers.size,
                total = total,
                isMe = p.name == me.name,
                finished = total > 0 && p.detectedMarkers.size >= total,
            )
        }
    }

    // ─── Feedback ──────────────────────────────────────────────────────

    fun continueToFeedback() {
        val eventId = currentEvent?.id ?: return
        _screenState.value = HunterScreenState.FeedbackForm(eventId = eventId)
    }

    fun submitFeedback(immersion: Int, usability: Int, engagement: Int, stability: Int) {
        viewModelScope.launch {
            runCatching {
                repositories.feedback.submit(
                    com.arthunt.core.model.Feedback(
                        immersion = immersion,
                        usability = usability,
                        engagement = engagement,
                        stability = stability,
                    )
                )
            }
            finishAndReturnToPortal()
        }
    }

    private fun finishAndReturnToPortal() {
        currentEvent = null
        currentPlayer = null
        pendingJoinEvent = null
        pendingJoinPlayer = null
        _screenState.value = HunterScreenState.Done
    }

    override fun onCleared() {
        timerJob?.cancel()
        leaderboardJob?.cancel()
        super.onCleared()
    }
}

/** Manual `ViewModelProvider.Factory` (no Hilt) -- see `docs/ANDROID_ARCHITECTURE.md` §1. */
class HunterViewModelFactory(private val container: AppContainer) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        require(modelClass.isAssignableFrom(HunterViewModel::class.java)) { "Unknown ViewModel class $modelClass" }
        return HunterViewModel(
            repositories = container.repositories.value,
            demoMode = container.config.value.demoMode,
        ) as T
    }
}
