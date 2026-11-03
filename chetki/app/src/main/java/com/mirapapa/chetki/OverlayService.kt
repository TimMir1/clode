package com.mirapapa.chetki

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
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.IBinder
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView

class OverlayService : Service() {
    private var wm: WindowManager? = null
    private var root: FrameLayout? = null
    private var web: WebView? = null

    override fun onBind(i: Intent?): IBinder? = null

    override fun onStartCommand(i: Intent?, f: Int, id: Int): Int {
        if (i?.action == "stop") { stopSelf(); return START_NOT_STICKY }
        if (root == null) { goForeground(); show() }
        return START_NOT_STICKY
    }

    @Suppress("DEPRECATION")
    private fun goForeground() {
        val nm = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26)
            nm.createNotificationChannel(NotificationChannel("ov", "Чётки", NotificationManager.IMPORTANCE_LOW))
        val stop = PendingIntent.getService(
            this, 0, Intent(this, OverlayService::class.java).setAction("stop"), PendingIntent.FLAG_IMMUTABLE
        )
        val n = (if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, "ov") else Notification.Builder(this))
            .setSmallIcon(android.R.drawable.ic_menu_view)
            .setContentTitle("Чётки запущены")
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Закрыть", stop)
            .build()
        if (Build.VERSION.SDK_INT >= 34)
            startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE) else startForeground(1, n)
    }

    @SuppressLint("SetJavaScriptEnabled", "ClickableViewAccessibility")
    private fun show() {
        val m = getSystemService(WINDOW_SERVICE) as WindowManager
        wm = m
        val dm = resources.displayMetrics
        fun dp(v: Int) = (v * dm.density).toInt()

        val lp = WindowManager.LayoutParams(
            dp(300), dp(460), WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            PixelFormat.TRANSLUCENT
        ).apply { gravity = Gravity.TOP or Gravity.START; x = dp(20); y = dp(100) }

        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setBackgroundColor(Color.parseColor("#1b1b1b"))
            gravity = Gravity.CENTER_VERTICAL
        }
        header.addView(TextView(this).apply {
            text = "⠿  Чётки"; setTextColor(Color.parseColor("#d4b872")); textSize = 14f; setPadding(dp(12), 0, 0, 0)
        }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1f))
        val toggle = TextView(this).apply {
            text = "—"; setTextColor(Color.WHITE); textSize = 18f; gravity = Gravity.CENTER
        }
        header.addView(toggle, LinearLayout.LayoutParams(dp(44), LinearLayout.LayoutParams.MATCH_PARENT))
        val close = TextView(this).apply {
            text = "✕"; setTextColor(Color.WHITE); textSize = 18f; gravity = Gravity.CENTER
            setOnClickListener { stopSelf() }
        }
        header.addView(close, LinearLayout.LayoutParams(dp(44), LinearLayout.LayoutParams.MATCH_PARENT))

        val wv = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            webViewClient = WebViewClient()
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            loadUrl("https://timmir1.github.io/chetki2.html")
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
                    m.updateViewLayout(r, lp)
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
                    m.updateViewLayout(r, lp)
                }
            }
            true
        }

        var collapsed = false; var fw = lp.width; var fh = lp.height
        toggle.setOnClickListener {
            if (!collapsed) {
                fw = lp.width; fh = lp.height
                lp.width = dp(150); lp.height = dp(40)
                wv.visibility = View.GONE; grip.visibility = View.GONE; toggle.text = "▢"
            } else {
                lp.width = fw; lp.height = fh
                wv.visibility = View.VISIBLE; grip.visibility = View.VISIBLE; toggle.text = "—"
            }
            collapsed = !collapsed
            m.updateViewLayout(r, lp)
        }

        m.addView(r, lp)
    }

    override fun onDestroy() {
        root?.let { wm?.removeView(it) }
        web?.destroy()
        root = null; web = null
        super.onDestroy()
    }
}
