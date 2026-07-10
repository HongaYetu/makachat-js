import { MakaApi } from './api';
import { EVENTOS_SERVIDOR } from './eventos';
import { MakaSocket } from './socket';
import { StorageAdapter } from './storage';
import {
    Anexo,
    Conversa,
    DadosEnvioMensagem,
    EventoChamada,
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
    /** mensagem RECEBIDA e nova (deduplicada) — usado para notificações */
    aoMensagem?: (mensagem: Mensagem) => void;
    aoPresenca?: (presenca: Presenca) => void;
    aoChamada?: (evento: EventoChamada) => void;
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
    /** salas de conversa a (re)entrar em cada ligação — typing/presença chegam por aqui */
    private salas = new Set<string>();

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
        for (const conversaId of this.salas) {
            await this.socket.entrarConversa(conversaId).catch(() => undefined);
        }

        await this.atualizarConversas();
        await this.sincronizarDelta();
        await this.flushOutbox();
    }

    /** Entra na sala da conversa (typing/presença), garante rejoin e a conversa no storage. */
    async entrarConversa(conversaId: string): Promise<void> {
        this.salas.add(conversaId);
        await this.socket.entrarConversa(conversaId).catch(() => undefined);

        // Refresca SEMPRE o estado da conversa (aberta/fechada, participantes,
        // contexto) do servidor. Sem isto, uma conversa reaberta/fechada no hub
        // continuaria a aparecer com o estado antigo a partir da cache local —
        // ex.: reaberta por uma encomenda ativa mas ainda "fechada" no ecrã.
        await this.api
            .obterConversa(conversaId)
            .then(async ({ conversa }) => {
                await this.storage.upsertConversas([conversa]);
                this.notificar();
            })
            .catch(() => undefined);

        // Carrega a última página do histórico via REST (idempotente, deduplicado
        // por id). Sem isto, uma conversa com o DB local vazio — ex.: primeira
        // abertura ou após reset da cache — abre sem mensagens (o delta sync só
        // recupera a partir de um cursor, que não existe quando não há locais).
        await this.carregarMensagens(conversaId).catch(() => 0);
    }

    async atualizarConversas(): Promise<void> {
        const { conversas } = await this.api.listarConversas({ limite: 100 });
        const arquivadas = await this.api.listarConversas({ arquivadas: true, limite: 100 });

        await this.storage.upsertConversas([...conversas, ...arquivadas.conversas]);
        this.notificar();
    }

    /**
     * Delta pós-reconexão: recupera mensagens novas E alteradas (reações,
     * edições, eliminações — via água alta `sync_em`) e faz as novas correr
     * o fluxo normal (aoMensagem → notificações/badges, marcar entregues),
     * como se tivessem chegado ao vivo.
     */
    async sincronizarDelta(): Promise<void> {
        const cursores = await this.storage.cursores();

        if (!cursores.length) {
            return;
        }

        const alteradasDesde = await this.storage.obterMeta('sync_em');
        const ack = await this.socket.sincronizarDesde(cursores, alteradasDesde ?? undefined).catch(() => null);

        if (ack?.estado !== 'ok') {
            return;
        }

        const cursorPorConversa = new Map(cursores.map((c) => [c.conversa_id, c.ultimo_id]));
        const recuperadas: Mensagem[] = [];

        for (const lote of ack.lotes) {
            await this.storage.upsertMensagens(lote.mensagens.map((m) => ({ ...m, estado_envio: 'enviada' as const })));

            const cursor = cursorPorConversa.get(lote.conversa_id) ?? null;
            const novas = lote.mensagens.filter((m) => !cursor || m.id > cursor);

            if (!novas.length) {
                continue;
            }

            await this.socket.marcarEntregues(lote.conversa_id, novas.at(-1)!.id).catch(() => undefined);

            const conversa = await this.storage.obterConversa(lote.conversa_id);

            for (const mensagem of novas) {
                const remetente = conversa?.participantes.find((p) => p.identidade_id === mensagem.remetente_identidade_id);
                const minha =
                    remetente?.id_externo === this.opcoes.identidade.id && remetente?.tipo === this.opcoes.identidade.tipo;

                if (!minha) {
                    recuperadas.push(mensagem);
                }
            }
        }

        // previews/não-lidas NÃO se mexem aqui: vieram frescos do atualizarConversas
        // que corre antes no aoLigar — incrementar localmente duplicaria a contagem
        if (ack.agora) {
            await this.storage.gravarMeta('sync_em', ack.agora);
        }

        if (ack.lotes.length) {
            this.notificar();
        }

        // fluxo normal para as novas recuperadas (notificações, useMensagemRecebida...)
        for (const mensagem of recuperadas) {
            this.opcoes.aoMensagem?.(mensagem);
        }
    }

    /** Reflete o estado da chamada da conversa no storage — banner "a decorrer" na UI. */
    private async atualizarChamadaAtiva(evento: EventoChamada): Promise<void> {
        const conversa = await this.storage.obterConversa(evento.chamada.conversa_id);

        if (!conversa) return;

        const ativa =
            evento.evento === 'iniciada' || evento.evento === 'atendida' || evento.evento === 'participante_saiu'
                ? {
                      id: evento.chamada.id,
                      tipo: evento.chamada.tipo,
                      estado: evento.chamada.estado,
                      iniciada_em: evento.chamada.iniciada_em,
                      atendida_em: evento.chamada.atendida_em,
                  }
                : null;

        await this.storage.upsertConversas([{ ...conversa, chamada_ativa: ativa }]);
        this.notificar();
    }

    /** Mantém a lista viva: preview, ordem (topo) e contador sem esperar pelo REST. */
    private async atualizarPreviewLocal(mensagem: Mensagem, recebida: boolean): Promise<void> {
        const conversa = await this.storage.obterConversa(mensagem.conversa_id);

        if (!conversa) return;

        await this.storage.upsertConversas([
            {
                ...conversa,
                ultima_atividade_em: mensagem.criada_em,
                ultima_mensagem: {
                    id: mensagem.id,
                    tipo: mensagem.tipo,
                    conteudo: mensagem.eliminada ? null : mensagem.conteudo,
                    eliminada: mensagem.eliminada,
                    remetente_identidade_id: mensagem.remetente_identidade_id,
                    criada_em: mensagem.criada_em,
                },
                participante: conversa.participante
                    ? {
                          ...conversa.participante,
                          mensagens_nao_lidas: recebida
                              ? conversa.participante.mensagens_nao_lidas + 1
                              : conversa.participante.mensagens_nao_lidas,
                      }
                    : conversa.participante,
            },
        ]);
    }

    /** Mensagens vindas do push nativo (inbox offline) — upsert idempotente por id + refresh da UI. */
    async ingerirMensagensPush(mensagens: Mensagem[]): Promise<void> {
        if (!mensagens.length) {
            return;
        }

        await this.storage.upsertMensagens(mensagens.map((m) => ({ ...m, estado_envio: 'enviada' as const })));
        this.notificar();
    }

    /** Carrega histórico da conversa via REST para o storage (chamado ao abrir). */
    async carregarMensagens(conversaId: string, antesDe?: string): Promise<number> {
        const { mensagens } = await this.api.listarMensagens(conversaId, { antes_de: antesDe, limite: 50 });

        if (mensagens.length) {
            await this.storage.upsertMensagens(mensagens.map((m) => ({ ...m, estado_envio: 'enviada' as const })));
            this.notificar();
        }

        return mensagens.length;
    }

    // ---- envio offline-first ----

    async enviarMensagem(dados: DadosEnvioMensagem, anexosPreview: Anexo[] = []): Promise<Mensagem> {
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
            anexos: anexosPreview,
            criada_em: agora,
            estado_envio: 'a_enviar',
        };

        await this.storage.upsertMensagens([otimista]);
        await this.atualizarPreviewLocal(otimista, false);
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

    // ---- ações com aplicação local (o gateway exclui o remetente do broadcast) ----

    /** identidade_id desta identidade na conversa (público — a UI usa p/ atribuição de chamadas). */
    async minhaIdentidadeId(conversaId: string): Promise<string | null> {
        const conversa = await this.storage.obterConversa(conversaId);
        const eu = conversa?.participantes.find(
            (p) => p.id_externo === this.opcoes.identidade.id && p.tipo === this.opcoes.identidade.tipo,
        );

        return eu?.identidade_id ?? null;
    }

    async alternarReacao(conversaId: string, mensagemId: string, emoji: string): Promise<void> {
        const ack = await this.socket.alternarReacao(mensagemId, emoji);

        if (ack.estado !== 'ok') throw new Error(ack.texto ?? 'Erro ao reagir');

        const minhaId = await this.minhaIdentidadeId(conversaId);
        const lista = await this.storage.listarMensagens(conversaId, { limite: 500 });
        const alvo = lista.find((m) => m.id === mensagemId);

        if (alvo && minhaId) {
            const reacoes = alvo.reacoes.filter((r) => r.identidade_id !== minhaId);

            if (ack.emoji) reacoes.push({ identidade_id: minhaId, emoji: ack.emoji });

            await this.storage.upsertMensagens([{ ...alvo, reacoes }]);
            this.notificar();
        }
    }

    async editarMensagem(mensagemId: string, conteudo: string): Promise<void> {
        const ack = await this.socket.editarMensagem(mensagemId, conteudo);

        if (ack.estado !== 'ok') throw new Error(ack.texto ?? 'Erro ao editar');

        await this.storage.upsertMensagens([{ ...ack.mensagem, estado_envio: 'enviada' }]);
        this.notificar();
    }

    async eliminarMensagem(conversaId: string, mensagemId: string, paraTodos: boolean): Promise<void> {
        const ack = await this.socket.eliminarMensagem(mensagemId, paraTodos);

        if (ack.estado !== 'ok') throw new Error(ack.texto ?? 'Erro ao eliminar');

        if (paraTodos) {
            await this.storage.upsertMensagens([{ ...ack.mensagem, eliminada: true, conteudo: null, estado_envio: 'enviada' }]);
        } else {
            await this.storage.removerMensagem(conversaId, mensagemId);
        }

        this.notificar();
    }

    async eliminarConversa(conversaId: string): Promise<void> {
        await this.api.eliminarConversa(conversaId);
        await this.storage.removerConversa(conversaId);
        this.notificar();
    }

    /** Silencia (ISO ou '9999-12-31T00:00:00Z' para sempre) ou reativa (null) as notificações da conversa. */
    async silenciarConversa(conversaId: string, ate: string | null): Promise<void> {
        await this.api.atualizarPreferencias(conversaId, { silenciada_ate: ate });
        const conversa = await this.storage.obterConversa(conversaId);

        if (conversa?.participante) {
            await this.storage.upsertConversas([
                { ...conversa, participante: { ...conversa.participante, silenciada_ate: ate } },
            ]);
            this.notificar();
        }
    }

    async marcarNaoLida(conversaId: string): Promise<void> {
        const r = await this.api.marcarNaoLida(conversaId);
        const conversa = await this.storage.obterConversa(conversaId);

        if (conversa?.participante) {
            await this.storage.upsertConversas([
                { ...conversa, participante: { ...conversa.participante, mensagens_nao_lidas: r.mensagens_nao_lidas } },
            ]);
            this.notificar();
        }
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
                // a mensagem chegou — mata já o "a escrever" do remetente (reaparece se voltar a escrever)
                this.opcoes.aoTyping?.({
                    conversa_id: payload.mensagem.conversa_id,
                    identidade_id: payload.mensagem.remetente_identidade_id,
                    ativo: false,
                });

                // dedupe: se o evento chegar em duplicado, não conta duas vezes
                const existentes = await this.storage.listarMensagens(payload.mensagem.conversa_id, { limite: 500 });
                const duplicada = existentes.some((m) => m.id === payload.mensagem.id);

                await this.storage.upsertMensagens([{ ...payload.mensagem, estado_envio: 'enviada' }]);

                const conversa = await this.storage.obterConversa(payload.mensagem.conversa_id);
                const remetente = conversa?.participantes.find(
                    (p) => p.identidade_id === payload.mensagem.remetente_identidade_id,
                );
                const minha =
                    remetente?.id_externo === this.opcoes.identidade.id &&
                    remetente?.tipo === this.opcoes.identidade.tipo;

                if (!conversa) {
                    // conversa nova criada por outra pessoa — vai buscar ao REST
                    await this.atualizarConversas();
                } else if (!duplicada) {
                    // mensagem minha vinda de outra aba não conta como não lida
                    await this.atualizarPreviewLocal(payload.mensagem, !minha);
                }

                await this.socket.marcarEntregues(payload.mensagem.conversa_id, payload.mensagem.id).catch(() => undefined);
                this.notificar();

                if (!duplicada && !minha) {
                    this.opcoes.aoMensagem?.(payload.mensagem);
                }
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
            void (async () => {
                // sem a conversa local o recibo perder-se-ia — vai buscá-la primeiro
                if (!(await this.storage.obterConversa(recibo.conversa_id))) {
                    await this.api
                        .obterConversa(recibo.conversa_id)
                        .then(({ conversa }) => this.storage.upsertConversas([conversa]))
                        .catch(() => undefined);
                }

                await this.storage.aplicarRecibo(recibo);

                // li noutro dispositivo → o servidor já zerou; zera também o badge local
                if (recibo.lido_ate) {
                    const conversa = await this.storage.obterConversa(recibo.conversa_id);
                    const eu = conversa?.participantes.find(
                        (p) => p.id_externo === this.opcoes.identidade.id && p.tipo === this.opcoes.identidade.tipo,
                    );

                    if (conversa?.participante && eu && recibo.identidade_id === eu.identidade_id && conversa.participante.mensagens_nao_lidas > 0) {
                        await this.storage.upsertConversas([
                            { ...conversa, participante: { ...conversa.participante, mensagens_nao_lidas: 0 } },
                        ]);
                    }
                }

                this.notificar();
            })();
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

        for (const [nome, evento] of [
            [EVENTOS_SERVIDOR.CHAMADA_INICIADA, 'iniciada'],
            [EVENTOS_SERVIDOR.CHAMADA_ATENDIDA, 'atendida'],
            [EVENTOS_SERVIDOR.CHAMADA_REJEITADA, 'rejeitada'],
            [EVENTOS_SERVIDOR.CHAMADA_TERMINADA, 'terminada'],
            [EVENTOS_SERVIDOR.CHAMADA_PARTICIPANTE_SAIU, 'participante_saiu'],
        ] as const) {
            this.socket.on(nome, (payload: Omit<EventoChamada, 'evento'>) => {
                void this.atualizarChamadaAtiva({ ...payload, evento });
                this.opcoes.aoChamada?.({ ...payload, evento });
            });
        }

        this.socket.on(EVENTOS_SERVIDOR.TYPING, (typing: Typing) => this.opcoes.aoTyping?.(typing));
        this.socket.on(EVENTOS_SERVIDOR.PRESENCA, (presenca: Presenca) => this.opcoes.aoPresenca?.(presenca));
    }
}
