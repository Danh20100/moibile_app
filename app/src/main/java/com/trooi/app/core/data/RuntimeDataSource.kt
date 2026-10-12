package com.trooi.app.core.data

import android.content.Context
import com.trooi.app.BuildConfig

/** Debug-only persisted data-source choice; release always uses the backend. */
enum class AppDataSource { MOCK, BACKEND }

object RuntimeDataSource {
    private const val PREFS = "trooi_developer_settings"
    private const val KEY_MODE = "data_source"

    @Volatile
    private var selected: AppDataSource =
        if (BuildConfig.DEBUG) AppDataSource.MOCK else AppDataSource.BACKEND

    fun initialize(context: Context) {
        selected = if (BuildConfig.DEBUG) {
            val name = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getString(KEY_MODE, AppDataSource.MOCK.name)
            if (name == AppDataSource.BACKEND.name) AppDataSource.BACKEND else AppDataSource.MOCK
        } else {
            AppDataSource.BACKEND
        }
    }

    fun currentMode(): AppDataSource =
        if (BuildConfig.DEBUG) selected else AppDataSource.BACKEND

    fun isBackendBacked(): Boolean = currentMode() == AppDataSource.BACKEND

    fun chooseDebugSource(context: Context, mode: AppDataSource): Boolean {
        if (!BuildConfig.DEBUG) return false
        val saved = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY_MODE, mode.name).commit()
        if (saved) selected = mode
        return saved
    }
}
