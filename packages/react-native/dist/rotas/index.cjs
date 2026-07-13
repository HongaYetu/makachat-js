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

// src/rotas/index.tsx
var rotas_exports = {};
__export(rotas_exports, {
  LayoutChatMakaChat: () => LayoutChatMakaChat,
  RotaArquivadas: () => RotaArquivadas,
  RotaConversa: () => RotaConversa,
  RotaInfoConversa: () => RotaInfoConversa,
  RotaNovaConversa: () => RotaNovaConversa,
  RotaPesquisarConversas: () => RotaPesquisarConversas
});
module.exports = __toCommonJS(rotas_exports);
var import_vector_icons10 = require("@expo/vector-icons");
var import_native = require("@react-navigation/native");
var import_expo_router = require("expo-router");
var import_react13 = require("react");
var import_react_native11 = require("react-native");
var import_react_native_safe_area_context6 = require("react-native-safe-area-context");

// src/chamadas.tsx
var import_vector_icons2 = require("@expo/vector-icons");
var import_react_native_safe_area_context2 = require("react-native-safe-area-context");
var import_react5 = require("react");
var import_react_native3 = require("react-native");

// src/opcionais.ts
var obterImagePicker = () => {
  try {
    return require("expo-image-picker");
  } catch {
    return null;
  }
};
var obterDocumentPicker = () => {
  try {
    return require("expo-document-picker");
  } catch {
    return null;
  }
};
var obterAudio = () => {
  try {
    return require("expo-audio");
  } catch {
    return null;
  }
};
var obterVideo = () => {
  try {
    return require("expo-video");
  } catch {
    return null;
  }
};
var obterFileSystem = () => {
  try {
    return require("expo-file-system/legacy");
  } catch {
  }
  try {
    return require("expo-file-system");
  } catch {
    return null;
  }
};
var obterSharing = () => {
  try {
    return require("expo-sharing");
  } catch {
    return null;
  }
};
var obterIntentLauncher = () => {
  try {
    return require("expo-intent-launcher");
  } catch {
    return null;
  }
};
var obterNotifee = () => {
  try {
    const m = require("@notifee/react-native");
    return m?.default ?? m;
  } catch {
    return null;
  }
};
var obterPushMakaChat = () => {
  try {
    return require("@hongayetu/expo-makachat-push");
  } catch {
    return null;
  }
};
var obterKeyboardController = () => {
  try {
    return require("react-native-keyboard-controller");
  } catch {
    return null;
  }
};

// src/hooks.ts
var import_react2 = require("react");

// src/provider.tsx
var import_makachat_core = require("@hongayetu/makachat-core");
var import_react = require("react");
var import_react_native = require("react-native");
var import_bottom_sheet = require("@gorhom/bottom-sheet");

// src/sons.ts
var FONTES = {
  recebida: require("../mensagem_recebida-MZY2YITP.mp3"),
  enviada: require("../mensagem_enviada-DDE7GUQI.mp3"),
  vista: require("../mensagem_vista-UJR4F6F5.mp3"),
  a_chamar: require("../a_chamar-DLXA46AB.mp3"),
  toque_receber: require("../toque_receber-LUIEOINS.mp3")
};
var cache = /* @__PURE__ */ new Map();
function tocarSom(nome) {
  const audio = obterAudio();
  if (!audio?.createAudioPlayer) return;
  try {
    let p = cache.get(nome);
    if (!p) {
      p = audio.createAudioPlayer(FONTES[nome]);
      cache.set(nome, p);
    }
    p.seekTo?.(0);
    p.play();
  } catch {
  }
}

// src/provider.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var alcanceGlobal = globalThis;
var Contexto = alcanceGlobal.__makaChatCtx ??= (0, import_react.createContext)(null);
function useMakaChat() {
  const contexto = (0, import_react.useContext)(Contexto);
  if (!contexto) {
    throw new Error("useMakaChat tem de ser usado dentro de <MakaChatProvider>");
  }
  return contexto;
}
function useMakaChatOpcional() {
  return (0, import_react.useContext)(Contexto);
}
function useTema() {
  return useMakaChat().tema;
}

// src/hooks.ts
var import_react3 = require("react");
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
      const unicas = Array.from(new Map(lista.map((c) => [c.id, c])).values());
      const ordenada = unicas.sort(
        (a, b) => (Date.parse(b.ultima_atividade_em ?? "") || 0) - (Date.parse(a.ultima_atividade_em ?? "") || 0)
      );
      if (ativo) setConversas(ordenada);
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
function useFuncionalidadeAtiva(funcionalidade, tipoConversa = "*") {
  const { features } = useMakaChat();
  const especifica = features.find((f) => f.funcionalidade === funcionalidade && f.tipo_conversa === tipoConversa);
  if (especifica) {
    return especifica.ativo;
  }
  return features.find((f) => f.funcionalidade === funcionalidade && f.tipo_conversa === "*")?.ativo ?? false;
}
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

// src/ui/comum.tsx
var import_vector_icons = require("@expo/vector-icons");
var import_react4 = require("react");
var import_react_native2 = require("react-native");
var import_bottom_sheet2 = require("@gorhom/bottom-sheet");
var import_react_native_safe_area_context = require("react-native-safe-area-context");
var import_jsx_runtime2 = require("react/jsx-runtime");
function ListaPerformante(props) {
  const { estimatedItemSize: _ignorado, ...resto } = props;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native2.FlatList, { ...resto });
}
function Avatar({ nome, url, tamanho = 48 }) {
  const tema = useTema();
  if (url) {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native2.Image, { source: { uri: url }, style: { width: tamanho, height: tamanho, borderRadius: tamanho / 2 } });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    import_react_native2.View,
    {
      style: {
        width: tamanho,
        height: tamanho,
        borderRadius: tamanho / 2,
        backgroundColor: tema.primaria,
        alignItems: "center",
        justifyContent: "center"
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native2.Text, { style: { color: tema.primariaContraste, fontWeight: "700", fontSize: tamanho * 0.42 }, children: (nome || "?").trim().charAt(0).toUpperCase() })
    }
  );
}
function NomeComBadge({
  nome,
  metadados,
  estilo,
  numeroLinhas = 1
}) {
  const tema = useTema();
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_react_native2.View, { style: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native2.Text, { numberOfLines: numeroLinhas, style: [{ flexShrink: 1 }, estilo], children: nome }),
    metadados?.verificado === true && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_vector_icons.Ionicons, { name: "checkmark-circle", size: 15, color: tema.primaria })
  ] });
}
function contraparteDe(c, identidade) {
  if (c.tipo !== "privada") return null;
  return c.participantes.find((p) => !(p.id_externo === identidade.id && p.tipo === identidade.tipo)) ?? null;
}
function horaCurta(iso) {
  const data = new Date(iso);
  const hoje = /* @__PURE__ */ new Date();
  if (data.toDateString() === hoje.toDateString()) {
    return `${String(data.getHours()).padStart(2, "0")}:${String(data.getMinutes()).padStart(2, "0")}`;
  }
  return `${String(data.getDate()).padStart(2, "0")}/${String(data.getMonth() + 1).padStart(2, "0")}`;
}
function rotuloDia(iso) {
  const data = new Date(iso);
  const hoje = /* @__PURE__ */ new Date();
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  if (data.toDateString() === hoje.toDateString()) return "Hoje";
  if (data.toDateString() === ontem.toDateString()) return "Ontem";
  return data.toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" });
}
function duracaoMmSs(segundos) {
  return `${String(Math.floor(segundos / 60)).padStart(2, "0")}:${String(Math.floor(segundos % 60)).padStart(2, "0")}`;
}
function Sheet({
  visivel,
  aoFechar,
  titulo,
  itens,
  children
}) {
  const tema = useTema();
  const insets = (0, import_react_native_safe_area_context.useSafeAreaInsets)();
  const ref = (0, import_react4.useRef)(null);
  (0, import_react4.useEffect)(() => {
    if (visivel) ref.current?.present();
    else ref.current?.dismiss();
  }, [visivel]);
  const backdrop = (0, import_react4.useCallback)(
    (props) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_bottom_sheet2.BottomSheetBackdrop, { ...props, appearsOnIndex: 0, disappearsOnIndex: -1, pressBehavior: "close" }),
    []
  );
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    import_bottom_sheet2.BottomSheetModal,
    {
      ref,
      enableDynamicSizing: true,
      onDismiss: aoFechar,
      backdropComponent: backdrop,
      handleIndicatorStyle: { backgroundColor: "rgba(100,116,139,0.35)" },
      backgroundStyle: { backgroundColor: tema.superficie, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
      children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_bottom_sheet2.BottomSheetView, { style: { paddingTop: 4, paddingBottom: insets.bottom + 12 }, children: [
        titulo ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native2.Text, { style: [estilos.sheetTitulo, { color: tema.textoSuave }], numberOfLines: 1, children: titulo }) : null,
        itens?.map((item) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
          import_react_native2.Pressable,
          {
            onPress: () => {
              ref.current?.dismiss();
              item.acao();
            },
            style: ({ pressed }) => [estilos.sheetItem, pressed && { backgroundColor: "rgba(0,0,0,0.05)" }],
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_vector_icons.Ionicons, { name: item.icone, size: 21, color: item.destrutivo ? "#ef4444" : tema.textoSuave }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native2.Text, { style: { fontSize: 15, color: item.destrutivo ? "#ef4444" : tema.texto }, children: item.rotulo })
            ]
          },
          item.rotulo
        )),
        children
      ] })
    }
  );
}
function BadgeNaoLidas({ contagem }) {
  const tema = useTema();
  if (contagem <= 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native2.View, { style: [estilos.badge, { backgroundColor: tema.primaria }], children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native2.Text, { style: { color: tema.primariaContraste, fontSize: 11, fontWeight: "700" }, children: contagem > 99 ? "99+" : contagem }) });
}
function Pulso({ children }) {
  const escala = (0, import_react4.useRef)(new import_react_native2.Animated.Value(1)).current;
  (0, import_react4.useEffect)(() => {
    const ciclo = import_react_native2.Animated.loop(
      import_react_native2.Animated.sequence([
        import_react_native2.Animated.timing(escala, { toValue: 1.18, duration: 620, useNativeDriver: true }),
        import_react_native2.Animated.timing(escala, { toValue: 1, duration: 620, useNativeDriver: true })
      ])
    );
    ciclo.start();
    return () => ciclo.stop();
  }, [escala]);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native2.Animated.View, { style: { transform: [{ scale: escala }] }, children });
}
var estilos = import_react_native2.StyleSheet.create({
  sheetTitulo: { paddingHorizontal: 20, paddingVertical: 6, fontSize: 13, fontWeight: "600" },
  sheetItem: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 13 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center"
  }
});

// src/chamadas.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var alcanceGlobalChamadas = globalThis;
var Ctx = alcanceGlobalChamadas.__makaChatChamadasCtx ??= (0, import_react5.createContext)(null);
function useChamadasOpcional() {
  return (0, import_react5.useContext)(Ctx);
}
var estilos2 = import_react_native3.StyleSheet.create({
  centro: { ...import_react_native3.StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  topo: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 52, paddingHorizontal: 10 },
  pip: { position: "absolute", right: 14, width: 112, height: 168, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  // câmara desligada: tapa o último frame SEM desmontar a SurfaceView
  pipOff: { ...import_react_native3.StyleSheet.absoluteFillObject, backgroundColor: "#1e293b", alignItems: "center", justifyContent: "center" },
  pausaPill: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  nomeTile: { position: "absolute", left: 10, bottom: 10, color: "#fff", fontWeight: "700", fontSize: 12, textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 4 },
  erro: { position: "absolute", left: 20, right: 20, backgroundColor: "rgba(239,68,68,0.92)", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  // bandeja de controlos em curso (pill escura, estilo WhatsApp)
  bandeja: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    backgroundColor: "rgba(30,41,59,0.92)",
    borderRadius: 40,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16
  },
  // incoming: botões grandes com rótulo, afastados na largura toda
  controlosReceber: { position: "absolute", left: 0, right: 0, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-evenly" },
  pill: { position: "absolute", top: 58, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#0f172a", borderRadius: 22, paddingVertical: 6, paddingLeft: 6, paddingRight: 12, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 8 }
});

// src/ui/ChatScreen.tsx
var import_vector_icons6 = require("@expo/vector-icons");
var import_react_native_safe_area_context3 = require("react-native-safe-area-context");
var import_react9 = require("react");
var import_react_native7 = require("react-native");

// src/ui/audio.tsx
var import_vector_icons3 = require("@expo/vector-icons");
var import_react6 = require("react");
var import_react_native4 = require("react-native");
var import_jsx_runtime4 = require("react/jsx-runtime");
var VELOCIDADES = [1, 1.5, 2];
function barrasDe(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const barras = [];
  for (let i = 0; i < 28; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    barras.push(6 + Math.abs(h) % 18);
  }
  return barras;
}
function ReprodutorAudio({ url, mimha, duracaoSegundos }) {
  const tema = useTema();
  const audio = (0, import_react6.useMemo)(() => obterAudio(), []);
  const corTexto = mimha ? tema.bolhaMinhaTexto : tema.texto;
  if (!audio) {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react_native4.Text, { style: { color: corTexto, fontSize: 13 }, children: "\u{1F3A4} Mensagem de voz (instala expo-audio para ouvir)" });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(PlayerInterno, { audio, url, mimha, duracaoSegundos });
}
function PlayerInterno({ audio, url, mimha, duracaoSegundos }) {
  const tema = useTema();
  const player = (0, import_react6.useRef)(null);
  const [aTocar, setATocar] = (0, import_react6.useState)(false);
  const [posicao, setPosicao] = (0, import_react6.useState)(0);
  const [duracao, setDuracao] = (0, import_react6.useState)(duracaoSegundos && duracaoSegundos > 0 ? duracaoSegundos : 0);
  const [velocidade, setVelocidade] = (0, import_react6.useState)(1);
  const barras = (0, import_react6.useMemo)(() => barrasDe(url), [url]);
  const corTexto = mimha ? tema.bolhaMinhaTexto : tema.texto;
  (0, import_react6.useEffect)(
    () => () => {
      player.current?.remove?.();
      player.current = null;
    },
    []
  );
  const alternar = async () => {
    if (!player.current) {
      await audio.setAudioModeAsync?.({ playsInSilentMode: true, allowsRecording: false }).catch(() => void 0);
      const p = audio.createAudioPlayer({ uri: url });
      player.current = p;
      p.addListener?.("playbackStatusUpdate", (s) => {
        setPosicao(Number.isFinite(s.currentTime) ? s.currentTime : 0);
        if (Number.isFinite(s.duration) && s.duration > 0) setDuracao(s.duration);
        if (s.didJustFinish) {
          setATocar(false);
          setPosicao(0);
          p.seekTo?.(0);
          p.pause?.();
        }
      });
      p.setPlaybackRate?.(velocidade, "high");
      p.play();
      setATocar(true);
      return;
    }
    if (aTocar) {
      player.current.pause();
      setATocar(false);
    } else {
      player.current.play();
      setATocar(true);
    }
  };
  const mudarVelocidade = () => {
    const proxima = VELOCIDADES[(VELOCIDADES.indexOf(velocidade) + 1) % VELOCIDADES.length];
    setVelocidade(proxima);
    player.current?.setPlaybackRate?.(proxima, "high");
  };
  const progresso = duracao > 0 ? Math.min(1, Math.max(0, posicao / duracao)) : 0;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_react_native4.View, { style: estilos3.linha, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react_native4.Pressable, { onPress: () => void alternar(), style: [estilos3.play, { backgroundColor: mimha ? "rgba(255,255,255,0.25)" : tema.primaria }], children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_vector_icons3.Ionicons, { name: aTocar ? "pause" : "play", size: 18, color: mimha ? tema.bolhaMinhaTexto : tema.primariaContraste }) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_react_native4.View, { style: { flex: 1 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react_native4.View, { style: estilos3.onda, children: barras.map((altura, i) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        import_react_native4.View,
        {
          style: {
            width: 3,
            height: altura,
            borderRadius: 2,
            backgroundColor: i / barras.length <= progresso ? mimha ? tema.bolhaMinhaTexto : tema.primaria : mimha ? "rgba(255,255,255,0.4)" : "rgba(100,116,139,0.35)"
          }
        },
        i
      )) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react_native4.Text, { style: { fontSize: 11, color: corTexto, opacity: 0.7, marginTop: 3 }, children: duracaoMmSs(Math.floor(aTocar || posicao > 0 ? posicao : duracao)) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react_native4.Pressable, { onPress: mudarVelocidade, style: [estilos3.velocidade, { backgroundColor: mimha ? "rgba(255,255,255,0.25)" : "rgba(100,116,139,0.15)" }], children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_react_native4.Text, { style: { fontSize: 11, fontWeight: "800", color: corTexto }, children: [
      velocidade,
      "x"
    ] }) })
  ] });
}
function GravadorAudio({ aoTerminar, aoCancelar, padFundo }) {
  const audio = (0, import_react6.useMemo)(() => obterAudio(), []);
  if (!audio?.useAudioRecorder) {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(GravadorErro, { aoCancelar, texto: "Instala expo-audio para gravar mensagens de voz.", padFundo });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(GravadorInterno, { audio, aoTerminar, aoCancelar, padFundo });
}
function GravadorInterno({ audio, aoTerminar, aoCancelar, padFundo }) {
  const tema = useTema();
  const recorder = audio.useAudioRecorder(audio.RecordingPresets.HIGH_QUALITY);
  const inicio = (0, import_react6.useRef)(Date.now());
  const pronto = (0, import_react6.useRef)(false);
  const [segundos, setSegundos] = (0, import_react6.useState)(0);
  const [erro, setErro] = (0, import_react6.useState)(false);
  (0, import_react6.useEffect)(() => {
    let cancelado = false;
    void (async () => {
      try {
        const permissao = await audio.AudioModule.requestRecordingPermissionsAsync();
        if (!permissao.granted) throw new Error("sem permiss\xE3o");
        await audio.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        if (cancelado) return;
        await recorder.prepareToRecordAsync();
        recorder.record();
        pronto.current = true;
        inicio.current = Date.now();
      } catch {
        if (!cancelado) setErro(true);
      }
    })();
    const timer = setInterval(() => setSegundos(Math.floor((Date.now() - inicio.current) / 1e3)), 500);
    return () => {
      cancelado = true;
      clearInterval(timer);
    };
  }, []);
  const parar = async (enviar) => {
    if (!pronto.current) {
      aoCancelar();
      return;
    }
    pronto.current = false;
    await recorder.stop().catch(() => void 0);
    await audio.setAudioModeAsync({ allowsRecording: false }).catch(() => void 0);
    const uri = recorder.uri ?? null;
    if (enviar && uri && segundos >= 1) aoTerminar(uri, Math.max(1, segundos));
    else aoCancelar();
  };
  if (erro) {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(GravadorErro, { aoCancelar, texto: "Sem acesso ao microfone.", padFundo });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_react_native4.View, { style: [estilos3.gravador, { backgroundColor: tema.superficie, paddingBottom: Math.max(padFundo ?? 0, 8) }], children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react_native4.View, { style: estilos3.pontoVermelho }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react_native4.Text, { style: { fontVariant: ["tabular-nums"], fontSize: 15, color: tema.texto, fontWeight: "600" }, children: duracaoMmSs(segundos) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react_native4.Text, { style: { flex: 1, textAlign: "center", color: tema.textoSuave, fontSize: 13 }, children: "A gravar\u2026" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react_native4.Pressable, { onPress: () => void parar(false), style: { padding: 6 }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_vector_icons3.Ionicons, { name: "trash-outline", size: 24, color: "#ef4444" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react_native4.Pressable, { onPress: () => void parar(true), style: [estilos3.enviarGravacao, { backgroundColor: tema.primaria }], children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_vector_icons3.Ionicons, { name: "send", size: 19, color: tema.primariaContraste }) })
  ] });
}
function GravadorErro({ texto, aoCancelar, padFundo }) {
  const tema = useTema();
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_react_native4.View, { style: [estilos3.gravador, { backgroundColor: tema.superficie, paddingBottom: Math.max(padFundo ?? 0, 8) }], children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react_native4.Text, { style: { flex: 1, color: "#ef4444", fontSize: 13 }, children: texto }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react_native4.Pressable, { onPress: aoCancelar, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_vector_icons3.Ionicons, { name: "close-circle", size: 26, color: tema.textoSuave }) })
  ] });
}
var estilos3 = import_react_native4.StyleSheet.create({
  linha: { flexDirection: "row", alignItems: "center", gap: 9, width: 230, paddingVertical: 2 },
  play: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  onda: { flexDirection: "row", alignItems: "center", gap: 2, height: 26 },
  velocidade: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  gravador: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  pontoVermelho: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#ef4444" },
  enviarGravacao: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" }
});

