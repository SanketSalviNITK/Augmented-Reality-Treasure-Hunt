package com.arthunt.app.ui.hunter

import com.arthunt.core.model.EventRow

/**
 * Every step of the hunter flow that ISN'T the AR camera screen (see
 * [HuntUiState] for that one). [HunterViewModel] exposes this as its main
 * `StateFlow`; `HunterScreen` switches on it to pick which composable to show.
 *
 * Browse -> Identity -> Consent -> Hunting -> Results -> FeedbackForm -> Done,
 * per `docs/ANDROID_ARCHITECTURE.md` §4's join order (with the rejoin
 * short-circuit straight from Identity to Results -- see
 * [com.arthunt.core.domain.JoinPlanner]).
 */
sealed class HunterScreenState {
    /** Initial state while the first event list load is in flight. */
    data object Loading : HunterScreenState()

    /** Browsing joinable hunts. [error] is a one-off message (deep link rejected, load failure, decline, ...). */
    data class Browse(
        val events: List<EventRow> = emptyList(),
        val isRefreshing: Boolean = false,
        val error: String? = null,
    ) : HunterScreenState()

    /** Name + age gate, collected on join (see `requireIdentity` on the web). */
    data class Identity(
        val eventId: String,
        val eventName: String,
        val error: String? = null,
    ) : HunterScreenState()

    /** Informed-consent gate; must be resolved before any database write. */
    data class Consent(
        val eventId: String,
        val eventName: String,
    ) : HunterScreenState()

    /**
     * The AR camera screen (owned by `ui.ar`, outside this package) is
     * driving the experience. `HunterScreen` renders it from
     * [HunterViewModel.huntState] while this is the current step.
     */
    data object Hunting : HunterScreenState()

    /** Post-hunt standings, shown whether the hunter finished, ran out of time, exited early, or is rejoining after any of those. */
    data class Results(
        val eventId: String,
        val eventName: String,
        val leaderboard: List<LeaderboardEntry>,
        val found: Int,
        val total: Int,
        val hintsUsed: Int,
        val score: Int,
    ) : HunterScreenState()

    /** The 4-question research questionnaire (immersion/usability/engagement/stability, 1-5 each). */
    data class FeedbackForm(val eventId: String) : HunterScreenState()

    /** Flow finished (feedback submitted); `HunterScreen` pops back to the portal. */
    data object Done : HunterScreenState()
}
