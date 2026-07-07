package expo.modules.makachatpush

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoMakachatPushModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("ExpoMakachatPush")

        Events("onMensagemPush")

        Function("configurar") { _: String? -> /* App Group é só iOS */ }

        AsyncFunction("drenarInbox") {
            InboxDatabase.get(appContext.reactContext!!).drenar()
        }

        AsyncFunction("contagemInbox") {
            InboxDatabase.get(appContext.reactContext!!).contagem()
        }

        OnCreate {
            // permite ao FCM service emitir para o JS quando a app está viva
            MakachatFcmService.emissor = { payload -> sendEvent("onMensagemPush", payload) }
        }

        OnDestroy {
            MakachatFcmService.emissor = null
        }
    }
}