// src/ui/Bolha.tsx
var import_vector_icons5 = require("@expo/vector-icons");
var import_makachat_core2 = require("@hongayetu/makachat-core");
var import_react8 = require("react");
var import_react_native6 = require("react-native");

// src/ui/media.tsx
var import_vector_icons4 = require("@expo/vector-icons");
var import_react7 = require("react");
var import_react_native5 = require("react-native");
var import_jsx_runtime5 = require("react/jsx-runtime");
var KCLobby = obterKeyboardController();
var TecladoLobby = KCLobby?.KeyboardAvoidingView ?? import_react_native5.KeyboardAvoidingView;
async function escolherFotosEVideos() {
  const picker = obterImagePicker();
  if (!picker) return [];
  const resultado = await picker.launchImageLibraryAsync({
    mediaTypes: ["images", "videos"],
    allowsMultipleSelection: true,
    selectionLimit: 10,
    quality: 0.85
  });
  if (resultado.canceled) return [];
  return resultado.assets.map((a) => ({
    uri: a.uri,
    mime: a.mimeType ?? (a.type === "video" ? "video/mp4" : "image/jpeg"),
    nome: a.fileName ?? a.uri.split("/").pop() ?? "media",
    tipo: a.type === "video" ? "video" : "foto",
    largura: a.width,
    altura: a.height,
    duracao_segundos: a.duration ? Math.round(a.duration / 1e3) : void 0
  }));
}
async function escolherFicheiro() {
  const picker = obterDocumentPicker();
  if (!picker) return null;
  const resultado = await picker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
  if (resultado.canceled || !resultado.assets?.length) return null;
  const a = resultado.assets[0];
  return {
    uri: a.uri,
    mime: a.mimeType ?? "application/octet-stream",
    nome: a.name ?? "ficheiro",
    tipo: "ficheiro"
  };
}
async function enviarAnexoLocal(api, ficheiro, opcoes) {
  const criado = await api.criarMedia({ tipo: ficheiro.tipo, mime: ficheiro.mime, nome_ficheiro: ficheiro.nome });
  const { token } = await api.sessao();
  const fs = obterFileSystem();
  if (fs?.uploadAsync && fs.FileSystemUploadType) {
    await fs.uploadAsync(criado.upload.url, ficheiro.uri, {
      httpMethod: "PUT",
      uploadType: fs.FileSystemUploadType?.BINARY_CONTENT ?? 1,
      headers: criado.upload.metodo === "endpoint" ? { Authorization: `Bearer ${token}`, "Content-Type": ficheiro.mime } : { "Content-Type": ficheiro.mime }
    });
  } else {
    const blob = await (await fetch(ficheiro.uri)).blob();
    await api.carregarMedia(criado.upload, blob, ficheiro.mime);
  }
  const { anexo } = await api.confirmarMedia(criado.anexo_id, {
    largura: ficheiro.largura,
    altura: ficheiro.altura,
    duracao_segundos: ficheiro.duracao_segundos,
    duravel: opcoes?.duravel
  });
  return anexo;
}
var chaveFicheiroLocal = (anexoId) => `ficheiro_local_${anexoId}`;
async function obterFicheiroLocal(storage, anexoId) {
  const uri = await storage.obterMeta(chaveFicheiroLocal(anexoId)).catch(() => null);
  if (!uri) return null;
  const fs = obterFileSystem();
  const info = await fs?.getInfoAsync?.(uri).catch(() => null);
  if (info?.exists) return uri;
  await storage.gravarMeta(chaveFicheiroLocal(anexoId), "").catch(() => void 0);
  return null;
}
async function registarFicheiroLocal(storage, anexoId, uri) {
  await storage.gravarMeta(chaveFicheiroLocal(anexoId), uri).catch(() => void 0);
}
async function baixarFicheiro(storage, anexo) {
  const fs = obterFileSystem();
  if (!fs?.downloadAsync || !fs.documentDirectory || !anexo.url) return null;
  const dir = `${fs.documentDirectory}makachat/`;
  await fs.makeDirectoryAsync?.(dir, { intermediates: true }).catch(() => void 0);
  const nome = (anexo.nome_ficheiro ?? "ficheiro").replace(/[^\w.\-]+/g, "_");
  const destino = `${dir}${anexo.id}_${nome}`;
  const resultado = await fs.downloadAsync(anexo.url, destino);
  if (resultado?.status && resultado.status >= 400) return null;
  await registarFicheiroLocal(storage, anexo.id, destino);
  return destino;
}
async function abrirComSistema(uri, mime, urlRemota) {
  const fs = obterFileSystem();
  if (import_react_native5.Platform.OS === "android") {
    const launcher = obterIntentLauncher();
    if (launcher?.startActivityAsync && fs?.getContentUriAsync) {
      try {
        const contentUri = await fs.getContentUriAsync(uri);
        await launcher.startActivityAsync("android.intent.action.VIEW", {
          data: contentUri,
          type: mime ?? "*/*",
          flags: 1
          // FLAG_GRANT_READ_URI_PERMISSION
        });
        return;
      } catch {
      }
    }
  }
  const sharing = obterSharing();
  if (sharing?.shareAsync && await sharing.isAvailableAsync?.().catch(() => true) !== false) {
    await sharing.shareAsync(uri, mime ? { mimeType: mime } : void 0).catch(() => void 0);
    return;
  }
  if (urlRemota) await import_react_native5.Linking.openURL(urlRemota).catch(() => void 0);
}
function LobbyFotos({ ficheiros, aoMudar, aoAdicionarMais, aoEnviar, aoFechar, aEnviar, insets }) {
  const tema = useTema();
  const [legenda, setLegenda] = (0, import_react7.useState)("");
  const { width } = (0, import_react_native5.useWindowDimensions)();
  const lado = (width - 48) / 3;
  (0, import_react7.useEffect)(() => {
    const sub = import_react_native5.BackHandler.addEventListener("hardwareBackPress", () => {
      aoFechar();
      return true;
    });
    return () => sub.remove();
  }, [aoFechar]);
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_react_native5.View, { style: [import_react_native5.StyleSheet.absoluteFillObject, { zIndex: 40, elevation: 40 }], children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(TecladoLobby, { style: { flex: 1, backgroundColor: "#0f172a" }, behavior: "padding", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_react_native5.View, { style: [estilos4.lobbyTopo, { paddingTop: insets.top + 8 }], children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_react_native5.Pressable, { onPress: aoFechar, style: { padding: 8 }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_vector_icons4.Ionicons, { name: "close", size: 26, color: "#fff" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_react_native5.Text, { style: { color: "#fff", fontWeight: "700", fontSize: 16 }, children: [
        ficheiros.length,
        " ",
        ficheiros.length === 1 ? "item" : "itens"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_react_native5.Pressable, { onPress: aoAdicionarMais, style: { padding: 8 }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_vector_icons4.Ionicons, { name: "add-circle-outline", size: 26, color: "#fff" }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_react_native5.View, { style: estilos4.lobbyGrelha, children: ficheiros.map((f, i) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_react_native5.View, { style: { width: lado, height: lado, borderRadius: 12, overflow: "hidden" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_react_native5.Image, { source: { uri: f.uri }, style: { width: "100%", height: "100%" } }),
      f.tipo === "video" && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_react_native5.View, { style: estilos4.lobbyPlay, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_vector_icons4.Ionicons, { name: "play", size: 22, color: "#fff" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        import_react_native5.Pressable,
        {
          onPress: () => aoMudar(ficheiros.filter((_, j) => j !== i)),
          style: estilos4.lobbyRemover,
          children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_vector_icons4.Ionicons, { name: "close", size: 15, color: "#fff" })
        }
      )
    ] }, f.uri)) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_react_native5.View, { style: [estilos4.lobbyFundo, { paddingBottom: insets.bottom + 12 }], children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        import_react_native5.TextInput,
        {
          value: legenda,
          onChangeText: setLegenda,
          placeholder: "Adicionar legenda\u2026",
          placeholderTextColor: "rgba(255,255,255,0.5)",
          style: estilos4.lobbyLegenda
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        import_react_native5.Pressable,
        {
          disabled: aEnviar || !ficheiros.length,
          onPress: () => aoEnviar(legenda.trim()),
          style: [estilos4.lobbyEnviar, { backgroundColor: tema.primaria, opacity: aEnviar ? 0.5 : 1 }],
          children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_vector_icons4.Ionicons, { name: aEnviar ? "hourglass-outline" : "send", size: 20, color: tema.primariaContraste })
        }
      )
    ] })
  ] }) });
}
function Galeria({ mensagens, inicialAnexoId, aoFechar, aoResponder, aoEncaminhar, insets }) {
  const { width, height } = (0, import_react_native5.useWindowDimensions)();
  const fotos = mensagens.flatMap((m) => m.anexos.filter((a) => a.tipo === "foto" && a.url).map((a) => ({ anexo: a, mensagem: m }))).sort((a, b) => a.mensagem.id < b.mensagem.id ? -1 : 1);
  const inicial = Math.max(0, fotos.findIndex((f) => f.anexo.id === inicialAnexoId));
  const [indice, setIndice] = (0, import_react7.useState)(inicial);
  const atual = fotos[indice];
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_react_native5.Modal, { visible: true, animationType: "fade", onRequestClose: aoFechar, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_react_native5.View, { style: { flex: 1, backgroundColor: "#000" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      ListaPerformante,
      {
        data: fotos,
        horizontal: true,
        pagingEnabled: true,
        initialScrollIndex: inicial,
        getItemLayout: (_, index) => ({ length: width, offset: width * index, index }),
        keyExtractor: (f) => f.anexo.id,
        onMomentumScrollEnd: (e) => setIndice(Math.round(e.nativeEvent.contentOffset.x / width)),
        renderItem: ({ item: f }) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_react_native5.View, { style: { width, height, alignItems: "center", justifyContent: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_react_native5.Image, { source: { uri: f.anexo.url ?? void 0 }, style: { width, height: height * 0.8 }, resizeMode: "contain" }) })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_react_native5.View, { style: [estilos4.galeriaTopo, { paddingTop: insets.top + 8 }], children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_react_native5.Pressable, { onPress: aoFechar, style: { padding: 8 }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_vector_icons4.Ionicons, { name: "close", size: 26, color: "#fff" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_react_native5.Text, { style: { color: "#fff", fontWeight: "700" }, children: [
        fotos.length ? indice + 1 : 0,
        "/",
        fotos.length
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_react_native5.View, { style: { width: 42 } })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_react_native5.View, { style: [estilos4.galeriaAcoes, { bottom: insets.bottom + 12 }], children: [
      aoResponder && atual && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_react_native5.Pressable, { onPress: () => {
        aoFechar();
        aoResponder(atual.mensagem);
      }, style: estilos4.galeriaBotao, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_vector_icons4.Ionicons, { name: "arrow-undo-outline", size: 22, color: "#fff" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_react_native5.Text, { style: estilos4.galeriaRotulo, children: "Responder" })
      ] }),
      aoEncaminhar && atual && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_react_native5.Pressable, { onPress: () => {
        aoFechar();
        aoEncaminhar(atual.mensagem);
      }, style: estilos4.galeriaBotao, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_vector_icons4.Ionicons, { name: "arrow-redo-outline", size: 22, color: "#fff" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_react_native5.Text, { style: estilos4.galeriaRotulo, children: "Encaminhar" })
      ] })
    ] })
  ] }) });
}
function VisualizadorVideo({ url, aoFechar, insets }) {
  const video = obterVideo();
  if (!video?.useVideoPlayer) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(VideoInterno, { video, url, aoFechar, insets });
}
function VideoInterno({ video, url, aoFechar, insets }) {
  const VideoView = video.VideoView;
  const player = video.useVideoPlayer(url, (p) => {
    p.play();
  });
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_react_native5.Modal, { visible: true, animationType: "fade", onRequestClose: aoFechar, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_react_native5.View, { style: { flex: 1, backgroundColor: "#000" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(VideoView, { player, style: { flex: 1 }, contentFit: "contain", nativeControls: true, allowsFullscreen: true }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_react_native5.Pressable, { onPress: aoFechar, style: [estilos4.videoFechar, { top: insets.top + 8 }], children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_vector_icons4.Ionicons, { name: "close", size: 26, color: "#fff" }) })
  ] }) });
}
function tamanhoLegivel(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
var estilos4 = import_react_native5.StyleSheet.create({
  lobbyTopo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 8 },
  lobbyGrelha: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 12, alignContent: "flex-start" },
  lobbyPlay: { ...import_react_native5.StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.3)" },
  lobbyRemover: { position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(15,23,42,0.8)", alignItems: "center", justifyContent: "center" },
  lobbyFundo: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  lobbyLegenda: { flex: 1, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11, color: "#fff", fontSize: 15 },
  lobbyEnviar: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  galeriaTopo: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 },
  galeriaAcoes: { position: "absolute", left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 36 },
  galeriaBotao: { alignItems: "center", gap: 3 },
  videoFechar: { position: "absolute", left: 12, padding: 8, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 22 },
  galeriaRotulo: { color: "#fff", fontSize: 11 }
});

