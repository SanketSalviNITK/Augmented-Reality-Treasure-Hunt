package com.arthunt.core.repo

/**
 * Uploads to the `ar-assets` Storage bucket (folders: `markers/`, `models/`,
 * `live-photos/`, `floorplans/`, `compiled/` -- see `docs/ANDROID_ARCHITECTURE.md`
 * §3). Files get a random name, matching the web's `uploadFile`.
 */
interface StorageRepository {
    /** Uploads [bytes] into [folder] and returns the file's public URL. */
    suspend fun upload(bytes: ByteArray, folder: String, fileExtension: String): String
}
