import ExpoModulesCore

public class ExpoMakachatPushModule: Module {
    public func definition() -> ModuleDefinition {
        Name("ExpoMakachatPush")

        Events("onMensagemPush", "onChamadaPush", "onVoipTokenReceived")

        OnCreate {
            // liga a instância p/ os managers emitirem eventos ao JS + garante o
            // registo PushKit (idempotente — rede de segurança se o subscriber falhar)
            MakachatCallManager.shared.moduleInstance = self
            MakachatPushKitManager.shared.register()
        }

        OnDestroy {
            if MakachatCallManager.shared.moduleInstance === self {
                MakachatCallManager.shared.moduleInstance = nil
            }
        }

        Function("configurar") { (appGroup: String?) in
            MakachatVoipStore.shared.configurar(appGroup: appGroup)
            InboxDatabase.shared.abrir(appGroup: appGroup)
        }

        AsyncFunction("drenarInbox") { () -> String in
            InboxDatabase.shared.drenar()
        }

        AsyncFunction("contagemInbox") { () -> Int in
            InboxDatabase.shared.contagem()
        }

        // chamada pendente (cold start / atender via CallKit): lê e limpa
        AsyncFunction("obterChamadaPendente") { () -> String? in
            MakachatCallManager.shared.consumirPendente()
        }

        AsyncFunction("obterConversaPendente") { () -> String? in
            nil
        }

        // token VoIP do PushKit (iOS) — o JS regista-o em POST /v1/dispositivos
        Function("getVoipToken") { () -> String? in
            MakachatVoipStore.shared.voipToken
        }

        // força o CallKit quando um push de chamada chega com a app viva em background
        Function("apresentarChamada") { (titulo: String, chamadaId: String, chamadaTipo: String, conversaId: String, chaveServico: String, foto: String?) in
            var data: [String: String] = [
                "titulo": titulo,
                "chamada_id": chamadaId,
                "chamada_tipo": chamadaTipo,
                "conversa_id": conversaId,
                "chave_servico": chaveServico,
                "acao": "tocar",
            ]
            if let f = foto { data["foto"] = f }
            MakachatCallManager.shared.reportIncomingCall(data: data)
        }

        // termina a chamada no CallKit (ex.: atenderam/terminou noutro dispositivo)
        Function("cancelarNotificacaoChamada") { (_: String) in
            MakachatCallManager.shared.endAllCalls()
        }

        Function("cancelarNotificacaoMensagens") { (_: String) in
            // NSE/sistema gere as notificações de mensagem; nada a cancelar aqui
        }

        Function("configurarResposta") { (_: String, _: String, _: String, _: String) in
            // resposta ao vivo é do Android; no iOS a app abre para responder
        }

        // iOS: o CallKit já toca e mostra a chamada (a entrar e em curso) —
        // sem toque empacotado nem foreground service
        Function("configChamadas") { () -> [String: Bool] in
            ["toqueContinuo": false, "ecraNativo": true, "servicoChamadaAtiva": false]
        }

        Function("ouvinteChamadasPronto") { (_: Bool) in }
        Function("tocarToqueDispositivo") { }
        Function("pararToqueDispositivo") { }
        Function("iniciarChamadaAtiva") { (_: String, _: String?, _: String) in }
        Function("pararChamadaAtiva") { }
    }
}
