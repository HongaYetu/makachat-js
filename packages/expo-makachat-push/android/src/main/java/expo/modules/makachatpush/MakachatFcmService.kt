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

        /** o ChamadasProvider marcou o handler de onChamadaPush como subscrito */
        var ouvinteChamadasPronto = false

        /** conversa aberta em primeiro plano (o JS mantém via definirConversaVisivel) —
         *  não notificamos mensagens dela enquanto visível + foreground */
        var conversaVisivel: String? = null

        /** app visível ao utilizador (uma activity resumed) — factos, não palpite */
        fun processoEmForeground(): Boolean {
            return try {
                android.app.ActivityManager.RunningAppProcessInfo().let { info ->
                    android.app.ActivityManager.getMyMemoryState(info)
                    info.importance <= android.app.ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
                }
            } catch (_: Exception) {
                false
            }
        }

        /** broadcast interno para fechar o EcraChamadaActivity (atendeu/terminou noutro lado) */
        const val ACAO_FECHAR_ECRA = "expo.modules.makachatpush.FECHAR_ECRA_CHAMADA"

        /**
         * Apresenta a chamada recebida (toque contínuo ou notificação CallStyle)
         * — caminho do app-morto, também invocável pelo JS quando a app está
         * viva mas em background (apresentarChamada no módulo).
         */
        fun apresentarChamada(
            context: Context,
            titulo: String,
            chamadaId: String,
            chamadaTipo: String,
            conversaId: String,
            chaveServico: String,
            fotoUrl: String?,
        ) {
            // guarda a chamada pendente para a app ler no arranque frio/foreground
            persistirChamadaPendente(context, "tocar", chamadaId, chamadaTipo, conversaId, chaveServico)

            if (Opcoes.toqueContinuo(context)) {
                ToqueChamadaService.iniciar(context, titulo, chamadaId, chamadaTipo, conversaId, chaveServico, fotoUrl)
            } else {
                val gestor = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                gestor.notify(
                    chamadaId.hashCode(),
                    construirNotificacaoChamada(context, titulo, chamadaId, chamadaTipo, conversaId, chaveServico, fotoUrl),
                )
            }
        }

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
                // 'atender' vai SEMPRE ao EcraChamadaActivity (trampolim: para o
                // toque, persiste 'atender' e abre a app — só a activity pode
                // abrir a app a partir de uma notificação em API 29+); 'tocar'
                // (tap no corpo) abre o ecrã nativo se ligado, senão a app
                val intent = if (acao == "atender" || (Opcoes.ecraNativo(context) && acao == "tocar")) {
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

            // rejeitar não precisa de abrir a app: broadcast que para o toque,
            // cancela a notificação e rejeita no hub via endpoint push-auth
            val rejeitar = PendingIntent.getBroadcast(
                context,
                (chamadaId + "rejeitar").hashCode(),
                Intent(context, RespostaReceiver::class.java).apply {
                    action = RespostaReceiver.ACAO_CHAMADA_REJEITAR
                    putExtra("chamada_id", chamadaId)
                },
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
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
            // a notificação pode ser do foreground service (toque contínuo):
            // matar o serviço remove-a e cala o ringtone; o cancel cobre o notify simples
            ToqueChamadaService.parar(context)
            val gestor = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            gestor.cancel(chamadaId.hashCode())
        }

        fun cancelarNotificacaoMensagens(context: Context, conversaId: String) {
            // ler/abrir a conversa = limpar também o histórico nativo, senão o
            // próximo push reconstrói a MessagingStyle com mensagens já vistas
            // (o histórico acumula por push)
            InboxDatabase.get(context).limparHistorico(conversaId)
            val gestor = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            gestor.cancel(conversaId.hashCode())
        }

        /**
         * (Re)constrói a notificação MessagingStyle da conversa a partir do
         * histórico SQLite — usado no push novo e depois de responder ao vivo.
         * `semSom`: mensagem silenciosa (flag do hub — não conta no badge) vai
         * para o canal LOW, sem som nem heads-up (mesmo id do canal do notifee).
         */
        fun mostrarMensagens(context: Context, conversaId: String, titulo: String, silenciosa: Boolean = false, semSom: Boolean = false) {
            val gestor = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val canalId = if (semSom) "makachat_silenciosas" else CANAL

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (semSom) {
                    gestor.createNotificationChannel(
                        NotificationChannel(canalId, "Eventos silenciosos", NotificationManager.IMPORTANCE_LOW)
                    )
                } else {
                    gestor.createNotificationChannel(
                        NotificationChannel(CANAL, "Mensagens", NotificationManager.IMPORTANCE_HIGH)
                    )
                }
            }

            val db = InboxDatabase.get(context)
            val eu = Person.Builder().setName(db.obterConfig("meu_nome") ?: "Eu").setKey("eu").build()
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

            // avatar da conversa (largeIcon + ícone do atalho): grupo → foto do grupo; 1:1 → foto do remetente
            val nomeAvatar = if (eGrupo) (tituloGrupo ?: titulo) else (historico.lastOrNull { !it.minha }?.remetente ?: titulo)
            val avatar = ImagemHelper.avatarCircular(if (eGrupo) fotoConversa else fotoRemetente, nomeAvatar)
            val iconeAvatar = androidx.core.graphics.drawable.IconCompat.createWithBitmap(avatar)

            // Person da contraparte com ÍCONE (é o que dá o avatar grande na secção
            // "Conversas"). 1:1 → avatar real da conversa; grupo → placeholder por
            // nome de cada remetente (não temos foto por-membro no payload).
            val pessoaConversa = Person.Builder().setName(nomeAvatar).setIcon(iconeAvatar).setKey(conversaId).build()

            for (linha in historico) {
                val pessoa = when {
                    linha.minha -> null
                    eGrupo -> Person.Builder()
                        .setName(linha.remetente)
                        .setIcon(androidx.core.graphics.drawable.IconCompat.createWithBitmap(ImagemHelper.avatarCircular(null, linha.remetente)))
                        .build()
                    else -> pessoaConversa
                }
                estilo.addMessage(NotificationCompat.MessagingStyle.Message(linha.corpo, linha.em, pessoa))
            }

            if (eGrupo) {
                estilo.conversationTitle = tituloGrupo ?: titulo
                estilo.isGroupConversation = true
            }

            // Atalho de conversa (long-lived): sem ele o Android mostra a notificação
            // na secção normal (ícone pequeno, agrupada). Com setShortcutId + este
            // atalho, vai para a secção "Conversas" com avatar grande e separada.
            try {
                val atalho = androidx.core.content.pm.ShortcutInfoCompat.Builder(context, conversaId)
                    .setShortLabel(nomeAvatar)
                    .setIcon(iconeAvatar)
                    .setPerson(pessoaConversa)
                    .setLongLived(true)
                    .setCategories(setOf("expo.modules.makachatpush.category.SHARE_TARGET"))
                    .setIntent(Intent(Intent.ACTION_VIEW).setPackage(context.packageName))
                    .build()
                androidx.core.content.pm.ShortcutManagerCompat.pushDynamicShortcut(context, atalho)
            } catch (_: Exception) {
                // ShortcutManager indisponível/limite — a notificação mostra na mesma
            }

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

            // tap → Activity trampolim (persiste a conversa pendente + abre a app).
            // Tem de ser uma Activity: em API 29+ um broadcast não pode lançar a
            // app com o processo killed e em API 31+ um trampoline via broadcast é
            // proibido (era isso que impedia a app de abrir a partir do tap).
            val abrir = PendingIntent.getActivity(
                context,
                ("abrir_" + conversaId).hashCode(),
                Intent(context, AbrirConversaActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
                    putExtra("conversa_id", conversaId)
                },
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

            val notificacao = NotificationCompat.Builder(context, canalId)
                .setSmallIcon(context.applicationInfo.icon)
                .setLargeIcon(avatar)
                .setShortcutId(conversaId)
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

        /**
         * Notificação genérica para pushes NÃO-makachat (corrida, encomenda…)
         * quando a app está morta — o "curso normal" que o FCM faria se este
         * service não fosse o dono único. Usa o bloco `notification` do push
         * com fallback ao `data` (o backend também envia title/body no data).
         */
        fun mostrarPushGeral(context: Context, remoteMessage: RemoteMessage) {
            val dados = remoteMessage.data
            // aceita as chaves EN (backend Laravel) e PT (hub NestJS: titulo/corpo)
            val titulo = remoteMessage.notification?.title ?: dados["title"] ?: dados["titulo"] ?: return
            val corpo = remoteMessage.notification?.body ?: dados["body"] ?: dados["corpo"] ?: ""

            val gestor = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                gestor.createNotificationChannel(
                    NotificationChannel("geral", "Notificações", NotificationManager.IMPORTANCE_HIGH)
                )
            }

            // tap → abre a app; extras com o data (url incluído) em best-effort
            val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                dados.forEach { (k, v) -> putExtra(k, v) }
            } ?: return
            val idPush = (dados["type"] ?: "geral") + (dados["corrida_id"] ?: dados["encomenda_id"] ?: dados["url"] ?: corpo)
            val abrirPI = PendingIntent.getActivity(
                context,
                idPush.hashCode(),
                launch,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

            val notificacao = NotificationCompat.Builder(context, "geral")
                .setSmallIcon(context.applicationInfo.icon)
                .setContentTitle(titulo)
                .setContentText(corpo)
                .setStyle(NotificationCompat.BigTextStyle().bigText(corpo))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setAutoCancel(true)
                .setContentIntent(abrirPI)
                .build()

            gestor.notify(idPush.hashCode(), notificacao)
        }
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        val tratado = MakachatPushProcessor.processar(applicationContext, remoteMessage.data)
        if (tratado) return

        // Não-makachat em foreground: o app trata via socket — sem banner.
        if (processoEmForeground()) return

        // Pushes que NÃO são do MakaChat (ex.: "nova corrida" do Humbi) não podem
        // morrer aqui: o Android entrega o FCM a UM só service e este vence no
        // manifest. Com o JS em execução delegamos ao setBackgroundMessageHandler;
        // com a app morta (estáticos limpos — processo novo) ou se a delegação
        // falhar (limites de background-start do startService), notificamos
        // nativamente — o "curso normal".
        val jsVivo = emissor != null || emissorChamada != null
        if (!(jsVivo && reencaminharParaRnFirebase(applicationContext, remoteMessage))) {
            mostrarPushGeral(applicationContext, remoteMessage)
        }
    }

    /**
     * Entrega a mensagem ao ReactNativeFirebaseMessagingHeadlessService (o mesmo
     * caminho que o receiver do react-native-firebase usa em background). Via
     * reflection para não criar dependência de compilação do rnfirebase — exige
     * push de prioridade `high` (senão o Android recusa arrancar o headless).
     * Devolve true só se o service arrancou — o chamador cai no display nativo.
     */
    private fun reencaminharParaRnFirebase(context: Context, remoteMessage: RemoteMessage): Boolean {
        return try {
            val cls = Class.forName("io.invertase.firebase.messaging.ReactNativeFirebaseMessagingHeadlessService")
            val intent = Intent(context, cls).apply { putExtra("message", remoteMessage) }

            if (context.startService(intent) != null) {
                // acquireWakeLockNow via reflection — evita dependência de compilação
                // do react-android neste módulo (só expo-modules-core está declarado).
                try {
                    Class.forName("com.facebook.react.HeadlessJsTaskService")
                        .getMethod("acquireWakeLockNow", Context::class.java)
                        .invoke(null, context)
                } catch (_: Exception) {
                    // sem wake lock o headless ainda arranca (FCM high-priority dá janela)
                }

                true
            } else {
                false
            }
        } catch (e: Exception) {
            android.util.Log.w("MakachatFcm", "reencaminhar p/ RNFirebase falhou: ${e.message}")

            false
        }
    }
}

