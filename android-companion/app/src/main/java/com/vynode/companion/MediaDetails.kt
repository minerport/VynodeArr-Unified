package com.vynode.companion

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.ui.input.key.*
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import kotlinx.coroutines.launch
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import org.json.JSONObject

private fun JSONObject.strings(key: String): List<String> = optJSONArray(key)?.let { array -> (0 until array.length()).map { array.optString(it) }.filter { it.isNotBlank() && it != "null" } }.orEmpty()

@Composable
private fun DetailArtwork(primary: String, fallback: String, description: String?, modifier: Modifier, poster: Boolean = false) {
    var failed by remember(primary, fallback) { mutableStateOf(false) }
    var loaded by remember(primary, fallback) { mutableStateOf(false) }
    Box(modifier.background(Color(0xFF172331)), contentAlignment = Alignment.Center) {
        if (primary.isBlank() && fallback.isBlank()) Text("No artwork", color = Muted, fontSize = 12.sp)
        AsyncImage((if (failed) fallback else primary.ifBlank { fallback }).takeIf { it.startsWith("https://") }, contentDescription = if (loaded) description else null, onSuccess = { loaded = true }, onError = { failed = true }, contentScale = if (poster || failed) ContentScale.Fit else ContentScale.Crop, modifier = Modifier.fillMaxSize())
    }
}

