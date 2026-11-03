plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android {
    namespace = "com.mirapapa.floatspiders"
    compileSdk = 34
    defaultConfig { applicationId = "com.mirapapa.floatspiders"; minSdk = 24; targetSdk = 34; versionCode = 1; versionName = "1.0" }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
