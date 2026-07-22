export interface AdAsset {
    tipo: 'imagem' | 'video' | string;
    url: string;
    largura?: number;
    altura?: number;
    texto_titulo?: string | null;
    texto_descricao?: string | null;
    texto_cta?: string | null;
}

export interface Anuncio {
    id: number;
    nome?: string;
    url?: string;
    /** true quando servido em ambiente test (criativo fictício, sem custo). */
    teste?: boolean;
    assets: AdAsset[];
}

export interface AdTokens {
    impression: string;
    click: string;
}

export interface ServeResultado {
    anuncio: Anuncio;
    tokens: AdTokens;
    ttl: number;
}

export interface RewardResultado {
    recompensa: boolean;
    motivo?: string | null;
    teste?: boolean;
}

/**
 * Adaptador de persistência opcional (ex.: AsyncStorage) para manter o
 * device id estável entre sessões. Sem ele, o id vive só em memória.
 */
export interface StorageAdaptador {
    getItem(chave: string): Promise<string | null>;
    setItem(chave: string, valor: string): Promise<void>;
}

export interface HongaAdsConfig {
    /** Publisher ID (hy-pub-...) do separador Honga Ads no portal de developers. */
    publisherId: string;
    /** Chave da app no formato key_id|secret (hy_test_... para testar, hy_live_... em produção). */
    apiKey: string;
    /** Override do endpoint da API de anúncios (default: produção Honga Yetu). */
    endpoint?: string;
    /** Persistência do device id (ex.: AsyncStorage). */
    storage?: StorageAdaptador;
}
