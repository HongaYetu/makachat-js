import { describe, expect, it } from 'vitest';
import { MakaApi } from '../src/api';
import { MakaSocket } from '../src/socket';
import { MemoryStorage } from '../src/storage';
import { SyncEngine } from '../src/sync';
import { Ack, Conversa, Mensagem } from '../src/tipos';

const IDENTIDADE = { id: 'u1', tipo: 'cliente', nome: 'Ana' };

function conversaFake(id: string): Conversa {
    return {
        id,
        tipo: 'privada',
        titulo: 'Bruno',
        foto_url: null,
        contexto_tipo: null,
        contexto_id: null,
        ultima_atividade_em: '2026-07-07T10:00:00Z',
        criada_em: '2026-07-07T09:00:00Z',
        participantes: [
            {
                identidade_id: 'ident-a',
                id_externo: 'u1',
                tipo: 'cliente',
                nome: 'Ana',
                foto_url: null,
                papel: 'membro',
                ultima_leitura_mensagem_id: null,
                ultima_entrega_mensagem_id: null,
                saiu_em: null,
            },
            {
                identidade_id: 'ident-b',
                id_externo: 'u2',
                tipo: 'motorista',
                nome: 'Bruno',
                foto_url: null,
                papel: 'membro',
                ultima_leitura_mensagem_id: null,
                ultima_entrega_mensagem_id: null,
                saiu_em: null,
            },
        ],
        participante: {
            papel: 'membro',
            mensagens_nao_lidas: 0,
            arquivada: false,
            fixada: false,
            silenciada_ate: null,
            ultima_leitura_mensagem_id: null,
        },
    };
}

interface FakeSocket {
    ligado: boolean;
    enviados: { ref_cliente: string }[];
    handlers: Map<string, (payload: never) => void>;
    modo: 'ok' | 'erro' | 'rede';
    proximoId: number;
}

function criarFakes() {
    const estado: FakeSocket = { ligado: false, enviados: [], handlers: new Map(), modo: 'ok', proximoId: 1 };

    const socket = {
        get ligado() {
            return estado.ligado;
        },
        on(evento: string, handler: (payload: never) => void) {
            estado.handlers.set(evento, handler);
        },
        async enviarMensagem(dados: { ref_cliente: string; conversa_id: string; conteudo?: string; tipo?: string }) {
            if (estado.modo === 'rede') {
                throw new Error('sem ligação');
            }

            if (estado.modo === 'erro') {
                return { estado: 'erro', texto: 'funcionalidade desativada' } as Ack<{
                    mensagem: Mensagem;
                    duplicada: boolean;
                }>;
            }

            const duplicada = estado.enviados.some((e) => e.ref_cliente === dados.ref_cliente);

            if (!duplicada) {
                estado.enviados.push({ ref_cliente: dados.ref_cliente });
            }

            const mensagem: Mensagem = {
                id: `0${estado.proximoId++}-servidor`,
                conversa_id: dados.conversa_id,
                remetente_identidade_id: 'ident-a',
                tipo: (dados.tipo as Mensagem['tipo']) ?? 'texto',
                conteudo: dados.conteudo ?? null,
                resposta_a_id: null,
                encaminhada_de_id: null,
                ref_cliente: dados.ref_cliente,
                editada_em: null,
                eliminada: false,
                reacoes: [],
                anexos: [],
                criada_em: new Date().toISOString(),
            };

            return { estado: 'ok', mensagem, duplicada } as Ack<{ mensagem: Mensagem; duplicada: boolean }>;
        },
        async marcarEntregues() {
            return { estado: 'ok' } as Ack;
        },
        async marcarLidas() {
            return { estado: 'ok' } as Ack;
        },
        async sincronizarDesde() {
            return { estado: 'ok', lotes: [] } as unknown as Ack<{ lotes: [] }>;
        },
        async ligar() {
            estado.ligado = true;
        },
        desligar() {
            estado.ligado = false;
        },
    };

    const api = {
        async listarConversas() {
            return { conversas: [conversaFake('c1')], proximo_cursor: null };
        },
    };

    const storage = new MemoryStorage();
    const engine = new SyncEngine(
        storage,
        api as unknown as MakaApi,
        socket as unknown as MakaSocket,
        { identidade: IDENTIDADE },
    );

    return { estado, socket, storage, engine };
}

