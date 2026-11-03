package com.mirapapa.floatspiders

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.IBinder
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.webkit.WebView
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView

class OverlayService : Service() {
    private lateinit var wm: WindowManager
    private var root: FrameLayout? = null
    private var web: WebView? = null

    override fun onBind(i: Intent?): IBinder? = null

    override fun onStartCommand(i: Intent?, f: Int, id: Int): Int {
        if (root == null) { goForeground(); show() }
        return START_NOT_STICKY
    }

    private fun goForeground() {
        val nm = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26)
            nm.createNotificationChannel(NotificationChannel("ov", "Окно", NotificationManager.IMPORTANCE_LOW))
        val n = (if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, "ov") else Notification.Builder(this))
            .setSmallIcon(android.R.drawable.ic_menu_view).setContentTitle("Окно с пауками запущено").build()
        if (Build.VERSION.SDK_INT >= 34)
            startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE) else startForeground(1, n)
    }

    @SuppressLint("SetJavaScriptEnabled", "ClickableViewAccessibility")
    private fun show() {
        wm = getSystemService(WINDOW_SERVICE) as WindowManager
        val dm = resources.displayMetrics
        fun dp(v: Int) = (v * dm.density).toInt()
        val lp = WindowManager.LayoutParams(
            dp(260), dp(420), WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            PixelFormat.TRANSLUCENT
        ).apply { gravity = Gravity.TOP or Gravity.START; x = dp(24); y = dp(120) }

        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; setBackgroundColor(Color.parseColor("#1b1b1b")); gravity = Gravity.CENTER_VERTICAL
        }
        header.addView(TextView(this).apply {
            text = "⠿  Пауки"; setTextColor(Color.parseColor("#c7b9a6")); textSize = 14f; setPadding(dp(12), 0, 0, 0)
        }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1f).apply { gravity = Gravity.CENTER_VERTICAL })
        val close = TextView(this).apply {
            text = "✕"; setTextColor(Color.WHITE); textSize = 18f; gravity = Gravity.CENTER
            setOnClickListener { stopSelf() }
        }
        header.addView(close, LinearLayout.LayoutParams(dp(44), LinearLayout.LayoutParams.MATCH_PARENT))

        val wv = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            settings.javaScriptEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            loadUrl("file:///android_asset/index.html")
        }
        web = wv

        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(header, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(40)))
            addView(wv, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
        }
        val grip = TextView(this).apply {
            text = "◢"; setTextColor(Color.WHITE); textSize = 20f; gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#99000000"))
        }
        val r = FrameLayout(this).apply {
            background = GradientDrawable().apply { setColor(Color.BLACK); cornerRadius = dp(12).toFloat() }
            clipToOutline = true
            addView(col, FrameLayout.LayoutParams(-1, -1))
            addView(grip, FrameLayout.LayoutParams(dp(44), dp(44), Gravity.BOTTOM or Gravity.END))
        }
        root = r

        var sx = 0f; var sy = 0f; var ox = 0; var oy = 0
        header.setOnTouchListener { _, e ->
            when (e.action) {
                MotionEvent.ACTION_DOWN -> { sx = e.rawX; sy = e.rawY; ox = lp.x; oy = lp.y }
                MotionEvent.ACTION_MOVE -> {
                    lp.x = (ox + (e.rawX - sx).toInt()).coerceIn(-lp.width + dp(80), dm.widthPixels - dp(80))
                    lp.y = (oy + (e.rawY - sy).toInt()).coerceIn(0, dm.heightPixels - dp(40))
                    wm.updateViewLayout(r, lp)
                }
            }
            true
        }
        var ow = 0; var oh = 0
        grip.setOnTouchListener { _, e ->
            when (e.action) {
                MotionEvent.ACTION_DOWN -> { sx = e.rawX; sy = e.rawY; ow = lp.width; oh = lp.height }
                MotionEvent.ACTION_MOVE -> {
                    lp.width = (ow + (e.rawX - sx).toInt()).coerceIn(dp(150), dm.widthPixels)
                    lp.height = (oh + (e.rawY - sy).toInt()).coerceIn(dp(150), dm.heightPixels)
                    wm.updateViewLayout(r, lp)
                }
            }
            true
        }
        wm.addView(r, lp)
    }

    override fun onDestroy() {
        root?.let { wm.removeView(it) }
        web?.destroy()
        root = null; web = null
        super.onDestroy()
    }
}
