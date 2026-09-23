package com.arthunt.core.fake

import com.arthunt.core.model.EventData
import com.arthunt.core.model.EventRow
import com.arthunt.core.repo.EventRepository
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Thread-safe in-memory [EventRepository]: backs unit tests and the app's
 * Demo mode (no Supabase project needed to try the app).
 */
class FakeEventRepository(seed: List<EventRow> = emptyList()) : EventRepository {
    private val rows = ConcurrentHashMap<String, EventRow>()
    // Preserves insertion order for `list()`, matching the web's
    // `order('created_at', { ascending: false })` (newest first) closely
    // enough for demo/test purposes.
    private val order = java.util.Collections.synchronizedList(mutableListOf<String>())

    init {
        seed.forEach { rows[it.id] = it; order.add(it.id) }
    }

    override suspend fun list(): List<EventRow> = synchronized(order) { order.toList() }.mapNotNull { rows[it] }.reversed()

    override suspend fun get(id: String): EventRow? = rows[id]

    override suspend fun insert(data: EventData): EventRow {
        val id = UUID.randomUUID().toString()
        val row = EventRow(id = id, data = data, createdAt = java.time.Instant.now().toString())
        rows[id] = row
        order.add(id)
        return row
    }

    override suspend fun update(id: String, data: EventData) {
        val existing = rows[id] ?: return
        rows[id] = existing.copy(data = data)
    }
}
