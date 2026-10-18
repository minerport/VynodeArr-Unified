package com.vynode.companion

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Rule
import org.junit.Test
import org.junit.Assert.*
import org.json.JSONObject
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody

class PermissionsNavigationTest {
    @get:Rule val compose = createEmptyComposeRule()
    private fun waitText(text: String) = compose.waitUntil(30000) { compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }
    private fun login(user: String) {
        compose.onNode(hasSetTextAction()).performTextInput("10.0.2.2:18787")
        compose.onNodeWithContentDescription("Allow HTTP on trusted home network").performClick()
        compose.onNodeWithText("Sign in with account").performScrollTo().performClick()
        waitText("Good to see you.")
        compose.onNode(hasSetTextAction() and hasText("Username or email")).performTextInput(user)
        compose.onNode(hasSetTextAction() and hasText("Password")).performTextInput("Companion-Preview-Only1")
        compose.onNodeWithText("Sign in", substring = false).performScrollTo().performClick()
        compose.waitUntil(30000) { compose.onAllNodes(hasText("Account") and isEnabled()).fetchSemanticsNodes().isNotEmpty() }
    }
    @Test fun libraryUserCanBrowseWithoutDiscover() {
        SessionStore(InstrumentationRegistry.getInstrumentation().targetContext).clear()
        ActivityScenario.launch(MainActivity::class.java).use {
            login("library-user")
            compose.onNodeWithText("Discover").assertDoesNotExist()
            compose.onNodeWithText("My requests").assertDoesNotExist()
            compose.onNodeWithText("Activity").assertDoesNotExist()
            compose.onNodeWithText("Overview").assertDoesNotExist()
            waitText("Orbit City")
            compose.onNodeWithText("Show · All titles").performClick()
            compose.onNode(hasText("Missing") and !hasText("The Glass Tide")).performClick()
            waitText("Your collection · 1 titles")
            compose.onNodeWithText("Orbit City").assertDoesNotExist()
            compose.onNode(hasText("The Glass Tide") and hasClickAction()).assertExists()
            compose.onNodeWithText("Clear filters").performClick()
            waitText("Orbit City")
            compose.onNodeWithText("Sort · Title A–Z").performClick()
            compose.onNodeWithText("Newest year").performClick()
            waitText("Sort · Newest year")
            compose.waitUntil(30000) { compose.onAllNodes(hasText("Account") and isEnabled()).fetchSemanticsNodes().isNotEmpty() }
            for (view in listOf("Information cards", "Compact grid", "Detailed list", "Poster grid")) {
                compose.onNodeWithText("View ·", substring = true).performClick()
                compose.onNodeWithText(view, substring = false).performClick()
                compose.waitUntil(10000) { compose.onAllNodesWithText("View · " + view, substring = false).fetchSemanticsNodes().isNotEmpty() }
                compose.waitForIdle()
                compose.onNode(hasText("Orbit City") and hasClickAction()).assertExists()
                if (view == "Information cards") {
                    val runner = InstrumentationRegistry.getInstrumentation()
                    val image = runner.uiAutomation.takeScreenshot()
                    java.io.File(runner.targetContext.getExternalFilesDir(null), "library-cards-v17.png").outputStream().use { image.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) }
                    image.recycle()
                }
            }
            compose.onNodeWithContentDescription("Jump to T").performScrollTo().performClick()
            waitText("Sort · Title A–Z")
            compose.waitUntil(30000) { compose.onAllNodes(hasText("Account") and isEnabled()).fetchSemanticsNodes().isNotEmpty() }
            compose.waitUntil(30000) { compose.onAllNodesWithText("Orbit City").fetchSemanticsNodes().isEmpty() }
            compose.onNodeWithContentDescription("Jump to O").performScrollTo().performClick()
            waitText("Orbit City")
            compose.waitForIdle()
            val posterBounds = compose.onNodeWithContentDescription("Orbit City poster", useUnmergedTree = true).getUnclippedBoundsInRoot()
            val gridBounds = compose.onNodeWithTag("library-results").getUnclippedBoundsInRoot()
            assertTrue("Alphabet jumps must leave the first poster fully visible", posterBounds.top >= gridBounds.top)
            val instrumentation = InstrumentationRegistry.getInstrumentation()
            val shot = instrumentation.uiAutomation.takeScreenshot()
            java.io.File(instrumentation.targetContext.getExternalFilesDir(null), "library-v11.png").outputStream().use { shot.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) }
            shot.recycle()
            compose.onNode(hasText("Orbit City") and hasClickAction()).performScrollTo().performClick()
            waitText("Back to library")
            waitText("Monitoring: all")
            compose.onNodeWithText("Back to library").performClick()
            compose.onNode(hasText("TV library") and hasClickAction()).performScrollTo().performClick()
            compose.waitUntil(30000) { compose.onAllNodes(hasText("Account") and isEnabled()).fetchSemanticsNodes().isNotEmpty() }
            waitText("Afterlight")
            compose.onNode(hasText("Afterlight") and hasClickAction()).performScrollTo().performClick()
            waitText("E01  ·  Opening Signal")
            compose.onNodeWithText("Episodes · All").performClick()
            compose.onNodeWithText("Missing", substring = false).performClick()
            compose.onNodeWithText("Opening Signal", substring = true).assertDoesNotExist()
            waitText("E02  ·  Second Light")
            val episodeShot = instrumentation.uiAutomation.takeScreenshot()
            java.io.File(instrumentation.targetContext.getExternalFilesDir(null), "episodes-v17.png").outputStream().use { episodeShot.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) }
            episodeShot.recycle()
            compose.onNodeWithText("Back to library").performClick()
            compose.onNode(hasText("Calendar") and hasClickAction()).performScrollTo().performClick()
            compose.waitUntil(30000) { compose.onAllNodes(hasText("Account") and isEnabled()).fetchSemanticsNodes().isNotEmpty() }
            val today = java.time.LocalDate.now()
            val month = java.time.YearMonth.from(today)
            val monthFormat = java.time.format.DateTimeFormatter.ofPattern("MMMM yyyy")
            waitText(month.format(monthFormat))
            compose.onNodeWithContentDescription("Next month").performClick()
            waitText(month.plusMonths(1).format(monthFormat))
            compose.onNodeWithContentDescription("Previous month").performClick()
            waitText(month.format(monthFormat))
            compose.onNodeWithText("Today").performClick()
            compose.onNodeWithContentDescription(today.toString() + ",", substring = true).performScrollTo().performClick().assertIsSelected()
            compose.waitForIdle()
            waitText("Orbit City premiere")
            compose.onNodeWithText("Month agenda").performClick()
            waitText("Day agenda")
            waitText("Orbit City premiere")
            compose.onNodeWithText("Day agenda").performClick()
            val calendarShot = instrumentation.uiAutomation.takeScreenshot()
            java.io.File(instrumentation.targetContext.getExternalFilesDir(null), "calendar-v14.png").outputStream().use { calendarShot.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) }
            calendarShot.recycle()
            compose.onNodeWithText("Account").performScrollTo().performClick()
            waitText("Library User")
        }
    }
    @Test fun administratorSeesOperations() {
        SessionStore(InstrumentationRegistry.getInstrumentation().targetContext).clear()
        ActivityScenario.launch(MainActivity::class.java).use {
            login("preview-admin")
            compose.onNodeWithText("Activity").performScrollTo().performClick()
            waitText("Download activity")
            compose.waitUntil(30000) { compose.onAllNodes(hasText("Overview") and isEnabled()).fetchSemanticsNodes().isNotEmpty() }
            compose.onNodeWithText("Overview").performScrollTo().performClick()
            waitText("Movies: 3")
            compose.onNodeWithText("Health notices").assertExists()
            val instrumentation = InstrumentationRegistry.getInstrumentation()
            compose.waitForIdle()
            val overviewShot = instrumentation.uiAutomation.takeScreenshot()
            java.io.File(instrumentation.targetContext.getExternalFilesDir(null), "overview-v19.png").outputStream().use { overviewShot.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) }
            overviewShot.recycle()
            compose.onNodeWithText("Recently added").performScrollTo().assertIsDisplayed()
            compose.onNodeWithText("Recent activity").performScrollTo().assertIsDisplayed()
        }
    }
    @Test fun noPermissionsShowsAccountOnly() {
        SessionStore(InstrumentationRegistry.getInstrumentation().targetContext).clear()
        ActivityScenario.launch(MainActivity::class.java).use {
            login("no-access")
            waitText("No Access")
            for (label in listOf("Discover", "Movie library", "TV library", "Calendar", "Overview", "Activity", "My requests")) compose.onNodeWithText(label).assertDoesNotExist()
        }
    }

    @Test fun revokedLibraryPermissionIsRefreshedBeforeLoading() {
        val admin = CompanionClient(Connection("http://10.0.2.2:18787", "", ""))
        admin.request("/api/auth/login", JSONObject().put("identifier", "preview-admin").put("password", "Companion-Preview-Only1"), false)
        val name = "revoke-" + System.currentTimeMillis()
        val created = admin.request("/api/admin/users", JSONObject().put("name", "Revocation Test").put("username", name).put("email", "$name@example.test").put("password", "Companion-Preview-Only1").put("role", "user").put("permissions", JSONObject().put("movies", true))).getJSONObject("user")
        SessionStore(InstrumentationRegistry.getInstrumentation().targetContext).clear()
        ActivityScenario.launch(MainActivity::class.java).use {
            login(name)
            waitText("Orbit City")
            val request = okhttp3.Request.Builder().url("http://10.0.2.2:18787/api/admin/users/" + created.text("id"))
                .header("Cookie", "vynodearr_session=" + admin.connection.session).header("x-vynodearr-csrf", admin.connection.csrf)
                .patch("{\"action\":\"permissions\",\"permissions\":{}}".toRequestBody("application/json".toMediaType())).build()
            okhttp3.OkHttpClient().newCall(request).execute().use { response -> assertTrue(response.isSuccessful) }
            compose.onNode(hasText("Movie library") and hasClickAction()).performScrollTo().performClick()
            waitText("Your account")
            compose.onAllNodesWithText("Movie library").assertCountEquals(0)
            compose.onNodeWithText("Orbit City").assertDoesNotExist()
        }
    }
}
