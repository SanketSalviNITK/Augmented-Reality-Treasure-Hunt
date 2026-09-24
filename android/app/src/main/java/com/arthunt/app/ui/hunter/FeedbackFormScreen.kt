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
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

private data class Question(val key: String, val label: String)

private val QUESTIONS = listOf(
    Question("immersion", "How immersive did the AR experience feel?"),
    Question("usability", "How easy was the app to use?"),
    Question("engagement", "How engaging was the hunt?"),
    Question("stability", "How stable/reliable was AR tracking?"),
)

/**
 * Post-hunt research questionnaire: immersion/usability/engagement/stability,
 * 1-5 each, all required -- ports `#btn-submit-feedback` on the web.
 */
@Composable
fun FeedbackFormScreen(
    onSubmit: (immersion: Int, usability: Int, engagement: Int, stability: Int) -> Unit,
) {
    val ratings = remember { mutableStateOf(mapOf<String, Int>()) }
    var error by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp).verticalScroll(rememberScrollState()),
    ) {
        Text("One last thing…", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Text(
            "Help our research by rating your experience. Thank you for participating!",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 4.dp, bottom = 20.dp),
        )

        QUESTIONS.forEach { question ->
            Card(modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp)) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(question.label, style = MaterialTheme.typography.bodyLarge)
                    Row(modifier = Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                        for (value in 1..5) {
                            val selected = ratings.value[question.key] == value
                            RatingButton(
                                value = value,
                                selected = selected,
                                onClick = {
                                    ratings.value = ratings.value + (question.key to value)
                                    error = null
                                },
                            )
                        }
                    }
                }
            }
        }

        error?.let {
            Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(bottom = 12.dp))
        }

        Button(
            onClick = {
                val r = ratings.value
                if (QUESTIONS.all { r.containsKey(it.key) }) {
                    onSubmit(r.getValue("immersion"), r.getValue("usability"), r.getValue("engagement"), r.getValue("stability"))
                } else {
                    error = "Please rate all categories to submit your research data!"
                }
            },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Submit Feedback")
        }
    }
}

@Composable
private fun RatingButton(value: Int, selected: Boolean, onClick: () -> Unit) {
    if (selected) {
        FilledTonalButton(onClick = onClick) { Text("$value") }
    } else {
        OutlinedButton(onClick = onClick) { Text("$value") }
    }
}
