package com.vynode.companion

import androidx.compose.foundation.layout.*
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.tween
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.font.*
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@OptIn(ExperimentalTextApi::class)
internal val EditorialFont = FontFamily(
    Font(R.font.outfit, weight = FontWeight.Normal, variationSettings = FontVariation.Settings(FontVariation.weight(400))),
    Font(R.font.outfit, weight = FontWeight.Medium, variationSettings = FontVariation.Settings(FontVariation.weight(500))),
    Font(R.font.outfit, weight = FontWeight.SemiBold, variationSettings = FontVariation.Settings(FontVariation.weight(600))),
    Font(R.font.outfit, weight = FontWeight.Bold, variationSettings = FontVariation.Settings(FontVariation.weight(700)))
)
internal val PageTitle = TextStyle(fontFamily = EditorialFont, fontWeight = FontWeight.SemiBold, fontSize = 28.sp, lineHeight = 32.sp, letterSpacing = (-.6).sp)
internal val SectionTitle = TextStyle(fontFamily = EditorialFont, fontWeight = FontWeight.Medium, fontSize = 17.sp, lineHeight = 22.sp, letterSpacing = (-.2).sp)
internal val PosterTitle = TextStyle(fontFamily = EditorialFont, fontWeight = FontWeight.Medium, fontSize = 13.sp, lineHeight = 17.sp)
internal val Caption = TextStyle(fontFamily = EditorialFont, fontWeight = FontWeight.Normal, fontSize = 11.sp, lineHeight = 16.sp, letterSpacing = .1.sp)
internal val Reading = TextStyle(fontFamily = EditorialFont, fontSize = 14.sp, lineHeight = 21.sp)
internal val CompanionTypography = Typography(
    displayLarge = PageTitle, displayMedium = PageTitle, displaySmall = PageTitle,
    headlineLarge = PageTitle, headlineMedium = PageTitle, headlineSmall = PageTitle,
    titleLarge = SectionTitle, titleMedium = SectionTitle, titleSmall = PosterTitle,
    bodyLarge = Reading, bodyMedium = Reading, bodySmall = Caption,
    labelLarge = PosterTitle, labelMedium = Caption, labelSmall = Caption
)

@Composable
internal fun TitlePreview(title: String, metadata: String, overview: String, status: String, action: String, enabled: Boolean, onClick: () -> Unit) {
    Column(Modifier.width(208.dp).fillMaxHeight().glassPanel().padding(18.dp)) {
        Column(Modifier.weight(1f).animateContentSize(tween(200)).verticalScroll(rememberScrollState())) {
            Text("SELECTED TITLE", style = Caption, color = Muted, letterSpacing = 1.3.sp)
            Spacer(Modifier.height(16.dp))
            Text(title, style = PageTitle.copy(fontSize = 26.sp, lineHeight = 30.sp), color = Color.White)
            Spacer(Modifier.height(10.dp))
            Text(metadata, style = Caption, color = Mint)
            Spacer(Modifier.height(24.dp))
            Text(overview.ifBlank { "Open this title for more information." }, style = Reading, color = Color(0xFFD0D4DF), maxLines = 8, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(24.dp))
            HorizontalDivider(color = Color.White.copy(alpha = .10f))
            Spacer(Modifier.height(12.dp))
            Text(status, style = Caption, color = Muted)
            Spacer(Modifier.height(16.dp))
        }
        Action(action, enabled, primary = true, modifier = Modifier.fillMaxWidth(), onClick = onClick)
    }
}
