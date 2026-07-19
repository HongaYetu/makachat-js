"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  ErroApi: () => import_honga_hub_core2.ErroApi,
  HongaHubProvider: () => HongaHubProvider,
  HubApi: () => import_honga_hub_core2.HubApi,
  HubSocket: () => import_honga_hub_core2.HubSocket,
  useCanalHub: () => useCanalHub,
  useHongaHub: () => useHongaHub,
  useHongaHubOpcional: () => useHongaHubOpcional,
  useLigacao: () => useLigacao,
  uuid: () => import_honga_hub_core2.uuid
});
module.exports = __toCommonJS(index_exports);
var import_honga_hub_core2 = require("@hongayetu/honga-hub-core");

// src/provider.tsx
var import_honga_hub_core = require("@hongayetu/honga-hub-core");
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var Contexto = (0, import_react.createContext)(null);
function HongaHubProvider({ serviceKey, identity, getToken, namespace = "hub", children }) {
  const [ligado, setLigado] = (0, import_react.useState)(false);
  const ouvintesLigado = (0, import_react.useRef)(/* @__PURE__ */ new Set());
  const valor = (0, import_react.useMemo)(() => {
    const api = new import_honga_hub_core.HubApi(getToken);
    const socket = new import_honga_hub_core.HubSocket({
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
  (0, import_react.useEffect)(() => {
    void valor.socket.ligar();
    return () => valor.socket.desligar();
  }, [valor]);
  (0, import_react.useEffect)(() => {
    if (typeof document === "undefined") return;
    const aoVisibilidade = () => {
      if (document.visibilityState !== "visible") return;
      if (valor.socket.ligado) {
        ouvintesLigado.current.forEach((o) => o());
      } else {
        valor.socket.garantirLigado();
      }
    };
    document.addEventListener("visibilitychange", aoVisibilidade);
    return () => document.removeEventListener("visibilitychange", aoVisibilidade);
  }, [valor]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Contexto.Provider, { value: { ...valor, ligado }, children });
}
function useHongaHub() {
  const contexto = (0, import_react.useContext)(Contexto);
  if (!contexto) {
    throw new Error("useHongaHub tem de ser usado dentro de <HongaHubProvider>");
  }
  return contexto;
}
function useHongaHubOpcional() {
  return (0, import_react.useContext)(Contexto);
}

// src/hooks.ts
var import_react2 = require("react");
function useLigacao() {
  return useHongaHub().ligado;
}
function useCanalHub(canal, evento, handler) {
  const { subscribeToChannel } = useHongaHub();
  const ref = (0, import_react2.useRef)(handler);
  ref.current = handler;
  (0, import_react2.useEffect)(() => subscribeToChannel(canal, evento, (p) => ref.current(p)), [subscribeToChannel, canal, evento]);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ErroApi,
  HongaHubProvider,
  HubApi,
  HubSocket,
  useCanalHub,
  useHongaHub,
  useHongaHubOpcional,
  useLigacao,
  uuid
});
//# sourceMappingURL=index.cjs.map