package com.trooi.app.core.data

import android.content.Context
import com.trooi.app.core.demo.DebugFixtureCatalog

internal fun initializeDebugFixtures(context: Context) {
    // Demo preview screens and compose instrumentation read the catalog even when the
    // repository stays backend-backed. Loading assets does not change source routing.
    DebugFixtureCatalog.initialize { path ->
        context.assets.open(path).bufferedReader(Charsets.UTF_8).use { it.readText() }
    }
}
