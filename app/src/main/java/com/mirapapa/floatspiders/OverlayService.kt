package com.mirapapa.floatspiders

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.webkit.WebView
import android.webkit.WebViewClient

class OverlayService : Service() {
    private lateinit var wm: WindowManager
    private var overlay: WebView? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (overlay == null) {
            startAsForeground()
            showSpiders()
        }
        return START_STICKY
    }

    private fun startAsForeground() {
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26) {
            manager.createNotificationChannel(
                NotificationChannel("spiders", "Пауки на экране", NotificationManager.IMPORTANCE_LOW)
            )
        }

        val openApp = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or
                (if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        val builder = if (Build.VERSION.SDK_INT >= 26)
            Notification.Builder(this, "spiders") else Notification.Builder(this)

        val notification = builder
            .setSmallIcon(android.R.drawable.ic_menu_view)
            .setContentTitle("Пауки ползают по экрану")
            .setContentText("Открой приложение, чтобы остановить их")
            .setContentIntent(openApp)
            .setOngoing(true)
            .build()

        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(1, notification)
        }
    }

    private fun showSpiders() {
        wm = getSystemService(WINDOW_SERVICE) as WindowManager

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            layoutInDisplayCutoutMode =
                if (Build.VERSION.SDK_INT >= 28)
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                else WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT
        }

        val webView = WebView(this).apply {
            setBackgroundColor(Color.TRANSPARENT)
            setLayerType(View.LAYER_TYPE_HARDWARE, null)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView, url: String) {
                    // Make the document itself transparent so only the existing spider artwork remains visible.
                    view.evaluateJavascript(
                        "(function(){document.documentElement.style.background='transparent';" +
                            "document.body.style.background='transparent';" +
                            "document.documentElement.style.backgroundColor='transparent';" +
                            "document.body.style.backgroundColor='transparent';" +
                            "})();",
                        null
                    )
                }
            }
            loadUrl("file:///android_asset/index.html")
        }

        overlay = webView
        wm.addView(webView, params)
    }

    override fun onDestroy() {
        overlay?.let {
            runCatching { wm.removeView(it) }
            it.destroy()
        }
        overlay = null
        super.onDestroy()
    }
}
