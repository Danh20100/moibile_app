package com.trooi.app.features.profile

import android.content.Context
import com.google.gson.Gson

/** Offline catalog shared by help and legal navigation; legal text stays in versioned Markdown assets. */
data class ProfileCatalog(
    val version: Int = 1,
    val locale: String = "vi-VN",
    val legal: List<ProfileCatalogLegal> = emptyList(),
    val help: List<ProfileCatalogHelp> = emptyList(),
)
data class ProfileCatalogLegal(val id: String, val title: String, val route: String, val asset: String)
data class ProfileCatalogHelp(
    val id: String,
    val title: String,
    val summary: String,
    val paragraphs: List<String>,
)

internal fun loadProfileCatalog(context: Context): ProfileCatalog? = runCatching {
    val json = context.assets.open("content/profile-catalog.vi.json")
        .bufferedReader(Charsets.UTF_8).use { it.readText() }
    Gson().fromJson(json, ProfileCatalog::class.java)
}.getOrNull()?.takeIf { it.version == 1 && it.locale == "vi-VN" }
