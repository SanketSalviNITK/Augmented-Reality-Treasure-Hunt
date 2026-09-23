package com.arthunt.core.fake

import com.arthunt.core.repo.StorageRepository
import java.util.concurrent.ConcurrentHashMap
import kotlin.random.Random

/**
 * In-memory [StorageRepository]: "uploads" are just kept in a map and handed
 * back as a fake `demo://` URL, so Demo mode never needs network or a real
 * Storage bucket.
 */
class FakeStorageRepository : StorageRepository {
    private val files = ConcurrentHashMap<String, ByteArray>()

    override suspend fun upload(bytes: ByteArray, folder: String, fileExtension: String): String {
        val name = randomFileName()
        val path = "$folder/$name.$fileExtension"
        files[path] = bytes
        return "demo://ar-assets/$path"
    }

    private fun randomFileName(): String {
        val chars = "abcdefghijklmnopqrstuvwxyz0123456789"
        return (1..13).map { chars[Random.nextInt(chars.length)] }.joinToString("")
    }
}
