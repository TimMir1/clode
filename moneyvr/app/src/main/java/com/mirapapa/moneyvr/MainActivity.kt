package com.mirapapa.moneyvr

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class MainActivity : Activity() {
    private val url = "https://raw.githack.com/TimMir1/clode/main/money-vr/index.html"

    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        val pad = (28 * resources.displayMetrics.density).toInt()
        val info = TextView(this).apply {
            text = "Игровые 3D-купюры 10–5000 ₽.\n\nОткроется браузер. Нажми «В мою комнату (AR)» или «В виртуальную комнату (VR)».\n\nКурок — взять, стик — крутить, A/X — копия, B/Y — удалить."
            textSize = 20f
        }
        val open = Button(this).apply { text = "💵 Открыть купюры"; textSize = 22f; setOnClickListener { launch() } }
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
