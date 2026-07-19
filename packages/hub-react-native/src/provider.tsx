import { HubApi, HubSocket, IdentidadeConfig, ObterToken } from '@hongayetu/honga-hub-core';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

export interface HongaHubContexto {
    socket: HubSocket;
    api: HubApi;
    serviceKey: string;
    identidade: IdentidadeConfig;
    /** ligação socket ativa? */
    ligado: boolean;
    /**
     * Subscreve um CANAL genérico do hub (equivalente ao
     * Echo.private(canal).listen(evento)). Re-subscrição automática no
     * reconnect; devolve uma função para cancelar.
     */
    subscribeToChannel(canal: string, evento: string, handler: (payload: any) => void): () => void;
    /**
     * Chamado quando a ligação (re)estabelece ou a app volta a foreground com
     * o socket vivo — é aqui que camadas por cima (ex.: MakaChat) penduram o
     * delta-sync. Devolve função para cancelar.
     */
    subscreverLigado(ouvinte: () => void): () => void;
}

// singleton global: outros bundles CJS deste monorepo (ex.: makachat rotas)
// duplicam este módulo — sem o cache global, provider e consumers usariam
// Contextos diferentes (mesmo padrão do MakaChatProvider).
const alcanceGlobal = globalThis as unknown as { __hongaHubCtx?: React.Context<HongaHubContexto | null> };
const Contexto = (alcanceGlobal.__hongaHubCtx ??= createContext<HongaHubContexto | null>(null));

export interface HongaHubProviderProps {
    serviceKey: string;
    identity: IdentidadeConfig;
    /** troca a sessão do serviço por credenciais do hub — ex.: POST /api/hub/token */
    getToken: ObterToken;
    /**
     * namespace socket.io (default 'hub'). Apps que montam chat por cima
     * (MakaChatProvider) passam 'chat' — os eventos chat:* só existem nesse
     * namespace e os canais funcionam em qualquer um, logo um só socket serve
     * chat + canais.
     */
    namespace?: string;
    children: React.ReactNode;
}

/**
 * Provider GLOBAL do Honga Hub: dono da ligação socket e do token. Monta-se na
 * raiz da app; camadas por cima (MakaChat, streaming, ...) herdam a ligação em
 * vez de criarem a sua. Apps sem chat usam só isto + useCanalHub.
 */
export function HongaHubProvider({ serviceKey, identity, getToken, namespace = 'hub', children }: HongaHubProviderProps) {
    const [ligado, setLigado] = useState(false);
    const ouvintesLigado = useRef(new Set<() => void>());

    const valor = useMemo<HongaHubContexto>(() => {
        const api = new HubApi(getToken);

        const socket = new HubSocket({
            namespace,
            obterToken: async () => {
                api.invalidarSessao();

                return api.sessao();
            },
            aoLigar: () => {
                setLigado(true);
                ouvintesLigado.current.forEach((o) => o());
            },
            aoDesligar: () => setLigado(false),
        });

        return {
            socket,
            api,
            serviceKey,
            identidade: identity,
            ligado: false,
            subscribeToChannel: (canal, evento, handler) => socket.subscreverCanal(canal, evento, handler),
            subscreverLigado: (ouvinte) => {
                ouvintesLigado.current.add(ouvinte);

                return () => ouvintesLigado.current.delete(ouvinte);
            },
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serviceKey, identity.id, identity.tipo, namespace]);

    useEffect(() => {
        void valor.socket.ligar();

        return () => valor.socket.desligar();
    }, [valor]);

    // App volta do background: o Android mata websockets com o ecrã desligado.
    // Desligado → reconecta já (o 'connect' avisa os ouvintes). Se o socket
    // "sobreviveu", avisa na mesma — camadas por cima recuperam eventos
    // perdidos com o seu delta.
    useEffect(() => {
        const sub = AppState.addEventListener('change', (estado: string) => {
            if (estado !== 'active') return;

            if (valor.socket.ligado) {
                ouvintesLigado.current.forEach((o) => o());
            } else {
                valor.socket.garantirLigado();
            }
        });

        return () => sub.remove();
    }, [valor]);

    return <Contexto.Provider value={{ ...valor, ligado }}>{children}</Contexto.Provider>;
}

export function useHongaHub(): HongaHubContexto {
    const contexto = useContext(Contexto);

    if (!contexto) {
        throw new Error('useHongaHub tem de ser usado dentro de <HongaHubProvider>');
    }

    return contexto;
}

/** Como useHongaHub, mas devolve null fora do provider (layouts que montam antes do login). */
export function useHongaHubOpcional(): HongaHubContexto | null {
    return useContext(Contexto);
}
