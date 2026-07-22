import { HongaAdsConfig, RewardResultado, ServeResultado, StorageAdaptador } from './tipos';

const ENDPOINT_DEFAULT = 'https://anuncios.hongayetu.com/api/v2/ads';
const CHAVE_DEVICE = 'hga.device_id';

function uuidv4(): string {
    const cripto = (globalThis as any).crypto;
    if (cripto?.randomUUID) {
        return cripto.randomUUID();
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Cliente HTTP do Honga Ads. Todos os métodos degradam em silêncio —
 * uma falha de rede nunca deve rebentar a app do publisher.
 */
export class HongaAdsCliente {
    private endpoint: string;

    private deviceId: string | null = null;

    private storage?: StorageAdaptador;

    constructor(private readonly config: HongaAdsConfig) {
        this.endpoint = (config.endpoint ?? ENDPOINT_DEFAULT).replace(/\/+$/, '');
        this.storage = config.storage;
    }

    async obterDeviceId(): Promise<string> {
        if (this.deviceId) {
            return this.deviceId;
        }

        if (this.storage) {
            try {
                const guardado = await this.storage.getItem(CHAVE_DEVICE);
                if (guardado) {
                    this.deviceId = guardado;
                    return guardado;
                }
            } catch {
                // storage indisponível — segue para gerar em memória
            }
        }

        this.deviceId = uuidv4();

        try {
            await this.storage?.setItem(CHAVE_DEVICE, this.deviceId);
        } catch {
            // best effort
        }

        return this.deviceId;
    }

    /** Pede um anúncio para o bloco. Devolve null em no-fill ou erro. */
    async serve(unitUid: string, opts?: { slotWidth?: number; slotHeight?: number; ttl?: number }): Promise<ServeResultado | null> {
        const resposta = await this.post('/serve', {
            ad_unit_uid: unitUid,
            device_id: await this.obterDeviceId(),
            slot_width: opts?.slotWidth ?? null,
            slot_height: opts?.slotHeight ?? null,
            ttl: opts?.ttl ?? null,
        });

        if (!resposta || resposta.estado !== 'ok' || !resposta.data?.anuncio) {
            return null;
        }

        return resposta.data as ServeResultado;
    }

    /** Regista a impressão — chamar apenas quando o anúncio está visível. */
    async impression(token: string): Promise<void> {
        await this.post('/impression', { token, device_id: await this.obterDeviceId() });
    }

    /** Regista o clique e devolve o destino do anunciante (ou null). */
    async click(token: string): Promise<string | null> {
        const resposta = await this.post('/click', { token, device_id: await this.obterDeviceId() });

        return resposta?.data?.redirect_url ?? null;
    }

    /**
     * Confirmação server-side do rewarded. Só atribua a recompensa quando
     * `recompensa === true` — repetições e visualizações curtas vêm false.
     */
    async rewardConfirm(token: string): Promise<RewardResultado> {
        const resposta = await this.post('/reward-confirm', { token, device_id: await this.obterDeviceId() });

        if (!resposta || resposta.estado !== 'ok') {
            return { recompensa: false, motivo: 'erro_rede' };
        }

        return {
            recompensa: resposta.recompensa === true,
            motivo: resposta.motivo ?? null,
            teste: resposta.teste === true,
        };
    }

    private async post(caminho: string, body: Record<string, unknown>): Promise<any | null> {
        try {
            const resposta = await fetch(this.endpoint + caminho, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify(body),
            });

            return await resposta.json();
        } catch {
            return null;
        }
    }
}
