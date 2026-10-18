package com.vynode.companion

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.json.JSONObject
import java.text.NumberFormat

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun OverviewContent(model: CompanionModel, scroll: ScrollState) {
    val dashboard = model.dashboard ?: return
    val metrics = dashboard.optJSONObject("metrics") ?: JSONObject()
    val number = NumberFormat.getIntegerInstance()
    Column(Modifier.fillMaxSize().verticalScroll(scroll), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("Your library at a glance", style = SectionTitle)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            for ((label, key) in listOf("Movies" to "movies", "TV series" to "tv", "Downloading" to "downloading", "Queued" to "queue")) {
                Column(Modifier.widthIn(min = 145.dp).glassPanel().padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("$label: ${number.format(metrics.optLong(key))}", style = SectionTitle)
                    Text(when(key) { "movies" -> "In your collection"; "tv" -> "Series in your collection"; "downloading" -> "Transfers in progress"; else -> "Download queue" }, style = Caption, color = Muted)
                }
            }
        }
        Row(Modifier.fillMaxWidth().glassPanel().padding(18.dp), horizontalArrangement = Arrangement.spacedBy(20.dp)) {
            val bytes = metrics.optDouble("storage", 0.0)
            val storage = if(bytes >= 1099511627776.0) "%.1f TB".format(bytes / 1099511627776.0) else "%.1f GB".format(bytes / 1073741824.0)
            for ((value, label) in listOf(storage to "On disk", number.format(metrics.optLong("missing")) to "Missing movies / episodes", number.format(metrics.optLong("health")) to "Health notices")) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text(value, style = SectionTitle)
                    Text(label, style = Caption, color = Muted)
                }
            }
        }
        BoxWithConstraints(Modifier.fillMaxWidth()) {
        val feedWidth = if (maxWidth > 650.dp) (maxWidth - 28.dp) / 3 else maxWidth
        FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        OverviewFeed("Coming up", "${metrics.optInt("upcomingMovies")} movies · ${metrics.optInt("upcomingEpisodes")} episodes", dashboard.optJSONArray("upcoming")?.objects().orEmpty(), "No upcoming releases returned.", Modifier.width(feedWidth)) { row ->
            listOf(row.text("dateUtc").take(10), row.text("context"), if(row.text("domain") == "tv") "TV" else "Movie").filter { it.isNotBlank() }.joinToString(" · ")
        }
        OverviewFeed("Recently added", "Latest imports into your library", dashboard.optJSONArray("recentlyAdded")?.objects().orEmpty(), "No recent imports returned.", Modifier.width(feedWidth)) { row ->
            listOf(row.text("type"), row.text("timestamp").take(10), row.text("engineInstanceName")).filter { it.isNotBlank() }.joinToString(" · ")
        }
        OverviewFeed("Recent activity", "Latest events reported by your server", dashboard.optJSONArray("recentActivity")?.objects().orEmpty(), "No recent activity returned.", Modifier.width(feedWidth)) { row ->
            listOf(row.text("eventType").replace(Regex("([a-z])([A-Z])"), "$1 $2"), row.text("timestamp").take(10), row.text("engineInstanceName")).filter { it.isNotBlank() }.joinToString(" · ")
        }
        }
        }
    }
}

@Composable
private fun OverviewFeed(title: String, subtitle: String, rows: List<JSONObject>, empty: String, modifier: Modifier, context: (JSONObject) -> String) {
    Column(modifier.glassPanel().padding(18.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
        Text(title, style = SectionTitle)
        Text(subtitle, style = Caption, color = Muted)
        if (rows.isEmpty()) Text(empty, style = Reading, color = Muted)
        rows.forEachIndexed { index, row ->
            if(index > 0) HorizontalDivider(color = Mint.copy(alpha = .09f))
            Text(row.text("title").ifBlank { "Library event" }, style = PosterTitle)
            Text(context(row), style = Caption, color = Muted)
        }
    }
}
