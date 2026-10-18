package com.vynode.companion

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.ui.focus.*
import androidx.compose.ui.input.key.*
import kotlin.math.roundToInt
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

internal val browseViews = listOf("poster" to "Poster grid", "cards" to "Information cards", "compact" to "Compact grid", "list" to "Detailed list")

@Composable
internal fun BrowseChoice(label: String, value: String, choices: List<Pair<String, String>>, enabled: Boolean = true, onSelect: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        Action("$label · $value", enabled, compact = true) { expanded = true }
        DropdownMenu(expanded, { expanded = false }) {
            choices.forEach { (key, title) -> DropdownMenuItem(text = { Text(title) }, onClick = { expanded = false; onSelect(key) }) }
        }
    }
}

// Keep every letter focusable, including empty groups. Selection never substitutes a nearby letter.
@Composable
internal fun AlphabetRail(selected: String, enabled: Boolean, tv: Boolean, entry: FocusRequester, navigation: FocusRequester, onTitles: () -> Unit, onSelect: (String) -> Unit) {
    val letters = remember { listOf("#") + ('A'..'Z').map { it.toString() } }
    var position by remember(selected) { mutableFloatStateOf(letters.indexOf(selected).coerceAtLeast(0).toFloat()) }
    Column {
        Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
            if (tv) {
                Action("A–Z · " + letters[position.roundToInt()], enabled, compact = true,
                    modifier = Modifier.focusRequester(entry).semantics { contentDescription = "Alphabet selector" }.onPreviewKeyEvent { event ->
                        if (event.type != KeyEventType.KeyDown) false else when (event.key) {
                            Key.DirectionRight -> { position = (position + 1).coerceAtMost(26f); true }
                            Key.DirectionLeft -> { if (position == 0f) navigation.requestFocus() else position--; true }
                            Key.DirectionDown -> { onTitles(); true }
                            else -> false
                        }
                    }) { onSelect(letters[position.roundToInt()]) }
                Text("← → choose   ·   OK jump   ·   ↓ titles", style = Caption, color = Muted)
            } else {
                Text("A–Z", style = Caption, color = Muted)
                Slider(position, { position = it }, valueRange = 0f..26f, steps = 25, enabled = enabled,
                    onValueChangeFinished = { onSelect(letters[position.roundToInt().coerceIn(0,26)]) },
                    modifier = Modifier.weight(1f).height(28.dp).padding(horizontal = 12.dp).semantics { contentDescription = "Alphabet slider" },
                    colors = SliderDefaults.colors(thumbColor = Mint, activeTrackColor = Mint.copy(alpha = .5f), inactiveTrackColor = Muted.copy(alpha = .15f)))
                Text(letters[position.roundToInt().coerceIn(0,26)], style = Caption)
            }
        }
        Row(Modifier.semantics { contentDescription = "Alphabet letters" }.fillMaxWidth().glassPanel().horizontalScroll(rememberScrollState()).padding(horizontal = 6.dp), horizontalArrangement = Arrangement.spacedBy(1.dp)) {
            letters.forEach { letter ->
                Action(letter, enabled, compact = true, selected = selected == letter,
                    modifier = Modifier.semantics { contentDescription = "Jump to $letter" }.then(if (tv) Modifier.focusProperties { up = entry }.onPreviewKeyEvent { event ->
                        if (event.type == KeyEventType.KeyDown && event.key == Key.DirectionDown) { onTitles(); true } else false
                    } else Modifier)) { onSelect(letter) }
            }
        }
    }
}
