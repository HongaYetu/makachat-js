import { MakaApi } from './api';
import { EVENTOS_SERVIDOR } from './eventos';
import { MakaSocket } from './socket';
import { StorageAdapter } from './storage';
import {
    Conversa,
    DadosEnvioMensagem,
    IdentidadeConfig,
    Mensagem,
    Presenca,
    Recibo,
    Typing,
} from './tipos';
import { uuid } from './uuid';

export interface SyncEngineOpcoes {
    identidade: IdentidadeConfig;
    aoTyping?: (typing: Typing) => void;
    aoPresenca?: (presenca: Presenca) => void;
}

type Ouvinte = (versao: number) => void;

/**
 * Motor offline-first (padrão kanda-messaging): o storage local é a fonte de
 * verdade da UI; escritas acontecem primeiro localmente (estado `a_enviar`) e
 * o outbox faz flush idempotente por `ref_cliente` quando há ligação. Cada
 * alteração incrementa a versão e notifica os subscritores (hooks re-renderizam).
 */
export class SyncEngine {
    private versao = 0;
    private ouvintes = new Set<Ouvinte>();
    private aFazerFlush = false;

    constructor(
        readonly storage: StorageAdapter,
        readonly api: MakaApi,
        readonly socket: MakaSocket,
        private readonly opcoes: SyncEngineOpcoes,
    ) {
        this.registarEventos();
    }

    // ---- subscrição (usada pelos hooks) ----

    get versaoAtual(): number {
        return this.versao;
    }

    subscrever(ouvinte: Ouvinte): () => void {
        this.ouvintes.add(ouvinte);

        return () => this.ouvintes.delete(ouvinte);
    }

    private notificar(): void {
        this.versao += 1;

        for (const ouvinte of this.ouvintes) {
            ouvinte(this.versao);
        }
    }

    // ---- arranque / reconexão ----

    async iniciar(): Promise<void> {
        await this.storage.init();
        await this.socket.ligar();
    }

    /** Chamado pelo MakaSocket em cada (re)ligação. */
    async aoLigar(): Promise<void> {
        await this.atualizarConversas();
        await this.sincronizarDelta();
        await this.flushOutbox();
    }

    async atualizarConversas(): Promise<void> {
        const { conversas } = await this.api.listarConversas({ limite: 100 });
        const arquivadas = await this.api.listarConversas({ arquivadas: true, limite: 100 });

        await this.storage.upsertConversas([...conversas, ...arquivadas.conversas]);
        this.notificar();
    }

    async sincronizarDelta(): Promise<void> {
        const cursores = await this.storage.cursores();

        if (!cursores.length) {
            return;
        }

        const ack = await this.socket.sincronizarDesde(cursores).catch(() => null);

        if (ack?.estado === 'ok' && ack.lotes.length) {
            for (const lote of ack.lotes) {
                await this.storage.upsertMensagens(lote.mensagens.map((m) => ({ ...m, estado_envio: 'enviada' as const })));
            }

            this.notificar();
        }
    }

    // ---- envio offline-first ----

    async enviarMensagem(dados: DadosEnvioMensagem): Promise<Mensagem> {
        const refCliente = uuid();
        const agora = new Date().toISOString();

        const otimista: Mensagem = {
            // id provisório ordenável no fim da lista local; substituído pelo id do servidor
            id: `zz-local-${agora}-${refCliente}`,
            conversa_id: dados.conversa_id,
            remetente_identidade_id: 'eu',
            tipo: dados.tipo ?? 'texto',
            conteudo: dados.conteudo ?? null,
            resposta_a_id: dados.resposta_a_id ?? null,
            encaminhada_de_id: dados.encaminhada_de_id ?? null,
            ref_cliente: refCliente,
            editada_em: null,
            eliminada: false,
            reacoes: [],
            anexos: [],
            criada_em: agora,
            estado_envio: 'a_enviar',
        };

        await this.storage.upsertMensagens([otimista]);
        await this.storage.adicionarOutbox({
            ref_cliente: refCliente,
            conversa_id: dados.conversa_id,
            dados,
            criado_em: agora,
            tentativas: 0,
        });
        this.notificar();

        void this.flushOutbox();

        return otimista;
    }

    /** Flush idempotente: reenvio com o mesmo ref_cliente nunca duplica no servidor. */
    async flushOutbox(): Promise<void> {
        if (this.aFazerFlush || !this.socket.ligado) {
            return;
        }

        this.aFazerFlush = true;

        try {
            for (const item of await this.storage.listarOutbox()) {
                try {
                    const ack = await this.socket.enviarMensagem({ ...item.dados, ref_cliente: item.ref_cliente });

                    if (ack.estado === 'ok') {
                        await this.storage.removerMensagemPorRef(item.conversa_id, item.ref_cliente);
                        await this.storage.upsertMensagens([{ ...ack.mensagem, estado_envio: 'enviada' }]);
                        await this.storage.removerOutbox(item.ref_cliente);
                        this.notificar();
                    } else {
                        // erro de negócio (flag desativada, sem acesso) — não vale a pena repetir
                        await this.storage.removerOutbox(item.ref_cliente);
                        await this.marcarFalhada(item.conversa_id, item.ref_cliente);
                    }
                } catch {
                    // sem ligação/timeout — mantém no outbox para a próxima tentativa
                    await this.storage.atualizarOutbox({ ...item, tentativas: item.tentativas + 1 });
                }
            }
        } finally {
            this.aFazerFlush = false;
        }
    }

