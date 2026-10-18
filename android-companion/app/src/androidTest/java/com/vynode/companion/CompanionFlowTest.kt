package com.vynode.companion

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Rule
import org.junit.Test
import org.junit.Assert.*
import org.json.JSONObject
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull

/** Run only against scripts/companion-review-server.mjs on the host loopback. */
class CompanionFlowTest {
    @get:Rule val compose = createEmptyComposeRule()
    private val server = "http://10.0.2.2:18787"
    private val codePattern = Regex("[A-F0-9]{5}-[A-F0-9]{5}")
    private val pairingCode = SemanticsMatcher("pairing code") { node -> node.config.getOrNull(SemanticsProperties.Text)?.any { codePattern.matches(it.text) } == true }
    private fun screenshot(name: String) {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val bitmap = instrumentation.uiAutomation.takeScreenshot()
        val directory = InstrumentationRegistry.getArguments().getString("additionalTestOutputDir")?.let { java.io.File(it).apply { mkdirs() } } ?: instrumentation.targetContext.getExternalFilesDir(null)
        java.io.File(directory, "$name.png").outputStream().use { bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) }
        bitmap.recycle()
    }

    private fun waitForText(text: String) {
        compose.waitUntil(30000) { compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }
    }

    @Test fun pairBrowseRequestAndRestoreSession() {
        installReviewArtwork()
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        SessionStore(context).clear()
        val api = CompanionClient(Connection(server, "", ""))
        // Pairing approval needs an existing web session. The fixture login returns its
        // cookie in headers; use a dedicated test HTTP login below, not production hooks.
        val connection = java.net.URL("$server/api/auth/login").openConnection() as java.net.HttpURLConnection
        connection.requestMethod = "POST"; connection.doOutput = true
        connection.setRequestProperty("Content-Type", "application/json")
        connection.outputStream.use { it.write("""{"identifier":"preview-user","password":"Companion-Preview-Only1"}""".toByteArray()) }
        assertEquals(200, connection.responseCode)
        val webSession = connection.getHeaderField("Set-Cookie").substringAfter("vynodearr_session=").substringBefore(';')
        val body = JSONObject(connection.inputStream.bufferedReader().use { it.readText() }); connection.disconnect()
        api.connection = Connection(server, webSession, body.getString("csrf"))

        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            compose.onNode(hasSetTextAction()).performTextInput(server)
            compose.onNodeWithContentDescription("Allow HTTP on trusted home network").performClick()
            compose.onNodeWithText("Connect and get a code").performScrollTo().performClick()
            compose.waitUntil(30000) { compose.onAllNodes(pairingCode).fetchSemanticsNodes().isNotEmpty() }
            val code = compose.onNode(pairingCode).fetchSemanticsNode().config[SemanticsProperties.Text].first().text
            assertTrue(api.request("/api/companion/pair/approve", JSONObject().put("userCode", code)).getBoolean("approved"))
            waitForText("Trending now")
            compose.waitUntil(30000) { compose.onAllNodes(hasText("Discover") and isEnabled()).fetchSemanticsNodes().isNotEmpty() }
            compose.waitForIdle()
            compose.waitUntil(30000) { compose.onAllNodesWithContentDescription("Orbit City artwork").fetchSemanticsNodes().isNotEmpty() }
            screenshot("discovery")
            for (view in listOf("Poster grid", "Information cards", "Compact grid", "Detailed list", "Shelves")) {
                compose.onNodeWithText("View ·", substring = true).performClick()
                compose.onNodeWithText(view, substring = false).performClick()
                compose.waitUntil(10000) { compose.onAllNodesWithText("View · " + view, substring = false).fetchSemanticsNodes().isNotEmpty() }
                compose.waitForIdle()
                compose.onNode(hasText("Orbit City") and hasClickAction()).assertExists()
                if (view == "Information cards") screenshot("discover-cards-v17")
            }
            val television = (context.getSystemService(android.content.Context.UI_MODE_SERVICE) as android.app.UiModeManager).currentModeType == android.content.res.Configuration.UI_MODE_TYPE_TELEVISION
            if (television) {
                compose.onAllNodesWithText("Browse")[0].performClick()
                compose.onNode(hasText("Orbit City") and hasClickAction()).performScrollTo().performSemanticsAction(SemanticsActions.RequestFocus) { it() }
                compose.onNode(hasText("Orbit City") and hasClickAction()).performKeyInput { pressKey(Key.DirectionRight) }
                compose.onNode(hasText("The Glass Tide") and hasClickAction()).assertIsFocused()
                compose.onAllNodesWithText("The Glass Tide").assertCountEquals(2)
                for (title in listOf("The Glass Tide", "Signal North", "Far Horizon", "The Last Station", "Summer on Mars")) {
                    compose.onNode(hasText(title) and hasClickAction()).performKeyInput { pressKey(Key.DirectionRight) }
                    compose.waitForIdle()
                }
                compose.onNode(hasText("Blue Meridian") and hasClickAction()).assertIsFocused().assertIsDisplayed()
                screenshot("row-scrolled")
                for (title in listOf("Blue Meridian", "Summer on Mars", "The Last Station", "Far Horizon", "Signal North")) {
                    compose.onNode(hasText(title) and hasClickAction()).performKeyInput { pressKey(Key.DirectionLeft) }
                    compose.waitForIdle()
                }
                screenshot("wall-focused")
                compose.onNode(hasText("The Glass Tide") and hasClickAction()).performKeyInput { pressKey(Key.Enter) }
            } else {
                compose.onAllNodesWithContentDescription("Next titles")[0].performClick()
                compose.waitForIdle()
                compose.onNode(hasText("The Last Station") and hasClickAction()).assertIsDisplayed()
                compose.onAllNodesWithContentDescription("Previous titles")[0].performClick()
                compose.waitForIdle()
                compose.onNode(hasText("The Glass Tide") and hasClickAction()).performScrollTo().performClick()
            }
            waitForText("Watch trailer")
            compose.waitUntil(30000) { compose.onAllNodesWithContentDescription("The Glass Tide poster").fetchSemanticsNodes().isNotEmpty() }
            val pageBounds = compose.onNodeWithTag("detail-page").fetchSemanticsNode().boundsInRoot
            val heroBounds = compose.onNodeWithTag("detail-hero").fetchSemanticsNode().boundsInRoot
            assertEquals(pageBounds.top, heroBounds.top, 1f)
            compose.onNodeWithText("Synopsis").assert(SemanticsMatcher.keyNotDefined(SemanticsProperties.Focused))
            if (television) {
                compose.onNodeWithText("Back", substring = false).assertIsFocused().performKeyInput { pressKey(Key.DirectionDown) }
                compose.waitForIdle()
                compose.onNodeWithText("Back", substring = false).assertIsFocused().assertIsDisplayed()
                compose.onNodeWithText("Back", substring = false).performKeyInput { pressKey(Key.DirectionUp) }
                compose.waitForIdle()
            }
            screenshot("title-details")
            compose.onNodeWithText("About this title").performScrollTo().assertIsDisplayed()
            compose.onNodeWithText("Studio: Review Studio").assertExists()
            compose.onNodeWithText("Alex Morgan").performScrollTo()
            compose.onNodeWithText("Alex Morgan").assert(SemanticsMatcher.keyNotDefined(SemanticsProperties.Focused))
            compose.waitForIdle()
            compose.onNodeWithText("Alex Morgan").assertIsDisplayed()
            screenshot("title-cast")
            compose.onNodeWithText("Watch trailer").assertIsDisplayed().performClick()
            waitForText("Close trailer")
            compose.onNodeWithText("Play", substring = false).assertExists()
            compose.onNodeWithText("Pause", substring = false).assertExists()
            verifyTrailerVideoFrames(scenario, compose)
            screenshot("trailer-popup")
            compose.onNodeWithText("Close trailer").performClick()
            compose.onNodeWithText("Close trailer").assertDoesNotExist()
            scenario.onActivity { assertNull(it.window.decorView.findViewWithTag<android.webkit.WebView>("companion-trailer-player")) }
            compose.onNodeWithText("Watch trailer").assertIsDisplayed().performClick()
            waitForText("Close trailer")
            InstrumentationRegistry.getInstrumentation().sendKeyDownUpSync(android.view.KeyEvent.KEYCODE_BACK)
            compose.onNodeWithText("Close trailer").assertDoesNotExist()
            compose.onNodeWithText("Request movie").assertIsDisplayed().performClick()
            waitForText("Folder: /movies")
            compose.onNodeWithText("Request movie").performScrollTo().performClick()
            waitForText("Request submitted for approval.")
            assertTrue(api.request("/api/requests/mine").getJSONArray("items").objects().any { it.text("title") == "The Glass Tide" && it.text("status") == "pending_approval" })
            screenshot("request-approved-flow")
            scenario.recreate()
            waitForText("Request submitted for approval.")
        }
        val restored = SessionStore(context).load()
        assertNotNull(restored)
        ActivityScenario.launch(MainActivity::class.java).use {
            waitForText("Trending now")
            compose.onNodeWithText("My requests").performScrollTo().performClick()
            waitForText("Refresh status")
            compose.onNodeWithText("Sign out").performScrollTo().performClick()
            waitForText("Connect and get a code")
            assertNull(SessionStore(context).load())
            assertFalse(CompanionClient(restored!!).request("/api/auth/status").getBoolean("authenticated"))
        }
        api.request("/api/auth/logout", JSONObject())
    }
}
