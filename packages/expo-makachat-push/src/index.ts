import { EventEmitter, requireNativeModule } from 'expo-modules-core';

export interface MensagemPushInbox {
    /** JSON da mensagem tal como veio no data payload do push (campo `mensagem`) */
    mensagem_json: string;
    chave_servico: string;
    conversa_id: string;
    recebida_em: string;
}

export interface ChamadaPush {
    chamada_id: string;
    chamada_tipo: 'audio' | 'video';
    conversa_id: string;
    chave_servico: string;
    /** tocar (abriu pela notificação) | atender | rejeitar (ações) */
    acao: 'tocar' | 'atender' | 'rejeitar';
    recebida_em?: string;
}

interface ModuloNativo {
    drenarInbox(): Promise<string>;
    contagemInbox(): Promise<number>;
    /** iOS: App Group para a NSE partilhar o inbox (ex: group.com.hongayetu.humbi) */
    configurar(appGroup: string | null): void;
    obterChamadaPendente(): Promise<string | null>;
    obterConversaPendente(): Promise<string | null>;
    cancelarNotificacaoChamada(chamadaId: string): void;
    cancelarNotificacaoMensagens(conversaId: string): void;
    configurarResposta(apiUrl: string, token: string, segredo: string, meuNome: string): void;
}

const nativo = requireNativeModule<ModuloNativo>('ExpoMakachatPush');
const emissor = new EventEmitter(nativo as never);

export function configurar(appGroup: string | null = null): void {
    nativo.configurar(appGroup);
}

/** Lê e apaga tudo do inbox nativo — chamar no arranque e no foreground. */
export async function drenarInbox(): Promise<MensagemPushInbox[]> {
    return JSON.parse(await nativo.drenarInbox()) as MensagemPushInbox[];
}

export function contagemInbox(): Promise<number> {
    return nativo.contagemInbox();
}

/** Emitido quando o nativo grava um push com a app viva em background. */
export function aoReceberPush(ouvinte: (item: MensagemPushInbox) => void): { remove(): void } {
    return emissor.addListener('onMensagemPush', ouvinte);
}

/**
 * Chamada recebida com a app FECHADA (guardada pela notificação nativa) —
 * ler no arranque; devolve também a ação escolhida (atender/rejeitar).
 */
export async function obterChamadaPendente(): Promise<ChamadaPush | null> {
    const json = await nativo.obterChamadaPendente();

    return json ? (JSON.parse(json) as ChamadaPush) : null;
}

/** Push de chamada com a app viva em background (Android). */
export function aoChamadaPush(ouvinte: (chamada: ChamadaPush) => void): { remove(): void } {
    return emissor.addListener('onChamadaPush', ouvinte as never);
}

/** Cancela a notificação de chamada (depois de atender/rejeitar na app). */
export function cancelarNotificacaoChamada(chamadaId: string): void {
    nativo.cancelarNotificacaoChamada(chamadaId);
}

/**
 * Conversa do tap numa notificação NATIVA de mensagem (app fechada/background) —
 * lê e limpa; chamar no arranque e no AppState 'active' para navegar à conversa.
 */
export async function obterConversaPendente(): Promise<string | null> {
    return nativo.obterConversaPendente();
}

/** Cancela a notificação nativa de mensagens da conversa (ao abrir o chat na app). */
export function cancelarNotificacaoMensagens(conversaId: string): void {
    nativo.cancelarNotificacaoMensagens(conversaId);
}

/**
 * Liga a resposta ao vivo da notificação (Android): guarda no SQLite nativo o
 * endpoint + credenciais do dispositivo (do registo em POST /v1/dispositivos)
 * para o serviço nativo enviar respostas com a app fechada.
 */
export function configurarResposta(config: { api_url: string; token: string; segredo: string; meu_nome: string }): void {
    nativo.configurarResposta(config.api_url, config.token, config.segredo, config.meu_nome);
}
