package com.trooi.app.core.di

import com.trooi.app.BuildConfig
import com.trooi.app.core.network.*
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class NetworkBindings {
    @Binds abstract fun bindAuthTokenProvider(provider: InMemoryAuthTokenProvider): AuthTokenProvider
    @Binds abstract fun bindBackendApi(implementation: OkHttpBackendApi): BackendApi
}

@Module
@InstallIn(SingletonComponent::class)
object BackendNetworkModule {
    @Provides @Singleton
    fun backendClient(provider: AuthTokenProvider): BackendClient = BackendClient(
        rawBaseUrl = BuildConfig.BACKEND_API_BASE_URL,
        tokens = provider,
        allowLocalHttp = BuildConfig.DEBUG // BackendEnvironment still restricts HTTP to explicit loopback origins.,
    )
}
