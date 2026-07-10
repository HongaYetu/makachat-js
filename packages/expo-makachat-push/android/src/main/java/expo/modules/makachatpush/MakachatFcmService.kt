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
import androidx.core.app.RemoteInput
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

        /** broadcast interno para fechar o EcraChamadaActivity (atendeu/terminou noutro lado) */
        const val ACAO_FECHAR_ECRA = "expo.modules.makachatpush.FECHAR_ECRA_CHAMADA"

        /** Guarda a chamada pendente (lida pelo JS via obterChamadaPendente). */
        fun persistirChamadaPendente(context: Context, acao: String, chamadaId: String, chamadaTipo: String, conversaId: String, chaveServico: String) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(
                "chamada_pendente",
                """{"chamada_id":"$chamadaId","chamada_tipo":"$chamadaTipo","conversa_id":"$conversaId","chave_servico":"$chaveServico","acao":"$acao","recebida_em":"${Instant.now()}"}""",
            ).apply()
        }

        /**
         * Notificação de chamada recebida (CallStyle) — partilhada entre o caminho
         * base (notify) e o ToqueChamadaService (startForeground). Com o toque
         * contínuo ligado o canal é silencioso (o serviço toca via MediaPlayer);
         * com o ecrã nativo ligado o full-screen intent aponta à activity.
         */
        fun construirNotificacaoChamada(
            context: Context,
            titulo: String,
            chamadaId: String,
            chamadaTipo: String,
            conversaId: String,
            chaveServico: String,
            fotoUrl: String?,
        ): android.app.Notification {
            val gestor = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val toqueNoServico = Opcoes.toqueContinuo(context)
            // _v2: o canal antigo foi criado historicamente com som "default" (beep)
            // pelo handler JS e canais são IMUTÁVEIS — id novo garante o ringtone
            val canalId = if (toqueNoServico) "${CANAL_CHAMADAS}_silencioso" else "${CANAL_CHAMADAS}_v2"

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                try {
                    gestor.deleteNotificationChannel(CANAL_CHAMADAS)
                } catch (_: Exception) {
                    // canal antigo inexistente
                }
                val canal = NotificationChannel(canalId, "Chamadas", NotificationManager.IMPORTANCE_HIGH).apply {
                    if (toqueNoServico) {
                        setSound(null, null) // o MediaPlayer do serviço toca em loop
                        enableVibration(false)
                    } else {
                        setSound(
                            RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),
                            AudioAttributes.Builder()
                                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                                .build(),
                        )
                        enableVibration(true)
                        vibrationPattern = longArrayOf(0, 900, 700, 900)
                    }
                }
                gestor.createNotificationChannel(canal)
            }

            val avatar = ImagemHelper.avatarCircular(fotoUrl, titulo)

            fun pendenteActivity(acao: String): PendingIntent {
                val intent = if (Opcoes.ecraNativo(context) && acao == "tocar") {
                    Intent(context, EcraChamadaActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
                    }
                } else {
                    context.packageManager.getLaunchIntentForPackage(context.packageName)!!.apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
                    }
                }

                intent.putExtra("makachat_chamada_id", chamadaId)
                intent.putExtra("makachat_chamada_tipo", chamadaTipo)
                intent.putExtra("makachat_conversa_id", conversaId)
                intent.putExtra("makachat_chave_servico", chaveServico)
                intent.putExtra("makachat_acao", acao)
                intent.putExtra("makachat_titulo", titulo)
                intent.putExtra("makachat_foto", fotoUrl ?: "")

                return PendingIntent.getActivity(
                    context,
                    (chamadaId + acao).hashCode(),
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )
            }

            // ordem importa no modo legado: 'tocar' persistido por último no tratarChamada
            val rejeitar = pendenteActivity("rejeitar")
            val atender = pendenteActivity("atender")
            val abrir = pendenteActivity("tocar")

            val construtor = NotificationCompat.Builder(context, canalId)
                .setSmallIcon(context.applicationInfo.icon)
                .setLargeIcon(avatar)
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
                val pessoa = Person.Builder()
                    .setName(titulo)
                    .setIcon(androidx.core.graphics.drawable.IconCompat.createWithBitmap(avatar))
                    .setImportant(true)
                    .build()
                construtor.setStyle(NotificationCompat.CallStyle.forIncomingCall(pessoa, rejeitar, atender))
            } else {
                construtor
                    .addAction(0, "Rejeitar", rejeitar)
                    .addAction(0, "Atender", atender)
            }

            return construtor.build()
        }

        fun cancelarChamada(context: Context, chamadaId: String) {
            val gestor = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            gestor.cancel(chamadaId.hashCode())
        }

        fun cancelarNotificacaoMensagens(context: Context, conversaId: String) {
            val gestor = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            gestor.cancel(conversaId.hashCode())
        }

        /**
         * (Re)constrói a notificação MessagingStyle da conversa a partir do
         * histórico SQLite — usado no push novo e depois de responder ao vivo.
         */
        fun mostrarMensagens(context: Context, conversaId: String, titulo: String, silenciosa: Boolean = false) {
            val gestor = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                gestor.createNotificationChannel(
                    NotificationChannel(CANAL, "Mensagens", NotificationManager.IMPORTANCE_HIGH)
                )
            }

            val db = InboxDatabase.get(context)
            val eu = Person.Builder().setName(db.obterConfig("meu_nome") ?: "Eu").build()
            val estilo = NotificationCompat.MessagingStyle(eu)

            val historico = db.historicoDe(conversaId)

            if (historico.isEmpty()) {
                gestor.cancel(conversaId.hashCode())

                return
            }

            // metadados da conversa (guardados quando o push chega): grupo + avatar
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val eGrupo = prefs.getString("tipo_$conversaId", null) == "grupo"
            val tituloGrupo = prefs.getString("titulo_$conversaId", null)
            val fotoRemetente = prefs.getString("foto_$conversaId", null)
            val fotoConversa = prefs.getString("foto_conversa_$conversaId", null)

            // Persons do histórico sem ícone (estilo limpo, padrão kanda-notifications);
            // o avatar aparece no largeIcon circular (grupo → foto do grupo, senão remetente)
            for (linha in historico) {
                val pessoa = if (linha.minha) eu else Person.Builder().setName(linha.remetente).build()
                estilo.addMessage(NotificationCompat.MessagingStyle.Message(linha.corpo, linha.em, if (linha.minha) null else pessoa))
            }

            if (eGrupo) {
                estilo.conversationTitle = tituloGrupo ?: titulo
                estilo.isGroupConversation = true
            }

            val nomeAvatar = if (eGrupo) (tituloGrupo ?: titulo) else (historico.lastOrNull { !it.minha }?.remetente ?: titulo)
            val avatar = ImagemHelper.avatarCircular(if (eGrupo) fotoConversa else fotoRemetente, nomeAvatar)

            // responder ao vivo (RemoteInput) + marcar como lida
            val extras = { acao: String ->
                Intent(context, RespostaReceiver::class.java).apply {
                    action = acao
                    putExtra("conversa_id", conversaId)
                    putExtra("titulo", titulo)
                }
            }
            val responderPI = PendingIntent.getBroadcast(
                context,
                ("resp_" + conversaId).hashCode(),
                extras(RespostaReceiver.ACAO_RESPONDER),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
            )
            val lidaPI = PendingIntent.getBroadcast(
                context,
                ("lida_" + conversaId).hashCode(),
                extras(RespostaReceiver.ACAO_LIDA),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            val remoteInput = RemoteInput.Builder(RespostaReceiver.CHAVE_TEXTO).setLabel("Responder…").build()
            val acaoResponder = NotificationCompat.Action.Builder(0, "Responder", responderPI)
                .addRemoteInput(remoteInput)
                .setAllowGeneratedReplies(true)
                .build()

            // tap → broadcast que persiste a conversa pendente e abre a app
            // (extras diretos no launch intent perdem-se no arranque frio)
            val abrir = PendingIntent.getBroadcast(
                context,
                ("abrir_" + conversaId).hashCode(),
                extras(RespostaReceiver.ACAO_ABRIR),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

            val notificacao = NotificationCompat.Builder(context, CANAL)
                .setSmallIcon(context.applicationInfo.icon)
                .setLargeIcon(avatar)
                .setStyle(estilo)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setAutoCancel(true)
                .setOnlyAlertOnce(silenciosa)
                .setContentIntent(abrir)
                .addAction(acaoResponder)
                .addAction(0, "Marcar lida", lidaPI)
                .build()

            gestor.notify(conversaId.hashCode(), notificacao)
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

        val titulo = dados["titulo"] ?: "Nova mensagem"

        // metadados para a notificação estilo WhatsApp (avatar + grupo), por conversa
        prefs().edit().apply {
            dados["foto"]?.takeIf { it.isNotEmpty() }?.let { putString("foto_$conversaId", it) }
            dados["conversa_tipo"]?.takeIf { it.isNotEmpty() }?.let { putString("tipo_$conversaId", it) }
            dados["conversa_titulo"]?.takeIf { it.isNotEmpty() }?.let { putString("titulo_$conversaId", it) }
            dados["conversa_foto"]?.takeIf { it.isNotEmpty() }?.let { putString("foto_conversa_$conversaId", it) }
        }.apply()

        InboxDatabase.get(applicationContext).inserirHistorico(conversaId, titulo, dados["corpo"] ?: "", minha = false)
        mostrarMensagens(applicationContext, conversaId, titulo)

        // recibo de ENTREGA (✓✓ cinzento) assim que o push chega ao dispositivo —
        // best-effort, autenticado pelo token+segredo do registo do dispositivo
        dados["mensagem_id"]?.let { reportarEntrega(conversaId, it) }
    }

    private fun reportarEntrega(conversaId: String, mensagemId: String) {
        val db = InboxDatabase.get(applicationContext)
        val apiUrl = db.obterConfig("api_url") ?: return
        val token = db.obterConfig("token_dispositivo") ?: return
        val segredo = db.obterConfig("segredo_resposta") ?: return

        Thread {
            try {
                val ligacao = java.net.URL(apiUrl.trimEnd('/') + "/v1/push/entregue")
                    .openConnection() as java.net.HttpURLConnection

                try {
                    ligacao.requestMethod = "POST"
                    ligacao.connectTimeout = 8000
                    ligacao.readTimeout = 8000
                    ligacao.doOutput = true
                    ligacao.setRequestProperty("Content-Type", "application/json")
                    java.io.OutputStreamWriter(ligacao.outputStream).use {
                        it.write(
                            org.json.JSONObject().apply {
                                put("token", token)
                                put("segredo", segredo)
                                put("conversa_id", conversaId)
                                put("mensagem_id", mensagemId)
                            }.toString()
                        )
                    }
                    ligacao.responseCode
                } finally {
                    ligacao.disconnect()
                }
            } catch (_: Exception) {
                // sem rede — o recibo chega pelo socket quando a app abrir
            }
        }.start()
    }

    // ------------------------------------------------------------ chamadas

    private fun tratarChamada(dados: Map<String, String>) {
        val chamadaId = dados["chamada_id"] ?: return

        if (dados["acao"] == "parar") {
            cancelarChamada(applicationContext, chamadaId)
            prefs().edit().remove("chamada_pendente").apply()
            ToqueChamadaService.parar(applicationContext)
            // fecha o ecrã nativo se estiver aberto (atenderam/terminou noutro lado)
            applicationContext.sendBroadcast(
                Intent(ACAO_FECHAR_ECRA).setPackage(applicationContext.packageName),
            )

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

        if (Opcoes.toqueContinuo(applicationContext)) {
            // o serviço mostra a notificação (foreground) e toca em loop até resolver
            ToqueChamadaService.iniciar(applicationContext, titulo, chamadaId, chamadaTipo, conversaId, chaveServico, dados["foto"])
        } else {
            val gestor = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            gestor.notify(
                chamadaId.hashCode(),
                construirNotificacaoChamada(applicationContext, titulo, chamadaId, chamadaTipo, conversaId, chaveServico, dados["foto"]),
            )
        }
    }

    private fun prefs() = applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

}
