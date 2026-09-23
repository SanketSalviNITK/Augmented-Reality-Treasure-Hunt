package com.arthunt.core.repo

import com.arthunt.core.model.EventData
import com.arthunt.core.model.EventRow

/** `public.events` access — see [com.arthunt.core.supabase.SupabaseEventRepository] and [com.arthunt.core.fake.FakeEventRepository]. */
interface EventRepository {
    suspend fun list(): List<EventRow>
    suspend fun get(id: String): EventRow?
    suspend fun insert(data: EventData): EventRow
    suspend fun update(id: String, data: EventData)
}
