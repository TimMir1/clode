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
import kotlin.math.abs

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
        fun sysDim(name: String): Int {
            val id = resources.getIdentifier(name, "dimen", "android")
            return if (id > 0) resources.getDimensionPixelSize(id) else 0
        }
        val sb = sysDim("status_bar_height")
        val nb = sysDim("navigation_bar_height")
        val scrim = Color.parseColor("#77000000")

        val lp = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            if (Build.VERSION.SDK_INT >= 28)
                layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }

        // Делает фон страницы прозрачным и включает её режим «фокус» (только счётчик).
        val prepareJs = """
            (function(){
              if(!document.getElementById('ovstyle')){
                var s=document.createElement('style');s.id='ovstyle';
                s.textContent='html,body{background:transparent!important}body{background-image:none!important}.card:before{display:none!important}';
                document.head.appendChild(s);
              }
              if(!document.body.classList.contains('focus-mode')){
                var f=document.getElementById('focus');if(f)f.click();
              }
            })();
        """.trimIndent()
        val toggleJs = "(function(){var f=document.getElementById('focus');if(f)f.click();})();"

        val wv = WebView(this).apply {
            setBackgroundColor(Color.TRANSPARENT)
            setLayerType(View.LAYER_TYPE_HARDWARE, null)
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    view?.let { v -> v.postDelayed({ v.evaluateJavascript(prepareJs, null) }, 500) }
                }
            }
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            loadUrl("https://timmir1.github.io/chetki2.html")
        }
        web = wv

        fun btn(t: String, onClick: () -> Unit) = TextView(this).apply {
            text = t; setTextColor(Color.WHITE); textSize = 18f; gravity = Gravity.CENTER
            background = GradientDrawable().apply { setColor(Color.parseColor("#88000000")); cornerRadius = dp(22).toFloat() }
            setOnClickListener { onClick() }
        }

        val controls = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        val bubble = TextView(this).apply {
            text = "📿"; textSize = 26f; gravity = Gravity.CENTER; visibility = View.GONE
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#CC1b1b1b"))
                setStroke(dp(2), Color.parseColor("#e5bb45"))
            }
        }

        val r = FrameLayout(this).apply { setBackgroundColor(scrim) }
        r.addView(wv, FrameLayout.LayoutParams(-1, -1).apply { topMargin = sb; bottomMargin = nb })
        r.addView(controls, FrameLayout.LayoutParams(-2, -2, Gravity.TOP or Gravity.END).apply {
            topMargin = sb + dp(8); rightMargin = dp(12)
        })
        r.addView(bubble, FrameLayout.LayoutParams(-1, -1))
        root = r

        var bx = dm.widthPixels - dp(72)
        var by = dp(220)

        fun collapse() {
            wv.visibility = View.GONE; controls.visibility = View.GONE; bubble.visibility = View.VISIBLE
            r.setBackgroundColor(Color.TRANSPARENT)
            lp.width = dp(60); lp.height = dp(60); lp.x = bx; lp.y = by
            m.updateViewLayout(r, lp)
        }
        fun expand() {
            bubble.visibility = View.GONE; wv.visibility = View.VISIBLE; controls.visibility = View.VISIBLE
            r.setBackgroundColor(scrim)
            lp.width = WindowManager.LayoutParams.MATCH_PARENT; lp.height = WindowManager.LayoutParams.MATCH_PARENT
            lp.x = 0; lp.y = 0
            m.updateViewLayout(r, lp)
        }

        controls.addView(btn("≡") { wv.evaluateJavascript(toggleJs, null) },
            LinearLayout.LayoutParams(dp(44), dp(44)).apply { rightMargin = dp(8) })
        controls.addView(btn("—") { collapse() },
            LinearLayout.LayoutParams(dp(44), dp(44)).apply { rightMargin = dp(8) })
        controls.addView(btn("✕") { stopSelf() }, LinearLayout.LayoutParams(dp(44), dp(44)))

        var downX = 0f; var downY = 0f; var sx = 0; var sy = 0; var moved = false
        bubble.setOnTouchListener { _, e ->
            when (e.action) {
                MotionEvent.ACTION_DOWN -> { downX = e.rawX; downY = e.rawY; sx = lp.x; sy = lp.y; moved = false }
                MotionEvent.ACTION_MOVE -> {
                    val dx = (e.rawX - downX).toInt(); val dy = (e.rawY - downY).toInt()
                    if (abs(dx) > dp(8) || abs(dy) > dp(8)) moved = true
                    if (moved) {
                        lp.x = (sx + dx).coerceIn(0, dm.widthPixels - dp(60))
                        lp.y = (sy + dy).coerceIn(0, dm.heightPixels - dp(60))
                        m.updateViewLayout(r, lp)
                    }
                }
                MotionEvent.ACTION_UP -> {
                    if (moved) { bx = lp.x; by = lp.y } else expand()
                }
            }
            true
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
