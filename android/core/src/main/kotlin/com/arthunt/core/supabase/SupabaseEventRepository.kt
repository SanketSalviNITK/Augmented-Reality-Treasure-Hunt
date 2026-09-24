package com.arthunt.core.supabase

import com.arthunt.core.model.EventData
import com.arthunt.core.model.EventRow
import com.arthunt.core.model.Player
import com.arthunt.core.repo.EventRepository
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Order

/** [EventRepository] backed by `public.events` via supabase-kt Postgrest. Thin: all game logic lives in `core/domain`. */
class SupabaseEventRepository(private val client: SupabaseClient) : EventRepository {

    override suspend fun list(): List<EventRow> =
        client.from("events")
            .select { order("created_at", Order.DESCENDING) }
            .decodeList<EventRowDto>()
            .map { it.toModel() }

    override suspend fun get(id: String): EventRow? =
        client.from("events")
            .select { filter { eq("id", id) } }
            .decodeSingleOrNull<EventRowDto>()
            ?.toModel()

    override suspend fun insert(data: EventData): EventRow =
        client.from("events")
            .insert(EventInsertDto(data.toJson())) { select() }
            .decodeSingle<EventRowDto>()
            .toModel()

    override suspend fun update(id: String, data: EventData) {
        client.from("events").update({ set("data", data.toJson()) }) { filter { eq("id", id) } }
    }

    // Fetches the latest copy of the event and merges only this one player
    // into it, so a hunter's own progress write never clobbers markers,
    // settings or other players' progress written concurrently by someone
    // else -- see the contract on [EventRepository.updatePlayer].
    override suspend fun updatePlayer(eventId: String, player: Player) {
        val current = get(eventId) ?: return
        update(eventId, current.data.withPlayer(player))
    }

    private fun EventRowDto.toModel() = EventRow(id = id, data = EventData.fromJson(data), createdAt = createdAt)
}
