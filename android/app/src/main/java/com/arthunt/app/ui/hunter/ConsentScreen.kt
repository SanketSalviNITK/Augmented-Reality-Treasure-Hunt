package com.arthunt.app.ui.hunter

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/**
 * Informed-consent gate; must be resolved before any database write -- ports
 * `requireConsent` and the `#consent-overlay` copy from `index.html` 1:1
 * (research study consent form).
 */
@Composable
fun ConsentScreen(
    state: HunterScreenState.Consent,
    onAgree: () -> Unit,
    onDecline: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
        Text("Informed Consent Form", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Text(
            "Before joining \"${state.eventName}\": please read the following information carefully before " +
                "participating in this academic behavioral research study.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 8.dp, bottom = 16.dp),
        )

        Card(modifier = Modifier.fillMaxWidth().weight(1f)) {
            Column(modifier = Modifier.verticalScroll(rememberScrollState()).padding(16.dp)) {
                ConsentSection(
                    title = "1. Purpose of the Study",
                    body = "This study evaluates the effectiveness and spatial usability of the ARTHunt " +
                        "Web-based Augmented Reality (WebAR) framework for spatial learning and real-time " +
                        "visual telemetry.",
                )
                ConsentSection(
                    title = "2. Data Collection (IRB Protocol)",
                    body = "During your participation, the application will collect: (a) Quest elapsed " +
                        "durations and completion timestamps, (b) Spatial tracking telemetry, (c) Exit " +
                        "survey ratings, and (d) Background webcam photos captured during marker scans " +
                        "(\"Silent Dashcam\") to analyze mixed-reality visual context, and (e) Periodic " +
                        "network-quality, battery, and approximate-location samples during the hunt " +
                        "(location only if you have already granted your browser location permission).",
                )
                ConsentSection(
                    title = "3. Confidentiality & Anonymization",
                    body = "Your personal identifiers are fully protected. Under anonymization mode, no " +
                        "real names will be linked to database records. Telemetry logs will only be " +
                        "shared in an aggregated, anonymous format for academic publication.",
                )
                ConsentSection(
                    title = "4. Voluntary Participation",
                    body = "Your participation is completely voluntary. You have the right to withdraw " +
                        "from the study at any time by closing the app without penalty.",
                    lastSection = true,
                )
            }
        }

        Row(modifier = Modifier.fillMaxWidth().padding(top = 20.dp)) {
            OutlinedButton(onClick = onDecline, modifier = Modifier.weight(1f)) { Text("Decline") }
            Button(onClick = onAgree, modifier = Modifier.weight(1f).padding(start = 12.dp)) { Text("I Consent & Agree") }
        }
    }
}

@Composable
private fun ConsentSection(title: String, body: String, lastSection: Boolean = false) {
    Text(title, style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)
    Text(
        body,
        style = MaterialTheme.typography.bodySmall,
        modifier = Modifier.padding(top = 4.dp, bottom = if (lastSection) 0.dp else 12.dp),
    )
}
