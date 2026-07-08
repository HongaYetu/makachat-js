package expo.modules.makachatpush

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import java.time.Instant

/**
 * Recebe data pushes do MakaChat com a app fechada:
 * - mensagens (makachat=1): inbox SQLite + notificação normal;
 * - chamadas (makachat_chamada=1, acao=tocar|parar): notificação de chamada
 *   estilo nativo (CallStyle em API 31+, full-screen intent, Atender/Rejeitar)
 *   com som de toque; `parar` cancela quando alguém atende/termina.
 */
class MakachatFcmService : FirebaseMessagingService() {

    companion object {
        const val CANAL = "makachat_mensagens"
        const val CANAL_CHAMADAS = "makachat_chamadas"
        const val PREFS = "makachat_push"
        var emissor: ((Map<String, String?>) -> Unit)? = null
        var emissorChamada: ((Map<String, String?>) -> Unit)? = null

        fun cancelarChamada(context: Context, chamadaId: String) {
            val gestor = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            gestor.cancel(chamadaId.hashCode())
        }
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        val dados = remoteMessage.data

        if (dados["makachat"] != "1") {
            return
        }

        if (dados["makachat_chamada"] == "1") {
            tratarChamada(dados)

            return
        }

        val chaveServico = dados["chave_servico"] ?: return
        val conversaId = dados["conversa_id"] ?: return
        val mensagemJson = dados["mensagem"] ?: "{}"
        val recebidaEm = Instant.now().toString()

        InboxDatabase.get(applicationContext).inserir(chaveServico, conversaId, mensagemJson, recebidaEm)

        emissor?.invoke(
            mapOf(
                "chave_servico" to chaveServico,
                "conversa_id" to conversaId,
                "mensagem_json" to mensagemJson,
                "recebida_em" to recebidaEm,
            )
        )

        mostrarNotificacao(dados["titulo"] ?: "Nova mensagem", dados["corpo"] ?: "", conversaId)
    }

    // ------------------------------------------------------------ chamadas

    private fun tratarChamada(dados: Map<String, String>) {
        val chamadaId = dados["chamada_id"] ?: return

        if (dados["acao"] == "parar") {
            cancelarChamada(applicationContext, chamadaId)
            prefs().edit().remove("chamada_pendente").apply()

            return
        }

        val titulo = dados["titulo"] ?: "Chamada"
        val chamadaTipo = dados["chamada_tipo"] ?: "audio"
        val conversaId = dados["conversa_id"] ?: ""
        val chaveServico = dados["chave_servico"] ?: ""

        // app viva: o socket já faz tocar a UI — só emitimos o evento
        if (emissorChamada != null) {
            emissorChamada?.invoke(
                mapOf(
                    "chamada_id" to chamadaId,
                    "chamada_tipo" to chamadaTipo,
                    "conversa_id" to conversaId,
                    "chave_servico" to chaveServico,
                )
            )

            return
        }

        // guarda a chamada pendente para a app ler no arranque frio
        prefs().edit().putString(
            "chamada_pendente",
            """{"chamada_id":"$chamadaId","chamada_tipo":"$chamadaTipo","conversa_id":"$conversaId","chave_servico":"$chaveServico","acao":"tocar","recebida_em":"${Instant.now()}"}""",
        ).apply()

        mostrarChamada(titulo, chamadaId, chamadaTipo, conversaId, chaveServico)
    }

    private fun intentAbrir(acao: String, chamadaId: String, chamadaTipo: String, conversaId: String, chaveServico: String): PendingIntent {
        val launch = packageManager.getLaunchIntentForPackage(packageName)!!.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("makachat_chamada_id", chamadaId)
            putExtra("makachat_chamada_tipo", chamadaTipo)
            putExtra("makachat_conversa_id", conversaId)
            putExtra("makachat_chave_servico", chaveServico)
            putExtra("makachat_acao", acao)
        }

        // persiste também a ação — extras de launch intents nem sempre sobrevivem
        prefs().edit().putString(
            "chamada_pendente",
            """{"chamada_id":"$chamadaId","chamada_tipo":"$chamadaTipo","conversa_id":"$conversaId","chave_servico":"$chaveServico","acao":"$acao","recebida_em":"${Instant.now()}"}""",
        ).apply()

        return PendingIntent.getActivity(
            this,
            (chamadaId + acao).hashCode(),
            launch,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun mostrarChamada(titulo: String, chamadaId: String, chamadaTipo: String, conversaId: String, chaveServico: String) {
        val gestor = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val som = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            val canal = NotificationChannel(CANAL_CHAMADAS, "Chamadas", NotificationManager.IMPORTANCE_HIGH).apply {
                setSound(
                    som,
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build(),
                )
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 900, 700, 900)
            }
            gestor.createNotificationChannel(canal)
        }

        val abrir = intentAbrir("tocar", chamadaId, chamadaTipo, conversaId, chaveServico)
        val atender = intentAbrir("atender", chamadaId, chamadaTipo, conversaId, chaveServico)
        val rejeitar = intentAbrir("rejeitar", chamadaId, chamadaTipo, conversaId, chaveServico)

        val construtor = NotificationCompat.Builder(this, CANAL_CHAMADAS)
            .setSmallIcon(applicationInfo.icon)
            .setContentTitle(titulo)
            .setContentText(if (chamadaTipo == "video") "Chamada de vídeo" else "Chamada de voz")
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setOngoing(true)
            .setAutoCancel(false)
            .setTimeoutAfter(45_000)
            .setFullScreenIntent(abrir, true)
            .setContentIntent(abrir)

        if (Build.VERSION.SDK_INT >= 31) {
            val pessoa = Person.Builder().setName(titulo).setImportant(true).build()
            construtor.setStyle(NotificationCompat.CallStyle.forIncomingCall(pessoa, rejeitar, atender))
        } else {
            construtor
                .addAction(0, "Rejeitar", rejeitar)
                .addAction(0, "Atender", atender)
        }

        gestor.notify(chamadaId.hashCode(), construtor.build())
    }

    private fun prefs() = applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    // ------------------------------------------------------------ mensagens

    private fun mostrarNotificacao(titulo: String, corpo: String, conversaId: String) {
        val gestor = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            gestor.createNotificationChannel(
                NotificationChannel(CANAL, "Mensagens", NotificationManager.IMPORTANCE_HIGH)
            )
        }

        val abrir = packageManager.getLaunchIntentForPackage(packageName)?.let {
            PendingIntent.getActivity(this, conversaId.hashCode(), it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        }

        val notificacao = NotificationCompat.Builder(this, CANAL)
            .setSmallIcon(applicationInfo.icon)
            .setContentTitle(titulo)
            .setContentText(corpo)
            .setAutoCancel(true)
            .setContentIntent(abrir)
            .build()

        gestor.notify(conversaId.hashCode(), notificacao)
    }
}
