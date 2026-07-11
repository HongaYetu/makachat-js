"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __reExport = (target, mod, secondTarget) => (__copyProps(target, mod, "default"), secondTarget && __copyProps(secondTarget, mod, "default"));
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AvatarWeb: () => AvatarWeb,
  ChamadasProvider: () => ChamadasProvider,
  ConversaPainel: () => ConversaPainel,
  MakaChatBoxFull: () => MakaChatBoxFull,
  MakaChatBoxMin: () => MakaChatBoxMin,
  MakaChatConversa: () => MakaChatConversa,
  MakaChatConversas: () => MakaChatConversas,
  MakaChatDock: () => MakaChatDock,
  MakaChatProvider: () => MakaChatProvider,
  comecarToque: () => comecarToque,
  mostrarNotificacao: () => mostrarNotificacao,
  notificacoesSuportadas: () => notificacoesSuportadas,
  pararToque: () => pararToque,
  pedirPermissaoNotificacoes: () => pedirPermissaoNotificacoes,
  tocarSom: () => tocarSom,
  useChamadas: () => useChamadas,
  useChamadasOpcional: () => useChamadasOpcional,
  useConversas: () => useConversas,
  useDock: () => useDock,
  useEnviarMensagem: () => useEnviarMensagem,
  useFuncionalidadeAtiva: () => useFuncionalidadeAtiva,
  useLigacao: () => useLigacao,
  useMakaChat: () => useMakaChat,
  useMensagemRecebida: () => useMensagemRecebida,
  useMensagens: () => useMensagens,
  usePresenca: () => usePresenca,
  useSemLigacao: () => useSemLigacao,
  useTotalNaoLidas: () => useTotalNaoLidas,
  useTypingConversa: () => useTypingConversa,
  useVersaoChat: () => useVersaoChat
});
module.exports = __toCommonJS(index_exports);
__reExport(index_exports, require("@hongayetu/makachat-core"), module.exports);

// src/provider.tsx
var import_makachat_core = require("@hongayetu/makachat-core");
var import_react = require("react");

// src/tema.ts
var PADRAO = {
  primaria: "#4f46e5",
  primariaContraste: "#ffffff",
  fundo: "#f4f5f7",
  superficie: "#ffffff",
  bolhaMinha: "#4f46e5",
  bolhaMinhaTexto: "#ffffff",
  bolhaOutro: "#ffffff",
  texto: "#0f172a",
  textoSuave: "#64748b",
  raio: "16px",
  fonte: "inherit"
};
function cssVarsDoTema(tema) {
  const t = { ...PADRAO, ...tema };
  return {
    "--maka-primaria": t.primaria,
    "--maka-primaria-contraste": t.primariaContraste,
    "--maka-fundo": t.fundo,
    "--maka-superficie": t.superficie,
    "--maka-bolha-minha": t.bolhaMinha,
    "--maka-bolha-minha-texto": t.bolhaMinhaTexto,
    "--maka-bolha-outro": t.bolhaOutro,
    "--maka-texto": t.texto,
    "--maka-texto-suave": t.textoSuave,
    "--maka-raio": t.raio,
    fontFamily: t.fonte
  };
}

// src/notificacoes.ts
function notificacoesSuportadas() {
  return typeof window !== "undefined" && "Notification" in window;
}
async function pedirPermissaoNotificacoes() {
  if (!notificacoesSuportadas()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return await Notification.requestPermission() === "granted";
}
function mostrarNotificacao(titulo, opcoes, aoClicar) {
  if (!notificacoesSuportadas() || Notification.permission !== "granted") return;
  try {
    const n = new Notification(titulo, {
      body: opcoes.corpo,
      icon: opcoes.icone ?? void 0,
      tag: opcoes.tag
    });
    n.onclick = () => {
      window.focus();
      aoClicar?.();
      n.close();
    };
  } catch {
  }
}

// src/sons.ts
var import_meta = {};
var FICHEIROS = {
  recebida: "mensagem_recebida.mp3",
  enviada: "mensagem_enviada.mp3",
  vista: "mensagem_vista.mp3",
  a_chamar: "a_chamar.mp3",
  toque_receber: "toque_receber.mp3"
};
var cache = /* @__PURE__ */ new Map();
function urlDe(nome) {
  try {
    return new URL(`../sons/${FICHEIROS[nome]}`, import_meta.url).href;
  } catch {
    return null;
  }
}
function tocarSom(nome) {
  if (typeof Audio === "undefined") return;
  try {
    let el = cache.get(nome);
    if (!el) {
      const url = urlDe(nome);
      if (!url) return;
      el = new Audio(url);
      el.volume = 0.6;
      cache.set(nome, el);
    }
    el.currentTime = 0;
    void el.play().catch(() => void 0);
  } catch {
  }
}
var toque = null;
function comecarToque(tipo = "ligar") {
  if (typeof Audio === "undefined" || toque) return;
  try {
    const url = urlDe(tipo === "receber" ? "toque_receber" : "a_chamar");
    if (!url) return;
    toque = new Audio(url);
    toque.loop = true;
    toque.volume = 0.7;
    void toque.play().catch(() => void 0);
  } catch {
    toque = null;
  }
}
function pararToque() {
  toque?.pause();
  toque = null;
}

// src/provider.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var Contexto = (0, import_react.createContext)(null);
function MakaChatProvider({ serviceKey, identity, getToken, storage, tema, contactos, notificacoesNativas = false, aoAbrirNotificacao, aoAbrirPartilha, children }) {
  const [features, setFeatures] = (0, import_react.useState)([]);
  const [ligado, setLigado] = (0, import_react.useState)(false);
  const visiveis = (0, import_react.useRef)(/* @__PURE__ */ new Map());
  const ouvintesTyping = (0, import_react.useRef)(/* @__PURE__ */ new Set());
  const ouvintesPresenca = (0, import_react.useRef)(/* @__PURE__ */ new Set());
  const ouvintesChamadas = (0, import_react.useRef)(/* @__PURE__ */ new Set());
  const ouvintesMensagens = (0, import_react.useRef)(/* @__PURE__ */ new Set());
  const notifAtivas = (0, import_react.useRef)(notificacoesNativas);
  notifAtivas.current = notificacoesNativas;
  const aoAbrirNotif = (0, import_react.useRef)(aoAbrirNotificacao);
  aoAbrirNotif.current = aoAbrirNotificacao;
  const valor = (0, import_react.useMemo)(() => {
    const api = new import_makachat_core.MakaApi(getToken);
    const adapter = storage ?? new import_makachat_core.MemoryStorage();
    let engine;
    const socket = new import_makachat_core.MakaSocket({
      obterToken: async () => {
        api.invalidarSessao();
        return api.sessao();
      },
      aoLigar: () => {
        setLigado(true);
        void engine.aoLigar();
      },
      aoDesligar: () => setLigado(false)
    });
    engine = new import_makachat_core.SyncEngine(adapter, api, socket, {
      identidade: identity,
      aoTyping: (typing) => ouvintesTyping.current.forEach((o) => o(typing)),
      aoPresenca: (presenca) => ouvintesPresenca.current.forEach((o) => o(presenca)),
      aoChamada: (evento) => ouvintesChamadas.current.forEach((o) => o(evento)),
      aoMensagem: (mensagem) => {
        ouvintesMensagens.current.forEach((o) => o(mensagem));
        if (!mensagem.silenciosa && (typeof document === "undefined" || !document.hidden)) tocarSom("recebida");
        if (!notifAtivas.current || typeof document === "undefined" || !document.hidden) return;
        void adapter.obterConversa(mensagem.conversa_id).then((conversa) => {
          const autor = conversa?.participantes.find((p) => p.identidade_id === mensagem.remetente_identidade_id);
          const previews = { foto: "\u{1F4F7} Foto", video: "\u{1F3AC} V\xEDdeo", audio: "\u{1F3A4} \xC1udio", ficheiro: "\u{1F4CE} Ficheiro", chamada: "\u{1F4DE} Chamada" };
          const corpo = mensagem.tipo === "texto" ? mensagem.conteudo ?? "" : previews[mensagem.tipo] ?? "Nova mensagem";
          const titulo = conversa?.tipo === "grupo" && conversa.titulo ? `${autor?.nome ?? "Algu\xE9m"} \xB7 ${conversa.titulo}` : autor?.nome ?? conversa?.titulo ?? "Nova mensagem";
          mostrarNotificacao(titulo, { corpo, icone: autor?.foto_url ?? void 0, tag: mensagem.conversa_id }, () => {
            aoAbrirNotif.current?.(mensagem.conversa_id);
          });
        });
      }
    });
    return {
      engine,
      api,
      socket,
      serviceKey,
      identidade: identity,
      features: [],
      subscreverTyping: (ouvinte) => {
        ouvintesTyping.current.add(ouvinte);
        return () => ouvintesTyping.current.delete(ouvinte);
      },
      subscreverPresenca: (ouvinte) => {
        ouvintesPresenca.current.add(ouvinte);
        return () => ouvintesPresenca.current.delete(ouvinte);
      },
      subscreverChamadas: (ouvinte) => {
        ouvintesChamadas.current.add(ouvinte);
        return () => ouvintesChamadas.current.delete(ouvinte);
      },
      subscreverMensagens: (ouvinte) => {
        ouvintesMensagens.current.add(ouvinte);
        return () => ouvintesMensagens.current.delete(ouvinte);
      },
      ligado: false,
      contactos: [],
      aoAbrirPartilha: void 0,
      registarVisivel: (conversaId) => {
        visiveis.current.set(conversaId, (visiveis.current.get(conversaId) ?? 0) + 1);
        return () => {
          const atual = (visiveis.current.get(conversaId) ?? 1) - 1;
          if (atual <= 0) {
            visiveis.current.delete(conversaId);
          } else {
            visiveis.current.set(conversaId, atual);
          }
        };
      },
      estaVisivel: (conversaId) => (visiveis.current.get(conversaId) ?? 0) > 0
    };
  }, [serviceKey, identity.id, identity.tipo]);
  (0, import_react.useEffect)(() => {
    void valor.engine.iniciar();
    void valor.api.listarFeatures().then((r) => setFeatures(r.features)).catch(() => void 0);
    return () => valor.socket.desligar();
  }, [valor]);
  (0, import_react.useEffect)(() => {
    if (typeof document === "undefined") return;
    const aoVisibilidade = () => {
      if (document.visibilityState !== "visible") return;
      if (valor.socket.ligado) {
        void valor.engine.aoLigar().catch(() => void 0);
      } else {
        valor.socket.garantirLigado();
      }
    };
    document.addEventListener("visibilitychange", aoVisibilidade);
    return () => document.removeEventListener("visibilitychange", aoVisibilidade);
  }, [valor]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Contexto.Provider, { value: { ...valor, features, ligado, contactos: contactos ?? [], aoAbrirPartilha }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "contents", ...cssVarsDoTema(tema) }, children }) });
}
function useMakaChat() {
  const contexto = (0, import_react.useContext)(Contexto);
  if (!contexto) {
    throw new Error("useMakaChat tem de ser usado dentro de <MakaChatProvider>");
  }
  return contexto;
}

// src/hooks.ts
var import_react2 = require("react");
function useLigacao() {
  return useMakaChat().ligado;
}
function useSemLigacao(atrasoMs = 4e3) {
  const ligado = useLigacao();
  const [mostrar, setMostrar] = (0, import_react2.useState)(false);
  (0, import_react2.useEffect)(() => {
    if (ligado) {
      setMostrar(false);
      return;
    }
    const t = setTimeout(() => setMostrar(true), atrasoMs);
    return () => clearTimeout(t);
  }, [ligado, atrasoMs]);
  return mostrar;
}
function useVersaoChat() {
  const { engine } = useMakaChat();
  const [versao, setVersao] = (0, import_react2.useState)(engine.versaoAtual);
  (0, import_react2.useEffect)(() => engine.subscrever(setVersao), [engine]);
  return versao;
}
function useConversas(arquivadas = false) {
  const { engine } = useMakaChat();
  const versao = useVersaoChat();
  const [conversas, setConversas] = (0, import_react2.useState)([]);
  (0, import_react2.useEffect)(() => {
    let ativo = true;
    void engine.storage.listarConversas(arquivadas).then((lista) => {
      if (ativo) setConversas(lista);
    });
    return () => {
      ativo = false;
    };
  }, [engine, arquivadas, versao]);
  return conversas;
}
function useMensagens(conversaId, limite = 50) {
  const { engine } = useMakaChat();
  const versao = useVersaoChat();
  const [mensagens, setMensagens] = (0, import_react2.useState)([]);
  (0, import_react2.useEffect)(() => {
    if (!conversaId) {
      setMensagens([]);
      return;
    }
    let ativo = true;
    void engine.storage.listarMensagens(conversaId, { limite }).then((lista) => {
      if (ativo) setMensagens(lista);
    });
    return () => {
      ativo = false;
    };
  }, [engine, conversaId, limite, versao]);
  return mensagens;
}
function useEnviarMensagem() {
  const { engine } = useMakaChat();
  return (0, import_react2.useCallback)(
    (dados, anexosPreview) => engine.enviarMensagem(dados, anexosPreview),
    [engine]
  );
}
function useTypingConversa(conversaId) {
  const { subscreverTyping } = useMakaChat();
  const [typing, setTyping] = (0, import_react2.useState)(null);
  (0, import_react2.useEffect)(() => {
    if (!conversaId) {
      return;
    }
    let temporizador = null;
    const cancelar = subscreverTyping((evento) => {
      if (evento.conversa_id !== conversaId) return;
      if (temporizador) clearTimeout(temporizador);
      if (evento.ativo) {
        setTyping(evento);
        temporizador = setTimeout(() => setTyping(null), 4e3);
      } else {
        setTyping(null);
      }
    });
    return () => {
      cancelar();
      if (temporizador) clearTimeout(temporizador);
    };
  }, [subscreverTyping, conversaId]);
  return typing;
}
function usePresenca(identidadeId) {
  const { subscreverPresenca } = useMakaChat();
  const [presenca, setPresenca] = (0, import_react2.useState)(null);
  (0, import_react2.useEffect)(() => {
    if (!identidadeId) {
      return;
    }
    return subscreverPresenca((evento) => {
      if (evento.identidade_id === identidadeId) {
        setPresenca(evento);
      }
    });
  }, [subscreverPresenca, identidadeId]);
  return presenca;
}
function useFuncionalidadeAtiva(funcionalidade, tipoConversa = "*") {
  const { features } = useMakaChat();
  const especifica = features.find((f) => f.funcionalidade === funcionalidade && f.tipo_conversa === tipoConversa);
  if (especifica) {
    return especifica.ativo;
  }
  return features.find((f) => f.funcionalidade === funcionalidade && f.tipo_conversa === "*")?.ativo ?? false;
}
function useMensagemRecebida(handler) {
  const { subscreverMensagens } = useMakaChat();
  const ref = (0, import_react2.useRef)(handler);
  ref.current = handler;
  (0, import_react2.useEffect)(() => subscreverMensagens((m) => ref.current(m)), [subscreverMensagens]);
}
function useTotalNaoLidas() {
  const { engine } = useMakaChat();
  const versao = useVersaoChat();
  const [total, setTotal] = (0, import_react2.useState)(0);
  (0, import_react2.useEffect)(() => {
    void engine.storage.listarConversas(false).then((conversas) => setTotal(conversas.reduce((soma, c) => soma + (c.participante?.mensagens_nao_lidas ?? 0), 0)));
  }, [engine, versao]);
  return total;
}

// src/ui.tsx
var import_react7 = require("@iconify/react");
var import_makachat_core2 = require("@hongayetu/makachat-core");
var import_react8 = require("react");

