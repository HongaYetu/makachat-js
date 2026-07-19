import { useEffect, useRef } from 'react';
import { useHongaHub } from './provider';

/** true quando o socket do hub está ligado. */
export function useLigacao(): boolean {
    return useHongaHub().ligado;
}

/** Subscreve um canal genérico do hub enquanto o componente está montado. */
export function useCanalHub(canal: string, evento: string, handler: (payload: any) => void): void {
    const { subscribeToChannel } = useHongaHub();
    const ref = useRef(handler);
    ref.current = handler;

    useEffect(() => subscribeToChannel(canal, evento, (p) => ref.current(p)), [subscribeToChannel, canal, evento]);
}
