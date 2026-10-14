package com.trooi.app.core.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class AmenityCatalogTest {
    @Test fun idsAreStableUniqueAndSeparateFromLabels() {
        assertEquals(AmenityCatalog.options.size, AmenityCatalog.options.map { it.id }.toSet().size)
        assertEquals(AmenityCatalog.options.size, AmenityCatalog.options.map { it.label }.toSet().size)
        assertNotEquals(AmenityCatalog.options.first().id, AmenityCatalog.options.first().label)
        assertEquals("unrecognized", AmenityCatalog.label("unrecognized"))
    }
}