// src/audio.tsx
var import_react3 = require("@iconify/react");
var import_react4 = require("react");
var import_jsx_runtime2 = require("react/jsx-runtime");
var VELOCIDADES = [1, 1.5, 2];
var GANHO_ALVO = 0.12;
var ganhosCalculados = /* @__PURE__ */ new Map();
async function calcularGanho(url) {
  if (ganhosCalculados.has(url)) return ganhosCalculados.get(url) ?? null;
  let ganho = null;
  try {
    const dados = await (await fetch(url, { mode: "cors" })).arrayBuffer();
    const ctx = new OfflineAudioContext(1, 1, 44100);
    const buffer = await ctx.decodeAudioData(dados);
    const canal = buffer.getChannelData(0);
    const janela = Math.floor(buffer.sampleRate * 0.05);
    const ativas = [];
    for (let i = 0; i + janela <= canal.length; i += janela) {
      let soma = 0;
      for (let j = i; j < i + janela; j++) soma += canal[j] * canal[j];
      const rms = Math.sqrt(soma / janela);
      if (rms > 5e-3) ativas.push(rms);
    }
    if (ativas.length) {
      ativas.sort((a, b) => a - b);
      const mediana = ativas[Math.floor(ativas.length / 2)];
      ganho = Math.min(4, Math.max(1, GANHO_ALVO / mediana));
    }
  } catch {
    ganho = null;
  }
  ganhosCalculados.set(url, ganho);
  return ganho;
}
function ReprodutorAudio({ url }) {
  const audio = (0, import_react4.useRef)(null);
  const grafo = (0, import_react4.useRef)(null);
  const [aTocar, setATocar] = (0, import_react4.useState)(false);
  const [progresso, setProgresso] = (0, import_react4.useState)(0);
  const [duracao, setDuracao] = (0, import_react4.useState)(0);
  const [velocidade, setVelocidade] = (0, import_react4.useState)(1);
  (0, import_react4.useEffect)(() => {
    const el = new Audio(url);
    el.preload = "metadata";
    el.crossOrigin = "anonymous";
    audio.current = el;
    const aoTempo = () => setProgresso(el.currentTime);
    const aoDuracao = () => Number.isFinite(el.duration) && setDuracao(el.duration);
    const aoFim = () => setATocar(false);
    el.addEventListener("timeupdate", aoTempo);
    el.addEventListener("loadedmetadata", aoDuracao);
    el.addEventListener("durationchange", aoDuracao);
    el.addEventListener("ended", aoFim);
    return () => {
      el.pause();
      el.removeEventListener("timeupdate", aoTempo);
      el.removeEventListener("loadedmetadata", aoDuracao);
      el.removeEventListener("durationchange", aoDuracao);
      el.removeEventListener("ended", aoFim);
      void grafo.current?.ctx.close().catch(() => void 0);
    };
  }, [url]);
  const ligarGanho = () => {
    const el = audio.current;
    if (!el || grafo.current || typeof AudioContext === "undefined") return;
    try {
      const ctx = new AudioContext();
      const fonte = ctx.createMediaElementSource(el);
      const ganho = ctx.createGain();
      ganho.gain.value = 1.8;
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -40;
      compressor.knee.value = 30;
      compressor.ratio.value = 8;
      fonte.connect(ganho).connect(compressor).connect(ctx.destination);
      grafo.current = { ctx, ganho };
      void calcularGanho(url).then((calculado) => {
        if (calculado && grafo.current) grafo.current.ganho.gain.value = calculado;
      });
    } catch {
    }
  };
  const alternar = () => {
    const el = audio.current;
    if (!el) return;
    if (aTocar) {
      el.pause();
      setATocar(false);
    } else {
      ligarGanho();
      void grafo.current?.ctx.resume();
      el.playbackRate = velocidade;
      void el.play();
      setATocar(true);
    }
  };
  const mudarVelocidade = () => {
    const proxima = VELOCIDADES[(VELOCIDADES.indexOf(velocidade) + 1) % VELOCIDADES.length];
    setVelocidade(proxima);
    if (audio.current) audio.current.playbackRate = proxima;
  };
  const saltar = (e) => {
    const el = audio.current;
    if (!el || !duracao) return;
    const alvo = e.currentTarget.getBoundingClientRect();
    el.currentTime = (e.clientX - alvo.left) / alvo.width * duracao;
  };
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const pct = duracao ? progresso / duracao * 100 : 0;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex w-[240px] items-center gap-2 py-1", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "button",
      {
        onClick: alternar,
        className: "grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-black/15 text-inherit transition-transform hover:scale-105",
        children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react3.Icon, { icon: aTocar ? "tabler:player-pause-filled" : "tabler:player-play-filled", className: "text-lg" })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "min-w-0 flex-1", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "h-1.5 w-full cursor-pointer rounded-full bg-black/15", onClick: saltar, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "h-full rounded-full bg-current transition-[width]", style: { width: `${pct}%` } }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "mt-1 text-[10px] opacity-70", children: [
        fmt(progresso),
        duracao ? ` / ${fmt(duracao)}` : ""
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "button",
      {
        onClick: mudarVelocidade,
        className: "shrink-0 cursor-pointer rounded-full border-0 bg-black/15 px-2 py-0.5 text-[11px] font-bold text-inherit",
        children: [
          velocidade,
          "x"
        ]
      }
    )
  ] });
}

// src/chamadas.tsx
var import_react5 = require("@iconify/react");
var import_livekit_client = require("livekit-client");
var import_react6 = require("react");
var import_jsx_runtime3 = require("react/jsx-runtime");
var Ctx = (0, import_react6.createContext)(null);
function useChamadasOpcional() {
  return (0, import_react6.useContext)(Ctx);
}
function useChamadas() {
  const ctx = (0, import_react6.useContext)(Ctx);
  if (!ctx) throw new Error("useChamadas requer <ChamadasProvider>");
  return ctx;
}
function ChamadasProvider({ children }) {
  const { api, engine, subscreverChamadas } = useMakaChat();
  const [ativa, setAtiva] = (0, import_react6.useState)(null);
  const [conversa, setConversa] = (0, import_react6.useState)(null);
  const [modo, setModo] = (0, import_react6.useState)("janela");
  const [inicioEm, setInicioEm] = (0, import_react6.useState)(null);
  const [erro, setErro] = (0, import_react6.useState)(null);
  const [mudo, setMudo] = (0, import_react6.useState)(false);
  const [camara, setCamara] = (0, import_react6.useState)(false);
  const [ecra, setEcra] = (0, import_react6.useState)(false);
  const [pos, setPos] = (0, import_react6.useState)({ x: 24, y: 24 });
  const room = (0, import_react6.useRef)(null);
  const conversaRef = (0, import_react6.useRef)(null);
  const desligarRef = (0, import_react6.useRef)(async () => void 0);
  const sozinhoTimer = (0, import_react6.useRef)(null);
  const midia = (0, import_react6.useRef)(null);
  const elementos = (0, import_react6.useRef)(/* @__PURE__ */ new Map());
  const [videoRemotoVivo, setVideoRemotoVivo] = (0, import_react6.useState)(false);
  const [remotoPausado, setRemotoPausado] = (0, import_react6.useState)(false);
  const falhada = (0, import_react6.useRef)(false);
  const faseRef = (0, import_react6.useRef)(null);
  const atendendoRef = (0, import_react6.useRef)(null);
  const [erroSolto, setErroSolto] = (0, import_react6.useState)(null);
  const arrasto = (0, import_react6.useRef)({ ativo: false, dx: 0, dy: 0 });
  const limpar = (0, import_react6.useCallback)(() => {
    if (sozinhoTimer.current) {
      clearTimeout(sozinhoTimer.current);
      sozinhoTimer.current = null;
    }
    void room.current?.disconnect();
    room.current = null;
    falhada.current = false;
    atendendoRef.current = null;
    elementos.current.clear();
    setAtiva(null);
    setConversa(null);
    setModo("janela");
    setInicioEm(null);
    setErro(null);
    setMudo(false);
    setCamara(false);
    setEcra(false);
    setVideoRemotoVivo(false);
    setRemotoPausado(false);
  }, []);
  (0, import_react6.useEffect)(() => {
    faseRef.current = ativa?.fase ?? null;
    if (ativa?.fase === "a_ligar") comecarToque("ligar");
    else if (ativa?.fase === "a_receber") comecarToque("receber");
    else pararToque();
    return pararToque;
  }, [ativa?.fase]);
  const comecarTimer = (0, import_react6.useCallback)(() => {
    setInicioEm((atual) => atual ?? Date.now());
  }, []);
  const carregarConversa = (0, import_react6.useCallback)(
    async (conversaId) => {
      const local = await engine.storage.obterConversa(conversaId);
      setConversa(local);
      if (local) return;
      const remota = await api.obterConversa(conversaId).catch(() => null);
      if (remota?.conversa) setConversa(remota.conversa);
    },
    [engine, api]
  );
  const anexarTodos = (0, import_react6.useCallback)(() => {
    const alvo = midia.current;
    if (!alvo) return;
    const infos = [...elementos.current.values()];
    const porParticipante = /* @__PURE__ */ new Map();
    for (const info of infos) {
      if (!info.video) continue;
      const lista = porParticipante.get(info.participante) ?? [];
      lista.push(info);
      porParticipante.set(info.participante, lista);
    }
    const visiveis = /* @__PURE__ */ new Set();
    let remotoVivo = false;
    let pausado = false;
    for (const lista of porParticipante.values()) {
      const vivo = lista.find((i) => i.ecra && !i.pub?.isMuted) ?? lista.find((i) => !i.ecra && !i.pub?.isMuted);
      if (vivo) {
        visiveis.add(vivo.el);
        if (!vivo.local) remotoVivo = true;
      } else if (lista.some((i) => !i.local)) {
        pausado = true;
      }
    }
    for (const info of infos) {
      if (!info.video || visiveis.has(info.el)) {
        if (info.el.parentElement !== alvo) alvo.appendChild(info.el);
      } else {
        info.el.remove();
      }
    }
    setVideoRemotoVivo(remotoVivo);
    setRemotoPausado(pausado);
  }, []);
  const verificarMedia = (0, import_react6.useCallback)(async (video) => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return "O browser bloqueou a c\xE2mara/microfone \u2014 esta p\xE1gina precisa de HTTPS.";
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
      stream.getTracks().forEach((tr) => tr.stop());
      return null;
    } catch {
      return video ? "Sem acesso \xE0 c\xE2mara/microfone \u2014 permite o acesso nas defini\xE7\xF5es do browser." : "Sem acesso ao microfone \u2014 permite o acesso nas defini\xE7\xF5es do browser.";
    }
  }, []);
  const ligarSala = (0, import_react6.useCallback)(async (token, wsUrl, video) => {
    const r = new import_livekit_client.Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: { resolution: import_livekit_client.VideoPresets.h720.resolution },
      reconnectPolicy: {
        nextRetryDelayInMs: (contexto) => contexto.elapsedMs > 9e4 ? null : Math.min(500 * 2 ** contexto.retryCount, 1e4)
      }
    });
    room.current = r;
    elementos.current.clear();
    r.on(import_livekit_client.RoomEvent.TrackSubscribed, (track, pub, participante) => {
      const el = track.attach();
      if (track.kind === import_livekit_client.Track.Kind.Video) el.className = "maka-video-remoto";
      elementos.current.set(track.sid ?? String(elementos.current.size), {
        el,
        video: track.kind === import_livekit_client.Track.Kind.Video,
        ecra: track.source === import_livekit_client.Track.Source.ScreenShare,
        local: false,
        participante: participante?.identity ?? "?",
        pub
      });
      anexarTodos();
    });
    r.on(import_livekit_client.RoomEvent.TrackUnsubscribed, (track) => {
      track.detach().forEach((e) => e.remove());
      if (track.sid) elementos.current.delete(track.sid);
      anexarTodos();
    });
    r.on(import_livekit_client.RoomEvent.LocalTrackPublished, (pub) => {
      if (pub.track && pub.kind === import_livekit_client.Track.Kind.Video) {
        const el = pub.track.attach();
        el.className = "maka-video-local";
        elementos.current.set(pub.trackSid ?? `local_${elementos.current.size}`, {
          el,
          video: true,
          ecra: pub.source === import_livekit_client.Track.Source.ScreenShare,
          local: true,
          participante: "local",
          pub
        });
        anexarTodos();
      }
    });
    r.on(import_livekit_client.RoomEvent.LocalTrackUnpublished, (pub) => {
      pub.track?.detach().forEach((e) => e.remove());
      if (pub.trackSid) elementos.current.delete(pub.trackSid);
      anexarTodos();
    });
    r.on(import_livekit_client.RoomEvent.TrackMuted, anexarTodos);
    r.on(import_livekit_client.RoomEvent.TrackUnmuted, anexarTodos);
    const verificarSozinho = () => {
      if (conversaRef.current?.tipo === "grupo" || faseRef.current !== "em_curso") return;
      if (r.remoteParticipants.size === 0) {
        if (!sozinhoTimer.current) {
          sozinhoTimer.current = setTimeout(() => {
            sozinhoTimer.current = null;
            if (faseRef.current === "em_curso") void desligarRef.current();
          }, 15e3);
        }
      } else if (sozinhoTimer.current) {
        clearTimeout(sozinhoTimer.current);
        sozinhoTimer.current = null;
      }
    };
    r.on(import_livekit_client.RoomEvent.ParticipantConnected, verificarSozinho);
    r.on(import_livekit_client.RoomEvent.ParticipantDisconnected, verificarSozinho);
    try {
      await r.connect(wsUrl, token);
    } catch (e) {
      const detalhe = e instanceof Error && e.message ? ` (${e.message})` : "";
      setErro(`N\xE3o foi poss\xEDvel ligar ao servidor de chamadas${detalhe}.`);
      console.error("[makachat] liga\xE7\xE3o LiveKit falhou:", wsUrl, e);
      return false;
    }
    void r.startAudio().catch(() => void 0);
    try {
      await r.localParticipant.setMicrophoneEnabled(true);
      if (video) {
        await r.localParticipant.setCameraEnabled(true);
        setCamara(true);
      }
    } catch (e) {
      setErro(video ? "Sem acesso \xE0 c\xE2mara/microfone." : "Sem acesso ao microfone.");
      console.error("[makachat] media falhou:", e);
      return false;
    }
    verificarSozinho();
    return true;
  }, []);
  (0, import_react6.useEffect)(
    () => subscreverChamadas((evento) => {
      if (evento.evento === "iniciada") {
        void engine.minhaIdentidadeId(evento.chamada.conversa_id).then((minha) => {
          if (minha && evento.chamada.iniciador_identidade_id === minha) return;
          if (typeof document !== "undefined" && document.hidden) {
            mostrarNotificacao(
              `${evento.iniciador?.nome ?? "Algu\xE9m"} est\xE1 a ligar`,
              { corpo: evento.chamada.tipo === "video" ? "Chamada de v\xEDdeo" : "Chamada de \xE1udio", icone: evento.iniciador?.foto_url ?? void 0, tag: `chamada_${evento.chamada.id}` }
            );
          }
          setAtiva({ chamada: evento.chamada, fase: "a_receber", iniciador: evento.iniciador });
          void carregarConversa(evento.chamada.conversa_id);
        });
      } else if (evento.evento === "atendida") {
        if (faseRef.current === "a_ligar" || faseRef.current === "em_curso") {
          setAtiva((a) => a ? { ...a, fase: "em_curso", chamada: evento.chamada } : a);
          comecarTimer();
        } else if (faseRef.current === "a_receber" && atendendoRef.current !== evento.chamada.id) {
          void engine.storage.obterConversa(evento.chamada.conversa_id).then((c) => {
            if (c?.tipo !== "grupo" && faseRef.current === "a_receber" && atendendoRef.current !== evento.chamada.id) limpar();
          });
        }
      } else if (evento.evento === "participante_saiu") {
      } else if (!falhada.current) {
        limpar();
      }
    }),
    [subscreverChamadas, engine, limpar, comecarTimer, carregarConversa]
  );
  const iniciar = (0, import_react6.useCallback)(
    async (conversaId, tipo) => {
      const problema = await verificarMedia(tipo === "video");
      if (problema) {
        setErroSolto(problema);
        setTimeout(() => setErroSolto(null), 6e3);
        return;
      }
      const r = await api.iniciarChamada(conversaId, tipo);
      setAtiva({ chamada: r.chamada, fase: "a_ligar" });
      void carregarConversa(conversaId);
      if (r.livekit_token && r.ws_url) {
        const ok = await ligarSala(r.livekit_token, r.ws_url, tipo === "video");
        if (!ok) {
          falhada.current = true;
          await api.terminarChamada(r.chamada.id).catch(() => void 0);
          setAtiva((a) => a ? { ...a, fase: "falhada" } : a);
        }
      }
    },
    [api, ligarSala, verificarMedia, carregarConversa]
  );
  const entrar = (0, import_react6.useCallback)(
    async (chamadaId, tipo) => {
      const problema = await verificarMedia(tipo === "video");
      if (problema) {
        setErroSolto(problema);
        setTimeout(() => setErroSolto(null), 6e3);
        return;
      }
      atendendoRef.current = chamadaId;
      const r = await api.atenderChamada(chamadaId);
      setAtiva({ chamada: r.chamada, fase: "em_curso" });
      void carregarConversa(r.chamada.conversa_id);
      if (r.livekit_token && r.ws_url) {
        const ok = await ligarSala(r.livekit_token, r.ws_url, tipo === "video");
        if (atendendoRef.current !== chamadaId) {
          void room.current?.disconnect();
          room.current = null;
          return;
        }
        if (!ok) {
          falhada.current = true;
          await api.terminarChamada(chamadaId).catch(() => void 0);
          setAtiva((a) => a ? { ...a, fase: "falhada" } : a);
          return;
        }
      }
      comecarTimer();
    },
    [api, ligarSala, verificarMedia, comecarTimer, carregarConversa]
  );
  const atender = async () => {
    if (!ativa) return;
    const problema = await verificarMedia(ativa.chamada.tipo === "video");
    if (problema) {
      falhada.current = true;
      setErro(problema);
      setAtiva({ ...ativa, fase: "falhada" });
      await api.rejeitarChamada(ativa.chamada.id).catch(() => void 0);
      return;
    }
    atendendoRef.current = ativa.chamada.id;
    const r = await api.atenderChamada(ativa.chamada.id);
    setAtiva({ ...ativa, fase: "em_curso", chamada: r.chamada });
    if (r.livekit_token && r.ws_url) {
      const ok = await ligarSala(r.livekit_token, r.ws_url, ativa.chamada.tipo === "video");
      if (atendendoRef.current !== ativa.chamada.id) {
        void room.current?.disconnect();
        room.current = null;
        return;
      }
      if (!ok) {
        falhada.current = true;
        await api.terminarChamada(ativa.chamada.id).catch(() => void 0);
        setAtiva({ ...ativa, fase: "falhada" });
        return;
      }
    }
    comecarTimer();
  };
  const desligar = async () => {
    if (ativa && ativa.fase !== "falhada") {
      await (ativa.fase === "a_receber" ? api.rejeitarChamada(ativa.chamada.id) : api.terminarChamada(ativa.chamada.id)).catch(() => void 0);
    }
    limpar();
  };
  conversaRef.current = conversa;
  desligarRef.current = desligar;
  (0, import_react6.useEffect)(() => {
    anexarTodos();
  }, [anexarTodos, modo, ativa?.fase]);
  const aoPegar = (e) => {
    arrasto.current = { ativo: true, dx: e.clientX + pos.x, dy: e.clientY - pos.y };
    e.target.setPointerCapture(e.pointerId);
  };
  const aoMover = (e) => {
    if (!arrasto.current.ativo) return;
    setPos({
      x: Math.max(0, arrasto.current.dx - e.clientX),
      y: Math.max(0, e.clientY - arrasto.current.dy)
    });
  };
  const aoLargar = () => {
    arrasto.current.ativo = false;
  };
  const titulo = ativa?.fase === "a_receber" ? ativa.iniciador?.nome ?? conversa?.titulo ?? "Algu\xE9m" : conversa?.titulo ?? "Chamada";
  const foto = ativa?.fase === "a_receber" ? ativa.iniciador?.foto_url ?? null : conversa?.foto_url ?? null;
  const subtitulo = ativa?.fase === "em_curso" && inicioEm ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Duracao, { desde: inicioEm }) : ativa?.fase === "falhada" ? "Chamada falhada" : ativa?.fase === "a_ligar" ? "A chamar\u2026" : `Chamada de ${ativa?.chamada.tipo === "video" ? "v\xEDdeo" : "\xE1udio"}`;
  const B = (p) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "button",
    {
      title: p.titulo,
      onClick: p.onClick,
      className: `grid h-11 w-11 cursor-pointer place-items-center rounded-full border-0 text-lg text-white shadow-lg transition-transform hover:scale-105 active:scale-95 ${p.classe ?? "bg-white/15 hover:bg-white/25"}`,
      children: p.children
    }
  );
  const valorCtx = (0, import_react6.useMemo)(() => ({ iniciar, entrar, ativa }), [iniciar, entrar, ativa]);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(Ctx.Provider, { value: valorCtx, children: [
    children,
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("style", { children: `
                .maka-video-remoto { flex: 1 1 0%; min-width: 0; width: 100%; height: 100%; object-fit: contain; border-radius: 12px; }
                .maka-video-local { position: absolute; right: 10px; bottom: 10px; width: 28%; border-radius: 10px; box-shadow: 0 4px 14px rgba(0,0,0,.4); z-index: 1; }
            ` }),
    erroSolto && !ativa && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "fixed bottom-6 left-6 z-[9999] animate-maka-subir rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-2xl ring-1 ring-red-500/50", children: erroSolto }),
    ativa && modo === "pill" && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      "button",
      {
        onClick: () => setModo("janela"),
        className: "fixed bottom-6 left-6 z-[9999] flex animate-maka-subir cursor-pointer items-center gap-2.5 rounded-full border-0 bg-slate-900 py-2 pl-2 pr-4 text-white shadow-2xl",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(AvatarWeb, { nome: titulo, url: foto, tamanho: 30 }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "text-sm font-semibold", children: subtitulo }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_react5.Icon, { icon: "tabler:arrows-maximize", className: "text-white/70" })
        ]
      }
    ),
    ativa && modo !== "pill" && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      "div",
      {
        className: `z-[9999] flex flex-col overflow-hidden bg-slate-900 text-white shadow-2xl ring-1 ring-white/10 ${modo === "cheio" ? "fixed inset-0" : "fixed w-[420px] max-w-[94vw] animate-maka-subir rounded-2xl"}`,
        style: modo === "cheio" ? void 0 : { right: pos.x, bottom: pos.y },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
            "div",
            {
              className: `flex items-center gap-2.5 px-3 py-2.5 ${modo === "janela" ? "cursor-move touch-none select-none" : ""}`,
              onPointerDown: modo === "janela" ? aoPegar : void 0,
              onPointerMove: modo === "janela" ? aoMover : void 0,
              onPointerUp: modo === "janela" ? aoLargar : void 0,
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(AvatarWeb, { nome: titulo, url: foto, tamanho: 30 }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "min-w-0 flex-1", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "block truncate text-sm font-bold", children: titulo }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "block text-xs text-white/60", children: subtitulo })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { title: modo === "cheio" ? "Restaurar" : "Ecr\xE3 inteiro", onClick: () => setModo(modo === "cheio" ? "janela" : "cheio"), className: "grid h-8 w-8 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-white/70 hover:bg-white/10", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_react5.Icon, { icon: modo === "cheio" ? "tabler:arrows-minimize" : "tabler:arrows-maximize" }) }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { title: "Minimizar", onClick: () => setModo("pill"), className: "grid h-8 w-8 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-white/70 hover:bg-white/10", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_react5.Icon, { icon: "tabler:minus" }) })
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: `relative flex items-center justify-center bg-black/40 ${modo === "cheio" ? "flex-1" : "h-[300px]"}`, children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { ref: midia, className: "absolute inset-0 flex items-center justify-center gap-2 p-2" }),
            (ativa.chamada.tipo === "audio" || ativa.fase !== "em_curso" || !videoRemotoVivo) && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: `z-[1] flex flex-col items-center gap-3 ${ativa.fase !== "em_curso" ? "animate-maka-pulsar" : ""}`, children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(AvatarWeb, { nome: titulo, url: foto, tamanho: modo === "cheio" ? 110 : 76 }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "text-sm text-white/70", children: subtitulo }),
              ativa.fase === "em_curso" && remotoPausado && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/75", children: "C\xE2mara em pausa" })
            ] }),
            erro && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "absolute inset-x-3 bottom-3 z-[2] rounded-xl bg-red-500/90 px-3 py-2 text-center text-xs font-semibold text-white", children: erro })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "flex items-center justify-center gap-3 px-4 py-3.5", children: ativa.fase === "falhada" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(B, { titulo: "Fechar", onClick: () => void desligar(), classe: "bg-white/15 hover:bg-white/25", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_react5.Icon, { icon: "tabler:x" }) }) : ativa.fase === "a_receber" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(B, { titulo: "Atender", onClick: () => void atender(), classe: "animate-maka-pulsar bg-emerald-500 hover:bg-emerald-400", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_react5.Icon, { icon: "tabler:phone" }) }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(B, { titulo: "Rejeitar", onClick: () => void desligar(), classe: "bg-red-600 hover:bg-red-500", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_react5.Icon, { icon: "tabler:phone-off" }) })
          ] }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(B, { titulo: mudo ? "Ativar micro" : "Silenciar", onClick: () => {
              const m = !mudo;
              setMudo(m);
              void room.current?.localParticipant.setMicrophoneEnabled(!m);
            }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_react5.Icon, { icon: mudo ? "tabler:microphone-off" : "tabler:microphone" }) }),
            ativa.chamada.tipo === "video" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(B, { titulo: "C\xE2mara", onClick: () => {
              const c = !camara;
              setCamara(c);
              void room.current?.localParticipant.setCameraEnabled(c);
            }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_react5.Icon, { icon: camara ? "tabler:video" : "tabler:video-off" }) }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(B, { titulo: "Partilhar ecr\xE3", onClick: () => {
              const e = !ecra;
              setEcra(e);
              void room.current?.localParticipant.setScreenShareEnabled(e);
            }, classe: ecra ? "bg-[var(--maka-primaria)]" : void 0, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_react5.Icon, { icon: "tabler:screen-share" }) }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(B, { titulo: "Desligar", onClick: () => void desligar(), classe: "bg-red-600 hover:bg-red-500", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_react5.Icon, { icon: "tabler:phone-off" }) })
          ] }) })
        ]
      }
    )
  ] });
}
function Duracao({ desde }) {
  const [, forcar] = (0, import_react6.useState)(0);
  (0, import_react6.useEffect)(() => {
    const timer = setInterval(() => forcar((n) => n + 1), 1e3);
    return () => clearInterval(timer);
  }, []);
  const segundos = Math.max(0, Math.floor((Date.now() - desde) / 1e3));
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
    String(Math.floor(segundos / 60)).padStart(2, "0"),
    ":",
    String(segundos % 60).padStart(2, "0")
  ] });
}

