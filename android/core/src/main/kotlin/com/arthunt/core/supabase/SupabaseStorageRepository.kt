package com.arthunt.core.supabase

import com.arthunt.core.repo.StorageRepository
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.storage.storage
import kotlin.random.Random

private const val BUCKET = "ar-assets"

/**
 * [StorageRepository] backed by the `ar-assets` Storage bucket. File names
 * are random (matches `js/db.js#uploadFile`'s
 * `Math.random().toString(36).substring(2, 15)`).
 */
class SupabaseStorageRepository(private val client: SupabaseClient) : StorageRepository {
    override suspend fun upload(bytes: ByteArray, folder: String, fileExtension: String): String {
        val path = "$folder/${randomFileName()}.$fileExtension"
        client.storage.from(BUCKET).upload(path, bytes)
        return client.storage.from(BUCKET).publicUrl(path)
    }

    private fun randomFileName(): String {
        val chars = "abcdefghijklmnopqrstuvwxyz0123456789"
        return (1..13).map { chars[Random.nextInt(chars.length)] }.joinToString("")
    }
}
