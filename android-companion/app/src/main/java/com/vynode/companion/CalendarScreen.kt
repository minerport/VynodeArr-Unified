package com.vynode.companion

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.*
import java.time.format.DateTimeFormatter
import java.util.Locale

internal fun calendarDate(value: String): LocalDate? = runCatching {
    if (value.length == 10) LocalDate.parse(value)
    else Instant.parse(value).atZone(ZoneId.systemDefault()).toLocalDate()
}.getOrNull()

@Composable
internal fun ColumnScope.CalendarScreen(model: CompanionModel, tv: Boolean) {
    val locale = LocalConfiguration.current.locales[0]
    val today = remember { LocalDate.now() }
    var month by remember { mutableStateOf(YearMonth.from(today)) }
    var selected by remember { mutableStateOf(today) }
    var filter by remember { mutableStateOf("all") }
    var agendaMode by remember { mutableStateOf(false) }
    var agendaPage by remember { mutableIntStateOf(0) }
    LaunchedEffect(selected, filter, agendaMode, model.records) { agendaPage = 0 }
    val filtered = model.records.filter { filter == "all" || it.text("domain") == filter }
    val events = filtered.groupBy { calendarDate(it.text("dateUtc")) }
    val monthLabel = month.format(DateTimeFormatter.ofPattern("MMMM yyyy", locale))
    Row(Modifier.fillMaxWidth().padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text("Calendar", style = PageTitle)
            Text("Upcoming movies & episodes", style = Caption, color = Muted)
        }
        Action("Refresh", !model.busy, compact = true) { model.calendarMonth(month) }
    }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        BrowseChoice("Show", when(filter) { "movie" -> "Movies"; "tv" -> "TV episodes"; else -> "All releases" }, listOf("all" to "All releases", "movie" to "Movies", "tv" to "TV episodes")) { filter = it }
        Action(if (agendaMode) "Day agenda" else "Month agenda", compact = true) { agendaMode = !agendaMode }
    }
    Spacer(Modifier.height(10.dp))
    val calendar: @Composable () -> Unit = {
        Column(Modifier.fillMaxWidth().glassPanel().padding(if (tv) 16.dp else 10.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Action("‹", modifier = Modifier.semantics { contentDescription = "Previous month" }, compact = true) { month = month.minusMonths(1); selected = month.atDay(1); model.calendarMonth(month) }
                Text(monthLabel, style = SectionTitle, modifier = Modifier.weight(1f))
                Action("Today", compact = true) { month = YearMonth.from(today); selected = today; model.calendarMonth(month) }
                Action("›", modifier = Modifier.semantics { contentDescription = "Next month" }, compact = true) { month = month.plusMonths(1); selected = month.atDay(1); model.calendarMonth(month) }
            }
            Row(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                for (day in java.time.DayOfWeek.values().map { it.getDisplayName(java.time.format.TextStyle.SHORT, locale) }) Box(Modifier.weight(1f), contentAlignment = Alignment.Center) { Text(day, style = Caption, color = Muted) }
            }
            val offset = month.atDay(1).dayOfWeek.value - 1
            val cells = ((offset + month.lengthOfMonth() + 6) / 7) * 7
            for (week in 0 until cells / 7) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                for (column in 0..6) {
                    val number = week * 7 + column - offset + 1
                    if (number !in 1..month.lengthOfMonth()) Spacer(Modifier.weight(1f).height(if (tv) 43.dp else 48.dp))
                    else {
                        val date = month.atDay(number)
                        val count = events[date].orEmpty().size
                        var focused by remember(date) { mutableStateOf(false) }
                        Surface(onClick = { selected = date }, shape = RoundedCornerShape(10.dp),
                            color = if (selected == date) Mint.copy(alpha = .25f) else Color.White.copy(alpha = .025f),
                            border = if (focused || date == today) BorderStroke(if (focused) 2.dp else 1.dp, if (focused) Mint else Mint.copy(alpha = .45f)) else null,
                            modifier = Modifier.weight(1f).padding(bottom = 4.dp).height(if (tv) 39.dp else 48.dp).onFocusChanged { focused = it.isFocused }.semantics { contentDescription = "$date, $count releases"; this.selected = selected == date }) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                                Text(number.toString(), style = PosterTitle, color = if (selected == date) Color.White else Muted)
                                if (count > 0) Text("• $count", color = Mint, fontSize = 9.sp, lineHeight = 10.sp)
                            }
                        }
                    }
                }
            }
        }
    }
    val agenda: @Composable () -> Unit = {
        Column(Modifier.fillMaxWidth().glassPanel().padding(16.dp)) {
            Text(if (agendaMode) monthLabel else selected.format(DateTimeFormatter.ofPattern("EEEE, MMM d", locale)), style = SectionTitle)
            Spacer(Modifier.height(12.dp))
            val entries = if (agendaMode) filtered.filter { calendarDate(it.text("dateUtc"))?.let { date -> YearMonth.from(date) == month } == true }.sortedBy { it.text("dateUtc") } else events[selected].orEmpty()
            Text(entries.size.toString() + " releases", style = Caption, color = Muted)
            if (entries.size > 4) Row {
                Action("Earlier", agendaPage > 0, compact = true) { agendaPage-- }
                Action("Later", (agendaPage + 1) * 4 < entries.size, compact = true) { agendaPage++ }
            }
            if (entries.isEmpty()) Text(if (model.busy) "Loading releases…" else if (model.message.isNotBlank()) "Could not load releases. Try Refresh." else "No releases returned for this day.", style = Reading, color = Muted)
            entries.drop(agendaPage * 4).take(4).forEach { event ->
                HorizontalDivider(Modifier.padding(vertical = 10.dp), color = Mint.copy(alpha = .10f))
                if (agendaMode) Text(calendarDate(event.text("dateUtc"))?.format(DateTimeFormatter.ofPattern("EEE, MMM d", locale)).orEmpty(), style = Caption, color = Mint)
                Text(event.text("title"), style = PosterTitle)
                Text(listOf(event.text("context"), event.text("eventType").replace('_', ' '), event.text("status")).filter { it.isNotBlank() }.joinToString(" · "), style = Caption, color = Muted)
                Spacer(Modifier.height(14.dp))
            }
        }
    }
    if (tv) Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(18.dp)) {
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) { calendar() }
        Column(Modifier.width(265.dp).verticalScroll(rememberScrollState())) { agenda() }
    } else Column(Modifier.weight(1f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(16.dp)) { calendar(); agenda() }
}
