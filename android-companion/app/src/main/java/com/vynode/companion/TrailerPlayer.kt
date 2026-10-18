package com.vynode.companion

import android.annotation.SuppressLint
import android.net.http.SslError
import android.webkit.*
import androidx.core.view.doOnLayout
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.input.pointer.pointerInput
import androidx.activity.compose.BackHandler
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import java.net.URI
import java.net.URLDecoder
import kotlinx.coroutines.delay

internal fun youtubeVideoId(value: String): String? = runCatching {
    val uri = URI(value)
    if (uri.scheme != "https" || uri.userInfo != null || uri.port !in listOf(-1, 443)) return null
    val path = uri.path.orEmpty().trim('/').split('/')
    val id = when (uri.host?.lowercase()) {
        "youtu.be" -> path.singleOrNull()
        "youtube.com", "www.youtube.com", "m.youtube.com" -> when {
            uri.path == "/watch" -> uri.rawQuery.orEmpty().split('&').firstOrNull { it.substringBefore('=') == "v" }?.substringAfter('=')?.let { URLDecoder.decode(it, "UTF-8") }
            path.size == 2 && path[0] in listOf("embed", "shorts") -> path[1]
            else -> null
        }
        else -> null
    }
    id?.takeIf { it.matches(Regex("[A-Za-z0-9_-]{11}")) }
}.getOrNull()

internal fun trailerPage(videoId: String, origin: String): String {
    require(videoId.matches(Regex("[A-Za-z0-9_-]{11}")))
    require(origin.matches(Regex("https://[a-zA-Z0-9_.-]+")))
    return """<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="strict-origin-when-cross-origin"><style>html,body{width:100%;height:100%;margin:0;background:#000;overflow:hidden}#player{position:fixed;inset:0;width:100vw;height:100vh;border:0}</style></head><body><div id="player"></div><script>
        var player;
        function fitPlayer(){var el=document.getElementById('player');if(el){el.style.width=window.innerWidth+'px';el.style.height=window.innerHeight+'px';}}
        window.addEventListener('resize',fitPlayer);
        function onYouTubeIframeAPIReady(){player=new YT.Player('player',{videoId:'$videoId',width:'100%',height:'100%',playerVars:{autoplay:1,playsinline:1,fs:0,rel:0,origin:'$origin'},events:{onReady:function(){fitPlayer();console.log('VYNODE_TRAILER_READY');},onError:function(e){console.log('VYNODE_TRAILER_ERROR:'+e.data);}}});}
        </script><script src="https://www.youtube.com/iframe_api"></script></body></html>"""
}

@SuppressLint("SetJavaScriptEnabled")
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun TrailerOverlay(title: String, url: String, onDismiss: () -> Unit, onExternal: () -> Unit) {
    val context = LocalContext.current
    val owner = LocalLifecycleOwner.current
    val videoId = remember(url) { youtubeVideoId(url) }
    var error by remember(url) { mutableStateOf<String?>(null) }
    var ready by remember(url) { mutableStateOf(false) }
    val latestDismiss by rememberUpdatedState(onDismiss)
    val closeFocus = remember { FocusRequester() }
    val origin = "https://${context.packageName}"
    val player = remember(url) {
        if (videoId == null) null else runCatching {
            WebView(context).apply {
                // Keep WebView video composition on an explicit hardware layer.
                setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null)
                keepScreenOn = true
                tag = "companion-trailer-player"
                setBackgroundColor(android.graphics.Color.BLACK)
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.mediaPlaybackRequiresUserGesture = false
                settings.allowFileAccess = false
                settings.allowContentAccess = false
                settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                        val target = request.url
                        return !(target.scheme == "https" && target.host == "www.youtube.com" && target.path.orEmpty().startsWith("/embed/"))
                    }
                    override fun onReceivedError(view: WebView, request: WebResourceRequest, failure: WebResourceError) {
                        if (request.isForMainFrame || request.url.path == "/iframe_api" || request.url.path.orEmpty().startsWith("/embed/")) error = "The trailer could not load. Check your connection or open it in YouTube."
                    }
                    override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, failure: SslError) {
                        handler.cancel()
                        error = "The secure player connection could not be verified. Try opening YouTube."
                    }
                }
                webChromeClient = object : WebChromeClient() {
                    override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                        if (message.message() == "VYNODE_TRAILER_READY") { ready = true; return true }
                        if (message.message().startsWith("VYNODE_TRAILER_ERROR:")) {
                            error = "YouTube cannot play this trailer here. Try Open in YouTube."
                            return true
                        }
                        return false
                    }
                }
            }
        }.getOrNull()
    }
    LaunchedEffect(player) {
        if (player != null) {
            delay(25000)
            if (!ready && error == null) error = "The player is taking too long to load. Try Open in YouTube."
        }
    }
    DisposableEffect(player, owner) {
        val observer = LifecycleEventObserver { _, event ->
            // Closing on background prevents audio continuing behind another app.
            if (event == Lifecycle.Event.ON_STOP) latestDismiss()
        }
        owner.lifecycle.addObserver(observer)
        onDispose {
            owner.lifecycle.removeObserver(observer)
            player?.stopLoading()
            player?.loadUrl("about:blank")
            player?.onPause()
            player?.removeAllViews()
            (player?.parent as? android.view.ViewGroup)?.removeView(player)
            player?.destroy()
        }
    }
    BackHandler(onBack = onDismiss)
    Box(Modifier.fillMaxSize().safeDrawingPadding(), contentAlignment = Alignment.Center) {
        Box(Modifier.matchParentSize().background(Color.Black.copy(alpha = .7f)).pointerInput(Unit) { detectTapGestures { onDismiss() } })
        LaunchedEffect(Unit) { closeFocus.requestFocus() }
        // Background only: clipping/layering a WebView can hide video surfaces on TV GPUs.
        Box(Modifier.fillMaxWidth(.94f).fillMaxHeight(.88f).heightIn(max = 640.dp).background(Night, RoundedCornerShape(18.dp)).pointerInput(Unit) { detectTapGestures { } }) {
            Column(Modifier.padding(12.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Trailer · $title", modifier = Modifier.weight(1f).padding(12.dp), maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = 18.sp)
                    Action("Close trailer", modifier = Modifier.focusRequester(closeFocus), onClick = onDismiss)
                }
                if (player != null && videoId != null) {
                    AndroidView(factory = { player.apply { doOnLayout { loadDataWithBaseURL("$origin/", trailerPage(videoId, origin), "text/html", "UTF-8", null) } } }, modifier = Modifier.fillMaxWidth().weight(1f).background(Color.Black))
                } else {
                    Box(Modifier.fillMaxWidth().weight(1f).padding(20.dp)) {
                        Text(if (videoId == null) "This trailer link cannot be embedded. Open it in YouTube instead." else "The Android web player is unavailable. Open this trailer in YouTube instead.")
                    }
                }
                error?.let { Text(it, color = Color(0xFFE5D2AC), fontSize = 12.sp, modifier = Modifier.padding(8.dp)) }
                if (player != null && !ready && error == null) Text("Loading trailer…", color = Muted, fontSize = 12.sp, modifier = Modifier.padding(8.dp))
                FlowRow {
                    if (player != null) {
                        Action("Play", ready) { player.evaluateJavascript("if(window.player && player.playVideo) player.playVideo();", null) }
                        Action("Pause", ready) { player.evaluateJavascript("if(window.player && player.pauseVideo) player.pauseVideo();", null) }
                        Action("Player controls") { player.requestFocus() }
                    }
                    Action("Open in YouTube") { onDismiss(); onExternal() }
                }
            }
        }
    }
}
