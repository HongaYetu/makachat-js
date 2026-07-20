import UserNotifications
import Intents

/**
 * TEMPLATE da Notification Service Extension — copiar para o target NSE da
 * app (com o App Group configurado, ex: group.com.hongayetu.humbi) e incluir
 * o InboxDatabase.swift do módulo no mesmo target.
 *
 * O servidor envia o push com mutable-content=1 e data: makachat=1,
 * chave_servico, conversa_id, mensagem=<json>, titulo, corpo, e ainda
 * foto (avatar do remetente), conversa_tipo/conversa_titulo/conversa_foto
 * (grupos).
 *
 * AVATAR (Communication Notifications, estilo iMessage): a notificação é
 * decorada com um INSendMessageIntent cujo INPerson leva a foto baixada.
 * Requisitos além deste ficheiro:
 *  - capability "Communication Notifications" no target da APP e da NSE
 *    (entitlement com.apple.developer.usernotifications.communication);
 *  - NSUserActivityTypes com "INSendMessageIntent" no Info.plist da APP
 *    (o config plugin do expo-makachat-push trata dos dois no target da app).
 */
class NotificationService: UNNotificationServiceExtension {
    private let appGroup = "group.com.hongayetu.SUBSTITUIR"

    private var contentHandler: ((UNNotificationContent) -> Void)?
    private var conteudoPendente: UNMutableNotificationContent?

    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        self.contentHandler = contentHandler

        let conteudo = (request.content.mutableCopy() as? UNMutableNotificationContent) ?? UNMutableNotificationContent()
        self.conteudoPendente = conteudo

        let dados = request.content.userInfo

        guard dados["makachat"] as? String == "1",
              let chave = dados["chave_servico"] as? String,
              let conversa = dados["conversa_id"] as? String
        else {
            contentHandler(conteudo)
            return
        }

        InboxDatabase.shared.abrir(appGroup: appGroup)
        InboxDatabase.shared.inserir(
            chaveServico: chave,
            conversaId: conversa,
            mensagemJson: dados["mensagem"] as? String ?? "{}"
        )

        let remetente = dados["titulo"] as? String ?? conteudo.title
        let corpo = dados["corpo"] as? String ?? conteudo.body
        let eGrupo = dados["conversa_tipo"] as? String == "grupo"
        let tituloGrupo = dados["conversa_titulo"] as? String

        conteudo.title = eGrupo ? (tituloGrupo ?? remetente) : remetente
        conteudo.body = eGrupo ? "\(remetente): \(corpo)" : corpo

        // avatar: grupo → foto do grupo; 1:1 → foto do remetente
        let fotoUrl = eGrupo
            ? (dados["conversa_foto"] as? String ?? dados["foto"] as? String)
            : dados["foto"] as? String

        decorarComoComunicacao(
            conteudo: conteudo,
            remetente: remetente,
            corpo: corpo,
            conversaId: conversa,
            grupo: eGrupo ? (tituloGrupo ?? remetente) : nil,
            imagem: baixarImagem(fotoUrl)
        )
    }

    /** O SO vai matar a extensão — entrega o que houver (título/corpo já postos). */
    override func serviceExtensionTimeWillExpire() {
        if let conteudo = conteudoPendente {
            contentHandler?(conteudo)
        }
    }

    // MARK: - Communication Notification

    /**
     * Decora a notificação com INSendMessageIntent (avatar redondo + nome, como
     * o iMessage). Qualquer falha entrega a notificação simples — nunca perde
     * o push por causa do avatar.
     */
    private func decorarComoComunicacao(
        conteudo: UNMutableNotificationContent,
        remetente: String,
        corpo: String,
        conversaId: String,
        grupo: String?,
        imagem: INImage?
    ) {
        let pessoa = INPerson(
            personHandle: INPersonHandle(value: conversaId, type: .unknown),
            nameComponents: nil,
            displayName: remetente,
            image: grupo == nil ? imagem : nil,
            contactIdentifier: nil,
            customIdentifier: conversaId
        )

        let intent = INSendMessageIntent(
            recipients: nil,
            outgoingMessageType: .outgoingMessageText,
            content: corpo,
            speakableGroupName: grupo.map { INSpeakableString(spokenPhrase: $0) },
            conversationIdentifier: conversaId,
            serviceName: nil,
            sender: pessoa,
            attachments: nil
        )

        // avatar do grupo entra pela imagem do "grupo falável"
        if grupo != nil, let imagem {
            intent.setImage(imagem, forParameterNamed: \.speakableGroupName)
        }

        let interacao = INInteraction(intent: intent, response: nil)
        interacao.direction = .incoming
        interacao.donate { [weak self] _ in
            guard let self, let handler = self.contentHandler else { return }

            do {
                let decorado = try conteudo.updating(from: intent)
                handler(decorado)
            } catch {
                handler(conteudo)
            }
        }
    }

    // MARK: - Download do avatar

    /**
     * Baixa a foto de forma síncrona com timeout curto (a NSE tem ~30s no
     * total) e cache no App Group — o mesmo avatar não volta a ser baixado.
     */
    private func baixarImagem(_ urlString: String?) -> INImage? {
        guard let urlString, let url = URL(string: urlString) else { return nil }

        let cache = ficheiroCache(para: urlString)

        if let cache, let dadosCache = try? Data(contentsOf: cache) {
            return INImage(imageData: dadosCache)
        }

        var resultado: Data?
        let semaforo = DispatchSemaphore(value: 0)

        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 5
        config.timeoutIntervalForResource = 8

        URLSession(configuration: config).dataTask(with: url) { data, resposta, _ in
            let http = resposta as? HTTPURLResponse

            if let data, (http?.statusCode ?? 0) < 400 {
                resultado = data
            }

            semaforo.signal()
        }.resume()

        _ = semaforo.wait(timeout: .now() + 8)

        guard let dados = resultado else { return nil }

        if let cache {
            try? dados.write(to: cache)
        }

        return INImage(imageData: dados)
    }

    /** Caminho de cache no App Group (hash do URL) — nil se o grupo não existir. */
    private func ficheiroCache(para url: String) -> URL? {
        guard let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)
        else { return nil }

        let pasta = base.appendingPathComponent("makachat-avatars", isDirectory: true)
        try? FileManager.default.createDirectory(at: pasta, withIntermediateDirectories: true)

        let nome = String(url.hashValue, radix: 36).replacingOccurrences(of: "-", with: "n")

        return pasta.appendingPathComponent("\(nome).img")
    }
}
