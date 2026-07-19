import { HubSocket } from '@hongayetu/honga-hub-core';
import { EVENTOS_CLIENTE } from './eventos';
import { Ack, CursorConversa, DadosEnvioMensagem, Mensagem } from './tipos';

/**
 * Socket do módulo CHAT. Compõe sobre o {@link HubSocket} genérico (ligação,
 * token, canais nomeados) e acrescenta as ações tipadas `chat:*`. Delega o
 * ciclo de vida/canais para o hub, por isso serve de drop-in para quem usava o
 * antigo MakaSocket. Uma app sem chat nunca instancia isto.
 */
export class MakaSocket {
    constructor(private readonly hub: HubSocket) {}

    get ligado(): boolean {
        return this.hub.ligado;
    }

    ligar(): Promise<void> {
        return this.hub.ligar();
    }

    desligar(): void {
        this.hub.desligar();
    }

    garantirLigado(): void {
        this.hub.garantirLigado();
    }

    on(evento: string, handler: (payload: never) => void): void {
        this.hub.on(evento, handler);
    }

    subscreverCanal(canal: string, evento: string, handler: (payload: never) => void): () => void {
        return this.hub.subscreverCanal(canal, evento, handler);
    }

    private emitirComAck<T>(evento: string, payload: unknown): Promise<Ack<T>> {
        return this.hub.emitirComAck<T>(evento, payload);
    }

    enviarMensagem(dados: DadosEnvioMensagem & { ref_cliente: string }) {
        return this.emitirComAck<{ mensagem: Mensagem; duplicada: boolean }>(EVENTOS_CLIENTE.ENVIAR, dados);
    }

    editarMensagem(mensagemId: string, conteudo: string) {
        return this.emitirComAck<{ mensagem: Mensagem }>(EVENTOS_CLIENTE.EDITAR, {
            mensagem_id: mensagemId,
            conteudo,
        });
    }

    eliminarMensagem(mensagemId: string, paraTodos: boolean) {
        return this.emitirComAck<{ mensagem: Mensagem; para_todos: boolean }>(EVENTOS_CLIENTE.ELIMINAR, {
            mensagem_id: mensagemId,
            para_todos: paraTodos,
        });
    }

    marcarEntregues(conversaId: string, ateMensagemId: string) {
        return this.emitirComAck(EVENTOS_CLIENTE.ENTREGUES, { conversa_id: conversaId, ate_mensagem_id: ateMensagemId });
    }

    marcarLidas(conversaId: string, ateMensagemId: string) {
        return this.emitirComAck(EVENTOS_CLIENTE.LIDAS, { conversa_id: conversaId, ate_mensagem_id: ateMensagemId });
    }

    alternarReacao(mensagemId: string, emoji: string) {
        return this.emitirComAck<{ mensagem_id: string; conversa_id: string; emoji: string | null }>(
            EVENTOS_CLIENTE.REAGIR,
            { mensagem_id: mensagemId, emoji },
        );
    }

    typing(conversaId: string, ativo: boolean): void {
        this.hub.emitir(EVENTOS_CLIENTE.TYPING, { conversa_id: conversaId, ativo });
    }

    entrarConversa(conversaId: string) {
        return this.emitirComAck(EVENTOS_CLIENTE.ENTRAR_CONVERSA, { conversa_id: conversaId });
    }

    sincronizarDesde(cursores: CursorConversa[], alteradasDesde?: string) {
        return this.emitirComAck<{ lotes: { conversa_id: string; mensagens: Mensagem[] }[]; agora?: string }>(EVENTOS_CLIENTE.SYNC, {
            cursores,
            ...(alteradasDesde ? { alteradas_desde: alteradasDesde } : {}),
        });
    }
}
