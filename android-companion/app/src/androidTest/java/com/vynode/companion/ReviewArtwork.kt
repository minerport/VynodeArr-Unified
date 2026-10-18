package com.vynode.companion

import androidx.test.platform.app.InstrumentationRegistry
import coil.Coil
import coil.ImageLoader
import coil.intercept.Interceptor

/** Test APK only: deterministic artwork, with no changes to production TLS trust. */
internal fun installReviewArtwork() {
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    Coil.setImageLoader(ImageLoader.Builder(instrumentation.targetContext).components {
        add(Interceptor { chain ->
            val uri = android.net.Uri.parse(chain.request.data.toString())
            val id = uri.lastPathSegment.orEmpty()
            if (uri.host == "images.unsplash.com" && id.matches(Regex("photo-[0-9]+-[a-z0-9]+"))) {
                val bytes = instrumentation.context.assets.open("review-art/$id.jpg").use { it.readBytes() }
                chain.proceed(chain.request.newBuilder().data(bytes).build())
            } else chain.proceed(chain.request)
        })
    }.build())
}
