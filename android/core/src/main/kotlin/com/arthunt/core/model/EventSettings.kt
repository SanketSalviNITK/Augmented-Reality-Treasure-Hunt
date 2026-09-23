package com.arthunt.core.model

import kotlinx.serialization.Serializable

/**
 * Research/framework settings, snapshotted onto the event at save time by the
 * creator (see `js/db.js#saveEventToDB` on the web) so hunters always run
 * under the settings the creator picked, not whatever a hunter's own client
 * happens to default to.
 *
 * Written as a whole object whenever the creator changes settings (there is
 * no partial-field mutation from Android in M0 — Android only reads and
 * applies these), so unlike [EventData]/[Marker]/[Player] it does not need
 * the raw-`JsonObject` round-trip wrapper: a plain `@Serializable` class with
 * `ignoreUnknownKeys` is enough, and its parent's raw object already keeps
 * this sub-object untouched whenever Android writes back a change to some
 * other field of the event.
 */
@Serializable
data class EventSettings(
    val silentDashcam: Boolean = true,
    val mandatoryConsent: Boolean = true,
    val anonymizeHunters: Boolean = false,
    val randomizedPathing: Boolean = true,
    val telemetryFrequency: Int = 1000,
)
