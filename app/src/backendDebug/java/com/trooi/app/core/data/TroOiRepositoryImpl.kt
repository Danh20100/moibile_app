package com.trooi.app.core.data

import javax.inject.Inject

/** Backend-backed debug variant has no DemoData fallback. */
class TroOiRepositoryImpl @Inject constructor(
    backend: BackendTroOiRepository,
) : TroOiRepository by backend
