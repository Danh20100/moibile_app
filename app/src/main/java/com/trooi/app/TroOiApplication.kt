package com.trooi.app

import android.app.Application
import com.trooi.app.core.data.RuntimeDataSource
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class TroOiApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        RuntimeDataSource.initialize(this)
        com.trooi.app.core.data.initializeDebugFixtures(this)
    }
}
