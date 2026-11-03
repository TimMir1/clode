package com.mirapapa.floatspiders

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
            text = "Плавающее окно с пауками.\nОкно двигается за верхнюю панель, размер меняется за уголок ◢, закрывается крестиком."
            textSize = 16f
        }
        val show = Button(this).apply { text = "Показать окно"; setOnClickListener { start() } }
        val hide = Button(this).apply {
            text = "Закрыть окно"
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
        startForegroundService(Intent(this, OverlayService::class.java))
        moveTaskToBack(true)
    }
}
