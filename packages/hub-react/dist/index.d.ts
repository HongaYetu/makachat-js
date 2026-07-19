import { HubSocket, HubApi, IdentidadeConfig, ObterToken } from '@hongayetu/honga-hub-core';
export { Ack, CredenciaisSessao, ErroApi, HubApi, HubSocket, HubSocketOpcoes, IdentidadeConfig, ObterToken, uuid } from '@hongayetu/honga-hub-core';
import * as react_jsx_runtime from 'react/jsx-runtime';
import React from 'react';

interface HongaHubContexto {
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
     * Chamado quando a ligação (re)estabelece ou a página volta a visível com
     * o socket vivo — é aqui que camadas por cima (ex.: MakaChat) penduram o
     * delta-sync. Devolve função para cancelar.
     */
    subscreverLigado(ouvinte: () => void): () => void;
}
interface HongaHubProviderProps {
    serviceKey: string;
    identity: IdentidadeConfig;
    /** troca a sessão do serviço por credenciais do hub — ex.: POST /hub/token */
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
declare function HongaHubProvider({ serviceKey, identity, getToken, namespace, children }: HongaHubProviderProps): react_jsx_runtime.JSX.Element;
declare function useHongaHub(): HongaHubContexto;
/** Como useHongaHub, mas devolve null fora do provider (layouts que montam sem sessão). */
declare function useHongaHubOpcional(): HongaHubContexto | null;

/** true quando o socket do hub está ligado. */
declare function useLigacao(): boolean;
/** Subscreve um canal genérico do hub enquanto o componente está montado. */
declare function useCanalHub(canal: string, evento: string, handler: (payload: any) => void): void;

export { type HongaHubContexto, HongaHubProvider, type HongaHubProviderProps, useCanalHub, useHongaHub, useHongaHubOpcional, useLigacao };
