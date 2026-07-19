import { HubApi, HubSocket } from '@hongayetu/honga-hub-core';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MakaApi } from '../src/api';
import { MakaSocket } from '../src/socket';
import { MemoryStorage } from '../src/storage';
import { SyncEngine } from '../src/sync';
import { Chamada, EventoChamada, Presenca, Typing } from '../src/tipos';

/**
 * Integração biblioteca ↔ servidor REAL: reproduz o "teste de duas janelas"
 * (dois SyncEngine como dois browsers). Requer o makachat-server local ligado
 * (pnpm start:dev na BD makachat_dev) — falha com mensagem clara se não estiver.
 */
const SERVIDOR = process.env.MAKACHAT_URL ?? 'http://127.0.0.1:3900';
const SEGREDO = 'segredo_demo_a_nao_usar_em_producao';

interface Cliente {
    engine: SyncEngine;
    api: MakaApi;
    socket: MakaSocket;
    sub: string;
    typing: Typing[];
    presenca: Presenca[];
    chamadas: EventoChamada[];
}

function criarCliente(sub: string, nome: string): Cliente {
    const token = jwt.sign({ iss: 'svc_demo_a', sub, tipo: 'cliente', nome }, SEGREDO, {
        algorithm: 'HS256',
        expiresIn: '10m',
        jwtid: randomUUID(),
    });
    const hubApi = new HubApi(async () => ({ token, socket_url: SERVIDOR, api_url: SERVIDOR }));
    const api = new MakaApi(hubApi);
    const typing: Typing[] = [];
    const presenca: Presenca[] = [];
    const chamadas: EventoChamada[] = [];

    let engine: SyncEngine;
    const hubSocket = new HubSocket({ obterToken: () => hubApi.sessao(), aoLigar: () => void engine.aoLigar(), namespace: 'chat' });
    const socket = new MakaSocket(hubSocket);

    engine = new SyncEngine(new MemoryStorage(), api, socket, {
        identidade: { id: sub, tipo: 'cliente', nome },
        aoTyping: (t) => typing.push(t),
        aoPresenca: (p) => presenca.push(p),
        aoChamada: (c) => chamadas.push(c),
    });

    return { engine, api, socket, sub, typing, presenca, chamadas };
}

async function esperar<T>(fn: () => Promise<T | null | undefined | false>, timeoutMs = 4000): Promise<T> {
    const inicio = Date.now();

    for (;;) {
        const valor = await fn();

        if (valor) return valor as T;
        if (Date.now() - inicio > timeoutMs) throw new Error('timeout à espera da condição');

        await new Promise((r) => setTimeout(r, 120));
    }
}

