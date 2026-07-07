package expo.modules.makachatpush

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import java.time.Instant

/**
 * Recebe data pushes do MakaChat (payload: makachat=1, chave_servico,
 * conversa_id, mensagem=<json>, titulo, corpo), grava no inbox SQLite —
 * funciona com a app fechada — e mostra a notificação.
 */
class MakachatFcmService : FirebaseMessagingService() {

    companion object {
        const val CANAL = "makachat_mensagens"
        var emissor: ((Map<String, String?>) -> Unit)? = null
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        val dados = remoteMessage.data

        if (dados["makachat"] != "1") {
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

    private fun mostrarNotificacao(titulo: String, corpo: String, conversaId: String) {
        val gestor = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            gestor.createNotificationChannel(
                NotificationChannel(CANAL, "Mensagens", NotificationManager.IMPORTANCE_HIGH)
            )
        }

        val notificacao = NotificationCompat.Builder(this, CANAL)
            .setSmallIcon(applicationInfo.icon)
            .setContentTitle(titulo)
            .setContentText(corpo)
            .setAutoCancel(true)
            .build()

        gestor.notify(conversaId.hashCode(), notificacao)
    }
}
