package com.vynode.companion

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

// Layered highlights and transparent material avoid blurring text or expensive TV blur passes.
internal fun Modifier.glassPanel(): Modifier {
    val shape = RoundedCornerShape(22.dp)
    return shadow(14.dp, shape, clip = false, ambientColor = Color.Black.copy(alpha = .45f), spotColor = Color.Black.copy(alpha = .55f))
        .clip(shape)
        .background(Brush.linearGradient(listOf(Color(0xFFB9C5CD).copy(alpha = .16f), Color(0xFF242B31).copy(alpha = .52f), Color(0xFF10151B).copy(alpha = .68f))))
        .drawBehind {
            drawRect(Brush.radialGradient(listOf(Color.White.copy(alpha = .075f), Color.Transparent), center = Offset(size.width * .12f, 0f), radius = size.width.coerceAtLeast(1f) * .75f))
            drawLine(Brush.horizontalGradient(listOf(Color.Transparent, Color.White.copy(alpha = .25f), Color.Transparent)), Offset(24.dp.toPx(), 1.dp.toPx()), Offset(size.width - 24.dp.toPx(), 1.dp.toPx()), 1.dp.toPx())
        }
        .border(1.dp, Brush.linearGradient(listOf(Color.White.copy(alpha = .24f), Color.White.copy(alpha = .035f), Color.White.copy(alpha = .10f))), shape)
}
