package com.vynode.companion

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.ui.platform.LocalContext
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.key.*
import kotlinx.coroutines.launch
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun ColumnScope.HomeScreen(model: CompanionModel, tv: Boolean, onBackdrop: (Media?) -> Unit) {
    val view = model.discoverView
    val wallState = rememberLazyListState()
    LaunchedEffect(model.feed, model.query, model.busy) { if (!model.busy) { withFrameNanos { }; wallState.scrollToItem(0) } }
    var search by rememberSaveable { mutableStateOf(model.query) }
    var searchOpen by rememberSaveable { mutableStateOf(false) }
    var highlighted by remember { mutableStateOf<Media?>(null) }
    val featured = highlighted?.takeIf { candidate -> model.items.any { it.id == candidate.id && it.domain == candidate.domain } } ?: model.items.firstOrNull()
    LaunchedEffect(featured) { onBackdrop(featured) }
    val heading = if (model.query.isNotBlank()) "Results for “${model.query}”" else when (model.feed) {
        "popular_movies" -> "Popular movies"; "popular_tv" -> "Popular shows"; "upcoming_movies" -> "Coming soon"; else -> "Trending now"
    }
    FlowRow(Modifier.fillMaxWidth().padding(bottom = 8.dp).glassPanel().padding(horizontal = 4.dp), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        Action("Trending", !model.busy, compact = true, selected = model.feed == "trending" && model.query.isBlank()) { highlighted = null; model.browse("trending") }
        Action("Movies", !model.busy, compact = true, selected = model.feed == "popular_movies" && model.query.isBlank()) { highlighted = null; model.browse("popular_movies", type = "movie") }
        Action("Shows", !model.busy, compact = true, selected = model.feed == "popular_tv" && model.query.isBlank()) { highlighted = null; model.browse("popular_tv", type = "tv") }
        Action("Coming soon", !model.busy, compact = true, selected = model.feed == "upcoming_movies" && model.query.isBlank()) { highlighted = null; model.browse("upcoming_movies", type = "movie") }
        BrowseChoice("View", (listOf("shelves" to "Shelves") + browseViews).first { it.first == view }.second, listOf("shelves" to "Shelves") + browseViews) { model.discoverView = it }
        Action("Search", !model.busy, compact = true, selected = searchOpen) { searchOpen = !searchOpen }
    }
    if (searchOpen) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(search, { search = it }, shape = RoundedCornerShape(12.dp), label = { Text("Search movies or shows") }, singleLine = true, modifier = Modifier.weight(1f), keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search), keyboardActions = KeyboardActions(onSearch = { if (!model.busy) { highlighted = null; model.browse(text = search) } }))
            Action("Find", !model.busy && search.isNotBlank()) { highlighted = null; model.browse(text = search) }
        }
        FlowRow {
            Action("Search movies", !model.busy, selected = model.domain == "movie") { model.browse(text = search, type = "movie") }
            Action("Search shows", !model.busy, selected = model.domain == "tv") { model.browse(text = search, type = "tv") }
        }
    }
    Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(22.dp)) {
    if (view != "shelves") DiscoverGrid(model, view, tv, Modifier.weight(1f)) { highlighted = it }
    else LazyColumn(Modifier.weight(1f), state = wallState, verticalArrangement = Arrangement.spacedBy(if (tv) 10.dp else 18.dp), contentPadding = PaddingValues(bottom = 24.dp)) {
        if (!tv) item(key = "feature") {
            if (featured != null) {
                Box(Modifier.fillMaxWidth().height(if (tv) 150.dp else 250.dp)) {
                    AsyncImage(featured.backdrop.ifBlank { featured.poster }.takeIf { it.startsWith("https://") }, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                    Box(Modifier.fillMaxSize().background(Brush.horizontalGradient(listOf(Night.copy(alpha = .96f), Night.copy(alpha = .70f), Color.Transparent))))
                    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent, Night.copy(alpha = .9f)))))
                    Column(Modifier.align(Alignment.BottomStart).widthIn(max = if (tv) 510.dp else 360.dp).padding(if (tv) 12.dp else 18.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text("IN THE SPOTLIGHT", color = Mint, fontSize = 10.sp, lineHeight = 12.sp, letterSpacing = 2.sp, fontWeight = FontWeight.Bold)
                        Text(featured.title, fontSize = if (tv) 26.sp else 29.sp, lineHeight = 32.sp, fontWeight = FontWeight.Bold, maxLines = if (tv) 1 else 2, overflow = TextOverflow.Ellipsis)
                        Text(listOf(featured.year, if (featured.domain == "tv") "Series" else "Movie", featured.rating.takeIf { it.isNotBlank() }?.let { "★ $it" }.orEmpty()).filter { it.isNotBlank() }.joinToString("  ·  "), color = Color(0xFFCAD4DF), fontSize = 12.sp, lineHeight = 14.sp)
                        if (!tv) Text(featured.overview, color = Muted, fontSize = 13.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                        Action("Explore title", !model.busy, primary = true) { model.open(featured) }
                    }
                }
            } else if (!model.busy) Text("No titles to show. Try another search.", modifier = Modifier.padding(24.dp))
        }
        val rows = model.items.chunked(12)
        items(rows.size, key = { "wall-$it" }) { row ->
            val rowItems = rows[row]
            val rowState = rememberLazyListState()
            val scope = rememberCoroutineScope()
            val requesters = remember(rowItems.map { "${it.domain}:${it.id}" }) { List(rowItems.size) { FocusRequester() } }
            fun focusTitle(index: Int) {
                val target = index.coerceIn(rowItems.indices)
                scope.launch {
                    val visible = rowState.layoutInfo.visibleItemsInfo.any { it.index == target && it.offset >= 0 && it.offset + it.size <= rowState.layoutInfo.viewportEndOffset }
                    if (!visible) rowState.scrollToItem(if (tv && target > rowState.firstVisibleItemIndex) (target - 3).coerceAtLeast(0) else target)
                    withFrameNanos { }
                    requesters[target].requestFocus()
                }
            }
            Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text(if (row == 0) heading else if (row == 1) "More to explore" else "Keep exploring", modifier = Modifier.weight(1f), style = SectionTitle)
                    Row {
                        Action("‹", !model.busy, modifier = Modifier.semantics { contentDescription = "Previous titles" }, compact = true) { focusTitle(rowState.firstVisibleItemIndex - 4) }
                        Action("Browse", !model.busy, compact = true) { focusTitle(rowState.firstVisibleItemIndex) }
                        Action("›", !model.busy, modifier = Modifier.semantics { contentDescription = "Next titles" }, compact = true) { focusTitle(rowState.firstVisibleItemIndex + 4) }
                    }
                }
                LazyRow(state = rowState, horizontalArrangement = Arrangement.spacedBy(10.dp), contentPadding = PaddingValues(horizontal = 3.dp, vertical = 4.dp)) {
                    items(rows[row], key = { "${it.domain}:${it.id}" }) { item ->
                        val index = rowItems.indexOf(item)
                        val navigation = Modifier.focusRequester(requesters[index]).onPreviewKeyEvent { event ->
                            if (tv && event.type == KeyEventType.KeyDown && event.key in listOf(Key.DirectionLeft, Key.DirectionRight) && !(event.key == Key.DirectionLeft && index == 0) && !(event.key == Key.DirectionRight && index == rowItems.lastIndex)) {
                                focusTitle(index + if (event.key == Key.DirectionRight) 1 else -1); true
                            } else false
                        }
                        WallTile(model, item, tv, !model.busy, model.presence["${item.domain}:${item.id}"], { highlighted = item }, navigation) { model.open(item) }
                    }
                }
            }
        }
        item(key = "more") {
            Row {
                if (model.page < model.totalPages) Action("Load more", !model.busy) { model.more() }
                Action("Refresh", !model.busy) { model.browse(model.feed, model.query, model.domain) }
            }
        }
    }
    if (tv && view == "shelves" && featured != null) TitlePreview(
        title = featured.title,
        metadata = listOf(featured.year, if (featured.domain == "tv") "Series" else "Movie", featured.rating.takeIf { it.isNotBlank() }?.let { "★ $it" }.orEmpty()).filter { it.isNotBlank() }.joinToString("  ·  "),
        overview = featured.overview,
        status = when (model.presence[featured.domain + ":" + featured.id]) { "available" -> "In your library"; "requested" -> "Requested"; else -> "See details for availability and requests" },
        action = "Explore title", enabled = !model.busy
    ) { model.open(featured) }

    }

}

