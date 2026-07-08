import ExpoModulesCore

public class ExpoMakachatPushModule: Module {
    public func definition() -> ModuleDefinition {
        Name("ExpoMakachatPush")

        Events("onMensagemPush", "onChamadaPush")

        Function("configurar") { (appGroup: String?) in
            InboxDatabase.shared.abrir(appGroup: appGroup)
        }

        AsyncFunction("drenarInbox") { () -> String in
            InboxDatabase.shared.drenar()
        }

        AsyncFunction("contagemInbox") { () -> Int in
            InboxDatabase.shared.contagem()
        }

        // iOS sem CallKit nesta fase: a notificação normal abre a app e o
        // banner "chamada a decorrer" (sync) assume — sem chamada pendente nativa.
        AsyncFunction("obterChamadaPendente") { () -> String? in
            nil
        }

        Function("cancelarNotificacaoChamada") { (_: String) in
            // notificações são geridas pelo sistema; nada a cancelar aqui
        }
    }
}
