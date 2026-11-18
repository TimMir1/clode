package com.mirapapa.dogsvr

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class MainActivity : Activity() {
    private val url = "https://raw.githack.com/TimMir1/clode/main/dogs-vr/index.html"

    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        val pad = (28 * resources.displayMetrics.density).toInt()
        val info = TextView(this).apply {
            text = "Собачки Бобик и Шарик в 3D.\n\nОткроется браузер. Нажми «В мою комнату (AR)» — собаки будут ходить по твоей комнате, " +
                "или «В виртуальную комнату (VR)».\n\nНаведи луч на собаку и нажми курок — она спросит, чем помочь."
            textSize = 20f
        }
        val open = Button(this).apply { text = "🐶 Запустить собачек"; textSize = 22f; setOnClickListener { launch() } }
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
