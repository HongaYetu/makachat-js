import Foundation

/// Armazenamento simples (UserDefaults, ciente do App Group) para o token VoIP
/// e a "chamada pendente" — sobrevive ao cold start para o JS ler no arranque.
final class MakachatVoipStore {
    static let shared = MakachatVoipStore()

    private var appGroup: String?

    private var defaults: UserDefaults {
        if let grupo = appGroup, let d = UserDefaults(suiteName: grupo) {
            return d
        }
        return UserDefaults.standard
    }

    func configurar(appGroup: String?) {
        self.appGroup = appGroup
    }

    var voipToken: String? {
        get { defaults.string(forKey: "makachat_voip_token") }
        set { defaults.set(newValue, forKey: "makachat_voip_token") }
    }

    /// JSON `ChamadaPush` ({chamada_id, chamada_tipo, conversa_id, chave_servico, acao, titulo?, foto?}).
    var chamadaPendente: String? {
        get { defaults.string(forKey: "makachat_chamada_pendente") }
        set {
            if let v = newValue {
                defaults.set(v, forKey: "makachat_chamada_pendente")
            } else {
                defaults.removeObject(forKey: "makachat_chamada_pendente")
            }
        }
    }
}
