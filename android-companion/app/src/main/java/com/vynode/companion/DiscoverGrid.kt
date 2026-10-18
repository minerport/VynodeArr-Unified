package com.vynode.companion

import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.*
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage

@Composable
internal fun DiscoverGrid(model: CompanionModel, view: String, tv: Boolean, modifier: Modifier, onFocus: (Media) -> Unit) {
    val state = rememberLazyGridState()
    LaunchedEffect(model.feed, model.query, view) { state.scrollToItem(0) }
    LazyVerticalGrid(if (view == "list") GridCells.Fixed(1) else GridCells.Adaptive(when (view) { "cards" -> 300.dp; "compact" -> 220.dp; else -> if (tv) 125.dp else 135.dp }), modifier, state = state,
        contentPadding = PaddingValues(6.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        items(model.items, key = { it.domain + it.id }) { item ->
            var focused by remember { mutableStateOf(false) }
            var failed by remember(item) { mutableStateOf(false) }
            val scale by animateFloatAsState(if (focused) 1.025f else 1f, tween(180), label = "discover focus")
            val art: @Composable (Modifier) -> Unit = { artModifier ->
                AsyncImage(if (failed) item.poster.takeIf { it.startsWith("https://") } else model.discoverArtwork(LocalContext.current, item) ?: item.poster.takeIf { it.startsWith("https://") },
                    item.title + " poster", imageLoader = if (model.discoverArtwork(LocalContext.current, item) != null && !failed) model.artworkLoader else coil.Coil.imageLoader(LocalContext.current), onError = { failed = true }, contentScale = ContentScale.Crop,
                    filterQuality = FilterQuality.High, modifier = artModifier.clip(RoundedCornerShape(8.dp)))
            }
            val info: @Composable () -> Unit = {
                Text(item.title, style = PosterTitle, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Text(listOf(item.year, if (item.domain == "tv") "Series" else "Movie", item.rating.takeIf { it.isNotBlank() }?.let { "★ $it" }.orEmpty()).filter { it.isNotBlank() }.joinToString(" · "), style = Caption, color = Muted)
                model.presence[item.domain + ":" + item.id]?.let { Text(if (it == "available") "In library" else "Requested", style = Caption, color = Mint) }
                if (view == "cards") Text(item.overview, style = Reading, color = Muted, maxLines = 3, overflow = TextOverflow.Ellipsis)
            }
            Surface(onClick = { model.open(item) }, enabled = !model.busy, color = Color.Transparent, shape = RoundedCornerShape(10.dp),
                border = if (focused) BorderStroke(1.dp, Mint) else null,
                modifier = Modifier.graphicsLayer { scaleX = scale; scaleY = scale }.onFocusChanged { focused = it.hasFocus; if (it.hasFocus) onFocus(item) }) {
                if (view == "poster") Column {
                    art(Modifier.fillMaxWidth().aspectRatio(2f / 3f))
                    Column(Modifier.padding(top = 5.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) { info() }
                } else Row(Modifier.fillMaxWidth().glassPanel().padding(10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    art(Modifier.width(if (view == "list") 46.dp else if (view == "compact") 62.dp else 90.dp).aspectRatio(2f / 3f))
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) { info() }
                }
            }
        }
        item(span = { GridItemSpan(maxLineSpan) }) {
            Row {
                if (model.page < model.totalPages) Action("Load more", !model.busy) { model.more() }
                Action("Refresh", !model.busy) { model.browse(model.feed, model.query, model.domain) }
            }
        }
    }
}
