package com.vynode.companion

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.draw.clip
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.*
import androidx.compose.ui.input.key.*
import kotlinx.coroutines.launch
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import org.json.JSONObject

@Composable
private fun LibraryPoster(model: CompanionModel, item: JSONObject, view: String, tv: Boolean, navigation: Modifier = Modifier, onFocus: () -> Unit) {
    val compact = view == "compact"
    val horizontal = view != "poster"
    var failed by remember(item) { mutableStateOf(false) }
    var focused by remember { mutableStateOf(false) }
    val lift by animateFloatAsState(if (focused) 1.035f else 1f, animationSpec = tween(180), label = "floating-poster")
    Surface(onClick = { model.openLibrary(item) }, enabled = !model.busy,
        shape = RoundedCornerShape(8.dp), color = Color.Transparent,
        border = if (focused) BorderStroke(1.dp, Mint.copy(alpha = .8f)) else null,
        modifier = navigation.padding(4.dp).graphicsLayer { scaleX = lift; scaleY = lift; translationY = -((lift - 1f) / .035f) * 4f }.onFocusChanged { focused = it.hasFocus; if (it.hasFocus) onFocus() }) {
        val art: @Composable (Modifier) -> Unit = { artModifier ->
            Box(artModifier.clip(RoundedCornerShape(8.dp))) {
                AsyncImage(model.posterArtwork(LocalContext.current, item, failed), item.text("title") + " poster", imageLoader = model.artworkLoader,
                    onError = { failed = true }, contentScale = ContentScale.Crop, filterQuality = androidx.compose.ui.graphics.FilterQuality.High, modifier = Modifier.fillMaxSize())
            }
        }
        val info: @Composable () -> Unit = {
            Text(item.text("title"), style = PosterTitle.copy(fontSize = if (tv) 13.sp else 15.sp), maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(listOf(item.text("year"), item.text("quality"), item.text("episodeProgress")).filter { it.isNotBlank() }.joinToString(" · "), color = Muted, style = Caption, maxLines = 2, overflow = TextOverflow.Ellipsis)
            if (horizontal) {
                Text(listOf(item.text("state"), item.text("network"), if (item.text("monitoring") == "none") "Unmonitored" else "Monitored").filter { it.isNotBlank() }.joinToString(" · "), style = Caption, color = Mint)
                if (view == "cards") Text(item.text("overview").ifBlank { "Open for full details" }, style = Reading, maxLines = 3, overflow = TextOverflow.Ellipsis, color = Muted)
            }
        }
        if (horizontal) Row(Modifier.fillMaxWidth().glassPanel().padding(10.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            art(Modifier.width(if (view == "list") 46.dp else if (compact) 62.dp else 90.dp).aspectRatio(2f / 3f))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) { info() }
        } else Column {
            art(Modifier.fillMaxWidth().aspectRatio(2f / 3f))
            Column(Modifier.padding(top = 5.dp, bottom = 2.dp, start = 2.dp, end = 2.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) { info() }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun ColumnScope.LibraryScreen(model: CompanionModel, tv: Boolean, alphabetFocus: FocusRequester, navigationFocus: FocusRequester, onBackdrop: (JSONObject?) -> Unit) {
    var search by remember(model.libraryKind) { mutableStateOf(model.libraryQuery) }
    var highlighted by remember(model.libraryKind) { mutableStateOf<JSONObject?>(null) }
    LaunchedEffect(model.libraryItems) { if (highlighted == null) highlighted = model.libraryItems.firstOrNull() }
    val featured = highlighted
    LaunchedEffect(featured) { onBackdrop(featured) }
    val view = model.libraryView
    val focusManager = androidx.compose.ui.platform.LocalFocusManager.current
    val gridState = rememberLazyGridState()
    val firstPoster = remember { FocusRequester() }
    val scope = rememberCoroutineScope()
    fun focusTitles() { if (model.libraryItems.isNotEmpty()) scope.launch { gridState.scrollToItem(0); withFrameNanos { }; firstPoster.requestFocus() } }
    val letter = model.libraryJump
    LaunchedEffect(model.libraryRevision, view) { withFrameNanos { }; gridState.scrollToItem(0) }
    var searchOpen by remember { mutableStateOf(model.libraryQuery.isNotBlank()) }
    val filters = listOf("all" to "All titles", "missing" to "Missing", "cutoff" to "Needs upgrade", "monitored" to "Monitored", "unmonitored" to "Unmonitored")
    val sorts = listOf("title" to "Title A–Z", "year" to "Newest year", "added" to "Recently added", "rating" to "Highest rated")
    Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(if (model.libraryKind == "movies") "Movie library" else "TV library", style = PageTitle)
            Text("Your collection · ${model.libraryTotal} titles", color = Muted, style = Caption)
        }
        if (model.libraryJump.isNotBlank()) Action("From start", !model.busy, compact = true) { model.libraryFromStart() }
        Action("Search", !model.busy, compact = true) { searchOpen = !searchOpen }

    }
    if (searchOpen) Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        OutlinedTextField(search, { search = it }, shape = RoundedCornerShape(28.dp), label = { Text("Search library") }, singleLine = true, keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search), keyboardActions = KeyboardActions(onSearch = { if (!model.busy) model.library(model.libraryKind, search) }), modifier = Modifier.weight(1f))
        Action("Find", !model.busy, primary = true) { model.library(model.libraryKind, search) }
        if (tv) Action("Reload", !model.busy) { model.library(model.libraryKind, model.libraryQuery) }
    }
    FlowRow(Modifier.fillMaxWidth().padding(top = 4.dp, bottom = 8.dp).glassPanel().padding(horizontal = 4.dp)) {
        BrowseChoice("View", browseViews.first { it.first == view }.second, browseViews) { model.libraryView = it }
        BrowseChoice("Show", filters.first { it.first == model.libraryFilter }.second, filters, !model.busy) { model.refineLibrary(filter = it) }
        BrowseChoice("Sort", sorts.first { it.first == model.librarySort }.second, sorts, !model.busy) { model.refineLibrary(sort = it) }
        if (model.libraryEngines.isNotEmpty()) BrowseChoice("Library", model.libraryEngines.firstOrNull { it.text("id") == model.libraryEngine }?.text("name") ?: "All engines", listOf("all" to "All engines") + model.libraryEngines.map { it.text("id") to it.text("name") }, !model.busy) { model.refineLibrary(engine = it) }
        if (model.libraryFilter != "all" || model.libraryQuery.isNotBlank()) Action("Clear filters", !model.busy, compact = true) { search = ""; model.resetLibrary() }
    }
    AlphabetRail(letter, !model.busy, tv, alphabetFocus, navigationFocus, ::focusTitles) { if (!tv) focusManager.clearFocus(force = true); model.jumpLibrary(it) }
    Spacer(Modifier.height(8.dp))
    Box(Modifier.fillMaxWidth().height(3.dp)) { if (model.libraryLoading) LinearProgressIndicator(Modifier.fillMaxWidth().testTag("library-loading"), color = Mint) }
    if (model.libraryNotice.isNotBlank()) Text(model.libraryNotice, color = Muted, modifier = Modifier.padding(12.dp))
    else if (!model.busy && !model.libraryLoading && model.libraryItems.isEmpty()) Text("Nothing here yet. Try a different filter or search.", color = Muted, modifier = Modifier.padding(24.dp))
    Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(22.dp)) {
    LazyVerticalGrid(if (view == "list") GridCells.Fixed(1) else GridCells.Adaptive(when (view) { "cards" -> 300.dp; "compact" -> 220.dp; else -> if (tv) 125.dp else 135.dp }), Modifier.weight(1f).testTag("library-results"), state = gridState, contentPadding = PaddingValues(6.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        itemsIndexed(model.libraryItems, key = { _, item -> item.text("id") + item.text("engineInstanceId") }) { index, item ->
            val navigation = (if (index == 0) Modifier.focusRequester(firstPoster) else Modifier).onPreviewKeyEvent { event ->
                val row = gridState.layoutInfo.visibleItemsInfo.firstOrNull { it.index == index }?.row
                if (tv && row == 0 && event.type == KeyEventType.KeyDown && event.key == Key.DirectionUp) { alphabetFocus.requestFocus(); true } else false
            }
            LibraryPoster(model, item, view, tv, navigation) { highlighted = item }
        }
        if (model.libraryMore) item { Action("More library titles", !model.busy) { model.moreLibrary() } }
    }


    }

}
