package com.vynode.companion

import androidx.compose.animation.Crossfade
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.ui.input.key.*
import kotlinx.coroutines.launch
import android.app.UiModeManager
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import coil.imageLoader
import org.json.JSONObject

internal val Mint = Color(0xFFC7CDD5)
internal val Night = Color(0xFF05070D)
internal val Muted = Color(0xFFB2B8CD)
private val SoftSurface = Color(0xFF20253F)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED)
        val tv = (getSystemService(Context.UI_MODE_SERVICE) as UiModeManager).currentModeType == Configuration.UI_MODE_TYPE_TELEVISION
        setContent {
            MaterialTheme(typography = CompanionTypography, colorScheme = darkColorScheme(primary = Mint, onPrimary = Night, background = Night, surface = SoftSurface, secondaryContainer = Color(0xFF303F43), onSecondaryContainer = Color(0xFFDDEDE9))) {
                Surface(Modifier.fillMaxSize(), color = Night) { Companion(viewModel(), tv) }
            }
        }
    }
}

@Composable
internal fun Action(label: String, enabled: Boolean = true, modifier: Modifier = Modifier, primary: Boolean = false, selected: Boolean = false, compact: Boolean = false, alignStart: Boolean = false, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(16.dp)
    val actionFill by animateColorAsState(if (primary) Color.White.copy(alpha = if (focused) .22f else .12f) else if (focused) Color.White.copy(alpha = .14f) else if (selected) Color.White.copy(alpha = .06f) else Color.Transparent, animationSpec = tween(160), label = "action-fill")
    Button(onClick, enabled = enabled, shape = shape,
        colors = ButtonDefaults.buttonColors(containerColor = actionFill, contentColor = if (primary || selected || focused) Color.White else Muted, disabledContainerColor = Color.Transparent),
        modifier = modifier.padding(2.dp).onFocusChanged { focused = it.isFocused }.border(if (focused) 2.dp else 0.dp, if (focused) Mint else Color.Transparent, shape), contentPadding = PaddingValues(horizontal = if (compact) 10.dp else 14.dp, vertical = if (compact) 6.dp else 9.dp)) {
        Text(label, modifier = if (alignStart) Modifier.fillMaxWidth() else Modifier, style = if (compact) Caption.copy(fontSize = 12.sp, lineHeight = 16.sp) else PosterTitle.copy(fontSize = 14.sp, lineHeight = 18.sp), fontWeight = if (primary || selected) FontWeight.Medium else FontWeight.Normal)
    }
}