// src/ui/Bolha.tsx
var import_jsx_runtime6 = require("react/jsx-runtime");
function idMaiorOuIgual(watermark, mensagemId) {
  return !!watermark && watermark >= mensagemId;
}
function Ticks({ mensagem, outros, cor }) {
  if (mensagem.estado_envio === "a_enviar") return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_vector_icons5.Ionicons, { name: "time-outline", size: 13, color: cor });
  if (mensagem.estado_envio === "falhou") return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_vector_icons5.Ionicons, { name: "alert-circle-outline", size: 13, color: "#fca5a5" });
  const entregue = outros.length > 0 && outros.every((p) => idMaiorOuIgual(p.ultima_entrega_mensagem_id, mensagem.id));
  const lida = outros.length > 0 && outros.every((p) => idMaiorOuIgual(p.ultima_leitura_mensagem_id, mensagem.id));
  if (lida) return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_vector_icons5.Ionicons, { name: "checkmark-done", size: 14, color: "#38bdf8" });
  if (entregue) return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_vector_icons5.Ionicons, { name: "checkmark-done", size: 14, color: cor });
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_vector_icons5.Ionicons, { name: "checkmark", size: 14, color: cor });
}
function agruparReacoes(reacoes) {
  const mapa = /* @__PURE__ */ new Map();
  for (const r of reacoes) mapa.set(r.emoji, (mapa.get(r.emoji) ?? 0) + 1);
  return [...mapa.entries()].map(([emoji, contagem]) => ({ emoji, contagem }));
}
function CartaoRegistoChamada({ mensagem, aoLigar }) {
  const tema = useTema();
  const meta = mensagem.metadados ?? {};
  const video = meta.chamada_tipo === "video";
  const atendida = meta.resultado === "atendida";
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_react_native6.View, { style: [estilos5.cartaoChamada, { backgroundColor: tema.superficie }], children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_react_native6.View, { style: [estilos5.chamadaIcone, { backgroundColor: atendida ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)" }], children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      import_vector_icons5.Ionicons,
      {
        name: video ? atendida ? "videocam" : "videocam-off" : atendida ? "call" : "call-outline",
        size: 18,
        color: atendida ? "#10b981" : "#ef4444"
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_react_native6.View, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_react_native6.Text, { style: { fontSize: 14, fontWeight: "700", color: tema.texto }, children: [
        "Chamada de ",
        video ? "v\xEDdeo" : "voz"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_react_native6.Text, { style: { fontSize: 12, color: atendida ? tema.textoSuave : "#ef4444", fontWeight: atendida ? "400" : "700" }, children: [
        atendida ? `Dura\xE7\xE3o ${duracaoMmSs(meta.duracao_segundos ?? 0)}` : "N\xE3o atendida",
        " \xB7 ",
        horaCurta(mensagem.criada_em)
      ] })
    ] }),
    aoLigar && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_react_native6.Pressable, { onPress: () => aoLigar(video ? "video" : "audio"), style: [estilos5.chamadaLigar, { backgroundColor: tema.primaria }], children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_vector_icons5.Ionicons, { name: video ? "videocam" : "call", size: 17, color: tema.primariaContraste }) })
  ] });
}
function CartaoPartilha({ mensagem, minha }) {
  const tema = useTema();
  const { aoAbrirPartilha } = useMakaChat();
  const meta = mensagem.metadados ?? {};
  const abrir = () => {
    if (aoAbrirPartilha) return aoAbrirPartilha(meta);
    if (meta.url) void import_react_native6.Linking.openURL(meta.url).catch(() => void 0);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_react_native6.Pressable, { onPress: abrir, style: [estilos5.partilha, { backgroundColor: minha ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.05)" }], children: [
    meta.imagem_url ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_react_native6.Image, { source: { uri: meta.imagem_url }, style: { width: 62, height: 62 } }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_react_native6.View, { style: { flex: 1, padding: 9, justifyContent: "center" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_react_native6.Text, { numberOfLines: 1, style: { fontSize: 14, fontWeight: "700", color: minha ? tema.bolhaMinhaTexto : tema.texto }, children: String(meta.titulo ?? meta.url ?? "Partilha") }),
      meta.subtitulo ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_react_native6.Text, { numberOfLines: 1, style: { fontSize: 12, color: minha ? tema.bolhaMinhaTexto : tema.textoSuave, opacity: 0.8 }, children: meta.subtitulo }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_react_native6.View, { style: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_vector_icons5.Ionicons, { name: "link-outline", size: 11, color: minha ? tema.bolhaMinhaTexto : tema.textoSuave }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_react_native6.Text, { style: { fontSize: 10, color: minha ? tema.bolhaMinhaTexto : tema.textoSuave, opacity: 0.7 }, children: String(meta.contexto_tipo ?? "liga\xE7\xE3o") })
      ] })
    ] })
  ] });
}
function TextoComLinks({ conteudo, cor, minha }) {
  const partes = (0, import_react8.useMemo)(() => (0, import_makachat_core2.dividirLinks)(conteudo), [conteudo]);
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_react_native6.Text, { style: { fontSize: 16, lineHeight: 22, color: cor }, children: partes.map(
    (p, i) => p.url ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      import_react_native6.Text,
      {
        style: { textDecorationLine: "underline", fontWeight: "600", color: minha ? cor : "#2563eb" },
        onPress: () => void import_react_native6.Linking.openURL(p.url).catch(() => void 0),
        children: p.texto
      },
      i
    ) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_react_native6.Text, { children: p.texto }, i)
  ) });
}
function iconeFicheiro(nome) {
  const ext = (nome ?? "").split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "document-text";
  if (["doc", "docx"].includes(ext)) return "document-text-outline";
  if (["xls", "xlsx", "csv"].includes(ext)) return "grid-outline";
  if (["zip", "rar", "7z"].includes(ext)) return "file-tray-full-outline";
  if (["mp3", "wav", "m4a", "ogg"].includes(ext)) return "musical-notes-outline";
  return "document-outline";
}
function AnexoView({ anexo, minha, aoAbrirFoto, aoAbrirUrl }) {
  const tema = useTema();
  const corTexto = minha ? tema.bolhaMinhaTexto : tema.texto;
  if (anexo.tipo === "foto" && anexo.url) {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_react_native6.Pressable, { onPress: () => aoAbrirFoto(anexo), children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_react_native6.Image, { source: { uri: anexo.url }, style: estilos5.foto }) });
  }
  if (anexo.tipo === "video" && anexo.url) {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_react_native6.Pressable, { onPress: () => aoAbrirUrl(anexo.url), style: estilos5.foto, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_react_native6.Image, { source: { uri: anexo.url }, style: import_react_native6.StyleSheet.absoluteFillObject }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_react_native6.View, { style: estilos5.playVideo, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_vector_icons5.Ionicons, { name: "play", size: 26, color: "#fff" }) })
    ] });
  }
  if (anexo.tipo === "audio" && anexo.url) {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(ReprodutorAudio, { url: anexo.url, mimha: minha, duracaoSegundos: anexo.duracao_segundos });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(FicheiroAnexo, { anexo, minha, corTexto });
}
function FicheiroAnexo({ anexo, minha, corTexto }) {
  const { engine } = useMakaChat();
  const [local, setLocal] = (0, import_react8.useState)(null);
  const [verificado, setVerificado] = (0, import_react8.useState)(false);
  const [aBaixar, setABaixar] = (0, import_react8.useState)(false);
  (0, import_react8.useEffect)(() => {
    let vivo = true;
    void obterFicheiroLocal(engine.storage, anexo.id).then((uri) => {
      if (vivo) {
        setLocal(uri);
        setVerificado(true);
      }
    });
    return () => {
      vivo = false;
    };
  }, [engine, anexo.id]);
  const tocar = async () => {
    if (aBaixar) return;
    if (local) {
      await abrirComSistema(local, anexo.mime, anexo.url);
      return;
    }
    setABaixar(true);
    try {
      const uri = await baixarFicheiro(engine.storage, anexo);
      if (uri) setLocal(uri);
      else if (anexo.url) await import_react_native6.Linking.openURL(anexo.url).catch(() => void 0);
    } finally {
      setABaixar(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_react_native6.Pressable, { onPress: () => void tocar(), style: [estilos5.ficheiro, { backgroundColor: minha ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.05)" }], children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_vector_icons5.Ionicons, { name: iconeFicheiro(anexo.nome_ficheiro), size: 26, color: corTexto }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_react_native6.View, { style: { flex: 1, minWidth: 0 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_react_native6.Text, { numberOfLines: 1, style: { fontSize: 13.5, fontWeight: "600", color: corTexto }, children: anexo.nome_ficheiro ?? "Ficheiro" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_react_native6.Text, { style: { fontSize: 11, color: corTexto, opacity: 0.7 }, children: [
        tamanhoLegivel(anexo.tamanho_bytes),
        " ",
        (anexo.nome_ficheiro ?? "").split(".").pop()?.toUpperCase()
      ] })
    ] }),
    aBaixar ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_react_native6.ActivityIndicator, { size: "small", color: corTexto }) : !local && verificado ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_vector_icons5.Ionicons, { name: "arrow-down-circle-outline", size: 22, color: corTexto }) : null
  ] });
}
function Bolha({
  mensagem: m,
  minha,
  grupo,
  autor,
  outros,
  primeiraDoBloco,
  ultimaDoBloco,
  respondida,
  destacada,
  aoResponder,
  aoLongPress,
  aoVerReacoes,
  aoClicarCitacao,
  aoAbrirFoto,
  aoAbrirUrl,
  aoLigar
}) {
  const tema = useTema();
  const arrasto = (0, import_react8.useRef)(new import_react_native6.Animated.Value(0)).current;
  const disparou = (0, import_react8.useRef)(false);
  const [reagiu] = (0, import_react8.useState)(false);
  void reagiu;
  const responder = (0, import_react8.useMemo)(
    () => import_react_native6.PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => !m.eliminada && g.dx > 14 && Math.abs(g.dy) < 12,
      onPanResponderMove: (_e, g) => {
        const x = Math.min(Math.max(g.dx, 0), 80);
        arrasto.setValue(x);
        if (x >= 60 && !disparou.current) {
          disparou.current = true;
          import_react_native6.Vibration.vibrate(8);
        }
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dx >= 60) aoResponder();
        disparou.current = false;
        import_react_native6.Animated.spring(arrasto, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 240 }).start();
      },
      onPanResponderTerminate: () => {
        disparou.current = false;
        import_react_native6.Animated.spring(arrasto, { toValue: 0, useNativeDriver: true }).start();
      }
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m.id, m.eliminada]
  );
  if (m.tipo === "sistema") {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_react_native6.View, { style: estilos5.sistema, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_react_native6.Text, { style: [estilos5.sistemaTexto, { color: tema.textoSuave }], children: m.conteudo }) });
  }
  if (m.tipo === "chamada") {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_react_native6.View, { style: { alignItems: "center", marginVertical: 4 }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(CartaoRegistoChamada, { mensagem: m, aoLigar }) });
  }
  const grupos = agruparReacoes(m.reacoes);
  const corTexto = minha ? tema.bolhaMinhaTexto : tema.texto;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
    import_react_native6.Animated.View,
    {
      style: [
        { flexDirection: "row", justifyContent: minha ? "flex-end" : "flex-start", paddingHorizontal: 10, marginTop: primeiraDoBloco ? 6 : 1.5 },
        { transform: [{ translateX: arrasto }] },
        destacada && { backgroundColor: "rgba(79,70,229,0.12)", borderRadius: 12 }
      ],
      ...responder.panHandlers,
      children: [
        !minha && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_react_native6.View, { style: { width: 30, marginRight: 4, justifyContent: "flex-end" }, children: ultimaDoBloco && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Avatar, { nome: autor?.nome ?? "?", url: autor?.foto_url, tamanho: 26 }) }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
          import_react_native6.Pressable,
          {
            onLongPress: m.eliminada ? void 0 : aoLongPress,
            delayLongPress: 280,
            style: [
              estilos5.bolha,
              {
                backgroundColor: minha ? tema.bolhaMinha : tema.bolhaOutro,
                borderRadius: tema.raio,
                marginBottom: grupos.length ? 12 : 0
              },
              minha ? { borderBottomRightRadius: ultimaDoBloco ? 6 : tema.raio } : { borderBottomLeftRadius: ultimaDoBloco ? 6 : tema.raio }
            ],
            children: [
              grupo && !minha && primeiraDoBloco && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(NomeComBadge, { nome: autor?.nome ?? "\u2026", metadados: autor?.metadados, estilo: { fontSize: 12, fontWeight: "800", color: tema.primaria } }),
              respondida && m.resposta_a_id && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_react_native6.Pressable, { onPress: () => aoClicarCitacao(m.resposta_a_id), style: [estilos5.citacao, { backgroundColor: minha ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.06)" }], children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_react_native6.Text, { numberOfLines: 1, style: { fontSize: 12, color: corTexto, opacity: 0.85 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_vector_icons5.Ionicons, { name: "arrow-undo-outline", size: 11 }),
                " ",
                respondida.conteudo ?? "\u{1F4CE} anexo"
              ] }) }),
              m.anexos.map((a) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(AnexoView, { anexo: a, minha, aoAbrirFoto, aoAbrirUrl }, a.id)),
              !m.eliminada && (m.tipo === "partilha" || m.tipo === "link") && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(CartaoPartilha, { mensagem: m, minha }),
              m.eliminada ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_react_native6.Text, { style: { fontStyle: "italic", color: corTexto, opacity: 0.6, fontSize: 15 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_vector_icons5.Ionicons, { name: "ban-outline", size: 14 }),
                " Mensagem eliminada"
              ] }) : m.conteudo ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(TextoComLinks, { conteudo: m.conteudo, cor: corTexto, minha }) : null,
              /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_react_native6.View, { style: estilos5.rodape, children: [
                m.encaminhada_de_id && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_vector_icons5.Ionicons, { name: "arrow-redo-outline", size: 11, color: corTexto, style: { opacity: 0.6 } }),
                /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_react_native6.Text, { style: { fontSize: 10, color: corTexto, opacity: 0.6 }, children: [
                  m.editada_em ? "editada \xB7 " : "",
                  horaCurta(m.criada_em)
                ] }),
                minha && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Ticks, { mensagem: m, outros, cor: corTexto })
              ] }),
              grupos.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_react_native6.Pressable, { onPress: aoVerReacoes, style: [estilos5.chipsReacoes, { backgroundColor: tema.superficie }, minha ? { right: 8 } : { left: 8 }], children: grupos.map((g) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_react_native6.Text, { style: { fontSize: 12 }, children: [
                g.emoji,
                g.contagem > 1 ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_react_native6.Text, { style: { fontSize: 10, fontWeight: "700", color: tema.textoSuave }, children: [
                  " ",
                  g.contagem
                ] }) : null
              ] }, g.emoji)) })
            ]
          }
        )
      ]
    }
  );
}
var estilos5 = import_react_native6.StyleSheet.create({
  sistema: { alignSelf: "center", backgroundColor: "rgba(100,116,139,0.12)", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4, marginVertical: 5, maxWidth: "86%" },
  sistemaTexto: { fontSize: 12, textAlign: "center" },
  bolha: { maxWidth: "76%", paddingHorizontal: 11, paddingVertical: 7, gap: 4, shadowColor: "#0f172a", shadowOpacity: 0.06, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  citacao: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  rodape: { flexDirection: "row", alignItems: "center", gap: 3, alignSelf: "flex-end" },
  foto: { width: 218, height: 218, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.15)", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  playVideo: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  ficheiro: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, padding: 10, width: 230 },
  partilha: { flexDirection: "row", borderRadius: 12, overflow: "hidden", width: 240 },
  cartaoChamada: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9, shadowColor: "#0f172a", shadowOpacity: 0.07, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  chamadaIcone: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  chamadaLigar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", marginLeft: 6 },
  chipsReacoes: { position: "absolute", bottom: -11, flexDirection: "row", gap: 3, borderRadius: 12, paddingHorizontal: 7, paddingVertical: 2.5, shadowColor: "#0f172a", shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 }
});

// src/ui/ChatScreen.tsx
var import_jsx_runtime7 = require("react/jsx-runtime");
var EMOJIS = ["\u{1F44D}", "\u2764\uFE0F", "\u{1F602}", "\u{1F62E}", "\u{1F622}", "\u{1F64F}"];
var KC = obterKeyboardController();
var CampoTeclado = KC?.KeyboardAvoidingView ?? import_react_native7.KeyboardAvoidingView;
function ChatScreen({ conversaId, onVoltar, onAbrirInfo, onAbrirOutraConversa, chamadas, onAbrirAnexo, emFoco = true, barraEstado = "escura", renderHeader }) {
  const { engine, api, socket, identidade, registarVisivel } = useMakaChat();
  const tema = useTema();
  const insets = (0, import_react_native_safe_area_context3.useSafeAreaInsets)();
  const padFundoInput = Math.max(insets.bottom, 8);
  const versao = useVersaoChat();
  const mensagens = useMensagens(conversaId, 500);
  const typing = useTypingConversa(conversaId);
  const enviar = useEnviarMensagem();
  const podeReagir = useFuncionalidadeAtiva("reacoes");
  const podeEncaminhar = useFuncionalidadeAtiva("encaminhar");
  const podeFoto = useFuncionalidadeAtiva("media.foto");
  const podeFicheiro = useFuncionalidadeAtiva("media.ficheiro");
  const podeAudioMsg = useFuncionalidadeAtiva("media.audio");
  const podeAudioChamada = useFuncionalidadeAtiva("chamadas.audio");
  const podeVideoChamada = useFuncionalidadeAtiva("chamadas.video");
  const podeCriarConversa = useFuncionalidadeAtiva("conversas.criar");
  const [conversa, setConversa] = (0, import_react9.useState)(null);
  const [texto, setTexto] = (0, import_react9.useState)("");
  const [responderA, setResponderA] = (0, import_react9.useState)(null);
  const [editar, setEditar] = (0, import_react9.useState)(null);
  const [acoesDe, setAcoesDe] = (0, import_react9.useState)(null);
  const [reacoesDe, setReacoesDe] = (0, import_react9.useState)(null);
  const [encaminhar, setEncaminhar] = (0, import_react9.useState)(null);
  const [relatorioDe, setRelatorioDe] = (0, import_react9.useState)(null);
  const [menuAberto, setMenuAberto] = (0, import_react9.useState)(false);
  const [anexoMenu, setAnexoMenu] = (0, import_react9.useState)(false);
  const [fotosPendentes, setFotosPendentes] = (0, import_react9.useState)([]);
  const [aEnviarMedia, setAEnviarMedia] = (0, import_react9.useState)(false);
  const [aGravar, setAGravar] = (0, import_react9.useState)(false);
  const [galeriaDe, setGaleriaDe] = (0, import_react9.useState)(null);
  const [videoAberto, setVideoAberto] = (0, import_react9.useState)(null);
  const [destacada, setDestacada] = (0, import_react9.useState)(null);
  const [novas, setNovas] = (0, import_react9.useState)(0);
  const [noFundo, setNoFundo] = (0, import_react9.useState)(true);
  const [pesquisaAberta, setPesquisaAberta] = (0, import_react9.useState)(false);
  const [pesquisaQ, setPesquisaQ] = (0, import_react9.useState)("");
  const [resultados, setResultados] = (0, import_react9.useState)([]);
  const [resultadoIdx, setResultadoIdx] = (0, import_react9.useState)(0);
  const [appAtiva, setAppAtiva] = (0, import_react9.useState)(import_react_native7.AppState.currentState === "active");
  const lista = (0, import_react9.useRef)(null);
  const ultimaVista = (0, import_react9.useRef)(null);
  const aCarregarAntigas = (0, import_react9.useRef)(false);
  const aDescer = (0, import_react9.useRef)(false);
  const viewabilityConfig = (0, import_react9.useRef)({ itemVisiblePercentThreshold: 10 }).current;
  const aoMudarVisiveis = (0, import_react9.useRef)(({ viewableItems }) => {
    const fundo = viewableItems.some((v) => v.index === 0);
    if (fundo) {
      aDescer.current = false;
      setNovas(0);
      setNoFundo(true);
    } else if (!aDescer.current) {
      setNoFundo(false);
    }
  }).current;
  const descerParaFundo = () => {
    aDescer.current = true;
    lista.current?.scrollToOffset({ offset: 0, animated: true });
    setNovas(0);
    setNoFundo(true);
  };
  const semMaisAntigas = (0, import_react9.useRef)(false);
  const eu = conversa?.participantes.find((p) => p.id_externo === identidade.id && p.tipo === identidade.tipo) ?? null;
  const outros = (conversa?.participantes ?? []).filter((p) => p.identidade_id !== eu?.identidade_id && !p.saiu_em);
  const contraparte = conversa ? contraparteDe(conversa, identidade) : null;
  const grupo = conversa?.tipo === "grupo";
  const fechada = conversa?.estado === "fechada";
  (0, import_react9.useEffect)(() => {
    void engine.entrarConversa(conversaId);
    if (!emFoco) return;
    const sair = registarVisivel(conversaId);
    return sair;
  }, [engine, conversaId, registarVisivel, emFoco]);
  (0, import_react9.useEffect)(() => {
    void engine.storage.obterConversa(conversaId).then(setConversa);
  }, [engine, conversaId, versao]);
  (0, import_react9.useEffect)(() => {
    const sub = import_react_native7.AppState.addEventListener("change", (estado) => setAppAtiva(estado === "active"));
    return () => sub.remove();
  }, []);
  (0, import_react9.useEffect)(() => {
    const ultima = mensagens.at(-1);
    if (!ultima || !appAtiva || !emFoco || !noFundo) return;
    if (ultimaVista.current === ultima.id) return;
    ultimaVista.current = ultima.id;
    void engine.marcarLidas(conversaId).catch(() => void 0);
    setNovas(0);
  }, [mensagens, appAtiva, emFoco, noFundo, engine, conversaId]);
  const totalAnterior = (0, import_react9.useRef)(mensagens.length);
  const ultimaContada = (0, import_react9.useRef)(null);
  (0, import_react9.useEffect)(() => {
    const ultima = mensagens.at(-1);
    const anterior = ultimaContada.current;
    const totalAntes = totalAnterior.current;
    totalAnterior.current = mensagens.length;
    ultimaContada.current = ultima?.id ?? null;
    if (!ultima || anterior === null || ultima.id === anterior) return;
    const minha = ultima.remetente_identidade_id === eu?.identidade_id || ultima.estado_envio === "a_enviar";
    if (!noFundo && !minha) {
      setNovas((n) => n + Math.max(1, mensagens.length - totalAntes));
    }
  }, [mensagens, noFundo, eu?.identidade_id]);
  const ultimoTyping = (0, import_react9.useRef)(0);
  const aoEscrever = (valor) => {
    setTexto(valor);
    const agora = Date.now();
    if (valor && agora - ultimoTyping.current > 3e3) {
      ultimoTyping.current = agora;
      socket.typing(conversaId, true);
    }
  };
  const aoEnviar = async () => {
    const conteudo = texto.trim();
    if (!conteudo) return;
    if (editar) {
      await engine.editarMensagem(editar.id, conteudo).catch(() => void 0);
      setEditar(null);
      setTexto("");
      return;
    }
    setTexto("");
    setResponderA(null);
    socket.typing(conversaId, false);
    tocarSom("enviada");
    await enviar({ conversa_id: conversaId, tipo: "texto", conteudo, resposta_a_id: responderA?.id }).catch(() => void 0);
    descerParaFundo();
  };
  const enviarFotos = async (legenda) => {
    setAEnviarMedia(true);
    try {
      const anexos = [];
      for (const f of fotosPendentes) {
        anexos.push(await enviarAnexoLocal(api, f));
      }
      const tipo = fotosPendentes.some((f) => f.tipo === "video") ? "video" : "foto";
      setFotosPendentes([]);
      await enviar(
        { conversa_id: conversaId, tipo, conteudo: legenda || void 0, anexo_ids: anexos.map((a) => a.id), resposta_a_id: responderA?.id },
        anexos
      );
      setResponderA(null);
      descerParaFundo();
    } catch (e) {
      import_react_native7.Alert.alert("Falha no envio", `N\xE3o foi poss\xEDvel enviar as fotos. ${e?.message ?? ""}`.trim());
    } finally {
      setAEnviarMedia(false);
    }
  };
  const enviarFicheiroLocal = async (f) => {
    setAEnviarMedia(true);
    try {
      const anexo = await enviarAnexoLocal(api, f);
      if (f.tipo === "ficheiro") await registarFicheiroLocal(engine.storage, anexo.id, f.uri);
      await enviar({ conversa_id: conversaId, tipo: f.tipo === "ficheiro" ? "ficheiro" : f.tipo, anexo_ids: [anexo.id] }, [anexo]);
      descerParaFundo();
    } catch (e) {
      import_react_native7.Alert.alert("Falha no envio", `N\xE3o foi poss\xEDvel enviar. ${e?.message ?? ""}`.trim());
    } finally {
      setAEnviarMedia(false);
    }
  };
  const indicePorId = (0, import_react9.useMemo)(() => {
    const mapa = /* @__PURE__ */ new Map();
    itensLista(mensagens, typing, eu?.identidade_id ?? null).forEach((item, i) => {
      if (item.mensagem) mapa.set(item.mensagem.id, i);
    });
    return mapa;
  }, [mensagens, typing, eu?.identidade_id]);
  const irParaMensagem = (0, import_react9.useCallback)(
    async (id) => {
      for (let tentativa = 0; tentativa < 10; tentativa++) {
        const idx = indicePorId.get(id);
        if (idx !== void 0) {
          lista.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
          setDestacada(id);
          setTimeout(() => setDestacada(null), 1600);
          return;
        }
        const carregadas = await engine.carregarMensagens(conversaId, mensagens[0]?.id).catch(() => 0);
        if (!carregadas) return;
      }
    },
    [indicePorId, engine, conversaId, mensagens]
  );
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
  const itens = (0, import_react9.useMemo)(() => itensLista(mensagens, typing, eu?.identidade_id ?? null), [mensagens, typing, eu?.identidade_id]);
  const itensAcoes = (m) => {
    const minha = m.remetente_identidade_id === eu?.identidade_id;
    const lista2 = [
      { icone: "arrow-undo-outline", rotulo: "Responder", acao: () => {
        setEditar(null);
        setResponderA(m);
      } }
    ];
    if (podeEncaminhar && !m.eliminada) lista2.push({ icone: "arrow-redo-outline", rotulo: "Encaminhar", acao: () => setEncaminhar(m) });
    if (minha && m.tipo === "texto" && !m.eliminada) lista2.push({ icone: "pencil-outline", rotulo: "Editar", acao: () => {
      setResponderA(null);
      setEditar(m);
      setTexto(m.conteudo ?? "");
    } });
    if (minha && grupo && !m.eliminada && m.estado_envio !== "a_enviar" && m.estado_envio !== "falhou") {
      lista2.push({ icone: "checkmark-done-outline", rotulo: "Relat\xF3rio de entrega", acao: () => setRelatorioDe(m) });
    }
    if (!m.eliminada) {
      lista2.push({
        icone: "trash-outline",
        rotulo: minha ? "Eliminar\u2026" : "Eliminar para mim",
        destrutivo: true,
        acao: () => {
          if (!minha) {
            void engine.eliminarMensagem(conversaId, m.id, false);
            return;
          }
          import_react_native7.Alert.alert("Eliminar mensagem?", void 0, [
            { text: "Cancelar", style: "cancel" },
            { text: "Para mim", onPress: () => void engine.eliminarMensagem(conversaId, m.id, false) },
            { text: "Para todos", style: "destructive", onPress: () => void engine.eliminarMensagem(conversaId, m.id, true) }
          ]);
        }
      });
    }
    return lista2;
  };
  const banner = conversa?.chamada_ativa && chamadas && !fechada && conversa.tipo === "grupo";
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react_native7.View, { style: { flex: 1, backgroundColor: tema.fundo }, children: [
    emFoco && barraEstado != null && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.StatusBar, { animated: true, barStyle: barraEstado === "clara" ? "light-content" : "dark-content" }),
    renderHeader ? renderHeader({
      conversa,
      contraparte,
      grupo,
      typingAtivo: !!typing?.ativo,
      totalMembros: conversa?.participantes.filter((p) => !p.saiu_em).length ?? 0,
      fechada,
      onVoltar,
      abrirInfo: () => conversa && onAbrirInfo?.(conversa),
      alternarPesquisa: () => {
        setPesquisaAberta(!pesquisaAberta);
        setResultados([]);
        setPesquisaQ("");
      },
      abrirMenu: () => setMenuAberto(true),
      ligarAudio: chamadas && podeAudioChamada && !fechada ? () => void chamadas.iniciar(conversaId, "audio") : void 0,
      ligarVideo: chamadas && podeVideoChamada && !fechada ? () => void chamadas.iniciar(conversaId, "video") : void 0
    }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react_native7.View, { style: [estilos6.header, { backgroundColor: tema.superficie }], children: [
      onVoltar && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.Pressable, { onPress: onVoltar, style: { padding: 6 }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_vector_icons6.Ionicons, { name: "chevron-back", size: 24, color: tema.texto }) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react_native7.Pressable, { style: estilos6.headerCentro, onPress: () => conversa && onAbrirInfo?.(conversa), children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Avatar, { nome: conversa?.titulo ?? "?", url: conversa?.foto_url, tamanho: 38 }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react_native7.View, { style: { flex: 1, minWidth: 0 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(NomeComBadge, { nome: conversa?.titulo ?? "\u2026", metadados: contraparte?.metadados, estilo: { fontSize: 16, fontWeight: "700", color: tema.texto } }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Presenca2, { contraparte, typingAtivo: !!typing?.ativo, grupo, participantes: conversa?.participantes ?? [], identidadeEu: identidade })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.Pressable, { onPress: () => {
        setPesquisaAberta(!pesquisaAberta);
        setResultados([]);
        setPesquisaQ("");
      }, style: { padding: 6 }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_vector_icons6.Ionicons, { name: "search", size: 21, color: tema.texto }) }),
      chamadas && podeAudioChamada && !fechada && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.Pressable, { onPress: () => void chamadas.iniciar(conversaId, "audio"), style: { padding: 6 }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_vector_icons6.Ionicons, { name: "call-outline", size: 21, color: tema.texto }) }),
      chamadas && podeVideoChamada && !fechada && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.Pressable, { onPress: () => void chamadas.iniciar(conversaId, "video"), style: { padding: 6 }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_vector_icons6.Ionicons, { name: "videocam-outline", size: 22, color: tema.texto }) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.Pressable, { onPress: () => setMenuAberto(true), style: { padding: 6 }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_vector_icons6.Ionicons, { name: "ellipsis-vertical", size: 20, color: tema.texto }) })
    ] }),
    pesquisaAberta && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react_native7.View, { style: [estilos6.pesquisaBarra, { backgroundColor: tema.superficie }], children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_vector_icons6.Ionicons, { name: "search", size: 16, color: tema.textoSuave }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        import_react_native7.TextInput,
        {
          autoFocus: true,
          value: pesquisaQ,
          onChangeText: setPesquisaQ,
          onSubmitEditing: () => resultados.length ? navegarResultado(1) : void executarPesquisa(),
          placeholder: "Pesquisar nesta conversa\u2026",
          placeholderTextColor: tema.textoSuave,
          style: { flex: 1, fontSize: 14.5, color: tema.texto, paddingVertical: 7 }
        }
      ),
      resultados.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react_native7.Text, { style: { fontSize: 12, color: tema.textoSuave }, children: [
        resultadoIdx + 1,
        "/",
        resultados.length
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.Pressable, { onPress: () => navegarResultado(-1), style: { padding: 4 }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_vector_icons6.Ionicons, { name: "chevron-up", size: 19, color: tema.textoSuave }) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.Pressable, { onPress: () => navegarResultado(1), style: { padding: 4 }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_vector_icons6.Ionicons, { name: "chevron-down", size: 19, color: tema.textoSuave }) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.Pressable, { onPress: () => setPesquisaAberta(false), style: { padding: 4 }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_vector_icons6.Ionicons, { name: "close", size: 19, color: tema.textoSuave }) })
    ] }),
    banner && conversa?.chamada_ativa && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react_native7.View, { style: estilos6.bannerChamada, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Pulso, { children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_vector_icons6.Ionicons, { name: conversa.chamada_ativa.tipo === "video" ? "videocam" : "call", size: 18, color: "#fff" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react_native7.Text, { style: { flex: 1, color: "#fff", fontWeight: "700", fontSize: 13.5 }, children: [
        "Chamada de ",
        conversa.chamada_ativa.tipo === "video" ? "v\xEDdeo" : "voz",
        " a decorrer"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        import_react_native7.Pressable,
        {
          onPress: () => void chamadas?.entrar(conversa.chamada_ativa.id, conversa.chamada_ativa.tipo),
          style: estilos6.bannerEntrar,
          children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.Text, { style: { color: "#059669", fontWeight: "800", fontSize: 13 }, children: "Entrar" })
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react_native7.View, { style: { flex: 1 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        ListaPerformante,
        {
          ref: lista,
          data: itens,
          inverted: true,
          keyExtractor: (item) => item.chave,
          estimatedItemSize: 64,
          extraData: `${versao}_${destacada}`,
          ListHeaderComponent: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.View, { style: { height: 10 } }),
          ListFooterComponent: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.View, { style: { height: 8 } }),
          viewabilityConfig,
          onViewableItemsChanged: aoMudarVisiveis,
          onScrollBeginDrag: () => {
            aDescer.current = false;
          },
          onEndReachedThreshold: 0.6,
          onEndReached: () => {
            if (aCarregarAntigas.current || semMaisAntigas.current || mensagens.length < 50) return;
            aCarregarAntigas.current = true;
            void engine.carregarMensagens(conversaId, mensagens[0]?.id).then((n) => {
              if (!n) semMaisAntigas.current = true;
            }).finally(() => {
              aCarregarAntigas.current = false;
            });
          },
          renderItem: ({ item }) => {
            if (item.tipo === "separador") {
              return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.View, { style: estilos6.separador, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.Text, { style: [estilos6.separadorTexto, { color: tema.textoSuave }], children: item.rotulo }) });
            }
            if (item.tipo === "typing") {
              return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(TypingBolha, {});
            }
            const m = item.mensagem;
            const minha = m.remetente_identidade_id === "eu" || m.remetente_identidade_id === eu?.identidade_id;
            const autor = conversa?.participantes.find((p) => p.identidade_id === m.remetente_identidade_id) ?? null;
            const respondida = m.resposta_a_id ? mensagens.find((x) => x.id === m.resposta_a_id) ?? null : null;
            return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
              Bolha,
              {
                mensagem: m,
                minha,
                grupo: !!grupo,
                autor,
                outros,
                primeiraDoBloco: item.primeiraDoBloco ?? true,
                ultimaDoBloco: item.ultimaDoBloco ?? true,
                respondida,
                destacada: destacada === m.id,
                aoResponder: () => {
                  setEditar(null);
                  setResponderA(m);
                },
                aoLongPress: () => setAcoesDe(m),
                aoVerReacoes: () => setReacoesDe(m),
                aoClicarCitacao: (id) => void irParaMensagem(id),
                aoAbrirFoto: (a) => onAbrirAnexo && a.url ? onAbrirAnexo(a.url, "foto") : setGaleriaDe(a.id),
                aoAbrirUrl: (url) => {
                  const anexo = m.anexos.find((a) => a.url === url);
                  if (anexo?.tipo === "video") setVideoAberto(url);
                  else void import_react_native7.Linking.openURL(url).catch(() => void 0);
                },
                aoLigar: chamadas && !fechada ? (tipo) => void chamadas.iniciar(conversaId, tipo) : void 0
              }
            );
          }
        }
      ),
      !noFundo && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react_native7.Pressable, { onPress: descerParaFundo, style: [estilos6.paraFundo, novas > 0 ? { backgroundColor: tema.primaria } : { backgroundColor: tema.superficie }], children: [
        novas > 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react_native7.Text, { style: { color: tema.primariaContraste, fontWeight: "800", fontSize: 12 }, children: [
          novas,
          " ",
          novas === 1 ? "nova" : "novas"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_vector_icons6.Ionicons, { name: "chevron-down", size: 18, color: novas > 0 ? tema.primariaContraste : tema.textoSuave })
      ] })
    ] }),
    (responderA || editar) && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react_native7.View, { style: [estilos6.previa, { backgroundColor: tema.superficie }], children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_vector_icons6.Ionicons, { name: editar ? "pencil-outline" : "arrow-undo-outline", size: 17, color: tema.primaria }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.Text, { numberOfLines: 1, style: { flex: 1, fontSize: 13, color: tema.textoSuave }, children: editar ? "A editar mensagem" : `${(responderA && conversa?.participantes.find((p) => p.identidade_id === responderA.remetente_identidade_id)?.nome) ?? ""}: ${responderA?.conteudo ?? "\u{1F4CE} anexo"}` }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.Pressable, { onPress: () => {
        setResponderA(null);
        setEditar(null);
        if (editar) setTexto("");
      }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_vector_icons6.Ionicons, { name: "close-circle", size: 20, color: tema.textoSuave }) })
    ] }),
    fechada ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react_native7.View, { style: [estilos6.fechada, { backgroundColor: tema.superficie, paddingBottom: Math.max(insets.bottom, 12) }], children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_vector_icons6.Ionicons, { name: "lock-closed-outline", size: 16, color: tema.textoSuave }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.Text, { style: { flex: 1, fontSize: 13, color: tema.textoSuave }, children: conversa?.fecho_motivo ?? "Esta conversa est\xE1 fechada." })
    ] }) : aGravar ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      GravadorAudio,
      {
        padFundo: padFundoInput,
        aoCancelar: () => setAGravar(false),
        aoTerminar: (uri, duracao) => {
          setAGravar(false);
          void enviarFicheiroLocal({ uri, mime: "audio/m4a", nome: `voz_${Date.now()}.m4a`, tipo: "audio", duracao_segundos: duracao });
        }
      }
    ) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      CampoTeclado,
      {
        behavior: KC ? "translate-with-padding" : import_react_native7.Platform.OS === "ios" ? "padding" : void 0,
        keyboardVerticalOffset: -(Math.max(insets.bottom, 8) - 8),
        children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react_native7.View, { style: [estilos6.inputLinha, { backgroundColor: tema.superficie, paddingBottom: padFundoInput }], children: [
          (podeFoto || podeFicheiro) && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.Pressable, { onPress: () => setAnexoMenu(true), style: { padding: 7 }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_vector_icons6.Ionicons, { name: "attach", size: 24, color: tema.textoSuave }) }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            import_react_native7.TextInput,
            {
              value: texto,
              onChangeText: aoEscrever,
              placeholder: "Mensagem",
              placeholderTextColor: tema.textoSuave,
              multiline: true,
              style: [estilos6.input, { backgroundColor: tema.fundo, color: tema.texto }]
            }
          ),
          texto.trim() ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.Pressable, { onPress: () => void aoEnviar(), style: [estilos6.enviar, { backgroundColor: tema.primaria }], children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_vector_icons6.Ionicons, { name: editar ? "checkmark" : "send", size: 19, color: tema.primariaContraste }) }) : podeAudioMsg ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.Pressable, { onPress: () => setAGravar(true), style: [estilos6.enviar, { backgroundColor: tema.primaria }], children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_vector_icons6.Ionicons, { name: "mic", size: 20, color: tema.primariaContraste }) }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.View, { style: { width: 42 } })
        ] })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Sheet, { visivel: acoesDe !== null, aoFechar: () => setAcoesDe(null), itens: acoesDe ? itensAcoes(acoesDe) : [], children: acoesDe && podeReagir && !acoesDe.eliminada && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.View, { style: estilos6.emojis, children: EMOJIS.map((e) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      import_react_native7.Pressable,
      {
        onPress: () => {
          const alvo = acoesDe;
          setAcoesDe(null);
          if (alvo) void engine.alternarReacao(conversaId, alvo.id, e);
        },
        style: { padding: 6 },
        children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.Text, { style: { fontSize: 26 }, children: e })
      },
      e
    )) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Sheet, { visivel: menuAberto, aoFechar: () => setMenuAberto(false), itens: itensMenuConversa() }),
    reacoesDe && conversa && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      SheetReacoes,
      {
        mensagem: mensagens.find((m) => m.id === reacoesDe.id) ?? reacoesDe,
        conversa,
        euId: eu?.identidade_id ?? null,
        aoFechar: () => setReacoesDe(null),
        aoRemoverMinha: (emoji) => void engine.alternarReacao(conversaId, reacoesDe.id, emoji),
        aoMensagem: onAbrirOutraConversa && podeCriarConversa ? async (p) => {
          const { conversa: nova } = await api.criarPrivada({ id_externo: p.id_externo, tipo: p.tipo, nome: p.nome });
          await engine.atualizarConversas();
          onAbrirOutraConversa(nova.id);
        } : void 0
      }
    ),
    encaminhar && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      SheetEncaminhar,
      {
        aoFechar: () => setEncaminhar(null),
        aoConfirmar: (ids) => {
          for (const id of ids) {
            void engine.enviarMensagem({
              conversa_id: id,
              tipo: encaminhar.tipo,
              conteudo: encaminhar.conteudo ?? void 0,
              encaminhada_de_id: encaminhar.id,
              metadados: encaminhar.metadados ?? void 0
            });
          }
          setEncaminhar(null);
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      Sheet,
      {
        visivel: anexoMenu,
        aoFechar: () => setAnexoMenu(false),
        titulo: "Anexar",
        itens: [
          ...podeFoto ? [{
            icone: "images-outline",
            rotulo: "Fotos e v\xEDdeos",
            acao: () => void escolherFotosEVideos().then((f) => f.length && setFotosPendentes(f))
          }] : [],
          ...podeFicheiro ? [{
            icone: "document-outline",
            rotulo: "Ficheiro",
            acao: () => void escolherFicheiro().then((f) => f && void enviarFicheiroLocal(f))
          }] : []
        ]
      }
    ),
    fotosPendentes.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      LobbyFotos,
      {
        ficheiros: fotosPendentes,
        aoMudar: setFotosPendentes,
        aoAdicionarMais: () => void escolherFotosEVideos().then((f) => setFotosPendentes((a) => [...a, ...f].slice(0, 10))),
        aoEnviar: (legenda) => void enviarFotos(legenda),
        aoFechar: () => setFotosPendentes([]),
        aEnviar: aEnviarMedia,
        insets
      }
    ),
    galeriaDe && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      Galeria,
      {
        mensagens,
        inicialAnexoId: galeriaDe,
        aoFechar: () => setGaleriaDe(null),
        aoResponder: (m) => setResponderA(m),
        aoEncaminhar: podeEncaminhar ? (m) => setEncaminhar(m) : void 0,
        insets
      }
    ),
    videoAberto && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(VisualizadorVideo, { url: videoAberto, aoFechar: () => setVideoAberto(null), insets }),
    relatorioDe && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      RelatorioEntrega,
      {
        conversaId,
        mensagem: relatorioDe,
        aoFechar: () => setRelatorioDe(null),
        insets
      }
    )
  ] });
  function itensMenuConversa() {
    const itens2 = [];
    if (conversa) {
      itens2.push({ icone: "information-circle-outline", rotulo: grupo ? "Info do grupo" : "Ver contacto", acao: () => onAbrirInfo?.(conversa) });
      itens2.push({ icone: "search-outline", rotulo: "Pesquisar na conversa", acao: () => {
        setPesquisaAberta(true);
        setResultados([]);
        setPesquisaQ("");
      } });
      const silenciada = !!conversa.participante?.silenciada_ate && new Date(conversa.participante.silenciada_ate) > /* @__PURE__ */ new Date();
      itens2.push(
        silenciada ? { icone: "notifications-outline", rotulo: "Reativar notifica\xE7\xF5es", acao: () => void engine.silenciarConversa(conversaId, null) } : { icone: "notifications-off-outline", rotulo: "Silenciar (sempre)", acao: () => void engine.silenciarConversa(conversaId, "9999-12-31T00:00:00.000Z") }
      );
      itens2.push({
        icone: "archive-outline",
        rotulo: conversa.participante?.arquivada ? "Desarquivar" : "Arquivar",
        acao: () => void api.atualizarPreferencias(conversaId, { arquivada: !conversa.participante?.arquivada }).then(() => engine.atualizarConversas())
      });
    }
    return itens2;
  }
}
function Presenca2({ contraparte, typingAtivo, grupo, participantes, identidadeEu }) {
  const { engine, subscreverPresenca, socket } = useMakaChat();
  const tema = useTema();
  const [online, setOnline] = (0, import_react9.useState)(false);
  const [tick, setTick] = (0, import_react9.useState)(0);
  (0, import_react9.useEffect)(() => {
    return subscreverPresenca((p) => {
      if (contraparte && p.identidade_id === contraparte.identidade_id) setOnline(p.online);
      setTick((t) => t + 1);
    });
  }, [contraparte, subscreverPresenca, socket]);
  const totalMembros = participantes.filter((p) => !p.saiu_em && p.tipo !== "sistema").length;
  const _tick = tick;
  const membrosOnline = grupo ? participantes.filter(
    (p) => !p.saiu_em && p.tipo !== "sistema" && !(p.id_externo === identidadeEu.id && p.tipo === identidadeEu.tipo) && engine.presencaDe(p.identidade_id)?.online
  ).length : 0;
  if (typingAtivo) return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.Text, { style: { fontSize: 12, color: tema.primaria, fontWeight: "600" }, children: "a escrever\u2026" });
  if (grupo) {
    return membrosOnline > 0 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react_native7.Text, { style: { fontSize: 12, color: "#10b981", fontWeight: "600" }, children: [
      membrosOnline,
      " online"
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react_native7.Text, { style: { fontSize: 12, color: tema.textoSuave }, children: [
      totalMembros,
      " membros"
    ] });
  }
  if (online) return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.Text, { style: { fontSize: 12, color: "#10b981", fontWeight: "600" }, children: "online" });
  return null;
}
function RelatorioEntrega({ conversaId, mensagem, aoFechar, insets }) {
  const { api } = useMakaChat();
  const tema = useTema();
  const [recibos, setRecibos] = (0, import_react9.useState)(null);
  (0, import_react9.useEffect)(() => {
    let vivo = true;
    void api.recibosDaMensagem(conversaId, mensagem.id).then((r) => vivo && setRecibos(r.recibos)).catch(() => vivo && setRecibos([]));
    return () => {
      vivo = false;
    };
  }, [api, conversaId, mensagem.id]);
  const vistos = (recibos ?? []).filter((r) => r.vista);
  const entregues = (recibos ?? []).filter((r) => r.entregue && !r.vista);
  const seccao = (titulo, icone, cor, lista) => lista.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react_native7.View, { style: { marginTop: 18 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react_native7.View, { style: estilos6.relSeccaoTopo, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_vector_icons6.Ionicons, { name: icone, size: 16, color: cor }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react_native7.Text, { style: { fontSize: 12.5, fontWeight: "700", color: tema.textoSuave, textTransform: "uppercase" }, children: [
        titulo,
        " \xB7 ",
        lista.length
      ] })
    ] }),
    lista.map((r) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react_native7.View, { style: estilos6.relLinha, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Avatar, { nome: r.nome, url: r.foto_url, tamanho: 40 }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.Text, { style: { flex: 1, fontSize: 15, fontWeight: "600", color: tema.texto }, numberOfLines: 1, children: r.nome }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_vector_icons6.Ionicons, { name: icone, size: 18, color: cor })
    ] }, r.identidade_id))
  ] });
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.Modal, { visible: true, animationType: "slide", onRequestClose: aoFechar, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react_native7.View, { style: { flex: 1, backgroundColor: tema.fundo }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react_native7.View, { style: [estilos6.relHeader, { backgroundColor: tema.superficie, paddingTop: insets.top + 8 }], children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.Pressable, { onPress: aoFechar, style: { padding: 6 }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_vector_icons6.Ionicons, { name: "chevron-back", size: 24, color: tema.texto }) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.Text, { style: { flex: 1, fontSize: 17, fontWeight: "700", color: tema.texto }, children: "Relat\xF3rio de entrega" })
    ] }),
    recibos === null ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.ActivityIndicator, { style: { marginTop: 40 }, color: tema.primaria }) : vistos.length === 0 && entregues.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.Text, { style: { padding: 24, textAlign: "center", color: tema.textoSuave }, children: "Ainda ningu\xE9m recebeu esta mensagem." }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react_native7.ScrollView, { contentContainerStyle: { paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }, children: [
      mensagem.conteudo ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react_native7.Text, { numberOfLines: 2, style: { marginTop: 12, fontSize: 13.5, color: tema.textoSuave, fontStyle: "italic" }, children: [
        "\u201C",
        mensagem.conteudo,
        "\u201D"
      ] }) : null,
      seccao("Visto por", "checkmark-done", "#38bdf8", vistos),
      seccao("Entregue a", "checkmark-done", tema.textoSuave, entregues)
    ] })
  ] }) });
}
function TypingBolha() {
  const tema = useTema();
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react_native7.View, { style: { flexDirection: "row", paddingHorizontal: 10, marginTop: 6 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.View, { style: { width: 30, marginRight: 4 } }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.View, { style: { backgroundColor: tema.bolhaOutro, borderRadius: tema.raio, borderBottomLeftRadius: 6, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", gap: 4 }, children: [0, 1, 2].map((i) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(PontoTyping, { atraso: i * 160 }, i)) })
  ] });
}
function PontoTyping({ atraso }) {
  const tema = useTema();
  const [opaco, setOpaco] = (0, import_react9.useState)(false);
  (0, import_react9.useEffect)(() => {
    const timer = setInterval(() => setOpaco((o) => !o), 480);
    const arranque = setTimeout(() => setOpaco(true), atraso);
    return () => {
      clearInterval(timer);
      clearTimeout(arranque);
    };
  }, [atraso]);
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.View, { style: { width: 7, height: 7, borderRadius: 4, backgroundColor: tema.textoSuave, opacity: opaco ? 0.85 : 0.3 } });
}
function SheetReacoes({ mensagem, conversa, euId, aoFechar, aoRemoverMinha, aoMensagem }) {
  const tema = useTema();
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(Sheet, { visivel: true, aoFechar, titulo: "Rea\xE7\xF5es", children: [
    mensagem.reacoes.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.Text, { style: { paddingHorizontal: 20, paddingVertical: 12, color: tema.textoSuave }, children: "Sem rea\xE7\xF5es." }),
    mensagem.reacoes.map((r) => {
      const p = conversa.participantes.find((x) => x.identidade_id === r.identidade_id);
      const souEu = r.identidade_id === euId;
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
        import_react_native7.Pressable,
        {
          onPress: () => {
            if (souEu) {
              aoRemoverMinha(r.emoji);
              aoFechar();
            } else if (aoMensagem && p) {
              aoFechar();
              void aoMensagem(p);
            }
          },
          style: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 9 },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Avatar, { nome: p?.nome ?? "?", url: p?.foto_url, tamanho: 36 }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react_native7.View, { style: { flex: 1 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.Text, { style: { fontSize: 15, fontWeight: "600", color: tema.texto }, children: souEu ? "Tu" : p?.nome ?? "Utilizador" }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.Text, { style: { fontSize: 12, color: tema.textoSuave }, children: souEu ? "Toca para remover" : aoMensagem ? "Toca para enviar mensagem" : "" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.Text, { style: { fontSize: 22 }, children: r.emoji })
          ]
        },
        r.identidade_id
      );
    })
  ] });
}
function SheetEncaminhar({ aoFechar, aoConfirmar }) {
  const { engine } = useMakaChat();
  const tema = useTema();
  const [conversas, setConversas] = (0, import_react9.useState)([]);
  const [escolhidas, setEscolhidas] = (0, import_react9.useState)(/* @__PURE__ */ new Set());
  (0, import_react9.useEffect)(() => {
    void engine.storage.listarConversas(false).then(setConversas);
  }, [engine]);
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(Sheet, { visivel: true, aoFechar, titulo: "Encaminhar para\u2026", children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.View, { style: { maxHeight: 360 }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      ListaPerformante,
      {
        data: conversas,
        keyExtractor: (c) => c.id,
        estimatedItemSize: 54,
        renderItem: ({ item: c }) => {
          const marcada = escolhidas.has(c.id);
          return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
            import_react_native7.Pressable,
            {
              onPress: () => setEscolhidas((a) => {
                const n = new Set(a);
                if (marcada) n.delete(c.id);
                else n.add(c.id);
                return n;
              }),
              style: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 8 },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_vector_icons6.Ionicons, { name: marcada ? "checkmark-circle" : "ellipse-outline", size: 22, color: marcada ? tema.primaria : tema.textoSuave }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Avatar, { nome: c.titulo ?? "?", url: c.foto_url, tamanho: 36 }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native7.Text, { numberOfLines: 1, style: { flex: 1, fontSize: 15, fontWeight: "600", color: tema.texto }, children: c.titulo ?? "Conversa" })
              ]
            }
          );
        }
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      import_react_native7.Pressable,
      {
        disabled: !escolhidas.size,
        onPress: () => aoConfirmar([...escolhidas]),
        style: { marginHorizontal: 16, marginTop: 10, borderRadius: 24, paddingVertical: 13, alignItems: "center", backgroundColor: tema.primaria, opacity: escolhidas.size ? 1 : 0.4 },
        children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react_native7.Text, { style: { color: tema.primariaContraste, fontWeight: "700", fontSize: 15 }, children: [
          "Enviar",
          escolhidas.size ? ` (${escolhidas.size})` : ""
        ] })
      }
    )
  ] });
}
function itensLista(mensagens, typing, euId) {
  const itens = [];
  if (typing?.ativo && typing.identidade_id !== euId) {
    itens.push({ tipo: "typing", chave: "typing" });
  }
  for (let i = mensagens.length - 1; i >= 0; i--) {
    const m = mensagens[i];
    const anterior = mensagens[i - 1];
    const seguinte = mensagens[i + 1];
    const mesmoBlocoAnterior = !!anterior && anterior.remetente_identidade_id === m.remetente_identidade_id && anterior.tipo !== "sistema" && m.tipo !== "sistema" && mesmoDia(anterior.criada_em, m.criada_em);
    const mesmoBlocoSeguinte = !!seguinte && seguinte.remetente_identidade_id === m.remetente_identidade_id && seguinte.tipo !== "sistema" && m.tipo !== "sistema" && mesmoDia(seguinte.criada_em, m.criada_em);
    itens.push({
      tipo: "mensagem",
      chave: m.id,
      mensagem: m,
      primeiraDoBloco: !mesmoBlocoAnterior,
      ultimaDoBloco: !mesmoBlocoSeguinte
    });
    if (!anterior || !mesmoDia(anterior.criada_em, m.criada_em)) {
      itens.push({ tipo: "separador", chave: `dia_${m.id}`, rotulo: rotuloDia(m.criada_em) });
    }
  }
  return itens;
}
function mesmoDia(a, b) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}
var estilos6 = import_react_native7.StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingTop: 50, paddingBottom: 8, paddingHorizontal: 8, gap: 2 },
  relHeader: { flexDirection: "row", alignItems: "center", paddingBottom: 10, paddingHorizontal: 8, gap: 4 },
  relSeccaoTopo: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 6 },
  relLinha: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 7 },
  headerCentro: { flex: 1, flexDirection: "row", alignItems: "center", gap: 9, minWidth: 0 },
  pesquisaBarra: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, paddingVertical: 4 },
  bannerChamada: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#059669", paddingHorizontal: 14, paddingVertical: 9 },
  bannerEntrar: { backgroundColor: "#fff", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 6 },
  separador: { alignSelf: "center", backgroundColor: "rgba(100,116,139,0.12)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 3, marginVertical: 8 },
  separadorTexto: { fontSize: 11.5, fontWeight: "600" },
  paraFundo: {
    position: "absolute",
    bottom: 14,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4
  },
  previa: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 8 },
  fechada: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
  inputLinha: { flexDirection: "row", alignItems: "flex-end", gap: 6, paddingHorizontal: 8, paddingVertical: 7 },
  input: { flex: 1, borderRadius: 21, paddingHorizontal: 15, paddingTop: 10, paddingBottom: 10, fontSize: 16.5, maxHeight: 120 },
  enviar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  emojis: { flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 16, paddingVertical: 6 }
});

