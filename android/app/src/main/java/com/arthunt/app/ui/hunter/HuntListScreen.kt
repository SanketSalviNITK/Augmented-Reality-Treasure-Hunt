package com.arthunt.app.ui.hunter

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.arthunt.core.model.EventRow

/** Browse joinable hunts: cards with name + marker count; empty/error/loading states; a refresh action. */
@Composable
fun HuntListScreen(
    state: HunterScreenState.Browse,
    onRefresh: () -> Unit,
    onJoin: (eventId: String) -> Unit,
    onBack: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text("Join a Hunt", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            TextButton(onClick = onRefresh) { Text(if (state.isRefreshing) "Refreshing…" else "Refresh") }
        }

        state.error?.let { message ->
            Card(modifier = Modifier.fillMaxWidth().padding(top = 12.dp)) {
                Text(
                    message,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(12.dp),
                )
            }
        }

        when {
            state.isRefreshing && state.events.isEmpty() -> Box(
                modifier = Modifier.fillMaxSize(),
            ) { CircularProgressIndicator(modifier = Modifier.align(Alignment.Center)) }

            state.events.isEmpty() -> Column(
                modifier = Modifier.fillMaxSize().padding(top = 40.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    "No active hunts right now.",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    "Ask your hunt's creator for the join link, or check back soon.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }

            else -> LazyColumn(modifier = Modifier.fillMaxSize().padding(top = 16.dp)) {
                items(state.events, key = { it.id }) { row -> HuntCard(row = row, onJoin = { onJoin(row.id) }) }
            }
        }

        TextButton(onClick = onBack, modifier = Modifier.padding(top = 12.dp)) { Text("Back to portal") }
    }
}

@Composable
private fun HuntCard(row: EventRow, onJoin: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Column {
                Text(row.data.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(
                    "${row.data.markers.size} markers",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            OutlinedButton(onClick = onJoin) { Text("Join") }
        }
    }
}
