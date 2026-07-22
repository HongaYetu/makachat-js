import React, { createContext, useContext, useMemo, useState } from 'react';
import { HongaAdsCliente } from './cliente';
import { FullscreenAnuncio, PedidoFullscreen } from './fullscreen';
import { HongaAdsConfig } from './tipos';

export interface HongaAdsContexto {
    cliente: HongaAdsCliente;
    /** interno: usado pelos hooks de interstitial/rewarded para abrir o modal. */
    mostrarFullscreen(pedido: PedidoFullscreen): void;
}

// singleton global: outros bundles CJS deste monorepo duplicam este módulo —
// sem o cache global, provider e consumers usariam Contextos diferentes
// (mesmo padrão do HongaHubProvider/MakaChatProvider).
const alcanceGlobal = globalThis as unknown as { __hongaAdsCtx?: React.Context<HongaAdsContexto | null> };
const Contexto = (alcanceGlobal.__hongaAdsCtx ??= createContext<HongaAdsContexto | null>(null));

export interface HongaAdsProviderProps extends HongaAdsConfig {
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
export function HongaAdsProvider({ children, publisherId, apiKey, endpoint, storage }: HongaAdsProviderProps) {
    const cliente = useMemo(
        () => new HongaAdsCliente({ publisherId, apiKey, endpoint, storage }),
        [publisherId, apiKey, endpoint],
    );

    const [pedidoAtual, setPedidoAtual] = useState<PedidoFullscreen | null>(null);

    const valor = useMemo<HongaAdsContexto>(
        () => ({
            cliente,
            mostrarFullscreen: setPedidoAtual,
        }),
        [cliente],
    );

    return (
        <Contexto.Provider value={valor}>
            {children}
            <FullscreenAnuncio pedido={pedidoAtual} cliente={cliente} aoFechar={() => setPedidoAtual(null)} />
        </Contexto.Provider>
    );
}

export function useHongaAds(): HongaAdsContexto {
    const contexto = useContext(Contexto);

    if (!contexto) {
        throw new Error('[HongaAds] useHongaAds tem de ser usado dentro de <HongaAdsProvider>.');
    }

    return contexto;
}
