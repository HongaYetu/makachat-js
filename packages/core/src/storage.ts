import { Conversa, CursorConversa, ItemOutbox, Mensagem, Recibo } from './tipos';

/**
 * Contrato de armazenamento local (source of truth offline-first).
 * Implementações: expo-sqlite (react-native), Dexie/IndexedDB (react web),
 * memória (testes). Trocar de motor não toca no SyncEngine nem na UI.
 */
export interface StorageAdapter {
    init(): Promise<void>;

    upsertConversas(conversas: Conversa[]): Promise<void>;
    listarConversas(arquivadas?: boolean): Promise<Conversa[]>;
    obterConversa(conversaId: string): Promise<Conversa | null>;
    removerConversa(conversaId: string): Promise<void>;

    upsertMensagens(mensagens: Mensagem[]): Promise<void>;
    removerMensagemPorRef(conversaId: string, refCliente: string): Promise<void>;
    removerMensagem(conversaId: string, mensagemId: string): Promise<void>;
    listarMensagens(conversaId: string, opcoes?: { antes_de?: string; limite?: number }): Promise<Mensagem[]>;
    cursores(): Promise<CursorConversa[]>;

    adicionarOutbox(item: ItemOutbox): Promise<void>;
    listarOutbox(): Promise<ItemOutbox[]>;
    atualizarOutbox(item: ItemOutbox): Promise<void>;
    removerOutbox(refCliente: string): Promise<void>;

    aplicarRecibo(recibo: Recibo): Promise<void>;

    /** metadados do sync (ex.: `sync_em` — água alta do delta de alteradas) */
    obterMeta(chave: string): Promise<string | null>;
    gravarMeta(chave: string, valor: string): Promise<void>;

    limpar(): Promise<void>;
}

/** Implementação em memória — testes e fallback. */
export class MemoryStorage implements StorageAdapter {
    private conversas = new Map<string, Conversa>();
    private mensagens = new Map<string, Mensagem[]>();
    private outbox = new Map<string, ItemOutbox>();
    private meta = new Map<string, string>();

    async init(): Promise<void> {}

    async upsertConversas(conversas: Conversa[]): Promise<void> {
        for (const conversa of conversas) {
            const existente = this.conversas.get(conversa.id);
            this.conversas.set(conversa.id, { ...existente, ...conversa });
        }
    }

    async listarConversas(arquivadas = false): Promise<Conversa[]> {
        return [...this.conversas.values()]
            .filter((c) => (c.participante?.arquivada ?? false) === arquivadas)
            .sort((a, b) => {
                const fixadaA = a.participante?.fixada ? 1 : 0;
                const fixadaB = b.participante?.fixada ? 1 : 0;

                if (fixadaA !== fixadaB) return fixadaB - fixadaA;

                return a.ultima_atividade_em < b.ultima_atividade_em ? 1 : -1;
            });
    }

    async obterConversa(conversaId: string): Promise<Conversa | null> {
        return this.conversas.get(conversaId) ?? null;
    }

    async removerConversa(conversaId: string): Promise<void> {
        this.conversas.delete(conversaId);
        this.mensagens.delete(conversaId);
    }

    async upsertMensagens(novas: Mensagem[]): Promise<void> {
        for (const mensagem of novas) {
            const lista = this.mensagens.get(mensagem.conversa_id) ?? [];
            const porRef = lista.findIndex(
                (m) =>
                    m.ref_cliente === mensagem.ref_cliente &&
                    m.remetente_identidade_id === mensagem.remetente_identidade_id,
            );
            const porId = lista.findIndex((m) => m.id === mensagem.id);
            const indice = porId >= 0 ? porId : porRef;

            if (indice >= 0) {
                lista[indice] = { ...lista[indice], ...mensagem };
            } else {
                lista.push(mensagem);
            }

            lista.sort((a, b) => (a.id < b.id ? -1 : 1));
            this.mensagens.set(mensagem.conversa_id, lista);
        }
    }

