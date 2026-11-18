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
            text = "Бобик (шиба-ину) и Шарик (хаски) в 3D.\n\nОткроется браузер. Сначала нажми «🎤 Включить голос» (разреши микрофон), " +
                "потом «В мою комнату (AR)» или «В виртуальную комнату (VR)».\n\nЗови собаку по имени: «Бобик, погода в Москве», " +
                "«Шарик, собери продукты на лагман на троих», «Бобик, помощь»."
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