@Composable
private fun DetailBlock(title: String, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(title, style = SectionTitle.copy(fontSize = 15.sp, lineHeight = 19.sp))
        content()
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun DetailScreen(model: CompanionModel, tv: Boolean, onTrailer: (String, String) -> Unit) {
    val item = model.selected ?: return
    val detail = model.details
    val context = LocalContext.current
    val trailer = detail?.optJSONObject("trailer")?.text("url").orEmpty()
    val scroll = key(item.domain, item.id) { rememberScrollState() }
    val initialFocus = remember { FocusRequester() }
    val scope = rememberCoroutineScope()
    LaunchedEffect(item.domain, item.id) {
        scroll.scrollTo(0)
        if (tv) initialFocus.requestFocus()
    }
    Column(Modifier.fillMaxSize().onPreviewKeyEvent { event ->
        if (tv && event.key in listOf(Key.DirectionDown, Key.DirectionUp)) {
            if (event.type == KeyEventType.KeyDown) scope.launch {
                scroll.scrollBy(if (event.key == Key.DirectionDown) 100f else -100f)
            }
            true
        } else false
    }) {
        FlowRow {
            Action("Back", modifier = Modifier.focusRequester(initialFocus)) { model.back() }
            if (trailer.startsWith("https://")) Action("Watch trailer", !model.busy, primary = true) { onTrailer(item.title, trailer) }
            val tracked = model.presence["${item.domain}:${item.id}"] != null
            Action(if (tracked) "Request to another destination" else "Request ${if (item.domain == "movie") "movie" else "series"}", !model.busy && detail != null) { model.prepareRequest() }
            if (detail == null && !model.busy) Action("Retry details") { model.open(item) }
        }
        if (tv) Text("↑ ↓ Scroll page · ← → Choose action", color = Muted, fontSize = 11.sp, modifier = Modifier.padding(bottom = 8.dp))
        Column(Modifier.weight(1f).fillMaxWidth().testTag("detail-page").verticalScroll(scroll), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        DetailHero(item, detail, tv)
        model.presence["${item.domain}:${item.id}"]?.let { Text(if (it == "available") "In your library" else "Already tracked by your library", color = Mint) }
        val synopsis: @Composable () -> Unit = {
            DetailBlock("Synopsis") {
                detail?.text("tagline")?.takeIf { it.isNotBlank() }?.let { Text(it, color = Mint, fontSize = 12.sp) }
                Text(detail?.text("overview").orEmpty().ifBlank { item.overview }.ifBlank { "No synopsis available." }, style = Reading.copy(fontSize = 13.sp, lineHeight = 19.sp))
            }
        }
        val facts = if (detail == null) emptyList() else listOf("Status" to detail.text("status"), "Original title" to detail.text("originalTitle"), "Language" to detail.text("originalLanguage").uppercase(), "Studio" to detail.text("studio"), "Network" to detail.text("network"), "Countries" to detail.strings("countries").joinToString(", "), "Production" to detail.strings("productionCompanies").joinToString(", ")).filter { it.second.isNotBlank() }
        val information: @Composable () -> Unit = {
            if (facts.isNotEmpty()) DetailBlock("About this title") {
                facts.forEach { (label, value) -> Text("$label: $value", style = Reading.copy(fontSize = 12.sp, lineHeight = 17.sp), color = Muted) }
            }
        }
        if (tv && facts.isNotEmpty()) Row(horizontalArrangement = Arrangement.spacedBy(28.dp)) {
            Column(Modifier.weight(1.7f)) { synopsis() }
            Column(Modifier.weight(1f)) { information() }
        } else { synopsis(); information() }
        if (detail != null) {
            val cast = detail.optJSONArray("cast")?.objects().orEmpty()
            if (cast.isNotEmpty()) {
                Text("Cast", style = SectionTitle.copy(fontSize = 15.sp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    cast.forEach { person ->
                        Row(Modifier.width(if (tv) 190.dp else 160.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (person.text("photo").isNotBlank()) DetailArtwork(person.text("photo"), "", null, Modifier.width(34.dp).height(48.dp).clip(RoundedCornerShape(6.dp)), poster = true)
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Text(person.text("name"), style = PosterTitle.copy(fontSize = 12.sp, lineHeight = 16.sp))
                                Text(person.text("character"), style = Caption, color = Muted)
                            }
                        }
                    }
                }
            }
            val seasons = detail.optJSONArray("seasons")?.objects().orEmpty()
            if (item.domain == "tv" && seasons.isNotEmpty()) DetailBlock("Seasons · ${seasons.size}") {
                seasons.forEach { season -> Text(listOf(season.text("name"), "${season.optInt("episodeCount")} episodes", season.text("airDate")).filter { it.isNotBlank() }.joinToString(" · "), fontSize = 12.sp, lineHeight = 17.sp) }
            }
            FlowRow {
                detail.optJSONArray("externalLinks")?.objects().orEmpty().filter { it.text("url").startsWith("https://") }.forEach { link -> Action(link.text("label")) { launchLink(context, link.text("url")) } }
            }
        }
        Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
internal fun DetailHero(item: Media, detail: JSONObject?, tv: Boolean) {
    val poster = detail?.text("poster").orEmpty().ifBlank { item.poster }
    val backdrop = detail?.text("backdrop").orEmpty().ifBlank { item.backdrop }
        Box(Modifier.fillMaxWidth().heightIn(min = 150.dp).testTag("detail-hero")) {
            Row(Modifier.align(Alignment.TopStart).padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(20.dp), verticalAlignment = Alignment.CenterVertically) {
                DetailArtwork(poster, "", "${item.title} poster", Modifier.testTag("detail-poster").width(if (tv) 90.dp else 76.dp).aspectRatio(2f / 3f).clip(RoundedCornerShape(10.dp)), poster = true)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(if (item.domain == "tv") "SERIES" else "MOVIE", color = Mint, fontSize = 11.sp, letterSpacing = 2.sp)
                    Text(item.title, style = PageTitle.copy(fontSize = 24.sp, lineHeight = 28.sp))
                    Text(listOf(item.year, detail?.text("certification").orEmpty(), detail?.optInt("runtime", 0)?.takeIf { it > 0 }?.let { "$it min" }.orEmpty(), item.rating.takeIf { it.isNotBlank() }?.let { "★ $it / 10" }.orEmpty()).filter { it.isNotBlank() }.joinToString(" · "), color = Mint, fontSize = 12.sp)
                    val genres = detail?.strings("genres").orEmpty()
                    if (genres.isNotEmpty()) Text(genres.joinToString(" · "), color = Muted, fontSize = 12.sp)
                }
            }
        }
}
