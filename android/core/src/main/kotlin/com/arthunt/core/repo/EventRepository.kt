package com.arthunt.core.repo

import com.arthunt.core.model.EventData
import com.arthunt.core.model.EventRow
import com.arthunt.core.model.Player

/** `public.events` access — see [com.arthunt.core.supabase.SupabaseEventRepository] and [com.arthunt.core.fake.FakeEventRepository]. */
interface EventRepository {
    suspend fun list(): List<EventRow>
    suspend fun get(id: String): EventRow?
    suspend fun insert(data: EventData): EventRow
    suspend fun update(id: String, data: EventData)

    /**
     * Upserts a single player into event [eventId]: fetches the latest copy
     * of the event, replaces or inserts [player] by name (see
     * [EventData.withPlayer]), and writes the merged event back. Never
     * writes back a stale snapshot of all players -- callers that only hold
     * an old copy of the event's other players are safe to call this with
     * just their own updated [player].
     *
     * A no-op if [eventId] doesn't exist (matches [update]'s behavior).
     */
    suspend fun updatePlayer(eventId: String, player: Player)
}
