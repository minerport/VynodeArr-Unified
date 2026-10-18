package com.vynode.companion

import java.net.HttpURLConnection
import java.net.URI
import java.net.URLEncoder
import org.json.JSONArray
import org.json.JSONObject

data class Connection(val server: String, val session: String, val csrf: String)
class ApiException(val status: Int, message: String) : Exception(message)

fun normalizeServer(value: String, allowLanHttp: Boolean): String {
    val raw = value.trim()
    val uri = URI(if (raw.contains("://")) raw else (if (allowLanHttp) "http://" else "https://") + raw)
    require(uri.host != null && uri.userInfo == null && uri.query == null && uri.fragment == null && uri.path.orEmpty().trim('/').isEmpty()) { "Enter a server origin, for example https://media.example.com" }
    val hostParts = uri.host.split('.')
    val parts = hostParts.mapNotNull { it.toIntOrNull() }
    val privateIp = hostParts.size == 4 && parts.size == 4 && parts.all { it in 0..255 } && (parts[0] == 10 || (parts[0] == 192 && parts[1] == 168) || (parts[0] == 172 && parts[1] in 16..31))
    require(uri.scheme == "https" || (uri.scheme == "http" && allowLanHttp && privateIp)) { "Use HTTPS, or explicitly allow HTTP for a private LAN IPv4 address." }
    require(uri.port == -1 || uri.port in 1..65535) { "Invalid server port." }
    return uri.toString().trimEnd('/')
}
fun encode(value: String): String = URLEncoder.encode(value, "UTF-8")
fun JSONArray.objects(): List<JSONObject> = (0 until length()).mapNotNull { optJSONObject(it) }
fun JSONObject.text(key: String): String = if (isNull(key)) "" else optString(key)

class CompanionClient(var connection: Connection) {
    fun request(path: String, input: JSONObject? = null, authenticated: Boolean = true): JSONObject {
        require(path.startsWith("/api/") && !path.contains("\r") && !path.contains("\n"))
        val conn = URI(connection.server + path).toURL().openConnection() as HttpURLConnection
        try {
            conn.instanceFollowRedirects = false
            conn.connectTimeout = 15000; conn.readTimeout = 45000
            conn.requestMethod = if (input == null) "GET" else "POST"
            conn.setRequestProperty("Accept", "application/json")
            conn.setRequestProperty("User-Agent", "VynodeArr Companion Android/0.3")
            if (authenticated && connection.session.isNotEmpty()) {
                conn.setRequestProperty("Cookie", "vynodearr_session=${connection.session}")
                conn.setRequestProperty("x-vynodearr-csrf", connection.csrf)
            }
            if (input != null) {
                conn.doOutput = true; conn.setRequestProperty("Content-Type", "application/json")
                conn.outputStream.use { it.write(input.toString().toByteArray(Charsets.UTF_8)) }
            }
            val code = conn.responseCode
            if (code in 300..399) throw ApiException(code, "The server redirected this request. Enter its final HTTPS address.")
            val raw = (if (code in 200..299) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() }.orEmpty()
            val result = try { JSONObject(raw) } catch (_: Exception) { throw ApiException(code, "This address did not return a VynodeArr API response. Check the server address and version.") }
            if (code !in 200..299) throw ApiException(code, result.optJSONObject("error")?.text("message")?.takeIf { it.isNotEmpty() } ?: "Server request failed ($code).")
            if (path == "/api/auth/login" && result.optBoolean("authenticated")) {
                val cookie = conn.headerFields.entries.filter { it.key.equals("set-cookie", ignoreCase = true) }.flatMap { it.value }.map { it.substringBefore(';').trim() }.firstOrNull { it.startsWith("vynodearr_session=") }
                val session = cookie?.substringAfter('=').orEmpty()
                val csrf = result.text("csrf")
                if (!session.matches(Regex("[A-Za-z0-9_-]+")) || csrf.isBlank()) throw ApiException(502, "The server did not return a valid sign-in session.")
                connection = connection.copy(session = session, csrf = csrf)
            }
            return result
        } finally { conn.disconnect() }
    }
}

data class Media(val id: Int, val domain: String, val title: String, val year: String, val overview: String, val poster: String, val rating: String, val backdrop: String = "") {
    companion object {
        fun from(value: JSONObject) = Media(value.optInt("tmdbId"), value.optString("domain", "movie"), value.optString("title", "Untitled"), value.text("year"), value.text("overview"), value.text("poster"), value.optDouble("rating", 0.0).let { if (it > 0) String.format(java.util.Locale.US, "%.1f", it) else "" }, value.text("backdrop"))
    }
}

fun requestPayload(item: Media, options: JSONObject, engine: String, destination: String, root: String, profile: Int): JSONObject {
    val match = options.optJSONObject("match") ?: error("The server could not match this title to the media engine.")
    require(root.isNotBlank() && profile > 0) { "Choose a configured destination or library folder and quality profile." }
    val payload = JSONObject(match.toString()).put("rootFolderPath", root).put("qualityProfileId", profile).put("monitored", true)
    if (engine.isNotEmpty()) payload.put("engineInstanceId", engine)
    if (destination.isNotEmpty()) payload.put("mediaDestinationId", destination)
    if (item.domain == "movie") payload.put("minimumAvailability", "announced").put("addOptions", JSONObject().put("searchForMovie", true))
    else payload.put("seriesType", "standard").put("seasonFolder", true).put("monitor", "all").put("addOptions", JSONObject().put("monitor", "all").put("searchForMissingEpisodes", true).put("searchForCutoffUnmetEpisodes", false))
    return JSONObject().put("domain", item.domain).put("tmdbId", item.id).put("engineInstanceId", engine).put("payload", payload)
}
