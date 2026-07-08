import {
    Conversa,
    CursorConversa,
    ItemOutbox,
    Mensagem,
    Recibo,
    StorageAdapter,
} from '@hongayetu/makachat-core';

/**
 * Superfície mínima do expo-sqlite (API moderna, síncrona-async) — declarada
 * estruturalmente para não obrigar o monorepo a instalar o expo. Em runtime
 * a app fornece `require('expo-sqlite').openDatabaseSync(nome)`.
 */
export interface SQLiteDatabaseLike {
    execAsync(sql: string): Promise<void>;
    runAsync(sql: string, params?: unknown[]): Promise<unknown>;
    getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

interface LinhaConversa {
    id: string;
    dados: string;
    arquivada: number;
    ultima_atividade_em: string;
}

interface LinhaMensagem {
    id: string;
    dados: string;
}

interface LinhaOutbox {
    ref_cliente: string;
    dados: string;
}

/**
 * StorageAdapter sobre expo-sqlite: o SQLite é a fonte de verdade da UI
 * (padrão kanda-messaging). Os objetos são guardados como JSON com colunas
 * indexáveis extraídas — pesquisa full-text pode evoluir para FTS5 sem mudar
 * o contrato.
 */
export class SqliteStorage implements StorageAdapter {
    constructor(private readonly db: SQLiteDatabaseLike) {}

    async init(): Promise<void> {
        await this.db.execAsync(`
            CREATE TABLE IF NOT EXISTS conversas (
                id TEXT PRIMARY KEY,
                dados TEXT NOT NULL,
                arquivada INTEGER NOT NULL DEFAULT 0,
                ultima_atividade_em TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_conversas_atividade ON conversas (arquivada, ultima_atividade_em DESC);

            CREATE TABLE IF NOT EXISTS mensagens (
                id TEXT PRIMARY KEY,
                conversa_id TEXT NOT NULL,
                remetente_identidade_id TEXT NOT NULL,
                ref_cliente TEXT NOT NULL,
                dados TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_mensagens_conversa ON mensagens (conversa_id, id);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_mensagens_ref ON mensagens (conversa_id, remetente_identidade_id, ref_cliente);

            CREATE TABLE IF NOT EXISTS outbox (
                ref_cliente TEXT PRIMARY KEY,
                criado_em TEXT NOT NULL,
                dados TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS meta (
                chave TEXT PRIMARY KEY,
                valor TEXT NOT NULL
            );
        `);
    }

    async upsertConversas(conversas: Conversa[]): Promise<void> {
        for (const conversa of conversas) {
            const existente = await this.obterConversa(conversa.id);
            const fundida = existente ? { ...existente, ...conversa } : conversa;

            await this.db.runAsync(
                `INSERT OR REPLACE INTO conversas (id, dados, arquivada, ultima_atividade_em) VALUES (?, ?, ?, ?)`,
                [
                    fundida.id,
                    JSON.stringify(fundida),
                    fundida.participante?.arquivada ? 1 : 0,
                    fundida.ultima_atividade_em,
                ],
            );
        }
    }

    async listarConversas(arquivadas = false): Promise<Conversa[]> {
        const linhas = await this.db.getAllAsync<LinhaConversa>(
            `SELECT * FROM conversas WHERE arquivada = ? ORDER BY ultima_atividade_em DESC`,
            [arquivadas ? 1 : 0],
        );

        return linhas.map((l) => JSON.parse(l.dados) as Conversa);
    }

    async obterConversa(conversaId: string): Promise<Conversa | null> {
        const linhas = await this.db.getAllAsync<LinhaConversa>(`SELECT * FROM conversas WHERE id = ? LIMIT 1`, [
            conversaId,
        ]);

        return linhas.length ? (JSON.parse(linhas[0].dados) as Conversa) : null;
    }

    async removerConversa(conversaId: string): Promise<void> {
        await this.db.runAsync(`DELETE FROM conversas WHERE id = ?`, [conversaId]);
        await this.db.runAsync(`DELETE FROM mensagens WHERE conversa_id = ?`, [conversaId]);
    }

