package com.mirapapa.floatpet

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
    private lateinit var floor: SeekBar

    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        val pad = (24 * resources.displayMetrics.density).toInt()
        val info = TextView(this).apply {
            text = "Кот живёт на экране поверх любых приложений: ходит по низу, садится, спит, выглядывает из-за края и гоняется за бабочкой. Нажатия проходят сквозь него, можно работать как обычно."
            textSize = 16f
        }
        val txt = TextView(this).apply { text = "Высота, на которой стоит кот (подними над панелью приложения)"; setPadding(0, pad, 0, 0) }
        floor = SeekBar(this).apply { max = 240; progress = 90 }
        val show = Button(this).apply { text = "Запустить кота"; setOnClickListener { start() } }
        val hide = Button(this).apply {
            text = "Остановить"
            setOnClickListener { stopService(Intent(this@MainActivity, OverlayService::class.java)) }
        }
        setContentView(LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, pad * 2, pad, pad)
            addView(info); addView(txt); addView(floor); addView(show); addView(hide)
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
        startForegroundService(Intent(this, OverlayService::class.java).putExtra("floor", floor.progress))
        moveTaskToBack(true)
    }
}
