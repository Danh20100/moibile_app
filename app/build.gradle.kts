import java.net.URI
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.devtools.ksp")
    id("com.google.dagger.hilt.android")
}

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("keystore.properties")
val hasReleaseSigning = keystorePropertiesFile.exists()
if (hasReleaseSigning) {
    keystorePropertiesFile.inputStream().use(keystoreProperties::load)
}

// Per-machine configuration only; never check in real endpoint hosts or credentials.
val backendApiBaseUrl = providers.gradleProperty("trooiApiBaseUrl")
    .orElse(providers.environmentVariable("TROOI_API_BASE_URL"))
    .orElse("")
    .get()
val escapedBackendApiBaseUrl = backendApiBaseUrl.replace("\\", "\\\\").replace("\"", "\\\"")
val googleWebClientId = providers.gradleProperty("trooiGoogleWebClientId")
    .orElse(providers.environmentVariable("TROOI_GOOGLE_WEB_CLIENT_ID"))
    .orElse("")
    .get()
val escapedGoogleWebClientId = googleWebClientId.replace("\\", "\\\\").replace("\"", "\\\"")
val paymentPublicOrigin = providers.gradleProperty("trooiPaymentPublicOrigin")
    .orElse(providers.environmentVariable("TROOI_PAYMENT_PUBLIC_ORIGIN"))
    .orElse("")
    .get()
val escapedPaymentPublicOrigin = paymentPublicOrigin.replace("\\", "\\\\").replace("\"", "\\\"")

fun acceptedReleasePaymentOrigin(raw: String): String {
    val trimmed = raw.trim().trimEnd('/')
    val uri = runCatching { URI(trimmed) }.getOrNull() ?: return ""
    val host = uri.host?.lowercase() ?: return ""
    val blocked = host == "localhost" || host == "127.0.0.1" || host == "10.0.2.2" ||
        host == "trycloudflare.com" || host.endsWith(".trycloudflare.com")
    if (!uri.scheme.equals("https", ignoreCase = true) || uri.userInfo != null || blocked) return ""
    if (uri.rawPath !in listOf(null, "", "/") || uri.rawQuery != null || uri.rawFragment != null) return ""
    return trimmed
}
val releasePaymentPublicOrigin = providers.gradleProperty("trooiReleasePaymentPublicOrigin")
    .orElse(providers.environmentVariable("TROOI_RELEASE_PAYMENT_PUBLIC_ORIGIN"))
    .orElse("")
    .get()
val escapedReleasePaymentPublicOrigin = acceptedReleasePaymentOrigin(releasePaymentPublicOrigin)
    .replace("\\", "\\\\").replace("\"", "\\\"")
val mapsApiKey = providers.gradleProperty("trooiMapsApiKey")
    .orElse(providers.environmentVariable("TROOI_MAPS_API_KEY"))
    .orElse("")
    .get()
val escapedMapsApiKey = mapsApiKey.replace("\\", "\\\\").replace("\"", "\\\"")

android {
    namespace = "com.trooi.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.trooi.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 3
        versionName = "1.0.1"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField("String", "BACKEND_API_BASE_URL", "\"$escapedBackendApiBaseUrl\"")
        buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"$escapedGoogleWebClientId\"")
        buildConfigField("String", "PAYMENT_PUBLIC_ORIGIN", "\"$escapedPaymentPublicOrigin\"")
        buildConfigField("String", "MAPS_API_KEY", "\"$escapedMapsApiKey\"")
        manifestPlaceholders["trooiMapsApiKey"] = mapsApiKey
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = rootProject.file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        getByName("debug") {
            // Source selection happens at runtime in debug; there is no third build type.
        }
        release {
            isDebuggable = false
            isMinifyEnabled = true
            isShrinkResources = true
            buildConfigField("String", "PAYMENT_PUBLIC_ORIGIN", "\"$escapedReleasePaymentPublicOrigin\"")
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    // Android/Kotlin tests are hosted at repository root beside the TS/backend suite.
    // Gradle still owns the compilation/runtime variants; no tests are disabled.
    sourceSets.getByName("test").kotlin.directories.add("../tests/android/unit/java")
    sourceSets.getByName("test").resources.srcDir(rootProject.file("tests/android/unit/resources"))
    sourceSets.getByName("testDebug").kotlin.directories.add("../tests/android/unitDebug/java")
    sourceSets.getByName("testDebug").resources.srcDir(rootProject.file("tests/android/unitDebug/resources"))
    sourceSets.getByName("androidTest").kotlin.directories.add("../tests/android/instrumentation/java")
    sourceSets.getByName("androidTestDebug").kotlin.directories.add("../tests/android/instrumentationDebug/java")
    sourceSets.getByName("androidTestDebug").assets.srcDir(rootProject.file("tests/android/instrumentationDebug/assets"))
    // Unit Debug test resources additionally require the built-in Debug fixture assets.
    sourceSets.getByName("testDebug").resources.srcDir("src/debug/assets")

    testBuildType = providers.gradleProperty("trooiInstrumentationBuildType").orElse("debug").get()
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2025.08.00")

    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.activity:activity-compose:1.11.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.4")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.9.4")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.9.4")

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")

    implementation("androidx.hilt:hilt-navigation-compose:1.3.0")
    implementation("com.google.dagger:hilt-android:2.59.2")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.google.code.gson:gson:2.11.0")
    implementation("androidx.credentials:credentials:1.5.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.5.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")
    implementation("com.google.android.gms:play-services-maps:20.0.0")
    ksp("com.google.dagger:hilt-android-compiler:2.59.2")

    implementation("com.google.mlkit:text-recognition:16.0.1")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")

    testImplementation("junit:junit:4.13.2")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.7.0")
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
    androidTestImplementation("androidx.test:runner:1.7.0")
    androidTestImplementation("androidx.test:core:1.7.0")
}