// src/ui.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
var EMOJIS = ["\u{1F44D}", "\u2764\uFE0F", "\u{1F602}", "\u{1F62E}", "\u{1F622}", "\u{1F64F}"];
function contraparteDe(c, identidade) {
  if (c.tipo !== "privada") return null;
  return c.participantes.find((p) => !(p.id_externo === identidade.id && p.tipo === identidade.tipo)) ?? null;
}
function NomeComBadge({ nome, metadados, className = "" }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: `inline-flex min-w-0 items-center gap-1 ${className}`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "min-w-0 truncate", children: nome }),
    metadados?.verificado === true && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:rosette-discount-check-filled", className: "shrink-0 text-[1.05em] text-[var(--maka-primaria)]" })
  ] });
}
function CartaoPartilha({ mensagem, minha, aoAbrir }) {
  const meta = mensagem.metadados ?? {};
  const abrir = () => {
    if (aoAbrir) return aoAbrir(meta);
    if (typeof meta.url === "string") window.open(meta.url, "_blank", "noopener");
  };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
    "button",
    {
      onClick: abrir,
      className: `flex w-[260px] cursor-pointer items-stretch gap-0 overflow-hidden rounded-xl border-0 p-0 text-left text-inherit transition-transform hover:scale-[1.01] ${minha ? "bg-white/15" : "bg-black/5"}`,
      children: [
        typeof meta.imagem_url === "string" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("img", { src: meta.imagem_url, alt: "", className: "h-[72px] w-[72px] shrink-0 object-cover" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "flex min-w-0 flex-col justify-center gap-0.5 px-3 py-2", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "truncate text-sm font-bold", children: String(meta.titulo ?? meta.url ?? "Partilha") }),
          typeof meta.subtitulo === "string" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "truncate text-xs opacity-75", children: meta.subtitulo }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "flex items-center gap-1 text-[10px] opacity-60", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: mensagem.tipo === "link" ? "tabler:link" : "tabler:external-link" }),
            String(meta.contexto_tipo ?? "liga\xE7\xE3o")
          ] })
        ] })
      ]
    }
  );
}
function direcaoMenu(e, alturaEstimada = 220) {
  const r = e.currentTarget.getBoundingClientRect();
  return r.bottom + alturaEstimada > window.innerHeight && r.top > alturaEstimada ? "cima" : "baixo";
}
function useFecharFora(ativo, chave, fechar) {
  (0, import_react8.useEffect)(() => {
    if (!ativo) return;
    const aoMousedown = (e) => {
      if (!e.target?.closest?.(`[data-maka-pop="${chave}"]`)) fechar();
    };
    document.addEventListener("mousedown", aoMousedown);
    return () => document.removeEventListener("mousedown", aoMousedown);
  }, [ativo, chave, fechar]);
}
function MakaChatConversas({ arquivadas = false, conversaAtivaId, onAbrirConversa }) {
  const { engine, api, contactos, identidade } = useMakaChat();
  const podeGrupos = useFuncionalidadeAtiva("grupos");
  const podeEliminarConversa = useFuncionalidadeAtiva("conversas.eliminar");
  const podeCriarConversa = useFuncionalidadeAtiva("conversas.criar");
  const versao = useVersaoChat();
  const [verArquivadas, setVerArquivadas] = (0, import_react8.useState)(arquivadas);
  const [conversas, setConversas] = (0, import_react8.useState)([]);
  const [menuDe, setMenuDe] = (0, import_react8.useState)(null);
  const [busca, setBusca] = (0, import_react8.useState)("");
  const [criarGrupo, setCriarGrupo] = (0, import_react8.useState)(false);
  const [confirmarEliminar, setConfirmarEliminar] = (0, import_react8.useState)(null);
  const [menuDirecao, setMenuDirecao] = (0, import_react8.useState)("baixo");
  const [resultadosServidor, setResultadosServidor] = (0, import_react8.useState)(null);
  const [proximoCursor, setProximoCursor] = (0, import_react8.useState)(null);
  const [aCarregar, setACarregar] = (0, import_react8.useState)(true);
  const aPaginar = (0, import_react8.useRef)(false);
  (0, import_react8.useEffect)(() => {
    void engine.storage.listarConversas(verArquivadas).then(setConversas);
  }, [engine, verArquivadas, versao]);
  (0, import_react8.useEffect)(() => {
    let ativo = true;
    void engine.atualizarConversas().catch(() => void 0).finally(() => {
      if (ativo) setACarregar(false);
    });
    return () => {
      ativo = false;
    };
  }, [engine]);
  (0, import_react8.useEffect)(() => {
    const q = busca.trim();
    if (!q) {
      setResultadosServidor(null);
      return;
    }
    const temporizador = setTimeout(() => {
      void api.listarConversas({ q, arquivadas: verArquivadas, limite: 30 }).then(async (r) => {
        setResultadosServidor(r.conversas);
        await engine.storage.upsertConversas(r.conversas);
      }).catch(() => setResultadosServidor(null));
    }, 300);
    return () => clearTimeout(temporizador);
  }, [api, engine, busca, verArquivadas]);
  const aoScrollLista = async (e) => {
    const el = e.currentTarget;
    if (busca.trim() || aPaginar.current) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight > 120) return;
    const ultima = conversas.at(-1);
    if (!ultima || proximoCursor === "fim") return;
    aPaginar.current = true;
    try {
      const r = await api.listarConversas({
        arquivadas: verArquivadas,
        cursor: String(ultima.ultima_atividade_em),
        limite: 30
      });
      if (r.conversas.length) {
        await engine.storage.upsertConversas(r.conversas);
      } else {
        setProximoCursor("fim");
      }
    } finally {
      aPaginar.current = false;
    }
  };
  useFecharFora(menuDe !== null, "menu-lista", () => setMenuDe(null));
  const preferencia = async (c, dados) => {
    setMenuDe(null);
    await api.atualizarPreferencias(c.id, dados).catch(() => void 0);
    await engine.atualizarConversas();
    if (dados.arquivada !== void 0) setConversas((atuais) => atuais.filter((x) => x.id !== c.id));
  };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex h-full flex-col bg-[var(--maka-superficie)]", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex items-center gap-1 px-4 pt-2.5 pb-0.5", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "flex-1 text-[15px] font-bold text-[var(--maka-texto)]", children: verArquivadas ? "Arquivadas" : "Conversas" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BotaoIcone, { titulo: verArquivadas ? "Voltar \xE0s conversas" : "Arquivadas", onClick: () => setVerArquivadas(!verArquivadas), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: verArquivadas ? "tabler:arrow-left" : "tabler:archive" }) }),
      podeCriarConversa && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BotaoIcone, { titulo: "Nova conversa", onClick: () => setCriarGrupo(true), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:message-plus" }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "px-3 pb-2 pt-2", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex items-center gap-2 rounded-full bg-[var(--maka-fundo)] px-3.5 py-2", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:search", className: "shrink-0 text-[var(--maka-texto-suave)]" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "input",
        {
          className: "w-full border-0 bg-transparent text-sm text-[var(--maka-texto)] outline-none placeholder:text-[var(--maka-texto-suave)]",
          placeholder: "Pesquisar conversas",
          value: busca,
          onChange: (e) => setBusca(e.target.value)
        }
      ),
      busca && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { onClick: () => setBusca(""), className: "grid cursor-pointer place-items-center border-0 bg-transparent p-0 text-[var(--maka-texto-suave)]", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:x", className: "text-sm" }) })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "maka-scroll min-h-0 flex-1 overflow-y-auto", onScroll: (e) => void aoScrollLista(e), children: [
      conversas.length === 0 && (aCarregar ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex flex-col items-center gap-2 pt-16 text-[var(--maka-texto-suave)]", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:loader-2", className: "animate-spin text-3xl text-[var(--maka-primaria)]" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "text-sm", children: "A carregar conversas\u2026" })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex flex-col items-center gap-2 pt-16 text-[var(--maka-texto-suave)]", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:message-circle", className: "text-4xl opacity-40" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "text-sm", children: "Sem conversas" })
      ] })),
      (busca.trim() && resultadosServidor ? resultadosServidor : conversas.filter((c) => !busca.trim() || (c.titulo ?? "").toLowerCase().includes(busca.trim().toLowerCase()))).map((c) => {
        const ativa = c.id === conversaAtivaId;
        const naoLidas = c.participante?.mensagens_nao_lidas ?? 0;
        return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "group relative px-2 py-0.5", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
            "button",
            {
              onClick: () => onAbrirConversa(c),
              className: `flex w-full cursor-pointer items-center gap-3 rounded-xl border-0 px-3 py-2.5 text-left transition-colors ${ativa ? "bg-[color-mix(in_srgb,var(--maka-primaria)_10%,transparent)]" : "bg-transparent hover:bg-black/[.04]"}`,
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(AvatarWeb, { nome: c.titulo ?? "?", url: c.foto_url, grupo: c.tipo === "grupo" }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "min-w-0 flex-1", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: `block truncate text-sm text-[var(--maka-texto)] ${naoLidas ? "font-bold" : "font-semibold"}`, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(NomeComBadge, { nome: c.titulo ?? "Conversa", metadados: contraparteDe(c, identidade)?.metadados }) }),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: `block truncate text-[13px] ${naoLidas ? "font-medium text-[var(--maka-texto)]" : "text-[var(--maka-texto-suave)]"}`, children: previewConversa(c) })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "flex flex-col items-end gap-1", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "text-[11px] text-[var(--maka-texto-suave)]", children: horaCurtaWeb(c.ultima_atividade_em) }),
                  naoLidas > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "rounded-full bg-[var(--maka-primaria)] px-2 py-px text-[11px] font-bold text-[var(--maka-primaria-contraste)]", children: naoLidas }),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "flex items-center gap-1", children: [
                    c.chamada_ativa && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:phone-filled", className: "animate-maka-pulsar text-[13px] text-emerald-500" }),
                    c.participante?.silenciada_ate && new Date(c.participante.silenciada_ate) > /* @__PURE__ */ new Date() && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:bell-off", className: "text-[13px] text-[var(--maka-texto-suave)]" }),
                    c.participante?.fixada && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:pin-filled", className: "text-[13px] text-[var(--maka-texto-suave)]" })
                  ] })
                ] })
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "button",
            {
              "data-maka-pop": "menu-lista",
              onClick: (e) => {
                setMenuDirecao(direcaoMenu(e));
                setMenuDe(menuDe === c.id ? null : c.id);
              },
              className: "absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-0 bg-[var(--maka-superficie)] text-[var(--maka-texto-suave)] opacity-0 shadow ring-1 ring-black/[.05] transition-opacity group-hover:opacity-100",
              title: "Op\xE7\xF5es",
              children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:chevron-down" })
            }
          ),
          menuDe === c.id && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { "data-maka-pop": "menu-lista", className: `absolute right-3 ${menuDirecao === "cima" ? "bottom-12" : "top-12"} z-[6] min-w-[190px] animate-maka-subir overflow-hidden rounded-xl bg-[var(--maka-superficie)] shadow-maka-pop ring-1 ring-black/[.05]`, children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(ItemMenu, { onClick: () => {
              setMenuDe(null);
              void engine.marcarNaoLida(c.id).catch(() => void 0);
            }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:mail-opened", className: "inline align-[-2px]" }),
              " Marcar como n\xE3o lida"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(ItemMenu, { onClick: () => void preferencia(c, { fixada: !c.participante?.fixada }), children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: c.participante?.fixada ? "tabler:pinned-off" : "tabler:pin", className: "inline align-[-2px]" }),
              " ",
              c.participante?.fixada ? "Desafixar" : "Fixar"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(ItemMenu, { onClick: () => {
              setMenuDe(null);
              const silenciada = !!c.participante?.silenciada_ate && new Date(c.participante.silenciada_ate) > /* @__PURE__ */ new Date();
              void engine.silenciarConversa(c.id, silenciada ? null : "9999-12-31T00:00:00.000Z");
            }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: c.participante?.silenciada_ate && new Date(c.participante.silenciada_ate) > /* @__PURE__ */ new Date() ? "tabler:bell" : "tabler:bell-off", className: "inline align-[-2px]" }),
              " ",
              c.participante?.silenciada_ate && new Date(c.participante.silenciada_ate) > /* @__PURE__ */ new Date() ? "Reativar notifica\xE7\xF5es" : "Silenciar"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(ItemMenu, { onClick: () => void preferencia(c, { arquivada: !verArquivadas }), children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: verArquivadas ? "tabler:archive-off" : "tabler:archive", className: "inline align-[-2px]" }),
              " ",
              verArquivadas ? "Desarquivar" : "Arquivar"
            ] }),
            podeEliminarConversa && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(ItemMenu, { onClick: () => {
              setMenuDe(null);
              setConfirmarEliminar(c);
            }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:trash", className: "inline align-[-2px]" }),
              " Eliminar conversa"
            ] })
          ] })
        ] }, c.id);
      })
    ] }),
    criarGrupo && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      NovaConversaModal,
      {
        conversas,
        contactos,
        podeGrupos,
        aoFechar: () => setCriarGrupo(false),
        aoCriada: (c) => {
          setCriarGrupo(false);
          onAbrirConversa(c);
        }
      }
    ),
    confirmarEliminar && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      ConfirmarDialogo,
      {
        titulo: "Eliminar conversa?",
        descricao: "O hist\xF3rico desaparece para ti. A outra pessoa mant\xE9m a conversa dela.",
        aoFechar: () => setConfirmarEliminar(null),
        botoes: [{ rotulo: "Eliminar conversa", destrutivo: true, acao: () => void engine.eliminarConversa(confirmarEliminar.id) }]
      }
    )
  ] });
}
function pessoasConhecidas(conversas, contactos, excluir = /* @__PURE__ */ new Set()) {
  const mapa = /* @__PURE__ */ new Map();
  for (const c of contactos) mapa.set(`${c.tipo}:${c.id_externo}`, c);
  for (const conversa of conversas) {
    if (conversa.tipo !== "privada") continue;
    for (const p of conversa.participantes) {
      mapa.set(`${p.tipo}:${p.id_externo}`, { id_externo: p.id_externo, tipo: p.tipo, nome: p.nome, foto: p.foto_url });
    }
  }
  return [...mapa.values()].filter((p) => !excluir.has(`${p.tipo}:${p.id_externo}`));
}
function InfoConversa({ conversa, eu, aoFechar, aoAbrirOutraConversa, aoSaiu }) {
  const { api, engine, contactos } = useMakaChat();
  const podeCriarConversa = useFuncionalidadeAtiva("conversas.criar");
  const grupo = conversa.tipo === "grupo";
  const souAdmin = grupo && ["dono", "admin"].includes(eu.papel);
  const [nome, setNome] = (0, import_react8.useState)(conversa.titulo ?? "");
  const [adicionar, setAdicionar] = (0, import_react8.useState)(false);
  const [confirmarSair, setConfirmarSair] = (0, import_react8.useState)(false);
  const [aEnviarFoto, setAEnviarFoto] = (0, import_react8.useState)(false);
  const [conversas, setConversas] = (0, import_react8.useState)([]);
  const fotoInput = (0, import_react8.useRef)(null);
  const membros = conversa.participantes.filter((p) => !p.saiu_em);
  (0, import_react8.useEffect)(() => {
    void engine.storage.listarConversas(false).then(setConversas);
  }, [engine]);
  const renomear = async () => {
    if (nome.trim() && nome.trim() !== conversa.titulo) {
      await api.atualizarGrupo(conversa.id, { titulo: nome.trim() }).catch(() => void 0);
      await engine.atualizarConversas();
    }
  };
  const mudarFoto = async (f) => {
    setAEnviarFoto(true);
    try {
      const criado = await api.criarMedia({ tipo: "foto", mime: f.type, nome_ficheiro: f.name });
      await api.carregarMedia(criado.upload, f, f.type);
      const { anexo } = await api.confirmarMedia(criado.anexo_id, { duravel: true });
      await api.atualizarGrupo(conversa.id, { foto_url: anexo.url });
      await engine.atualizarConversas();
    } finally {
      setAEnviarFoto(false);
    }
  };
  const mensagemDireta = async (p) => {
    const { conversa: nova } = await api.criarPrivada({ id_externo: p.id_externo, tipo: p.tipo, nome: p.nome });
    await engine.atualizarConversas();
    aoFechar();
    aoAbrirOutraConversa?.(nova.id);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "fixed inset-0 z-[10000] grid place-items-center bg-slate-900/50 backdrop-blur-sm", onClick: aoFechar, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex max-h-[80vh] w-[380px] animate-maka-subir flex-col overflow-hidden rounded-2xl bg-[var(--maka-superficie)] shadow-maka-modal", onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex items-center justify-between px-4 py-3", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "font-bold text-[var(--maka-texto)]", children: grupo ? "Info do grupo" : "Info da conversa" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BotaoIcone, { titulo: "Fechar", onClick: aoFechar, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:x" }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex flex-col items-center gap-2 px-4 pb-3", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "relative", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(AvatarWeb, { nome: conversa.titulo ?? "?", url: conversa.foto_url, tamanho: 72, grupo }),
          souAdmin && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "button",
            {
              onClick: () => fotoInput.current?.click(),
              title: "Mudar foto",
              className: "absolute -bottom-1 -right-1 grid h-7 w-7 cursor-pointer place-items-center rounded-full border-0 bg-[var(--maka-primaria)] text-sm text-[var(--maka-primaria-contraste)] shadow",
              children: aEnviarFoto ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:loader-2", className: "animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:camera" })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("input", { ref: fotoInput, type: "file", accept: "image/*", hidden: true, onChange: (e) => {
            const f = e.target.files?.[0];
            if (f) void mudarFoto(f);
            e.target.value = "";
          } })
        ] }),
        souAdmin ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "input",
          {
            className: "w-full rounded-full border border-solid border-slate-300/60 bg-[var(--maka-fundo)] px-4 py-2 text-center text-sm font-bold text-[var(--maka-texto)] outline-none focus:ring-2 focus:ring-[var(--maka-primaria)]",
            value: nome,
            onChange: (e) => setNome(e.target.value),
            onBlur: () => void renomear(),
            onKeyDown: (e) => e.key === "Enter" && void renomear()
          }
        ) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "font-bold text-[var(--maka-texto)]", children: conversa.titulo }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "text-xs text-[var(--maka-texto-suave)]", children: grupo ? `${membros.length} membros` : "" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "maka-scroll min-h-0 flex-1 overflow-auto border-0 border-t border-solid border-black/5", children: membros.map((p) => {
        const souEu = p.identidade_id === eu.identidade_id;
        return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex items-center gap-3 px-4 py-2.5", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(AvatarWeb, { nome: p.nome, url: p.foto_url, tamanho: 36 }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "min-w-0 flex-1", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "block truncate text-sm font-semibold text-[var(--maka-texto)]", children: souEu ? "Tu" : p.nome }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "text-xs text-[var(--maka-texto-suave)]", children: p.papel !== "membro" ? p.papel : p.tipo })
          ] }),
          !souEu && podeCriarConversa && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BotaoIcone, { titulo: "Mensagem", onClick: () => void mensagemDireta(p), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:message-circle" }) }),
          !souEu && souAdmin && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BotaoIcone, { titulo: "Remover do grupo", onClick: () => {
            void api.removerParticipante(conversa.id, p.identidade_id).then(() => engine.atualizarConversas());
          }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:user-minus", className: "text-red-500" }) })
        ] }, p.identidade_id);
      }) }),
      grupo && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex gap-2 p-3", children: [
        souAdmin && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { onClick: () => setAdicionar(true), className: "flex-1 cursor-pointer rounded-full border-0 bg-[var(--maka-primaria)] py-2.5 text-sm font-bold text-[var(--maka-primaria-contraste)] shadow-sm", children: "Adicionar membros" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { onClick: () => setConfirmarSair(true), className: "flex-1 cursor-pointer rounded-full border-0 bg-red-600/10 py-2.5 text-sm font-bold text-red-600", children: "Sair do grupo" })
      ] })
    ] }),
    adicionar && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { onClick: (e) => e.stopPropagation(), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      AdicionarMembros,
      {
        conversa,
        conversas,
        contactos,
        aoFechar: () => setAdicionar(false)
      }
    ) }),
    confirmarSair && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { onClick: (e) => e.stopPropagation(), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      ConfirmarDialogo,
      {
        titulo: "Sair do grupo?",
        aoFechar: () => setConfirmarSair(false),
        botoes: [{ rotulo: "Sair do grupo", destrutivo: true, acao: () => {
          void api.sairDaConversa(conversa.id).then(() => engine.atualizarConversas());
          aoSaiu();
        } }]
      }
    ) })
  ] });
}
function AdicionarMembros({ conversa, conversas, contactos, aoFechar }) {
  const { api, engine } = useMakaChat();
  const [escolhidos, setEscolhidos] = (0, import_react8.useState)(/* @__PURE__ */ new Set());
  const jaNoGrupo = new Set(conversa.participantes.filter((p) => !p.saiu_em).map((p) => `${p.tipo}:${p.id_externo}`));
  const pessoas = pessoasConhecidas(conversas, contactos, jaNoGrupo);
  const adicionar = async () => {
    const membros = pessoas.filter((p) => escolhidos.has(`${p.tipo}:${p.id_externo}`));
    await api.adicionarParticipantes(conversa.id, membros);
    await engine.atualizarConversas();
    aoFechar();
  };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "fixed inset-0 z-[10003] grid place-items-center bg-slate-900/50", onClick: aoFechar, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex max-h-[70vh] w-[340px] animate-maka-subir flex-col overflow-hidden rounded-2xl bg-[var(--maka-superficie)] shadow-maka-modal", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex items-center justify-between px-4 py-3", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "font-bold text-[var(--maka-texto)]", children: "Adicionar membros" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BotaoIcone, { titulo: "Fechar", onClick: aoFechar, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:x" }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "maka-scroll min-h-0 flex-1 overflow-auto", children: [
      pessoas.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "px-4 py-6 text-sm text-[var(--maka-texto-suave)]", children: "Toda a gente conhecida j\xE1 est\xE1 no grupo." }),
      pessoas.map((p) => {
        const chave = `${p.tipo}:${p.id_externo}`;
        const marcado = escolhidos.has(chave);
        return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("button", { onClick: () => setEscolhidos((a) => {
          const n = new Set(a);
          marcado ? n.delete(chave) : n.add(chave);
          return n;
        }), className: "flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-4 py-2.5 text-left hover:bg-black/[.04]", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: marcado ? "tabler:circle-check-filled" : "tabler:circle", className: `text-xl ${marcado ? "text-[var(--maka-primaria)]" : "text-[var(--maka-texto-suave)]"}` }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(AvatarWeb, { nome: p.nome ?? p.id_externo, url: p.foto, tamanho: 32 }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "min-w-0 flex-1 truncate text-sm font-semibold text-[var(--maka-texto)]", children: p.nome ?? p.id_externo })
        ] }, chave);
      })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "p-3", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("button", { disabled: escolhidos.size === 0, onClick: () => void adicionar(), className: "w-full cursor-pointer rounded-full border-0 bg-[var(--maka-primaria)] py-2.5 text-sm font-bold text-[var(--maka-primaria-contraste)] disabled:opacity-40", children: [
      "Adicionar",
      escolhidos.size > 0 ? ` (${escolhidos.size})` : ""
    ] }) })
  ] }) });
}
function NovaConversaModal({ conversas, contactos, podeGrupos, aoFechar, aoCriada }) {
  const { api, engine, identidade } = useMakaChat();
  const [nome, setNome] = (0, import_react8.useState)("");
  const [escolhidos, setEscolhidos] = (0, import_react8.useState)(/* @__PURE__ */ new Set());
  const pessoas = pessoasConhecidas(conversas, contactos, /* @__PURE__ */ new Set([`${identidade.tipo}:${identidade.id}`]));
  const grupo = escolhidos.size > 1;
  const membros = pessoas.filter((p) => escolhidos.has(`${p.tipo}:${p.id_externo}`));
  const nomePadrao = membros.map((p) => (p.nome ?? p.id_externo).split(" ")[0]).join(", ");
  const criar = async () => {
    if (escolhidos.size === 0) return;
    const { conversa } = grupo ? await api.criarGrupo(nome.trim() || nomePadrao, membros) : await api.criarPrivada({ id_externo: membros[0].id_externo, tipo: membros[0].tipo, nome: membros[0].nome });
    await engine.atualizarConversas();
    aoCriada(conversa);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "fixed inset-0 z-[10000] grid place-items-center bg-slate-900/50 backdrop-blur-sm", onClick: aoFechar, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex max-h-[74vh] w-[380px] animate-maka-subir flex-col overflow-hidden rounded-2xl bg-[var(--maka-superficie)] shadow-maka-modal", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex items-center justify-between px-4 py-3", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "font-bold text-[var(--maka-texto)]", children: "Nova conversa" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BotaoIcone, { titulo: "Fechar", onClick: aoFechar, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:x" }) })
    ] }),
    podeGrupos && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "px-4 pb-1 text-xs text-[var(--maka-texto-suave)]", children: "Escolhe uma pessoa \u2014 ou v\xE1rias para criar um grupo." }),
    grupo && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "px-4 pb-2 pt-1", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "input",
      {
        autoFocus: true,
        className: "w-full rounded-full border border-solid border-slate-300/60 bg-[var(--maka-fundo)] px-4 py-2.5 text-sm text-[var(--maka-texto)] outline-none focus:ring-2 focus:ring-[var(--maka-primaria)]",
        placeholder: `Nome do grupo (padr\xE3o: ${nomePadrao})`,
        value: nome,
        onChange: (e) => setNome(e.target.value)
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "maka-scroll min-h-0 flex-1 overflow-auto", children: [
      pessoas.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "px-4 py-6 text-sm text-[var(--maka-texto-suave)]", children: "Sem contactos conhecidos." }),
      pessoas.map((p) => {
        const chave = `${p.tipo}:${p.id_externo}`;
        const marcado = escolhidos.has(chave);
        return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
          "button",
          {
            onClick: () => setEscolhidos((a) => {
              if (marcado) {
                const n = new Set(a);
                n.delete(chave);
                return n;
              }
              return podeGrupos ? new Set(a).add(chave) : /* @__PURE__ */ new Set([chave]);
            }),
            className: "flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-4 py-2.5 text-left hover:bg-black/[.04]",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: marcado ? "tabler:circle-check-filled" : "tabler:circle", className: `text-xl ${marcado ? "text-[var(--maka-primaria)]" : "text-[var(--maka-texto-suave)]"}` }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(AvatarWeb, { nome: p.nome ?? p.id_externo, url: p.foto, tamanho: 34 }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "min-w-0 flex-1 truncate text-sm font-semibold text-[var(--maka-texto)]", children: p.nome ?? p.id_externo }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "text-xs text-[var(--maka-texto-suave)]", children: p.tipo })
            ]
          },
          chave
        );
      })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "p-3", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "button",
      {
        disabled: escolhidos.size === 0,
        onClick: () => void criar(),
        className: "w-full cursor-pointer rounded-full border-0 bg-[var(--maka-primaria)] py-2.5 text-sm font-bold text-[var(--maka-primaria-contraste)] shadow-md disabled:cursor-default disabled:opacity-40",
        children: grupo ? `Criar grupo (${escolhidos.size})` : "Iniciar conversa"
      }
    ) })
  ] }) });
}
function previewConversa(c) {
  const u = c.ultima_mensagem;
  if (!u) return "";
  if (u.eliminada) return "\u{1F6AB} Mensagem eliminada";
  const p = { foto: "\u{1F4F7} Foto", video: "\u{1F3AC} V\xEDdeo", audio: "\u{1F3A4} \xC1udio", ficheiro: "\u{1F4CE} Ficheiro", chamada: "\u{1F4DE} Chamada", partilha: "\u{1F517} Partilha", link: "\u{1F517} Link" };
  return u.tipo === "texto" || u.tipo === "sistema" || u.tipo === "chamada" ? u.conteudo ?? "" : p[u.tipo] ?? "";
}
function ConversaPainel({ conversaId, compacto = false, aoFechar, aoMinimizar, aoAbrirOutraConversa }) {
  const { engine, socket, identidade, api, registarVisivel } = useMakaChat();
  const chamadas = useChamadasOpcional();
  const versao = useVersaoChat();
  const mensagens = useMensagens(conversaId, 500);
  const typing = useTypingConversa(conversaId);
  const enviar = useEnviarMensagem();
  const podeAudioChamada = useFuncionalidadeAtiva("chamadas.audio");
  const podeCriarConversa = useFuncionalidadeAtiva("conversas.criar");
  const podeVideoChamada = useFuncionalidadeAtiva("chamadas.video");
  const podeFicheiro = useFuncionalidadeAtiva("media.ficheiro");
  const podeFoto = useFuncionalidadeAtiva("media.foto");
  const podeAudioMedia = useFuncionalidadeAtiva("media.audio");
  const podeReagir = useFuncionalidadeAtiva("reacoes");
  const podeEncaminhar = useFuncionalidadeAtiva("encaminhar");
  const podeEliminarConversa = useFuncionalidadeAtiva("conversas.eliminar");
  const podeMedia = podeFicheiro || podeFoto;
  const [conversa, setConversa] = (0, import_react8.useState)(null);
  const [contexto, setContexto] = (0, import_react8.useState)(null);
  const [texto, setTexto] = (0, import_react8.useState)("");
  const [responderA, setResponderA] = (0, import_react8.useState)(null);
  const [editar, setEditar] = (0, import_react8.useState)(null);
  const [encaminhar, setEncaminhar] = (0, import_react8.useState)(null);
  const [reacoesDe, setReacoesDe] = (0, import_react8.useState)(null);
  const [fotosPendentes, setFotosPendentes] = (0, import_react8.useState)([]);
  const [aEnviarMedia, setAEnviarMedia] = (0, import_react8.useState)(false);
  const [lightbox, setLightbox] = (0, import_react8.useState)(null);
  const [menuAnexo, setMenuAnexo] = (0, import_react8.useState)(false);
  const [destacada, setDestacada] = (0, import_react8.useState)(null);
  const [eliminarDe, setEliminarDe] = (0, import_react8.useState)(null);
  const [pesquisaAberta, setPesquisaAberta] = (0, import_react8.useState)(false);
  const [pesquisaQ, setPesquisaQ] = (0, import_react8.useState)("");
  const [resultados, setResultados] = (0, import_react8.useState)([]);
  const [resultadoIdx, setResultadoIdx] = (0, import_react8.useState)(0);
  const aCarregarAntigas = (0, import_react8.useRef)(false);
  const semMaisAntigas = (0, import_react8.useRef)(false);
  const [aCarregarIniciais, setACarregarIniciais] = (0, import_react8.useState)(true);
  const [menuConversa, setMenuConversa] = (0, import_react8.useState)(false);
  const [infoAberta, setInfoAberta] = (0, import_react8.useState)(false);
  const [confirmarEliminarConversa, setConfirmarEliminarConversa] = (0, import_react8.useState)(false);
  const fim = (0, import_react8.useRef)(null);
  const lista = (0, import_react8.useRef)(null);
  const [noFundo, setNoFundo] = (0, import_react8.useState)(true);
  const [novas, setNovas] = (0, import_react8.useState)(0);
  const [focada, setFocada] = (0, import_react8.useState)(() => typeof document === "undefined" ? true : document.hasFocus());
  const anteriorUltimaId = (0, import_react8.useRef)(null);
  const ficheiro = (0, import_react8.useRef)(null);
  const fotoInput = (0, import_react8.useRef)(null);
  const ultimoTyping = (0, import_react8.useRef)(0);
  const refsBolhas = (0, import_react8.useRef)(/* @__PURE__ */ new Map());
  (0, import_react8.useEffect)(() => registarVisivel(conversaId), [registarVisivel, conversaId]);
  useFecharFora(menuConversa, "menu-cabecalho", () => setMenuConversa(false));
  useFecharFora(menuAnexo, "menu-anexo", () => setMenuAnexo(false));
  (0, import_react8.useEffect)(() => {
    void engine.storage.obterConversa(conversaId).then(setConversa);
  }, [engine, conversaId, versao]);
  (0, import_react8.useEffect)(() => {
    setContexto(null);
    anteriorUltimaId.current = null;
    setNovas(0);
    setNoFundo(true);
    setPesquisaAberta(false);
    setPesquisaQ("");
    setResultados([]);
    semMaisAntigas.current = false;
    setACarregarIniciais(true);
    let ativo = true;
    void engine.carregarMensagens(conversaId).catch(() => void 0).finally(() => {
      if (ativo) setACarregarIniciais(false);
    });
    void api.obterContexto(conversaId).then((r) => setContexto(r.contexto ?? null)).catch(() => void 0);
    void engine.entrarConversa(conversaId);
    return () => {
      ativo = false;
    };
  }, [engine, api, socket, conversaId]);
  (0, import_react8.useEffect)(() => {
    const aoFoco = () => setFocada(true);
    const aoBlur = () => setFocada(false);
    const aoVisibilidade = () => setFocada(document.visibilityState === "visible" && document.hasFocus());
    window.addEventListener("focus", aoFoco);
    window.addEventListener("blur", aoBlur);
    document.addEventListener("visibilitychange", aoVisibilidade);
    return () => {
      window.removeEventListener("focus", aoFoco);
      window.removeEventListener("blur", aoBlur);
      document.removeEventListener("visibilitychange", aoVisibilidade);
    };
  }, []);
  const scrollParaFundo = (suave = true) => {
    requestAnimationFrame(() => {
      const el = lista.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: suave ? "smooth" : "auto" });
      setTimeout(() => {
        const alvo = lista.current;
        if (alvo && alvo.scrollHeight - alvo.scrollTop - alvo.clientHeight < 200) {
          alvo.scrollTop = alvo.scrollHeight;
        }
      }, 280);
    });
  };
  const aoScroll = () => {
    const el = lista.current;
    if (!el) return;
    const fundo = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setNoFundo(fundo);
    if (fundo) setNovas(0);
    if (el.scrollTop < 60 && !aCarregarAntigas.current && !semMaisAntigas.current && mensagens.length >= 50) {
      aCarregarAntigas.current = true;
      const alturaAntes = el.scrollHeight;
      void engine.carregarMensagens(conversaId, mensagens[0]?.id).then((carregadas) => {
        if (!carregadas) semMaisAntigas.current = true;
        requestAnimationFrame(() => {
          const alvo = lista.current;
          if (alvo) alvo.scrollTop += alvo.scrollHeight - alturaAntes;
        });
      }).catch(() => void 0).finally(() => {
        aCarregarAntigas.current = false;
      });
    }
  };
  (0, import_react8.useEffect)(() => {
    const ultima = mensagens.at(-1);
    if (!ultima) return;
    const primeiraCarga = anteriorUltimaId.current === null;
    const haNova = ultima.id !== anteriorUltimaId.current;
    anteriorUltimaId.current = ultima.id;
    if (!haNova) return;
    const minha = ultima.remetente_identidade_id === eu?.identidade_id || ultima.estado_envio === "a_enviar";
    if (primeiraCarga || minha || noFundo) {
      scrollParaFundo(!primeiraCarga);
      if (focada && (noFundo || primeiraCarga)) void engine.marcarLidas(conversaId);
    } else {
      setNovas((n) => n + 1);
    }
  }, [mensagens, conversaId]);
  (0, import_react8.useEffect)(() => {
    if (focada && noFundo && mensagens.length) {
      void engine.marcarLidas(conversaId);
      setNovas(0);
    }
  }, [focada, noFundo]);
  (0, import_react8.useEffect)(() => {
    if (typing?.ativo && noFundo) fim.current?.scrollIntoView({ behavior: "smooth" });
  }, [typing?.ativo]);
  const fechada = conversa?.estado === "fechada";
  const eu = (0, import_react8.useMemo)(
    () => conversa?.participantes.find((p) => p.id_externo === identidade.id && p.tipo === identidade.tipo) ?? null,
    [conversa, identidade]
  );
  const outros = (conversa?.participantes ?? []).filter((p) => p.identidade_id !== eu?.identidade_id && !p.saiu_em);
  const contraparte = conversa?.tipo === "privada" ? outros[0] : null;
  const presenca = usePresenca(contraparte?.identidade_id ?? null);
  const typingOutro = typing && typing.identidade_id !== eu?.identidade_id ? typing : null;
  const nomeTyping = typingOutro ? conversa?.participantes.find((p) => p.identidade_id === typingOutro.identidade_id)?.nome ?? null : null;
  const aoEnviar = async () => {
    const conteudo = texto.trim();
    if (!conteudo) return;
    setTexto("");
    if (editar) {
      const alvo = editar;
      setEditar(null);
      await engine.editarMensagem(alvo.id, conteudo).catch(() => void 0);
      return;
    }
    const resposta = responderA;
    setResponderA(null);
    tocarSom("enviada");
    void enviar({ conversa_id: conversaId, conteudo, resposta_a_id: resposta?.id });
  };
  const enviarFicheiro = async (f, legenda, forcarTipo) => {
    setAEnviarMedia(true);
    try {
      const tipo = forcarTipo ?? (f.type.startsWith("image/") ? "foto" : f.type.startsWith("video/") ? "video" : f.type.startsWith("audio/") ? "audio" : "ficheiro");
      const criado = await api.criarMedia({ tipo, mime: f.type, nome_ficheiro: f.name });
      await api.carregarMedia(criado.upload, f, f.type);
      await api.confirmarMedia(criado.anexo_id);
      const preview = {
        id: criado.anexo_id,
        tipo,
        nome_ficheiro: f.name,
        mime: f.type,
        tamanho_bytes: f.size,
        largura: null,
        altura: null,
        duracao_segundos: null,
        blurhash: null,
        estado: "pronto",
        url: URL.createObjectURL(f)
      };
      await enviar(
        { conversa_id: conversaId, tipo, conteudo: legenda, anexo_ids: [criado.anexo_id] },
        [preview]
      );
    } finally {
      setAEnviarMedia(false);
    }
  };
  const enviarFotos = async (ficheiros, legenda) => {
    setAEnviarMedia(true);
    try {
      const resultados2 = await Promise.all(
        ficheiros.map(async (f) => {
          const criado = await api.criarMedia({ tipo: "foto", mime: f.type, nome_ficheiro: f.name });
          await api.carregarMedia(criado.upload, f, f.type);
          await api.confirmarMedia(criado.anexo_id);
          const preview = {
            id: criado.anexo_id,
            tipo: "foto",
            nome_ficheiro: f.name,
            mime: f.type,
            tamanho_bytes: f.size,
            largura: null,
            altura: null,
            duracao_segundos: null,
            blurhash: null,
            estado: "pronto",
            url: URL.createObjectURL(f)
          };
          return { anexo_id: criado.anexo_id, preview };
        })
      );
      await enviar(
        { conversa_id: conversaId, tipo: "foto", conteudo: legenda, anexo_ids: resultados2.map((r) => r.anexo_id) },
        resultados2.map((r) => r.preview)
      );
    } finally {
      setAEnviarMedia(false);
    }
  };
  const abrirGaleria = (url) => {
    const itens = mensagens.flatMap(
      (m) => m.anexos.filter((a) => a.tipo === "foto" && a.url).map((a) => ({ url: a.url, nome: a.nome_ficheiro ?? "foto.jpg", mensagem: m }))
    );
    const indice = Math.max(0, itens.findIndex((i) => i.url === url));
    setLightbox({ itens, indice });
  };
  const executarPesquisa = async () => {
    const q = pesquisaQ.trim();
    if (!q) return;
    const r = await api.pesquisarMensagens(conversaId, q).catch(() => ({ mensagens: [] }));
    setResultados(r.mensagens);
    setResultadoIdx(0);
    if (r.mensagens[0]) void irParaMensagem(r.mensagens[0].id);
  };
  const navegarResultado = (direcao) => {
    if (!resultados.length) return;
    const idx = (resultadoIdx + direcao + resultados.length) % resultados.length;
    setResultadoIdx(idx);
    void irParaMensagem(resultados[idx].id);
  };
  const irParaMensagem = async (mensagemId) => {
    for (let tentativa = 0; tentativa < 12; tentativa++) {
      const el = refsBolhas.current.get(mensagemId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setDestacada(mensagemId);
        setTimeout(() => setDestacada(null), 1600);
        return;
      }
      const maisAntiga = mensagens[0];
      const carregadas = await engine.carregarMensagens(conversaId, maisAntiga?.id).catch(() => 0);
      if (!carregadas) return;
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "relative flex h-full min-w-0 flex-col bg-[var(--maka-fundo)] text-[var(--maka-texto)]", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: `z-[1] flex items-center gap-3 border-0 border-b border-solid border-black/[.06] bg-[var(--maka-superficie)] ${compacto ? "px-3 py-2" : "px-4 py-2.5"}`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "relative cursor-pointer", onClick: () => setInfoAberta(true), children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(AvatarWeb, { nome: conversa?.titulo ?? "?", url: conversa?.foto_url, tamanho: compacto ? 34 : 42, grupo: conversa?.tipo === "grupo" }),
        presenca?.online && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "absolute -bottom-0.5 -right-0.5 block h-3 w-3 rounded-full border-2 border-[var(--maka-superficie)] bg-emerald-500" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "min-w-0 flex-1 cursor-pointer", onClick: () => setInfoAberta(true), children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: `block truncate font-bold ${compacto ? "text-[13px]" : "text-[15px]"}`, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(NomeComBadge, { nome: conversa?.titulo ?? "\u2026", metadados: contraparte?.metadados }) }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: `block text-xs ${typingOutro ? "italic text-[var(--maka-primaria)]" : presenca?.online ? "text-emerald-600" : "text-[var(--maka-texto-suave)]"}`, children: typingOutro ? "a escrever\u2026" : presenca?.online ? "online" : "" })
      ] }),
      !compacto && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BotaoIcone, { titulo: "Pesquisar na conversa", onClick: () => {
        setPesquisaAberta(!pesquisaAberta);
        setResultados([]);
        setPesquisaQ("");
      }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:search" }) }),
      !compacto && chamadas && podeAudioChamada && !fechada && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BotaoIcone, { titulo: "Chamada de \xE1udio", onClick: () => void chamadas.iniciar(conversaId, "audio"), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:phone" }) }),
      !compacto && chamadas && podeVideoChamada && !fechada && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BotaoIcone, { titulo: "Chamada de v\xEDdeo", onClick: () => void chamadas.iniciar(conversaId, "video"), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:video" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "relative", "data-maka-pop": "menu-cabecalho", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BotaoIcone, { titulo: "Op\xE7\xF5es da conversa", onClick: () => setMenuConversa(!menuConversa), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:dots-vertical" }) }),
        menuConversa && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "absolute right-0 top-10 z-[5] min-w-[190px] animate-maka-subir overflow-hidden rounded-xl bg-[var(--maka-superficie)] shadow-maka-pop ring-1 ring-black/[.05]", children: [
          compacto && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(ItemMenu, { onClick: () => {
            setMenuConversa(false);
            setPesquisaAberta(!pesquisaAberta);
            setResultados([]);
            setPesquisaQ("");
          }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:search", className: "inline align-[-2px]" }),
            " Pesquisar na conversa"
          ] }),
          compacto && chamadas && podeAudioChamada && !fechada && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(ItemMenu, { onClick: () => {
            setMenuConversa(false);
            void chamadas.iniciar(conversaId, "audio");
          }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:phone", className: "inline align-[-2px]" }),
            " Chamada de \xE1udio"
          ] }),
          compacto && chamadas && podeVideoChamada && !fechada && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(ItemMenu, { onClick: () => {
            setMenuConversa(false);
            void chamadas.iniciar(conversaId, "video");
          }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:video", className: "inline align-[-2px]" }),
            " Chamada de v\xEDdeo"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(ItemMenu, { onClick: () => {
            setMenuConversa(false);
            void engine.marcarNaoLida(conversaId).catch(() => void 0);
            aoFechar?.();
          }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:mail-opened", className: "inline align-[-2px]" }),
            " Marcar como n\xE3o lida"
          ] }),
          podeEliminarConversa && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(ItemMenu, { onClick: () => {
            setMenuConversa(false);
            setConfirmarEliminarConversa(true);
          }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:trash", className: "inline align-[-2px]" }),
            " Eliminar conversa"
          ] })
        ] })
      ] }),
      aoMinimizar && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BotaoIcone, { titulo: "Minimizar", onClick: aoMinimizar, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:minus" }) }),
      aoFechar && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BotaoIcone, { titulo: "Fechar", onClick: aoFechar, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:x" }) })
    ] }),
    pesquisaAberta && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex items-center gap-2 border-0 border-b border-solid border-black/[.06] bg-[var(--maka-superficie)] px-3 py-2", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:search", className: "shrink-0 text-[var(--maka-texto-suave)]" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "input",
        {
          autoFocus: true,
          className: "min-w-0 flex-1 border-0 bg-transparent text-sm text-[var(--maka-texto)] outline-none placeholder:text-[var(--maka-texto-suave)]",
          placeholder: "Pesquisar nesta conversa\u2026",
          value: pesquisaQ,
          onChange: (e) => setPesquisaQ(e.target.value),
          onKeyDown: (e) => {
            if (e.key === "Enter") e.shiftKey ? navegarResultado(-1) : resultados.length ? navegarResultado(1) : void executarPesquisa();
            if (e.key === "Escape") setPesquisaAberta(false);
          }
        }
      ),
      resultados.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "shrink-0 text-xs text-[var(--maka-texto-suave)]", children: [
        resultadoIdx + 1,
        "/",
        resultados.length
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BotaoIcone, { titulo: "Anterior", onClick: () => navegarResultado(-1), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:chevron-up" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BotaoIcone, { titulo: "Seguinte", onClick: () => navegarResultado(1), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:chevron-down" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BotaoIcone, { titulo: "Fechar", onClick: () => setPesquisaAberta(false), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:x" }) })
    ] }),
    conversa?.chamada_ativa && conversa.tipo === "grupo" && chamadas && chamadas.ativa?.chamada.id !== conversa.chamada_ativa.id && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex items-center gap-2.5 border-0 border-b border-solid border-black/[.06] bg-emerald-50 px-4 py-2", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "grid h-8 w-8 animate-maka-pulsar place-items-center rounded-full bg-emerald-500 text-white", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: conversa.chamada_ativa.tipo === "video" ? "tabler:video" : "tabler:phone" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "min-w-0 flex-1 truncate text-sm font-semibold text-emerald-800", children: [
        "Chamada de ",
        conversa.chamada_ativa.tipo === "video" ? "v\xEDdeo" : "voz",
        " a decorrer"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "button",
        {
          onClick: () => void chamadas.entrar(conversa.chamada_ativa.id, conversa.chamada_ativa.tipo),
          className: "cursor-pointer rounded-full border-0 bg-emerald-500 px-4 py-1.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105",
          children: "Entrar"
        }
      )
    ] }),
    contexto && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "border-0 border-b border-solid border-black/[.06] bg-[var(--maka-superficie)] px-4 py-2 text-[13px]", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "font-bold", children: contexto.titulo }),
      contexto.subtitulo && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "text-[var(--maka-texto-suave)]", children: [
        " \u2014 ",
        contexto.subtitulo
      ] }),
      contexto.linhas?.map((l, i) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "text-[var(--maka-texto-suave)]", children: l }, i))
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "relative min-h-0 flex-1", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { ref: lista, onScroll: aoScroll, className: `maka-scroll flex h-full flex-col gap-1 overflow-y-auto overflow-x-hidden ${compacto ? "p-2.5" : "p-4"}`, children: [
        aCarregarIniciais && mensagens.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "grid flex-1 place-items-center text-[var(--maka-texto-suave)]", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:loader-2", className: "animate-spin text-2xl text-[var(--maka-primaria)]" }) }),
        mensagens.map((m, i) => {
          const anterior = mensagens[i - 1];
          const seguinte = mensagens[i + 1];
          const mesmaAnterior = anterior && anterior.tipo !== "sistema" && anterior.remetente_identidade_id === m.remetente_identidade_id;
          const mesmaSeguinte = seguinte && seguinte.tipo !== "sistema" && seguinte.remetente_identidade_id === m.remetente_identidade_id;
          const autor = conversa?.participantes.find((p) => p.identidade_id === m.remetente_identidade_id);
          return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            Bolha,
            {
              compacto,
              primeiraDoBloco: !mesmaAnterior,
              ultimaDoBloco: !mesmaSeguinte,
              autor: autor ?? null,
              registarRef: (el) => {
                if (el) refsBolhas.current.set(m.id, el);
                else refsBolhas.current.delete(m.id);
              },
              mensagem: m,
              minha: m.remetente_identidade_id === eu?.identidade_id || m.estado_envio === "a_enviar",
              grupo: conversa?.tipo === "grupo",
              participantes: conversa?.participantes ?? [],
              outros,
              destacada: destacada === m.id,
              podeReagir,
              aoAbrirFoto: abrirGaleria,
              aoClicarCitacao: (id) => void irParaMensagem(id),
              aoVerReacoes: () => setReacoesDe(m),
              acoes: {
                reagir: podeReagir ? (emoji) => void engine.alternarReacao(conversaId, m.id, emoji) : void 0,
                responder: () => {
                  setEditar(null);
                  setResponderA(m);
                },
                editar: m.remetente_identidade_id === eu?.identidade_id && m.tipo === "texto" && !m.eliminada ? () => {
                  setResponderA(null);
                  setEditar(m);
                  setTexto(m.conteudo ?? "");
                } : void 0,
                eliminar: !m.eliminada ? () => setEliminarDe(m) : void 0,
                encaminhar: podeEncaminhar ? () => setEncaminhar(m) : void 0
              },
              todas: mensagens
            },
            m.id
          );
        }),
        typingOutro && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex justify-start pt-1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "mr-1.5 w-7 shrink-0" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex items-center gap-2 rounded-[var(--maka-raio)] rounded-bl-md bg-[var(--maka-bolha-outro)] px-3.5 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,.04),0_4px_14px_-4px_rgba(15,23,42,.08)]", children: [
            conversa?.tipo === "grupo" && nomeTyping && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "text-xs font-bold text-[var(--maka-primaria)]", children: nomeTyping }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "flex items-end gap-1", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "h-2 w-2 animate-maka-salto rounded-full bg-[var(--maka-texto-suave)]" }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "h-2 w-2 animate-maka-salto rounded-full bg-[var(--maka-texto-suave)] [animation-delay:.15s]" }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "h-2 w-2 animate-maka-salto rounded-full bg-[var(--maka-texto-suave)] [animation-delay:.3s]" })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { ref: fim })
      ] }),
      !noFundo && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "pointer-events-none absolute inset-x-0 bottom-3 z-[4] flex justify-center", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
        "button",
        {
          onClick: () => {
            scrollParaFundo();
            setNovas(0);
          },
          className: `pointer-events-auto flex animate-maka-flutuar cursor-pointer items-center gap-1.5 rounded-full border-0 shadow-lg transition-all duration-200 ease-out hover:scale-105 ${novas > 0 ? "bg-[var(--maka-primaria)] px-3.5 py-2 text-[13px] font-bold text-[var(--maka-primaria-contraste)]" : "grid h-10 w-10 place-items-center bg-[var(--maka-superficie)] text-lg text-[var(--maka-texto)] ring-1 ring-black/[.05]"}`,
          children: [
            novas > 0 ? `${novas} ${novas === 1 ? "mensagem nova" : "mensagens novas"}` : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:chevron-down" }),
            novas > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:chevron-down" })
          ]
        }
      ) })
    ] }),
    fechada && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex items-center justify-center gap-2 border-0 border-t border-solid border-black/[.06] bg-[var(--maka-superficie)] px-4 py-3 text-center text-[13px] text-[var(--maka-texto-suave)]", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:lock", className: "shrink-0 text-base" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "font-semibold text-[var(--maka-texto)]", children: "Esta conversa est\xE1 fechada." }),
        conversa?.fecho_motivo ? ` ${conversa.fecho_motivo}` : ""
      ] })
    ] }),
    !fechada && (responderA || editar) && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex items-center gap-2 border-t-2 border-[var(--maka-primaria)] bg-[var(--maka-superficie)] px-3 py-1.5 text-[13px]", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "font-bold text-[var(--maka-primaria)]", children: editar ? "Editar" : "Responder" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "min-w-0 flex-1 truncate text-[var(--maka-texto-suave)]", children: (editar ?? responderA)?.conteudo ?? "\u{1F4CE} anexo" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BotaoIcone, { titulo: "Cancelar", onClick: () => {
        setResponderA(null);
        setEditar(null);
        setTexto("");
      }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:x" }) })
    ] }),
    !fechada && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { "data-maka-pop": "menu-anexo", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        BarraInput,
        {
          compacto,
          texto,
          setTexto: (valor) => {
            setTexto(valor);
            const agora = Date.now();
            if (agora - ultimoTyping.current > 3e3) {
              ultimoTyping.current = agora;
              socket.typing(conversaId, true);
            }
          },
          placeholder: editar ? "Editar mensagem\u2026" : "Escreve uma mensagem\u2026",
          aoEnviar: () => void aoEnviar(),
          podeMedia,
          podeGravar: podeAudioMedia,
          aEnviarMedia,
          aoAnexar: () => setMenuAnexo(!menuAnexo),
          aoGravarAudio: (blob) => void enviarFicheiro(new File([blob], "voz.webm", { type: blob.type || "audio/webm" }))
        }
      ),
      menuAnexo && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { "data-maka-pop": "menu-anexo", className: "absolute bottom-16 left-3 z-[6] min-w-[190px] animate-maka-subir overflow-hidden rounded-xl bg-[var(--maka-superficie)] shadow-maka-pop ring-1 ring-black/[.05]", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(ItemMenu, { onClick: () => {
          setMenuAnexo(false);
          fotoInput.current?.click();
        }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:photo", className: "inline align-[-2px] text-[var(--maka-primaria)]" }),
          " Fotos e v\xEDdeos"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(ItemMenu, { onClick: () => {
          setMenuAnexo(false);
          ficheiro.current?.click();
        }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:file", className: "inline align-[-2px] text-[var(--maka-primaria)]" }),
          " Ficheiro"
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "input",
      {
        ref: fotoInput,
        type: "file",
        accept: "image/*,video/*",
        multiple: true,
        hidden: true,
        onChange: (e) => {
          const escolhidos = Array.from(e.target.files ?? []);
          const imagens = escolhidos.filter((f) => f.type.startsWith("image/"));
          const videos = escolhidos.filter((f) => !f.type.startsWith("image/"));
          if (imagens.length) setFotosPendentes((atuais) => [...atuais, ...imagens].slice(0, 10));
          for (const v of videos) void enviarFicheiro(v);
          e.target.value = "";
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "input",
      {
        ref: ficheiro,
        type: "file",
        hidden: true,
        onChange: (e) => {
          const f = e.target.files?.[0];
          if (f) void enviarFicheiro(f, void 0, "ficheiro");
          e.target.value = "";
        }
      }
    ),
    encaminhar && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      EscolherConversas,
      {
        titulo: "Encaminhar para\u2026",
        aoFechar: () => setEncaminhar(null),
        aoConfirmar: (ids) => {
          for (const id of ids) {
            void socket.enviarMensagem({
              conversa_id: id,
              ref_cliente: crypto.randomUUID(),
              tipo: encaminhar.tipo,
              conteudo: encaminhar.conteudo ?? void 0,
              encaminhada_de_id: encaminhar.id
            });
          }
          setEncaminhar(null);
        }
      }
    ),
    fotosPendentes.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      PreviewFotos,
      {
        ficheiros: fotosPendentes,
        aoRemover: (indice) => setFotosPendentes((atuais) => atuais.filter((_, i) => i !== indice)),
        aoAdicionarMais: () => fotoInput.current?.click(),
        aoFechar: () => setFotosPendentes([]),
        aoEnviar: (legenda) => {
          const lista2 = fotosPendentes;
          setFotosPendentes([]);
          void enviarFotos(lista2, legenda || void 0);
        }
      }
    ),
    lightbox && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      Galeria,
      {
        itens: lightbox.itens,
        indiceInicial: lightbox.indice,
        aoFechar: () => setLightbox(null),
        aoResponder: (m) => {
          setLightbox(null);
          setEditar(null);
          setResponderA(m);
        },
        aoEncaminhar: podeEncaminhar ? (m) => {
          setLightbox(null);
          setEncaminhar(m);
        } : void 0,
        aoEliminar: (m) => {
          setLightbox(null);
          setEliminarDe(m);
        }
      }
    ),
    eliminarDe && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      ConfirmarDialogo,
      {
        titulo: "Eliminar mensagem?",
        aoFechar: () => setEliminarDe(null),
        botoes: [
          ...eliminarDe.remetente_identidade_id === eu?.identidade_id ? [{
            rotulo: "Eliminar para todos",
            destrutivo: true,
            acao: () => void engine.eliminarMensagem(conversaId, eliminarDe.id, true)
          }] : [],
          {
            rotulo: "Eliminar para mim",
            destrutivo: true,
            acao: () => void engine.eliminarMensagem(conversaId, eliminarDe.id, false)
          }
        ]
      }
    ),
    confirmarEliminarConversa && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      ConfirmarDialogo,
      {
        titulo: "Eliminar conversa?",
        descricao: "O hist\xF3rico desaparece para ti. A outra pessoa mant\xE9m a conversa dela.",
        aoFechar: () => setConfirmarEliminarConversa(false),
        botoes: [{
          rotulo: "Eliminar conversa",
          destrutivo: true,
          acao: () => {
            void engine.eliminarConversa(conversaId);
            aoFechar?.();
          }
        }]
      }
    ),
    infoAberta && conversa && eu && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      InfoConversa,
      {
        conversa,
        eu,
        aoFechar: () => setInfoAberta(false),
        aoAbrirOutraConversa,
        aoSaiu: () => {
          setInfoAberta(false);
          aoFechar?.();
        }
      }
    ),
    reacoesDe && conversa && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      ModalReacoes,
      {
        mensagem: mensagens.find((m) => m.id === reacoesDe.id) ?? reacoesDe,
        conversa,
        euId: eu?.identidade_id ?? null,
        aoFechar: () => setReacoesDe(null),
        aoRemoverMinha: (emoji) => void engine.alternarReacao(conversaId, reacoesDe.id, emoji),
        aoMensagem: conversa.tipo === "grupo" && aoAbrirOutraConversa && podeCriarConversa ? async (p) => {
          const { conversa: nova } = await api.criarPrivada({ id_externo: p.id_externo, tipo: p.tipo, nome: p.nome });
          await engine.atualizarConversas();
          setReacoesDe(null);
          aoAbrirOutraConversa(nova.id);
        } : void 0
      }
    )
  ] });
}
function MakaChatConversa({ conversaId }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ConversaPainel, { conversaId });
}
function BarraInput({ compacto, texto, setTexto, placeholder, aoEnviar, podeMedia, podeGravar, aEnviarMedia, aoAnexar, aoGravarAudio }) {
  const [aGravar, setAGravar] = (0, import_react8.useState)(false);
  const [segundos, setSegundos] = (0, import_react8.useState)(0);
  const gravador = (0, import_react8.useRef)(null);
  const pedacos = (0, import_react8.useRef)([]);
  const cancelado = (0, import_react8.useRef)(false);
  const timer = (0, import_react8.useRef)(null);
  const pararTimer = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  const comecarGravacao = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(
        stream,
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? { mimeType: "audio/webm;codecs=opus" } : void 0
      );
      pedacos.current = [];
      cancelado.current = false;
      rec.ondataavailable = (e) => e.data.size && pedacos.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (!cancelado.current && pedacos.current.length) {
          aoGravarAudio(new Blob(pedacos.current, { type: rec.mimeType || "audio/webm" }));
        }
      };
      rec.start();
      gravador.current = rec;
      setSegundos(0);
      setAGravar(true);
      timer.current = setInterval(() => setSegundos((s) => s + 1), 1e3);
    } catch {
      window.alert("Sem acesso ao microfone.");
    }
  };
  const terminar = (cancelar) => {
    cancelado.current = cancelar;
    gravador.current?.stop();
    gravador.current = null;
    pararTimer();
    setAGravar(false);
  };
  if (aGravar) {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: `flex items-center gap-3 border-0 border-t border-solid border-black/[.06] bg-[var(--maka-superficie)] ${compacto ? "p-2" : "p-3"}`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "h-3 w-3 animate-maka-pulsar rounded-full bg-red-500" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "font-mono text-sm text-[var(--maka-texto)]", children: [
        String(Math.floor(segundos / 60)).padStart(2, "0"),
        ":",
        String(segundos % 60).padStart(2, "0")
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "flex-1 text-xs text-[var(--maka-texto-suave)]", children: "a gravar\u2026" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BotaoIcone, { titulo: "Cancelar", onClick: () => terminar(true), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:trash", className: "text-red-500" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "button",
        {
          onClick: () => terminar(false),
          className: "grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-[var(--maka-primaria)] text-[var(--maka-primaria-contraste)] shadow-md transition-transform hover:scale-105",
          children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:send-2", className: "text-lg" })
        }
      )
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: `flex items-center gap-2 border-0 border-t border-solid border-black/[.06] bg-[var(--maka-superficie)] ${compacto ? "p-2" : "p-3"}`, children: [
    podeMedia && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BotaoIcone, { titulo: "Anexar", onClick: aoAnexar, children: aEnviarMedia ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:loader-2", className: "animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:paperclip" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "textarea",
      {
        rows: 1,
        className: "maka-scroll min-w-0 flex-1 resize-none rounded-2xl border border-solid border-slate-300/60 bg-[var(--maka-fundo)] px-4 py-2.5 text-sm leading-5 text-[var(--maka-texto)] outline-none transition-shadow placeholder:text-[var(--maka-texto-suave)] focus:ring-2 focus:ring-[var(--maka-primaria)]",
        style: { maxHeight: 132 },
        value: texto,
        placeholder,
        onChange: (e) => {
          setTexto(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = `${Math.min(e.target.scrollHeight, 132)}px`;
        },
        onKeyDown: (e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            aoEnviar();
            e.target.style.height = "auto";
          }
        }
      }
    ),
    texto.trim() === "" && podeGravar ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "button",
      {
        onClick: () => void comecarGravacao(),
        title: "Gravar \xE1udio",
        className: "grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-[var(--maka-primaria)] text-[var(--maka-primaria-contraste)] shadow-md transition-transform hover:scale-105 active:scale-95",
        children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:microphone", className: "text-lg" })
      }
    ) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "button",
      {
        onClick: aoEnviar,
        className: "grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-[var(--maka-primaria)] text-[var(--maka-primaria-contraste)] shadow-md transition-transform hover:scale-105 active:scale-95",
        children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:send-2", className: "text-lg" })
      }
    )
  ] });
}
function Bolha({ mensagem: m, minha, grupo, participantes, outros, acoes, todas, destacada, registarRef, aoAbrirFoto, aoClicarCitacao, aoVerReacoes, podeReagir, primeiraDoBloco = true, ultimaDoBloco = true, autor = null, compacto = false }) {
  const [hover, setHover] = (0, import_react8.useState)(false);
  const [picker, setPicker] = (0, import_react8.useState)(false);
  const [menu, setMenu] = (0, import_react8.useState)(false);
  const [menuCima, setMenuCima] = (0, import_react8.useState)(false);
  const [pickerBaixo, setPickerBaixo] = (0, import_react8.useState)(false);
  useFecharFora(picker || menu, `bolha-${m.id}`, () => {
    setPicker(false);
    setMenu(false);
  });
  const { aoAbrirPartilha } = useMakaChat();
  const respondida = m.resposta_a_id ? todas.find((x) => x.id === m.resposta_a_id) : null;
  const grupos = agruparReacoes(m.reacoes);
  if (m.tipo === "sistema") {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { ref: registarRef, className: "my-1 self-center rounded-full bg-slate-500/10 px-3.5 py-1 text-xs text-[var(--maka-texto-suave)]", children: m.conteudo });
  }
  if (m.tipo === "chamada") {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { ref: registarRef, className: "my-1 self-center", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(CartaoRegistoChamada, { mensagem: m }) });
  }
  const mostrarBarra = hover || picker || menu;
  const barra = mostrarBarra && !m.eliminada && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { "data-maka-pop": `bolha-${m.id}`, className: `absolute z-[2] flex items-center gap-0.5 rounded-full bg-[var(--maka-superficie)] px-1.5 py-1 shadow-md ring-1 ring-black/[.05] ${compacto ? `bottom-full ${minha ? "right-1" : "left-1"}` : `top-1/2 -translate-y-1/2 ${minha ? "right-[calc(100%+8px)]" : "left-[calc(100%+8px)]"}`}`, children: [
    podeReagir && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "button",
      {
        className: "grid h-7 w-7 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-base text-[var(--maka-texto-suave)] hover:bg-black/[.04] hover:text-[var(--maka-texto)]",
        title: "Reagir",
        onClick: (e) => {
          setPickerBaixo(direcaoMenu(e, 70) === "baixo" && e.currentTarget.getBoundingClientRect().top < 90);
          setPicker(!picker);
          setMenu(false);
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:mood-smile" })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { className: "grid h-7 w-7 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-base text-[var(--maka-texto-suave)] hover:bg-black/[.04] hover:text-[var(--maka-texto)]", title: "Responder", onClick: acoes.responder, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:arrow-back-up" }) }),
    (acoes.editar || acoes.eliminar || acoes.encaminhar) && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { className: "grid h-7 w-7 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-base text-[var(--maka-texto-suave)] hover:bg-black/[.04] hover:text-[var(--maka-texto)]", title: "Mais op\xE7\xF5es", onClick: (e) => {
      setMenuCima(direcaoMenu(e, 170) === "cima");
      setMenu(!menu);
      setPicker(false);
    }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:dots" }) })
  ] });
  const posBaixo = compacto ? "top-0" : "top-1/2 mt-5";
  const posCima = compacto ? "bottom-full mb-10" : "bottom-1/2 mb-5";
  const popovers = !m.eliminada && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
    picker && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { "data-maka-pop": `bolha-${m.id}`, className: `absolute ${pickerBaixo ? posBaixo : posCima} z-[3] flex animate-maka-subir items-center gap-1.5 rounded-full bg-[var(--maka-superficie)] px-3 py-1.5 shadow-maka-pop ring-1 ring-black/[.05] ${minha ? "right-0" : "left-0"}`, children: EMOJIS.map((e) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "button",
      {
        className: "cursor-pointer border-0 bg-transparent p-0 text-lg transition-transform hover:scale-125",
        onClick: () => {
          acoes.reagir?.(e);
          setPicker(false);
          setHover(false);
        },
        children: e
      },
      e
    )) }),
    menu && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { "data-maka-pop": `bolha-${m.id}`, className: `absolute ${menuCima ? posCima : posBaixo} z-[3] min-w-[150px] overflow-hidden rounded-xl bg-[var(--maka-superficie)] shadow-maka-pop ring-1 ring-black/[.05] ${minha ? "right-0" : "left-0"}`, children: [
      acoes.encaminhar && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(ItemMenu, { onClick: acoes.encaminhar, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:share-3", className: "inline align-[-2px]" }),
        " Encaminhar"
      ] }),
      acoes.editar && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(ItemMenu, { onClick: acoes.editar, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:pencil", className: "inline align-[-2px]" }),
        " Editar"
      ] }),
      acoes.eliminar && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(ItemMenu, { onClick: acoes.eliminar, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:trash", className: "inline align-[-2px]" }),
        " Eliminar"
      ] })
    ] })
  ] });
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
    "div",
    {
      ref: registarRef,
      className: `relative flex rounded-xl pt-1 ${destacada ? "animate-maka-flash" : ""} ${grupos.length ? "pb-3" : ""} ${minha ? "justify-end" : "justify-start"}`,
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => {
        setHover(false);
        if (!picker) setMenu(false);
      },
      children: [
        !minha && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "mr-1.5 w-7 shrink-0 self-end", children: ultimaDoBloco && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(AvatarWeb, { nome: autor?.nome ?? "?", url: autor?.foto_url, tamanho: 28 }) }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
          "div",
          {
            className: `relative flex max-w-[72%] flex-col gap-1 rounded-[var(--maka-raio)] px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,.04),0_4px_14px_-4px_rgba(15,23,42,.08)] transition-shadow ${destacada ? "ring-2 ring-[var(--maka-primaria)]" : ""} ${minha ? `bg-[var(--maka-bolha-minha)] text-[var(--maka-bolha-minha-texto)] ${ultimaDoBloco ? "rounded-br-md" : "rounded-r-md"}` : `bg-[var(--maka-bolha-outro)] text-[var(--maka-texto)] ${ultimaDoBloco ? "rounded-bl-md" : "rounded-l-md"}`}`,
            children: [
              barra,
              popovers,
              grupo && !minha && primeiraDoBloco && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "text-xs font-bold text-[var(--maka-primaria)]", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(NomeComBadge, { nome: autor?.nome ?? "\u2026", metadados: autor?.metadados }) }),
              m.resposta_a_id && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
                "button",
                {
                  onClick: () => aoClicarCitacao(m.resposta_a_id),
                  className: `cursor-pointer truncate rounded-md border-0 px-2 py-1 text-left text-xs text-inherit opacity-90 transition-opacity hover:opacity-100 ${minha ? "bg-white/20" : "bg-black/5"}`,
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:arrow-back-up", className: "mr-1 inline align-[-2px]" }),
                    respondida ? respondida.conteudo ?? "\u{1F4CE} anexo" : "Ver mensagem original"
                  ]
                }
              ),
              m.anexos.map((a) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(AnexoView, { anexo: a, aoAbrirFoto }, a.id)),
              !m.eliminada && (m.tipo === "partilha" || m.tipo === "link") && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(CartaoPartilha, { mensagem: m, minha, aoAbrir: aoAbrirPartilha }),
              m.eliminada ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("em", { className: "flex items-center gap-1 opacity-60", children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:ban" }),
                " Mensagem eliminada"
              ] }) : m.conteudo && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "whitespace-pre-wrap text-sm leading-relaxed", children: m.conteudo }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "flex items-center gap-1 self-end text-[10px] opacity-60", children: [
                m.encaminhada_de_id && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:share-3" }),
                m.editada_em ? "editada \xB7 " : "",
                horaCurtaWeb(m.criada_em),
                minha && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(TicksWeb, { mensagem: m, outros })
              ] })
            ]
          }
        ),
        grupos.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "button",
          {
            onClick: aoVerReacoes,
            className: `absolute -bottom-1 z-[1] flex cursor-pointer items-center gap-1 rounded-full border-0 bg-[var(--maka-superficie)] px-2 py-px text-[12px] shadow-md ring-1 ring-black/[.05] transition-transform hover:scale-105 ${minha ? "right-3" : "left-10"}`,
            children: grupos.map((g) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { children: [
              g.emoji,
              g.contagem > 1 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "ml-0.5 text-[10px] font-bold text-[var(--maka-texto-suave)]", children: g.contagem })
            ] }, g.emoji))
          }
        )
      ]
    }
  );
}
function agruparReacoes(reacoes) {
  const mapa = /* @__PURE__ */ new Map();
  for (const r of reacoes) {
    mapa.set(r.emoji, (mapa.get(r.emoji) ?? 0) + 1);
  }
  return [...mapa.entries()].map(([emoji, contagem]) => ({ emoji, contagem }));
}
function ModalReacoes({ mensagem, conversa, euId, aoFechar, aoRemoverMinha, aoMensagem }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "fixed inset-0 z-[10000] grid place-items-center bg-slate-900/50 backdrop-blur-sm", onClick: aoFechar, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "w-[340px] animate-maka-subir overflow-hidden rounded-2xl bg-[var(--maka-superficie)] shadow-maka-modal", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex items-center justify-between px-4 py-3", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "font-bold text-[var(--maka-texto)]", children: "Rea\xE7\xF5es" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BotaoIcone, { titulo: "Fechar", onClick: aoFechar, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:x" }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "maka-scroll max-h-[50vh] overflow-auto pb-2", children: [
      mensagem.reacoes.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "px-4 pb-4 text-sm text-[var(--maka-texto-suave)]", children: "Sem rea\xE7\xF5es." }),
      mensagem.reacoes.map((r) => {
        const p = conversa.participantes.find((x) => x.identidade_id === r.identidade_id);
        const souEu = r.identidade_id === euId;
        return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex items-center gap-3 px-4 py-2", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(AvatarWeb, { nome: p?.nome ?? "?", url: p?.foto_url, tamanho: 36 }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "min-w-0 flex-1", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "block truncate text-sm font-semibold text-[var(--maka-texto)]", children: souEu ? "Tu" : p?.nome ?? "Utilizador" }),
            souEu && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              "button",
              {
                onClick: () => {
                  aoRemoverMinha(r.emoji);
                  aoFechar();
                },
                className: "cursor-pointer border-0 bg-transparent p-0 text-xs text-[var(--maka-texto-suave)] hover:text-red-500",
                children: "Toca para remover"
              }
            )
          ] }),
          !souEu && aoMensagem && p && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BotaoIcone, { titulo: `Mensagem a ${p.nome}`, onClick: () => void aoMensagem(p), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:message-circle" }) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "text-xl", children: r.emoji })
        ] }, r.identidade_id);
      })
    ] })
  ] }) });
}
function PreviewFotos({ ficheiros, aoRemover, aoAdicionarMais, aoFechar, aoEnviar }) {
  const [legenda, setLegenda] = (0, import_react8.useState)("");
  const urls = (0, import_react8.useMemo)(() => ficheiros.map((f) => URL.createObjectURL(f)), [ficheiros]);
  (0, import_react8.useEffect)(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "fixed inset-0 z-[10001] grid place-items-center bg-slate-900/70 backdrop-blur-sm", onClick: aoFechar, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex w-[460px] max-w-[94vw] animate-maka-subir flex-col overflow-hidden rounded-2xl bg-[var(--maka-superficie)] shadow-maka-modal", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex items-center justify-between px-4 py-3", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "font-bold text-[var(--maka-texto)]", children: [
        "Enviar ",
        ficheiros.length === 1 ? "foto" : `${ficheiros.length} fotos`
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BotaoIcone, { titulo: "Fechar", onClick: aoFechar, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:x" }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("img", { src: urls[0], className: "max-h-[42vh] w-full bg-black object-contain", alt: "" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "maka-scroll flex gap-2 overflow-x-auto px-3 py-2.5", children: [
      urls.map((u, i) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "relative shrink-0", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("img", { src: u, className: "h-16 w-16 rounded-lg object-cover ring-1 ring-black/[.05]", alt: "" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "button",
          {
            onClick: () => aoRemover(i),
            className: "absolute -right-1.5 -top-1.5 grid h-5 w-5 cursor-pointer place-items-center rounded-full border-0 bg-slate-900 text-[10px] text-white shadow",
            title: "Remover",
            children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:x" })
          }
        )
      ] }, i)),
      ficheiros.length < 10 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "button",
        {
          onClick: aoAdicionarMais,
          className: "grid h-16 w-16 shrink-0 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-slate-300 bg-transparent text-xl text-[var(--maka-texto-suave)] hover:border-[var(--maka-primaria)] hover:text-[var(--maka-primaria)]",
          title: "Adicionar mais",
          children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:plus" })
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex items-center gap-2 p-3", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "input",
        {
          autoFocus: true,
          className: "min-w-0 flex-1 rounded-full border border-solid border-slate-300/60 bg-[var(--maka-fundo)] px-4 py-2.5 text-sm text-[var(--maka-texto)] outline-none focus:ring-2 focus:ring-[var(--maka-primaria)]",
          placeholder: "Legenda (opcional)",
          value: legenda,
          onChange: (e) => setLegenda(e.target.value),
          onKeyDown: (e) => e.key === "Enter" && aoEnviar(legenda)
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "button",
        {
          onClick: () => aoEnviar(legenda),
          className: "grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-[var(--maka-primaria)] text-[var(--maka-primaria-contraste)] shadow-md transition-transform hover:scale-105",
          children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:send-2", className: "text-lg" })
        }
      )
    ] })
  ] }) });
}
function AnexoView({ anexo: a, aoAbrirFoto }) {
  if (!a.url) return null;
  if (a.tipo === "foto")
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("img", { src: a.url, className: "max-w-[240px] cursor-pointer rounded-xl transition-opacity hover:opacity-90", alt: "", onClick: () => aoAbrirFoto(a.url) });
  if (a.tipo === "video") return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("video", { src: a.url, controls: true, className: "max-w-[260px] rounded-xl" });
  if (a.tipo === "audio") return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ReprodutorAudio, { url: a.url });
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(CartaoFicheiro, { anexo: a });
}
var ICONE_POR_EXTENSAO = {
  pdf: "tabler:file-type-pdf",
  doc: "tabler:file-type-doc",
  docx: "tabler:file-type-doc",
  xls: "tabler:file-type-xls",
  xlsx: "tabler:file-type-xls",
  csv: "tabler:file-type-xls",
  ppt: "tabler:file-type-ppt",
  pptx: "tabler:file-type-ppt",
  zip: "tabler:file-zip",
  rar: "tabler:file-zip",
  "7z": "tabler:file-zip",
  mp3: "tabler:file-music",
  wav: "tabler:file-music",
  webm: "tabler:file-music",
  jpg: "tabler:photo",
  jpeg: "tabler:photo",
  png: "tabler:photo",
  gif: "tabler:photo",
  txt: "tabler:file-text"
};
function CartaoFicheiro({ anexo: a }) {
  const nome = a.nome_ficheiro ?? "Ficheiro";
  const extensao = (nome.includes(".") ? nome.split(".").pop() ?? "" : "").toLowerCase();
  const icone = ICONE_POR_EXTENSAO[extensao] ?? "tabler:file";
  const tamanho = a.tamanho_bytes ? a.tamanho_bytes >= 1024 * 1024 ? `${(a.tamanho_bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(a.tamanho_bytes / 1024))} KB` : "";
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex w-[250px] items-center gap-2.5 rounded-xl bg-black/10 p-2.5", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: icone, className: "shrink-0 text-4xl opacity-90" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "min-w-0 flex-1", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "block truncate text-[13px] font-semibold", title: nome, children: nome }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "block text-[11px] opacity-70", children: [extensao.toUpperCase(), tamanho].filter(Boolean).join(" \xB7 ") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "a",
      {
        href: urlDownload(a.url),
        download: nome,
        className: "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/15 text-inherit transition-transform hover:scale-105",
        title: "Descarregar",
        children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:download", className: "text-lg" })
      }
    )
  ] });
}
function Galeria({ itens, indiceInicial, aoFechar, aoResponder, aoEncaminhar, aoEliminar }) {
  const [indice, setIndice] = (0, import_react8.useState)(indiceInicial);
  const atual = itens[indice];
  (0, import_react8.useEffect)(() => {
    const aoTecla = (e) => {
      if (e.key === "Escape") aoFechar();
      if (e.key === "ArrowLeft") setIndice((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIndice((i) => Math.min(itens.length - 1, i + 1));
    };
    window.addEventListener("keydown", aoTecla);
    return () => window.removeEventListener("keydown", aoTecla);
  }, [itens.length, aoFechar]);
  const Botao = ({ titulo, onClick, children }) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "button",
    {
      title: titulo,
      onClick: (e) => {
        e.stopPropagation();
        onClick();
      },
      className: "grid h-10 w-10 cursor-pointer place-items-center rounded-full border-0 bg-white/15 text-lg text-white transition-colors hover:bg-white/30",
      children
    }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "fixed inset-0 z-[10001] grid place-items-center bg-black/90 backdrop-blur-sm", onClick: aoFechar, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("img", { src: atual.url, className: "max-h-[84vh] max-w-[90vw] rounded-xl shadow-2xl", alt: "", onClick: (e) => e.stopPropagation() }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-white/15 px-3 py-1 text-sm text-white", children: [
      indice + 1,
      " / ",
      itens.length
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "absolute right-4 top-4 flex items-center gap-2", onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Botao, { titulo: "Responder", onClick: () => aoResponder(atual.mensagem), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:arrow-back-up" }) }),
      aoEncaminhar && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Botao, { titulo: "Reencaminhar", onClick: () => aoEncaminhar(atual.mensagem), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:share-3" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "a",
        {
          href: urlDownload(atual.url),
          download: atual.nome,
          title: "Baixar",
          onClick: (e) => e.stopPropagation(),
          className: "grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-white/15 text-lg text-white transition-colors hover:bg-white/30",
          children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:download" })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Botao, { titulo: "Eliminar", onClick: () => aoEliminar(atual.mensagem), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:trash" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Botao, { titulo: "Fechar", onClick: aoFechar, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:x" }) })
    ] }),
    indice > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "button",
      {
        className: "absolute left-4 top-1/2 grid h-12 w-12 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-0 bg-white/15 text-2xl text-white hover:bg-white/25",
        onClick: (e) => {
          e.stopPropagation();
          setIndice(indice - 1);
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:chevron-left" })
      }
    ),
    indice < itens.length - 1 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "button",
      {
        className: "absolute right-4 top-1/2 grid h-12 w-12 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-0 bg-white/15 text-2xl text-white hover:bg-white/25",
        onClick: (e) => {
          e.stopPropagation();
          setIndice(indice + 1);
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:chevron-right" })
      }
    )
  ] });
}
function ItemMenu({ onClick, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { onClick, className: "block w-full cursor-pointer whitespace-nowrap border-0 bg-transparent px-4 py-2 text-left text-[13px] text-[var(--maka-texto)] hover:bg-black/[.04]", children });
}
function BotaoIcone({ onClick, titulo, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "button",
    {
      title: titulo,
      onClick,
      className: "grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-[17px] text-[var(--maka-texto-suave)] transition-colors hover:bg-black/[.04] hover:text-[var(--maka-texto)]",
      children
    }
  );
}
function ConfirmarDialogo({ titulo, descricao, botoes, aoFechar }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "fixed inset-0 z-[10002] grid place-items-center bg-slate-900/50 backdrop-blur-sm", onClick: aoFechar, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "w-[320px] animate-maka-subir overflow-hidden rounded-2xl bg-[var(--maka-superficie)] p-5 shadow-2xl", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "mb-1 font-bold text-[var(--maka-texto)]", children: titulo }),
    descricao && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "mb-3 text-[13px] text-[var(--maka-texto-suave)]", children: descricao }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "mt-3 flex flex-col gap-2", children: [
      botoes.map((b) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "button",
        {
          onClick: () => {
            b.acao();
            aoFechar();
          },
          className: `w-full cursor-pointer rounded-full border-0 py-2.5 text-sm font-bold shadow-sm transition-transform hover:scale-[1.02] ${b.destrutivo ? "bg-red-600 text-white" : "bg-[var(--maka-primaria)] text-[var(--maka-primaria-contraste)]"}`,
          children: b.rotulo
        },
        b.rotulo
      )),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { onClick: aoFechar, className: "w-full cursor-pointer rounded-full border-0 bg-[var(--maka-fundo)] py-2.5 text-sm font-semibold text-[var(--maka-texto)]", children: "Cancelar" })
    ] })
  ] }) });
}
function EscolherConversas({ titulo, aoConfirmar, aoFechar }) {
  const { engine } = useMakaChat();
  const versao = useVersaoChat();
  const [conversas, setConversas] = (0, import_react8.useState)([]);
  const [escolhidas, setEscolhidas] = (0, import_react8.useState)(/* @__PURE__ */ new Set());
  (0, import_react8.useEffect)(() => {
    void engine.storage.listarConversas(false).then(setConversas);
  }, [engine, versao]);
  const alternar = (id) => {
    setEscolhidas((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "fixed inset-0 z-[10000] grid place-items-center bg-slate-900/50 backdrop-blur-sm", onClick: aoFechar, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex max-h-[70vh] w-[360px] animate-maka-subir flex-col overflow-hidden rounded-2xl bg-[var(--maka-superficie)] shadow-maka-modal", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex items-center justify-between px-4 py-3", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "font-bold text-[var(--maka-texto)]", children: titulo }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BotaoIcone, { titulo: "Fechar", onClick: aoFechar, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:x" }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "maka-scroll flex-1 overflow-auto", children: conversas.map((c) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      "button",
      {
        onClick: () => alternar(c.id),
        className: "flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-4 py-2.5 text-left hover:bg-black/[.04]",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            import_react7.Icon,
            {
              icon: escolhidas.has(c.id) ? "tabler:circle-check-filled" : "tabler:circle",
              className: `text-xl ${escolhidas.has(c.id) ? "text-[var(--maka-primaria)]" : "text-[var(--maka-texto-suave)]"}`
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(AvatarWeb, { nome: c.titulo ?? "?", url: c.foto_url, tamanho: 34 }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "min-w-0 flex-1 truncate text-sm font-semibold text-[var(--maka-texto)]", children: c.titulo ?? "Conversa" })
        ]
      },
      c.id
    )) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "p-3", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      "button",
      {
        disabled: escolhidas.size === 0,
        onClick: () => aoConfirmar([...escolhidas]),
        className: "w-full cursor-pointer rounded-full border-0 bg-[var(--maka-primaria)] py-2.5 text-sm font-bold text-[var(--maka-primaria-contraste)] shadow-md transition-opacity disabled:cursor-default disabled:opacity-40",
        children: [
          "Enviar",
          escolhidas.size > 0 ? ` (${escolhidas.size})` : ""
        ]
      }
    ) })
  ] }) });
}
function TicksWeb({ mensagem, outros }) {
  if (mensagem.estado_envio === "a_enviar") return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:clock" });
  if (mensagem.estado_envio === "falhou") return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:alert-circle", className: "text-red-500" });
  const entregue = outros.length > 0 && outros.every((p) => (0, import_makachat_core2.idMaiorOuIgual)(p.ultima_entrega_mensagem_id, mensagem.id));
  const lida = outros.length > 0 && outros.every((p) => (0, import_makachat_core2.idMaiorOuIgual)(p.ultima_leitura_mensagem_id, mensagem.id));
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    import_react7.Icon,
    {
      icon: entregue || lida ? "tabler:checks" : "tabler:check",
      className: `text-[13px] ${lida ? "text-sky-400" : "opacity-60"}`
    }
  );
}
function AvatarWeb({ nome, url, tamanho = 44, grupo = false }) {
  if (!url && grupo) {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "span",
      {
        className: "grid shrink-0 place-items-center rounded-full bg-[var(--maka-primaria)] text-[var(--maka-primaria-contraste)] ring-1 ring-black/[.05]",
        style: { width: tamanho, height: tamanho, fontSize: tamanho * 0.5 },
        children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: "tabler:users-group" })
      }
    );
  }
  if (url) {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "img",
      {
        src: url,
        alt: nome,
        className: "shrink-0 rounded-full object-cover ring-1 ring-black/[.05]",
        style: { width: tamanho, height: tamanho }
      }
    );
  }
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "span",
    {
      className: "grid shrink-0 place-items-center rounded-full bg-[var(--maka-primaria)] font-bold text-[var(--maka-primaria-contraste)] ring-1 ring-black/[.05]",
      style: { width: tamanho, height: tamanho, fontSize: tamanho * 0.42 },
      children: nome.trim().charAt(0).toUpperCase() || "?"
    }
  );
}
function urlDownload(url) {
  return `${url}${url.includes("?") ? "&" : "?"}download=1`;
}
function horaCurtaWeb(iso) {
  const data = new Date(iso);
  if (data.toDateString() === (/* @__PURE__ */ new Date()).toDateString()) {
    return data.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
  }
  return data.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
}
function CartaoRegistoChamada({ mensagem: m }) {
  const chamadas = useChamadasOpcional();
  const meta = m.metadados ?? {};
  const video = meta.chamada_tipo === "video";
  const atendida = meta.resultado === "atendida";
  const dur = meta.duracao_segundos ?? 0;
  const mmss = `${String(Math.floor(dur / 60)).padStart(2, "0")}:${String(dur % 60).padStart(2, "0")}`;
  const podeLigar = useFuncionalidadeAtiva(video ? "chamadas.video" : "chamadas.audio");
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex items-center gap-3 rounded-2xl bg-[var(--maka-superficie)] px-4 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,.04),0_4px_14px_-4px_rgba(15,23,42,.08)]", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: `grid h-9 w-9 place-items-center rounded-full ${atendida ? "bg-emerald-500/15 text-emerald-600" : "bg-red-500/15 text-red-500"}`, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: video ? atendida ? "tabler:video" : "tabler:video-off" : atendida ? "tabler:phone" : "tabler:phone-x" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "flex flex-col", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "text-sm font-semibold text-[var(--maka-texto)]", children: [
        "Chamada de ",
        video ? "v\xEDdeo" : "voz"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: `text-xs ${atendida ? "text-[var(--maka-texto-suave)]" : "font-semibold text-red-500"}`, children: [
        atendida ? `Dura\xE7\xE3o ${mmss}` : "N\xE3o atendida",
        " \xB7 ",
        horaCurtaWeb(m.criada_em)
      ] })
    ] }),
    chamadas && podeLigar && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "button",
      {
        title: "Ligar de novo",
        onClick: () => void chamadas.iniciar(m.conversa_id, video ? "video" : "audio"),
        className: "ml-2 grid h-9 w-9 cursor-pointer place-items-center rounded-full border-0 bg-[var(--maka-primaria)] text-[var(--maka-primaria-contraste)] shadow-sm transition-transform hover:scale-105",
        children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react7.Icon, { icon: video ? "tabler:video" : "tabler:phone" })
      }
    )
  ] });
}

