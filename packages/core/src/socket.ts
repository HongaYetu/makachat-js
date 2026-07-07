import { io, Socket } from 'socket.io-client';
import { EVENTOS_CLIENTE } from './eventos';
import { Ack, CursorConversa, DadosEnvioMensagem, Mensagem, ObterToken } from './tipos';

export interface MakaSocketOpcoes {
    obterToken: ObterToken;
    /** chamado depois de (re)ligar — o SyncEngine faz flush + delta sync aqui */
    aoLigar?: () => void;
    aoDesligar?: () => void;
}

/**
 * Ligação socket.io ao namespace /chat: autentica com o JWT do serviço,
 * renova o token quando o handshake falha por expiração e expõe emissões
 * com ack tipado.
 */
export class MakaSocket {
    private socket: Socket | null = null;
    private opcoes: MakaSocketOpcoes;

    constructor(opcoes: MakaSocketOpcoes) {
        this.opcoes = opcoes;
    }

    get ligado(): boolean {
        return this.socket?.connected ?? false;
    }

    get bruto(): Socket | null {
        return this.socket;
    }

    async ligar(): Promise<void> {
        if (this.socket) {
            return;
        }

        const credenciais = await this.opcoes.obterToken();

        this.socket = io(`${credenciais.socket_url}/chat`, {
            auth: { token: credenciais.token },
            transports: ['websocket'],
        });

        this.socket.on('connect', () => this.opcoes.aoLigar?.());
        this.socket.on('disconnect', () => this.opcoes.aoDesligar?.());

        this.socket.on('connect_error', async () => {
            // token possivelmente expirado — renovar e tentar de novo
            const novas = await this.opcoes.obterToken().catch(() => null);

            if (novas && this.socket) {
                (this.socket.auth as { token: string }).token = novas.token;
            }
        });
    }

    desligar(): void {
        this.socket?.disconnect();
        this.socket = null;
    }

    on(evento: string, handler: (payload: never) => void): void {
        this.socket?.on(evento, handler as (payload: unknown) => void);
    }

    private emitirComAck<T>(evento: string, payload: unknown): Promise<Ack<T>> {
        return new Promise((resolve, reject) => {
            if (!this.socket?.connected) {
                reject(new Error('Socket desligado'));

                return;
            }

            this.socket.timeout(10_000).emit(evento, payload, (erro: Error | null, ack: Ack<T>) => {
                if (erro) {
                    reject(erro);
                } else {
                    resolve(ack);
                }
            });
        });
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
        this.socket?.emit(EVENTOS_CLIENTE.TYPING, { conversa_id: conversaId, ativo }, () => undefined);
    }

    entrarConversa(conversaId: string) {
        return this.emitirComAck(EVENTOS_CLIENTE.ENTRAR_CONVERSA, { conversa_id: conversaId });
    }

    sincronizarDesde(cursores: CursorConversa[]) {
        return this.emitirComAck<{ lotes: { conversa_id: string; mensagens: Mensagem[] }[] }>(EVENTOS_CLIENTE.SYNC, {
            cursores,
        });
    }
}