    async upsertMensagens(mensagens: Mensagem[]): Promise<void> {
        for (const mensagem of mensagens) {
            // a versão do servidor substitui a otimista com o mesmo ref_cliente
            await this.db.runAsync(
                `DELETE FROM mensagens WHERE conversa_id = ? AND remetente_identidade_id = ? AND ref_cliente = ? AND id != ?`,
                [mensagem.conversa_id, mensagem.remetente_identidade_id, mensagem.ref_cliente, mensagem.id],
            );
            await this.db.runAsync(
                `INSERT OR REPLACE INTO mensagens (id, conversa_id, remetente_identidade_id, ref_cliente, dados) VALUES (?, ?, ?, ?, ?)`,
                [
                    mensagem.id,
                    mensagem.conversa_id,
                    mensagem.remetente_identidade_id,
                    mensagem.ref_cliente,
                    JSON.stringify(mensagem),
                ],
            );
        }
    }

    async removerMensagem(conversaId: string, mensagemId: string): Promise<void> {
        await this.db.runAsync(`DELETE FROM mensagens WHERE conversa_id = ? AND id = ?`, [conversaId, mensagemId]);
    }

    async removerMensagemPorRef(conversaId: string, refCliente: string): Promise<void> {
        await this.db.runAsync(`DELETE FROM mensagens WHERE conversa_id = ? AND ref_cliente = ?`, [
            conversaId,
            refCliente,
        ]);
    }

    async listarMensagens(conversaId: string, opcoes?: { antes_de?: string; limite?: number }): Promise<Mensagem[]> {
        const limite = opcoes?.limite ?? 50;
        const linhas = opcoes?.antes_de
            ? await this.db.getAllAsync<LinhaMensagem>(
                  `SELECT id, dados FROM mensagens WHERE conversa_id = ? AND id < ? ORDER BY id DESC LIMIT ?`,
                  [conversaId, opcoes.antes_de, limite],
              )
            : await this.db.getAllAsync<LinhaMensagem>(
                  `SELECT id, dados FROM mensagens WHERE conversa_id = ? ORDER BY id DESC LIMIT ?`,
                  [conversaId, limite],
              );

        return linhas.reverse().map((l) => JSON.parse(l.dados) as Mensagem);
    }

    async cursores(): Promise<CursorConversa[]> {
        const linhas = await this.db.getAllAsync<{ conversa_id: string; ultimo_id: string | null }>(
            `SELECT conversa_id, MAX(CASE WHEN json_extract(dados, '$.estado_envio') IS NULL OR json_extract(dados, '$.estado_envio') = 'enviada' THEN id END) AS ultimo_id
             FROM mensagens GROUP BY conversa_id`,
        );

        return linhas;
    }

    async adicionarOutbox(item: ItemOutbox): Promise<void> {
        await this.db.runAsync(`INSERT OR REPLACE INTO outbox (ref_cliente, criado_em, dados) VALUES (?, ?, ?)`, [
            item.ref_cliente,
            item.criado_em,
            JSON.stringify(item),
        ]);
    }

    async listarOutbox(): Promise<ItemOutbox[]> {
        const linhas = await this.db.getAllAsync<LinhaOutbox>(`SELECT * FROM outbox ORDER BY criado_em ASC`);

        return linhas.map((l) => JSON.parse(l.dados) as ItemOutbox);
    }

    async atualizarOutbox(item: ItemOutbox): Promise<void> {
        await this.adicionarOutbox(item);
    }

    async removerOutbox(refCliente: string): Promise<void> {
        await this.db.runAsync(`DELETE FROM outbox WHERE ref_cliente = ?`, [refCliente]);
    }

    async aplicarRecibo(recibo: Recibo): Promise<void> {
        const conversa = await this.obterConversa(recibo.conversa_id);

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

        await this.upsertConversas([conversa]);
    }

    async obterMeta(chave: string): Promise<string | null> {
        const linhas = await this.db.getAllAsync<{ valor: string }>(`SELECT valor FROM meta WHERE chave = ? LIMIT 1`, [chave]);

        return linhas[0]?.valor ?? null;
    }

    async gravarMeta(chave: string, valor: string): Promise<void> {
        await this.db.runAsync(`INSERT OR REPLACE INTO meta (chave, valor) VALUES (?, ?)`, [chave, valor]);
    }

    async limpar(): Promise<void> {
        await this.db.execAsync(`DELETE FROM conversas; DELETE FROM mensagens; DELETE FROM outbox; DELETE FROM meta;`);
    }
}

function maiorId(atual: string | null, novo: string | null): string | null {
    if (!novo) return atual;
    if (!atual) return novo;

    return novo > atual ? novo : atual;
}
