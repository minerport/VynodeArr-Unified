package com.vynode.companion

import android.app.Application
import android.os.Build
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

class CompanionModel(application: Application) : AndroidViewModel(application) {
    private val store = SessionStore(application)
    private var client: CompanionClient? = null
    private var work: Job? = null
    var screen by mutableStateOf("connect"); private set
    var busy by mutableStateOf(false); private set
    var message by mutableStateOf(""); private set
    var server by mutableStateOf(""); private set
    var pairingCode by mutableStateOf(""); private set
    var pairingExpiry by mutableStateOf(0L); private set
    var displayName by mutableStateOf(""); private set
    var items by mutableStateOf<List<Media>>(emptyList()); private set
    var requests by mutableStateOf<List<JSONObject>>(emptyList()); private set
    var presence by mutableStateOf<Map<String, String>>(emptyMap()); private set
    var selected by mutableStateOf<Media?>(null); private set
    var details by mutableStateOf<JSONObject?>(null); private set
    var options by mutableStateOf<JSONObject?>(null); private set
    var engine by mutableStateOf(""); private set
    var destination by mutableStateOf(""); private set
    var root by mutableStateOf(""); private set
    var profile by mutableStateOf(0); private set
    var feed by mutableStateOf("trending"); private set
    var query by mutableStateOf(""); private set
    var domain by mutableStateOf("movie"); private set
    var page by mutableStateOf(1); private set
    var totalPages by mutableStateOf(1); private set

