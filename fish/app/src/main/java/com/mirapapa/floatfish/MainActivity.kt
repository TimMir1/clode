package com.mirapapa.floatfish

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class MainActivity : Activity() {
    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        val pad = (24 * resources.displayMetrics.density).toInt()
        val info = TextView(this).apply {
            text = "Рыбки плавают по всему экрану поверх других приложений: уходят за край, возвращаются, иногда пугливо рвутся в сторону. Фон прозрачный, нажатия проходят сквозь них, можно спокойно работать."
            textSize = 16f
        }
        val show = Button(this).apply { text = "Запустить рыбок"; setOnClickListener { start() } }
        val hide = Button(this).apply {
            text = "Остановить"
            setOnClickListener { stopService(Intent(this@MainActivity, OverlayService::class.java)) }
        }
        setContentView(LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, pad * 2, pad, pad)
            addView(info); addView(show); addView(hide)
        })
    }

    private fun start() {
        if (!Settings.canDrawOverlays(this)) {
            startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
            return
        }
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
        stopService(Intent(this, OverlayService::class.java))
        startForegroundService(Intent(this, OverlayService::class.java))
        moveTaskToBack(true)
    }
}
