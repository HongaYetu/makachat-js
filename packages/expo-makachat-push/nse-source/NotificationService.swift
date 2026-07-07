import UserNotifications

/**
 * TEMPLATE da Notification Service Extension — copiar para o target NSE da
 * app (com o App Group configurado, ex: group.com.hongayetu.humbi) e incluir
 * o InboxDatabase.swift do módulo no mesmo target.
 *
 * O servidor envia o push com mutable-content=1 e data: makachat=1,
 * chave_servico, conversa_id, mensagem=<json>, titulo, corpo.
 */
class NotificationService: UNNotificationServiceExtension {
    private let appGroup = "group.com.hongayetu.SUBSTITUIR"

    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        let conteudo = (request.content.mutableCopy() as? UNMutableNotificationContent) ?? UNMutableNotificationContent()
        let dados = request.content.userInfo

        if dados["makachat"] as? String == "1",
           let chave = dados["chave_servico"] as? String,
           let conversa = dados["conversa_id"] as? String {
            InboxDatabase.shared.abrir(appGroup: appGroup)
            InboxDatabase.shared.inserir(
                chaveServico: chave,
                conversaId: conversa,
                mensagemJson: dados["mensagem"] as? String ?? "{}"
            )

            conteudo.title = dados["titulo"] as? String ?? conteudo.title
            conteudo.body = dados["corpo"] as? String ?? conteudo.body
        }

        contentHandler(conteudo)
    }
}