// src/ui/ConversasScreen.tsx
var import_vector_icons7 = require("@expo/vector-icons");
var import_makachat_core3 = require("@hongayetu/makachat-core");
var import_react10 = require("react");
var import_react_native8 = require("react-native");
var import_jsx_runtime8 = require("react/jsx-runtime");
var SEMPRE = "9999-12-31T00:00:00.000Z";
function ConversasScreen({ arquivadas = false, onAbrirConversa, conversaInicial, onAbrirArquivadas, textoVazio, tituloVazio, renderVazio, renderTopo, onNovaConversa }) {
  const { engine, api, identidade, contactos } = useMakaChat();
  const tema = useTema();
  const semLigacao = useSemLigacao();
  const conversas = useConversas(arquivadas);
  const versao = useVersaoChat();
  const podeGrupos = useFuncionalidadeAtiva("grupos");
  const podeEliminar = useFuncionalidadeAtiva("conversas.eliminar");
  const podeCriar = useFuncionalidadeAtiva("conversas.criar");
  const [busca, setBusca] = (0, import_react10.useState)("");
  const [resultadosServidor, setResultadosServidor] = (0, import_react10.useState)(null);
  const [menuDe, setMenuDe] = (0, import_react10.useState)(null);
  const [silenciarDe, setSilenciarDe] = (0, import_react10.useState)(null);
  const [novaAberta, setNovaAberta] = (0, import_react10.useState)(false);
  const aPaginar = (0, import_react10.useRef)(false);
  const fimDaLista = (0, import_react10.useRef)(false);
  (0, import_react10.useEffect)(() => {
    if (!conversaInicial) return;
    void engine.entrarConversa(conversaInicial).then(async () => {
      const c = await engine.storage.obterConversa(conversaInicial);
      if (c) onAbrirConversa(c);
    });
  }, [conversaInicial]);
  (0, import_react10.useEffect)(() => {
    const q = busca.trim();
    if (!q) {
      setResultadosServidor(null);
      return;
    }
    const timer = setTimeout(() => {
      void api.listarConversas({ q, arquivadas, limite: 30 }).then(async (r) => {
        setResultadosServidor(r.conversas);
        await engine.storage.upsertConversas(r.conversas);
      }).catch(() => setResultadosServidor(null));
    }, 300);
    return () => clearTimeout(timer);
  }, [api, engine, busca, arquivadas]);
  const visiveis = (0, import_react10.useMemo)(() => {
    const q = busca.trim().toLowerCase();
    if (q && resultadosServidor) return resultadosServidor;
    if (!q) return conversas;
    return conversas.filter((c) => (c.titulo ?? "").toLowerCase().includes(q));
  }, [busca, conversas, resultadosServidor]);
  const paginar = async () => {
    if (busca.trim() || aPaginar.current || fimDaLista.current) return;
    const ultima = conversas.at(-1);
    if (!ultima) return;
    aPaginar.current = true;
    try {
      const r = await api.listarConversas({ arquivadas, cursor: String(ultima.ultima_atividade_em), limite: 30 });
      if (r.conversas.length) await engine.storage.upsertConversas(r.conversas);
      else fimDaLista.current = true;
    } finally {
      aPaginar.current = false;
    }
  };
  const preferencia = async (c, dados) => {
    await api.atualizarPreferencias(c.id, dados).catch(() => void 0);
    await engine.storage.upsertConversas([
      { ...c, participante: c.participante ? { ...c.participante, ...dados } : c.participante }
    ]);
    void engine.atualizarConversas();
  };
  const itensMenu = (c) => {
    const silenciada = !!c.participante?.silenciada_ate && new Date(c.participante.silenciada_ate) > /* @__PURE__ */ new Date();
    const itens = [
      {
        icone: "mail-unread-outline",
        rotulo: "Marcar como n\xE3o lida",
        acao: () => void engine.marcarNaoLida(c.id).catch(() => void 0)
      },
      {
        icone: c.participante?.fixada ? "pin" : "pin-outline",
        rotulo: c.participante?.fixada ? "Desafixar" : "Fixar",
        acao: () => void preferencia(c, { fixada: !c.participante?.fixada })
      },
      silenciada ? { icone: "notifications-outline", rotulo: "Reativar notifica\xE7\xF5es", acao: () => void engine.silenciarConversa(c.id, null) } : { icone: "notifications-off-outline", rotulo: "Silenciar\u2026", acao: () => setSilenciarDe(c) },
      {
        icone: arquivadas ? "archive" : "archive-outline",
        rotulo: arquivadas ? "Desarquivar" : "Arquivar",
        acao: () => void preferencia(c, { arquivada: !arquivadas })
      }
    ];
    if (podeEliminar) {
      itens.push({
        icone: "trash-outline",
        rotulo: "Eliminar conversa",
        destrutivo: true,
        acao: () => import_react_native8.Alert.alert("Eliminar conversa?", "O hist\xF3rico desaparece para ti. A outra pessoa mant\xE9m a conversa dela.", [
          { text: "Cancelar", style: "cancel" },
          { text: "Eliminar", style: "destructive", onPress: () => void engine.eliminarConversa(c.id) }
        ])
      });
    }
    return itens;
  };
  const item = (c) => {
    const naoLidas = c.participante?.mensagens_nao_lidas ?? 0;
    const silenciada = !!c.participante?.silenciada_ate && new Date(c.participante.silenciada_ate) > /* @__PURE__ */ new Date();
    const contraparte = contraparteDe(c, identidade);
    return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
      import_react_native8.Pressable,
      {
        onPress: () => onAbrirConversa(c),
        onLongPress: () => setMenuDe(c),
        style: ({ pressed }) => [estilos7.item, pressed && { backgroundColor: "rgba(0,0,0,0.04)" }],
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_react_native8.View, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Avatar, { nome: c.titulo ?? "?", url: c.foto_url, tamanho: 52 }),
            c.tipo === "privada" && contraparte && engine.presencaDe(contraparte.identidade_id)?.online && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_react_native8.View, { style: [estilos7.bolinhaOnline, { borderColor: tema.superficie }] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_react_native8.View, { style: { flex: 1, minWidth: 0 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_react_native8.View, { style: estilos7.linhaTopo, children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                NomeComBadge,
                {
                  nome: c.titulo ?? "Conversa",
                  metadados: contraparte?.metadados,
                  estilo: [estilos7.titulo, { color: tema.texto }, naoLidas > 0 && { fontWeight: "800" }]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_react_native8.Text, { style: { fontSize: 12, color: naoLidas > 0 ? tema.primaria : tema.textoSuave }, children: horaCurta(c.ultima_atividade_em) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_react_native8.View, { style: estilos7.linhaBaixo, children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                import_react_native8.Text,
                {
                  numberOfLines: 1,
                  style: { flex: 1, fontSize: 13.5, color: tema.textoSuave, fontWeight: naoLidas > 0 ? "600" : "400" },
                  children: previewConversa(c)
                }
              ),
              c.chamada_ativa && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Pulso, { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_vector_icons7.Ionicons, { name: "call", size: 15, color: "#10b981" }) }),
              silenciada && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_vector_icons7.Ionicons, { name: "notifications-off", size: 14, color: tema.textoSuave }),
              c.participante?.fixada && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_vector_icons7.Ionicons, { name: "pin", size: 14, color: tema.textoSuave }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(BadgeNaoLidas, { contagem: naoLidas })
            ] })
          ] })
        ]
      },
      c.id
    );
  };
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_react_native8.View, { style: { flex: 1, backgroundColor: tema.superficie }, children: [
    semLigacao && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_react_native8.View, { style: estilos7.offline, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_react_native8.Text, { style: estilos7.offlineTexto, children: "Sem liga\xE7\xE3o \u2014 a reconectar\u2026" }) }),
    renderTopo ? renderTopo({
      busca,
      setBusca,
      abrirArquivadas: !arquivadas && onAbrirArquivadas ? onAbrirArquivadas : void 0,
      arquivadas
    }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_react_native8.View, { style: [estilos7.pesquisa, { backgroundColor: tema.fundo }], children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_vector_icons7.Ionicons, { name: "search", size: 17, color: tema.textoSuave }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          import_react_native8.TextInput,
          {
            value: busca,
            onChangeText: setBusca,
            placeholder: "Pesquisar conversas",
            placeholderTextColor: tema.textoSuave,
            style: { flex: 1, fontSize: 15, color: tema.texto, paddingVertical: 8 }
          }
        ),
        busca.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_react_native8.Pressable, { onPress: () => setBusca(""), children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_vector_icons7.Ionicons, { name: "close-circle", size: 18, color: tema.textoSuave }) })
      ] }),
      !arquivadas && onAbrirArquivadas && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_react_native8.Pressable, { onPress: onAbrirArquivadas, style: ({ pressed }) => [estilos7.arquivadas, pressed && { opacity: 0.6 }], children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_vector_icons7.Ionicons, { name: "archive-outline", size: 19, color: tema.textoSuave }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_react_native8.Text, { style: { fontSize: 14.5, fontWeight: "600", color: tema.texto }, children: "Arquivadas" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      ListaPerformante,
      {
        data: visiveis,
        keyExtractor: (c) => c.id,
        renderItem: ({ item: c }) => item(c),
        onEndReached: () => void paginar(),
        onEndReachedThreshold: 0.4,
        extraData: versao,
        estimatedItemSize: 72,
        ListEmptyComponent: busca.trim() ? (
          // pesquisa ativa sem resultados: mensagem discreta, sem CTA
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_react_native8.Text, { style: { textAlign: "center", marginTop: 48, color: tema.textoSuave }, children: "Sem resultados." })
        ) : renderVazio ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_jsx_runtime8.Fragment, { children: renderVazio() }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_react_native8.View, { style: estilos7.vazio, children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_react_native8.View, { style: [estilos7.vazioIcone, { backgroundColor: `${tema.primaria}1A` }], children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            import_vector_icons7.Ionicons,
            {
              name: arquivadas ? "archive-outline" : "chatbubbles-outline",
              size: 40,
              color: tema.primaria
            }
          ) }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_react_native8.Text, { style: [estilos7.vazioTitulo, { color: tema.texto }], children: tituloVazio ?? (arquivadas ? "Nada arquivado" : "Ainda sem conversas") }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_react_native8.Text, { style: [estilos7.vazioTexto, { color: tema.textoSuave }], children: textoVazio ?? (arquivadas ? "As conversas que arquivares aparecem aqui." : "Quando come\xE7ares a falar com algu\xE9m, as conversas aparecem aqui.") }),
          !arquivadas && podeCriar && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
            import_react_native8.Pressable,
            {
              onPress: () => onNovaConversa ? onNovaConversa() : setNovaAberta(true),
              style: ({ pressed }) => [
                estilos7.vazioBotao,
                { backgroundColor: tema.primaria },
                pressed && { opacity: 0.85 }
              ],
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_vector_icons7.Ionicons, { name: "add", size: 18, color: tema.primariaContraste }),
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_react_native8.Text, { style: { color: tema.primariaContraste, fontWeight: "700", fontSize: 14.5 }, children: "Come\xE7ar conversa" })
              ]
            }
          )
        ] })
      }
    ),
    !arquivadas && podeCriar && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      import_react_native8.Pressable,
      {
        onPress: () => onNovaConversa ? onNovaConversa() : setNovaAberta(true),
        style: ({ pressed }) => [estilos7.fab, { backgroundColor: tema.primaria }, pressed && { transform: [{ scale: 0.94 }] }],
        children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_vector_icons7.Ionicons, { name: "create-outline", size: 26, color: tema.primariaContraste, style: { marginLeft: 2 } })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Sheet, { visivel: menuDe !== null, aoFechar: () => setMenuDe(null), titulo: menuDe?.titulo ?? void 0, itens: menuDe ? itensMenu(menuDe) : [] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      Sheet,
      {
        visivel: silenciarDe !== null,
        aoFechar: () => setSilenciarDe(null),
        titulo: "Silenciar notifica\xE7\xF5es",
        itens: silenciarDe ? [
          { icone: "time-outline", rotulo: "8 horas", acao: () => void engine.silenciarConversa(silenciarDe.id, new Date(Date.now() + 8 * 36e5).toISOString()) },
          { icone: "time-outline", rotulo: "1 semana", acao: () => void engine.silenciarConversa(silenciarDe.id, new Date(Date.now() + 7 * 864e5).toISOString()) },
          { icone: "notifications-off-outline", rotulo: "Sempre", acao: () => void engine.silenciarConversa(silenciarDe.id, SEMPRE) }
        ] : []
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      NovaConversaSheet,
      {
        visivel: novaAberta,
        aoFechar: () => setNovaAberta(false),
        conversas,
        contactos,
        podeGrupos,
        aoCriada: (c) => {
          setNovaAberta(false);
          onAbrirConversa(c);
        }
      }
    )
  ] });
}
function NovaConversaSheet({ visivel, aoFechar, conversas, contactos, podeGrupos, aoCriada }) {
  const { api, engine, identidade } = useMakaChat();
  const tema = useTema();
  const [escolhidos, setEscolhidos] = (0, import_react10.useState)(/* @__PURE__ */ new Set());
  const [nome, setNome] = (0, import_react10.useState)("");
  const pessoas = (0, import_react10.useMemo)(() => {
    const mapa = /* @__PURE__ */ new Map();
    for (const c of conversas) {
      for (const p of c.participantes) {
        if (p.tipo === "sistema") continue;
        if (p.id_externo === identidade.id && p.tipo === identidade.tipo) continue;
        mapa.set(`${p.tipo}:${p.id_externo}`, { id_externo: p.id_externo, tipo: p.tipo, nome: p.nome, foto: p.foto_url });
      }
    }
    for (const alvo of contactos) {
      if (alvo.id_externo === identidade.id && alvo.tipo === identidade.tipo) continue;
      mapa.set(`${alvo.tipo}:${alvo.id_externo}`, alvo);
    }
    return [...mapa.values()];
  }, [conversas, contactos, identidade]);
  const grupo = escolhidos.size > 1;
  const membros = pessoas.filter((p) => escolhidos.has(`${p.tipo}:${p.id_externo}`));
  const nomePadrao = membros.map((p) => (p.nome ?? p.id_externo).split(" ")[0]).join(", ");
  const criar = async () => {
    if (!membros.length) return;
    const { conversa } = grupo ? await api.criarGrupo(nome.trim() || nomePadrao, membros) : await api.criarPrivada({ id_externo: membros[0].id_externo, tipo: membros[0].tipo, nome: membros[0].nome });
    await engine.atualizarConversas();
    setEscolhidos(/* @__PURE__ */ new Set());
    setNome("");
    aoCriada(conversa);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(Sheet, { visivel, aoFechar, titulo: "Nova conversa", children: [
    podeGrupos && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_react_native8.Text, { style: { paddingHorizontal: 20, paddingBottom: 6, fontSize: 12.5, color: tema.textoSuave }, children: "Escolhe uma pessoa \u2014 ou v\xE1rias para criar um grupo." }),
    grupo && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      import_react_native8.TextInput,
      {
        value: nome,
        onChangeText: setNome,
        placeholder: `Nome do grupo (padr\xE3o: ${nomePadrao})`,
        placeholderTextColor: tema.textoSuave,
        style: [estilos7.inputNome, { backgroundColor: tema.fundo, color: tema.texto }]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_react_native8.View, { style: { maxHeight: 340 }, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      ListaPerformante,
      {
        data: pessoas,
        keyExtractor: (p) => `${p.tipo}:${p.id_externo}`,
        estimatedItemSize: 56,
        renderItem: ({ item: p }) => {
          const chave = `${p.tipo}:${p.id_externo}`;
          const marcado = escolhidos.has(chave);
          return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
            import_react_native8.Pressable,
            {
              onPress: () => setEscolhidos((a) => {
                if (marcado) {
                  const n = new Set(a);
                  n.delete(chave);
                  return n;
                }
                return podeGrupos ? new Set(a).add(chave) : /* @__PURE__ */ new Set([chave]);
              }),
              style: ({ pressed }) => [estilos7.pessoa, pressed && { backgroundColor: "rgba(0,0,0,0.04)" }],
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                  import_vector_icons7.Ionicons,
                  {
                    name: marcado ? "checkmark-circle" : "ellipse-outline",
                    size: 22,
                    color: marcado ? tema.primaria : tema.textoSuave
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Avatar, { nome: p.nome ?? p.id_externo, url: p.foto ?? null, tamanho: 38 }),
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_react_native8.Text, { style: { flex: 1, fontSize: 15, fontWeight: "600", color: tema.texto }, numberOfLines: 1, children: p.nome ?? p.id_externo }),
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_react_native8.Text, { style: { fontSize: 12, color: tema.textoSuave }, children: (0, import_makachat_core3.rotuloTipoIdentidade)(p.tipo) })
              ]
            }
          );
        },
        ListEmptyComponent: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_react_native8.Text, { style: { padding: 20, color: tema.textoSuave }, children: "Sem contactos conhecidos." })
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      import_react_native8.Pressable,
      {
        disabled: !membros.length,
        onPress: () => void criar(),
        style: [estilos7.botaoCriar, { backgroundColor: tema.primaria, opacity: membros.length ? 1 : 0.4 }],
        children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_react_native8.Text, { style: { color: tema.primariaContraste, fontWeight: "700", fontSize: 15 }, children: grupo ? `Criar grupo (${escolhidos.size})` : "Iniciar conversa" })
      }
    )
  ] });
}
function previewConversa(c) {
  const u = c.ultima_mensagem;
  if (!u) return "";
  if (u.eliminada) return "\u{1F6AB} Mensagem eliminada";
  const p = {
    foto: "\u{1F4F7} Foto",
    video: "\u{1F3AC} V\xEDdeo",
    audio: "\u{1F3A4} Mensagem de voz",
    ficheiro: "\u{1F4CE} Ficheiro",
    partilha: "\u{1F517} Partilha",
    link: "\u{1F517} Link"
  };
  return u.tipo === "texto" || u.tipo === "sistema" || u.tipo === "chamada" ? u.conteudo ?? "" : p[u.tipo] ?? "";
}
var estilos7 = import_react_native8.StyleSheet.create({
  bolinhaOnline: {
    position: "absolute",
    right: 0,
    bottom: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#10b981",
    borderWidth: 2.5
  },
  vazio: { alignItems: "center", paddingHorizontal: 36, paddingTop: 72 },
  vazioIcone: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  vazioTitulo: { fontSize: 17, fontWeight: "800", marginBottom: 6, textAlign: "center" },
  vazioTexto: { fontSize: 13.5, lineHeight: 19, textAlign: "center" },
  vazioBotao: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 11, marginTop: 20 },
  offline: { backgroundColor: "#fef3c7", paddingVertical: 5, alignItems: "center" },
  offlineTexto: { color: "#92400e", fontSize: 12, fontWeight: "600" },
  pesquisa: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 14,
    marginVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 22
  },
  arquivadas: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 10 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 9 },
  linhaTopo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  linhaBaixo: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  titulo: { fontSize: 16, fontWeight: "600", flexShrink: 1 },
  fab: {
    position: "absolute",
    right: 18,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6
  },
  inputNome: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15
  },
  pessoa: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 9 },
  botaoCriar: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 24,
    paddingVertical: 13,
    alignItems: "center"
  }
});

