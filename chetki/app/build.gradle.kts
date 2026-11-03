plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android {
    namespace = "com.mirapapa.chetki"
    compileSdk = 34
    defaultConfig { applicationId = "com.mirapapa.chetki"; minSdk = 24; targetSdk = 34; versionCode = 4; versionName = "4.0" }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
