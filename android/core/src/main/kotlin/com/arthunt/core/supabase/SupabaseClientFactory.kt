package com.arthunt.core.supabase

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.storage.Storage

/**
 * Builds the shared [SupabaseClient] used by the `supabase/` repository
 * implementations. Only the two plugins M0-M2 need (Postgrest, Storage) are
 * installed; Auth is intentionally not installed -- this app authenticates
 * with the anon key only, same as the web app (see
 * `docs/ANDROID_ARCHITECTURE.md` §4 "Admin access").
 *
 * The Android application supplies the actual HTTP engine on its classpath
 * (Ktor OkHttp); this factory doesn't hardcode one so `:core` never needs an
 * Android/OkHttp dependency.
 */
object SupabaseClientFactory {
    fun create(url: String, anonKey: String): SupabaseClient = createSupabaseClient(url, anonKey) {
        install(Postgrest)
        install(Storage)
    }
}