    async removerMensagemPorRef(conversaId: string, refCliente: string): Promise<void> {
        const lista = this.mensagens.get(conversaId) ?? [];
        this.mensagens.set(
            conversaId,
            lista.filter((m) => m.ref_cliente !== refCliente),
        );
    }

    async removerMensagem(conversaId: string, mensagemId: string): Promise<void> {
        const lista = this.mensagens.get(conversaId) ?? [];
        this.mensagens.set(
            conversaId,
            lista.filter((m) => m.id !== mensagemId),
        );
    }

    async listarMensagens(conversaId: string, opcoes?: { antes_de?: string; limite?: number }): Promise<Mensagem[]> {
        let lista = this.mensagens.get(conversaId) ?? [];

        if (opcoes?.antes_de) {
            lista = lista.filter((m) => m.id < (opcoes.antes_de as string));
        }

        const limite = opcoes?.limite ?? 50;

        return lista.slice(-limite);
    }

    async cursores(): Promise<{ conversa_id: string; ultimo_id: string | null }[]> {
        return [...this.mensagens.entries()].map(([conversa_id, lista]) => {
            const confirmadas = lista.filter((m) => !m.estado_envio || m.estado_envio === 'enviada');

            return { conversa_id, ultimo_id: confirmadas.at(-1)?.id ?? null };
        });
    }

    async adicionarOutbox(item: ItemOutbox): Promise<void> {
        this.outbox.set(item.ref_cliente, item);
    }

    async listarOutbox(): Promise<ItemOutbox[]> {
        return [...this.outbox.values()].sort((a, b) => (a.criado_em < b.criado_em ? -1 : 1));
    }

    async atualizarOutbox(item: ItemOutbox): Promise<void> {
        this.outbox.set(item.ref_cliente, item);
    }

    async removerOutbox(refCliente: string): Promise<void> {
        this.outbox.delete(refCliente);
    }

    async aplicarRecibo(recibo: Recibo): Promise<void> {
        const conversa = this.conversas.get(recibo.conversa_id);

        if (!conversa) {
            return;
        }

        conversa.participantes = conversa.participantes.map((p) =>
            p.identidade_id === recibo.identidade_id
                ? {
                      ...p,
                      ultima_entrega_mensagem_id: maiorId(p.ultima_entrega_mensagem_id, recibo.entregue_ate),
                      ultima_leitura_mensagem_id: maiorId(p.ultima_leitura_mensagem_id, recibo.lido_ate),
                  }
                : p,
        );
    }

    async obterMeta(chave: string): Promise<string | null> {
        return this.meta.get(chave) ?? null;
    }

    async gravarMeta(chave: string, valor: string): Promise<void> {
        this.meta.set(chave, valor);
    }

    async limpar(): Promise<void> {
        this.conversas.clear();
        this.mensagens.clear();
        this.outbox.clear();
        this.meta.clear();
    }
}

function maiorId(atual: string | null, novo: string | null): string | null {
    if (!novo) return atual;
    if (!atual) return novo;

    return novo > atual ? novo : atual;
}

/**
 * Aplica um recibo a uma conversa de forma PURA e monotónica (os watermarks
 * nunca recuam) — usado pelo SyncEngine dentro da fila de mutações para os
 * recibos nunca serem clobberados por escritas concorrentes.
 */
export function aplicarReciboAConversa(conversa: Conversa, recibo: Recibo): Conversa {
    return {
        ...conversa,
        participantes: conversa.participantes.map((p) =>
            p.identidade_id === recibo.identidade_id
                ? {
                      ...p,
                      ultima_entrega_mensagem_id: maiorId(p.ultima_entrega_mensagem_id, recibo.entregue_ate),
                      ultima_leitura_mensagem_id: maiorId(p.ultima_leitura_mensagem_id, recibo.lido_ate),
                  }
                : p,
        ),
    };
}
