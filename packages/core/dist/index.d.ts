import { Socket } from 'socket.io-client';

/** Tipos GENÉRICOS do Honga Hub (ligação/token/ack) — partilhados por todos os
 *  módulos (chat, streaming, ...). Os tipos específicos de chat vivem em
 *  @hongayetu/makachat-core. */
interface IdentidadeConfig {
    /** id externo da entidade no serviço de origem (claim `sub`) */
    id: string;
    /** tipo de entidade no serviço (cliente, motorista, encarregado...) */
    tipo: string;
    nome: string;
    foto?: string | null;
}
interface CredenciaisSessao {
    token: string;
    socket_url: string;
    api_url: string;
}
type ObterToken = () => Promise<CredenciaisSessao>;
type Ack<T = Record<string, unknown>> = {
    estado: 'ok' | 'erro';
    texto?: string;
} & T;

declare function uuid(): string;
/**
 * UUID v7 (mesmo formato do hub): 48 bits de timestamp em ms + versão 7 +
 * aleatório. Ordenável lexicograficamente no tempo — o id otimista local ordena
 * corretamente entre os ids v7 do servidor, em vez de ficar preso no fim.
 */
declare function uuidv7(): string;

declare class ErroApi extends Error {
    readonly status: number;
    constructor(message: string, status: number);
}
/**
 * Cliente REST GENÉRICO do Honga Hub. Obtém/renova o token através do callback
 * `obterToken` fornecido pela app (que fala com o backend do próprio serviço) e
 * expõe `pedir()` para as camadas de módulo (ex.: chat) fazerem pedidos
 * autenticados. Só trata de sessão + registo de dispositivos push (transversal);
 * os endpoints de chat vivem em @hongayetu/makachat-core (ChatApi).
 */
declare class HubApi {
    private readonly obterToken;
    private credenciais;
    constructor(obterToken: ObterToken);
    sessao(): Promise<CredenciaisSessao>;
    invalidarSessao(): void;
    pedir<T>(caminho: string, init?: RequestInit, tentativa?: number): Promise<T>;
    registarDispositivo(dados: {
        plataforma: 'ios' | 'android' | 'web';
        fornecedor: 'fcm' | 'apns_voip' | 'webpush';
        token: string;
        token_voip?: string;
        versao_app?: string;
    }): Promise<{
        segredo_resposta?: string;
    }>;
    /** Remove o token push desta identidade (logout). 1 identidade pode ter N tokens. */
    removerDispositivo(token: string): Promise<{
        removido: boolean;
    }>;
}

interface HubSocketOpcoes {
    obterToken: ObterToken;
    /** chamado depois de (re)ligar — camadas por cima fazem flush + delta sync aqui */
    aoLigar?: () => void;
    aoDesligar?: () => void;
    /** namespace socket.io a que liga (default 'hub'); o chat usa 'chat' */
    namespace?: string;
}
/**
 * Ligação socket.io GENÉRICA ao Honga Hub: autentica com o JWT do serviço,
 * renova o token quando o handshake falha por expiração, subscreve canais
 * nomeados (estilo Pusher/Echo) e expõe emissões com ack tipado. Não sabe nada
 * de chat — a camada de chat (makachat-core) compõe por cima via emitirComAck.
 */
declare class HubSocket {
    private socket;
    private opcoes;
    private namespace;
    /** handlers registados antes de ligar() — aplicados quando o socket nasce */
    private handlers;
    /** canais nomeados subscritos (canal → handlers de evento) — re-subscritos no reconnect */
    private canais;
    /** evita dois sockets vivos quando ligar() é chamado em concorrência (ex.: StrictMode) */
    private aLigar;
    private geracao;
    /** falhas seguidas do 1º connect (obterToken) — controla o backoff do retry */
    private tentativasArranque;
    private retryAgendado;
    constructor(opcoes: HubSocketOpcoes);
    get ligado(): boolean;
    get bruto(): Socket | null;
    ligar(): Promise<void>;
    private ligarInterno;
    desligar(): void;
    /**
     * Reconexão imediata (ex.: app volta do background — Android mata websockets
     * e o backoff do socket.io demoraria a notar). Se o 1º connect falhou (socket
     * ainda nulo), re-arranca do zero em vez de ficar morto até reiniciar a app.
     */
    garantirLigado(): void;
    /** Backoff (1s→30s) para re-tentar o 1º connect enquanto o socket não existe. */
    private agendarRetryArranque;
    on(evento: string, handler: (payload: never) => void): void;
    /**
     * Subscreve um CANAL nomeado do hub (estilo Pusher/Echo) reutilizando o
     * MESMO socket: faz join no canal e ouve `evento` nesse socket. O hub
     * autoriza o canal (delega ao serviço). Devolve uma função de cancelar
     * que sai do canal quando fica sem handlers. Re-subscreve sozinho no
     * reconnect (ver reidratarCanais).
     */
    subscreverCanal(canal: string, evento: string, handler: (payload: never) => void): () => void;
    /** Re-emite o join de todos os canais subscritos (chamado em cada connect). */
    private reidratarCanais;
    /** Emissão fire-and-forget (sem ack). Usada por camadas por cima (ex.: typing). */
    emitir(evento: string, payload: unknown): void;
    /** Emissão com ack tipado e timeout — base para as ações de módulos (ex.: chat). */
    emitirComAck<T>(evento: string, payload: unknown): Promise<Ack<T>>;
}

export { type Ack, type CredenciaisSessao, ErroApi, HubApi, HubSocket, type HubSocketOpcoes, type IdentidadeConfig, type ObterToken, uuid, uuidv7 };