// src/ui/InfoConversaScreen.tsx
var import_vector_icons8 = require("@expo/vector-icons");
var import_makachat_core4 = require("@hongayetu/makachat-core");
var import_react11 = require("react");
var import_react_native9 = require("react-native");
var import_react_native_safe_area_context4 = require("react-native-safe-area-context");
var import_jsx_runtime9 = require("react/jsx-runtime");
function InfoConversaScreen({ conversaId, onVoltar, onSaiu, onAbrirOutraConversa, barraEstado = "escura" }) {
  const { engine, api, identidade, contactos, aoVerPerfil } = useMakaChat();
  const tema = useTema();
  const insets = (0, import_react_native_safe_area_context4.useSafeAreaInsets)();
  const versao = useVersaoChat();
  const podeGrupos = useFuncionalidadeAtiva("grupos");
  const podeCriarConversa = useFuncionalidadeAtiva("conversas.criar");
  const [conversa, setConversa] = (0, import_react11.useState)(null);
  const [renomear, setRenomear] = (0, import_react11.useState)(false);
  const [novoNome, setNovoNome] = (0, import_react11.useState)("");
  const [adicionarAberto, setAdicionarAberto] = (0, import_react11.useState)(false);
  const [membroDe, setMembroDe] = (0, import_react11.useState)(null);
  (0, import_react11.useEffect)(() => {
    void engine.storage.obterConversa(conversaId).then(setConversa);
  }, [engine, conversaId, versao]);
  const eu = conversa?.participantes.find((p) => p.id_externo === identidade.id && p.tipo === identidade.tipo) ?? null;
  const souAdmin = eu?.papel === "dono" || eu?.papel === "admin";
  const grupo = conversa?.tipo === "grupo";
  const membros = (conversa?.participantes ?? []).filter((p) => !p.saiu_em && p.tipo !== "sistema");
  const contraparte = !grupo ? membros.find((p) => p.identidade_id !== eu?.identidade_id) ?? null : null;
  const atualizar = async () => {
    const { conversa: fresca } = await api.obterConversa(conversaId);
    await engine.storage.upsertConversas([fresca]);
    setConversa(fresca);
  };
  const mudarFoto = async () => {
    const fotos = await escolherFotosEVideos();
    const foto = fotos.find((f) => f.tipo === "foto");
    if (!foto) return;
    try {
      const anexo = await enviarAnexoLocal(api, foto, { duravel: true });
      if (anexo.url) {
        await api.atualizarGrupo(conversaId, { foto_url: anexo.url });
        await atualizar();
      }
    } catch {
      import_react_native9.Alert.alert("Falha", "N\xE3o foi poss\xEDvel mudar a foto do grupo.");
    }
  };
  const guardarNome = async () => {
    const titulo = novoNome.trim();
    if (!titulo) return;
    await api.atualizarGrupo(conversaId, { titulo }).catch(() => void 0);
    setRenomear(false);
    await atualizar();
  };
  const sairDoGrupo = () => {
    import_react_native9.Alert.alert("Sair do grupo?", "Deixas de receber mensagens desta conversa.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: () => {
          void api.sairDaConversa(conversaId).then(async () => {
            await engine.storage.removerConversa(conversaId);
            await engine.atualizarConversas();
            onSaiu?.();
          });
        }
      }
    ]);
  };
  const removerMembro = (p) => {
    import_react_native9.Alert.alert(`Remover ${p.nome}?`, void 0, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: () => void api.removerParticipante(conversaId, p.identidade_id).then(atualizar)
      }
    ]);
  };
  if (!conversa) return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.View, { style: { flex: 1, backgroundColor: tema.fundo } });
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_react_native9.View, { style: { flex: 1, backgroundColor: tema.fundo }, children: [
    barraEstado != null && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.StatusBar, { animated: true, barStyle: barraEstado === "clara" ? "light-content" : "dark-content" }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_react_native9.View, { style: [estilos8.header, { backgroundColor: tema.superficie, paddingTop: insets.top + 8 }], children: [
      onVoltar && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.Pressable, { onPress: onVoltar, style: { padding: 6 }, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_vector_icons8.Ionicons, { name: "chevron-back", size: 24, color: tema.texto }) }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.Text, { style: { flex: 1, fontSize: 17, fontWeight: "700", color: tema.texto }, children: grupo ? "Info do grupo" : "Contacto" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_react_native9.ScrollView, { contentContainerStyle: { paddingBottom: insets.bottom + 16 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_react_native9.View, { style: [estilos8.topo, { backgroundColor: tema.superficie }], children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_react_native9.Pressable, { onPress: grupo && souAdmin ? () => void mudarFoto() : void 0, children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Avatar, { nome: conversa.titulo ?? "?", url: conversa.foto_url, tamanho: 96 }),
          grupo && souAdmin && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.View, { style: [estilos8.mudarFoto, { backgroundColor: tema.primaria }], children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_vector_icons8.Ionicons, { name: "camera", size: 15, color: tema.primariaContraste }) })
        ] }),
        renomear ? /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_react_native9.View, { style: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            import_react_native9.TextInput,
            {
              autoFocus: true,
              value: novoNome,
              onChangeText: setNovoNome,
              style: [estilos8.inputNome, { backgroundColor: tema.fundo, color: tema.texto }]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.Pressable, { onPress: () => void guardarNome(), children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_vector_icons8.Ionicons, { name: "checkmark-circle", size: 30, color: tema.primaria }) })
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
          import_react_native9.Pressable,
          {
            onPress: grupo && souAdmin ? () => {
              setNovoNome(conversa.titulo ?? "");
              setRenomear(true);
            } : void 0,
            style: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.Text, { style: { fontSize: 20, fontWeight: "800", color: tema.texto }, children: conversa.titulo }),
              grupo && souAdmin && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_vector_icons8.Ionicons, { name: "pencil", size: 16, color: tema.textoSuave })
            ]
          }
        ),
        grupo && /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_react_native9.Text, { style: { fontSize: 13, color: tema.textoSuave, marginTop: 3 }, children: [
          membros.length,
          " membros"
        ] }),
        !grupo && contraparte && engine.presencaDe(contraparte.identidade_id)?.online && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.Text, { style: { fontSize: 13, fontWeight: "600", color: "#10b981", marginTop: 3 }, children: "online" }),
        !grupo && contraparte && aoVerPerfil && /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
          import_react_native9.Pressable,
          {
            onPress: () => aoVerPerfil(contraparte),
            style: [estilos8.verPerfil, { borderColor: tema.primaria }],
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_vector_icons8.Ionicons, { name: "person-circle-outline", size: 18, color: tema.primaria }),
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.Text, { style: { fontSize: 14, fontWeight: "700", color: tema.primaria }, children: "Ver perfil" })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_react_native9.View, { style: [estilos8.seccao, { backgroundColor: tema.superficie }], children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.Text, { style: [estilos8.seccaoTitulo, { color: tema.textoSuave }], children: grupo ? "Membros" : "Participantes" }),
        grupo && souAdmin && podeGrupos && /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_react_native9.Pressable, { onPress: () => setAdicionarAberto(true), style: estilos8.membro, children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.View, { style: [estilos8.addIcone, { backgroundColor: tema.primaria }], children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_vector_icons8.Ionicons, { name: "person-add", size: 18, color: tema.primariaContraste }) }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.Text, { style: { fontSize: 15, fontWeight: "600", color: tema.primaria }, children: "Adicionar membros" })
        ] }),
        membros.map((p) => {
          const souEuMesmo = p.identidade_id === eu?.identidade_id;
          return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_react_native9.Pressable, { onPress: souEuMesmo ? void 0 : () => setMembroDe(p), style: estilos8.membro, children: [
            /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_react_native9.View, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Avatar, { nome: p.nome, url: p.foto_url, tamanho: 42 }),
              !souEuMesmo && engine.presencaDe(p.identidade_id)?.online && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.View, { style: [estilos8.bolinhaMembro, { borderColor: tema.superficie }] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_react_native9.View, { style: { flex: 1, minWidth: 0 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(NomeComBadge, { nome: souEuMesmo ? "Tu" : p.nome, metadados: p.metadados, estilo: { fontSize: 15, fontWeight: "600", color: tema.texto } }),
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.Text, { style: { fontSize: 12, color: tema.textoSuave }, children: (0, import_makachat_core4.rotuloTipoIdentidade)(p.tipo) })
            ] }),
            (p.papel === "dono" || p.papel === "admin") && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.View, { style: [estilos8.papel, { borderColor: tema.primaria }], children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.Text, { style: { fontSize: 10.5, fontWeight: "700", color: tema.primaria }, children: p.papel === "dono" ? "Dono" : "Admin" }) })
          ] }, p.identidade_id);
        })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(MediaDaConversa, { conversaId }),
      grupo && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.View, { style: [estilos8.seccao, { backgroundColor: tema.superficie }], children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_react_native9.Pressable, { onPress: sairDoGrupo, style: estilos8.membro, children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_vector_icons8.Ionicons, { name: "exit-outline", size: 22, color: "#ef4444" }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.Text, { style: { fontSize: 15, fontWeight: "600", color: "#ef4444" }, children: "Sair do grupo" })
      ] }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      Sheet,
      {
        visivel: membroDe !== null,
        aoFechar: () => setMembroDe(null),
        titulo: membroDe?.nome,
        itens: membroDe ? [
          ...aoVerPerfil ? [{
            icone: "person-circle-outline",
            rotulo: "Ver perfil",
            acao: () => aoVerPerfil(membroDe)
          }] : [],
          ...onAbrirOutraConversa && podeCriarConversa ? [{
            icone: "chatbubble-outline",
            rotulo: "Enviar mensagem",
            acao: () => {
              const p = membroDe;
              void api.criarPrivada({ id_externo: p.id_externo, tipo: p.tipo, nome: p.nome }).then(async ({ conversa: nova }) => {
                await engine.atualizarConversas();
                onAbrirOutraConversa(nova.id);
              });
            }
          }] : [],
          ...grupo && souAdmin && membroDe.papel !== "dono" ? [
            {
              icone: membroDe.papel === "admin" ? "shield-outline" : "shield-checkmark-outline",
              rotulo: membroDe.papel === "admin" ? "Remover de administrador" : "Tornar administrador",
              acao: () => {
                const p = membroDe;
                void api.mudarPapel(conversaId, p.identidade_id, p.papel === "admin" ? "membro" : "admin").then(atualizar).catch(() => import_react_native9.Alert.alert("Falha", "N\xE3o foi poss\xEDvel alterar o papel."));
              }
            },
            {
              icone: "person-remove-outline",
              rotulo: "Remover do grupo",
              destrutivo: true,
              acao: () => removerMembro(membroDe)
            }
          ] : []
        ] : []
      }
    ),
    adicionarAberto && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      AdicionarMembrosSheet,
      {
        conversa,
        contactos,
        aoFechar: () => setAdicionarAberto(false),
        aoAdicionar: async (alvos) => {
          setAdicionarAberto(false);
          await api.adicionarParticipantes(conversaId, alvos).catch(() => void 0);
          await atualizar();
        }
      }
    )
  ] });
}
var TABS = [
  { chave: "fotos", rotulo: "Fotos" },
  { chave: "ficheiros", rotulo: "Ficheiros" },
  { chave: "audios", rotulo: "\xC1udios" },
  { chave: "links", rotulo: "Links" }
];
function MediaDaConversa({ conversaId }) {
  const { api } = useMakaChat();
  const tema = useTema();
  const { width } = (0, import_react_native9.useWindowDimensions)();
  const [tab, setTab] = (0, import_react11.useState)("fotos");
  const [anexos, setAnexos] = (0, import_react11.useState)(null);
  const [links, setLinks] = (0, import_react11.useState)(null);
  const [aCarregar, setACarregar] = (0, import_react11.useState)(false);
  const [temMais, setTemMais] = (0, import_react11.useState)(false);
  const LIMITE = 30;
  const ladoFoto = (width - 16 * 2 - 4 * 2) / 3;
  const carregar = async (maisAntesDe) => {
    setACarregar(true);
    try {
      const r = await api.listarMedia(conversaId, tab, { antes_de: maisAntesDe, limite: LIMITE });
      if (tab === "links") {
        const novos = r.links ?? [];
        setLinks((atuais) => maisAntesDe ? [...atuais ?? [], ...novos] : novos);
        setTemMais(novos.length === LIMITE);
      } else {
        const novos = r.anexos ?? [];
        setAnexos((atuais) => maisAntesDe ? [...atuais ?? [], ...novos] : novos);
        setTemMais(novos.length === LIMITE);
      }
    } catch {
      if (tab === "links") setLinks([]);
      else setAnexos([]);
    } finally {
      setACarregar(false);
    }
  };
  (0, import_react11.useEffect)(() => {
    setAnexos(null);
    setLinks(null);
    void carregar();
  }, [conversaId, tab]);
  const abrirLink = (l) => {
    const url = l.metadados?.url ?? (0, import_makachat_core4.dividirLinks)(l.conteudo ?? "").find((p) => p.url)?.url;
    if (url) void import_react_native9.Linking.openURL(String(url)).catch(() => void 0);
  };
  const vazio = tab === "links" ? links !== null && links.length === 0 : anexos !== null && anexos.length === 0;
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_react_native9.View, { style: [estilos8.seccao, { backgroundColor: tema.superficie }], children: [
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.Text, { style: [estilos8.seccaoTitulo, { color: tema.textoSuave }], children: "Media da conversa" }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.View, { style: estilos8.tabsLinha, children: TABS.map((t) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      import_react_native9.Pressable,
      {
        onPress: () => setTab(t.chave),
        style: [estilos8.tab, tab === t.chave && { backgroundColor: tema.primaria }],
        children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.Text, { style: { fontSize: 13, fontWeight: "700", color: tab === t.chave ? tema.primariaContraste : tema.textoSuave }, children: t.rotulo })
      },
      t.chave
    )) }),
    aCarregar && anexos === null && links === null && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.ActivityIndicator, { style: { paddingVertical: 18 }, color: tema.primaria }),
    vazio && !aCarregar && /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_react_native9.Text, { style: { paddingHorizontal: 18, paddingVertical: 14, fontSize: 13, color: tema.textoSuave }, children: [
      "Ainda n\xE3o h\xE1 ",
      TABS.find((t) => t.chave === tab)?.rotulo.toLowerCase(),
      " nesta conversa."
    ] }),
    tab === "fotos" && !!anexos?.length && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.View, { style: estilos8.grelha, children: anexos.map(
      (a) => a.url ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.Pressable, { onPress: () => void import_react_native9.Linking.openURL(a.url).catch(() => void 0), children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.Image, { source: { uri: a.url }, style: { width: ladoFoto, height: ladoFoto, borderRadius: 8 } }) }, a.id) : null
    ) }),
    tab === "ficheiros" && anexos?.map((a) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.View, { style: { paddingHorizontal: 16, paddingVertical: 4 }, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(FicheiroAnexo, { anexo: a, minha: false, corTexto: tema.texto }) }, a.id)),
    tab === "audios" && anexos?.map(
      (a) => a.url ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.View, { style: { paddingHorizontal: 16, paddingVertical: 6 }, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(ReprodutorAudio, { url: a.url, mimha: false, duracaoSegundos: a.duracao_segundos }) }, a.id) : null
    ),
    tab === "links" && links?.map((l) => /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_react_native9.Pressable, { onPress: () => abrirLink(l), style: estilos8.linkLinha, children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.View, { style: [estilos8.linkIcone, { backgroundColor: `${tema.primaria}1A` }], children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_vector_icons8.Ionicons, { name: "link", size: 18, color: tema.primaria }) }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_react_native9.View, { style: { flex: 1, minWidth: 0 }, children: [
        !!l.metadados?.titulo && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.Text, { numberOfLines: 1, style: { fontSize: 14, fontWeight: "600", color: tema.texto }, children: String(l.metadados.titulo) }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.Text, { numberOfLines: 2, style: { fontSize: 12.5, color: tema.textoSuave }, children: String(l.metadados?.url ?? l.conteudo ?? "") })
      ] })
    ] }, l.id)),
    temMais && !aCarregar && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      import_react_native9.Pressable,
      {
        onPress: () => {
          const ultimo = tab === "links" ? links?.at(-1)?.id : anexos?.at(-1)?.id;
          if (ultimo) void carregar(ultimo);
        },
        style: { alignItems: "center", paddingVertical: 10 },
        children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.Text, { style: { fontSize: 13.5, fontWeight: "700", color: tema.primaria }, children: "Ver mais" })
      }
    )
  ] });
}
function AdicionarMembrosSheet({ conversa, contactos, aoFechar, aoAdicionar }) {
  const tema = useTema();
  const [escolhidos, setEscolhidos] = (0, import_react11.useState)(/* @__PURE__ */ new Set());
  const candidatos = (0, import_react11.useMemo)(() => {
    const jaNoGrupo = new Set(conversa.participantes.filter((p) => !p.saiu_em).map((p) => `${p.tipo}:${p.id_externo}`));
    return contactos.filter((c) => !jaNoGrupo.has(`${c.tipo}:${c.id_externo}`));
  }, [conversa, contactos]);
  const alvos = candidatos.filter((c) => escolhidos.has(`${c.tipo}:${c.id_externo}`));
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(Sheet, { visivel: true, aoFechar, titulo: "Adicionar membros", children: [
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.View, { style: { maxHeight: 340 }, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      ListaPerformante,
      {
        data: candidatos,
        keyExtractor: (p) => `${p.tipo}:${p.id_externo}`,
        estimatedItemSize: 54,
        renderItem: ({ item: p }) => {
          const chave = `${p.tipo}:${p.id_externo}`;
          const marcado = escolhidos.has(chave);
          return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
            import_react_native9.Pressable,
            {
              onPress: () => setEscolhidos((a) => {
                const n = new Set(a);
                if (marcado) n.delete(chave);
                else n.add(chave);
                return n;
              }),
              style: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 8 },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_vector_icons8.Ionicons, { name: marcado ? "checkmark-circle" : "ellipse-outline", size: 22, color: marcado ? tema.primaria : tema.textoSuave }),
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Avatar, { nome: p.nome ?? p.id_externo, url: p.foto ?? null, tamanho: 36 }),
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.Text, { style: { flex: 1, fontSize: 15, fontWeight: "600", color: tema.texto }, numberOfLines: 1, children: p.nome ?? p.id_externo })
              ]
            }
          );
        },
        ListEmptyComponent: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native9.Text, { style: { padding: 20, color: tema.textoSuave }, children: "Sem contactos para adicionar." })
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      import_react_native9.Pressable,
      {
        disabled: !alvos.length,
        onPress: () => void aoAdicionar(alvos),
        style: { marginHorizontal: 16, marginTop: 10, borderRadius: 24, paddingVertical: 13, alignItems: "center", backgroundColor: tema.primaria, opacity: alvos.length ? 1 : 0.4 },
        children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_react_native9.Text, { style: { color: tema.primariaContraste, fontWeight: "700", fontSize: 15 }, children: [
          "Adicionar",
          alvos.length ? ` (${alvos.length})` : ""
        ] })
      }
    )
  ] });
}
var estilos8 = import_react_native9.StyleSheet.create({
  // paddingTop dinâmico (insets.top) aplicado inline no render
  header: { flexDirection: "row", alignItems: "center", paddingBottom: 10, paddingHorizontal: 10, gap: 6 },
  topo: { alignItems: "center", paddingVertical: 22, marginBottom: 10 },
  mudarFoto: { position: "absolute", right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  inputNome: { minWidth: 200, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, fontSize: 16, fontWeight: "700" },
  seccao: { marginBottom: 10, paddingVertical: 6 },
  seccaoTitulo: { fontSize: 12.5, fontWeight: "700", paddingHorizontal: 18, paddingVertical: 6, textTransform: "uppercase" },
  membro: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 8 },
  addIcone: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  papel: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  verPerfil: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  bolinhaMembro: { position: "absolute", right: -1, bottom: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: "#10b981", borderWidth: 2 },
  tabsLinha: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  tab: { borderRadius: 16, paddingHorizontal: 13, paddingVertical: 6, backgroundColor: "rgba(100,116,139,0.12)" },
  grelha: { flexDirection: "row", flexWrap: "wrap", gap: 4, paddingHorizontal: 16, paddingBottom: 8 },
  linkLinha: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 8 },
  linkIcone: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" }
});

