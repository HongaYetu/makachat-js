// src/index.ts
import { HubApi as HubApi2, HubSocket as HubSocket2, ErroApi, uuid } from "@hongayetu/honga-hub-core";

// src/provider.tsx
import { HubApi, HubSocket } from "@hongayetu/honga-hub-core";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { jsx } from "react/jsx-runtime";
var alcanceGlobal = globalThis;
var Contexto = alcanceGlobal.__hongaHubCtx ??= createContext(null);
function HongaHubProvider({ serviceKey, identity, getToken, namespace = "hub", children }) {
  const [ligado, setLigado] = useState(false);
  const ouvintesLigado = useRef(/* @__PURE__ */ new Set());
  const valor = useMemo(() => {
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
      aoDesligar: () => setLigado(false)
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
      }
    };
  }, [serviceKey, identity.id, identity.tipo, namespace]);
  useEffect(() => {
    void valor.socket.ligar();
    return () => valor.socket.desligar();
  }, [valor]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (estado) => {
      if (estado !== "active") return;
      if (valor.socket.ligado) {
        ouvintesLigado.current.forEach((o) => o());
      } else {
        valor.socket.garantirLigado();
      }
    });
    return () => sub.remove();
  }, [valor]);
  return /* @__PURE__ */ jsx(Contexto.Provider, { value: { ...valor, ligado }, children });
}
function useHongaHub() {
  const contexto = useContext(Contexto);
  if (!contexto) {
    throw new Error("useHongaHub tem de ser usado dentro de <HongaHubProvider>");
  }
  return contexto;
}
function useHongaHubOpcional() {
  return useContext(Contexto);
}

// src/hooks.ts
import { useEffect as useEffect2, useRef as useRef2 } from "react";
function useLigacao() {
  return useHongaHub().ligado;
}
function useCanalHub(canal, evento, handler) {
  const { subscribeToChannel } = useHongaHub();
  const ref = useRef2(handler);
  ref.current = handler;
  useEffect2(() => subscribeToChannel(canal, evento, (p) => ref.current(p)), [subscribeToChannel, canal, evento]);
}
export {
  ErroApi,
  HongaHubProvider,
  HubApi2 as HubApi,
  HubSocket2 as HubSocket,
  useCanalHub,
  useHongaHub,
  useHongaHubOpcional,
  useLigacao,
  uuid
};
//# sourceMappingURL=index.js.map