    var user by mutableStateOf(JSONObject()); private set
    var libraryLoading by mutableStateOf(false); private set
    var libraryNotice by mutableStateOf(""); private set
    var libraryView by mutableStateOf("poster")
    var discoverView by mutableStateOf("shelves")
    private var artworkGeneration = 0L
    var libraryLetters by mutableStateOf(JSONObject()); private set
    var libraryRevision by mutableStateOf(0); private set
    var libraryOffset by mutableStateOf(0); private set
    var libraryJump by mutableStateOf(""); private set
    var presenceItems by mutableStateOf<Map<String, JSONObject>>(emptyMap()); private set
    var libraryItems by mutableStateOf<List<JSONObject>>(emptyList()); private set
    var libraryKind by mutableStateOf("movies"); private set
    var libraryFilter by mutableStateOf("all"); private set
    var librarySort by mutableStateOf("title"); private set
    var libraryEngine by mutableStateOf("all"); private set
    var libraryEngines by mutableStateOf<List<JSONObject>>(emptyList()); private set
    fun resetLibrary() = runWork { validateSession(); requireAccess(libraryKind); libraryJump = ""; libraryFilter = "all"; libraryQuery = ""; libraryEngine = "all"; libraryItems = emptyList(); loadLibrary(false) }
    fun refineLibrary(filter: String = libraryFilter, sort: String = librarySort, engine: String = libraryEngine) = runWork {
        validateSession(); requireAccess(libraryKind)
        libraryJump = ""; libraryFilter = filter; librarySort = sort; libraryEngine = engine
        libraryItems = emptyList(); loadLibrary(false)
    }
    var libraryQuery by mutableStateOf(""); private set
    var libraryMore by mutableStateOf(false); private set
    var libraryTotal by mutableStateOf(0); private set
    var librarySelected by mutableStateOf<JSONObject?>(null); private set
    var records by mutableStateOf<List<JSONObject>>(emptyList()); private set
    var dashboard by mutableStateOf<JSONObject?>(null); private set
    val administrator get() = user.text("role") == "administrator"
    fun allowed(page: String) = administrator || user.optJSONObject("permissions")?.optBoolean(page) == true
    private fun requireAccess(page: String) { if (!allowed(page)) throw ApiException(403, "Your account does not have access to this page.") }
    private suspend fun landing() {
        when {
            allowed("discover") -> { screen = "home"; loadFeed(1) }
            allowed("movies") -> { libraryKind = "movies"; screen = "library"; loadLibrary(false) }
            allowed("tv") -> { libraryKind = "tv"; screen = "library"; loadLibrary(false) }
            allowed("dashboard") -> { screen = "dashboard"; dashboard = api("/api/dashboard") }
            allowed("calendar") -> { screen = "calendar"; records = api(calendarPath(java.time.YearMonth.now())).optJSONArray("items")?.objects().orEmpty() }
            else -> screen = "account"
        }
    }
    private suspend fun loadLibrary(append: Boolean, start: Int = 0, refreshArtwork: Boolean = true) {
        requireAccess(libraryKind)
        val offset = if (append) libraryOffset + libraryItems.size else start
        if (!append) { libraryOffset = start; if (refreshArtwork) artworkGeneration++ }
        val response = api("/api/media/$libraryKind?limit=40&offset=$offset&query=" + encode(libraryQuery) + "&filter=" + encode(libraryFilter) + "&sort=" + encode(librarySort) + "&direction=" + (if (librarySort == "title") "ascending" else "descending") + "&engineInstanceId=" + encode(libraryEngine))
        libraryLetters = response.optJSONObject("page")?.optJSONObject("letters") ?: JSONObject()
        libraryEngines = response.optJSONArray("engines")?.objects().orEmpty()
        val incoming = response.optJSONArray("items")?.objects().orEmpty()
        libraryItems = (if (append) libraryItems + incoming else incoming).distinctBy { it.text("id") + ":" + it.text("engineInstanceId") }
        if (!append) libraryRevision++
        libraryMore = response.optJSONObject("page")?.optBoolean("hasMore") == true
        libraryTotal = response.optJSONObject("page")?.optInt("total") ?: libraryItems.size
    }
    fun library(kind: String, text: String = "") = runWork {
        validateSession(); requireAccess(kind); if (libraryKind != kind) { libraryFilter = "all"; librarySort = "title"; libraryEngine = "all" }; libraryJump = ""; libraryKind = kind; libraryQuery = text.trim(); libraryItems = emptyList(); libraryMore = false; screen = "library"; loadLibrary(false)
    }
    private fun libraryPath(offset: Int, limit: Int) = "/api/media/$libraryKind?limit=$limit&offset=$offset&query=" + encode(libraryQuery) + "&filter=" + encode(libraryFilter) + "&sort=title&direction=ascending&engineInstanceId=" + encode(libraryEngine)
    fun jumpLibrary(letter: String) = runWork(listOnly = true) {
        validateSession(); requireAccess(libraryKind)
        val initial = api(libraryPath(0, 1))
        val total = initial.optJSONObject("page")?.optInt("total") ?: libraryTotal
        val offset = libraryLetterOffset(letter, total) { at, count ->
            (if (at == 0 && count == 1) initial else api(libraryPath(at, count))).optJSONArray("items")?.objects().orEmpty()
        }
        librarySort = "title"; libraryJump = letter
        if (offset == null) {
            libraryItems = emptyList(); libraryMore = false; libraryOffset = 0; libraryRevision++
            libraryNotice = "No titles beginning with $letter in this selection."
        } else {
            loadLibrary(false, offset, refreshArtwork = false)
        }
    }
    fun libraryFromStart() = runWork(listOnly = true) {
        validateSession(); requireAccess(libraryKind); libraryJump = ""; loadLibrary(false, refreshArtwork = false)
    }
    fun moreLibrary() = runWork(listOnly = true) { validateSession(); loadLibrary(true, refreshArtwork = false) }
    fun openLibrary(item: JSONObject) = runWork {
        validateSession(); requireAccess(libraryKind); librarySelected = null; screen = "libraryDetail"
        librarySelected = api("/api/media/$libraryKind/" + encode(item.text("id"))).getJSONObject("item")
    }
    private fun calendarPath(month: java.time.YearMonth): String = "/api/calendar?start=" + month.atDay(1).minusDays(1) + "&end=" + month.plusMonths(1).atDay(1).plusDays(1)
    fun calendarMonth(month: java.time.YearMonth) = runWork {
        validateSession(); requireAccess("calendar"); records = emptyList()
        records = api(calendarPath(month)).optJSONArray("items")?.objects().orEmpty().sortedBy { it.text("dateUtc") }
    }
    fun section(value: String) = runWork {
        validateSession(); records = emptyList(); dashboard = null
        when (value) {
            "dashboard" -> { requireAccess("dashboard"); screen = value; dashboard = api("/api/dashboard") }
            "calendar" -> { requireAccess("calendar"); screen = value; records = api(calendarPath(java.time.YearMonth.now())).optJSONArray("items")?.objects().orEmpty().sortedBy { it.text("dateUtc") } }
            "activity" -> { check(administrator); screen = value; records = api("/api/activity/queue").optJSONArray("items")?.objects().orEmpty() }
            "account" -> screen = value
        }
    }
    val artworkLoader by lazy { coil.ImageLoader.Builder(getApplication<Application>()).components { add(coil.decode.SvgDecoder.Factory()) }.okHttpClient { okhttp3.OkHttpClient.Builder().followRedirects(false).followSslRedirects(false).build() }.build() }
    fun posterArtwork(context: android.content.Context, item: JSONObject, original: Boolean = false): coil.request.ImageRequest? {
        val art = item.optJSONObject("artwork")
        if (!original && art?.optJSONObject("overlayTemplate") != null) {
            val domain = if (item.text("id").startsWith("movie_")) "movie" else "tv"
            val revision = art.toString().hashCode().toString() + "-" + artworkGeneration
            return artwork(context, JSONObject().put("url", "/api/artwork/composed/$domain/" + encode(item.text("id")) + "?revision=" + revision))
        }
        return artwork(context, art)
    }
    fun discoverArtwork(context: android.content.Context, item: Media): coil.request.ImageRequest? {
        val match = presenceItems[item.domain + ":" + item.id] ?: return null
        if (!match.optBoolean("canView") || !allowed(if (item.domain == "movie") "movies" else "tv")) return null
        return artwork(context, JSONObject().put("url", "/api/artwork/composed/" + item.domain + "/" + encode(match.text("id")) + "?revision=" + artworkGeneration))
    }
    fun artwork(context: android.content.Context, art: JSONObject?): coil.request.ImageRequest? {
        val raw = art?.text("url").orEmpty().ifBlank { art?.text("originalUrl").orEmpty() }
        if (raw.isBlank()) return null
        val base = java.net.URI(server)
        val target = runCatching { base.resolve(raw) }.getOrNull() ?: return null
        val own = target.scheme == base.scheme && target.host == base.host && target.port == base.port
        if (!own && target.scheme != "https") return null
        return coil.request.ImageRequest.Builder(context).data(target.toString()).crossfade(180).apply {
            if (own) {
                val cacheKey = target.toString() + ":" + (client?.connection?.session.orEmpty()).hashCode()
                memoryCacheKey(cacheKey); diskCacheKey(cacheKey)
            }
            if (own) addHeader("Cookie", "vynodearr_session=" + (client?.connection?.session ?: ""))
        }.build()
    }
    fun libraryBack() { work?.cancel(); busy = false; libraryLoading = false; message = ""; screen = "library" }

