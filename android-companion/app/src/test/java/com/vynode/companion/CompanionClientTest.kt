package com.vynode.companion

import org.junit.Assert.*
import org.junit.Test
import org.json.JSONObject

class CompanionClientTest {
    @Test fun serverAddressesRequireHttpsOrExplicitPrivateLan() {
        assertEquals("https://example.com", normalizeServer(" https://example.com/ ", false))
        assertEquals("http://192.168.1.20:8080", normalizeServer("http://192.168.1.20:8080", true))
        assertEquals("http://10.0.0.86:8686", normalizeServer("10.0.0.86:8686", true))
        assertEquals("https://example.com", normalizeServer("example.com", false))
        assertThrows(IllegalArgumentException::class.java) { normalizeServer("http://10.notprivate.0.0.1", true) }
        listOf("http://example.com", "http://8.8.8.8", "https://user:password@example.com", "https://example.com/other", "https://example.com?secret=yes", "file:///tmp/test", "https://example.com:99999").forEach { value ->
            assertThrows(IllegalArgumentException::class.java) { normalizeServer(value, true) }
        }
        assertThrows(IllegalArgumentException::class.java) { normalizeServer("http://192.168.1.20", false) }
    }
    @Test fun requestsKeepExactIdentityEngineAndDestination() {
        val options = JSONObject("""{"match":{"title":"Example","tmdbId":123,"tvdbId":456}}""")
        val item = Media(123, "tv", "Example", "2026", "", "", "")
        val result = requestPayload(item, options, "tv-second", "family", "/tv/family", 7)
        assertEquals(123, result.getInt("tmdbId")); assertEquals("tv-second", result.getString("engineInstanceId"))
        val payload = result.getJSONObject("payload")
        assertEquals(456, payload.getInt("tvdbId")); assertEquals("family", payload.getString("mediaDestinationId"))
        assertEquals("/tv/family", payload.getString("rootFolderPath")); assertEquals(7, payload.getInt("qualityProfileId"))
        assertTrue(payload.getJSONObject("addOptions").getBoolean("searchForMissingEpisodes"))
        assertEquals("all", payload.getJSONObject("addOptions").getString("monitor"))
    }
    @Test fun invalidRequestOptionsCannotSubmit() {
        val item = Media(1, "movie", "Test", "", "", "", "")
        assertThrows(IllegalStateException::class.java) { requestPayload(item, JSONObject(), "", "", "/movies", 1) }
        assertThrows(IllegalArgumentException::class.java) { requestPayload(item, JSONObject("""{"match":{"tmdbId":1}}"""), "", "", "", 0) }
    }
    @Test fun nullMetadataDoesNotBecomeLiteralNull() {
        val item = Media.from(JSONObject("""{"tmdbId":1,"title":"Test","poster":null,"year":null}"""))
        assertEquals("", item.poster); assertEquals("", item.year)
    }
    @Test fun loginCapturesCookieAndSendsCsrfWithoutSavingPassword() {
        val server = java.net.ServerSocket(0, 2, java.net.InetAddress.getByName("127.0.0.1"))
        val worker = kotlin.concurrent.thread(isDaemon = true) {
            repeat(2) { index -> server.accept().use { socket ->
                socket.soTimeout = 5000
                val reader = socket.getInputStream().bufferedReader()
                reader.readLine()
                val headers = mutableMapOf<String, String>()
                while (true) { val line = reader.readLine() ?: break; if (line.isEmpty()) break; headers[line.substringBefore(':').lowercase()] = line.substringAfter(':').trim() }
                repeat(headers["content-length"]?.toIntOrNull() ?: 0) { reader.read() }
                val valid = headers["cookie"] == "vynodearr_session=test-session" && headers["x-vynodearr-csrf"] == "test-csrf"
                val body = if (index == 0) """{"authenticated":true,"csrf":"test-csrf"}""" else """{"valid":$valid}"""
                val cookie = if (index == 0) "Set-Cookie: vynodearr_session=test-session; Path=/; HttpOnly\r\n" else ""
                socket.getOutputStream().write(("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nConnection: close\r\n${cookie}Content-Length: ${body.length}\r\n\r\n$body").toByteArray())
            } }
        }
        try {
            val client = CompanionClient(Connection("http://127.0.0.1:${server.localPort}", "", ""))
            client.request("/api/auth/login", JSONObject().put("identifier", "test").put("password", "test-password"), false)
            assertEquals("test-session", client.connection.session)
            assertTrue(client.request("/api/protected", JSONObject()).getBoolean("valid"))
        } finally { server.close(); worker.join(1000) }
    }
}