/**
 * Processamento dos pushes MakaChat FORA do service: apps com o seu próprio
 * FirebaseMessagingService (o Android entrega FCM a UM só service) delegam
 * para aqui — `MakachatPushProcessor.processar(context, data)` devolve true
 * se o push era do MakaChat (e foi tratado) e false caso contrário.
 */
object MakachatPushProcessor {

    /** Trata um data push. true = era MakaChat; false = não é nosso. */
    @JvmStatic
    fun processar(context: Context, dados: Map<String, String>): Boolean {
        if (dados["makachat"] != "1") {
            return false
        }

        if (dados["makachat_chamada"] == "1") {
            tratarChamada(context, dados)

            return true
        }

        val chaveServico = dados["chave_servico"] ?: return true
        val conversaId = dados["conversa_id"] ?: return true
        val mensagemJson = dados["mensagem"] ?: "{}"
        val recebidaEm = Instant.now().toString()

        InboxDatabase.get(context).inserir(chaveServico, conversaId, mensagemJson, recebidaEm)

        MakachatFcmService.emissor?.invoke(
            mapOf(
                "chave_servico" to chaveServico,
                "conversa_id" to conversaId,
                "mensagem_json" to mensagemJson,
                "recebida_em" to recebidaEm,
            )
        )

        val titulo = dados["titulo"] ?: "Nova mensagem"

        // metadados para a notificação estilo WhatsApp (avatar + grupo), por conversa
        prefs(context).edit().apply {
            dados["foto"]?.takeIf { it.isNotEmpty() }?.let { putString("foto_$conversaId", it) }
            dados["conversa_tipo"]?.takeIf { it.isNotEmpty() }?.let { putString("tipo_$conversaId", it) }
            dados["conversa_titulo"]?.takeIf { it.isNotEmpty() }?.let { putString("titulo_$conversaId", it) }
            dados["conversa_foto"]?.takeIf { it.isNotEmpty() }?.let { putString("foto_conversa_$conversaId", it) }
        }.apply()

        // flag do hub na própria mensagem: silenciosa (não conta no badge) → canal sem som
        val semSom = try {
            org.json.JSONObject(mensagemJson).optBoolean("silenciosa", false)
        } catch (_: Exception) {
            false
        }

        // notifica SEMPRE, exceto quando o utilizador está mesmo dentro desta
        // conversa em primeiro plano (aí a app já mostra a mensagem in-app).
        // Minimizada/morta → processoEmForeground() é false → notifica.
        val aVerEstaConversa = MakachatFcmService.conversaVisivel == conversaId && MakachatFcmService.processoEmForeground()

        if (!aVerEstaConversa) {
            // só regista no histórico da notificação quando NÃO está a ver a conversa —
            // senão a MessagingStyle acumularia mensagens já vistas in-app
            InboxDatabase.get(context).inserirHistorico(conversaId, titulo, dados["corpo"] ?: "", minha = false)
            MakachatFcmService.mostrarMensagens(context, conversaId, titulo, semSom = semSom)
        }

        // recibo de ENTREGA (✓✓ cinzento) assim que o push chega ao dispositivo —
        // best-effort, autenticado pelo token+segredo do registo do dispositivo
        dados["mensagem_id"]?.let { reportarEntrega(context, conversaId, it) }

        return true
    }

