package com.trooi.app.core.di

import com.trooi.app.core.data.TroOiRepository
import com.trooi.app.core.data.TroOiRepositoryImpl
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {
    @Binds
    abstract fun bindTroOiRepository(impl: TroOiRepositoryImpl): TroOiRepository
}
