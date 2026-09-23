package com.arthunt.app.ui.portal

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.arthunt.app.ui.theme.ArtCyan
import com.arthunt.app.ui.theme.ArtViolet

/** Landing screen after setup/demo mode: pick a role, same split as the web app's home screen. */
@Composable
fun PortalScreen(
    onCreatorStudio: () -> Unit,
    onStartQuest: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            "ARTHunt",
            style = MaterialTheme.typography.displaySmall,
            fontWeight = FontWeight.Bold,
        )
        Text(
            "Augmented reality treasure hunts",
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.padding(top = 4.dp, bottom = 40.dp),
        )

        Button(
            onClick = onCreatorStudio,
            colors = ButtonDefaults.buttonColors(containerColor = ArtViolet),
            modifier = Modifier.fillMaxWidth().height(64.dp),
        ) {
            Text("Creator Studio", style = MaterialTheme.typography.titleMedium)
        }

        Button(
            onClick = onStartQuest,
            colors = ButtonDefaults.buttonColors(containerColor = ArtCyan),
            modifier = Modifier.fillMaxWidth().height(64.dp).padding(top = 16.dp),
        ) {
            Text("Start Quest", style = MaterialTheme.typography.titleMedium)
        }
    }
}
