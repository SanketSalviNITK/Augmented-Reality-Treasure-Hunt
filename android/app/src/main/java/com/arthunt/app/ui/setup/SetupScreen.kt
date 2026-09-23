package com.arthunt.app.ui.setup

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/**
 * Connect to a Supabase project, or skip straight to Demo mode (fake
 * in-memory repositories -- see docs/ANDROID_ARCHITECTURE.md §6). Shown at
 * startup whenever [com.arthunt.core.config.AppConfig.needsSetup] is true.
 */
@Composable
fun SetupScreen(
    onSave: (url: String, anonKey: String) -> Unit,
    onUseDemoMode: () -> Unit,
) {
    var url by remember { mutableStateOf("") }
    var anonKey by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("ARTHunt", style = MaterialTheme.typography.headlineMedium)
        Text(
            "Connect to your Supabase project to get started.",
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.padding(top = 8.dp, bottom = 24.dp),
        )

        OutlinedTextField(
            value = url,
            onValueChange = { url = it },
            label = { Text("Supabase URL") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = anonKey,
            onValueChange = { anonKey = it },
            label = { Text("Supabase anon key") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
        )

        Button(
            onClick = { onSave(url, anonKey) },
            enabled = url.isNotBlank() && anonKey.isNotBlank(),
            modifier = Modifier.fillMaxWidth().padding(top = 20.dp),
        ) {
            Text("Save")
        }

        OutlinedButton(
            onClick = onUseDemoMode,
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
        ) {
            Text("Try Demo Mode")
        }
    }
}
