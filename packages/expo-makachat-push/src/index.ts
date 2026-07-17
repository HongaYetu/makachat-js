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
    /** tocar (a receber) | atender | rejeitar (ações) | parar (atenderam/terminou noutro lado) */
    acao: 'tocar' | 'atender' | 'rejeitar' | 'parar';
    /** nome de quem liga (só em aoChamadaPush com acao 'tocar') */
    titulo?: string;
    /** avatar de quem liga (idem) */
    foto?: string;
    recebida_em?: string;
}

export interface ConfigChamadas {
    /** toque em loop contínuo até atender (opt-in do config plugin) */
    toqueContinuo: boolean;
    /** ecrã nativo de chamada sobre o lockscreen */
    ecraNativo: boolean;
    /** foreground service da chamada em curso (mic vivo em background) */
    servicoChamadaAtiva: boolean;
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
    definirConversaVisivel(conversaId: string | null): void;
    configurarResposta(apiUrl: string, token: string, segredo: string, meuNome: string): void;
    configChamadas(): ConfigChamadas;
    ouvinteChamadasPronto(pronto: boolean): void;
    tocarToqueDispositivo(): void;
    pararToqueDispositivo(): void;
    apresentarChamada(titulo: string, chamadaId: string, chamadaTipo: string, conversaId: string, chaveServico: string, foto: string | null): void;
    iniciarChamadaAtiva(nome: string, foto: string | null, tipo: string): void;
    pararChamadaAtiva(): void;
    /** iOS: token VoIP do PushKit (null enquanto não chega / noutras plataformas) */
    getVoipToken(): string | null;
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

/** Push de chamada com a app viva (Android; iOS ao atender/recusar no CallKit). */
export function aoChamadaPush(ouvinte: (chamada: ChamadaPush) => void): { remove(): void } {
    return emissor.addListener('onChamadaPush', ouvinte as never);
}

/**
 * Token VoIP do PushKit (iOS) — registar no hub em POST /v1/dispositivos com
 * `fornecedor:'apns_voip'`. Null noutras plataformas ou enquanto não chega.
 */
export function getVoipToken(): string | null {
    try {
        return nativo.getVoipToken();
    } catch {
        return null;
    }
}

/** Emitido quando o token VoIP (iOS PushKit) chega ou renova. */
export function aoTokenVoip(ouvinte: (token: string) => void): { remove(): void } {
    return emissor.addListener('onVoipTokenReceived', (e: { token: string }) => ouvinte(e.token));
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

/**
 * Marca o handler de aoChamadaPush como subscrito: só então o push de chamada
 * é entregue ao JS com a app em foreground — caso contrário o nativo apresenta
 * sempre a notificação completa. Chamar com false no cleanup.
 */
export function ouvinteChamadasPronto(pronto: boolean): void {
    try {
        nativo.ouvinteChamadasPronto(pronto);
    } catch {
        // módulo antigo sem esta função
    }
}

/**
 * Toque em-app com o ringtone REAL definido no dispositivo (loop + vibração;
 * Android). Devolve false se o nativo não estiver disponível — o chamador
 * cai no som empacotado.
 */
export function tocarToqueDispositivo(): boolean {
    try {
        nativo.tocarToqueDispositivo();

        return true;
    } catch {
        return false;
    }
}

export function pararToqueDispositivo(): void {
    try {
        nativo.pararToqueDispositivo();
    } catch {
        // módulo antigo sem esta função
    }
}

/**
 * Apresenta a chamada como no app-morto (toque contínuo/notificação CallStyle) —
 * chamar quando aoChamadaPush chega com a app viva mas em BACKGROUND.
 */
export function apresentarChamada(dados: {
    titulo: string;
    chamada_id: string;
    chamada_tipo: 'audio' | 'video';
    conversa_id: string;
    chave_servico: string;
    foto?: string | null;
}): void {
    nativo.apresentarChamada(dados.titulo, dados.chamada_id, dados.chamada_tipo, dados.conversa_id, dados.chave_servico, dados.foto ?? null);
}

/** Flags dos serviços opcionais de chamada (injetadas pelo config plugin). */
export function configChamadas(): ConfigChamadas {
    try {
        return nativo.configChamadas();
    } catch {
        return { toqueContinuo: false, ecraNativo: false, servicoChamadaAtiva: false };
    }
}

/** Foreground service da chamada em curso — chamar quando a fase passa a em_curso. */
export function iniciarChamadaAtiva(dados: { nome: string; foto?: string | null; tipo: 'audio' | 'video' }): void {
    nativo.iniciarChamadaAtiva(dados.nome, dados.foto ?? null, dados.tipo);
}

/** Para o serviço da chamada em curso — chamar ao terminar/limpar. */
export function pararChamadaAtiva(): void {
    nativo.pararChamadaAtiva();
}

/** Cancela a notificação nativa de mensagens da conversa (ao abrir o chat na app). */
export function cancelarNotificacaoMensagens(conversaId: string): void {
    nativo.cancelarNotificacaoMensagens(conversaId);
}

/**
 * Marca (ou limpa, com null) qual a conversa aberta em primeiro plano: o serviço
 * nativo não mostra notificação de sistema dessa conversa enquanto ela estiver
 * visível + app em foreground (o utilizador já a está a ver). Qualquer outra
 * conversa — ou a app minimizada/morta — notifica sempre.
 */
export function definirConversaVisivel(conversaId: string | null): void {
    try {
        nativo.definirConversaVisivel(conversaId);
    } catch {
        // módulo antigo sem esta função
    }
}

/**
 * Liga a resposta ao vivo da notificação (Android): guarda no SQLite nativo o
 * endpoint + credenciais do dispositivo (do registo em POST /v1/dispositivos)
 * para o serviço nativo enviar respostas com a app fechada.
 */
export function configurarResposta(config: { api_url: string; token: string; segredo: string; meu_nome: string }): void {
    nativo.configurarResposta(config.api_url, config.token, config.segredo, config.meu_nome);
}
