package com.arthunt.app.ui.hunter

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import com.arthunt.app.di.AppContainer

/**
 * Entry point for the hunter flow: browse hunts, identity/consent gates, the
 * AR camera session (delegated to `ui.ar.ArHuntScreen`), post-hunt results
 * and the feedback questionnaire. Deep links (`arthunt://join/<id>` and the
 * web share link) already route here with [eventId] set, see
 * [com.arthunt.core.domain.DeepLinks] and `MainActivity`.
 */
@Composable
fun HunterScreen(
    eventId: String?,
    container: AppContainer,
    onBack: () -> Unit,
) {
    val viewModel: HunterViewModel = viewModel(factory = HunterViewModelFactory(container))
    val screenState by viewModel.screenState.collectAsState()
    val huntState by viewModel.huntState.collectAsState()
    var confirmStop by remember { mutableStateOf(false) }

    LaunchedEffect(eventId) {
        if (eventId != null) viewModel.onDeepLink(eventId)
    }

    LaunchedEffect(screenState) {
        if (screenState is HunterScreenState.Done) onBack()
    }

    BackHandler(enabled = true) {
        when (screenState) {
            is HunterScreenState.Identity -> viewModel.cancelIdentity()
            is HunterScreenState.Consent -> viewModel.declineConsent()
            is HunterScreenState.Hunting -> confirmStop = true
            else -> onBack()
        }
    }

    if (confirmStop) {
        AlertDialog(
            onDismissRequest = { confirmStop = false },
            title = { Text("Stop hunting?") },
            text = { Text("Your progress is saved. You'll see the leaderboard and can't rejoin from here.") },
            confirmButton = {
                TextButton(onClick = { confirmStop = false; viewModel.stopHunt() }) { Text("Stop") }
            },
            dismissButton = {
                TextButton(onClick = { confirmStop = false }) { Text("Keep hunting") }
            },
        )
    }

    when (val state = screenState) {
        HunterScreenState.Loading -> LoadingView()

        is HunterScreenState.Browse -> HuntListScreen(
            state = state,
            onRefresh = viewModel::loadEvents,
            onJoin = viewModel::onJoinClicked,
            onBack = onBack,
        )

        is HunterScreenState.Identity -> IdentityScreen(
            state = state,
            onSubmit = viewModel::submitIdentity,
            onCancel = viewModel::cancelIdentity,
        )

        is HunterScreenState.Consent -> ConsentScreen(
            state = state,
            onAgree = viewModel::agreeConsent,
            onDecline = viewModel::declineConsent,
        )

        HunterScreenState.Hunting -> {
            val hunt = huntState
            if (hunt == null) {
                LoadingView()
            } else {
                com.arthunt.app.ui.ar.ArHuntScreen(
                    state = hunt,
                    onMarkerDetected = viewModel::onMarkerDetected,
                    onUseHint = viewModel::useHint,
                    onStopHunt = { confirmStop = true },
                    onFeedbackShown = viewModel::onFeedbackShown,
                )
            }
        }

        is HunterScreenState.Results -> ResultsScreen(
            state = state,
            onRefresh = viewModel::refreshResults,
            onContinue = viewModel::continueToFeedback,
        )

        is HunterScreenState.FeedbackForm -> FeedbackFormScreen(
            onSubmit = viewModel::submitFeedback,
        )

        HunterScreenState.Done -> LoadingView() // brief frame before onBack() fires
    }
}

@Composable
private fun LoadingView() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator()
    }
}
