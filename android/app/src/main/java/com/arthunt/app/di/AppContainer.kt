package com.arthunt.app.di

import android.content.Context
import com.arthunt.app.BuildConfig
import com.arthunt.core.config.AppConfig
import com.arthunt.core.fake.FakeEventRepository
import com.arthunt.core.fake.FakeFeedbackRepository
import com.arthunt.core.fake.FakeStorageRepository
import com.arthunt.core.fake.FakeTelemetryRepository
import com.arthunt.core.repo.EventRepository
import com.arthunt.core.repo.FeedbackRepository
import com.arthunt.core.repo.StorageRepository
import com.arthunt.core.repo.TelemetryRepository
import com.arthunt.core.supabase.SupabaseClientFactory
import com.arthunt.core.supabase.SupabaseEventRepository
import com.arthunt.core.supabase.SupabaseFeedbackRepository
import com.arthunt.core.supabase.SupabaseStorageRepository
import com.arthunt.core.supabase.SupabaseTelemetryRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** The four repositories a screen needs, bundled together for whatever [AppConfig] is currently active. */
data class Repositories(
    val events: EventRepository,
    val telemetry: TelemetryRepository,
    val feedback: FeedbackRepository,
    val storage: StorageRepository,
)

/**
 * Manual DI container (no Hilt -- see docs/ANDROID_ARCHITECTURE.md §1). Owns
 * the app-lifetime coroutine scope, the [ConfigStore], the merged
 * [AppConfig] (BuildConfig values always win over DataStore, matching §6),
 * and rebuilds [Repositories] -- Supabase-backed when configured, fake
 * in-memory ones in Demo mode -- whenever that config changes.
 */
class AppContainer(context: Context) {
    private val appContext = context.applicationContext
    private val configStore = ConfigStore(appContext)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private val buildConfigConfig: AppConfig? =
        if (BuildConfig.SUPABASE_URL.isNotBlank() && BuildConfig.SUPABASE_ANON_KEY.isNotBlank()) {
            AppConfig(supabaseUrl = BuildConfig.SUPABASE_URL, supabaseAnonKey = BuildConfig.SUPABASE_ANON_KEY)
        } else {
            null
        }

    private val _config = MutableStateFlow(buildConfigConfig ?: AppConfig())
    val config: StateFlow<AppConfig> = _config.asStateFlow()

    private val _repositories = MutableStateFlow(buildRepositories(_config.value))
    val repositories: StateFlow<Repositories> = _repositories.asStateFlow()

    init {
        if (buildConfigConfig == null) {
            // Only listen to user-entered config when the build didn't already bake in real credentials.
            scope.launch {
                configStore.configFlow.collect { stored ->
                    _config.value = stored
                    _repositories.value = buildRepositories(stored)
                }
            }
        }
    }

    suspend fun saveCredentials(url: String, anonKey: String) = configStore.saveCredentials(url, anonKey)

    suspend fun enableDemoMode() = configStore.enableDemoMode()

    private fun buildRepositories(config: AppConfig): Repositories = when {
        config.isConfigured -> {
            val client = SupabaseClientFactory.create(config.supabaseUrl, config.supabaseAnonKey)
            Repositories(
                events = SupabaseEventRepository(client),
                telemetry = SupabaseTelemetryRepository(client),
                feedback = SupabaseFeedbackRepository(client),
                storage = SupabaseStorageRepository(client),
            )
        }
        else -> Repositories(
            events = FakeEventRepository(),
            telemetry = FakeTelemetryRepository(),
            feedback = FakeFeedbackRepository(),
            storage = FakeStorageRepository(),
        )
    }
}
