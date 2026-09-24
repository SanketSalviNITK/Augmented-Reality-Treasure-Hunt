package com.arthunt.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.arthunt.app.di.AppContainer
import com.arthunt.app.ui.creator.CreatorScreen
import com.arthunt.app.ui.hunter.HunterScreen
import com.arthunt.app.ui.portal.PortalScreen
import com.arthunt.app.ui.setup.SetupScreen
import com.arthunt.app.ui.theme.ArtHuntTheme
import com.arthunt.core.domain.DeepLinks
import kotlinx.coroutines.launch

private const val ROUTE_SETUP = "setup"
private const val ROUTE_PORTAL = "portal"
private const val ROUTE_CREATOR = "creator"
private const val ROUTE_HUNTER = "hunter?eventId={eventId}"
private fun hunterRoute(eventId: String) = "hunter?eventId=$eventId"

/**
 * Single Activity, Compose [NavHost]. Also the deep-link intake point for
 * `arthunt://join/<id>` and the web share link
 * (`https://augmented-reality-treasure-hunt.vercel.app/?event=<id>`) --
 * parsing itself lives in [DeepLinks] (`:core`, unit-tested); this class
 * just reads the incoming `Intent`'s data URI and routes to the hunter
 * screen once the app is past setup.
 */
class MainActivity : ComponentActivity() {
    // A Compose State so a link delivered via onNewIntent (app already
    // running) reaches the NavHost's effect without recreating the Activity.
    private val pendingEventIdState = mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        pendingEventIdState.value = eventIdFromIntent(intent)

        val container = (application as ArthuntApp).container

        setContent {
            ArtHuntTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    ArthuntNavHost(container = container, pendingEventId = pendingEventIdState)
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        eventIdFromIntent(intent)?.let { pendingEventIdState.value = it }
    }

    private fun eventIdFromIntent(intent: Intent?): String? =
        intent?.data?.toString()?.let { DeepLinks.parseEventId(it) }
}

@Composable
private fun ArthuntNavHost(container: AppContainer, pendingEventId: State<String?>) {
    val navController = rememberNavController()
    val config by container.config.collectAsState()
    val scope = rememberCoroutineScope()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

    // Leave the setup screen the moment we have a usable config (real
    // credentials or Demo mode), whether that resolved synchronously
    // (BuildConfig) or asynchronously (DataStore / just tapped Save/Demo).
    LaunchedEffect(config.needsSetup, currentRoute) {
        if (!config.needsSetup && currentRoute == ROUTE_SETUP) {
            navController.navigate(ROUTE_PORTAL) { popUpTo(ROUTE_SETUP) { inclusive = true } }
        }
    }

    // A join deep link (cold start or onNewIntent) routes to the hunter
    // screen as soon as the app is past setup.
    LaunchedEffect(pendingEventId.value, config.needsSetup) {
        val id = pendingEventId.value
        if (id != null && !config.needsSetup) {
            navController.navigate(hunterRoute(id)) { launchSingleTop = true }
        }
    }

    NavHost(navController = navController, startDestination = ROUTE_SETUP) {
        composable(ROUTE_SETUP) {
            SetupScreen(
                onSave = { url, anonKey -> scope.launch { container.saveCredentials(url, anonKey) } },
                onUseDemoMode = { scope.launch { container.enableDemoMode() } },
            )
        }
        composable(ROUTE_PORTAL) {
            PortalScreen(
                onCreatorStudio = { navController.navigate(ROUTE_CREATOR) },
                onStartQuest = { navController.navigate(ROUTE_HUNTER.substringBefore("?")) },
            )
        }
        composable(ROUTE_CREATOR) {
            CreatorScreen(onBack = { navController.popBackStack() })
        }
        composable(
            route = ROUTE_HUNTER,
            arguments = listOf(navArgument("eventId") { type = NavType.StringType; nullable = true; defaultValue = null }),
        ) { entry ->
            HunterScreen(
                eventId = entry.arguments?.getString("eventId"),
                container = container,
                onBack = { navController.popBackStack() },
            )
        }
    }
}
