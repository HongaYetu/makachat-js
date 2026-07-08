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

        /** Cancela a notificação de chamada (ex.: depois de atender via app). */
        Function("cancelarNotificacaoChamada") { chamadaId: String ->
            MakachatFcmService.cancelarChamada(appContext.reactContext!!, chamadaId)
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
