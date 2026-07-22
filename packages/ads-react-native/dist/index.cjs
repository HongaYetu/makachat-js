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
  AdBanner: () => AdBanner,
  HongaAdsCliente: () => HongaAdsCliente,
  HongaAdsProvider: () => HongaAdsProvider,
  useHongaAds: () => useHongaAds,
  useInterstitial: () => useInterstitial,
  useRewarded: () => useRewarded
});
module.exports = __toCommonJS(index_exports);

// src/AdBanner.tsx
var import_react3 = require("react");
var import_react_native2 = require("react-native");

// src/provider.tsx
var import_react2 = require("react");

// src/cliente.ts
var ENDPOINT_DEFAULT = "https://anuncios.hongayetu.com/api/v2/ads";
var CHAVE_DEVICE = "hga.device_id";
function uuidv4() {
  const cripto = globalThis.crypto;
  if (cripto?.randomUUID) {
    return cripto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}
var HongaAdsCliente = class {
  constructor(config) {
    this.config = config;
    this.endpoint = (config.endpoint ?? ENDPOINT_DEFAULT).replace(/\/+$/, "");
    this.storage = config.storage;
  }
  config;
  endpoint;
  deviceId = null;
  storage;
  async obterDeviceId() {
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
      }
    }
    this.deviceId = uuidv4();
    try {
      await this.storage?.setItem(CHAVE_DEVICE, this.deviceId);
    } catch {
    }
    return this.deviceId;
  }
  /** Pede um anúncio para o bloco. Devolve null em no-fill ou erro. */
  async serve(unitUid, opts) {
    const resposta = await this.post("/serve", {
      ad_unit_uid: unitUid,
      device_id: await this.obterDeviceId(),
      slot_width: opts?.slotWidth ?? null,
      slot_height: opts?.slotHeight ?? null,
      ttl: opts?.ttl ?? null
    });
    if (!resposta || resposta.estado !== "ok" || !resposta.data?.anuncio) {
      return null;
    }
    return resposta.data;
  }
  /** Regista a impressão — chamar apenas quando o anúncio está visível. */
  async impression(token) {
    await this.post("/impression", { token, device_id: await this.obterDeviceId() });
  }
  /** Regista o clique e devolve o destino do anunciante (ou null). */
  async click(token) {
    const resposta = await this.post("/click", { token, device_id: await this.obterDeviceId() });
    return resposta?.data?.redirect_url ?? null;
  }
  /**
   * Confirmação server-side do rewarded. Só atribua a recompensa quando
   * `recompensa === true` — repetições e visualizações curtas vêm false.
   */
  async rewardConfirm(token) {
    const resposta = await this.post("/reward-confirm", { token, device_id: await this.obterDeviceId() });
    if (!resposta || resposta.estado !== "ok") {
      return { recompensa: false, motivo: "erro_rede" };
    }
    return {
      recompensa: resposta.recompensa === true,
      motivo: resposta.motivo ?? null,
      teste: resposta.teste === true
    };
  }
  async post(caminho, body) {
    try {
      const resposta = await fetch(this.endpoint + caminho, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(body)
      });
      return await resposta.json();
    } catch {
      return null;
    }
  }
};