@Composable
private fun WallTile(model: CompanionModel, item: Media, tv: Boolean, enabled: Boolean, presence: String?, onFocus: () -> Unit, modifier: Modifier = Modifier, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    var artworkLoaded by remember(item.backdrop, item.poster) { mutableStateOf(false) }
    var artworkFailed by remember(item.backdrop, item.poster) { mutableStateOf(false) }
    val scale by animateFloatAsState(if (focused) 1.025f else 1f, animationSpec = tween(180), label = "poster focus")
    Surface(onClick = onClick, enabled = enabled, color = Color.Transparent, shape = RoundedCornerShape(8.dp), border = if (focused) BorderStroke(2.dp, Mint) else null, modifier = modifier.width(if (tv) 108.dp else 150.dp).graphicsLayer { scaleX = scale; scaleY = scale }.onFocusChanged { focused = it.isFocused; if (it.isFocused) onFocus() }) {
        Column {
        Box(Modifier.fillMaxWidth().aspectRatio(2f / 3f)) {
            AsyncImage(if (artworkFailed) item.poster.ifBlank { item.backdrop }.takeIf { it.startsWith("https://") } else model.discoverArtwork(LocalContext.current, item) ?: item.poster.ifBlank { item.backdrop }.takeIf { it.startsWith("https://") }, imageLoader = if (model.discoverArtwork(LocalContext.current, item) != null && !artworkFailed) model.artworkLoader else coil.Coil.imageLoader(LocalContext.current), filterQuality = androidx.compose.ui.graphics.FilterQuality.High, contentDescription = if (artworkLoaded) "${item.title} artwork" else null, onSuccess = { artworkLoaded = true }, onError = { artworkFailed = true }, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())

            if (presence != null) Text(if (presence == "available") "IN LIBRARY" else "REQUESTED", color = Mint, fontSize = 8.sp, modifier = Modifier.align(Alignment.TopEnd).padding(8.dp).background(Night.copy(alpha = .85f), RoundedCornerShape(4.dp)).padding(horizontal = 6.dp, vertical = 3.dp))
        }
            Column(Modifier.padding(top = 5.dp, start = 2.dp, end = 2.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(item.title, color = Color.White, style = PosterTitle.copy(fontSize = if (tv) 13.sp else 15.sp), maxLines = 2, overflow = TextOverflow.Ellipsis)
                Text(listOf(item.year, item.rating.takeIf { it.isNotBlank() }?.let { "★ $it" }.orEmpty()).filter { it.isNotBlank() }.joinToString(" · "), style = Caption, color = Muted)
            }
        }
    }
}
