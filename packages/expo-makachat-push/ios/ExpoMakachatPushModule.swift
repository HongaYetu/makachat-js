import ExpoModulesCore

public class ExpoMakachatPushModule: Module {
    public func definition() -> ModuleDefinition {
        Name("ExpoMakachatPush")

        Events("onMensagemPush")

        Function("configurar") { (appGroup: String?) in
            InboxDatabase.shared.abrir(appGroup: appGroup)
        }

        AsyncFunction("drenarInbox") { () -> String in
            InboxDatabase.shared.drenar()
        }

        AsyncFunction("contagemInbox") { () -> Int in
            InboxDatabase.shared.contagem()
        }
    }
}