// src/boxes.tsx
var import_react9 = require("@iconify/react");
var import_react10 = __toESM(require("react"));
var import_jsx_runtime5 = require("react/jsx-runtime");
function MakaChatBoxFull({ conversaAbertaId, queryParam = "conversa" } = {}) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "fixed inset-0 z-[9000] bg-[var(--maka-fundo)]", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(DuasColunas, { conversaAbertaId, queryParam }) });
}
function MakaChatBoxMin({ conversaAbertaId, queryParam = "conversa" } = {}) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "h-full min-h-[420px] w-full overflow-hidden rounded-2xl bg-[var(--maka-fundo)] shadow-sm ring-1 ring-black/[.05]", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(DuasColunas, { conversaAbertaId, queryParam }) });
}
function DuasColunas({ conversaAbertaId, queryParam }) {
  const { engine } = useMakaChat();
  const semLigacao = useSemLigacao();
  const [ativa, setAtiva] = (0, import_react10.useState)(conversaAbertaId ?? null);
  (0, import_react10.useEffect)(() => {
    if (conversaAbertaId) setAtiva(conversaAbertaId);
  }, [conversaAbertaId]);
  (0, import_react10.useEffect)(() => {
    if (!queryParam || typeof window === "undefined") return;
    const id = new URLSearchParams(window.location.search).get(queryParam);
    if (!id) return;
    void engine.entrarConversa(id).then(() => setAtiva(id));
  }, [queryParam]);
  const [estreita, setEstreita] = (0, import_react10.useState)(false);
  const ref = import_react10.default.useRef(null);
  (0, import_react10.useEffect)(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setEstreita(el.clientWidth < 640));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const mostrarLista = !estreita || !ativa;
  const mostrarPainel = !estreita || !!ativa;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { ref, className: "flex h-full flex-col", children: [
    semLigacao && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-800", children: "\u26A0\uFE0F Sem liga\xE7\xE3o ao chat \u2014 a tentar reconectar\u2026" }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex min-h-0 flex-1", children: [
      mostrarLista && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: `h-full border-0 border-r border-solid border-black/[.06] ${estreita ? "w-full" : "w-[340px] shrink-0"}`, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(MakaChatConversas, { conversaAtivaId: ativa, onAbrirConversa: (c) => setAtiva(c.id) }) }),
      mostrarPainel && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "h-full min-w-0 flex-1", children: ativa ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        ConversaPainel,
        {
          conversaId: ativa,
          aoFechar: estreita ? () => setAtiva(null) : void 0,
          aoAbrirOutraConversa: setAtiva
        }
      ) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "grid h-full place-items-center", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex flex-col items-center gap-3 text-[var(--maka-texto-suave)]", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "grid h-16 w-16 place-items-center rounded-full bg-[var(--maka-superficie)] text-3xl shadow-sm", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_react9.Icon, { icon: "tabler:message-circle", className: "text-[var(--maka-primaria)]" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "text-sm", children: "Escolhe uma conversa para come\xE7ar" })
      ] }) }) })
    ] })
  ] });
}
var DockCtx = (0, import_react10.createContext)(null);
function useDock() {
  const ctx = (0, import_react10.useContext)(DockCtx);
  if (!ctx) throw new Error("useDock requer <MakaChatDock>");
  return ctx;
}
function boxesQueCabem() {
  if (typeof window === "undefined") return 1;
  return Math.max(1, Math.floor((window.innerWidth - 96) / 348));
}
function MakaChatDock({ autoAbrir = true, visivel = true, maxBoxes = 3, queryParam = false, children }) {
  const { estaVisivel, engine } = useMakaChat();
  const conversas = useConversas();
  const versao = useVersaoChat();
  const [boxes, setBoxes] = (0, import_react10.useState)([]);
  const [popover, setPopover] = (0, import_react10.useState)(false);
  const [capacidade, setCapacidade] = (0, import_react10.useState)(() => boxesQueCabem());
  useFecharFora(popover, "dock-popover", () => setPopover(false));
  const limite = Math.max(1, Math.min(maxBoxes, capacidade));
  (0, import_react10.useEffect)(() => {
    const aoRedimensionar = () => setCapacidade(boxesQueCabem());
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, []);
  (0, import_react10.useEffect)(() => {
    setBoxes((atuais) => atuais.length > limite ? atuais.slice(-limite) : atuais);
  }, [limite]);
  const abrir = (0, import_react10.useCallback)(
    (conversaId, opcoes) => {
      const minimizada = opcoes?.minimizada ?? false;
      setPopover(false);
      setBoxes((atuais) => {
        if (atuais.some((b) => b.conversaId === conversaId)) {
          return minimizada ? atuais : atuais.map((b) => b.conversaId === conversaId ? { ...b, minimizada: false } : b);
        }
        return [...atuais, { conversaId, minimizada }].slice(-limite);
      });
    },
    [limite]
  );
  const fechar = (0, import_react10.useCallback)((conversaId) => {
    setBoxes((atuais) => atuais.filter((b) => b.conversaId !== conversaId));
  }, []);
  (0, import_react10.useEffect)(() => {
    if (!queryParam || typeof window === "undefined") return;
    const id = new URLSearchParams(window.location.search).get(queryParam);
    if (!id) return;
    void engine.entrarConversa(id).then(() => abrir(id));
  }, [queryParam]);
  (0, import_react10.useEffect)(() => {
    if (!autoAbrir || !visivel) return;
    const comNaoLidas = conversas.find(
      (c) => (c.participante?.mensagens_nao_lidas ?? 0) > 0 && !estaVisivel(c.id)
    );
    if (comNaoLidas && !boxes.some((b) => b.conversaId === comNaoLidas.id)) {
      abrir(comNaoLidas.id, { minimizada: true });
    }
  }, [versao, autoAbrir]);
  const naoLidas = conversas.reduce((soma, c) => soma + (c.participante?.mensagens_nao_lidas ?? 0), 0);
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(DockCtx.Provider, { value: { abrir, fechar }, children: [
    children,
    visivel && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "fixed bottom-0 right-4 z-[9500] flex items-end gap-3", children: [
      boxes.map((box) => {
        const conversa = conversas.find((c) => c.id === box.conversaId);
        return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            className: `flex w-[336px] animate-maka-subir flex-col overflow-hidden rounded-t-2xl bg-[var(--maka-superficie)] shadow-maka-modal ring-1 ring-black/[.05] transition-[height] duration-200 ${box.minimizada ? "h-12" : "h-[480px]"}`,
            children: box.minimizada ? (
              // minimizada: barra com título/não-lidas; aberta usa só o header do painel (header único)
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
                "button",
                {
                  className: "flex w-full cursor-pointer items-center gap-2.5 border-0 bg-[var(--maka-primaria)] px-3 py-2 text-left text-[var(--maka-primaria-contraste)]",
                  onClick: () => setBoxes((a) => a.map((b) => b.conversaId === box.conversaId ? { ...b, minimizada: false } : b)),
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(AvatarWeb, { nome: conversa?.titulo ?? "?", url: conversa?.foto_url, tamanho: 26 }),
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "min-w-0 flex-1 truncate text-[13px] font-semibold", children: conversa?.titulo ?? "Conversa" }),
                    (conversa?.participante?.mensagens_nao_lidas ?? 0) > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "animate-maka-pulsar rounded-full bg-red-600 px-1.5 py-px text-[11px] font-bold text-white", children: conversa?.participante?.mensagens_nao_lidas }),
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                      "span",
                      {
                        className: "grid h-6 w-6 place-items-center rounded-full transition-colors hover:bg-black/15",
                        onClick: (e) => {
                          e.stopPropagation();
                          fechar(box.conversaId);
                        },
                        children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_react9.Icon, { icon: "tabler:x", className: "text-sm" })
                      }
                    )
                  ]
                }
              )
            ) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "min-h-0 flex-1", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              ConversaPainel,
              {
                conversaId: box.conversaId,
                compacto: true,
                aoAbrirOutraConversa: abrir,
                aoMinimizar: () => setBoxes((a) => a.map((b) => b.conversaId === box.conversaId ? { ...b, minimizada: true } : b)),
                aoFechar: () => fechar(box.conversaId)
              }
            ) })
          },
          box.conversaId
        );
      }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "relative z-[20] mb-4", "data-maka-pop": "dock-popover", children: [
        popover && // z acima dos menus internos das boxes (z-[1..6]) — senão os popovers das bolhas atravessam a lista
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "absolute bottom-16 right-0 z-[20] flex h-[440px] max-h-[70vh] w-[330px] animate-maka-subir flex-col overflow-hidden rounded-2xl bg-[var(--maka-superficie)] shadow-maka-modal ring-1 ring-black/[.05]", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(MakaChatConversas, { onAbrirConversa: (c) => abrir(c.id) }) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
          "button",
          {
            onClick: () => setPopover(!popover),
            className: "relative grid h-14 w-14 cursor-pointer place-items-center rounded-full border-0 bg-[var(--maka-primaria)] text-2xl text-[var(--maka-primaria-contraste)] shadow-xl transition-transform hover:scale-105 active:scale-95",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_react9.Icon, { icon: "tabler:message-circle" }),
              naoLidas > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "absolute -right-1 -top-1 animate-maka-pulsar rounded-full bg-red-600 px-1.5 py-px text-[11px] font-bold text-white", children: naoLidas })
            ]
          }
        )
      ] })
    ] })
  ] });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AvatarWeb,
  ChamadasProvider,
  ConversaPainel,
  MakaChatBoxFull,
  MakaChatBoxMin,
  MakaChatConversa,
  MakaChatConversas,
  MakaChatDock,
  MakaChatProvider,
  comecarToque,
  mostrarNotificacao,
  notificacoesSuportadas,
  pararToque,
  pedirPermissaoNotificacoes,
  tocarSom,
  useChamadas,
  useChamadasOpcional,
  useConversas,
  useDock,
  useEnviarMensagem,
  useFuncionalidadeAtiva,
  useLigacao,
  useMakaChat,
  useMensagemRecebida,
  useMensagens,
  usePresenca,
  useSemLigacao,
  useTotalNaoLidas,
  useTypingConversa,
  useVersaoChat,
  ...require("@hongayetu/makachat-core")
});
//# sourceMappingURL=index.cjs.map