import * as react_jsx_runtime from 'react/jsx-runtime';
import React from 'react';

interface AdBannerProps {
    /** unit_uid (hy-unit-...) de um bloco de formato banner. */
    unitId: string;
    style?: any;
}
/**
 * Banner Honga Ads. Serve no mount, regista a impressão após 1 segundo de
 * exibição e abre o destino do anunciante no clique. Em no-fill ou erro
 * colapsa (não ocupa espaço).
 */
declare function AdBanner({ unitId, style }: AdBannerProps): react_jsx_runtime.JSX.Element | null;

interface AdAsset {
    tipo: 'imagem' | 'video' | string;
    url: string;
    largura?: number;
    altura?: number;
    texto_titulo?: string | null;
    texto_descricao?: string | null;
    texto_cta?: string | null;
}
interface Anuncio {
    id: number;
    nome?: string;
    url?: string;
    /** true quando servido em ambiente test (criativo fictício, sem custo). */
    teste?: boolean;
    assets: AdAsset[];
}
interface AdTokens {
    impression: string;
    click: string;
}
interface ServeResultado {
    anuncio: Anuncio;
    tokens: AdTokens;
    ttl: number;
}
interface RewardResultado {
    recompensa: boolean;
    motivo?: string | null;
    teste?: boolean;
}
/**
 * Adaptador de persistência opcional (ex.: AsyncStorage) para manter o
 * device id estável entre sessões. Sem ele, o id vive só em memória.
 */
interface StorageAdaptador {
    getItem(chave: string): Promise<string | null>;
    setItem(chave: string, valor: string): Promise<void>;
}
interface HongaAdsConfig {
    /** Publisher ID (hy-pub-...) do separador Honga Ads no portal de developers. */
    publisherId: string;
    /** Chave da app no formato key_id|secret (hy_test_... para testar, hy_live_... em produção). */
    apiKey: string;
    /** Override do endpoint da API de anúncios (default: produção Honga Yetu). */
    endpoint?: string;
    /** Persistência do device id (ex.: AsyncStorage). */
    storage?: StorageAdaptador;
}

/**
 * Cliente HTTP do Honga Ads. Todos os métodos degradam em silêncio —
 * uma falha de rede nunca deve rebentar a app do publisher.
 */
declare class HongaAdsCliente {
    private readonly config;
    private endpoint;
    private deviceId;
    private storage?;
    constructor(config: HongaAdsConfig);
    obterDeviceId(): Promise<string>;
    /** Pede um anúncio para o bloco. Devolve null em no-fill ou erro. */
    serve(unitUid: string, opts?: {
        slotWidth?: number;
        slotHeight?: number;
        ttl?: number;
    }): Promise<ServeResultado | null>;
    /** Regista a impressão — chamar apenas quando o anúncio está visível. */
    impression(token: string): Promise<void>;
    /** Regista o clique e devolve o destino do anunciante (ou null). */
    click(token: string): Promise<string | null>;
    /**
     * Confirmação server-side do rewarded. Só atribua a recompensa quando
     * `recompensa === true` — repetições e visualizações curtas vêm false.
     */
    rewardConfirm(token: string): Promise<RewardResultado>;
    private post;
}

interface PedidoFullscreen {
    tipo: 'interstitial' | 'rewarded';
    resultado: ServeResultado;
    /** ms até o botão fechar aparecer (interstitial). Default 5000. */
    skipAfterMs?: number;
    /** segundos de visualização exigidos (rewarded). Default 15 — alinhado com o servidor. */
    minViewSegundos?: number;
    onReward?: (resultado: RewardResultado) => void;
    onClose?: () => void;
}

interface FullscreenControlo {
    /** Carrega o próximo anúncio. Resolve mesmo em no-fill (isLoaded fica false). */
    load(): Promise<boolean>;
    /** Mostra o anúncio carregado. Sem efeito se não houver anúncio pronto. */
    show(): void;
    isLoaded: boolean;
    isLoading: boolean;
}
interface InterstitialOpcoes {
    /** ms até o botão fechar aparecer. Default 5000. */
    skipAfterMs?: number;
    onClose?: () => void;
}
interface RewardedOpcoes {
    /** Dispara APENAS depois de o servidor confirmar a visualização. */
    onReward: (resultado: RewardResultado) => void;
    /** segundos de visualização exigidos. Default 15 — alinhado com o servidor. */
    minViewSegundos?: number;
    onClose?: () => void;
}
/**
 * Interstitial (ecrã inteiro em pausas naturais da app).
 *
 * ```tsx
 * const interstitial = useInterstitial('hy-unit-xxxx');
 * await interstitial.load();
 * if (interstitial.isLoaded) interstitial.show();
 * ```
 */
declare function useInterstitial(unitId: string, opts?: InterstitialOpcoes): FullscreenControlo;
/**
 * Rewarded (opt-in com recompensa). O `onReward` só dispara após a
 * confirmação server-side da visualização — nunca atribua a recompensa
 * por outra via.
 */
declare function useRewarded(unitId: string, opts: RewardedOpcoes): FullscreenControlo;

interface HongaAdsContexto {
    cliente: HongaAdsCliente;
    /** interno: usado pelos hooks de interstitial/rewarded para abrir o modal. */
    mostrarFullscreen(pedido: PedidoFullscreen): void;
}
interface HongaAdsProviderProps extends HongaAdsConfig {
    children: React.ReactNode;
}
/**
 * Provider do Honga Ads: dono do cliente HTTP e do host de anúncios
 * fullscreen (interstitial/rewarded). Monta-se na raiz da app.
 *
 * ```tsx
 * <HongaAdsProvider publisherId="hy-pub-xxxx" apiKey="hy_test_xxxx|secret" storage={AsyncStorage}>
 *     <App />
 * </HongaAdsProvider>
 * ```
 */
declare function HongaAdsProvider({ children, publisherId, apiKey, endpoint, storage }: HongaAdsProviderProps): react_jsx_runtime.JSX.Element;
declare function useHongaAds(): HongaAdsContexto;

export { type AdAsset, AdBanner, type AdBannerProps, type AdTokens, type Anuncio, type FullscreenControlo, HongaAdsCliente, type HongaAdsConfig, type HongaAdsContexto, HongaAdsProvider, type HongaAdsProviderProps, type InterstitialOpcoes, type PedidoFullscreen, type RewardResultado, type RewardedOpcoes, type ServeResultado, type StorageAdaptador, useHongaAds, useInterstitial, useRewarded };
