package expo.modules.makachatpush

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoMakachatPushModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("ExpoMakachatPush")

        Events("onMensagemPush", "onChamadaPush")

        Function("configurar") { _: String? -> /* App Group é só iOS */ }

        AsyncFunction("drenarInbox") {
            InboxDatabase.get(appContext.reactContext!!).drenar()
        }

        AsyncFunction("contagemInbox") {
            InboxDatabase.get(appContext.reactContext!!).contagem()
        }

        /** Chamada guardada pelo push com a app fechada (lê e limpa). */
        AsyncFunction("obterChamadaPendente") {
            val prefs = appContext.reactContext!!.getSharedPreferences(MakachatFcmService.PREFS, Context.MODE_PRIVATE)
            val json = prefs.getString("chamada_pendente", null)
            prefs.edit().remove("chamada_pendente").apply()
            json
        }

        /**
         * Config da resposta ao vivo: guardada no SQLite nativo para o
         * RespostaReceiver enviar com a app fechada (token+segredo do registo
         * do dispositivo em POST /v1/dispositivos).
         */
        Function("configurarResposta") { apiUrl: String, token: String, segredo: String, meuNome: String ->
            val db = InboxDatabase.get(appContext.reactContext!!)
            db.gravarConfig("api_url", apiUrl)
            db.gravarConfig("token_dispositivo", token)
            db.gravarConfig("segredo_resposta", segredo)
            db.gravarConfig("meu_nome", meuNome)
        }

        /** Cancela a notificação de chamada (ex.: depois de atender via app). */
        Function("cancelarNotificacaoChamada") { chamadaId: String ->
            MakachatFcmService.cancelarChamada(appContext.reactContext!!, chamadaId)
        }

        /**
         * Apresenta a chamada como no app-morto (toque contínuo/notificação
         * CallStyle) — o JS chama quando recebe onChamadaPush com a app viva
         * mas em background.
         */
        Function("apresentarChamada") { titulo: String, chamadaId: String, chamadaTipo: String, conversaId: String, chaveServico: String, foto: String? ->
            MakachatFcmService.apresentarChamada(
                appContext.reactContext!!,
                titulo,
                chamadaId,
                chamadaTipo,
                conversaId,
                chaveServico,
                foto?.takeIf { it.isNotBlank() },
            )
        }

        /** Conversa do tap numa notificação nativa de mensagem (lê e limpa). */
        AsyncFunction("obterConversaPendente") {
            val prefs = appContext.reactContext!!.getSharedPreferences(MakachatFcmService.PREFS, Context.MODE_PRIVATE)
            val conversaId = prefs.getString("conversa_pendente", null)
            prefs.edit().remove("conversa_pendente").apply()
            conversaId
        }

        /** Cancela a notificação de mensagens da conversa (ex.: ao abrir o chat na app). */
        Function("cancelarNotificacaoMensagens") { conversaId: String ->
            MakachatFcmService.cancelarNotificacaoMensagens(appContext.reactContext!!, conversaId)
        }

        /** Toque em-app: ringtone REAL do dispositivo em loop + vibração. */
        Function("tocarToqueDispositivo") {
            ToqueEmApp.tocar(appContext.reactContext!!)
        }

        Function("pararToqueDispositivo") {
            ToqueEmApp.parar(appContext.reactContext!!)
        }

        /** Flags dos serviços opcionais de chamada (injetadas pelo config plugin). */
        Function("configChamadas") {
            val ctx = appContext.reactContext!!
            mapOf(
                "toqueContinuo" to Opcoes.toqueContinuo(ctx),
                "ecraNativo" to Opcoes.ecraNativo(ctx),
                "servicoChamadaAtiva" to Opcoes.servicoChamadaAtiva(ctx),
            )
        }

        /** Foreground service da chamada em curso (JS chama quando fase → em_curso). */
        Function("iniciarChamadaAtiva") { nome: String, foto: String?, tipo: String ->
            val ctx = appContext.reactContext!!

            if (Opcoes.servicoChamadaAtiva(ctx)) {
                ChamadaAtivaService.iniciar(ctx, nome, foto, tipo)
            }
        }

        Function("pararChamadaAtiva") {
            ChamadaAtivaService.parar(appContext.reactContext!!)
        }

        OnCreate {
            // permite ao FCM service emitir para o JS quando a app está viva
            MakachatFcmService.emissor = { payload -> sendEvent("onMensagemPush", payload) }
            MakachatFcmService.emissorChamada = { payload -> sendEvent("onChamadaPush", payload) }
        }

        OnDestroy {
            MakachatFcmService.emissor = null
            MakachatFcmService.emissorChamada = null
        }
    }
}