    private fun reportarEntrega(context: Context, conversaId: String, mensagemId: String) {
        val db = InboxDatabase.get(context)
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

    private fun tratarChamada(context: Context, dados: Map<String, String>) {
        val chamadaId = dados["chamada_id"] ?: return

        if (dados["acao"] == "parar") {
            MakachatFcmService.cancelarChamada(context, chamadaId) // também para o ToqueChamadaService
            prefs(context).edit().remove("chamada_pendente").apply()
            // fecha o ecrã nativo se estiver aberto (atenderam/terminou noutro lado)
            context.sendBroadcast(
                Intent(MakachatFcmService.ACAO_FECHAR_ECRA).setPackage(context.packageName),
            )
            // app viva: o JS pode estar a tocar em-app — manda calar
            MakachatFcmService.emissorChamada?.invoke(mapOf("chamada_id" to chamadaId, "acao" to "parar"))

            return
        }

        val titulo = dados["titulo"] ?: "Chamada"
        val chamadaTipo = dados["chamada_tipo"] ?: "audio"
        val conversaId = dados["conversa_id"] ?: ""
        val chaveServico = dados["chave_servico"] ?: ""

        // app VISÍVEL com o handler JS subscrito → toca só em-app (sem notificação);
        // qualquer outro caso (minimizada, killed, JS não pronto) → notificação nativa
        if (MakachatFcmService.processoEmForeground() && MakachatFcmService.ouvinteChamadasPronto && MakachatFcmService.emissorChamada != null) {
            MakachatFcmService.emissorChamada?.invoke(
                mapOf(
                    "chamada_id" to chamadaId,
                    "chamada_tipo" to chamadaTipo,
                    "conversa_id" to conversaId,
                    "chave_servico" to chaveServico,
                    "acao" to "tocar",
                    "titulo" to titulo,
                    "foto" to (dados["foto"] ?: ""),
                )
            )

            return
        }

        MakachatFcmService.apresentarChamada(context, titulo, chamadaId, chamadaTipo, conversaId, chaveServico, dados["foto"])
    }

    private fun prefs(context: Context) = context.getSharedPreferences(MakachatFcmService.PREFS, Context.MODE_PRIVATE)
}
