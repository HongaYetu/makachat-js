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
    /** handlers registados antes de ligar() — aplicados quando o socket nasce */
    private handlers: [string, (payload: unknown) => void][] = [];
    /** canais nomeados subscritos (canal → handlers de evento) — re-subscritos no reconnect */
    private canais = new Map<string, Set<{ evento: string; handler: (payload: unknown) => void }>>();
    /** evita dois sockets vivos quando ligar() é chamado em concorrência (ex.: StrictMode) */
    private aLigar: Promise<void> | null = null;
    private geracao = 0;
    /** falhas seguidas do 1º connect (obterToken) — controla o backoff do retry */
    private tentativasArranque = 0;
    private retryAgendado: ReturnType<typeof setTimeout> | null = null;

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

        if (this.aLigar) {
            return this.aLigar;
        }

        this.aLigar = this.ligarInterno().finally(() => {
            this.aLigar = null;
        });

        return this.aLigar;
    }

    private async ligarInterno(): Promise<void> {
        const geracao = this.geracao;

        let credenciais: Awaited<ReturnType<ObterToken>>;

        try {
            credenciais = await this.opcoes.obterToken();
        } catch {
            // 1º connect falhado (sem rede/backend em baixo): o socket.io ainda
            // não existe para religar sozinho — agendamos nós o retry com backoff.
            this.agendarRetryArranque(geracao);

            return;
        }

        // desligar() foi chamado durante o await — não deixar nascer um socket órfão
        if (geracao !== this.geracao) {
            return;
        }

        this.socket = io(`${credenciais.socket_url}/chat`, {
            auth: { token: credenciais.token },
            transports: ['websocket'],
            reconnection: true,
            reconnectionDelayMax: 5_000,
        });

        for (const [evento, handler] of this.handlers) {
            this.socket.on(evento, handler);
        }

        // socket novo (após desligar): re-aplicar os handlers de canal também
        for (const [, set] of this.canais) {
            for (const { evento, handler } of set) this.socket.on(evento, handler);
        }

        this.socket.on('connect', () => {
            this.tentativasArranque = 0;
            this.opcoes.aoLigar?.();
            // rooms socket.io perdem-se no reconnect — re-emitir o join de cada canal
            this.reidratarCanais();
        });
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
        this.geracao += 1;
        this.tentativasArranque = 0;

        if (this.retryAgendado) {
            clearTimeout(this.retryAgendado);
            this.retryAgendado = null;
        }

        this.socket?.disconnect();
        this.socket = null;
    }

    /**
     * Reconexão imediata (ex.: app volta do background — Android mata websockets
     * e o backoff do socket.io demoraria a notar). Se o 1º connect falhou (socket
     * ainda nulo), re-arranca do zero em vez de ficar morto até reiniciar a app.
     */
    garantirLigado(): void {
        if (!this.socket) {
            void this.ligar();

            return;
        }

        if (!this.socket.connected) {
            this.socket.connect();
        }
    }

    /** Backoff (1s→30s) para re-tentar o 1º connect enquanto o socket não existe. */
    private agendarRetryArranque(geracao: number): void {
        if (geracao !== this.geracao || this.retryAgendado) {
            return;
        }

        const atraso = Math.min(1_000 * 2 ** this.tentativasArranque, 30_000);
        this.tentativasArranque += 1;

        this.retryAgendado = setTimeout(() => {
            this.retryAgendado = null;

            // desligar() entretanto? socket já nasceu por outra via? não re-tentar.
            if (geracao !== this.geracao || this.socket) {
                return;
            }

            void this.ligar();
        }, atraso);
    }

    on(evento: string, handler: (payload: never) => void): void {
        this.handlers.push([evento, handler as (payload: unknown) => void]);
        // se o socket já existe, aplica imediatamente; senão fica guardado para o ligar()
        this.socket?.on(evento, handler as (payload: unknown) => void);
    }

    /**
     * Subscreve um CANAL nomeado do hub (estilo Pusher/Echo) reutilizando o
     * MESMO socket do chat: faz join no canal e ouve `evento` nesse socket. O
     * hub autoriza o canal (delega ao serviço). Devolve uma função de cancelar
     * que sai do canal quando fica sem handlers. Re-subscreve sozinho no
     * reconnect (ver reidratarCanais).
     */
    subscreverCanal(canal: string, evento: string, handler: (payload: never) => void): () => void {
        const entrada = { evento, handler: handler as (payload: unknown) => void };
        let set = this.canais.get(canal);
        const primeira = !set;

        if (!set) {
            set = new Set();
            this.canais.set(canal, set);
        }

        set.add(entrada);
        this.socket?.on(evento, entrada.handler);

        // primeiro handler deste canal → pedir o join (se já ligado; senão o
        // 'connect'/reidratarCanais trata disso)
        if (primeira && this.socket?.connected) {
            this.socket.emit('hub:canal:subscrever', { canal }, () => undefined);
        }

        return () => {
            const atual = this.canais.get(canal);

            if (!atual) return;

            atual.delete(entrada);
            this.socket?.off(evento, entrada.handler);

            if (atual.size === 0) {
                this.canais.delete(canal);

                if (this.socket?.connected) {
                    this.socket.emit('hub:canal:sair', { canal }, () => undefined);
                }
            }
        };
    }

    /** Re-emite o join de todos os canais subscritos (chamado em cada connect). */
    private reidratarCanais(): void {
        for (const canal of this.canais.keys()) {
            this.socket?.emit('hub:canal:subscrever', { canal }, () => undefined);
        }
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

    sincronizarDesde(cursores: CursorConversa[], alteradasDesde?: string) {
        return this.emitirComAck<{ lotes: { conversa_id: string; mensagens: Mensagem[] }[]; agora?: string }>(EVENTOS_CLIENTE.SYNC, {
            cursores,
            ...(alteradasDesde ? { alteradas_desde: alteradasDesde } : {}),
        });
    }
}