internal fun launchLink(context: Context, value: String) {
    try {
        val uri = Uri.parse(value)
        require(uri.scheme == "https" || uri.scheme == "http")
        context.startActivity(Intent(Intent.ACTION_VIEW, uri))
    } catch (_: Exception) { Toast.makeText(context, "No app can open this link. Open it on your phone instead.", Toast.LENGTH_LONG).show() }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Companion(model: CompanionModel, tv: Boolean) {
    val context = LocalContext.current
    val keyboard = LocalSoftwareKeyboardController.current
    val focus = LocalFocusManager.current
    var ambientMedia by remember { mutableStateOf<Media?>(null) }
    var ambientLibrary by remember { mutableStateOf<JSONObject?>(null) }
    var railFocused by remember { mutableStateOf(false) }
    val sectionScroll = rememberScrollState()
    val sectionScope = rememberCoroutineScope()
    LaunchedEffect(model.screen, model.librarySelected) { sectionScroll.scrollTo(0) }
    val navigationFocus = remember { FocusRequester() }
    val libraryAlphabetFocus = remember { FocusRequester() }
    var activeTrailer by remember { mutableStateOf<Pair<String, String>?>(null) }
    var focusedScreen by remember { mutableStateOf("") }
    LaunchedEffect(model.screen, model.busy, model.libraryKind) {
        if (!model.busy && model.screen !in listOf("connect", "pair", "signin", "detail", "libraryDetail")) {
            keyboard?.hide()
            if (!tv) focus.clearFocus(force = true)
            val destination = model.screen + if (model.screen == "library") model.libraryKind else ""
            if (focusedScreen != destination) {
                focus.clearFocus(force = true)
                if (tv) navigationFocus.requestFocus()
                focusedScreen = destination
            }
        } else if (model.screen == "pair") { focus.clearFocus(force = true); keyboard?.hide() }
    }
    BackHandler(activeTrailer == null && model.screen !in listOf("connect", "home")) { if (model.screen in listOf("pair", "signin")) model.cancelPairing() else model.back() }
    Box(Modifier.fillMaxSize().background(Night)) {
    val media = when (model.screen) { "home" -> ambientMedia ?: model.items.firstOrNull(); "detail", "request" -> model.selected; else -> null }
    val libraryArt = when (model.screen) { "library" -> ambientLibrary ?: model.libraryItems.firstOrNull(); "libraryDetail" -> model.librarySelected; else -> null }
    val backgroundArt: Any? = if (media != null && model.allowed("discover")) media.backdrop.ifBlank { media.poster }.takeIf { it.startsWith("https://") }
        else if (libraryArt != null && model.allowed(model.libraryKind)) model.artwork(context, libraryArt.optJSONObject("artwork")) else null
    val backgroundKey = (backgroundArt as? coil.request.ImageRequest)?.data ?: backgroundArt
    val backdropLayer = remember(backgroundKey) { backgroundArt to if (media != null) context.imageLoader else model.artworkLoader }
    Crossfade(targetState = backdropLayer, animationSpec = tween(380), label = "artwork-dissolve") { (art, loader) ->
        AsyncImage(art, null, imageLoader = loader, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
    }
    Box(Modifier.fillMaxSize().background(Brush.horizontalGradient(listOf(Night.copy(alpha = .94f), Night.copy(alpha = .64f), Night.copy(alpha = .48f)))))
    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Night.copy(alpha = .20f), Color.Transparent, Night.copy(alpha = .88f)))))
    if (backgroundArt == null) Box(Modifier.fillMaxSize().background(Brush.linearGradient(listOf(Color(0xFF26343B).copy(alpha = .46f), Color.Transparent, Color(0xFF303431).copy(alpha = .26f)))))
    val backgroundAccess = if (activeTrailer == null) Modifier else Modifier.focusProperties { canFocus = false }.clearAndSetSemantics { }
    Column(backgroundAccess.onPreviewKeyEvent { event ->
        if (tv && !railFocused && activeTrailer == null && model.screen in listOf("account", "dashboard", "activity", "libraryDetail") && event.key in listOf(Key.DirectionDown, Key.DirectionUp)) {
            if (event.type == KeyEventType.KeyDown) sectionScope.launch { sectionScroll.scrollBy(if (event.key == Key.DirectionDown) 100f else -100f) }
            true
        } else false
    }.fillMaxSize().safeDrawingPadding().padding(horizontal = if (tv) 32.dp else 18.dp, vertical = if (tv) 12.dp else 8.dp)) {
        if (!tv && model.screen != "detail") Text("VynodeArr", color = Color(0xFFE3ECE9), style = SectionTitle, modifier = Modifier.padding(vertical = 12.dp))
        val showRail = tv && model.screen !in listOf("connect", "pair", "signin", "detail", "libraryDetail")
        Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(if (showRail) 24.dp else 0.dp)) {
        if (model.screen !in listOf("connect", "pair", "signin", "detail", "libraryDetail")) {
            val entries = buildList<Triple<String, String, () -> Unit>> {
                if (model.allowed("discover")) add(Triple("home", "Discover") { model.browse() })
                if (model.allowed("movies")) add(Triple("movies", "Movie library") { model.library("movies") })
                if (model.allowed("tv")) add(Triple("tv", "TV library") { model.library("tv") })
                if (model.allowed("calendar")) add(Triple("calendar", "Calendar") { model.section("calendar") })
                if (model.allowed("dashboard")) add(Triple("dashboard", "Overview") { model.section("dashboard") })
                if (model.allowed("discover")) add(Triple("requests", "My requests") { model.myRequests() })
                if (model.administrator) add(Triple("activity", "Activity") { model.section("activity") })
                add(Triple("account", "Account") { model.section("account") })
                if (model.screen == "request") add(Triple("back", "Back") { model.back() })
                add(Triple("logout", "Sign out") { model.signOut() })
            }
            val active = if (model.screen == "library") model.libraryKind else model.screen
            val focusKey = entries.firstOrNull { it.first == active }?.first ?: entries.first().first
            if (showRail) Column(Modifier.width(145.dp).onFocusChanged { railFocused = it.hasFocus }.fillMaxHeight().glassPanel().padding(horizontal = 8.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("VynodeArr", style = SectionTitle, color = Color.White, modifier = Modifier.padding(start = 14.dp, top = 22.dp, bottom = 28.dp))
                Text("YOUR SPACE", style = Caption, color = Muted, letterSpacing = 1.sp, modifier = Modifier.padding(start = 14.dp, bottom = 10.dp))
                entries.forEach { (key, title, action) ->
                    Action(title, !model.busy, modifier = Modifier.fillMaxWidth().then(if (key == focusKey) Modifier.focusRequester(navigationFocus).then(if (model.screen == "library") Modifier.focusProperties { right = libraryAlphabetFocus } else Modifier) else Modifier), selected = key == active, compact = true, alignStart = true, onClick = action)
                }
            }
        }
        Column(Modifier.weight(1f).fillMaxHeight()) {
        if (!tv && model.screen !in listOf("connect", "pair", "signin", "detail", "libraryDetail")) {
            Row(Modifier.fillMaxWidth().glassPanel().horizontalScroll(rememberScrollState())) {
                if (model.allowed("discover")) Action("Discover", compact = true) { model.browse() }
                if (model.allowed("movies")) Action("Movie library", compact = true) { model.library("movies") }
                if (model.allowed("tv")) Action("TV library", compact = true) { model.library("tv") }
                if (model.allowed("calendar")) Action("Calendar", compact = true) { model.section("calendar") }
                if (model.allowed("dashboard")) Action("Overview", compact = true) { model.section("dashboard") }
                if (model.allowed("discover")) Action("My requests", compact = true) { model.myRequests() }
                if (model.administrator) Action("Activity", compact = true) { model.section("activity") }
                if (model.screen == "request") Action("Back", compact = true) { model.back() }
                Action("Account", compact = true) { model.section("account") }
                Action("Sign out", compact = true) { model.signOut() }
            }
        }
        Box(Modifier.fillMaxWidth().height(4.dp)) { if (model.busy) LinearProgressIndicator(Modifier.fillMaxWidth().height(2.dp), color = Mint) }
        if (model.message.isNotBlank()) Text(model.message, color = Color(0xFFE5D2AC), fontSize = 14.sp, modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp).background(SoftSurface, RoundedCornerShape(16.dp)).padding(12.dp))
        when (model.screen) {
            "connect" -> ConnectScreen(model)
            "signin" -> SignInScreen(model)
            "pair" -> Column(Modifier.verticalScroll(rememberScrollState()).padding(top = 24.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
                Text("Make yourself at home.", style = MaterialTheme.typography.headlineLarge)
                Text("On your phone or computer, open:")
                Text("${model.server}/companion-pair.html", color = Mint, fontSize = 20.sp)
                Text("Sign in, enter this code, and approve your device.")
                Text(model.pairingCode, fontSize = if (tv) 48.sp else 34.sp, letterSpacing = 4.sp, fontWeight = FontWeight.Bold)
                Text("Code expires after five minutes. Keep this screen open while pairing.")
                if (!tv) Action("Open pairing page") { launchLink(context, "${model.server}/companion-pair.html") }
                Action("Back / new code") { model.cancelPairing() }
            }
            "library" -> LibraryScreen(model, tv, libraryAlphabetFocus, navigationFocus) { ambientLibrary = it }
            "libraryDetail" -> LibraryDetailScreen(model, sectionScroll)
            "calendar" -> CalendarScreen(model, tv)
            "dashboard", "activity", "account" -> ServiceScreen(model, sectionScroll)
            "home" -> HomeScreen(model, tv) { ambientMedia = it }
            "detail" -> DetailScreen(model, tv) { title, url -> activeTrailer = title to url }
            "request" -> RequestScreen(model)
            "requests" -> {
                Text("Your requests", fontSize = 24.sp, modifier = Modifier.padding(vertical = 10.dp))
                Action("Refresh status", !model.busy) { model.myRequests() }
                if (model.requests.isEmpty() && !model.busy) Text("No requests to show. Discover something you would like to watch.")
                LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    items(model.requests, key = { it.text("id") }) { request ->
                        var focused by remember { mutableStateOf(false) }
                        Row(Modifier.fillMaxWidth().background(SoftSurface.copy(alpha = .65f), RoundedCornerShape(24.dp)).border(if (focused) 2.dp else 0.dp, if (focused) Mint else Color.Transparent, RoundedCornerShape(24.dp)).onFocusChanged { focused = it.isFocused }.focusable().padding(18.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            AsyncImage(request.text("poster").takeIf { it.startsWith("https://") }, contentDescription = null, modifier = Modifier.width(60.dp).height(90.dp).clip(RoundedCornerShape(14.dp)), contentScale = ContentScale.Crop)
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(request.text("title"), fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                                Text(request.text("statusLabel").ifBlank { request.text("status").replace('_', ' ') }, color = Mint)
                                Text(request.text("message"))
                                if (request.text("rejectionReason").isNotBlank()) Text(request.text("rejectionReason"))
                                val target = listOf(request.text("engineInstanceName"), request.text("destinationName")).filter { it.isNotBlank() }.joinToString(" · ")
                                if (target.isNotEmpty()) Text(target, color = Color.LightGray, fontSize = 13.sp)
                            }
                        }
                    }
                }
            }
        }

    }
    }
    }
    activeTrailer?.let { (title, url) -> TrailerOverlay(title, url, { activeTrailer = null }, { launchLink(context, url) }) }
    }
}

