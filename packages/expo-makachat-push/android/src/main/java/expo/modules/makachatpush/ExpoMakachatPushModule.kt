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
