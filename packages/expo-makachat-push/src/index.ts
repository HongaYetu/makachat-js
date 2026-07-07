import { EventEmitter, requireNativeModule } from 'expo-modules-core';

export interface MensagemPushInbox {
    /** JSON da mensagem tal como veio no data payload do push (campo `mensagem`) */
    mensagem_json: string;
    chave_servico: string;
    conversa_id: string;
    recebida_em: string;
}

interface ModuloNativo {
    drenarInbox(): Promise<string>;
    contagemInbox(): Promise<number>;
    /** iOS: App Group para a NSE partilhar o inbox (ex: group.com.hongayetu.humbi) */
    configurar(appGroup: string | null): void;
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
