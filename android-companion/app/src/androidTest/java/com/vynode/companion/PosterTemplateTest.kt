package com.vynode.companion

import androidx.test.platform.app.InstrumentationRegistry
import androidx.core.graphics.drawable.toBitmap
import coil.ImageLoader
import coil.decode.SvgDecoder
import coil.request.ImageRequest
import coil.request.SuccessResult
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class PosterTemplateTest {
    @Test fun composedTemplateDecodesWithItsPoster() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val api = CompanionClient(Connection("http://10.0.2.2:18787", "", ""))
        api.request("/api/auth/login", JSONObject().put("identifier", "library-user").put("password", "Companion-Preview-Only1"), false)
        val item = api.request("/api/media/movies?limit=40&offset=0&query=&filter=all&sort=title&direction=ascending&engineInstanceId=all").getJSONArray("items").objects().first { it.text("title") == "Orbit City" }
        assertNotNull("Fixture must have an assigned template", item.optJSONObject("artwork")?.optJSONObject("overlayTemplate"))
        val loader = ImageLoader.Builder(context).components { add(SvgDecoder.Factory()) }.build()
        val result = loader.execute(ImageRequest.Builder(context).data("http://10.0.2.2:18787/api/artwork/composed/movie/" + item.text("id"))
            .addHeader("Cookie", "vynodearr_session=" + api.connection.session).size(600,900).allowHardware(false).build())
        assertTrue("Composed artwork must decode", result is SuccessResult)
        val bitmap = (result as SuccessResult).drawable.toBitmap(600,900)
        val colors = mutableSetOf<Int>()
        for (y in 180 until 720 step 5) for (x in 60 until 540 step 5) colors.add(bitmap.getPixel(x,y))
        assertTrue("Embedded photograph must be visible, not only the overlay", colors.size > 500)
        java.io.File(context.getExternalFilesDir(null), "composed-template-v17.png").outputStream().use { bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,it) }
        loader.shutdown()
    }
}
