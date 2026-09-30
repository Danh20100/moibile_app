package com.trooi.app.core.data

import javax.inject.Inject

/** Release uses the fail-closed backend repository, never preview fixtures. */
class TroOiRepositoryImpl @Inject constructor(
    backend: BackendTroOiRepository,
) : TroOiRepository by backend
