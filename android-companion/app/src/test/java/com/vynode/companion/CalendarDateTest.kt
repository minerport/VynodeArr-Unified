package com.vynode.companion
import org.junit.Assert.*
import org.junit.Test
import java.time.*

class CalendarDateTest {
    @Test fun datesAndInstantsKeepTheirMeaning() {
        assertEquals(LocalDate.of(2028, 2, 29), calendarDate("2028-02-29"))
        val instant = Instant.parse("2026-12-31T23:30:00Z")
        assertEquals(instant.atZone(ZoneId.systemDefault()).toLocalDate(), calendarDate(instant.toString()))
        assertNull(calendarDate("not-a-date"))
        assertNull(calendarDate("2026-02-30"))
    }
}