@Composable
private fun ConnectScreen(model: CompanionModel) {
    var address by rememberSaveable { mutableStateOf(model.server) }
    var allowLan by rememberSaveable { mutableStateOf(false) }
    Column(Modifier.widthIn(max = 600.dp).verticalScroll(rememberScrollState()).padding(top = 24.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        Text("Welcome home.", fontSize = 30.sp, fontWeight = FontWeight.SemiBold)
        Text("Connect to VynodeArr to discover something good and keep track of your requests.", color = Muted)
        OutlinedTextField(address, { address = it }, shape = RoundedCornerShape(20.dp), label = { Text("VynodeArr server address") }, placeholder = { Text("https://media.example.com") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Done), keyboardActions = KeyboardActions(onDone = { if (!model.busy) model.prepareSignIn(address, allowLan) }), modifier = Modifier.fillMaxWidth())
        Row { Checkbox(allowLan, { allowLan = it }, modifier = Modifier.semantics { contentDescription = "Allow HTTP on trusted home network" }); Text("Allow unencrypted HTTP on my trusted home network", modifier = Modifier.padding(top = 12.dp)) }
        if (allowLan) Text("Use a private IPv4 address such as http://192.168.1.10:8080. HTTP exposes the session to your network; use HTTPS outside your trusted LAN.", fontSize = 13.sp)
        Action("Sign in with account", !model.busy && address.isNotBlank(), primary = true) { model.prepareSignIn(address, allowLan) }
        Action("Connect and get a code", !model.busy && address.isNotBlank()) { model.pair(address, allowLan) }
    }
}

@Composable
private fun SignInScreen(model: CompanionModel) {
    var identifier by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    Column(Modifier.widthIn(max = 520.dp).verticalScroll(rememberScrollState()).padding(top = 24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("Good to see you.", fontSize = 30.sp, fontWeight = FontWeight.SemiBold)
        Text("Connected to ${model.server}", color = Mint, fontSize = 14.sp)
        Text("Use the same account you use in VynodeArr.", color = Muted)
        OutlinedTextField(identifier, { identifier = it }, label = { Text("Username or email") }, shape = RoundedCornerShape(20.dp), singleLine = true, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next))
        OutlinedTextField(password, { password = it }, label = { Text("Password") }, shape = RoundedCornerShape(20.dp), singleLine = true, modifier = Modifier.fillMaxWidth(), visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done), keyboardActions = KeyboardActions(onDone = { if (!model.busy && identifier.isNotBlank() && password.isNotEmpty()) { model.signIn(identifier, password); password = "" } }))
        Action("Sign in", !model.busy && identifier.isNotBlank() && password.isNotEmpty(), primary = true) { model.signIn(identifier, password); password = "" }
        Action("Change server", !model.busy) { model.cancelPairing() }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Choices(title: String, values: List<JSONObject>, selected: String, key: String, label: (JSONObject) -> String, enabled: Boolean, choose: (JSONObject) -> Unit) {
    if (values.isEmpty()) return
    Text(title, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 12.dp))
    FlowRow { values.forEach { value -> Action((if (value.text(key) == selected) "✓ " else "") + label(value), enabled) { choose(value) } } }
}

@Composable
private fun RequestScreen(model: CompanionModel) {
    val item = model.selected ?: return
    Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Request ${item.title}", style = MaterialTheme.typography.headlineMedium)
        Text("Choose where this title belongs. Your account's approval rules and request limits still apply.")
        val options = model.options
        if (options != null) {
            Choices("Media engine", options.optJSONArray("engines")?.objects().orEmpty(), model.engine, "id", { it.text("name") }, !model.busy) { model.chooseEngine(it.text("id")) }
            val destinations = options.optJSONArray("destinations")?.objects().orEmpty().filter { it.optBoolean("ready") }
            Choices("Library destination", destinations, model.destination, "id", { it.text("name") }, !model.busy, model::chooseDestination)
            if (model.destination.isEmpty()) {
                Choices("Library folder", options.optJSONArray("roots")?.objects().orEmpty(), model.root, "path", { it.text("path") }, !model.busy) { model.chooseRoot(it.text("path")) }
                Choices("Quality", options.optJSONArray("profiles")?.objects().orEmpty(), model.profile.toString(), "id", { it.text("name") }, !model.busy) { model.chooseProfile(it.optInt("id")) }
            }
            Text("Folder: ${model.root.ifBlank { "Not configured" }}")
            if (item.domain == "tv") Text("This requests the series with all episodes monitored. Season-specific requests are not included in this preview.")
            Text("The server will search for available releases after approval. Selecting Request submits this title.")
            Action("Request ${if (item.domain == "movie") "movie" else "series"}", !model.busy && options.optJSONObject("match") != null && model.root.isNotBlank() && model.profile > 0, primary = true) { model.submit() }
        } else if (!model.busy) Action("Retry options") { model.prepareRequest() }
    }
}
