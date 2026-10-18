package com.vynode.companion

import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class LibraryAlphabetTest {
    private fun title(name: String, sort: String = name) = JSONObject().put("title", name).put("sortTitle", sort)
    private suspend fun find(letter: String, rows: List<JSONObject>): Int? = libraryLetterOffset(letter, rows.size) { offset, count -> rows.drop(offset).take(count) }
    @Test fun usesSortTitleInsteadOfDisplayTitleCounts() = runBlocking {
        val rows = listOf(title("2001"), title("The Apple", "apple"), title("A Beacon", "beacon"), title("Orbit City"), title("The Signal", "signal"))
        assertEquals(1, find("A", rows))
        assertEquals(2, find("B", rows))
        assertEquals(4, find("S", rows))
        assertNull(find("T", rows))
        assertNull(find("Q", rows))
    }
    @Test fun findsFirstExactMatchBeyondFirstPageWithoutScanningWholeLibrary() = runBlocking {
        val rows = (0..999).map { title("A title $it") } + (0..499).map { title("The Signal $it", "signal $it") }
        var requests = 0
        val offset = libraryLetterOffset("S", rows.size) { start, count -> requests++; rows.drop(start).take(count) }
        assertEquals(1000, offset)
        assertTrue(requests <= 13)
    }
    @Test fun emptyLettersAndEmptyLibraryNeverSelectNeighbours() = runBlocking {
        assertNull(find("A", emptyList()))
        assertNull(find("Z", listOf(title("Orbit City"))))
        assertNull(find("A", listOf(title("Orbit City"))))
    }
    @Test fun numericAndNonLatinTitlesUseHashGroup() = runBlocking {
        assertEquals(0, find("#", listOf(title("2001"), title("Apple"))))
        assertEquals(1, find("#", listOf(title("Apple"), title("東京"))))
        assertNull(find("#", listOf(title("Apple"))))
    }
}
