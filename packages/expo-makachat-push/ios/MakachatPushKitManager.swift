import ExpoModulesCore
import PushKit

/// Registo PushKit (VoIP) e recepção dos VoIP pushes → CallKit. Deve ser
/// registado no arranque (didFinishLaunching — requisito Apple) pelo
/// MakachatPushAppDelegateSubscriber.
final class MakachatPushKitManager: NSObject, PKPushRegistryDelegate {
    static let shared = MakachatPushKitManager()

    private var registry: PKPushRegistry?

    /// Idempotente: se já registado, não cria novo registry.
    func register() {
        guard registry == nil else { return }
        let r = PKPushRegistry(queue: .main)
        r.delegate = self
        r.desiredPushTypes = [.voIP]
        registry = r
    }

    func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
        guard type == .voIP else { return }
        let token = pushCredentials.token.map { String(format: "%02x", $0) }.joined()
        MakachatVoipStore.shared.voipToken = token
        (MakachatCallManager.shared.moduleInstance as? Module)?.sendEvent("onVoipTokenReceived", ["token": token])
    }

    func pushRegistry(
        _ registry: PKPushRegistry,
        didReceiveIncomingPushWith payload: PKPushPayload,
        for type: PKPushType,
        completion: @escaping () -> Void
    ) {
        guard type == .voIP else { completion(); return }

        var data: [String: String] = [:]
        if let raw = payload.dictionaryPayload["data"] as? [String: Any] {
            for (k, v) in raw { data[k] = "\(v)" }
        }

        // regra Apple: reportar SEMPRE uma chamada, mesmo com payload inválido,
        // senão o sistema pune (deixa de entregar VoIP pushes)
        if data.isEmpty {
            data = ["titulo": "Chamada", "acao": "tocar"]
        }

        MakachatCallManager.shared.reportIncomingCall(data: data) { _ in completion() }
    }

    func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
        guard type == .voIP else { return }
        MakachatVoipStore.shared.voipToken = nil
    }
}