// src/ui/NovaConversaScreen.tsx
var import_vector_icons9 = require("@expo/vector-icons");
var import_react12 = require("react");
var import_react_native10 = require("react-native");
var import_react_native_safe_area_context5 = require("react-native-safe-area-context");
var import_jsx_runtime10 = require("react/jsx-runtime");
var DEBOUNCE_MS = 350;
function NovaConversaScreen({ onVoltar, onCriada, pesquisarContactos, textoSugestoes = "Sugest\xF5es" }) {
  const { api, engine, contactos, identidade } = useMakaChat();
  const tema = useTema();
  const insets = (0, import_react_native_safe_area_context5.useSafeAreaInsets)();
  const conversas = useConversas(false);
  const podeGrupos = useFuncionalidadeAtiva("grupos");
  const [busca, setBusca] = (0, import_react12.useState)("");
  const [resultados, setResultados] = (0, import_react12.useState)(null);
  const [aPesquisar, setAPesquisar] = (0, import_react12.useState)(false);
  const [modoGrupo, setModoGrupo] = (0, import_react12.useState)(false);
  const [escolhidos, setEscolhidos] = (0, import_react12.useState)(/* @__PURE__ */ new Map());
  const [nomeGrupo, setNomeGrupo] = (0, import_react12.useState)("");
  const [aCriar, setACriar] = (0, import_react12.useState)(false);
  const pedidoAtual = (0, import_react12.useRef)(0);
  const sugestoes = (0, import_react12.useMemo)(() => {
    const mapa = /* @__PURE__ */ new Map();
    for (const c of conversas) {
      for (const p of c.participantes) {
        if (p.tipo === "sistema") continue;
        if (p.id_externo === identidade.id && p.tipo === identidade.tipo) continue;
        mapa.set(`${p.tipo}:${p.id_externo}`, { id_externo: p.id_externo, tipo: p.tipo, nome: p.nome, foto: p.foto_url });
      }
    }
    for (const alvo of contactos) {
      if (alvo.id_externo === identidade.id && alvo.tipo === identidade.tipo) continue;
      mapa.set(`${alvo.tipo}:${alvo.id_externo}`, alvo);
    }
    return [...mapa.values()];
  }, [conversas, contactos, identidade]);
  (0, import_react12.useEffect)(() => {
    const q = busca.trim();
    if (!q) {
      setResultados(null);
      setAPesquisar(false);
      return;
    }
    if (!pesquisarContactos) {
      const ql = q.toLowerCase();
      setResultados(sugestoes.filter((p) => (p.nome ?? p.id_externo).toLowerCase().includes(ql)));
      return;
    }
    setAPesquisar(true);
    const pedido = ++pedidoAtual.current;
    const timer = setTimeout(() => {
      void pesquisarContactos(q).then((lista2) => {
        if (pedidoAtual.current !== pedido) return;
        setResultados(lista2.filter((p) => !(p.id_externo === identidade.id && p.tipo === identidade.tipo)));
      }).catch(() => {
        if (pedidoAtual.current === pedido) setResultados([]);
      }).finally(() => {
        if (pedidoAtual.current === pedido) setAPesquisar(false);
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [busca, pesquisarContactos, sugestoes, identidade]);
  const lista = busca.trim() ? resultados ?? [] : sugestoes;
  const criarPrivada = async (alvo) => {
    if (aCriar) return;
    setACriar(true);
    try {
      const { conversa } = await api.criarPrivada(alvo);
      await engine.atualizarConversas();
      onCriada(conversa);
    } catch (e) {
      import_react_native10.Alert.alert("N\xE3o foi poss\xEDvel iniciar a conversa", e?.message ?? "Tenta de novo.");
    } finally {
      setACriar(false);
    }
  };
  const criarGrupo = async () => {
    const membros = [...escolhidos.values()];
    if (aCriar || membros.length < 2) return;
    setACriar(true);
    try {
      const nomePadrao = membros.map((p) => (p.nome ?? p.id_externo).split(" ")[0]).join(", ");
      const { conversa } = await api.criarGrupo(nomeGrupo.trim() || nomePadrao, membros);
      await engine.atualizarConversas();
      onCriada(conversa);
    } catch (e) {
      import_react_native10.Alert.alert("N\xE3o foi poss\xEDvel criar o grupo", e?.message ?? "Tenta de novo.");
    } finally {
      setACriar(false);
    }
  };
  const alternarEscolhido = (p) => {
    const chave = `${p.tipo}:${p.id_externo}`;
    setEscolhidos((atual) => {
      const novo = new Map(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.set(chave, p);
      return novo;
    });
  };
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_react_native10.View, { style: { flex: 1, backgroundColor: tema.fundo }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_react_native10.View, { style: [estilos9.header, { paddingTop: insets.top + 8, backgroundColor: tema.superficie }], children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_react_native10.Pressable, { onPress: onVoltar, style: { padding: 6 }, hitSlop: 8, children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_vector_icons9.Ionicons, { name: "arrow-back", size: 24, color: tema.texto }) }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_react_native10.View, { style: [estilos9.pesquisa, { backgroundColor: tema.fundo }], children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_vector_icons9.Ionicons, { name: "search", size: 17, color: tema.textoSuave }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
          import_react_native10.TextInput,
          {
            value: busca,
            onChangeText: setBusca,
            placeholder: "Pesquisar pessoas",
            placeholderTextColor: tema.textoSuave,
            style: { flex: 1, fontSize: 15, color: tema.texto, paddingVertical: 9 },
            returnKeyType: "search"
          }
        ),
        aPesquisar ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_react_native10.ActivityIndicator, { size: "small", color: tema.textoSuave }) : busca.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_react_native10.Pressable, { onPress: () => setBusca(""), hitSlop: 6, children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_vector_icons9.Ionicons, { name: "close-circle", size: 18, color: tema.textoSuave }) }) : null
      ] })
    ] }),
    podeGrupos && !modoGrupo && /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_react_native10.Pressable, { onPress: () => setModoGrupo(true), style: [estilos9.linhaGrupo, { backgroundColor: tema.superficie }], children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_react_native10.View, { style: [estilos9.iconeGrupo, { backgroundColor: tema.primaria }], children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_vector_icons9.Ionicons, { name: "people", size: 20, color: tema.primariaContraste }) }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_react_native10.Text, { style: { fontSize: 15.5, fontWeight: "600", color: tema.texto }, children: "Novo grupo" })
    ] }),
    modoGrupo && /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_react_native10.View, { style: [estilos9.barraGrupo, { backgroundColor: tema.superficie }], children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
        import_react_native10.TextInput,
        {
          value: nomeGrupo,
          onChangeText: setNomeGrupo,
          placeholder: "Nome do grupo (opcional)",
          placeholderTextColor: tema.textoSuave,
          style: [estilos9.inputNome, { backgroundColor: tema.fundo, color: tema.texto }]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
        import_react_native10.Pressable,
        {
          onPress: () => {
            setModoGrupo(false);
            setEscolhidos(/* @__PURE__ */ new Map());
            setNomeGrupo("");
          },
          hitSlop: 8,
          style: { padding: 6 },
          children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_vector_icons9.Ionicons, { name: "close", size: 22, color: tema.textoSuave })
        }
      )
    ] }),
    !busca.trim() && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_react_native10.Text, { style: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, fontSize: 12.5, fontWeight: "700", color: tema.textoSuave, textTransform: "uppercase" }, children: textoSugestoes }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
      ListaPerformante,
      {
        data: lista,
        keyExtractor: (p) => `${p.tipo}:${p.id_externo}`,
        estimatedItemSize: 62,
        renderItem: ({ item: p }) => {
          const marcado = escolhidos.has(`${p.tipo}:${p.id_externo}`);
          return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
            import_react_native10.Pressable,
            {
              disabled: aCriar,
              onPress: () => modoGrupo ? alternarEscolhido(p) : void criarPrivada(p),
              style: ({ pressed }) => [estilos9.pessoa, pressed && { backgroundColor: "rgba(0,0,0,0.05)" }],
              children: [
                modoGrupo && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                  import_vector_icons9.Ionicons,
                  {
                    name: marcado ? "checkmark-circle" : "ellipse-outline",
                    size: 22,
                    color: marcado ? tema.primaria : tema.textoSuave
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Avatar, { nome: p.nome ?? p.id_externo, url: p.foto ?? null, tamanho: 44 }),
                /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_react_native10.Text, { style: { flex: 1, fontSize: 15.5, fontWeight: "600", color: tema.texto }, numberOfLines: 1, children: p.nome ?? p.id_externo })
              ]
            }
          );
        },
        ListEmptyComponent: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_react_native10.Text, { style: { padding: 24, textAlign: "center", color: tema.textoSuave }, children: busca.trim() ? aPesquisar ? "A pesquisar\u2026" : "Sem resultados." : "Sem sugest\xF5es ainda \u2014 usa a pesquisa." }),
        contentContainerStyle: { paddingBottom: modoGrupo ? 96 : 24 }
      }
    ),
    modoGrupo && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_react_native10.View, { style: [estilos9.rodapeGrupo, { paddingBottom: Math.max(insets.bottom, 12) }], children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
      import_react_native10.Pressable,
      {
        disabled: escolhidos.size < 2 || aCriar,
        onPress: () => void criarGrupo(),
        style: [estilos9.botaoCriar, { backgroundColor: tema.primaria, opacity: escolhidos.size >= 2 && !aCriar ? 1 : 0.4 }],
        children: aCriar ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_react_native10.ActivityIndicator, { color: tema.primariaContraste }) : /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_react_native10.Text, { style: { color: tema.primariaContraste, fontWeight: "700", fontSize: 15 }, children: [
          "Criar grupo (",
          escolhidos.size,
          ")"
        ] })
      }
    ) })
  ] });
}
var estilos9 = import_react_native10.StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingBottom: 10
  },
  pesquisa: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 21,
    paddingHorizontal: 12,
    marginRight: 6
  },
  linhaGrupo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  iconeGrupo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center"
  },
  barraGrupo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  inputNome: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14.5
  },
  pessoa: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 9
  },
  rodapeGrupo: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10
  },
  botaoCriar: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingVertical: 13
  }
});

