package com.arthunt.app.ui.hunter

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.arthunt.app.ui.theme.ArtCyan
import com.arthunt.app.ui.theme.ArtEmerald

/** Post-hunt leaderboard (`renderPostHuntLeaderboard`): found/hints/score for this hunter, "(you)" highlighted, plus everyone else's standing. */
@Composable
fun ResultsScreen(
    state: HunterScreenState.Results,
    onRefresh: () -> Unit,
    onContinue: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
        Text(state.eventName, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Text("Hunt complete", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 4.dp))

        Card(modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                StatColumn(label = "Found", value = "${state.found}/${state.total}")
                StatColumn(label = "Hints used", value = "${state.hintsUsed}")
                StatColumn(label = "Score", value = "${state.score}", highlight = true)
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text("Leaderboard", style = MaterialTheme.typography.titleMedium)
            TextButton(onClick = onRefresh) { Text("Refresh") }
        }

        LazyColumn(modifier = Modifier.fillMaxWidth().weight(1f).padding(top = 8.dp)) {
            items(state.leaderboard, key = { it.rank }) { entry -> LeaderboardRow(entry) }
        }

        Button(onClick = onContinue, modifier = Modifier.fillMaxWidth().padding(top = 16.dp)) {
            Text("Continue")
        }
    }
}

@Composable
private fun StatColumn(label: String, value: String, highlight: Boolean = false) {
    Column {
        Text(
            value,
            style = MaterialTheme.typography.headlineSmall,
            color = if (highlight) ArtCyan else MaterialTheme.colorScheme.onSurface,
            fontWeight = FontWeight.Bold,
        )
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun LeaderboardRow(entry: LeaderboardEntry) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Row {
            Text(
                "#${entry.rank}",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Bold,
                color = if (entry.rank <= 3) ArtEmerald else MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(end = 12.dp),
            )
            Column {
                Text(
                    if (entry.isMe) "${entry.name} (you)" else entry.name,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = if (entry.isMe) FontWeight.Bold else FontWeight.Normal,
                    color = if (entry.isMe) ArtCyan else MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    "Found: ${entry.found}/${entry.total}${if (entry.finished) " • finished" else ""}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        Text("${entry.score}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
    }
}
