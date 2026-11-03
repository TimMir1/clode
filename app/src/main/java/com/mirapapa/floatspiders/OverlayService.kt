package com.mirapapa.floatspiders

import android.annotation.SuppressLint
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

class OverlayService : Service() {
    private var wm: WindowManager? = null
    private var web: WebView? = null

    override fun onBind(i: Intent?): IBinder? = null

    override fun onStartCommand(i: Intent?, f: Int, id: Int): Int {
        if (i?.action == "stop") { stopSelf(); return START_NOT_STICKY }
        if (web == null) { goForeground(); show(i?.getBooleanExtra("sound", false) == true) }
        return START_NOT_STICKY
    }

    @Suppress("DEPRECATION")
    private fun goForeground() {
        val nm = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26)
            nm.createNotificationChannel(NotificationChannel("ov", "Пауки", NotificationManager.IMPORTANCE_LOW))
        val stop = PendingIntent.getService(
            this, 0, Intent(this, OverlayService::class.java).setAction("stop"), PendingIntent.FLAG_IMMUTABLE
        )
        val n = (if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, "ov") else Notification.Builder(this))
            .setSmallIcon(android.R.drawable.ic_menu_view)
            .setContentTitle("Пауки бегают по экрану")
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Закрыть", stop)
            .build()
        if (Build.VERSION.SDK_INT >= 34)
            startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE) else startForeground(1, n)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun show(sound: Boolean) {
        val m = getSystemService(WINDOW_SERVICE) as WindowManager
        wm = m
        val lp = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            if (Build.VERSION.SDK_INT >= 28)
                layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }
        val wv = WebView(this).apply {
            setBackgroundColor(Color.TRANSPARENT)
            setLayerType(View.LAYER_TYPE_HARDWARE, null)
            settings.javaScriptEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            loadUrl("file:///android_asset/index.html" + if (sound) "?sound=1" else "")
        }
        web = wv
        m.addView(wv, lp)
    }

    override fun onDestroy() {
        web?.let { wm?.removeView(it); it.destroy() }
        web = null
        super.onDestroy()
    }
}