describe('SyncEngine', () => {
    it('guarda localmente com estado a_enviar quando offline e mantém no outbox', async () => {
        const { engine, storage, estado } = criarFakes();
        estado.ligado = false;

        let notificacoes = 0;
        engine.subscrever(() => notificacoes++);

        await engine.enviarMensagem({ conversa_id: 'c1', conteudo: 'olá' });

        const mensagens = await storage.listarMensagens('c1');
        expect(mensagens).toHaveLength(1);
        expect(mensagens[0].estado_envio).toBe('a_enviar');
        expect(await storage.listarOutbox()).toHaveLength(1);
        expect(notificacoes).toBeGreaterThan(0);
    });

    it('faz flush ao ligar e substitui a mensagem otimista pela do servidor', async () => {
        const { engine, storage, estado } = criarFakes();
        estado.ligado = false;

        await engine.enviarMensagem({ conversa_id: 'c1', conteudo: 'olá' });

        estado.ligado = true;
        await engine.flushOutbox();

        const mensagens = await storage.listarMensagens('c1');
        expect(mensagens).toHaveLength(1);
        expect(mensagens[0].id).toContain('-servidor');
        expect(mensagens[0].estado_envio).toBe('enviada');
        expect(await storage.listarOutbox()).toHaveLength(0);
    });

    it('não duplica quando o flush corre duas vezes (idempotência por ref_cliente)', async () => {
        const { engine, storage, estado } = criarFakes();
        estado.ligado = false;

        await engine.enviarMensagem({ conversa_id: 'c1', conteudo: '1' });
        await engine.enviarMensagem({ conversa_id: 'c1', conteudo: '2' });

        estado.ligado = true;
        await engine.flushOutbox();
        await engine.flushOutbox();

        expect(estado.enviados).toHaveLength(2);
        expect(await storage.listarMensagens('c1')).toHaveLength(2);
    });

    it('mantém no outbox em erro de rede e incrementa tentativas', async () => {
        const { engine, storage, estado } = criarFakes();
        estado.ligado = true;
        estado.modo = 'rede';

        await engine.enviarMensagem({ conversa_id: 'c1', conteudo: 'sem rede' });
        await new Promise((r) => setTimeout(r, 10));

        const outbox = await storage.listarOutbox();
        expect(outbox).toHaveLength(1);
        expect(outbox[0].tentativas).toBeGreaterThanOrEqual(1);

        const mensagens = await storage.listarMensagens('c1');
        expect(mensagens[0].estado_envio).toBe('a_enviar');
    });

    it('marca como falhada e remove do outbox em erro de negócio (não repete)', async () => {
        const { engine, storage, estado } = criarFakes();
        estado.ligado = true;
        estado.modo = 'erro';

        await engine.enviarMensagem({ conversa_id: 'c1', tipo: 'video', conteudo: 'v' });
        await new Promise((r) => setTimeout(r, 10));

        expect(await storage.listarOutbox()).toHaveLength(0);

        const mensagens = await storage.listarMensagens('c1');
        expect(mensagens[0].estado_envio).toBe('falhou');
    });

    it('aplica mensagem:nova recebida por socket e confirma entrega', async () => {
        const { engine, storage, estado } = criarFakes();
        estado.ligado = true;
        await storage.upsertConversas([conversaFake('c1')]);

        let notificado = false;
        engine.subscrever(() => (notificado = true));

        const handler = estado.handlers.get('mensagem:nova') as (payload: { mensagem: Mensagem }) => void;

        handler({
            mensagem: {
                id: '05-servidor',
                conversa_id: 'c1',
                remetente_identidade_id: 'ident-b',
                tipo: 'texto',
                conteudo: 'recebida',
                resposta_a_id: null,
                encaminhada_de_id: null,
                ref_cliente: 'ref-remoto',
                editada_em: null,
                eliminada: false,
                reacoes: [],
                anexos: [],
                criada_em: new Date().toISOString(),
            },
        });

        await new Promise((r) => setTimeout(r, 10));

        const mensagens = await storage.listarMensagens('c1');
        expect(mensagens.map((m) => m.conteudo)).toContain('recebida');
        expect(notificado).toBe(true);
    });

    it('aplica recibos por watermark (nunca regride)', async () => {
        const { storage } = criarFakes();
        await storage.upsertConversas([conversaFake('c1')]);

        await storage.aplicarRecibo({ conversa_id: 'c1', identidade_id: 'ident-b', entregue_ate: '05', lido_ate: '03' });
        await storage.aplicarRecibo({ conversa_id: 'c1', identidade_id: 'ident-b', entregue_ate: '02', lido_ate: '01' });

        const conversa = await storage.obterConversa('c1');
        const participante = conversa?.participantes.find((p) => p.identidade_id === 'ident-b');

        expect(participante?.ultima_entrega_mensagem_id).toBe('05');
        expect(participante?.ultima_leitura_mensagem_id).toBe('03');
    });

    it('cursores ignoram mensagens locais por confirmar', async () => {
        const { engine, storage, estado } = criarFakes();
        estado.ligado = false;

        await storage.upsertMensagens([
            {
                id: '01-servidor',
                conversa_id: 'c1',
                remetente_identidade_id: 'ident-b',
                tipo: 'texto',
                conteudo: 'antiga',
                resposta_a_id: null,
                encaminhada_de_id: null,
                ref_cliente: 'r1',
                editada_em: null,
                eliminada: false,
                reacoes: [],
                anexos: [],
                criada_em: new Date().toISOString(),
                estado_envio: 'enviada',
            },
        ]);
        await engine.enviarMensagem({ conversa_id: 'c1', conteudo: 'pendente' });

        const cursores = await storage.cursores();
        expect(cursores).toEqual([{ conversa_id: 'c1', ultimo_id: '01-servidor' }]);
    });
});
