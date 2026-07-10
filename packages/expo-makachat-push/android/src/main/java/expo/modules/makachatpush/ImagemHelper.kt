package expo.modules.makachatpush

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.Shader
import java.net.HttpURLConnection
import java.net.URL

/**
 * Avatares das notificações estilo WhatsApp (padrão do kanda-notifications,
 * sem Glide): download com cache em memória + recorte circular via Canvas;
 * sem foto gera um placeholder circular com a inicial e cor por hash do nome.
 */
object ImagemHelper {
    private const val LADO = 256 // px

    private val cache = mutableMapOf<String, Bitmap?>()

    /** Avatar circular a partir de URL; placeholder com a inicial em falha/sem URL. */
    fun avatarCircular(url: String?, nomeFallback: String): Bitmap {
        if (!url.isNullOrBlank()) {
            cache[url]?.let { return it }

            baixar(url)?.let {
                val redondo = recorteCircular(it)
                cache[url] = redondo

                return redondo
            }
        }

        return placeholder(nomeFallback)
    }

    private fun baixar(url: String): Bitmap? {
        return try {
            val ligacao = URL(url).openConnection() as HttpURLConnection
            ligacao.connectTimeout = 5000
            ligacao.readTimeout = 5000
            val bitmap = ligacao.inputStream.use { BitmapFactory.decodeStream(it) }
            ligacao.disconnect()
            bitmap
        } catch (_: Exception) {
            null
        }
    }

    /** Recorte circular centrado (equivalente ao CircleCrop do Glide). */
    private fun recorteCircular(origem: Bitmap): Bitmap {
        val lado = minOf(origem.width, origem.height)
        val destino = Bitmap.createBitmap(LADO, LADO, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(destino)

        val shader = BitmapShader(origem, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
        val matriz = Matrix()
        val escala = LADO.toFloat() / lado
        matriz.setScale(escala, escala)
        matriz.preTranslate(-(origem.width - lado) / 2f, -(origem.height - lado) / 2f)
        shader.setLocalMatrix(matriz)

        val tinta = Paint(Paint.ANTI_ALIAS_FLAG).apply { setShader(shader) }
        val raio = LADO / 2f
        canvas.drawCircle(raio, raio, raio, tinta)

        return destino
    }

    /** Placeholder circular com a inicial do nome e cor por hash (estilo WhatsApp). */
    fun placeholder(nome: String): Bitmap {
        val bitmap = Bitmap.createBitmap(LADO, LADO, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        val cores = intArrayOf(
            0xFF6200EA.toInt(),
            0xFF0091EA.toInt(),
            0xFF00C853.toInt(),
            0xFFFF6D00.toInt(),
            0xFFD50000.toInt(),
            0xFFAA00FF.toInt(),
            0xFF00BFA5.toInt(),
            0xFFFFAB00.toInt(),
        )
        val fundo = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = cores[Math.abs(nome.hashCode()) % cores.size]
            style = Paint.Style.FILL
        }
        val raio = LADO / 2f
        canvas.drawCircle(raio, raio, raio, fundo)

        val inicial = nome.firstOrNull()?.uppercaseChar()?.toString() ?: "?"
        val texto = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            textSize = LADO * 0.4f
            textAlign = Paint.Align.CENTER
            isFakeBoldText = true
        }
        val limites = Rect()
        texto.getTextBounds(inicial, 0, inicial.length, limites)
        canvas.drawText(inicial, raio, raio - limites.exactCenterY(), texto)

        return bitmap
    }
}