// src/fullscreen.tsx
var import_react = require("react");
var import_react_native = require("react-native");
var import_jsx_runtime = require("react/jsx-runtime");
function FullscreenAnuncio({ pedido, cliente, aoFechar }) {
  const [podeFechar, setPodeFechar] = (0, import_react.useState)(false);
  const [segundosRestantes, setSegundosRestantes] = (0, import_react.useState)(0);
  const confirmado = (0, import_react.useRef)(false);
  (0, import_react.useEffect)(() => {
    if (!pedido) {
      return;
    }
    confirmado.current = false;
    setPodeFechar(false);
    if (pedido.tipo === "interstitial") {
      const timerImpressao = setTimeout(() => {
        void cliente.impression(pedido.resultado.tokens.impression);
      }, 1e3);
      const timerFechar = setTimeout(() => setPodeFechar(true), pedido.skipAfterMs ?? 5e3);
      return () => {
        clearTimeout(timerImpressao);
        clearTimeout(timerFechar);
      };
    }
    const minView = pedido.minViewSegundos ?? 15;
    setSegundosRestantes(minView);
    const intervalo = setInterval(() => {
      setSegundosRestantes((atual) => {
        if (atual <= 1) {
          clearInterval(intervalo);
          if (!confirmado.current) {
            confirmado.current = true;
            void concluirRewarded(pedido, cliente);
          }
          setPodeFechar(true);
          return 0;
        }
        return atual - 1;
      });
    }, 1e3);
    return () => clearInterval(intervalo);
  }, [pedido, cliente]);
  if (!pedido) {
    return null;
  }
  const anuncio = pedido.resultado.anuncio;
  const asset = anuncio.assets[0];
  const fechar = () => {
    pedido.onClose?.();
    aoFechar();
  };
  const abrirDestino = async () => {
    const destino = await cliente.click(pedido.resultado.tokens.click);
    if (destino) {
      void import_react_native.Linking.openURL(destino);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.Modal, { visible: true, transparent: true, animationType: "fade", onRequestClose: () => podeFechar && fechar(), children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native.View, { style: estilos.fundo, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native.Pressable, { style: estilos.criativo, onPress: abrirDestino, children: [
      asset ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.Image, { source: { uri: asset.url }, style: estilos.imagem, resizeMode: "contain" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.Text, { style: estilos.titulo, children: anuncio.nome ?? "An\xFAncio" }),
      asset?.texto_cta ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.Text, { style: estilos.cta, children: asset.texto_cta }) : null
    ] }),
    anuncio.teste ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.Text, { style: estilos.badgeTeste, children: "An\xFAncio de teste" }) : null,
    podeFechar ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.Pressable, { style: estilos.fechar, onPress: fechar, accessibilityLabel: "Fechar an\xFAncio", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.Text, { style: estilos.fecharTexto, children: "\xD7" }) }) : pedido.tipo === "rewarded" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.View, { style: estilos.contagem, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native.Text, { style: estilos.contagemTexto, children: [
      segundosRestantes,
      "s"
    ] }) }) : null
  ] }) });
}
async function concluirRewarded(pedido, cliente) {
  await cliente.impression(pedido.resultado.tokens.impression);
  const resultado = await cliente.rewardConfirm(pedido.resultado.tokens.impression);
  if (resultado.recompensa) {
    pedido.onReward?.(resultado);
  }
}
var estilos = import_react_native.StyleSheet.create({
  fundo: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center"
  },
  criativo: {
    width: "92%",
    height: "80%",
    alignItems: "center",
    justifyContent: "center"
  },
  imagem: {
    width: "100%",
    height: "100%"
  },
  titulo: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600"
  },
  cta: {
    marginTop: 12,
    color: "#ffffff",
    backgroundColor: "#16a34a",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    overflow: "hidden",
    fontWeight: "600"
  },
  fechar: {
    position: "absolute",
    top: 48,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center"
  },
  fecharTexto: {
    color: "#ffffff",
    fontSize: 22,
    lineHeight: 24
  },
  contagem: {
    position: "absolute",
    top: 48,
    right: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)"
  },
  contagemTexto: {
    color: "#ffffff",
    fontWeight: "600"
  },
  badgeTeste: {
    position: "absolute",
    top: 52,
    left: 20,
    color: "#111827",
    backgroundColor: "#fbbf24",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: "hidden",
    fontSize: 12,
    fontWeight: "700"
  }
});

// src/provider.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var alcanceGlobal = globalThis;
var Contexto = alcanceGlobal.__hongaAdsCtx ??= (0, import_react2.createContext)(null);
function HongaAdsProvider({ children, publisherId, apiKey, endpoint, storage }) {
  const cliente = (0, import_react2.useMemo)(
    () => new HongaAdsCliente({ publisherId, apiKey, endpoint, storage }),
    [publisherId, apiKey, endpoint]
  );
  const [pedidoAtual, setPedidoAtual] = (0, import_react2.useState)(null);
  const valor = (0, import_react2.useMemo)(
    () => ({
      cliente,
      mostrarFullscreen: setPedidoAtual
    }),
    [cliente]
  );
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(Contexto.Provider, { value: valor, children: [
    children,
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(FullscreenAnuncio, { pedido: pedidoAtual, cliente, aoFechar: () => setPedidoAtual(null) })
  ] });
}
function useHongaAds() {
  const contexto = (0, import_react2.useContext)(Contexto);
  if (!contexto) {
    throw new Error("[HongaAds] useHongaAds tem de ser usado dentro de <HongaAdsProvider>.");
  }
  return contexto;
}

