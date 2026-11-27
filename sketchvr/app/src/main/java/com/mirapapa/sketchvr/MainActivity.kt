package com.mirapapa.sketchvr

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class MainActivity : Activity() {
    private val url = "https://raw.githack.com/TimMir1/clode/main/sketch-vr/index.html"

    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        val pad = (28 * resources.displayMetrics.density).toInt()
        val info = TextView(this).apply {
            text = "Рисовалка в воздухе.\n\nНажми «Рисовать в комнате (AR)» — рисуй курком контроллера прямо в своей комнате. Палитра над левым контроллером, стик — цвет и толщина, X — отменить, A — зеркало."
            textSize = 20f
        }
        val open = Button(this).apply { text = "🎨 Открыть рисовалку"; textSize = 22f; setOnClickListener { launch() } }
        setContentView(LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(pad, pad, pad, pad); addView(info); addView(open)
        })
        launch()
    }

    private fun launch() {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (e: Exception) {
            android.widget.Toast.makeText(this, url, android.widget.Toast.LENGTH_LONG).show()
        }
    }
}
