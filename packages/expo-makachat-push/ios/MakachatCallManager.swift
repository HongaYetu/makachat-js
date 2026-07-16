import AVFoundation
import CallKit
import ExpoModulesCore

/// Orquestração CallKit no modelo JS-driven: reporta a chamada a entrar (do VoIP
/// push ou de `apresentarChamada`), e ao atender/recusar apenas guarda a "chamada
/// pendente" + emite evento — quem LIGA ao LiveKit é o JS (`ChamadasProvider`),
/// não o nativo. Por isso NÃO há dependência do LiveKit aqui.
final class MakachatCallManager: NSObject {
    static let shared = MakachatCallManager()

    let provider: CXProvider
    private let controller = CXCallController()

    /// Instância do módulo Expo — para emitir eventos ao JS (weak: evita ciclo).
    weak var moduleInstance: AnyObject?

    private var activeCallUUID: UUID?
    private var activeCallData: [String: String]?
    private var callWasAnswered = false

    private override init() {
        let config = CXProviderConfiguration()
        config.supportsVideo = true
        config.maximumCallsPerCallGroup = 1
        config.maximumCallGroups = 1
        config.supportedHandleTypes = [.generic]
        provider = CXProvider(configuration: config)
        super.init()
        provider.setDelegate(self, queue: nil)
    }

    /// Reporta uma chamada a entrar ao CallKit. `acao:'parar'` termina a atual.
    func reportIncomingCall(data: [String: String], completion: ((Error?) -> Void)? = nil) {
        if (data["acao"] ?? "tocar") == "parar" {
            endAllCalls()
            MakachatVoipStore.shared.chamadaPendente = nil
            completion?(nil)
            return
        }

        let uuid = UUID()
        activeCallUUID = uuid
        activeCallData = data
        callWasAnswered = false

        let update = CXCallUpdate()
        update.remoteHandle = CXHandle(type: .generic, value: data["conversa_id"] ?? data["chamada_id"] ?? "makachat")
        update.localizedCallerName = data["titulo"] ?? "Chamada"
        update.hasVideo = (data["chamada_tipo"] == "video")

        // guarda como pendente (acao 'tocar') p/ o cold start; ao atender vira 'atender'
        persistirPendente(acao: "tocar")

        provider.reportNewIncomingCall(with: uuid, update: update) { [weak self] error in
            if error != nil { self?.limpar() }
            completion?(error)
        }
    }

    func endAllCalls() {
        guard let uuid = activeCallUUID else { return }
        controller.request(CXTransaction(action: CXEndCallAction(call: uuid))) { _ in }
    }

    /// Lê e limpa a chamada pendente (o JS chama no arranque / AppState active).
    func consumirPendente() -> String? {
        let json = MakachatVoipStore.shared.chamadaPendente
        MakachatVoipStore.shared.chamadaPendente = nil
        return json
    }

    fileprivate func persistirPendente(acao: String) {
        guard var data = activeCallData else { return }
        data["acao"] = acao
        if let bytes = try? JSONSerialization.data(withJSONObject: data),
           let str = String(data: bytes, encoding: .utf8) {
            MakachatVoipStore.shared.chamadaPendente = str
        }
    }

    fileprivate func emitir(acao: String) {
        guard var data = activeCallData else { return }
        data["acao"] = acao
        (moduleInstance as? Module)?.sendEvent("onChamadaPush", data)
    }

    fileprivate func limpar() {
        activeCallUUID = nil
        activeCallData = nil
        callWasAnswered = false
    }
}

extension MakachatCallManager: CXProviderDelegate {
    func providerDidReset(_ provider: CXProvider) {
        limpar()
    }

    func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        callWasAnswered = true
        persistirPendente(acao: "atender")
        // JS vivo → o ChamadasProvider lê e liga ao hub; app morta → lê no arranque
        emitir(acao: "atender")
        action.fulfill()
    }

    func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        if callWasAnswered {
            emitir(acao: "parar")
        } else {
            // recusou antes de atender — o JS envia o rejeitar ao hub quando abrir;
            // app morta → o timeout do hub cancela a chamada
            persistirPendente(acao: "rejeitar")
            emitir(acao: "rejeitar")
        }
        limpar()
        action.fulfill()
    }

    func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
        // o LiveKit (via @livekit/react-native no JS) gere a media; garantimos só a
        // categoria certa para o CallKit não repor a sessão de forma incompatível
        try? audioSession.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth, .allowBluetoothA2DP, .mixWithOthers])
    }

    func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {}
}
