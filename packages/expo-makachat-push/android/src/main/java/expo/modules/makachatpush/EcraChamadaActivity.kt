package expo.modules.makachatpush

import android.app.Activity
import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.WindowManager
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

/**
 * Ecrã NATIVO de chamada recebida (opt-in `ecraNativo` do config plugin;
 * padrão do kanda-notifications): aparece instantâneo sobre o lockscreen com
 * a app morta — avatar, nome, Atender/Rejeitar. Layout programático (sem
 * XML/temas) para a lib não carregar recursos. FRONTEIRA DURA: este ecrã
 * nunca cresce para lá disto — a chamada em si é 100% JS.
 */
class EcraChamadaActivity : Activity() {

    private val handler = Handler(Looper.getMainLooper())
    private val timeout = Runnable { finish() }

    private val fechar = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) = finish()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // sobre o lockscreen, com o ecrã ligado
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val chamadaId = intent.getStringExtra("makachat_chamada_id") ?: run {
            finish()

            return
        }
        val tipo = intent.getStringExtra("makachat_chamada_tipo") ?: "audio"
        val titulo = intent.getStringExtra("makachat_titulo") ?: "Chamada"
        val foto = intent.getStringExtra("makachat_foto")?.takeIf { it.isNotEmpty() }

        setContentView(construirLayout(titulo, tipo, foto, chamadaId))

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(fechar, IntentFilter(MakachatFcmService.ACAO_FECHAR_ECRA), Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            registerReceiver(fechar, IntentFilter(MakachatFcmService.ACAO_FECHAR_ECRA))
        }

        handler.postDelayed(timeout, 45_000)
    }

    private fun construirLayout(titulo: String, tipo: String, foto: String?, chamadaId: String): LinearLayout {
        val densidade = resources.displayMetrics.density
        fun dp(v: Int) = (v * densidade).toInt()

        val raiz = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setBackgroundColor(Color.parseColor("#0F172A"))
            setPadding(dp(24), dp(96), dp(24), dp(48))
        }

        val avatar = ImageView(this).apply {
            layoutParams = LinearLayout.LayoutParams(dp(120), dp(120))
            setImageBitmap(ImagemHelper.placeholder(titulo))
        }
        raiz.addView(avatar)

        // foto real em background, sem bloquear o arranque do ecrã
        if (foto != null) {
            Thread {
                val bitmap = ImagemHelper.avatarCircular(foto, titulo)
                runOnUiThread { avatar.setImageBitmap(bitmap) }
            }.start()
        }

        raiz.addView(TextView(this).apply {
            text = titulo
            setTextColor(Color.WHITE)
            textSize = 26f
            gravity = Gravity.CENTER
            setPadding(0, dp(20), 0, dp(6))
        })

        raiz.addView(TextView(this).apply {
            text = if (tipo == "video") "Chamada de vídeo recebida" else "Chamada de voz recebida"
            setTextColor(Color.parseColor("#94A3B8"))
            textSize = 15f
            gravity = Gravity.CENTER
        })

        // espaço flexível
        raiz.addView(TextView(this).apply {
            layoutParams = LinearLayout.LayoutParams(0, 0, 1f)
        })

        val botoes = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }

        fun botao(cor: String, rotulo: String, aoTocar: () -> Unit): LinearLayout {
            return LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER_HORIZONTAL
                setPadding(dp(28), 0, dp(28), 0)

                addView(TextView(this@EcraChamadaActivity).apply {
                    layoutParams = LinearLayout.LayoutParams(dp(72), dp(72))
                    background = GradientDrawable().apply {
                        shape = GradientDrawable.OVAL
                        setColor(Color.parseColor(cor))
                    }
                    text = if (rotulo == "Atender") "✆" else "✕"
                    setTextColor(Color.WHITE)
                    textSize = 30f
                    gravity = Gravity.CENTER
                    setOnClickListener { aoTocar() }
                })
                addView(TextView(this@EcraChamadaActivity).apply {
                    text = rotulo
                    setTextColor(Color.WHITE)
                    textSize = 14f
                    gravity = Gravity.CENTER
                    setPadding(0, dp(10), 0, 0)
                })
            }
        }

        botoes.addView(botao("#EF4444", "Rejeitar") { rejeitar(chamadaId) })
        botoes.addView(botao("#10B981", "Atender") { atender(chamadaId) })
        raiz.addView(botoes)

        return raiz
    }

    private fun limparToqueENotificacao(chamadaId: String) {
        ToqueChamadaService.parar(this)
        MakachatFcmService.cancelarChamada(this, chamadaId)
        handler.removeCallbacks(timeout)
    }

    private fun atender(chamadaId: String) {
        limparToqueENotificacao(chamadaId)

        MakachatFcmService.persistirChamadaPendente(
            this,
            "atender",
            chamadaId,
            intent.getStringExtra("makachat_chamada_tipo") ?: "audio",
            intent.getStringExtra("makachat_conversa_id") ?: "",
            intent.getStringExtra("makachat_chave_servico") ?: "",
        )

        val abrirApp = {
            packageManager.getLaunchIntentForPackage(packageName)?.let {
                it.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
                startActivity(it)
            }
            finish()
        }

        // com o telemóvel bloqueado, pede o desbloqueio antes de abrir a app
        val keyguard = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && keyguard.isKeyguardLocked) {
            keyguard.requestDismissKeyguard(this, object : KeyguardManager.KeyguardDismissCallback() {
                override fun onDismissSucceeded() = abrirApp()
                override fun onDismissError() = abrirApp()
                override fun onDismissCancelled() = finish()
            })
        } else {
            abrirApp()
        }
    }

    private fun rejeitar(chamadaId: String) {
        limparToqueENotificacao(chamadaId)

        val db = InboxDatabase.get(applicationContext)
        val apiUrl = db.obterConfig("api_url")
        val token = db.obterConfig("token_dispositivo")
        val segredo = db.obterConfig("segredo_resposta")

        if (apiUrl != null && token != null && segredo != null) {
            // rejeita no hub SEM abrir a app (endpoint push-auth)
            Thread {
                try {
                    val ligacao = URL(apiUrl.trimEnd('/') + "/v1/push/chamada/rejeitar")
                        .openConnection() as HttpURLConnection

                    try {
                        ligacao.requestMethod = "POST"
                        ligacao.connectTimeout = 8000
                        ligacao.readTimeout = 8000
                        ligacao.doOutput = true
                        ligacao.setRequestProperty("Content-Type", "application/json")
                        OutputStreamWriter(ligacao.outputStream).use {
                            it.write(
                                JSONObject().apply {
                                    put("token", token)
                                    put("segredo", segredo)
                                    put("chamada_id", chamadaId)
                                }.toString()
                            )
                        }
                        ligacao.responseCode
                    } finally {
                        ligacao.disconnect()
                    }
                } catch (_: Exception) {
                    // sem rede — a chamada morre por timeout no hub
                }
            }.start()

            finish()

            return
        }

        // sem credenciais do dispositivo: fallback — abre a app para rejeitar
        MakachatFcmService.persistirChamadaPendente(
            this,
            "rejeitar",
            chamadaId,
            intent.getStringExtra("makachat_chamada_tipo") ?: "audio",
            intent.getStringExtra("makachat_conversa_id") ?: "",
            intent.getStringExtra("makachat_chave_servico") ?: "",
        )
        packageManager.getLaunchIntentForPackage(packageName)?.let {
            it.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            startActivity(it)
        }
        finish()
    }

    override fun onDestroy() {
        handler.removeCallbacks(timeout)

        try {
            unregisterReceiver(fechar)
        } catch (_: Exception) {
            // já removido
        }

        super.onDestroy()
    }
}
