package com.vynode.companion

import android.graphics.Color
import android.graphics.Rect
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import java.util.concurrent.atomic.AtomicBoolean
import org.junit.Assert.*

/** Synthetic H.264 clip in the real player surface. Never replaces production content. */
internal fun verifyTrailerVideoFrames(scenario: ActivityScenario<MainActivity>, compose: ComposeTestRule) {
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    lateinit var view: WebView
    val bounds = Rect()
    scenario.onActivity { activity ->
        view = activity.window.decorView.findViewWithTag("companion-trailer-player")
        assertNotNull("Player must be attached to the main activity", view)
        assertTrue("WebView must have hardware acceleration", view.isHardwareAccelerated)
        assertEquals("No separate dialog window", activity.window.decorView.windowToken, view.windowToken)
        assertEquals(android.view.View.LAYER_TYPE_HARDWARE, view.layerType)
        view.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(web: WebView, request: WebResourceRequest): WebResourceResponse? {
                if (request.url.host == "render-check.invalid" && request.url.path == "/clip.mp4") {
                    return WebResourceResponse("video/mp4", null, instrumentation.context.assets.open("render-check.mp4"))
                }
                return super.shouldInterceptRequest(web, request)
            }
        }
        view.loadDataWithBaseURL("https://render-check.invalid/", """<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{width:100%;height:100%;margin:0;background:black}video{position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain}</style></head><body><video src="https://render-check.invalid/clip.mp4" autoplay muted loop playsinline onplaying="this.style.height=innerHeight+'px';this.style.width=innerWidth+'px';console.log('VYNODE_TRAILER_READY')"></video></body></html>""", "text/html", "UTF-8", null)
    }
    val playing = AtomicBoolean(false)
    compose.waitUntil(20000) {
        instrumentation.runOnMainSync {
            view.evaluateJavascript("(function(){var v=document.querySelector('video');return !!v && v.readyState>=2 && v.currentTime>0.3;})()") { playing.set(it == "true") }
        }
        playing.get()
    }
    compose.mainClock.advanceTimeBy(2000)
    compose.waitForIdle()
    scenario.onActivity { assertTrue(view.getGlobalVisibleRect(bounds)); view.evaluateJavascript("JSON.stringify({rect:document.querySelector('video').getBoundingClientRect().toJSON(),html:document.documentElement.outerHTML})") { android.util.Log.i("RenderCheck", it) } }
    // Video decode readiness precedes presentation to the compositor.
    instrumentation.waitForIdleSync()
    Thread.sleep(1500)
    val bitmap = instrumentation.uiAutomation.takeScreenshot()
    var visibleColor = 0
    for (x in 2..8) for (y in 4..6) {
        val pixel = bitmap.getPixel(bounds.left + bounds.width() * x / 10, bounds.top + bounds.height() * y / 10)
        val channels = listOf(Color.red(pixel), Color.green(pixel), Color.blue(pixel))
        if (channels.max() > 100 && channels.max() - channels.min() > 70) visibleColor++
    }
    java.io.File(instrumentation.targetContext.getExternalFilesDir(null), "trailer-video-render.png").outputStream().use { bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) }
    bitmap.recycle()
    assertTrue("Decoded video must be visible, not an audio-only/black surface: $visibleColor colored samples", visibleColor >= 8)
}