// src/rotas/index.tsx
var import_jsx_runtime11 = require("react/jsx-runtime");
function barraDoFundo(fundo) {
  const hex = fundo.replace("#", "");
  if (hex.length < 6) return "escura";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminancia < 0.5 ? "clara" : "escura";
}
var voltar = () => import_expo_router.router.canGoBack() ? import_expo_router.router.back() : import_expo_router.router.replace("/");
function LayoutChatMakaChat({ screenOptions }) {
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_expo_router.Stack, { screenOptions: { headerShown: false, animation: "slide_from_right", ...screenOptions } });
}
function RotaConversa() {
  const { id } = (0, import_expo_router.useLocalSearchParams)();
  const ctx = useMakaChatOpcional();
  const chamadas = useChamadasOpcional();
  const emFoco = (0, import_native.useIsFocused)();
  (0, import_react13.useEffect)(() => {
    if (!id || !emFoco) return;
    void obterNotifee()?.cancelNotification?.(`mkm_${id}`)?.catch?.(() => void 0);
    try {
      obterPushMakaChat()?.cancelarNotificacaoMensagens?.(id);
    } catch {
    }
  }, [id, emFoco]);
  if (!id || !ctx) return null;
  const headerCustom = ctx.renderHeaderConversa;
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
    ChatScreen,
    {
      conversaId: id,
      chamadas: chamadas ?? void 0,
      emFoco,
      barraEstado: headerCustom ? null : barraDoFundo(ctx.tema.fundo),
      renderHeader: headerCustom,
      onVoltar: voltar,
      onAbrirInfo: (c) => import_expo_router.router.push(`/chat-info/${c.id}`),
      onAbrirOutraConversa: (conversaId) => import_expo_router.router.replace(`/chat/${conversaId}`)
    }
  );
}
function RotaInfoConversa() {
  const { id } = (0, import_expo_router.useLocalSearchParams)();
  const ctx = useMakaChatOpcional();
  if (!id || !ctx) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
    InfoConversaScreen,
    {
      conversaId: id,
      onVoltar: voltar,
      onSaiu: () => import_expo_router.router.replace("/"),
      onAbrirOutraConversa: (conversaId) => import_expo_router.router.replace(`/chat/${conversaId}`)
    }
  );
}
function RotaNovaConversa() {
  const ctx = useMakaChatOpcional();
  if (!ctx) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
    NovaConversaScreen,
    {
      onVoltar: voltar,
      onCriada: (c) => import_expo_router.router.replace(`/chat/${c.id}`),
      pesquisarContactos: ctx.pesquisarContactos,
      textoSugestoes: ctx.textoSugestoes
    }
  );
}
function RotaArquivadas() {
  const ctx = useMakaChatOpcional();
  const tema = useTema();
  const insets = (0, import_react_native_safe_area_context6.useSafeAreaInsets)();
  if (!ctx) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(import_react_native11.View, { style: { flex: 1, backgroundColor: tema.fundo }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(import_react_native11.View, { style: [estilos10.header, { paddingTop: insets.top + 8 }], children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_react_native11.Pressable, { onPress: voltar, hitSlop: 8, style: { padding: 6 }, children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_vector_icons10.Ionicons, { name: "arrow-back", size: 24, color: tema.texto }) }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_react_native11.Text, { style: { fontSize: 18, fontWeight: "700", color: tema.texto }, children: "Arquivadas" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      ConversasScreen,
      {
        arquivadas: true,
        onAbrirConversa: (c) => import_expo_router.router.push(`/chat/${c.id}`),
        textoVazio: "Sem conversas arquivadas."
      }
    )
  ] });
}
function RotaPesquisarConversas() {
  const ctx = useMakaChatOpcional();
  const tema = useTema();
  const insets = (0, import_react_native_safe_area_context6.useSafeAreaInsets)();
  const [q, setQ] = (0, import_react13.useState)("");
  const setBuscaRef = (0, import_react13.useRef)(null);
  const mudar = (texto) => {
    setQ(texto);
    setBuscaRef.current?.(texto);
  };
  if (!ctx) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(import_react_native11.View, { style: { flex: 1, backgroundColor: tema.fundo }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(import_react_native11.View, { style: [estilos10.header, { paddingTop: insets.top + 8 }], children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_react_native11.Pressable, { onPress: voltar, hitSlop: 8, style: { padding: 6 }, children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_vector_icons10.Ionicons, { name: "arrow-back", size: 24, color: tema.texto }) }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(import_react_native11.View, { style: [estilos10.pesquisa, { backgroundColor: tema.superficie }], children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_vector_icons10.Ionicons, { name: "search", size: 17, color: tema.textoSuave }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
          import_react_native11.TextInput,
          {
            autoFocus: true,
            value: q,
            onChangeText: mudar,
            placeholder: "Pesquisar conversas",
            placeholderTextColor: tema.textoSuave,
            style: { flex: 1, fontSize: 15, color: tema.texto, paddingVertical: 9 },
            returnKeyType: "search"
          }
        ),
        q.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_react_native11.Pressable, { onPress: () => mudar(""), hitSlop: 6, children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_vector_icons10.Ionicons, { name: "close-circle", size: 18, color: tema.textoSuave }) })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      ConversasScreen,
      {
        onAbrirConversa: (c) => import_expo_router.router.push(`/chat/${c.id}`),
        textoVazio: "Sem resultados.",
        renderTopo: (topo) => {
          setBuscaRef.current = topo.setBusca;
          return null;
        }
      }
    )
  ] });
}
var estilos10 = import_react_native11.StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingBottom: 10, paddingHorizontal: 8, gap: 6 },
  pesquisa: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 21, paddingHorizontal: 12, marginRight: 6 }
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  LayoutChatMakaChat,
  RotaArquivadas,
  RotaConversa,
  RotaInfoConversa,
  RotaNovaConversa,
  RotaPesquisarConversas
});
//# sourceMappingURL=index.cjs.map