package com.arthunt.core.config

/**
 * Where the app gets its Supabase credentials from and whether it should run
 * against fake in-memory repositories instead ("Demo mode"). Built by
 * `com.arthunt.app.di.AppContainer` from `BuildConfig` (compile-time, takes
 * precedence) or DataStore (user-entered on the setup screen).
 */
data class AppConfig(
    val supabaseUrl: String = "",
    val supabaseAnonKey: String = "",
    val demoMode: Boolean = false,
) {
    val isConfigured: Boolean get() = supabaseUrl.isNotBlank() && supabaseAnonKey.isNotBlank()

    /** True when there's nothing usable to run on yet -- neither real config nor demo mode chosen. */
    val needsSetup: Boolean get() = !isConfigured && !demoMode
}
