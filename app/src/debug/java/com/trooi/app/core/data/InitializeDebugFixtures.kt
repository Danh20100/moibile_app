package com.trooi.app.core.data

import android.content.Context
import com.trooi.app.core.demo.DebugFixtureCatalog

internal fun initializeDebugFixtures(context: Context) {
    if (!RuntimeDataSource.isBackendBacked()) DebugFixtureCatalog.initialize { path ->
        context.assets.open(path).bufferedReader(Charsets.UTF_8).use { it.readText() }
    }
}
