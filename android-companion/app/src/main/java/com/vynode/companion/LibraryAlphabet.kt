package com.vynode.companion

import org.json.JSONObject
import java.util.Locale

internal fun librarySortKey(item: JSONObject): String = item.text("sortTitle").ifBlank { item.text("title") }.lowercase(Locale.ROOT)
internal fun libraryTitleLetter(item: JSONObject): String = librarySortKey(item).firstOrNull()?.uppercaseChar()?.takeIf { it in 'A'..'Z' }?.toString() ?: "#"

// Older servers count display-title initials, but order pages by sortTitle.
// Locate the boundary in the actual ordered results rather than trusting those offsets.
internal suspend fun libraryLetterOffset(letter: String, total: Int, fetch: suspend (Int, Int) -> List<JSONObject>): Int? {
    require(letter in listOf("#") + ('A'..'Z').map { it.toString() })
    if (letter == "#") {
        var offset = 0
        while (offset < total) {
            val rows = fetch(offset, 200)
            if (rows.isEmpty()) return null
            val match = rows.indexOfFirst { libraryTitleLetter(it) == "#" }
            if (match >= 0) return offset + match
            offset += rows.size
        }
        return null
    }
    val target = letter.lowercase(Locale.ROOT)
    var low = 0
    var high = total
    while (low < high) {
        val mid = low + (high - low) / 2
        val row = fetch(mid, 1).firstOrNull() ?: return null
        if (librarySortKey(row) < target) low = mid + 1 else high = mid
    }
    return if (low < total && fetch(low, 1).firstOrNull()?.let(::libraryTitleLetter) == letter) low else null
}
