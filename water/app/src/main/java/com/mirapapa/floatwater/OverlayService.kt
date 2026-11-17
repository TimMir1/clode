package com.mirapapa.floatwater

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.webkit.WebView
import java.util.Locale

class OverlayService : Service(), SensorEventListener {
    private var wm: WindowManager? = null
    private var web: WebView? = null
    private var sm: SensorManager? = null
    private var lastSend = 0L
    private var stopping = false
    private val handler = Handler(Looper.getMainLooper())

    override fun onBind(i: Intent?): IBinder? = null

    override fun onStartCommand(i: Intent?, f: Int, id: Int): Int {
        if (i?.action == "stop") {
            if (web == null || stopping) { stopSelf(); return START_NOT_STICKY }
            stopping = true
            web?.evaluateJavascript("drain()", null)
            handler.postDelayed({ stopSelf() }, 5200)
            return START_NOT_STICKY
        }
        if (web == null) { goForeground(); show(i?.getFloatExtra("level", .45f) ?: .45f) }
        return START_NOT_STICKY
    }

    @Suppress("DEPRECATION")
    private fun goForeground() {
        val nm = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26)
            nm.createNotificationChannel(NotificationChannel("ov", "Вода", NotificationManager.IMPORTANCE_LOW))
        val stop = PendingIntent.getService(
            this, 0, Intent(this, OverlayService::class.java).setAction("stop"), PendingIntent.FLAG_IMMUTABLE
        )
        val n = (if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, "ov") else Notification.Builder(this))
            .setSmallIcon(android.R.drawable.ic_menu_view)
            .setContentTitle("Экран залит водой")
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Слить", stop)
            .build()
        if (Build.VERSION.SDK_INT >= 34)
            startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE) else startForeground(1, n)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun show(level: Float) {
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
            loadUrl("file:///android_asset/index.html?level=" + String.format(Locale.US, "%.2f", level))
        }
        web = wv
        m.addView(wv, lp)
        sm = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        sm?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)?.let {
            sm?.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME)
        }
    }

    override fun onSensorChanged(e: SensorEvent) {
        val now = System.currentTimeMillis()
        if (now - lastSend < 30) return
        lastSend = now
        web?.evaluateJavascript(
            String.format(Locale.US, "tilt(%.2f,%.2f)", e.values[0], e.values[1]), null
        )
    }

    override fun onAccuracyChanged(s: Sensor?, a: Int) {}

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        sm?.unregisterListener(this)
        web?.let { wm?.removeView(it); it.destroy() }
        web = null
        super.onDestroy()
    }
}
