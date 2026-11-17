package com.mirapapa.floatwater

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
import android.widget.SeekBar
import android.widget.TextView

class MainActivity : Activity() {
    private lateinit var level: SeekBar

    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        val pad = (24 * resources.displayMetrics.density).toInt()
        val info = TextView(this).apply {
            text = "Вода заливает экран поверх любых приложений. Наклоняешь телефон, и вода переливается. Внутри плавают рыбки. Нажатия проходят сквозь воду, можно работать как обычно."
            textSize = 16f
        }
        val lvlText = TextView(this).apply { text = "Уровень воды"; setPadding(0, pad, 0, 0) }
        level = SeekBar(this).apply { max = 60; progress = 25 }
        val show = Button(this).apply { text = "Залить"; setOnClickListener { start() } }
        val hide = Button(this).apply {
            text = "Слить"
            setOnClickListener {
                startService(Intent(this@MainActivity, OverlayService::class.java).setAction("stop"))
            }
        }
        setContentView(LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, pad * 2, pad, pad)
            addView(info); addView(lvlText); addView(level); addView(show); addView(hide)
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
        val lvl = (20 + level.progress) / 100f
        startForegroundService(Intent(this, OverlayService::class.java).putExtra("level", lvl))
        moveTaskToBack(true)
    }
}
