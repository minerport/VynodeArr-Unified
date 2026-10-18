package com.vynode.companion

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.foundation.ScrollState
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import org.json.JSONObject

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun LibraryDetailScreen(model: CompanionModel, scroll: ScrollState) {
    Column(Modifier.fillMaxSize()) {
        val back = remember { FocusRequester() }
        LaunchedEffect(Unit) { back.requestFocus() }
        val item = model.librarySelected
        val seasons = item?.optJSONArray("seasons")?.objects().orEmpty().sortedBy { it.optInt("seasonNumber") }
        var season by remember(item) { mutableStateOf(seasons.firstOrNull()?.optInt("seasonNumber") ?: 1) }
        var episodeFilter by remember(item) { mutableStateOf("all") }
        LaunchedEffect(season, episodeFilter) { scroll.scrollTo(0) }
        FlowRow(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Action("Back to library", modifier = Modifier.focusRequester(back)) { model.libraryBack() }
            if (seasons.isNotEmpty()) {
                BrowseChoice("Season", if (season == 0) "Specials" else season.toString(), seasons.map { it.optInt("seasonNumber").toString() to if (it.optInt("seasonNumber") == 0) "Specials" else "Season " + it.optInt("seasonNumber") }) { season = it.toInt() }
                BrowseChoice("Episodes", episodeFilter.replaceFirstChar { it.uppercase() }, listOf("all" to "All", "available" to "Available", "missing" to "Missing")) { episodeFilter = it }
            }
        }
        if (item != null) Column(Modifier.verticalScroll(scroll), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(18.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                AsyncImage(model.posterArtwork(LocalContext.current, item), null, imageLoader = model.artworkLoader, contentScale = ContentScale.Fit, modifier = Modifier.width(90.dp).height(135.dp).clip(RoundedCornerShape(8.dp)))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(item.text("title"), style = PageTitle.copy(fontSize = 24.sp, lineHeight = 28.sp))
                    Text(listOf(item.text("year"), item.text("state"), item.text("quality")).filter { it.isNotBlank() }.joinToString(" · "), style = Caption, color = Mint)
                }
            }
            Text("Synopsis", style = SectionTitle.copy(fontSize = 15.sp))
            Text(item.text("overview").ifBlank { "No synopsis available." }, style = Reading.copy(fontSize = 13.sp, lineHeight = 19.sp))
            Text("Library information", style = SectionTitle.copy(fontSize = 15.sp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            for ((label, key) in listOf("Monitoring" to "monitoring", "Quality profile" to "qualityProfile", "Runtime (minutes)" to "runtimeMinutes", "Episodes" to "episodeProgress", "Seasons" to "seasonProgress", "Network" to "network", "Status" to "status")) {
                item.text(key).takeIf { it.isNotBlank() }?.let { Text("$label: $it", style = Caption, modifier = Modifier.widthIn(min = 200.dp, max = 300.dp)) }
            }
            }
            item.optJSONArray("genres")?.let { Text((0 until it.length()).joinToString(" · ") { index -> it.optString(index) }) }
            if (model.libraryKind == "tv") {
                val selectedSeason = seasons.firstOrNull { it.optInt("seasonNumber") == season }
                val episodes = selectedSeason?.optJSONArray("episodes")?.objects().orEmpty().filter { episodeFilter == "all" || (episodeFilter == "available") == it.optBoolean("hasFile") }
                Text(if (season == 0) "Specials" else "Season $season", style = SectionTitle)
                selectedSeason?.let { Text(it.optInt("episodeFileCount").toString() + " / " + it.optInt("episodeCount") + " episodes available", style = Caption, color = Muted) }
                if (episodes.isEmpty()) Text("No episodes for this selection.", style = Reading, color = Muted)
                episodes.forEach { episode ->
                    Column(Modifier.fillMaxWidth().glassPanel().padding(14.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        Text("E" + episode.optInt("episodeNumber").toString().padStart(2, '0') + "  ·  " + episode.text("title"), style = PosterTitle)
                        Text(listOf(episode.text("airDateUtc").take(10), if (episode.optBoolean("hasFile")) "Available" else "Missing", episode.text("quality"), if (episode.optBoolean("monitored")) "Monitored" else "Unmonitored").filter { it.isNotBlank() }.joinToString("  ·  "), style = Caption, color = Muted)
                        episode.text("overview").takeIf { it.isNotBlank() }?.let { Text(it, style = Reading) }
                    }
                }
            }
        }
    }
}

@Composable
internal fun ColumnScope.ServiceScreen(model: CompanionModel, scroll: ScrollState) {
    val title = when (model.screen) { "calendar" -> "Calendar"; "activity" -> "Download activity"; "dashboard" -> "Overview"; else -> "Your account" }
    Row(Modifier.padding(top = 12.dp, bottom = 24.dp)) { Text(title, style = PageTitle, modifier = Modifier.weight(1f)); Action("Refresh", !model.busy) { model.section(model.screen) } }
    if (model.screen == "account") {
        Column(Modifier.verticalScroll(scroll), verticalArrangement = Arrangement.spacedBy(18.dp)) {
            Text(model.displayName, style = SectionTitle)
            Text(if (model.administrator) "Administrator" else "User", color = Mint)
            Text("Connected to ${model.server}", color = Muted)
            Text("Allowed pages: " + listOf("dashboard", "discover", "movies", "tv", "calendar").filter(model::allowed).joinToString(", ").ifBlank { "None assigned" })
            if (model.allowed("discover")) {
                Text(if (model.user.optBoolean("requestApprovalRequired")) "Your requests require administrator approval." else "Your requests do not require approval.")
                val limits = model.user.optJSONObject("requestLimits")
                if (limits?.optBoolean("enabled") == true) Text("Request limits (${limits.text("period")}): movies ${limits.text("movie").ifBlank { "unlimited" }}, TV ${limits.text("tv").ifBlank { "unlimited" }}, pending ${limits.text("maxPending").ifBlank { "unlimited" }}")
            }
            Text("Library management and server settings are available in the web app according to your account permissions.", color = Muted)
        }
    } else if (model.screen == "dashboard") {
        OverviewContent(model, scroll)
    } else {
        if (!model.busy && model.records.isEmpty()) Text(if (model.screen == "calendar") "No calendar entries to show." else "No active downloads.")
        Column(Modifier.weight(1f).verticalScroll(scroll), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            model.records.forEach { row ->
                Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(row.text("title"), style = SectionTitle)
                    Text(listOf(row.text("dateUtc"), row.text("context"), row.text("status"), row.text("eventType")).filter { it.isNotBlank() }.joinToString(" · "), color = Muted)
                    if (model.screen == "activity" && row.has("progress")) LinearProgressIndicator(progress = { (row.optInt("progress") / 100f).coerceIn(0f, 1f) }, modifier = Modifier.fillMaxWidth(), color = Mint)
                    if (model.screen == "activity" && row.has("progress")) Text("${row.optInt("progress")}%")
                }
            }
        }
    }
}
