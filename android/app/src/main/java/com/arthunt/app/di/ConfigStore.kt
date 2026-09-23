package com.arthunt.app.di

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.arthunt.core.config.AppConfig
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.configDataStore by preferencesDataStore(name = "arthunt_config")

/**
 * Persists the user-entered half of [AppConfig] (Supabase URL/key, or the
 * choice to run in Demo mode instead) to DataStore -- see
 * docs/ANDROID_ARCHITECTURE.md §6. `BuildConfig` values, when present, take
 * precedence over whatever is stored here; that merge happens in
 * [AppContainer], not here.
 */
class ConfigStore(context: Context) {
    private val dataStore = context.applicationContext.configDataStore

    private object Keys {
        val URL = stringPreferencesKey("supabase_url")
        val ANON_KEY = stringPreferencesKey("supabase_anon_key")
        val DEMO_MODE = booleanPreferencesKey("demo_mode")
    }

    val configFlow: Flow<AppConfig> = dataStore.data.map { prefs ->
        AppConfig(
            supabaseUrl = prefs[Keys.URL] ?: "",
            supabaseAnonKey = prefs[Keys.ANON_KEY] ?: "",
            demoMode = prefs[Keys.DEMO_MODE] ?: false,
        )
    }

    suspend fun saveCredentials(url: String, anonKey: String) {
        dataStore.edit { prefs ->
            prefs[Keys.URL] = url.trim()
            prefs[Keys.ANON_KEY] = anonKey.trim()
            prefs[Keys.DEMO_MODE] = false
        }
    }

    suspend fun enableDemoMode() {
        dataStore.edit { prefs ->
            prefs[Keys.DEMO_MODE] = true
        }
    }

    suspend fun clear() {
        dataStore.edit { it.clear() }
    }
}
