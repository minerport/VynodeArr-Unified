package com.vynode.companion

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.dp
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class DetailsLayoutTest {
    @get:Rule val compose = createComposeRule()
    @Test fun longTitleAndMetadataKeepPosterInsideHero() {
        val title = "The Extraordinary Adventures of the Last Lighthouse Keeper Beyond the Northern Sea"
        compose.setContent {
            MaterialTheme {
                Column(Modifier.width(360.dp).verticalScroll(rememberScrollState())) {
                    DetailHero(Media(1, "movie", title, "2026", "", "", "8.5"), JSONObject().put("genres", org.json.JSONArray(listOf("Adventure", "Mystery", "Science Fiction", "Drama", "Fantasy"))).put("runtime", 180).put("certification", "PG-13"), false)
                }
            }
        }
        val hero = compose.onNodeWithTag("detail-hero").fetchSemanticsNode().boundsInRoot
        val poster = compose.onNodeWithTag("detail-poster").fetchSemanticsNode().boundsInRoot
        val titleBounds = compose.onNodeWithText(title).fetchSemanticsNode().boundsInRoot
        assertTrue("Full long title stays inside header", titleBounds.top >= hero.top && titleBounds.bottom <= hero.bottom)
        assertTrue("Poster top stays inside hero", poster.top >= hero.top)
        assertTrue("Poster bottom stays inside hero", poster.bottom <= hero.bottom)
        compose.onNodeWithText(title).assertExists()
    }
}