    private async marcarFalhada(conversaId: string, refCliente: string): Promise<void> {
        const mensagens = await this.storage.listarMensagens(conversaId, { limite: 500 });
        const alvo = mensagens.find((m) => m.ref_cliente === refCliente);

        if (alvo) {
            await this.storage.upsertMensagens([{ ...alvo, estado_envio: 'falhou' }]);
        }

        this.notificar();
    }

    // ---- leituras ----

    async marcarLidas(conversaId: string): Promise<void> {
        const mensagens = await this.storage.listarMensagens(conversaId, { limite: 1 });
        const ultima = mensagens.at(-1);

        if (!ultima || ultima.estado_envio === 'a_enviar') {
            return;
        }

        await this.socket.marcarLidas(conversaId, ultima.id).catch(() => undefined);

        const conversa = await this.storage.obterConversa(conversaId);

        if (conversa?.participante) {
            await this.storage.upsertConversas([
                { ...conversa, participante: { ...conversa.participante, mensagens_nao_lidas: 0 } },
            ]);
            this.notificar();
        }
    }

    // ---- eventos do servidor ----

    private registarEventos(): void {
        this.socket.on(EVENTOS_SERVIDOR.MENSAGEM_NOVA, (payload: { mensagem: Mensagem }) => {
            void (async () => {
                await this.storage.upsertMensagens([{ ...payload.mensagem, estado_envio: 'enviada' }]);

                const conversa = await this.storage.obterConversa(payload.mensagem.conversa_id);

                if (!conversa) {
                    // conversa nova criada por outra pessoa — vai buscar ao REST
                    await this.atualizarConversas();
                } else {
                    await this.storage.upsertConversas([
                        { ...conversa, ultima_atividade_em: payload.mensagem.criada_em },
                    ]);
                }

                await this.socket.marcarEntregues(payload.mensagem.conversa_id, payload.mensagem.id).catch(() => undefined);
                this.notificar();
            })();
        });

        this.socket.on(
            EVENTOS_SERVIDOR.MENSAGEM_ATUALIZADA,
            (payload: { mensagem: Mensagem }) =>
                void this.storage
                    .upsertMensagens([{ ...payload.mensagem, estado_envio: 'enviada' }])
                    .then(() => this.notificar()),
        );

        this.socket.on(
            EVENTOS_SERVIDOR.MENSAGEM_ELIMINADA,
            (payload: { mensagem_id: string; conversa_id: string }) => {
                void (async () => {
                    const mensagens = await this.storage.listarMensagens(payload.conversa_id, { limite: 500 });
                    const alvo = mensagens.find((m) => m.id === payload.mensagem_id);

                    if (alvo) {
                        await this.storage.upsertMensagens([{ ...alvo, eliminada: true, conteudo: null }]);
                        this.notificar();
                    }
                })();
            },
        );

        this.socket.on(EVENTOS_SERVIDOR.RECIBO, (recibo: Recibo) => {
            void this.storage.aplicarRecibo(recibo).then(() => this.notificar());
        });

        this.socket.on(
            EVENTOS_SERVIDOR.REACAO,
            (payload: { mensagem_id: string; conversa_id: string; identidade_id: string; emoji: string | null }) => {
                void (async () => {
                    const mensagens = await this.storage.listarMensagens(payload.conversa_id, { limite: 500 });
                    const alvo = mensagens.find((m) => m.id === payload.mensagem_id);

                    if (!alvo) {
                        return;
                    }

                    const reacoes = alvo.reacoes.filter((r) => r.identidade_id !== payload.identidade_id);

                    if (payload.emoji) {
                        reacoes.push({ identidade_id: payload.identidade_id, emoji: payload.emoji });
                    }

                    await this.storage.upsertMensagens([{ ...alvo, reacoes }]);
                    this.notificar();
                })();
            },
        );

        this.socket.on(EVENTOS_SERVIDOR.CONVERSA_ATUALIZADA, (payload: { conversa: Conversa }) => {
            void this.storage.upsertConversas([payload.conversa]).then(() => this.notificar());
        });

        this.socket.on(EVENTOS_SERVIDOR.PARTICIPANTE_ADICIONADO, () => void this.atualizarConversas());
        this.socket.on(EVENTOS_SERVIDOR.PARTICIPANTE_REMOVIDO, () => void this.atualizarConversas());

        this.socket.on(EVENTOS_SERVIDOR.TYPING, (typing: Typing) => this.opcoes.aoTyping?.(typing));
        this.socket.on(EVENTOS_SERVIDOR.PRESENCA, (presenca: Presenca) => this.opcoes.aoPresenca?.(presenca));
    }
}