describe('Integração biblioteca ↔ servidor (requer makachat-server local ligado)', () => {
    const sufixo = `it${Date.now()}`;
    let ana: Cliente;
    let bruno: Cliente;
    let conversaId: string;

    beforeAll(async () => {
        const saude = await fetch(`${SERVIDOR}/v1/saude`).then((r) => r.json()).catch(() => null);

        if (saude?.estado !== 'ok') {
            throw new Error(`makachat-server não está acessível em ${SERVIDOR} — arranca-o (pnpm start:dev) antes desta suite.`);
        }

        ana = criarCliente(`ana_${sufixo}`, 'Ana');
        bruno = criarCliente(`bruno_${sufixo}`, 'Bruno');
        await ana.engine.iniciar();
        await new Promise((r) => setTimeout(r, 400));

        const { conversa } = await ana.api.criarPrivada({ id_externo: `bruno_${sufixo}`, tipo: 'cliente', nome: 'Bruno' });
        conversaId = conversa.id;

        // Bruno pede a sala ANTES de ligar (o caso que já falhou em produção)
        void bruno.engine.entrarConversa(conversaId);
        await ana.engine.entrarConversa(conversaId);
        await bruno.engine.iniciar();
        await new Promise((r) => setTimeout(r, 500));
    }, 20_000);

    afterAll(() => {
        ana?.socket.desligar();
        bruno?.socket.desligar();
    });

    it('mensagem chega ao vivo ao storage do outro lado', async () => {
        await ana.engine.enviarMensagem({ conversa_id: conversaId, conteudo: 'olá ao vivo' });

        const recebida = await esperar(async () => {
            const lista = await bruno.engine.storage.listarMensagens(conversaId, { limite: 20 });

            return lista.find((m) => m.conteudo === 'olá ao vivo');
        });

        expect(recebida.estado_envio).toBe('enviada');
    });

    it('presença: Ana soube que o Bruno ficou online', () => {
        expect(ana.presenca.some((p) => p.online)).toBe(true);
    });

    it('typing chega ao outro lado', async () => {
        bruno.typing.length = 0;
        ana.socket.typing(conversaId, true);

        await esperar(async () => bruno.typing.find((t) => t.conversa_id === conversaId && t.ativo));
    });

    it('recibo de leitura propaga por watermark para o remetente', async () => {
        const minhas = await ana.engine.storage.listarMensagens(conversaId, { limite: 20 });
        const ultima = minhas.at(-1)!;

        await bruno.engine.marcarLidas(conversaId);

        await esperar(async () => {
            const conversa = await ana.engine.storage.obterConversa(conversaId);
            const participanteBruno = conversa?.participantes.find((p) => p.id_externo === bruno.sub);

            return participanteBruno?.ultima_leitura_mensagem_id && participanteBruno.ultima_leitura_mensagem_id >= ultima.id;
        });
    });

    it('reação de um lado aparece ao vivo no outro', async () => {
        const lista = await bruno.engine.storage.listarMensagens(conversaId, { limite: 20 });
        const alvo = lista.at(-1)!;

        await bruno.engine.alternarReacao(conversaId, alvo.id, '👍');

        await esperar(async () => {
            const deAna = await ana.engine.storage.listarMensagens(conversaId, { limite: 20 });

            return deAna.find((m) => m.id === alvo.id && m.reacoes.some((r) => r.emoji === '👍'));
        });
    });

    it('edição propaga ao vivo', async () => {
        const enviada = await ana.engine.enviarMensagem({ conversa_id: conversaId, conteudo: 'antes' });
        const confirmada = await esperar(async () => {
            const lista = await ana.engine.storage.listarMensagens(conversaId, { limite: 20 });

            return lista.find((m) => m.ref_cliente === enviada.ref_cliente && m.estado_envio === 'enviada');
        });

        await ana.engine.editarMensagem(confirmada.id, 'depois');

        await esperar(async () => {
            const deBruno = await bruno.engine.storage.listarMensagens(conversaId, { limite: 20 });

            return deBruno.find((m) => m.id === confirmada.id && m.conteudo === 'depois');
        });
    });

    it('eliminar para todos propaga ao vivo; para mim só remove local', async () => {
        const enviada = await ana.engine.enviarMensagem({ conversa_id: conversaId, conteudo: 'vou desaparecer' });
        const confirmada = await esperar(async () => {
            const lista = await ana.engine.storage.listarMensagens(conversaId, { limite: 20 });

            return lista.find((m) => m.ref_cliente === enviada.ref_cliente && m.estado_envio === 'enviada');
        });

        await ana.engine.eliminarMensagem(conversaId, confirmada.id, true);

        const noBruno = await esperar(async () => {
            const deBruno = await bruno.engine.storage.listarMensagens(conversaId, { limite: 20 });

            return deBruno.find((m) => m.id === confirmada.id && m.eliminada);
        });

        expect(noBruno.conteudo).toBeNull();

        // para mim: Bruno remove localmente uma mensagem da Ana; a Ana mantém
        await bruno.engine.eliminarMensagem(conversaId, confirmada.id, false);
        const listaBruno = await bruno.engine.storage.listarMensagens(conversaId, { limite: 20 });
        expect(listaBruno.some((m) => m.id === confirmada.id)).toBe(false);
    });

    it('media: foto enviada pela biblioteca chega com URL assinada que responde 200', async () => {
        const criado = await ana.api.criarMedia({ tipo: 'foto', mime: 'image/jpeg', nome_ficheiro: 'praia.jpg' });
        const bytes = new Blob([`bytes-${sufixo}`], { type: 'image/jpeg' });
        await ana.api.carregarMedia(criado.upload, bytes, 'image/jpeg');
        await ana.api.confirmarMedia(criado.anexo_id);
        await ana.engine.enviarMensagem({ conversa_id: conversaId, tipo: 'foto', anexo_ids: [criado.anexo_id] });

        const noBruno = await esperar(async () => {
            const lista = await bruno.engine.storage.listarMensagens(conversaId, { limite: 20 });

            return lista.find((m) => m.anexos.some((a) => a.id === criado.anexo_id));
        });

        const url = noBruno.anexos[0].url as string;
        expect(url).toContain('t=');

        const download = await fetch(url);
        expect(download.status).toBe(200);
    });

    it('marcar como não lida repõe o contador', async () => {
        await ana.engine.enviarMensagem({ conversa_id: conversaId, conteudo: 'para marcares não lida' });
        await esperar(async () => {
            const lista = await bruno.engine.storage.listarMensagens(conversaId, { limite: 20 });

            return lista.find((m) => m.conteudo === 'para marcares não lida');
        });

        await bruno.engine.marcarLidas(conversaId);
        await bruno.engine.marcarNaoLida(conversaId);

        const conversa = await bruno.engine.storage.obterConversa(conversaId);
        expect((conversa?.participante?.mensagens_nao_lidas ?? 0)).toBeGreaterThan(0);
    });

    it('chamada: iniciar chega ao outro lado e terminar limpa', async () => {
        bruno.chamadas.length = 0;
        const r = await ana.api.iniciarChamada(conversaId, 'audio');
        expect(r.livekit_token).toBeTruthy();

        const evento = await esperar(async () => bruno.chamadas.find((c) => c.evento === 'iniciada'));
        expect(evento.chamada.tipo).toBe('audio');

        await ana.api.terminarChamada(r.chamada.id);
        await esperar(async () => bruno.chamadas.find((c) => c.evento === 'terminada'));
    });

    it('eliminar conversa esconde para quem elimina e reaparece com mensagem nova', async () => {
        await bruno.engine.eliminarConversa(conversaId);
        expect(await bruno.engine.storage.obterConversa(conversaId)).toBeNull();

        await ana.engine.enviarMensagem({ conversa_id: conversaId, conteudo: 'voltei!' });

        await esperar(async () => {
            const conversa = await bruno.engine.storage.obterConversa(conversaId);
            const lista = await bruno.engine.storage.listarMensagens(conversaId, { limite: 5 });

            return conversa && lista.some((m) => m.conteudo === 'voltei!');
        });
    });
});