    init {
        store.load()?.let { saved ->
            server = saved.server; client = CompanionClient(saved); screen = "home"
            runWork { validateSession(); landing() }
        }
    }
    private suspend fun api(path: String, input: JSONObject? = null, authenticated: Boolean = true): JSONObject = withContext(Dispatchers.IO) {
        (client ?: error("Connect to a VynodeArr server first.")).request(path, input, authenticated)
    }
    private fun runWork(listOnly: Boolean = false, block: suspend () -> Unit) {
        work?.cancel()
        busy = false; libraryLoading = false
        work = viewModelScope.launch {
            if (listOnly) libraryLoading = true else busy = true
            message = ""; libraryNotice = ""
            try { block() }
            catch (cancel: CancellationException) { throw cancel }
            catch (error: Exception) {
                if (error is ApiException && error.status == 401) {
                    if (screen == "signin") message = "Your username or password was not accepted. Please try again."
                    else { store.clear(); client = null; screen = "connect"; message = "Your session expired or was revoked. Connect again." }
                } else if (error is ApiException && error.status == 403) { libraryItems = emptyList(); records = emptyList(); dashboard = null; librarySelected = null; details = null; screen = "account"; message = "Access was denied. Refresh account access to check your current permissions." } else if (error is java.net.ConnectException) message = "Cannot connect to that address. Check the server's IP and port, and that you are on the same network."
                else if (error is java.net.SocketTimeoutException) message = "The server did not respond in time. Check your network and try again."
                else if (error is javax.net.ssl.SSLException) message = "Could not verify the secure connection. For a trusted home-network HTTP address, enable the local HTTP option."
                else message = error.message ?: "Could not reach the server. Try again."
            } finally { if (kotlin.coroutines.coroutineContext[kotlinx.coroutines.Job]?.isActive == true) { if (listOnly) libraryLoading = false else busy = false } }
        }
    }
    private suspend fun validateSession() {
        val status = api("/api/auth/status")
        if (!status.optBoolean("authenticated")) throw ApiException(401, "Session expired")
        user = status.getJSONObject("user")
        displayName = user.optString("name", user.optString("username"))
    }
    fun pair(address: String, allowLan: Boolean) = runWork {
        server = normalizeServer(address, allowLan); client = CompanionClient(Connection(server, "", ""))
        val status = api("/api/auth/status", authenticated = false)
        if (!status.has("setupRequired") || !status.has("authenticated")) error("This address does not appear to be a VynodeArr server.")
        if (status.optBoolean("setupRequired")) error("Finish setting up this server in your browser first.")
        val grant = try { api("/api/companion/pair/start", JSONObject().put("name", "${Build.MANUFACTURER} ${Build.MODEL}"), false) }
        catch (error: ApiException) {
            if (error.status in listOf(401, 404, 405)) { screen = "signin"; message = "Connected. Sign in with your VynodeArr account."; return@runWork }
            throw error
        }
        pairingCode = grant.getString("userCode").chunked(5).joinToString("-"); pairingExpiry = grant.getLong("expiresAt"); screen = "pair"
        val deadline = android.os.SystemClock.elapsedRealtime() + 300000
        while (android.os.SystemClock.elapsedRealtime() < deadline) {
            delay(5000)
            val response = api("/api/companion/pair/poll", JSONObject().put("deviceCode", grant.getString("deviceCode")), false)
            when (response.getString("status")) {
                "expired" -> error("Pairing expired. Go back and generate a new code.")
                "approved" -> {
                    val connection = Connection(server, response.getString("sessionId"), response.getString("csrf"))
                    withContext(Dispatchers.IO) { store.save(connection) }
                    client = CompanionClient(connection); screen = "home"; pairingCode = ""
                    validateSession(); landing(); return@runWork
                }
            }
        }
        error("Pairing expired. Go back and generate a new code.")
    }
    fun prepareSignIn(address: String, allowLan: Boolean) = runWork {
        server = normalizeServer(address, allowLan); client = CompanionClient(Connection(server, "", ""))
        val status = api("/api/auth/status", authenticated = false)
        if (!status.has("setupRequired") || !status.has("authenticated")) error("This address does not appear to be a VynodeArr server.")
        if (status.optBoolean("setupRequired")) error("Finish setting up this server in your browser first.")
        screen = "signin"
    }
    fun signIn(identifier: String, password: String) = runWork {
        api("/api/auth/login", JSONObject().put("identifier", identifier.trim()).put("password", password).put("remember", true), false)
        validateSession()
        withContext(Dispatchers.IO) { store.save(client!!.connection) }
        landing()
    }
    fun cancelPairing() { work?.cancel(); pairingCode = ""; busy = false; screen = "connect"; message = "" }
    private suspend fun loadPresence() {
        artworkGeneration++
        val entries = api("/api/discover/library-presence").optJSONArray("items")?.objects().orEmpty()
        presenceItems = entries.associateBy { "${it.text("domain")}:${it.optInt("tmdbId")}" }
        presence = entries.associate { "${it.text("domain")}:${it.optInt("tmdbId")}" to it.text("status") }
    }
    private suspend fun loadFeed(nextPage: Int) {
        requireAccess("discover")
        val path = if (query.isBlank()) "/api/discover/feed?kind=${encode(feed)}&page=$nextPage" else "/api/discover/browse?domain=$domain&query=${encode(query)}&page=$nextPage"
        val result = api(path)
        val next = result.optJSONArray("results")?.objects().orEmpty().map(Media::from)
        items = (if (nextPage == 1) next else items + next).distinctBy { "${it.domain}:${it.id}" }
        page = nextPage; totalPages = result.optInt("totalPages", 1).coerceAtMost(500)
        if (nextPage == 1) loadPresence()
    }
    fun browse(kind: String = feed, text: String = "", type: String = domain) = runWork {
        validateSession(); requireAccess("discover"); screen = "home"; feed = kind; query = text.trim(); domain = type; items = emptyList(); page = 1; totalPages = 1; loadFeed(1)
    }
    fun more() = runWork { validateSession(); loadFeed(page + 1) }
    fun open(item: Media) = runWork {
        validateSession(); requireAccess("discover")
        selected = item; details = null; options = null; screen = "detail"
        details = api("/api/discover/details/${item.domain}/${item.id}").getJSONObject("item")
    }
    fun back() { if (screen == "request" && busy) return; work?.cancel(); busy = false; message = ""; screen = if (screen == "request") "detail" else if (screen == "libraryDetail") "library" else if (allowed("discover")) "home" else "account" }
    fun myRequests() = runWork { validateSession(); requireAccess("discover"); screen = "requests"; requests = api("/api/requests/mine").optJSONArray("items")?.objects().orEmpty() }
    private suspend fun loadOptions(chosenEngine: String) {
        val item = selected ?: return
        var result = api("/api/discover/import-options?domain=${item.domain}&tmdbId=${item.id}" + if (chosenEngine.isNotEmpty()) "&engineInstanceId=${encode(chosenEngine)}" else "")
        val engines = result.optJSONArray("engines")?.objects().orEmpty()
        engine = chosenEngine.ifEmpty { (engines.firstOrNull { it.optBoolean("isDefault") } ?: engines.firstOrNull())?.text("id").orEmpty() }
        if (chosenEngine.isEmpty() && engine.isNotEmpty()) result = api("/api/discover/import-options?domain=${item.domain}&tmdbId=${item.id}&engineInstanceId=${encode(engine)}")
        options = result
        val destinations = result.optJSONArray("destinations")?.objects().orEmpty().filter { it.optBoolean("ready") }
        val chosen = destinations.firstOrNull { it.optBoolean("isDefault") } ?: destinations.firstOrNull()
        destination = chosen?.text("id").orEmpty()
        root = chosen?.text("rootFolderPath") ?: result.optJSONArray("roots")?.optJSONObject(0)?.text("path").orEmpty()
        profile = chosen?.optInt("qualityProfileId") ?: result.optJSONArray("profiles")?.optJSONObject(0)?.optInt("id") ?: 0
        if (result.optJSONObject("match") == null) error("The media engine could not match this title. Ask your administrator to review it in VynodeArr.")
    }
    fun prepareRequest() = runWork { validateSession(); requireAccess("discover"); screen = "request"; options = null; loadOptions("") }
    fun chooseEngine(value: String) = runWork { options = null; destination = ""; loadOptions(value) }
    fun chooseDestination(value: JSONObject) { destination = value.text("id"); root = value.text("rootFolderPath"); profile = value.optInt("qualityProfileId") }
    fun chooseRoot(value: String) { root = value }
    fun chooseProfile(value: Int) { profile = value }
    fun submit() = runWork {
        val item = selected ?: return@runWork
        validateSession(); requireAccess("discover")
        val result = api("/api/discover/request", requestPayload(item, options ?: error("Load request options first."), engine, destination, root, profile))
        screen = "requests"
        // A successful mutation is never retried automatically if refreshing the list fails.
        message = if (result.optJSONObject("request")?.text("status") == "pending_approval") "Request submitted for approval." else "Request sent to your media engine."
        requests = api("/api/requests/mine").optJSONArray("items")?.objects().orEmpty()
    }
    fun signOut() = runWork {
        api("/api/auth/logout", JSONObject())
        store.clear(); client = null; user = JSONObject(); libraryItems = emptyList(); records = emptyList(); dashboard = null; librarySelected = null; items = emptyList(); requests = emptyList(); presence = emptyMap(); presenceItems = emptyMap(); screen = "connect"
    }
}