// src/AdBanner.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
function AdBanner({ unitId, style }) {
  const { cliente } = useHongaAds();
  const [resultado, setResultado] = (0, import_react3.useState)(null);
  const [semAnuncio, setSemAnuncio] = (0, import_react3.useState)(false);
  const impressaoEnviada = (0, import_react3.useRef)(false);
  (0, import_react3.useEffect)(() => {
    let cancelado = false;
    impressaoEnviada.current = false;
    setResultado(null);
    setSemAnuncio(false);
    void cliente.serve(unitId).then((servido) => {
      if (cancelado) {
        return;
      }
      if (!servido || servido.anuncio.assets.length === 0) {
        setSemAnuncio(true);
        return;
      }
      setResultado(servido);
    });
    return () => {
      cancelado = true;
    };
  }, [cliente, unitId]);
  (0, import_react3.useEffect)(() => {
    if (!resultado || impressaoEnviada.current) {
      return;
    }
    const timer = setTimeout(() => {
      impressaoEnviada.current = true;
      void cliente.impression(resultado.tokens.impression);
    }, 1e3);
    return () => clearTimeout(timer);
  }, [resultado, cliente]);
  if (semAnuncio || !resultado) {
    return null;
  }
  const anuncio = resultado.anuncio;
  const asset = anuncio.assets[0];
  const ratio = asset.largura && asset.altura ? asset.largura / asset.altura : 320 / 50;
  const abrirDestino = async () => {
    const destino = await cliente.click(resultado.tokens.click);
    if (destino) {
      void import_react_native2.Linking.openURL(destino);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_react_native2.Pressable, { onPress: abrirDestino, style, accessibilityLabel: anuncio.nome ?? "An\xFAncio", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_react_native2.View, { style: { width: "100%", aspectRatio: ratio }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_react_native2.Image, { source: { uri: asset.url }, style: { width: "100%", height: "100%" }, resizeMode: "contain" }),
    anuncio.teste ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      import_react_native2.Text,
      {
        style: {
          position: "absolute",
          top: 4,
          left: 4,
          fontSize: 10,
          fontWeight: "700",
          color: "#111827",
          backgroundColor: "#fbbf24",
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 4,
          overflow: "hidden"
        },
        children: "Teste"
      }
    ) : null
  ] }) });
}

// src/hooks.ts
var import_react4 = require("react");
function useFullscreen(unitId, tipo, opts) {
  const { cliente, mostrarFullscreen } = useHongaAds();
  const carregado = (0, import_react4.useRef)(null);
  const [isLoaded, setIsLoaded] = (0, import_react4.useState)(false);
  const [isLoading, setIsLoading] = (0, import_react4.useState)(false);
  const load = (0, import_react4.useCallback)(async () => {
    setIsLoading(true);
    const resultado = await cliente.serve(unitId);
    setIsLoading(false);
    carregado.current = resultado;
    setIsLoaded(resultado !== null);
    return resultado !== null;
  }, [cliente, unitId]);
  const show = (0, import_react4.useCallback)(() => {
    const resultado = carregado.current;
    if (!resultado) {
      return;
    }
    carregado.current = null;
    setIsLoaded(false);
    mostrarFullscreen({
      tipo,
      resultado,
      skipAfterMs: opts.skipAfterMs,
      minViewSegundos: opts.minViewSegundos,
      onReward: opts.onReward,
      onClose: opts.onClose
    });
  }, [mostrarFullscreen, tipo, opts.skipAfterMs, opts.minViewSegundos, opts.onReward, opts.onClose]);
  return { load, show, isLoaded, isLoading };
}
function useInterstitial(unitId, opts = {}) {
  return useFullscreen(unitId, "interstitial", opts);
}
function useRewarded(unitId, opts) {
  return useFullscreen(unitId, "rewarded", opts);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AdBanner,
  HongaAdsCliente,
  HongaAdsProvider,
  useHongaAds,
  useInterstitial,
  useRewarded
});
//# sourceMappingURL=index.cjs.map