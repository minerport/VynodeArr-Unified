package com.vynode.companion

import org.junit.Assert.*
import org.junit.Test

class TrailerPlayerTest {
    @Test fun acceptsSupportedYouTubeLinksOnly() {
        listOf("https://www.youtube.com/watch?v=M7lc1UVf-VE", "https://youtu.be/M7lc1UVf-VE?t=12", "https://m.youtube.com/watch?feature=share&v=M7lc1UVf-VE", "https://youtube.com/embed/M7lc1UVf-VE", "https://youtube.com/shorts/M7lc1UVf-VE").forEach {
            assertEquals("M7lc1UVf-VE", youtubeVideoId(it))
        }
        listOf("http://youtube.com/watch?v=M7lc1UVf-VE", "https://youtube.com.evil.test/watch?v=M7lc1UVf-VE", "https://evil.test/watch?v=M7lc1UVf-VE", "https://user@youtube.com/watch?v=M7lc1UVf-VE", "https://youtube.com:444/watch?v=M7lc1UVf-VE", "https://youtube.com/watch?v=bad", "https://youtube.com/watch?v=%27%3Cscript%3E", "javascript:alert(1)", "https://youtu.be/M7lc1UVf-VE/more", "https://youtube.com/").forEach {
            assertNull(it, youtubeVideoId(it))
        }
    }
    @Test fun embedsOnlyValidatedVideoAndAppIdentity() {
        val html = trailerPage("M7lc1UVf-VE", "https://com.vynode.companion")
        assertTrue(html.contains("https://www.youtube.com/iframe_api"))
        assertTrue(html.contains("origin:'https://com.vynode.companion'"))
        assertThrows(IllegalArgumentException::class.java) { trailerPage("<script>", "https://com.vynode.companion") }
        assertThrows(IllegalArgumentException::class.java) { trailerPage("M7lc1UVf-VE", "https://evil.test/'") }
    }
}
