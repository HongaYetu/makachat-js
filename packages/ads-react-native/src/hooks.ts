import { useCallback, useRef, useState } from 'react';
import { useHongaAds } from './provider';
import { RewardResultado, ServeResultado } from './tipos';

export interface FullscreenControlo {
    /** Carrega o próximo anúncio. Resolve mesmo em no-fill (isLoaded fica false). */
    load(): Promise<boolean>;
    /** Mostra o anúncio carregado. Sem efeito se não houver anúncio pronto. */
    show(): void;
    isLoaded: boolean;
    isLoading: boolean;
}

export interface InterstitialOpcoes {
    /** ms até o botão fechar aparecer. Default 5000. */
    skipAfterMs?: number;
    onClose?: () => void;
}

export interface RewardedOpcoes {
    /** Dispara APENAS depois de o servidor confirmar a visualização. */
    onReward: (resultado: RewardResultado) => void;
    /** segundos de visualização exigidos. Default 15 — alinhado com o servidor. */
    minViewSegundos?: number;
    onClose?: () => void;
}

function useFullscreen(
    unitId: string,
    tipo: 'interstitial' | 'rewarded',
    opts: { skipAfterMs?: number; minViewSegundos?: number; onReward?: (r: RewardResultado) => void; onClose?: () => void },
): FullscreenControlo {
    const { cliente, mostrarFullscreen } = useHongaAds();
    const carregado = useRef<ServeResultado | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const load = useCallback(async () => {
        setIsLoading(true);
        const resultado = await cliente.serve(unitId);
        setIsLoading(false);

        carregado.current = resultado;
        setIsLoaded(resultado !== null);

        return resultado !== null;
    }, [cliente, unitId]);

    const show = useCallback(() => {
        const resultado = carregado.current;

        if (!resultado) {
            return;
        }

        // Tokens são de uso único — o anúncio consumido não pode ser reexibido.
        carregado.current = null;
        setIsLoaded(false);

        mostrarFullscreen({
            tipo,
            resultado,
            skipAfterMs: opts.skipAfterMs,
            minViewSegundos: opts.minViewSegundos,
            onReward: opts.onReward,
            onClose: opts.onClose,
        });
    }, [mostrarFullscreen, tipo, opts.skipAfterMs, opts.minViewSegundos, opts.onReward, opts.onClose]);

    return { load, show, isLoaded, isLoading };
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
export function useInterstitial(unitId: string, opts: InterstitialOpcoes = {}): FullscreenControlo {
    return useFullscreen(unitId, 'interstitial', opts);
}

/**
 * Rewarded (opt-in com recompensa). O `onReward` só dispara após a
 * confirmação server-side da visualização — nunca atribua a recompensa
 * por outra via.
 */
export function useRewarded(unitId: string, opts: RewardedOpcoes): FullscreenControlo {
    return useFullscreen(unitId, 'rewarded', opts);
}
