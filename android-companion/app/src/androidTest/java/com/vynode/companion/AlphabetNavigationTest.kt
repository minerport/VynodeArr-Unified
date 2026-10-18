package com.vynode.companion

import androidx.compose.ui.input.key.Key
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.lifecycle.ViewModelProvider
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class AlphabetNavigationTest {
    @get:Rule val compose = createEmptyComposeRule()
    @Test fun remoteCanReachAlphabetAndOnlyResultsLoad() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val television = (context.getSystemService(android.content.Context.UI_MODE_SERVICE) as android.app.UiModeManager).currentModeType == android.content.res.Configuration.UI_MODE_TYPE_TELEVISION
        val api = CompanionClient(Connection("http://10.0.2.2:18787", "", ""))
        api.request("/api/auth/login", JSONObject().put("identifier", "library-user").put("password", "Companion-Preview-Only1"), false)
        SessionStore(context).save(api.connection)
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            lateinit var model: CompanionModel
            scenario.onActivity { model = ViewModelProvider(it)[CompanionModel::class.java] }
            compose.waitUntil(30000) { !model.busy && model.libraryItems.isNotEmpty() }
            if (television) {
                compose.onNode(hasText("Movie library") and hasClickAction()).assertIsFocused().performKeyInput { pressKey(Key.DirectionRight) }
                compose.onNodeWithContentDescription("Alphabet selector").assertIsFocused().performKeyInput { repeat(19) { pressKey(Key.DirectionRight) } }
                compose.onNodeWithText("A–Z · S").assertExists()
                assertEquals("", model.libraryJump) // Arrows choose; OK commits.
                compose.onNodeWithContentDescription("Alphabet selector").performKeyInput { pressKey(Key.Enter) }
            } else compose.onNodeWithContentDescription("Jump to S").performScrollTo().performClick()
            compose.waitUntil(30000) { model.libraryLoading }
            compose.runOnIdle {
                assertFalse("Alphabet jumps must not use app-wide loading", model.busy)
                assertEquals("library", model.screen)
                assertEquals("Orbit City", model.libraryItems.first().text("title"))
            }
            compose.onNode(hasText("Movie library") and hasClickAction()).assertIsEnabled()
            compose.waitUntil(30000) { !model.libraryLoading && model.libraryJump == "S" }
            compose.runOnIdle { assertEquals("Signal North", model.libraryItems.first().text("title")) }
            if (television) {
                compose.onNodeWithContentDescription("Alphabet selector").assertIsFocused().performKeyInput { pressKey(Key.DirectionDown) }
                compose.onNode(hasText("Signal North") and hasClickAction()).assertIsFocused().performKeyInput { pressKey(Key.DirectionUp) }
                compose.onNodeWithContentDescription("Alphabet selector").assertIsFocused().performKeyInput { pressKey(Key.DirectionLeft); pressKey(Key.Enter) }
            } else compose.onNodeWithContentDescription("Jump to R").performScrollTo().performClick()
            compose.waitUntil(30000) { !model.libraryLoading && model.libraryJump == "R" }
            compose.onNodeWithText("No titles beginning with R in this selection.").assertExists()
            compose.runOnIdle { assertTrue(model.libraryItems.isEmpty()) }
            if (television) compose.onNodeWithContentDescription("Alphabet selector").assertIsFocused()
            compose.onNodeWithText("From start").performClick()
            compose.waitUntil(30000) { !model.libraryLoading && model.libraryJump.isEmpty() }
            compose.runOnIdle { assertEquals("Orbit City", model.libraryItems.first().text("title")) }
        }
    }
}
