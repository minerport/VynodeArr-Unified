package com.vynode.companion

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Rule
import org.junit.Test
import org.junit.Assert.*
import org.junit.Assume.assumeTrue

class AccountSignInTest {
    @get:Rule val compose = createEmptyComposeRule()
    private fun waitText(value: String) = compose.waitUntil(30000) { compose.onAllNodesWithText(value).fetchSemanticsNodes().isNotEmpty() }
    private fun enterServer(value: String) {
        compose.onNode(hasSetTextAction()).performTextInput(value)
        compose.onNodeWithContentDescription("Allow HTTP on trusted home network").performClick()
        compose.onNodeWithText("Sign in with account").performScrollTo().performClick()
        waitText("Good to see you.")
    }
    private fun screenshot(name: String) {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val bitmap = instrumentation.uiAutomation.takeScreenshot()
        java.io.File(instrumentation.targetContext.getExternalFilesDir(null), "$name.png").outputStream().use { bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) }
        bitmap.recycle()
    }
    @Test fun existingAccountLoginAndBadPasswordRecovery() {
        installReviewArtwork()
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        SessionStore(context).clear()
        ActivityScenario.launch(MainActivity::class.java).use {
            enterServer("10.0.2.2:18787")
            compose.onNode(hasSetTextAction() and hasText("Username or email")).performTextInput("preview-user")
            compose.onNode(hasSetTextAction() and hasText("Password")).performTextInput("incorrect-preview-password")
            compose.onNodeWithText("Sign in", substring = false).performScrollTo().performClick()
            waitText("Your username or password was not accepted. Please try again.")
            compose.onNode(hasSetTextAction() and hasText("Password")).performTextInput("Companion-Preview-Only1")
            compose.onNodeWithText("Sign in", substring = false).performScrollTo().performClick()
            waitText("IN THE SPOTLIGHT")
            compose.waitUntil(30000) { compose.onAllNodes(hasText("Discover") and isEnabled()).fetchSemanticsNodes().isNotEmpty() }
            assertNotNull(SessionStore(context).load())
            compose.onNodeWithText("Sign out").performScrollTo().performClick()
            waitText("Sign in with account")
            assertNull(SessionStore(context).load())
        }
    }
    @Test fun liveServerConnectionOnly() {
        val live = InstrumentationRegistry.getArguments().getString("liveServer")
        assumeTrue("Opt-in read-only live connection check", live != null)
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        SessionStore(context).clear()
        ActivityScenario.launch(MainActivity::class.java).use {
            enterServer(live!!)
            compose.onNodeWithText("Connected to http://$live").assertExists()
            compose.onNode(hasSetTextAction() and hasText("Username or email")).assertExists()
            compose.onNode(hasSetTextAction() and hasText("Password")).assertExists()
            screenshot("live-server-connected")
        }
    }
}
