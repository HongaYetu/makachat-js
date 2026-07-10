package expo.modules.makachatpush

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.RemoteInput
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

/**
 * Responder ao vivo a partir da notificação (RemoteInput) — com a app fechada.
 * Envia via POST /v1/push/resposta autenticado pelo token+segredo do
 * dispositivo (guardados na config pelo JS no registo) e atualiza a
 * notificação MessagingStyle com a resposta.
 */
class RespostaReceiver : BroadcastReceiver() {

    companion object {
        const val ACAO_RESPONDER = "expo.modules.makachatpush.RESPONDER"
        const val ACAO_LIDA = "expo.modules.makachatpush.MARCAR_LIDA"
        const val ACAO_ABRIR = "expo.modules.makachatpush.ABRIR_CONVERSA"
        const val CHAVE_TEXTO = "makachat_texto_resposta"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val conversaId = intent.getStringExtra("conversa_id") ?: return
        val titulo = intent.getStringExtra("titulo") ?: "Conversa"

        // Tap no corpo da notificação: persiste a conversa pendente (o JS lê no
        // arranque/foreground — extras de launch intents perdem-se) e abre a app.
        // Espelha o padrão comprovado das chamadas (chamada_pendente).
        if (intent.action == ACAO_ABRIR) {
            context.getSharedPreferences(MakachatFcmService.PREFS, Context.MODE_PRIVATE)
                .edit().putString("conversa_pendente", conversaId).apply()
            MakachatFcmService.cancelarNotificacaoMensagens(context, conversaId)
            context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
                it.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
                context.startActivity(it)
            }

            return
        }

        val db = InboxDatabase.get(context)

        val apiUrl = db.obterConfig("api_url") ?: return
        val token = db.obterConfig("token_dispositivo") ?: return
        val segredo = db.obterConfig("segredo_resposta") ?: return
        val meuNome = db.obterConfig("meu_nome") ?: "Eu"

        val pendente = goAsync()

        Thread {
            try {
                when (intent.action) {
                    ACAO_LIDA -> {
                        chamar(apiUrl, "/v1/push/lidas", JSONObject().apply {
                            put("token", token)
                            put("segredo", segredo)
                            put("conversa_id", conversaId)
                        })
                        db.limparHistorico(conversaId)
                        MakachatFcmService.cancelarNotificacaoMensagens(context, conversaId)
                    }

                    ACAO_RESPONDER -> {
                        val texto = RemoteInput.getResultsFromIntent(intent)
                            ?.getCharSequence(CHAVE_TEXTO)?.toString()?.trim()

                        if (texto.isNullOrEmpty()) {
                            pendente.finish()

                            return@Thread
                        }

                        val estado = chamar(apiUrl, "/v1/push/resposta", JSONObject().apply {
                            put("token", token)
                            put("segredo", segredo)
                            put("conversa_id", conversaId)
                            put("conteudo", texto)
                            put("ref_cliente", UUID.randomUUID().toString())
                        })

                        if (estado in 200..299) {
                            db.inserirHistorico(conversaId, meuNome, texto, minha = true)
                            MakachatFcmService.mostrarMensagens(context, conversaId, titulo, silenciosa = true)
                        } else {
                            db.inserirHistorico(conversaId, meuNome, "⚠️ Não enviada: $texto", minha = true)
                            MakachatFcmService.mostrarMensagens(context, conversaId, titulo, silenciosa = true)
                        }
                    }
                }
            } catch (_: Exception) {
                // sem rede — a resposta perde-se; o utilizador vê ao abrir a app
            } finally {
                pendente.finish()
            }
        }.start()
    }

    private fun chamar(base: String, caminho: String, corpo: JSONObject): Int {
        val ligacao = URL(base.trimEnd('/') + caminho).openConnection() as HttpURLConnection

        return try {
            ligacao.requestMethod = "POST"
            ligacao.connectTimeout = 8000
            ligacao.readTimeout = 8000
            ligacao.doOutput = true
            ligacao.setRequestProperty("Content-Type", "application/json")
            OutputStreamWriter(ligacao.outputStream).use { it.write(corpo.toString()) }
            ligacao.responseCode
        } finally {
            ligacao.disconnect()
        }
    }
}
