var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/sqlite-storage.ts
var SqliteStorage = class {
  constructor(db) {
    this.db = db;
  }
  db;
  async init() {
    await this.criarEsquema();
    if (!await this.esquemaValido()) {
      await this.db.execAsync(
        `DROP TABLE IF EXISTS conversas; DROP TABLE IF EXISTS mensagens; DROP TABLE IF EXISTS outbox; DROP TABLE IF EXISTS meta;`
      );
      await this.criarEsquema();
    }
  }
  async esquemaValido() {
    try {
      await this.db.getAllAsync(`SELECT arquivada, ultima_atividade_em FROM conversas LIMIT 0`);
      await this.db.getAllAsync(`SELECT conversa_id, remetente_identidade_id, ref_cliente FROM mensagens LIMIT 0`);
      await this.db.getAllAsync(`SELECT criado_em FROM outbox LIMIT 0`);
      await this.db.getAllAsync(`SELECT chave, valor FROM meta LIMIT 0`);
      const dup = await this.db.getAllAsync(
        `SELECT COUNT(*) - COUNT(DISTINCT id) AS n FROM conversas`
      );
      return (dup[0]?.n ?? 0) === 0;
    } catch {
      return false;
    }
  }
  async criarEsquema() {
    await this.db.execAsync(`
            CREATE TABLE IF NOT EXISTS conversas (
                id TEXT PRIMARY KEY,
                dados TEXT NOT NULL,
                arquivada INTEGER NOT NULL DEFAULT 0,
                ultima_atividade_em TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_conversas_atividade ON conversas (arquivada, ultima_atividade_em DESC);

            CREATE TABLE IF NOT EXISTS mensagens (
                id TEXT PRIMARY KEY,
                conversa_id TEXT NOT NULL,
                remetente_identidade_id TEXT NOT NULL,
                ref_cliente TEXT NOT NULL,
                dados TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_mensagens_conversa ON mensagens (conversa_id, id);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_mensagens_ref ON mensagens (conversa_id, remetente_identidade_id, ref_cliente);

            CREATE TABLE IF NOT EXISTS outbox (
                ref_cliente TEXT PRIMARY KEY,
                criado_em TEXT NOT NULL,
                dados TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS meta (
                chave TEXT PRIMARY KEY,
                valor TEXT NOT NULL
            );
        `);
  }
  async upsertConversas(conversas) {
    for (const conversa of conversas) {
      const existente = await this.obterConversa(conversa.id);
      const fundida = existente ? { ...existente, ...conversa } : conversa;
      await this.db.runAsync(
        `INSERT OR REPLACE INTO conversas (id, dados, arquivada, ultima_atividade_em) VALUES (?, ?, ?, ?)`,
        [
          fundida.id,
          JSON.stringify(fundida),
          fundida.participante?.arquivada ? 1 : 0,
          fundida.ultima_atividade_em
        ]
      );
    }
  }
  async listarConversas(arquivadas = false) {
    const linhas = await this.db.getAllAsync(
      `SELECT * FROM conversas WHERE arquivada = ? ORDER BY ultima_atividade_em DESC`,
      [arquivadas ? 1 : 0]
    );
    return linhas.map((l) => JSON.parse(l.dados));
  }
  async obterConversa(conversaId) {
    const linhas = await this.db.getAllAsync(`SELECT * FROM conversas WHERE id = ? LIMIT 1`, [
      conversaId
    ]);
    return linhas.length ? JSON.parse(linhas[0].dados) : null;
  }
  async removerConversa(conversaId) {
    await this.db.runAsync(`DELETE FROM conversas WHERE id = ?`, [conversaId]);
    await this.db.runAsync(`DELETE FROM mensagens WHERE conversa_id = ?`, [conversaId]);
  }
  async upsertMensagens(mensagens) {
    for (const mensagem of mensagens) {
      await this.db.runAsync(
        `DELETE FROM mensagens WHERE conversa_id = ? AND remetente_identidade_id = ? AND ref_cliente = ? AND id != ?`,
        [mensagem.conversa_id, mensagem.remetente_identidade_id, mensagem.ref_cliente, mensagem.id]
      );
      await this.db.runAsync(
        `INSERT OR REPLACE INTO mensagens (id, conversa_id, remetente_identidade_id, ref_cliente, dados) VALUES (?, ?, ?, ?, ?)`,
        [
          mensagem.id,
          mensagem.conversa_id,
          mensagem.remetente_identidade_id,
          mensagem.ref_cliente,
          JSON.stringify(mensagem)
        ]
      );
    }
  }
  async removerMensagem(conversaId, mensagemId) {
    await this.db.runAsync(`DELETE FROM mensagens WHERE conversa_id = ? AND id = ?`, [conversaId, mensagemId]);
  }
  async removerMensagemPorRef(conversaId, refCliente) {
    await this.db.runAsync(`DELETE FROM mensagens WHERE conversa_id = ? AND ref_cliente = ?`, [
      conversaId,
      refCliente
    ]);
  }
  async listarMensagens(conversaId, opcoes) {
    const limite = opcoes?.limite ?? 50;
    const linhas = opcoes?.antes_de ? await this.db.getAllAsync(
      `SELECT id, dados FROM mensagens WHERE conversa_id = ? AND id < ? ORDER BY id DESC LIMIT ?`,
      [conversaId, opcoes.antes_de, limite]
    ) : await this.db.getAllAsync(
      `SELECT id, dados FROM mensagens WHERE conversa_id = ? ORDER BY id DESC LIMIT ?`,
      [conversaId, limite]
    );
    return linhas.reverse().map((l) => JSON.parse(l.dados));
  }
  async cursores() {
    const linhas = await this.db.getAllAsync(
      `SELECT conversa_id, MAX(CASE WHEN json_extract(dados, '$.estado_envio') IS NULL OR json_extract(dados, '$.estado_envio') = 'enviada' THEN id END) AS ultimo_id
             FROM mensagens GROUP BY conversa_id`
    );
    return linhas;
  }
  async adicionarOutbox(item) {
    await this.db.runAsync(`INSERT OR REPLACE INTO outbox (ref_cliente, criado_em, dados) VALUES (?, ?, ?)`, [
      item.ref_cliente,
      item.criado_em,
      JSON.stringify(item)
    ]);
  }
  async listarOutbox() {
    const linhas = await this.db.getAllAsync(`SELECT * FROM outbox ORDER BY criado_em ASC`);
    return linhas.map((l) => JSON.parse(l.dados));
  }
  async atualizarOutbox(item) {
    await this.adicionarOutbox(item);
  }
  async removerOutbox(refCliente) {
    await this.db.runAsync(`DELETE FROM outbox WHERE ref_cliente = ?`, [refCliente]);
  }
  async aplicarRecibo(recibo) {
    const conversa = await this.obterConversa(recibo.conversa_id);
    if (!conversa) {
      return;
    }
    conversa.participantes = conversa.participantes.map(
      (p) => p.identidade_id === recibo.identidade_id ? {
        ...p,
        ultima_entrega_mensagem_id: maiorId(p.ultima_entrega_mensagem_id, recibo.entregue_ate),
        ultima_leitura_mensagem_id: maiorId(p.ultima_leitura_mensagem_id, recibo.lido_ate)
      } : p
    );
    await this.upsertConversas([conversa]);
  }
  async obterMeta(chave) {
    const linhas = await this.db.getAllAsync(`SELECT valor FROM meta WHERE chave = ? LIMIT 1`, [chave]);
    return linhas[0]?.valor ?? null;
  }
  async gravarMeta(chave, valor) {
    await this.db.runAsync(`INSERT OR REPLACE INTO meta (chave, valor) VALUES (?, ?)`, [chave, valor]);
  }
  async limpar() {
    await this.db.execAsync(`DELETE FROM conversas; DELETE FROM mensagens; DELETE FROM outbox; DELETE FROM meta;`);
  }
};
function maiorId(atual, novo) {
  if (!novo) return atual;
  if (!atual) return novo;
  return novo > atual ? novo : atual;
}

// src/opcionais.ts
var obterImagePicker = () => {
  try {
    return __require("expo-image-picker");
  } catch {
    return null;
  }
};
var obterDocumentPicker = () => {
  try {
    return __require("expo-document-picker");
  } catch {
    return null;
  }
};
var obterAudio = () => {
  try {
    return __require("expo-audio");
  } catch {
    return null;
  }
};
var obterVideo = () => {
  try {
    return __require("expo-video");
  } catch {
    return null;
  }
};
var obterFileSystem = () => {
  try {
    return __require("expo-file-system/legacy");
  } catch {
  }
  try {
    return __require("expo-file-system");
  } catch {
    return null;
  }
};
var obterSharing = () => {
  try {
    return __require("expo-sharing");
  } catch {
    return null;
  }
};
var obterShareIntent = () => {
  try {
    return __require("expo-share-intent");
  } catch {
    return null;
  }
};
var obterIntentLauncher = () => {
  try {
    return __require("expo-intent-launcher");
  } catch {
    return null;
  }
};
var obterLiveKit = () => {
  try {
    return __require("@livekit/react-native");
  } catch {
    return null;
  }
};
var obterLiveKitClient = () => {
  try {
    return __require("livekit-client");
  } catch {
    return null;
  }
};
var obterNotifee = () => {
  try {
    const m = __require("@notifee/react-native");
    return m?.default ?? m;
  } catch {
    return null;
  }
};
var obterPushMakaChat = () => {
  try {
    return __require("@hongayetu/expo-makachat-push");
  } catch {
    return null;
  }
};
var obterKeyboardController = () => {
  try {
    return __require("react-native-keyboard-controller");
  } catch {
    return null;
  }
};

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
  raio: 16
};
function resolverTema(tema) {
  return { ...PADRAO, ...tema };
}

// src/sons.ts
var FONTES = {
  recebida: __require("./mensagem_recebida-MZY2YITP.mp3"),
  enviada: __require("./mensagem_enviada-DDE7GUQI.mp3"),
  vista: __require("./mensagem_vista-UJR4F6F5.mp3"),
  a_chamar: __require("./a_chamar-DLXA46AB.mp3"),
  toque_receber: __require("./toque_receber-LUIEOINS.mp3")
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
var toque = null;
var toqueDispositivo = false;
function comecarToque(tipo = "ligar") {
  if (toque || toqueDispositivo) return;
  if (tipo === "receber") {
    const push = obterPushMakaChat();
    if (push?.tocarToqueDispositivo?.()) {
      toqueDispositivo = true;
      return;
    }
  }
  const audio = obterAudio();
  if (!audio?.createAudioPlayer) return;
  try {
    toque = audio.createAudioPlayer(tipo === "receber" ? FONTES.toque_receber : FONTES.a_chamar);
    toque.loop = true;
    toque.play();
  } catch {
    toque = null;
  }
}
function pararToque() {
  if (toqueDispositivo) {
    obterPushMakaChat()?.pararToqueDispositivo?.();
    toqueDispositivo = false;
  }
  try {
    toque?.pause();
    toque?.remove?.();
  } catch {
  }
  toque = null;
}

// src/provider.tsx
import {
  MakaApi,
  MakaSocket,
  SyncEngine
} from "@hongayetu/makachat-core";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { jsx } from "react/jsx-runtime";
var alcanceGlobal = globalThis;
var Contexto = alcanceGlobal.__makaChatCtx ??= createContext(null);
function abrirStoragePadrao(serviceKey, identity) {
  const sqlite = __require("expo-sqlite");
  const nome = `makachat_${serviceKey}_${identity.tipo}_${identity.id}.db`.replace(/[^a-zA-Z0-9_.]/g, "_");
  return new SqliteStorage(sqlite.openDatabaseSync(nome));
}
function MakaChatProvider({
  serviceKey,
  identity,
  getToken,
  storage,
  tema,
  contactos,
  aoAbrirPartilha,
  aoVerPerfil,
  pesquisarContactos,
  textoSugestoes,
  renderHeaderConversa,
  children
}) {
  const [features, setFeatures] = useState([]);
  const [ligado, setLigado] = useState(false);
  const visiveis = useRef(/* @__PURE__ */ new Map());
  const ouvintesTyping = useRef(/* @__PURE__ */ new Set());
  const ouvintesPresenca = useRef(/* @__PURE__ */ new Set());
  const ouvintesChamadas = useRef(/* @__PURE__ */ new Set());
  const ouvintesMensagens = useRef(/* @__PURE__ */ new Set());
  const valor = useMemo(() => {
    const api = new MakaApi(getToken);
    const adapter = storage ?? abrirStoragePadrao(serviceKey, identity);
    let engine;
    const socket = new MakaSocket({
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
    engine = new SyncEngine(adapter, api, socket, {
      identidade: identity,
      aoTyping: (typing) => ouvintesTyping.current.forEach((o) => o(typing)),
      aoPresenca: (presenca) => ouvintesPresenca.current.forEach((o) => o(presenca)),
      aoChamada: (evento) => ouvintesChamadas.current.forEach((o) => o(evento)),
      aoMensagem: (mensagem) => {
        ouvintesMensagens.current.forEach((o) => o(mensagem));
        if (!mensagem.silenciosa) tocarSom("recebida");
      }
    });
    return {
      engine,
      api,
      socket,
      serviceKey,
      identidade: identity,
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
      registarVisivel: (conversaId) => {
        visiveis.current.set(conversaId, (visiveis.current.get(conversaId) ?? 0) + 1);
        return () => {
          const atual = (visiveis.current.get(conversaId) ?? 1) - 1;
          if (atual <= 0) visiveis.current.delete(conversaId);
          else visiveis.current.set(conversaId, atual);
        };
      },
      estaVisivel: (conversaId) => (visiveis.current.get(conversaId) ?? 0) > 0
    };
  }, [serviceKey, identity.id, identity.tipo]);
  useEffect(() => {
    void valor.engine.iniciar();
    void valor.api.listarFeatures().then((r) => setFeatures(r.features)).catch(() => void 0);
    return () => valor.socket.desligar();
  }, [valor]);
  useEffect(() => {
    const push = obterPushMakaChat();
    if (!push?.drenarInbox) return;
    const ingerir = (itens) => {
      const mensagens = itens.map((item) => {
        try {
          return JSON.parse(item.mensagem_json);
        } catch {
          return null;
        }
      }).filter((m) => !!m && typeof m.id === "string" && typeof m.conversa_id === "string");
      if (mensagens.length) void valor.engine.ingerirMensagensPush(mensagens);
    };
    void push.drenarInbox().then(ingerir).catch(() => void 0);
    const sub = push.aoReceberPush ? push.aoReceberPush((item) => ingerir([item])) : null;
    return () => sub?.remove?.();
  }, [valor]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (estado) => {
      if (estado !== "active") return;
      if (valor.socket.ligado) {
        void valor.engine.aoLigar().catch(() => void 0);
      } else {
        valor.socket.garantirLigado();
      }
    });
    return () => sub.remove();
  }, [valor]);
  const temaResolvido = useMemo(() => resolverTema(tema), [tema]);
  return /* @__PURE__ */ jsx(
    Contexto.Provider,
    {
      value: { ...valor, features, ligado, contactos: contactos ?? [], tema: temaResolvido, aoAbrirPartilha, aoVerPerfil, pesquisarContactos, textoSugestoes, renderHeaderConversa },
      children: /* @__PURE__ */ jsx(BottomSheetModalProvider, { children })
    }
  );
}
function useMakaChat() {
  const contexto = useContext(Contexto);
  if (!contexto) {
    throw new Error("useMakaChat tem de ser usado dentro de <MakaChatProvider>");
  }
  return contexto;
}
function useMakaChatOpcional() {
  return useContext(Contexto);
}
function useTema() {
  return useMakaChat().tema;
}

// src/hooks.ts
import { useCallback, useEffect as useEffect2, useState as useState2 } from "react";
import { useRef as useRef2 } from "react";
function useVersaoChat() {
  const { engine } = useMakaChat();
  const [versao, setVersao] = useState2(engine.versaoAtual);
  useEffect2(() => engine.subscrever(setVersao), [engine]);
  return versao;
}
function useConversas(arquivadas = false) {
  const { engine } = useMakaChat();
  const versao = useVersaoChat();
  const [conversas, setConversas] = useState2([]);
  useEffect2(() => {
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
  const [mensagens, setMensagens] = useState2([]);
  useEffect2(() => {
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
  return useCallback(
    (dados, anexosPreview) => engine.enviarMensagem(dados, anexosPreview),
    [engine]
  );
}
function useTypingConversa(conversaId) {
  const { subscreverTyping } = useMakaChat();
  const [typing, setTyping] = useState2(null);
  useEffect2(() => {
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
  const { engine, subscreverPresenca } = useMakaChat();
  const [presenca, setPresenca] = useState2(identidadeId ? engine.presencaDe(identidadeId) : null);
  useEffect2(() => {
    if (!identidadeId) {
      return;
    }
    setPresenca(engine.presencaDe(identidadeId));
    return subscreverPresenca((evento) => {
      if (evento.identidade_id === identidadeId) {
        setPresenca(evento);
      }
    });
  }, [engine, subscreverPresenca, identidadeId]);
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
function useLigacao() {
  return useMakaChat().ligado;
}
function useSemLigacao(atrasoMs = 4e3) {
  const ligado = useLigacao();
  const [mostrar, setMostrar] = useState2(false);
  useEffect2(() => {
    if (ligado) {
      setMostrar(false);
      return;
    }
    const t = setTimeout(() => setMostrar(true), atrasoMs);
    return () => clearTimeout(t);
  }, [ligado, atrasoMs]);
  return mostrar;
}
function useMensagemRecebida(handler) {
  const { subscreverMensagens } = useMakaChat();
  const ref = useRef2(handler);
  ref.current = handler;
  useEffect2(() => subscreverMensagens((m) => ref.current(m)), [subscreverMensagens]);
}
function useTotalNaoLidas() {
  const { engine } = useMakaChat();
  const versao = useVersaoChat();
  const [total, setTotal] = useState2(0);
  useEffect2(() => {
    void engine.storage.listarConversas(false).then((conversas) => setTotal(conversas.reduce((soma, c) => soma + (c.participante?.mensagens_nao_lidas ?? 0), 0)));
  }, [engine, versao]);
  return total;
}
function useTotalNaoLidasOpcional() {
  const contexto = useMakaChatOpcional();
  const engine = contexto?.engine ?? null;
  const [total, setTotal] = useState2(0);
  useEffect2(() => {
    if (!engine) {
      setTotal(0);
      return;
    }
    const atualizar = () => void engine.storage.listarConversas(false).then((conversas) => setTotal(conversas.reduce((soma, c) => soma + (c.participante?.mensagens_nao_lidas ?? 0), 0)));
    atualizar();
    return engine.subscrever(atualizar);
  }, [engine]);
  return total;
}

// src/ui/comum.tsx
import { Ionicons } from "@expo/vector-icons";
import { useCallback as useCallback2, useEffect as useEffect3, useRef as useRef3 } from "react";
import {
  Animated,
  BackHandler,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
function ListaPerformante(props) {
  const { estimatedItemSize: _ignorado, ...resto } = props;
  return /* @__PURE__ */ jsx2(FlatList, { ...resto });
}
function Avatar({ nome, url, tamanho = 48 }) {
  const tema = useTema();
  if (url) {
    return /* @__PURE__ */ jsx2(Image, { source: { uri: url }, style: { width: tamanho, height: tamanho, borderRadius: tamanho / 2 } });
  }
  return /* @__PURE__ */ jsx2(
    View,
    {
      style: {
        width: tamanho,
        height: tamanho,
        borderRadius: tamanho / 2,
        backgroundColor: tema.primaria,
        alignItems: "center",
        justifyContent: "center"
      },
      children: /* @__PURE__ */ jsx2(Text, { style: { color: tema.primariaContraste, fontWeight: "700", fontSize: tamanho * 0.42 }, children: (nome || "?").trim().charAt(0).toUpperCase() })
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
  return /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 }, children: [
    /* @__PURE__ */ jsx2(Text, { numberOfLines: numeroLinhas, style: [{ flexShrink: 1 }, estilo], children: nome }),
    metadados?.verificado === true && /* @__PURE__ */ jsx2(Ionicons, { name: "checkmark-circle", size: 15, color: tema.primaria })
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
  const insets = useSafeAreaInsets();
  const ref = useRef3(null);
  useEffect3(() => {
    if (visivel) ref.current?.present();
    else ref.current?.dismiss();
  }, [visivel]);
  useEffect3(() => {
    if (!visivel) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      ref.current?.dismiss();
      return true;
    });
    return () => sub.remove();
  }, [visivel]);
  const backdrop = useCallback2(
    (props) => /* @__PURE__ */ jsx2(BottomSheetBackdrop, { ...props, appearsOnIndex: 0, disappearsOnIndex: -1, pressBehavior: "close" }),
    []
  );
  return /* @__PURE__ */ jsx2(
    BottomSheetModal,
    {
      ref,
      enableDynamicSizing: true,
      onDismiss: aoFechar,
      backdropComponent: backdrop,
      handleIndicatorStyle: { backgroundColor: "rgba(100,116,139,0.35)" },
      backgroundStyle: { backgroundColor: tema.superficie, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
      children: /* @__PURE__ */ jsxs(BottomSheetView, { style: { paddingTop: 4, paddingBottom: insets.bottom + 12 }, children: [
        titulo ? /* @__PURE__ */ jsx2(Text, { style: [estilos.sheetTitulo, { color: tema.textoSuave }], numberOfLines: 1, children: titulo }) : null,
        itens?.map((item) => /* @__PURE__ */ jsxs(
          Pressable,
          {
            onPress: () => {
              ref.current?.dismiss();
              item.acao();
            },
            style: ({ pressed }) => [estilos.sheetItem, pressed && { backgroundColor: "rgba(0,0,0,0.05)" }],
            children: [
              /* @__PURE__ */ jsx2(Ionicons, { name: item.icone, size: 21, color: item.destrutivo ? "#ef4444" : tema.textoSuave }),
              /* @__PURE__ */ jsx2(Text, { style: { fontSize: 15, color: item.destrutivo ? "#ef4444" : tema.texto }, children: item.rotulo })
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
  return /* @__PURE__ */ jsx2(View, { style: [estilos.badge, { backgroundColor: tema.primaria }], children: /* @__PURE__ */ jsx2(Text, { style: { color: tema.primariaContraste, fontSize: 11, fontWeight: "700" }, children: contagem > 99 ? "99+" : contagem }) });
}
function Pulso({ children }) {
  const escala = useRef3(new Animated.Value(1)).current;
  useEffect3(() => {
    const ciclo = Animated.loop(
      Animated.sequence([
        Animated.timing(escala, { toValue: 1.18, duration: 620, useNativeDriver: true }),
        Animated.timing(escala, { toValue: 1, duration: 620, useNativeDriver: true })
      ])
    );
    ciclo.start();
    return () => ciclo.stop();
  }, [escala]);
  return /* @__PURE__ */ jsx2(Animated.View, { style: { transform: [{ scale: escala }] }, children });
}
var estilos = StyleSheet.create({
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

// src/ui/ConversasScreen.tsx
import { Ionicons as Ionicons2 } from "@expo/vector-icons";
import { rotuloTipoIdentidade } from "@hongayetu/makachat-core";
import { useEffect as useEffect4, useMemo as useMemo2, useRef as useRef4, useState as useState3 } from "react";
import {
  Alert,
  Pressable as Pressable2,
  StyleSheet as StyleSheet2,
  Text as Text2,
  TextInput,
  View as View2
} from "react-native";
import { Fragment, jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
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
  const [busca, setBusca] = useState3("");
  const [resultadosServidor, setResultadosServidor] = useState3(null);
  const [menuDe, setMenuDe] = useState3(null);
  const [silenciarDe, setSilenciarDe] = useState3(null);
  const [novaAberta, setNovaAberta] = useState3(false);
  const aPaginar = useRef4(false);
  const fimDaLista = useRef4(false);
  useEffect4(() => {
    if (!conversaInicial) return;
    void engine.entrarConversa(conversaInicial).then(async () => {
      const c = await engine.storage.obterConversa(conversaInicial);
      if (c) onAbrirConversa(c);
    });
  }, [conversaInicial]);
  useEffect4(() => {
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
  const visiveis = useMemo2(() => {
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
        acao: () => Alert.alert("Eliminar conversa?", "O hist\xF3rico desaparece para ti. A outra pessoa mant\xE9m a conversa dela.", [
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
    return /* @__PURE__ */ jsxs2(
      Pressable2,
      {
        onPress: () => onAbrirConversa(c),
        onLongPress: () => setMenuDe(c),
        style: ({ pressed }) => [estilos2.item, pressed && { backgroundColor: "rgba(0,0,0,0.04)" }],
        children: [
          /* @__PURE__ */ jsxs2(View2, { children: [
            /* @__PURE__ */ jsx3(Avatar, { nome: c.titulo ?? "?", url: c.foto_url, tamanho: 52 }),
            c.tipo === "privada" && contraparte && engine.presencaDe(contraparte.identidade_id)?.online && /* @__PURE__ */ jsx3(View2, { style: [estilos2.bolinhaOnline, { borderColor: tema.superficie }] })
          ] }),
          /* @__PURE__ */ jsxs2(View2, { style: { flex: 1, minWidth: 0 }, children: [
            /* @__PURE__ */ jsxs2(View2, { style: estilos2.linhaTopo, children: [
              /* @__PURE__ */ jsx3(
                NomeComBadge,
                {
                  nome: c.titulo ?? "Conversa",
                  metadados: contraparte?.metadados,
                  estilo: [estilos2.titulo, { color: tema.texto }, naoLidas > 0 && { fontWeight: "800" }]
                }
              ),
              /* @__PURE__ */ jsx3(Text2, { style: { fontSize: 12, color: naoLidas > 0 ? tema.primaria : tema.textoSuave }, children: horaCurta(c.ultima_atividade_em) })
            ] }),
            /* @__PURE__ */ jsxs2(View2, { style: estilos2.linhaBaixo, children: [
              /* @__PURE__ */ jsx3(
                Text2,
                {
                  numberOfLines: 1,
                  style: { flex: 1, fontSize: 13.5, color: tema.textoSuave, fontWeight: naoLidas > 0 ? "600" : "400" },
                  children: previewConversa(c)
                }
              ),
              c.chamada_ativa && /* @__PURE__ */ jsx3(Pulso, { children: /* @__PURE__ */ jsx3(Ionicons2, { name: "call", size: 15, color: "#10b981" }) }),
              silenciada && /* @__PURE__ */ jsx3(Ionicons2, { name: "notifications-off", size: 14, color: tema.textoSuave }),
              c.participante?.fixada && /* @__PURE__ */ jsx3(Ionicons2, { name: "pin", size: 14, color: tema.textoSuave }),
              /* @__PURE__ */ jsx3(BadgeNaoLidas, { contagem: naoLidas })
            ] })
          ] })
        ]
      },
      c.id
    );
  };
  return /* @__PURE__ */ jsxs2(View2, { style: { flex: 1, backgroundColor: tema.superficie }, children: [
    semLigacao && /* @__PURE__ */ jsx3(View2, { style: estilos2.offline, children: /* @__PURE__ */ jsx3(Text2, { style: estilos2.offlineTexto, children: "Sem liga\xE7\xE3o \u2014 a reconectar\u2026" }) }),
    renderTopo ? renderTopo({
      busca,
      setBusca,
      abrirArquivadas: !arquivadas && onAbrirArquivadas ? onAbrirArquivadas : void 0,
      arquivadas
    }) : /* @__PURE__ */ jsxs2(Fragment, { children: [
      /* @__PURE__ */ jsxs2(View2, { style: [estilos2.pesquisa, { backgroundColor: tema.fundo }], children: [
        /* @__PURE__ */ jsx3(Ionicons2, { name: "search", size: 17, color: tema.textoSuave }),
        /* @__PURE__ */ jsx3(
          TextInput,
          {
            value: busca,
            onChangeText: setBusca,
            placeholder: "Pesquisar conversas",
            placeholderTextColor: tema.textoSuave,
            style: { flex: 1, fontSize: 15, color: tema.texto, paddingVertical: 8 }
          }
        ),
        busca.length > 0 && /* @__PURE__ */ jsx3(Pressable2, { onPress: () => setBusca(""), children: /* @__PURE__ */ jsx3(Ionicons2, { name: "close-circle", size: 18, color: tema.textoSuave }) })
      ] }),
      !arquivadas && onAbrirArquivadas && /* @__PURE__ */ jsxs2(Pressable2, { onPress: onAbrirArquivadas, style: ({ pressed }) => [estilos2.arquivadas, pressed && { opacity: 0.6 }], children: [
        /* @__PURE__ */ jsx3(Ionicons2, { name: "archive-outline", size: 19, color: tema.textoSuave }),
        /* @__PURE__ */ jsx3(Text2, { style: { fontSize: 14.5, fontWeight: "600", color: tema.texto }, children: "Arquivadas" })
      ] })
    ] }),
    /* @__PURE__ */ jsx3(
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
          /* @__PURE__ */ jsx3(Text2, { style: { textAlign: "center", marginTop: 48, color: tema.textoSuave }, children: "Sem resultados." })
        ) : renderVazio ? /* @__PURE__ */ jsx3(Fragment, { children: renderVazio() }) : /* @__PURE__ */ jsxs2(View2, { style: estilos2.vazio, children: [
          /* @__PURE__ */ jsx3(View2, { style: [estilos2.vazioIcone, { backgroundColor: `${tema.primaria}1A` }], children: /* @__PURE__ */ jsx3(
            Ionicons2,
            {
              name: arquivadas ? "archive-outline" : "chatbubbles-outline",
              size: 40,
              color: tema.primaria
            }
          ) }),
          /* @__PURE__ */ jsx3(Text2, { style: [estilos2.vazioTitulo, { color: tema.texto }], children: tituloVazio ?? (arquivadas ? "Nada arquivado" : "Ainda sem conversas") }),
          /* @__PURE__ */ jsx3(Text2, { style: [estilos2.vazioTexto, { color: tema.textoSuave }], children: textoVazio ?? (arquivadas ? "As conversas que arquivares aparecem aqui." : "Quando come\xE7ares a falar com algu\xE9m, as conversas aparecem aqui.") }),
          !arquivadas && podeCriar && /* @__PURE__ */ jsxs2(
            Pressable2,
            {
              onPress: () => onNovaConversa ? onNovaConversa() : setNovaAberta(true),
              style: ({ pressed }) => [
                estilos2.vazioBotao,
                { backgroundColor: tema.primaria },
                pressed && { opacity: 0.85 }
              ],
              children: [
                /* @__PURE__ */ jsx3(Ionicons2, { name: "add", size: 18, color: tema.primariaContraste }),
                /* @__PURE__ */ jsx3(Text2, { style: { color: tema.primariaContraste, fontWeight: "700", fontSize: 14.5 }, children: "Come\xE7ar conversa" })
              ]
            }
          )
        ] })
      }
    ),
    !arquivadas && podeCriar && /* @__PURE__ */ jsx3(
      Pressable2,
      {
        onPress: () => onNovaConversa ? onNovaConversa() : setNovaAberta(true),
        style: ({ pressed }) => [estilos2.fab, { backgroundColor: tema.primaria }, pressed && { transform: [{ scale: 0.94 }] }],
        children: /* @__PURE__ */ jsx3(Ionicons2, { name: "create-outline", size: 26, color: tema.primariaContraste, style: { marginLeft: 2 } })
      }
    ),
    /* @__PURE__ */ jsx3(Sheet, { visivel: menuDe !== null, aoFechar: () => setMenuDe(null), titulo: menuDe?.titulo ?? void 0, itens: menuDe ? itensMenu(menuDe) : [] }),
    /* @__PURE__ */ jsx3(
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
    /* @__PURE__ */ jsx3(
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
  const [escolhidos, setEscolhidos] = useState3(/* @__PURE__ */ new Set());
  const [nome, setNome] = useState3("");
  const pessoas = useMemo2(() => {
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
  return /* @__PURE__ */ jsxs2(Sheet, { visivel, aoFechar, titulo: "Nova conversa", children: [
    podeGrupos && /* @__PURE__ */ jsx3(Text2, { style: { paddingHorizontal: 20, paddingBottom: 6, fontSize: 12.5, color: tema.textoSuave }, children: "Escolhe uma pessoa \u2014 ou v\xE1rias para criar um grupo." }),
    grupo && /* @__PURE__ */ jsx3(
      TextInput,
      {
        value: nome,
        onChangeText: setNome,
        placeholder: `Nome do grupo (padr\xE3o: ${nomePadrao})`,
        placeholderTextColor: tema.textoSuave,
        style: [estilos2.inputNome, { backgroundColor: tema.fundo, color: tema.texto }]
      }
    ),
    /* @__PURE__ */ jsx3(View2, { style: { maxHeight: 340 }, children: /* @__PURE__ */ jsx3(
      ListaPerformante,
      {
        data: pessoas,
        keyExtractor: (p) => `${p.tipo}:${p.id_externo}`,
        estimatedItemSize: 56,
        renderItem: ({ item: p }) => {
          const chave = `${p.tipo}:${p.id_externo}`;
          const marcado = escolhidos.has(chave);
          return /* @__PURE__ */ jsxs2(
            Pressable2,
            {
              onPress: () => setEscolhidos((a) => {
                if (marcado) {
                  const n = new Set(a);
                  n.delete(chave);
                  return n;
                }
                return podeGrupos ? new Set(a).add(chave) : /* @__PURE__ */ new Set([chave]);
              }),
              style: ({ pressed }) => [estilos2.pessoa, pressed && { backgroundColor: "rgba(0,0,0,0.04)" }],
              children: [
                /* @__PURE__ */ jsx3(
                  Ionicons2,
                  {
                    name: marcado ? "checkmark-circle" : "ellipse-outline",
                    size: 22,
                    color: marcado ? tema.primaria : tema.textoSuave
                  }
                ),
                /* @__PURE__ */ jsx3(Avatar, { nome: p.nome ?? p.id_externo, url: p.foto ?? null, tamanho: 38 }),
                /* @__PURE__ */ jsx3(Text2, { style: { flex: 1, fontSize: 15, fontWeight: "600", color: tema.texto }, numberOfLines: 1, children: p.nome ?? p.id_externo }),
                /* @__PURE__ */ jsx3(Text2, { style: { fontSize: 12, color: tema.textoSuave }, children: rotuloTipoIdentidade(p.tipo) })
              ]
            }
          );
        },
        ListEmptyComponent: /* @__PURE__ */ jsx3(Text2, { style: { padding: 20, color: tema.textoSuave }, children: "Sem contactos conhecidos." })
      }
    ) }),
    /* @__PURE__ */ jsx3(
      Pressable2,
      {
        disabled: !membros.length,
        onPress: () => void criar(),
        style: [estilos2.botaoCriar, { backgroundColor: tema.primaria, opacity: membros.length ? 1 : 0.4 }],
        children: /* @__PURE__ */ jsx3(Text2, { style: { color: tema.primariaContraste, fontWeight: "700", fontSize: 15 }, children: grupo ? `Criar grupo (${escolhidos.size})` : "Iniciar conversa" })
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
var estilos2 = StyleSheet2.create({
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

// src/ui/audio.tsx
import { Ionicons as Ionicons3 } from "@expo/vector-icons";
import { useEffect as useEffect5, useMemo as useMemo3, useRef as useRef5, useState as useState4 } from "react";
import { Pressable as Pressable3, StyleSheet as StyleSheet3, Text as Text3, View as View3 } from "react-native";
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
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
  const audio = useMemo3(() => obterAudio(), []);
  const corTexto = mimha ? tema.bolhaMinhaTexto : tema.texto;
  if (!audio) {
    return /* @__PURE__ */ jsx4(Text3, { style: { color: corTexto, fontSize: 13 }, children: "\u{1F3A4} Mensagem de voz (instala expo-audio para ouvir)" });
  }
  return /* @__PURE__ */ jsx4(PlayerInterno, { audio, url, mimha, duracaoSegundos });
}
function PlayerInterno({ audio, url, mimha, duracaoSegundos }) {
  const tema = useTema();
  const player = useRef5(null);
  const [aTocar, setATocar] = useState4(false);
  const [posicao, setPosicao] = useState4(0);
  const [duracao, setDuracao] = useState4(duracaoSegundos && duracaoSegundos > 0 ? duracaoSegundos : 0);
  const [velocidade, setVelocidade] = useState4(1);
  const barras = useMemo3(() => barrasDe(url), [url]);
  const corTexto = mimha ? tema.bolhaMinhaTexto : tema.texto;
  useEffect5(
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
  return /* @__PURE__ */ jsxs3(View3, { style: estilos3.linha, children: [
    /* @__PURE__ */ jsx4(Pressable3, { onPress: () => void alternar(), style: [estilos3.play, { backgroundColor: mimha ? "rgba(255,255,255,0.25)" : tema.primaria }], children: /* @__PURE__ */ jsx4(Ionicons3, { name: aTocar ? "pause" : "play", size: 18, color: mimha ? tema.bolhaMinhaTexto : tema.primariaContraste }) }),
    /* @__PURE__ */ jsxs3(View3, { style: { flex: 1 }, children: [
      /* @__PURE__ */ jsx4(View3, { style: estilos3.onda, children: barras.map((altura, i) => /* @__PURE__ */ jsx4(
        View3,
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
      /* @__PURE__ */ jsx4(Text3, { style: { fontSize: 11, color: corTexto, opacity: 0.7, marginTop: 3 }, children: duracaoMmSs(Math.floor(aTocar || posicao > 0 ? posicao : duracao)) })
    ] }),
    /* @__PURE__ */ jsx4(Pressable3, { onPress: mudarVelocidade, style: [estilos3.velocidade, { backgroundColor: mimha ? "rgba(255,255,255,0.25)" : "rgba(100,116,139,0.15)" }], children: /* @__PURE__ */ jsxs3(Text3, { style: { fontSize: 11, fontWeight: "800", color: corTexto }, children: [
      velocidade,
      "x"
    ] }) })
  ] });
}
function GravadorAudio({ aoTerminar, aoCancelar, padFundo }) {
  const audio = useMemo3(() => obterAudio(), []);
  if (!audio?.useAudioRecorder) {
    return /* @__PURE__ */ jsx4(GravadorErro, { aoCancelar, texto: "Instala expo-audio para gravar mensagens de voz.", padFundo });
  }
  return /* @__PURE__ */ jsx4(GravadorInterno, { audio, aoTerminar, aoCancelar, padFundo });
}
function GravadorInterno({ audio, aoTerminar, aoCancelar, padFundo }) {
  const tema = useTema();
  const recorder = audio.useAudioRecorder(audio.RecordingPresets.HIGH_QUALITY);
  const inicio = useRef5(Date.now());
  const pronto = useRef5(false);
  const [segundos, setSegundos] = useState4(0);
  const [erro, setErro] = useState4(false);
  useEffect5(() => {
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
    return /* @__PURE__ */ jsx4(GravadorErro, { aoCancelar, texto: "Sem acesso ao microfone.", padFundo });
  }
  return /* @__PURE__ */ jsxs3(View3, { style: [estilos3.gravador, { backgroundColor: tema.superficie, paddingBottom: Math.max(padFundo ?? 0, 8) }], children: [
    /* @__PURE__ */ jsx4(View3, { style: estilos3.pontoVermelho }),
    /* @__PURE__ */ jsx4(Text3, { style: { fontVariant: ["tabular-nums"], fontSize: 15, color: tema.texto, fontWeight: "600" }, children: duracaoMmSs(segundos) }),
    /* @__PURE__ */ jsx4(Text3, { style: { flex: 1, textAlign: "center", color: tema.textoSuave, fontSize: 13 }, children: "A gravar\u2026" }),
    /* @__PURE__ */ jsx4(Pressable3, { onPress: () => void parar(false), style: { padding: 6 }, children: /* @__PURE__ */ jsx4(Ionicons3, { name: "trash-outline", size: 24, color: "#ef4444" }) }),
    /* @__PURE__ */ jsx4(Pressable3, { onPress: () => void parar(true), style: [estilos3.enviarGravacao, { backgroundColor: tema.primaria }], children: /* @__PURE__ */ jsx4(Ionicons3, { name: "send", size: 19, color: tema.primariaContraste }) })
  ] });
}
function GravadorErro({ texto, aoCancelar, padFundo }) {
  const tema = useTema();
  return /* @__PURE__ */ jsxs3(View3, { style: [estilos3.gravador, { backgroundColor: tema.superficie, paddingBottom: Math.max(padFundo ?? 0, 8) }], children: [
    /* @__PURE__ */ jsx4(Text3, { style: { flex: 1, color: "#ef4444", fontSize: 13 }, children: texto }),
    /* @__PURE__ */ jsx4(Pressable3, { onPress: aoCancelar, children: /* @__PURE__ */ jsx4(Ionicons3, { name: "close-circle", size: 26, color: tema.textoSuave }) })
  ] });
}
var estilos3 = StyleSheet3.create({
  linha: { flexDirection: "row", alignItems: "center", gap: 9, width: 230, paddingVertical: 2 },
  play: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  onda: { flexDirection: "row", alignItems: "center", gap: 2, height: 26 },
  velocidade: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  gravador: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  pontoVermelho: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#ef4444" },
  enviarGravacao: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" }
});

// src/ui/media.tsx
import { Ionicons as Ionicons4 } from "@expo/vector-icons";
import { useEffect as useEffect6, useState as useState5 } from "react";
import {
  BackHandler as BackHandler2,
  Image as Image2,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable as Pressable4,
  StyleSheet as StyleSheet4,
  Text as Text4,
  TextInput as TextInput2,
  useWindowDimensions,
  View as View4
} from "react-native";
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
var KCLobby = obterKeyboardController();
var TecladoLobby = KCLobby?.KeyboardAvoidingView ?? KeyboardAvoidingView;
function tipoDeMime(mime) {
  if (mime?.startsWith("image/")) return "foto";
  if (mime?.startsWith("video/")) return "video";
  if (mime?.startsWith("audio/")) return "audio";
  return "ficheiro";
}
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
  if (Platform.OS === "android") {
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
  if (urlRemota) await Linking.openURL(urlRemota).catch(() => void 0);
}
function LobbyFotos({ ficheiros, aoMudar, aoAdicionarMais, aoEnviar, aoFechar, aEnviar, insets }) {
  const tema = useTema();
  const [legenda, setLegenda] = useState5("");
  const { width } = useWindowDimensions();
  const lado = (width - 48) / 3;
  useEffect6(() => {
    const sub = BackHandler2.addEventListener("hardwareBackPress", () => {
      aoFechar();
      return true;
    });
    return () => sub.remove();
  }, [aoFechar]);
  return /* @__PURE__ */ jsx5(View4, { style: [StyleSheet4.absoluteFillObject, { zIndex: 40, elevation: 40 }], children: /* @__PURE__ */ jsxs4(TecladoLobby, { style: { flex: 1, backgroundColor: "#0f172a" }, behavior: "padding", children: [
    /* @__PURE__ */ jsxs4(View4, { style: [estilos4.lobbyTopo, { paddingTop: insets.top + 8 }], children: [
      /* @__PURE__ */ jsx5(Pressable4, { onPress: aoFechar, style: { padding: 8 }, children: /* @__PURE__ */ jsx5(Ionicons4, { name: "close", size: 26, color: "#fff" }) }),
      /* @__PURE__ */ jsxs4(Text4, { style: { color: "#fff", fontWeight: "700", fontSize: 16 }, children: [
        ficheiros.length,
        " ",
        ficheiros.length === 1 ? "item" : "itens"
      ] }),
      /* @__PURE__ */ jsx5(Pressable4, { onPress: aoAdicionarMais, style: { padding: 8 }, children: /* @__PURE__ */ jsx5(Ionicons4, { name: "add-circle-outline", size: 26, color: "#fff" }) })
    ] }),
    /* @__PURE__ */ jsx5(View4, { style: estilos4.lobbyGrelha, children: ficheiros.map((f, i) => /* @__PURE__ */ jsxs4(View4, { style: { width: lado, height: lado, borderRadius: 12, overflow: "hidden" }, children: [
      /* @__PURE__ */ jsx5(Image2, { source: { uri: f.uri }, style: { width: "100%", height: "100%" } }),
      f.tipo === "video" && /* @__PURE__ */ jsx5(View4, { style: estilos4.lobbyPlay, children: /* @__PURE__ */ jsx5(Ionicons4, { name: "play", size: 22, color: "#fff" }) }),
      /* @__PURE__ */ jsx5(
        Pressable4,
        {
          onPress: () => aoMudar(ficheiros.filter((_, j) => j !== i)),
          style: estilos4.lobbyRemover,
          children: /* @__PURE__ */ jsx5(Ionicons4, { name: "close", size: 15, color: "#fff" })
        }
      )
    ] }, f.uri)) }),
    /* @__PURE__ */ jsxs4(View4, { style: [estilos4.lobbyFundo, { paddingBottom: insets.bottom + 12 }], children: [
      /* @__PURE__ */ jsx5(
        TextInput2,
        {
          value: legenda,
          onChangeText: setLegenda,
          placeholder: "Adicionar legenda\u2026",
          placeholderTextColor: "rgba(255,255,255,0.5)",
          style: estilos4.lobbyLegenda
        }
      ),
      /* @__PURE__ */ jsx5(
        Pressable4,
        {
          disabled: aEnviar || !ficheiros.length,
          onPress: () => aoEnviar(legenda.trim()),
          style: [estilos4.lobbyEnviar, { backgroundColor: tema.primaria, opacity: aEnviar ? 0.5 : 1 }],
          children: /* @__PURE__ */ jsx5(Ionicons4, { name: aEnviar ? "hourglass-outline" : "send", size: 20, color: tema.primariaContraste })
        }
      )
    ] })
  ] }) });
}
function Galeria({ mensagens, inicialAnexoId, aoFechar, aoResponder, aoEncaminhar, insets }) {
  const { width, height } = useWindowDimensions();
  const fotos = mensagens.flatMap((m) => m.anexos.filter((a) => a.tipo === "foto" && a.url).map((a) => ({ anexo: a, mensagem: m }))).sort((a, b) => a.mensagem.id < b.mensagem.id ? -1 : 1);
  const inicial = Math.max(0, fotos.findIndex((f) => f.anexo.id === inicialAnexoId));
  const [indice, setIndice] = useState5(inicial);
  const atual = fotos[indice];
  return /* @__PURE__ */ jsx5(Modal, { visible: true, animationType: "fade", onRequestClose: aoFechar, children: /* @__PURE__ */ jsxs4(View4, { style: { flex: 1, backgroundColor: "#000" }, children: [
    /* @__PURE__ */ jsx5(
      ListaPerformante,
      {
        data: fotos,
        horizontal: true,
        pagingEnabled: true,
        initialScrollIndex: inicial,
        getItemLayout: (_, index) => ({ length: width, offset: width * index, index }),
        keyExtractor: (f) => f.anexo.id,
        onMomentumScrollEnd: (e) => setIndice(Math.round(e.nativeEvent.contentOffset.x / width)),
        renderItem: ({ item: f }) => /* @__PURE__ */ jsx5(View4, { style: { width, height, alignItems: "center", justifyContent: "center" }, children: /* @__PURE__ */ jsx5(Image2, { source: { uri: f.anexo.url ?? void 0 }, style: { width, height: height * 0.8 }, resizeMode: "contain" }) })
      }
    ),
    /* @__PURE__ */ jsxs4(View4, { style: [estilos4.galeriaTopo, { paddingTop: insets.top + 8 }], children: [
      /* @__PURE__ */ jsx5(Pressable4, { onPress: aoFechar, style: { padding: 8 }, children: /* @__PURE__ */ jsx5(Ionicons4, { name: "close", size: 26, color: "#fff" }) }),
      /* @__PURE__ */ jsxs4(Text4, { style: { color: "#fff", fontWeight: "700" }, children: [
        fotos.length ? indice + 1 : 0,
        "/",
        fotos.length
      ] }),
      /* @__PURE__ */ jsx5(View4, { style: { width: 42 } })
    ] }),
    /* @__PURE__ */ jsxs4(View4, { style: [estilos4.galeriaAcoes, { bottom: insets.bottom + 12 }], children: [
      aoResponder && atual && /* @__PURE__ */ jsxs4(Pressable4, { onPress: () => {
        aoFechar();
        aoResponder(atual.mensagem);
      }, style: estilos4.galeriaBotao, children: [
        /* @__PURE__ */ jsx5(Ionicons4, { name: "arrow-undo-outline", size: 22, color: "#fff" }),
        /* @__PURE__ */ jsx5(Text4, { style: estilos4.galeriaRotulo, children: "Responder" })
      ] }),
      aoEncaminhar && atual && /* @__PURE__ */ jsxs4(Pressable4, { onPress: () => {
        aoFechar();
        aoEncaminhar(atual.mensagem);
      }, style: estilos4.galeriaBotao, children: [
        /* @__PURE__ */ jsx5(Ionicons4, { name: "arrow-redo-outline", size: 22, color: "#fff" }),
        /* @__PURE__ */ jsx5(Text4, { style: estilos4.galeriaRotulo, children: "Encaminhar" })
      ] })
    ] })
  ] }) });
}
function VisualizadorVideo({ url, aoFechar, insets }) {
  const video = obterVideo();
  if (!video?.useVideoPlayer) return null;
  return /* @__PURE__ */ jsx5(VideoInterno, { video, url, aoFechar, insets });
}
function VideoInterno({ video, url, aoFechar, insets }) {
  const VideoView = video.VideoView;
  const player = video.useVideoPlayer(url, (p) => {
    p.play();
  });
  return /* @__PURE__ */ jsx5(Modal, { visible: true, animationType: "fade", onRequestClose: aoFechar, children: /* @__PURE__ */ jsxs4(View4, { style: { flex: 1, backgroundColor: "#000" }, children: [
    /* @__PURE__ */ jsx5(VideoView, { player, style: { flex: 1 }, contentFit: "contain", nativeControls: true, allowsFullscreen: true }),
    /* @__PURE__ */ jsx5(Pressable4, { onPress: aoFechar, style: [estilos4.videoFechar, { top: insets.top + 8 }], children: /* @__PURE__ */ jsx5(Ionicons4, { name: "close", size: 26, color: "#fff" }) })
  ] }) });
}
function tamanhoLegivel(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
var estilos4 = StyleSheet4.create({
  lobbyTopo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 8 },
  lobbyGrelha: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 12, alignContent: "flex-start" },
  lobbyPlay: { ...StyleSheet4.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.3)" },
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
import { Ionicons as Ionicons5 } from "@expo/vector-icons";
import { dividirLinks } from "@hongayetu/makachat-core";
import { useEffect as useEffect7, useMemo as useMemo4, useRef as useRef6, useState as useState6 } from "react";
import {
  ActivityIndicator,
  Animated as Animated2,
  Image as Image3,
  Linking as Linking2,
  PanResponder,
  Pressable as Pressable5,
  StyleSheet as StyleSheet5,
  Text as Text5,
  Vibration,
  View as View5
} from "react-native";
import { jsx as jsx6, jsxs as jsxs5 } from "react/jsx-runtime";
function idMaiorOuIgual(watermark, mensagemId) {
  return !!watermark && watermark >= mensagemId;
}
function Ticks({ mensagem, outros, cor }) {
  if (mensagem.estado_envio === "a_enviar") return /* @__PURE__ */ jsx6(Ionicons5, { name: "time-outline", size: 13, color: cor });
  if (mensagem.estado_envio === "falhou") return /* @__PURE__ */ jsx6(Ionicons5, { name: "alert-circle-outline", size: 13, color: "#fca5a5" });
  const entregue = outros.length > 0 && outros.every((p) => idMaiorOuIgual(p.ultima_entrega_mensagem_id, mensagem.id));
  const lida = outros.length > 0 && outros.every((p) => idMaiorOuIgual(p.ultima_leitura_mensagem_id, mensagem.id));
  if (lida) return /* @__PURE__ */ jsx6(Ionicons5, { name: "checkmark-done", size: 14, color: "#38bdf8" });
  if (entregue) return /* @__PURE__ */ jsx6(Ionicons5, { name: "checkmark-done", size: 14, color: cor });
  return /* @__PURE__ */ jsx6(Ionicons5, { name: "checkmark", size: 14, color: cor });
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
  return /* @__PURE__ */ jsxs5(View5, { style: [estilos5.cartaoChamada, { backgroundColor: tema.superficie }], children: [
    /* @__PURE__ */ jsx6(View5, { style: [estilos5.chamadaIcone, { backgroundColor: atendida ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)" }], children: /* @__PURE__ */ jsx6(
      Ionicons5,
      {
        name: video ? atendida ? "videocam" : "videocam-off" : atendida ? "call" : "call-outline",
        size: 18,
        color: atendida ? "#10b981" : "#ef4444"
      }
    ) }),
    /* @__PURE__ */ jsxs5(View5, { children: [
      /* @__PURE__ */ jsxs5(Text5, { style: { fontSize: 14, fontWeight: "700", color: tema.texto }, children: [
        "Chamada de ",
        video ? "v\xEDdeo" : "voz"
      ] }),
      /* @__PURE__ */ jsxs5(Text5, { style: { fontSize: 12, color: atendida ? tema.textoSuave : "#ef4444", fontWeight: atendida ? "400" : "700" }, children: [
        atendida ? `Dura\xE7\xE3o ${duracaoMmSs(meta.duracao_segundos ?? 0)}` : "N\xE3o atendida",
        " \xB7 ",
        horaCurta(mensagem.criada_em)
      ] })
    ] }),
    aoLigar && /* @__PURE__ */ jsx6(Pressable5, { onPress: () => aoLigar(video ? "video" : "audio"), style: [estilos5.chamadaLigar, { backgroundColor: tema.primaria }], children: /* @__PURE__ */ jsx6(Ionicons5, { name: video ? "videocam" : "call", size: 17, color: tema.primariaContraste }) })
  ] });
}
function CartaoPartilha({ mensagem, minha }) {
  const tema = useTema();
  const { aoAbrirPartilha } = useMakaChat();
  const meta = mensagem.metadados ?? {};
  const abrir = () => {
    if (aoAbrirPartilha) return aoAbrirPartilha(meta);
    if (meta.url) void Linking2.openURL(meta.url).catch(() => void 0);
  };
  return /* @__PURE__ */ jsxs5(Pressable5, { onPress: abrir, style: [estilos5.partilha, { backgroundColor: minha ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.05)" }], children: [
    meta.imagem_url ? /* @__PURE__ */ jsx6(Image3, { source: { uri: meta.imagem_url }, style: { width: 62, height: 62 } }) : null,
    /* @__PURE__ */ jsxs5(View5, { style: { flex: 1, padding: 9, justifyContent: "center" }, children: [
      /* @__PURE__ */ jsx6(Text5, { numberOfLines: 1, style: { fontSize: 14, fontWeight: "700", color: minha ? tema.bolhaMinhaTexto : tema.texto }, children: String(meta.titulo ?? meta.url ?? "Partilha") }),
      meta.subtitulo ? /* @__PURE__ */ jsx6(Text5, { numberOfLines: 1, style: { fontSize: 12, color: minha ? tema.bolhaMinhaTexto : tema.textoSuave, opacity: 0.8 }, children: meta.subtitulo }) : null,
      /* @__PURE__ */ jsxs5(View5, { style: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 }, children: [
        /* @__PURE__ */ jsx6(Ionicons5, { name: "link-outline", size: 11, color: minha ? tema.bolhaMinhaTexto : tema.textoSuave }),
        /* @__PURE__ */ jsx6(Text5, { style: { fontSize: 10, color: minha ? tema.bolhaMinhaTexto : tema.textoSuave, opacity: 0.7 }, children: String(meta.contexto_tipo ?? "liga\xE7\xE3o") })
      ] })
    ] })
  ] });
}
function TextoComLinks({ conteudo, cor, minha }) {
  const partes = useMemo4(() => dividirLinks(conteudo), [conteudo]);
  return /* @__PURE__ */ jsx6(Text5, { style: { fontSize: 16, lineHeight: 22, color: cor }, children: partes.map(
    (p, i) => p.url ? /* @__PURE__ */ jsx6(
      Text5,
      {
        style: { textDecorationLine: "underline", fontWeight: "600", color: minha ? cor : "#2563eb" },
        onPress: () => void Linking2.openURL(p.url).catch(() => void 0),
        children: p.texto
      },
      i
    ) : /* @__PURE__ */ jsx6(Text5, { children: p.texto }, i)
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
    return /* @__PURE__ */ jsx6(Pressable5, { onPress: () => aoAbrirFoto(anexo), children: /* @__PURE__ */ jsx6(Image3, { source: { uri: anexo.url }, style: estilos5.foto }) });
  }
  if (anexo.tipo === "video" && anexo.url) {
    return /* @__PURE__ */ jsxs5(Pressable5, { onPress: () => aoAbrirUrl(anexo.url), style: estilos5.foto, children: [
      /* @__PURE__ */ jsx6(Image3, { source: { uri: anexo.url }, style: StyleSheet5.absoluteFillObject }),
      /* @__PURE__ */ jsx6(View5, { style: estilos5.playVideo, children: /* @__PURE__ */ jsx6(Ionicons5, { name: "play", size: 26, color: "#fff" }) })
    ] });
  }
  if (anexo.tipo === "audio" && anexo.url) {
    return /* @__PURE__ */ jsx6(ReprodutorAudio, { url: anexo.url, mimha: minha, duracaoSegundos: anexo.duracao_segundos });
  }
  return /* @__PURE__ */ jsx6(FicheiroAnexo, { anexo, minha, corTexto });
}
function FicheiroAnexo({ anexo, minha, corTexto }) {
  const { engine } = useMakaChat();
  const [local, setLocal] = useState6(null);
  const [verificado, setVerificado] = useState6(false);
  const [aBaixar, setABaixar] = useState6(false);
  useEffect7(() => {
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
      else if (anexo.url) await Linking2.openURL(anexo.url).catch(() => void 0);
    } finally {
      setABaixar(false);
    }
  };
  return /* @__PURE__ */ jsxs5(Pressable5, { onPress: () => void tocar(), style: [estilos5.ficheiro, { backgroundColor: minha ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.05)" }], children: [
    /* @__PURE__ */ jsx6(Ionicons5, { name: iconeFicheiro(anexo.nome_ficheiro), size: 26, color: corTexto }),
    /* @__PURE__ */ jsxs5(View5, { style: { flex: 1, minWidth: 0 }, children: [
      /* @__PURE__ */ jsx6(Text5, { numberOfLines: 1, style: { fontSize: 13.5, fontWeight: "600", color: corTexto }, children: anexo.nome_ficheiro ?? "Ficheiro" }),
      /* @__PURE__ */ jsxs5(Text5, { style: { fontSize: 11, color: corTexto, opacity: 0.7 }, children: [
        tamanhoLegivel(anexo.tamanho_bytes),
        " ",
        (anexo.nome_ficheiro ?? "").split(".").pop()?.toUpperCase()
      ] })
    ] }),
    aBaixar ? /* @__PURE__ */ jsx6(ActivityIndicator, { size: "small", color: corTexto }) : !local && verificado ? /* @__PURE__ */ jsx6(Ionicons5, { name: "arrow-down-circle-outline", size: 22, color: corTexto }) : null
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
  const arrasto = useRef6(new Animated2.Value(0)).current;
  const disparou = useRef6(false);
  const [reagiu] = useState6(false);
  void reagiu;
  const responder = useMemo4(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => !m.eliminada && g.dx > 14 && Math.abs(g.dy) < 12,
      onPanResponderMove: (_e, g) => {
        const x = Math.min(Math.max(g.dx, 0), 80);
        arrasto.setValue(x);
        if (x >= 60 && !disparou.current) {
          disparou.current = true;
          Vibration.vibrate(8);
        }
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dx >= 60) aoResponder();
        disparou.current = false;
        Animated2.spring(arrasto, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 240 }).start();
      },
      onPanResponderTerminate: () => {
        disparou.current = false;
        Animated2.spring(arrasto, { toValue: 0, useNativeDriver: true }).start();
      }
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m.id, m.eliminada]
  );
  if (m.tipo === "sistema") {
    return /* @__PURE__ */ jsx6(View5, { style: estilos5.sistema, children: /* @__PURE__ */ jsx6(Text5, { style: [estilos5.sistemaTexto, { color: tema.textoSuave }], children: m.conteudo }) });
  }
  if (m.tipo === "chamada") {
    return /* @__PURE__ */ jsx6(View5, { style: { alignItems: "center", marginVertical: 4 }, children: /* @__PURE__ */ jsx6(CartaoRegistoChamada, { mensagem: m, aoLigar }) });
  }
  const grupos = agruparReacoes(m.reacoes);
  const corTexto = minha ? tema.bolhaMinhaTexto : tema.texto;
  return /* @__PURE__ */ jsxs5(
    Animated2.View,
    {
      style: [
        { flexDirection: "row", justifyContent: minha ? "flex-end" : "flex-start", paddingHorizontal: 10, marginTop: primeiraDoBloco ? 6 : 1.5 },
        { transform: [{ translateX: arrasto }] },
        destacada && { backgroundColor: "rgba(79,70,229,0.12)", borderRadius: 12 }
      ],
      ...responder.panHandlers,
      children: [
        !minha && /* @__PURE__ */ jsx6(View5, { style: { width: 30, marginRight: 4, justifyContent: "flex-end" }, children: ultimaDoBloco && /* @__PURE__ */ jsx6(Avatar, { nome: autor?.nome ?? "?", url: autor?.foto_url, tamanho: 26 }) }),
        /* @__PURE__ */ jsxs5(
          Pressable5,
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
              grupo && !minha && primeiraDoBloco && /* @__PURE__ */ jsx6(NomeComBadge, { nome: autor?.nome ?? "\u2026", metadados: autor?.metadados, estilo: { fontSize: 12, fontWeight: "800", color: tema.primaria } }),
              respondida && m.resposta_a_id && /* @__PURE__ */ jsx6(Pressable5, { onPress: () => aoClicarCitacao(m.resposta_a_id), style: [estilos5.citacao, { backgroundColor: minha ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.06)" }], children: /* @__PURE__ */ jsxs5(Text5, { numberOfLines: 1, style: { fontSize: 12, color: corTexto, opacity: 0.85 }, children: [
                /* @__PURE__ */ jsx6(Ionicons5, { name: "arrow-undo-outline", size: 11 }),
                " ",
                respondida.conteudo ?? "\u{1F4CE} anexo"
              ] }) }),
              m.anexos.map((a) => /* @__PURE__ */ jsx6(AnexoView, { anexo: a, minha, aoAbrirFoto, aoAbrirUrl }, a.id)),
              !m.eliminada && (m.tipo === "partilha" || m.tipo === "link") && /* @__PURE__ */ jsx6(CartaoPartilha, { mensagem: m, minha }),
              m.eliminada ? /* @__PURE__ */ jsxs5(Text5, { style: { fontStyle: "italic", color: corTexto, opacity: 0.6, fontSize: 15 }, children: [
                /* @__PURE__ */ jsx6(Ionicons5, { name: "ban-outline", size: 14 }),
                " Mensagem eliminada"
              ] }) : m.conteudo ? /* @__PURE__ */ jsx6(TextoComLinks, { conteudo: m.conteudo, cor: corTexto, minha }) : null,
              /* @__PURE__ */ jsxs5(View5, { style: estilos5.rodape, children: [
                m.encaminhada_de_id && /* @__PURE__ */ jsx6(Ionicons5, { name: "arrow-redo-outline", size: 11, color: corTexto, style: { opacity: 0.6 } }),
                /* @__PURE__ */ jsxs5(Text5, { style: { fontSize: 10, color: corTexto, opacity: 0.6 }, children: [
                  m.editada_em ? "editada \xB7 " : "",
                  horaCurta(m.criada_em)
                ] }),
                minha && /* @__PURE__ */ jsx6(Ticks, { mensagem: m, outros, cor: corTexto })
              ] }),
              grupos.length > 0 && /* @__PURE__ */ jsx6(Pressable5, { onPress: aoVerReacoes, style: [estilos5.chipsReacoes, { backgroundColor: tema.superficie }, minha ? { right: 8 } : { left: 8 }], children: grupos.map((g) => /* @__PURE__ */ jsxs5(Text5, { style: { fontSize: 12 }, children: [
                g.emoji,
                g.contagem > 1 ? /* @__PURE__ */ jsxs5(Text5, { style: { fontSize: 10, fontWeight: "700", color: tema.textoSuave }, children: [
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
var estilos5 = StyleSheet5.create({
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
import { Ionicons as Ionicons6 } from "@expo/vector-icons";
import { useSafeAreaInsets as useSafeAreaInsets2 } from "react-native-safe-area-context";
import { useCallback as useCallback3, useEffect as useEffect8, useMemo as useMemo5, useRef as useRef7, useState as useState7 } from "react";
import {
  ActivityIndicator as ActivityIndicator2,
  Alert as Alert2,
  AppState as AppState2,
  KeyboardAvoidingView as KeyboardAvoidingView2,
  Linking as Linking3,
  Modal as Modal2,
  Platform as Platform2,
  Pressable as Pressable6,
  ScrollView,
  StatusBar,
  StyleSheet as StyleSheet6,
  Text as Text6,
  TextInput as TextInput3,
  View as View6
} from "react-native";
import { jsx as jsx7, jsxs as jsxs6 } from "react/jsx-runtime";
var EMOJIS = ["\u{1F44D}", "\u2764\uFE0F", "\u{1F602}", "\u{1F62E}", "\u{1F622}", "\u{1F64F}"];
var KC = obterKeyboardController();
var CampoTeclado = KC?.KeyboardAvoidingView ?? KeyboardAvoidingView2;
function ChatScreen({ conversaId, onVoltar, onAbrirInfo, onAbrirOutraConversa, chamadas, onAbrirAnexo, emFoco = true, barraEstado = "escura", renderHeader }) {
  const { engine, api, socket, identidade, registarVisivel } = useMakaChat();
  const tema = useTema();
  const insets = useSafeAreaInsets2();
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
  const podeEliminar = useFuncionalidadeAtiva("conversas.eliminar");
  const [conversa, setConversa] = useState7(null);
  const [texto, setTexto] = useState7("");
  const [responderA, setResponderA] = useState7(null);
  const inputRef = useRef7(null);
  const [editar, setEditar] = useState7(null);
  const [acoesDe, setAcoesDe] = useState7(null);
  const [reacoesDe, setReacoesDe] = useState7(null);
  const [encaminhar, setEncaminhar] = useState7(null);
  const [relatorioDe, setRelatorioDe] = useState7(null);
  const [menuAberto, setMenuAberto] = useState7(false);
  const [anexoMenu, setAnexoMenu] = useState7(false);
  const [fotosPendentes, setFotosPendentes] = useState7([]);
  const [aEnviarMedia, setAEnviarMedia] = useState7(false);
  const [aGravar, setAGravar] = useState7(false);
  const [galeriaDe, setGaleriaDe] = useState7(null);
  const [videoAberto, setVideoAberto] = useState7(null);
  const [destacada, setDestacada] = useState7(null);
  const [novas, setNovas] = useState7(0);
  const [noFundo, setNoFundo] = useState7(true);
  const [pesquisaAberta, setPesquisaAberta] = useState7(false);
  const [pesquisaQ, setPesquisaQ] = useState7("");
  const [resultados, setResultados] = useState7([]);
  const [resultadoIdx, setResultadoIdx] = useState7(0);
  const [appAtiva, setAppAtiva] = useState7(AppState2.currentState === "active");
  const lista = useRef7(null);
  const ultimaVista = useRef7(null);
  const aCarregarAntigas = useRef7(false);
  const aDescer = useRef7(false);
  const viewabilityConfig = useRef7({ itemVisiblePercentThreshold: 10 }).current;
  const aoMudarVisiveis = useRef7(({ viewableItems }) => {
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
  const semMaisAntigas = useRef7(false);
  const eu = conversa?.participantes.find((p) => p.id_externo === identidade.id && p.tipo === identidade.tipo) ?? null;
  const outros = (conversa?.participantes ?? []).filter((p) => p.identidade_id !== eu?.identidade_id && !p.saiu_em);
  const contraparte = conversa ? contraparteDe(conversa, identidade) : null;
  const grupo = conversa?.tipo === "grupo";
  const fechada = conversa?.estado === "fechada";
  useEffect8(() => {
    void engine.entrarConversa(conversaId);
    if (!emFoco) return;
    const sair = registarVisivel(conversaId);
    return sair;
  }, [engine, conversaId, registarVisivel, emFoco]);
  useEffect8(() => {
    void engine.storage.obterConversa(conversaId).then(setConversa);
  }, [engine, conversaId, versao]);
  useEffect8(() => {
    if (!responderA && !editar) return;
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [responderA, editar]);
  useEffect8(() => {
    const sub = AppState2.addEventListener("change", (estado) => setAppAtiva(estado === "active"));
    return () => sub.remove();
  }, []);
  useEffect8(() => {
    const ultima = mensagens.at(-1);
    if (!ultima || !appAtiva || !emFoco || !noFundo) return;
    if (ultimaVista.current === ultima.id) return;
    ultimaVista.current = ultima.id;
    void engine.marcarLidas(conversaId).catch(() => void 0);
    setNovas(0);
  }, [mensagens, appAtiva, emFoco, noFundo, engine, conversaId]);
  const totalAnterior = useRef7(mensagens.length);
  const ultimaContada = useRef7(null);
  useEffect8(() => {
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
  const ultimoTyping = useRef7(0);
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
      Alert2.alert("Falha no envio", `N\xE3o foi poss\xEDvel enviar as fotos. ${e?.message ?? ""}`.trim());
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
      Alert2.alert("Falha no envio", `N\xE3o foi poss\xEDvel enviar. ${e?.message ?? ""}`.trim());
    } finally {
      setAEnviarMedia(false);
    }
  };
  const indicePorId = useMemo5(() => {
    const mapa = /* @__PURE__ */ new Map();
    itensLista(mensagens, typing, eu?.identidade_id ?? null).forEach((item, i) => {
      if (item.mensagem) mapa.set(item.mensagem.id, i);
    });
    return mapa;
  }, [mensagens, typing, eu?.identidade_id]);
  const irParaMensagem = useCallback3(
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
  const itens = useMemo5(() => itensLista(mensagens, typing, eu?.identidade_id ?? null), [mensagens, typing, eu?.identidade_id]);
  const itensAcoes = (m) => {
    const minha = m.remetente_identidade_id === eu?.identidade_id || m.remetente_identidade_id === "eu";
    if (m.estado_envio === "falhou") {
      return [
        { icone: "refresh-outline", rotulo: "Tentar de novo", acao: () => void engine.reenviar(conversaId, m.id) },
        { icone: "trash-outline", rotulo: "Eliminar", destrutivo: true, acao: () => void engine.eliminarMensagem(conversaId, m.id, false) }
      ];
    }
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
    if (minha && grupo && !m.eliminada && m.estado_envio !== "a_enviar") {
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
          Alert2.alert("Eliminar mensagem?", void 0, [
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
  return /* @__PURE__ */ jsxs6(View6, { style: { flex: 1, backgroundColor: tema.fundo }, children: [
    emFoco && barraEstado != null && /* @__PURE__ */ jsx7(StatusBar, { animated: true, barStyle: barraEstado === "clara" ? "light-content" : "dark-content" }),
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
    }) : /* @__PURE__ */ jsxs6(View6, { style: [estilos6.header, { backgroundColor: tema.superficie }], children: [
      onVoltar && /* @__PURE__ */ jsx7(Pressable6, { onPress: onVoltar, style: { padding: 6 }, children: /* @__PURE__ */ jsx7(Ionicons6, { name: "chevron-back", size: 24, color: tema.texto }) }),
      /* @__PURE__ */ jsxs6(Pressable6, { style: estilos6.headerCentro, onPress: () => conversa && onAbrirInfo?.(conversa), children: [
        /* @__PURE__ */ jsx7(Avatar, { nome: conversa?.titulo ?? "?", url: conversa?.foto_url, tamanho: 38 }),
        /* @__PURE__ */ jsxs6(View6, { style: { flex: 1, minWidth: 0 }, children: [
          /* @__PURE__ */ jsx7(NomeComBadge, { nome: conversa?.titulo ?? "\u2026", metadados: contraparte?.metadados, estilo: { fontSize: 16, fontWeight: "700", color: tema.texto } }),
          /* @__PURE__ */ jsx7(Presenca2, { contraparte, typingAtivo: !!typing?.ativo, grupo, participantes: conversa?.participantes ?? [], identidadeEu: identidade })
        ] })
      ] }),
      /* @__PURE__ */ jsx7(Pressable6, { onPress: () => {
        setPesquisaAberta(!pesquisaAberta);
        setResultados([]);
        setPesquisaQ("");
      }, style: { padding: 6 }, children: /* @__PURE__ */ jsx7(Ionicons6, { name: "search", size: 21, color: tema.texto }) }),
      chamadas && podeAudioChamada && !fechada && /* @__PURE__ */ jsx7(Pressable6, { onPress: () => void chamadas.iniciar(conversaId, "audio"), style: { padding: 6 }, children: /* @__PURE__ */ jsx7(Ionicons6, { name: "call-outline", size: 21, color: tema.texto }) }),
      chamadas && podeVideoChamada && !fechada && /* @__PURE__ */ jsx7(Pressable6, { onPress: () => void chamadas.iniciar(conversaId, "video"), style: { padding: 6 }, children: /* @__PURE__ */ jsx7(Ionicons6, { name: "videocam-outline", size: 22, color: tema.texto }) }),
      /* @__PURE__ */ jsx7(Pressable6, { onPress: () => setMenuAberto(true), style: { padding: 6 }, children: /* @__PURE__ */ jsx7(Ionicons6, { name: "ellipsis-vertical", size: 20, color: tema.texto }) })
    ] }),
    pesquisaAberta && /* @__PURE__ */ jsxs6(View6, { style: [estilos6.pesquisaBarra, { backgroundColor: tema.superficie }], children: [
      /* @__PURE__ */ jsx7(Ionicons6, { name: "search", size: 16, color: tema.textoSuave }),
      /* @__PURE__ */ jsx7(
        TextInput3,
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
      resultados.length > 0 && /* @__PURE__ */ jsxs6(Text6, { style: { fontSize: 12, color: tema.textoSuave }, children: [
        resultadoIdx + 1,
        "/",
        resultados.length
      ] }),
      /* @__PURE__ */ jsx7(Pressable6, { onPress: () => navegarResultado(-1), style: { padding: 4 }, children: /* @__PURE__ */ jsx7(Ionicons6, { name: "chevron-up", size: 19, color: tema.textoSuave }) }),
      /* @__PURE__ */ jsx7(Pressable6, { onPress: () => navegarResultado(1), style: { padding: 4 }, children: /* @__PURE__ */ jsx7(Ionicons6, { name: "chevron-down", size: 19, color: tema.textoSuave }) }),
      /* @__PURE__ */ jsx7(Pressable6, { onPress: () => setPesquisaAberta(false), style: { padding: 4 }, children: /* @__PURE__ */ jsx7(Ionicons6, { name: "close", size: 19, color: tema.textoSuave }) })
    ] }),
    banner && conversa?.chamada_ativa && /* @__PURE__ */ jsxs6(View6, { style: estilos6.bannerChamada, children: [
      /* @__PURE__ */ jsx7(Pulso, { children: /* @__PURE__ */ jsx7(Ionicons6, { name: conversa.chamada_ativa.tipo === "video" ? "videocam" : "call", size: 18, color: "#fff" }) }),
      /* @__PURE__ */ jsxs6(Text6, { style: { flex: 1, color: "#fff", fontWeight: "700", fontSize: 13.5 }, children: [
        "Chamada de ",
        conversa.chamada_ativa.tipo === "video" ? "v\xEDdeo" : "voz",
        " a decorrer"
      ] }),
      /* @__PURE__ */ jsx7(
        Pressable6,
        {
          onPress: () => void chamadas?.entrar(conversa.chamada_ativa.id, conversa.chamada_ativa.tipo),
          style: estilos6.bannerEntrar,
          children: /* @__PURE__ */ jsx7(Text6, { style: { color: "#059669", fontWeight: "800", fontSize: 13 }, children: "Entrar" })
        }
      )
    ] }),
    /* @__PURE__ */ jsxs6(View6, { style: { flex: 1 }, children: [
      /* @__PURE__ */ jsx7(
        ListaPerformante,
        {
          ref: lista,
          data: itens,
          inverted: true,
          keyExtractor: (item) => item.chave,
          estimatedItemSize: 64,
          extraData: `${versao}_${destacada}`,
          ListHeaderComponent: /* @__PURE__ */ jsx7(View6, { style: { height: 10 } }),
          ListFooterComponent: /* @__PURE__ */ jsx7(View6, { style: { height: 8 } }),
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
              return /* @__PURE__ */ jsx7(View6, { style: estilos6.separador, children: /* @__PURE__ */ jsx7(Text6, { style: [estilos6.separadorTexto, { color: tema.textoSuave }], children: item.rotulo }) });
            }
            if (item.tipo === "typing") {
              return /* @__PURE__ */ jsx7(TypingBolha, {});
            }
            const m = item.mensagem;
            const minha = m.remetente_identidade_id === "eu" || m.remetente_identidade_id === eu?.identidade_id;
            const autor = conversa?.participantes.find((p) => p.identidade_id === m.remetente_identidade_id) ?? null;
            const respondida = m.resposta_a_id ? mensagens.find((x) => x.id === m.resposta_a_id) ?? null : null;
            return /* @__PURE__ */ jsx7(
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
                  else void Linking3.openURL(url).catch(() => void 0);
                },
                aoLigar: chamadas && !fechada ? (tipo) => void chamadas.iniciar(conversaId, tipo) : void 0
              }
            );
          }
        }
      ),
      !noFundo && /* @__PURE__ */ jsxs6(Pressable6, { onPress: descerParaFundo, style: [estilos6.paraFundo, novas > 0 ? { backgroundColor: tema.primaria } : { backgroundColor: tema.superficie }], children: [
        novas > 0 && /* @__PURE__ */ jsxs6(Text6, { style: { color: tema.primariaContraste, fontWeight: "800", fontSize: 12 }, children: [
          novas,
          " ",
          novas === 1 ? "nova" : "novas"
        ] }),
        /* @__PURE__ */ jsx7(Ionicons6, { name: "chevron-down", size: 18, color: novas > 0 ? tema.primariaContraste : tema.textoSuave })
      ] })
    ] }),
    (responderA || editar) && /* @__PURE__ */ jsxs6(View6, { style: [estilos6.previa, { backgroundColor: tema.superficie }], children: [
      /* @__PURE__ */ jsx7(Ionicons6, { name: editar ? "pencil-outline" : "arrow-undo-outline", size: 17, color: tema.primaria }),
      /* @__PURE__ */ jsx7(Text6, { numberOfLines: 1, style: { flex: 1, fontSize: 13, color: tema.textoSuave }, children: editar ? "A editar mensagem" : `${(responderA && conversa?.participantes.find((p) => p.identidade_id === responderA.remetente_identidade_id)?.nome) ?? ""}: ${responderA?.conteudo ?? "\u{1F4CE} anexo"}` }),
      /* @__PURE__ */ jsx7(Pressable6, { onPress: () => {
        setResponderA(null);
        setEditar(null);
        if (editar) setTexto("");
      }, children: /* @__PURE__ */ jsx7(Ionicons6, { name: "close-circle", size: 20, color: tema.textoSuave }) })
    ] }),
    fechada ? /* @__PURE__ */ jsxs6(View6, { style: [estilos6.fechada, { backgroundColor: tema.superficie, paddingBottom: Math.max(insets.bottom, 12) }], children: [
      /* @__PURE__ */ jsx7(Ionicons6, { name: "lock-closed-outline", size: 16, color: tema.textoSuave }),
      /* @__PURE__ */ jsx7(Text6, { style: { flex: 1, fontSize: 13, color: tema.textoSuave }, children: conversa?.fecho_motivo ?? "Esta conversa est\xE1 fechada." })
    ] }) : aGravar ? /* @__PURE__ */ jsx7(
      GravadorAudio,
      {
        padFundo: padFundoInput,
        aoCancelar: () => setAGravar(false),
        aoTerminar: (uri, duracao) => {
          setAGravar(false);
          void enviarFicheiroLocal({ uri, mime: "audio/m4a", nome: `voz_${Date.now()}.m4a`, tipo: "audio", duracao_segundos: duracao });
        }
      }
    ) : /* @__PURE__ */ jsx7(
      CampoTeclado,
      {
        behavior: KC ? "translate-with-padding" : Platform2.OS === "ios" ? "padding" : void 0,
        keyboardVerticalOffset: -(Math.max(insets.bottom, 8) - 8),
        children: /* @__PURE__ */ jsxs6(View6, { style: [estilos6.inputLinha, { backgroundColor: tema.superficie, paddingBottom: padFundoInput }], children: [
          (podeFoto || podeFicheiro) && /* @__PURE__ */ jsx7(Pressable6, { onPress: () => setAnexoMenu(true), style: { padding: 7 }, children: /* @__PURE__ */ jsx7(Ionicons6, { name: "attach", size: 24, color: tema.textoSuave }) }),
          /* @__PURE__ */ jsx7(
            TextInput3,
            {
              ref: inputRef,
              value: texto,
              onChangeText: aoEscrever,
              placeholder: "Mensagem",
              placeholderTextColor: tema.textoSuave,
              multiline: true,
              style: [estilos6.input, { backgroundColor: tema.fundo, color: tema.texto }]
            }
          ),
          texto.trim() ? /* @__PURE__ */ jsx7(Pressable6, { onPress: () => void aoEnviar(), style: [estilos6.enviar, { backgroundColor: tema.primaria }], children: /* @__PURE__ */ jsx7(Ionicons6, { name: editar ? "checkmark" : "send", size: 19, color: tema.primariaContraste }) }) : podeAudioMsg ? /* @__PURE__ */ jsx7(Pressable6, { onPress: () => setAGravar(true), style: [estilos6.enviar, { backgroundColor: tema.primaria }], children: /* @__PURE__ */ jsx7(Ionicons6, { name: "mic", size: 20, color: tema.primariaContraste }) }) : /* @__PURE__ */ jsx7(View6, { style: { width: 42 } })
        ] })
      }
    ),
    /* @__PURE__ */ jsx7(Sheet, { visivel: acoesDe !== null, aoFechar: () => setAcoesDe(null), itens: acoesDe ? itensAcoes(acoesDe) : [], children: acoesDe && podeReagir && !acoesDe.eliminada && /* @__PURE__ */ jsx7(View6, { style: estilos6.emojis, children: EMOJIS.map((e) => /* @__PURE__ */ jsx7(
      Pressable6,
      {
        onPress: () => {
          const alvo = acoesDe;
          setAcoesDe(null);
          if (alvo) void engine.alternarReacao(conversaId, alvo.id, e);
        },
        style: { padding: 6 },
        children: /* @__PURE__ */ jsx7(Text6, { style: { fontSize: 26 }, children: e })
      },
      e
    )) }) }),
    /* @__PURE__ */ jsx7(Sheet, { visivel: menuAberto, aoFechar: () => setMenuAberto(false), itens: itensMenuConversa() }),
    reacoesDe && conversa && /* @__PURE__ */ jsx7(
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
    encaminhar && /* @__PURE__ */ jsx7(
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
    /* @__PURE__ */ jsx7(
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
    fotosPendentes.length > 0 && /* @__PURE__ */ jsx7(
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
    galeriaDe && /* @__PURE__ */ jsx7(
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
    videoAberto && /* @__PURE__ */ jsx7(VisualizadorVideo, { url: videoAberto, aoFechar: () => setVideoAberto(null), insets }),
    relatorioDe && /* @__PURE__ */ jsx7(
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
      if (podeEliminar) {
        itens2.push({
          icone: "trash-outline",
          rotulo: "Eliminar conversa",
          destrutivo: true,
          acao: () => Alert2.alert("Eliminar conversa?", "O hist\xF3rico desaparece para ti. A outra pessoa mant\xE9m a conversa dela.", [
            { text: "Cancelar", style: "cancel" },
            { text: "Eliminar", style: "destructive", onPress: () => void engine.eliminarConversa(conversaId).then(() => onVoltar?.()) }
          ])
        });
      }
    }
    return itens2;
  }
}
function Presenca2({ contraparte, typingAtivo, grupo, participantes, identidadeEu }) {
  const { engine, subscreverPresenca, socket } = useMakaChat();
  const tema = useTema();
  const [online, setOnline] = useState7(false);
  const [tick, setTick] = useState7(0);
  useEffect8(() => {
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
  if (typingAtivo) return /* @__PURE__ */ jsx7(Text6, { style: { fontSize: 12, color: tema.primaria, fontWeight: "600" }, children: "a escrever\u2026" });
  if (grupo) {
    return membrosOnline > 0 ? /* @__PURE__ */ jsxs6(Text6, { style: { fontSize: 12, color: "#10b981", fontWeight: "600" }, children: [
      membrosOnline,
      " online"
    ] }) : /* @__PURE__ */ jsxs6(Text6, { style: { fontSize: 12, color: tema.textoSuave }, children: [
      totalMembros,
      " membros"
    ] });
  }
  if (online) return /* @__PURE__ */ jsx7(Text6, { style: { fontSize: 12, color: "#10b981", fontWeight: "600" }, children: "online" });
  return null;
}
function RelatorioEntrega({ conversaId, mensagem, aoFechar, insets }) {
  const { api } = useMakaChat();
  const tema = useTema();
  const [recibos, setRecibos] = useState7(null);
  useEffect8(() => {
    let vivo = true;
    void api.recibosDaMensagem(conversaId, mensagem.id).then((r) => vivo && setRecibos(r.recibos)).catch(() => vivo && setRecibos([]));
    return () => {
      vivo = false;
    };
  }, [api, conversaId, mensagem.id]);
  const vistos = (recibos ?? []).filter((r) => r.vista);
  const entregues = (recibos ?? []).filter((r) => r.entregue && !r.vista);
  const seccao = (titulo, icone, cor, lista) => lista.length > 0 && /* @__PURE__ */ jsxs6(View6, { style: { marginTop: 18 }, children: [
    /* @__PURE__ */ jsxs6(View6, { style: estilos6.relSeccaoTopo, children: [
      /* @__PURE__ */ jsx7(Ionicons6, { name: icone, size: 16, color: cor }),
      /* @__PURE__ */ jsxs6(Text6, { style: { fontSize: 12.5, fontWeight: "700", color: tema.textoSuave, textTransform: "uppercase" }, children: [
        titulo,
        " \xB7 ",
        lista.length
      ] })
    ] }),
    lista.map((r) => /* @__PURE__ */ jsxs6(View6, { style: estilos6.relLinha, children: [
      /* @__PURE__ */ jsx7(Avatar, { nome: r.nome, url: r.foto_url, tamanho: 40 }),
      /* @__PURE__ */ jsx7(Text6, { style: { flex: 1, fontSize: 15, fontWeight: "600", color: tema.texto }, numberOfLines: 1, children: r.nome }),
      /* @__PURE__ */ jsx7(Ionicons6, { name: icone, size: 18, color: cor })
    ] }, r.identidade_id))
  ] });
  return /* @__PURE__ */ jsx7(Modal2, { visible: true, animationType: "slide", onRequestClose: aoFechar, children: /* @__PURE__ */ jsxs6(View6, { style: { flex: 1, backgroundColor: tema.fundo }, children: [
    /* @__PURE__ */ jsxs6(View6, { style: [estilos6.relHeader, { backgroundColor: tema.superficie, paddingTop: insets.top + 8 }], children: [
      /* @__PURE__ */ jsx7(Pressable6, { onPress: aoFechar, style: { padding: 6 }, children: /* @__PURE__ */ jsx7(Ionicons6, { name: "chevron-back", size: 24, color: tema.texto }) }),
      /* @__PURE__ */ jsx7(Text6, { style: { flex: 1, fontSize: 17, fontWeight: "700", color: tema.texto }, children: "Relat\xF3rio de entrega" })
    ] }),
    recibos === null ? /* @__PURE__ */ jsx7(ActivityIndicator2, { style: { marginTop: 40 }, color: tema.primaria }) : vistos.length === 0 && entregues.length === 0 ? /* @__PURE__ */ jsx7(Text6, { style: { padding: 24, textAlign: "center", color: tema.textoSuave }, children: "Ainda ningu\xE9m recebeu esta mensagem." }) : /* @__PURE__ */ jsxs6(ScrollView, { contentContainerStyle: { paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }, children: [
      mensagem.conteudo ? /* @__PURE__ */ jsxs6(Text6, { numberOfLines: 2, style: { marginTop: 12, fontSize: 13.5, color: tema.textoSuave, fontStyle: "italic" }, children: [
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
  return /* @__PURE__ */ jsxs6(View6, { style: { flexDirection: "row", paddingHorizontal: 10, marginTop: 6 }, children: [
    /* @__PURE__ */ jsx7(View6, { style: { width: 30, marginRight: 4 } }),
    /* @__PURE__ */ jsx7(View6, { style: { backgroundColor: tema.bolhaOutro, borderRadius: tema.raio, borderBottomLeftRadius: 6, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", gap: 4 }, children: [0, 1, 2].map((i) => /* @__PURE__ */ jsx7(PontoTyping, { atraso: i * 160 }, i)) })
  ] });
}
function PontoTyping({ atraso }) {
  const tema = useTema();
  const [opaco, setOpaco] = useState7(false);
  useEffect8(() => {
    const timer = setInterval(() => setOpaco((o) => !o), 480);
    const arranque = setTimeout(() => setOpaco(true), atraso);
    return () => {
      clearInterval(timer);
      clearTimeout(arranque);
    };
  }, [atraso]);
  return /* @__PURE__ */ jsx7(View6, { style: { width: 7, height: 7, borderRadius: 4, backgroundColor: tema.textoSuave, opacity: opaco ? 0.85 : 0.3 } });
}
function SheetReacoes({ mensagem, conversa, euId, aoFechar, aoRemoverMinha, aoMensagem }) {
  const tema = useTema();
  return /* @__PURE__ */ jsxs6(Sheet, { visivel: true, aoFechar, titulo: "Rea\xE7\xF5es", children: [
    mensagem.reacoes.length === 0 && /* @__PURE__ */ jsx7(Text6, { style: { paddingHorizontal: 20, paddingVertical: 12, color: tema.textoSuave }, children: "Sem rea\xE7\xF5es." }),
    mensagem.reacoes.map((r) => {
      const p = conversa.participantes.find((x) => x.identidade_id === r.identidade_id);
      const souEu = r.identidade_id === euId;
      return /* @__PURE__ */ jsxs6(
        Pressable6,
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
            /* @__PURE__ */ jsx7(Avatar, { nome: p?.nome ?? "?", url: p?.foto_url, tamanho: 36 }),
            /* @__PURE__ */ jsxs6(View6, { style: { flex: 1 }, children: [
              /* @__PURE__ */ jsx7(Text6, { style: { fontSize: 15, fontWeight: "600", color: tema.texto }, children: souEu ? "Tu" : p?.nome ?? "Utilizador" }),
              /* @__PURE__ */ jsx7(Text6, { style: { fontSize: 12, color: tema.textoSuave }, children: souEu ? "Toca para remover" : aoMensagem ? "Toca para enviar mensagem" : "" })
            ] }),
            /* @__PURE__ */ jsx7(Text6, { style: { fontSize: 22 }, children: r.emoji })
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
  const [conversas, setConversas] = useState7([]);
  const [escolhidas, setEscolhidas] = useState7(/* @__PURE__ */ new Set());
  useEffect8(() => {
    void engine.storage.listarConversas(false).then(setConversas);
  }, [engine]);
  return /* @__PURE__ */ jsxs6(Sheet, { visivel: true, aoFechar, titulo: "Encaminhar para\u2026", children: [
    /* @__PURE__ */ jsx7(View6, { style: { maxHeight: 360 }, children: /* @__PURE__ */ jsx7(
      ListaPerformante,
      {
        data: conversas,
        keyExtractor: (c) => c.id,
        estimatedItemSize: 54,
        renderItem: ({ item: c }) => {
          const marcada = escolhidas.has(c.id);
          return /* @__PURE__ */ jsxs6(
            Pressable6,
            {
              onPress: () => setEscolhidas((a) => {
                const n = new Set(a);
                if (marcada) n.delete(c.id);
                else n.add(c.id);
                return n;
              }),
              style: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 8 },
              children: [
                /* @__PURE__ */ jsx7(Ionicons6, { name: marcada ? "checkmark-circle" : "ellipse-outline", size: 22, color: marcada ? tema.primaria : tema.textoSuave }),
                /* @__PURE__ */ jsx7(Avatar, { nome: c.titulo ?? "?", url: c.foto_url, tamanho: 36 }),
                /* @__PURE__ */ jsx7(Text6, { numberOfLines: 1, style: { flex: 1, fontSize: 15, fontWeight: "600", color: tema.texto }, children: c.titulo ?? "Conversa" })
              ]
            }
          );
        }
      }
    ) }),
    /* @__PURE__ */ jsx7(
      Pressable6,
      {
        disabled: !escolhidas.size,
        onPress: () => aoConfirmar([...escolhidas]),
        style: { marginHorizontal: 16, marginTop: 10, borderRadius: 24, paddingVertical: 13, alignItems: "center", backgroundColor: tema.primaria, opacity: escolhidas.size ? 1 : 0.4 },
        children: /* @__PURE__ */ jsxs6(Text6, { style: { color: tema.primariaContraste, fontWeight: "700", fontSize: 15 }, children: [
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
var estilos6 = StyleSheet6.create({
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

// src/ui/InfoConversaScreen.tsx
import { Ionicons as Ionicons7 } from "@expo/vector-icons";
import { dividirLinks as dividirLinks2, rotuloTipoIdentidade as rotuloTipoIdentidade2 } from "@hongayetu/makachat-core";
import { useEffect as useEffect9, useMemo as useMemo6, useState as useState8 } from "react";
import { ActivityIndicator as ActivityIndicator3, Alert as Alert3, Image as Image4, Linking as Linking4, Pressable as Pressable7, ScrollView as ScrollView2, StatusBar as StatusBar2, StyleSheet as StyleSheet7, Text as Text7, TextInput as TextInput4, useWindowDimensions as useWindowDimensions2, View as View7 } from "react-native";
import { useSafeAreaInsets as useSafeAreaInsets3 } from "react-native-safe-area-context";
import { jsx as jsx8, jsxs as jsxs7 } from "react/jsx-runtime";
function InfoConversaScreen({ conversaId, onVoltar, onSaiu, onAbrirOutraConversa, barraEstado = "escura" }) {
  const { engine, api, identidade, contactos, aoVerPerfil } = useMakaChat();
  const tema = useTema();
  const insets = useSafeAreaInsets3();
  const versao = useVersaoChat();
  const podeGrupos = useFuncionalidadeAtiva("grupos");
  const podeCriarConversa = useFuncionalidadeAtiva("conversas.criar");
  const [conversa, setConversa] = useState8(null);
  const [renomear, setRenomear] = useState8(false);
  const [novoNome, setNovoNome] = useState8("");
  const [adicionarAberto, setAdicionarAberto] = useState8(false);
  const [membroDe, setMembroDe] = useState8(null);
  useEffect9(() => {
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
      Alert3.alert("Falha", "N\xE3o foi poss\xEDvel mudar a foto do grupo.");
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
    Alert3.alert("Sair do grupo?", "Deixas de receber mensagens desta conversa.", [
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
    Alert3.alert(`Remover ${p.nome}?`, void 0, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: () => void api.removerParticipante(conversaId, p.identidade_id).then(atualizar)
      }
    ]);
  };
  if (!conversa) return /* @__PURE__ */ jsx8(View7, { style: { flex: 1, backgroundColor: tema.fundo } });
  return /* @__PURE__ */ jsxs7(View7, { style: { flex: 1, backgroundColor: tema.fundo }, children: [
    barraEstado != null && /* @__PURE__ */ jsx8(StatusBar2, { animated: true, barStyle: barraEstado === "clara" ? "light-content" : "dark-content" }),
    /* @__PURE__ */ jsxs7(View7, { style: [estilos7.header, { backgroundColor: tema.superficie, paddingTop: insets.top + 8 }], children: [
      onVoltar && /* @__PURE__ */ jsx8(Pressable7, { onPress: onVoltar, style: { padding: 6 }, children: /* @__PURE__ */ jsx8(Ionicons7, { name: "chevron-back", size: 24, color: tema.texto }) }),
      /* @__PURE__ */ jsx8(Text7, { style: { flex: 1, fontSize: 17, fontWeight: "700", color: tema.texto }, children: grupo ? "Info do grupo" : "Contacto" })
    ] }),
    /* @__PURE__ */ jsxs7(ScrollView2, { contentContainerStyle: { paddingBottom: insets.bottom + 16 }, children: [
      /* @__PURE__ */ jsxs7(View7, { style: [estilos7.topo, { backgroundColor: tema.superficie }], children: [
        /* @__PURE__ */ jsxs7(Pressable7, { onPress: grupo && souAdmin ? () => void mudarFoto() : void 0, children: [
          /* @__PURE__ */ jsx8(Avatar, { nome: conversa.titulo ?? "?", url: conversa.foto_url, tamanho: 96 }),
          grupo && souAdmin && /* @__PURE__ */ jsx8(View7, { style: [estilos7.mudarFoto, { backgroundColor: tema.primaria }], children: /* @__PURE__ */ jsx8(Ionicons7, { name: "camera", size: 15, color: tema.primariaContraste }) })
        ] }),
        renomear ? /* @__PURE__ */ jsxs7(View7, { style: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }, children: [
          /* @__PURE__ */ jsx8(
            TextInput4,
            {
              autoFocus: true,
              value: novoNome,
              onChangeText: setNovoNome,
              style: [estilos7.inputNome, { backgroundColor: tema.fundo, color: tema.texto }]
            }
          ),
          /* @__PURE__ */ jsx8(Pressable7, { onPress: () => void guardarNome(), children: /* @__PURE__ */ jsx8(Ionicons7, { name: "checkmark-circle", size: 30, color: tema.primaria }) })
        ] }) : /* @__PURE__ */ jsxs7(
          Pressable7,
          {
            onPress: grupo && souAdmin ? () => {
              setNovoNome(conversa.titulo ?? "");
              setRenomear(true);
            } : void 0,
            style: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
            children: [
              /* @__PURE__ */ jsx8(Text7, { style: { fontSize: 20, fontWeight: "800", color: tema.texto }, children: conversa.titulo }),
              grupo && souAdmin && /* @__PURE__ */ jsx8(Ionicons7, { name: "pencil", size: 16, color: tema.textoSuave })
            ]
          }
        ),
        grupo && /* @__PURE__ */ jsxs7(Text7, { style: { fontSize: 13, color: tema.textoSuave, marginTop: 3 }, children: [
          membros.length,
          " membros"
        ] }),
        !grupo && contraparte && engine.presencaDe(contraparte.identidade_id)?.online && /* @__PURE__ */ jsx8(Text7, { style: { fontSize: 13, fontWeight: "600", color: "#10b981", marginTop: 3 }, children: "online" }),
        !grupo && contraparte && aoVerPerfil && /* @__PURE__ */ jsxs7(
          Pressable7,
          {
            onPress: () => aoVerPerfil(contraparte),
            style: [estilos7.verPerfil, { borderColor: tema.primaria }],
            children: [
              /* @__PURE__ */ jsx8(Ionicons7, { name: "person-circle-outline", size: 18, color: tema.primaria }),
              /* @__PURE__ */ jsx8(Text7, { style: { fontSize: 14, fontWeight: "700", color: tema.primaria }, children: "Ver perfil" })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsxs7(View7, { style: [estilos7.seccao, { backgroundColor: tema.superficie }], children: [
        /* @__PURE__ */ jsx8(Text7, { style: [estilos7.seccaoTitulo, { color: tema.textoSuave }], children: grupo ? "Membros" : "Participantes" }),
        grupo && souAdmin && podeGrupos && /* @__PURE__ */ jsxs7(Pressable7, { onPress: () => setAdicionarAberto(true), style: estilos7.membro, children: [
          /* @__PURE__ */ jsx8(View7, { style: [estilos7.addIcone, { backgroundColor: tema.primaria }], children: /* @__PURE__ */ jsx8(Ionicons7, { name: "person-add", size: 18, color: tema.primariaContraste }) }),
          /* @__PURE__ */ jsx8(Text7, { style: { fontSize: 15, fontWeight: "600", color: tema.primaria }, children: "Adicionar membros" })
        ] }),
        membros.map((p) => {
          const souEuMesmo = p.identidade_id === eu?.identidade_id;
          return /* @__PURE__ */ jsxs7(Pressable7, { onPress: souEuMesmo ? void 0 : () => setMembroDe(p), style: estilos7.membro, children: [
            /* @__PURE__ */ jsxs7(View7, { children: [
              /* @__PURE__ */ jsx8(Avatar, { nome: p.nome, url: p.foto_url, tamanho: 42 }),
              !souEuMesmo && engine.presencaDe(p.identidade_id)?.online && /* @__PURE__ */ jsx8(View7, { style: [estilos7.bolinhaMembro, { borderColor: tema.superficie }] })
            ] }),
            /* @__PURE__ */ jsxs7(View7, { style: { flex: 1, minWidth: 0 }, children: [
              /* @__PURE__ */ jsx8(NomeComBadge, { nome: souEuMesmo ? "Tu" : p.nome, metadados: p.metadados, estilo: { fontSize: 15, fontWeight: "600", color: tema.texto } }),
              /* @__PURE__ */ jsx8(Text7, { style: { fontSize: 12, color: tema.textoSuave }, children: rotuloTipoIdentidade2(p.tipo) })
            ] }),
            (p.papel === "dono" || p.papel === "admin") && /* @__PURE__ */ jsx8(View7, { style: [estilos7.papel, { borderColor: tema.primaria }], children: /* @__PURE__ */ jsx8(Text7, { style: { fontSize: 10.5, fontWeight: "700", color: tema.primaria }, children: p.papel === "dono" ? "Dono" : "Admin" }) })
          ] }, p.identidade_id);
        })
      ] }),
      /* @__PURE__ */ jsx8(MediaDaConversa, { conversaId }),
      grupo && /* @__PURE__ */ jsx8(View7, { style: [estilos7.seccao, { backgroundColor: tema.superficie }], children: /* @__PURE__ */ jsxs7(Pressable7, { onPress: sairDoGrupo, style: estilos7.membro, children: [
        /* @__PURE__ */ jsx8(Ionicons7, { name: "exit-outline", size: 22, color: "#ef4444" }),
        /* @__PURE__ */ jsx8(Text7, { style: { fontSize: 15, fontWeight: "600", color: "#ef4444" }, children: "Sair do grupo" })
      ] }) })
    ] }),
    /* @__PURE__ */ jsx8(
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
                void api.mudarPapel(conversaId, p.identidade_id, p.papel === "admin" ? "membro" : "admin").then(atualizar).catch(() => Alert3.alert("Falha", "N\xE3o foi poss\xEDvel alterar o papel."));
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
    adicionarAberto && /* @__PURE__ */ jsx8(
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
  const { width } = useWindowDimensions2();
  const [tab, setTab] = useState8("fotos");
  const [anexos, setAnexos] = useState8(null);
  const [links, setLinks] = useState8(null);
  const [aCarregar, setACarregar] = useState8(false);
  const [temMais, setTemMais] = useState8(false);
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
  useEffect9(() => {
    setAnexos(null);
    setLinks(null);
    void carregar();
  }, [conversaId, tab]);
  const abrirLink = (l) => {
    const url = l.metadados?.url ?? dividirLinks2(l.conteudo ?? "").find((p) => p.url)?.url;
    if (url) void Linking4.openURL(String(url)).catch(() => void 0);
  };
  const vazio = tab === "links" ? links !== null && links.length === 0 : anexos !== null && anexos.length === 0;
  return /* @__PURE__ */ jsxs7(View7, { style: [estilos7.seccao, { backgroundColor: tema.superficie }], children: [
    /* @__PURE__ */ jsx8(Text7, { style: [estilos7.seccaoTitulo, { color: tema.textoSuave }], children: "Media da conversa" }),
    /* @__PURE__ */ jsx8(View7, { style: estilos7.tabsLinha, children: TABS.map((t) => /* @__PURE__ */ jsx8(
      Pressable7,
      {
        onPress: () => setTab(t.chave),
        style: [estilos7.tab, tab === t.chave && { backgroundColor: tema.primaria }],
        children: /* @__PURE__ */ jsx8(Text7, { style: { fontSize: 13, fontWeight: "700", color: tab === t.chave ? tema.primariaContraste : tema.textoSuave }, children: t.rotulo })
      },
      t.chave
    )) }),
    aCarregar && anexos === null && links === null && /* @__PURE__ */ jsx8(ActivityIndicator3, { style: { paddingVertical: 18 }, color: tema.primaria }),
    vazio && !aCarregar && /* @__PURE__ */ jsxs7(Text7, { style: { paddingHorizontal: 18, paddingVertical: 14, fontSize: 13, color: tema.textoSuave }, children: [
      "Ainda n\xE3o h\xE1 ",
      TABS.find((t) => t.chave === tab)?.rotulo.toLowerCase(),
      " nesta conversa."
    ] }),
    tab === "fotos" && !!anexos?.length && /* @__PURE__ */ jsx8(View7, { style: estilos7.grelha, children: anexos.map(
      (a) => a.url ? /* @__PURE__ */ jsx8(Pressable7, { onPress: () => void Linking4.openURL(a.url).catch(() => void 0), children: /* @__PURE__ */ jsx8(Image4, { source: { uri: a.url }, style: { width: ladoFoto, height: ladoFoto, borderRadius: 8 } }) }, a.id) : null
    ) }),
    tab === "ficheiros" && anexos?.map((a) => /* @__PURE__ */ jsx8(View7, { style: { paddingHorizontal: 16, paddingVertical: 4 }, children: /* @__PURE__ */ jsx8(FicheiroAnexo, { anexo: a, minha: false, corTexto: tema.texto }) }, a.id)),
    tab === "audios" && anexos?.map(
      (a) => a.url ? /* @__PURE__ */ jsx8(View7, { style: { paddingHorizontal: 16, paddingVertical: 6 }, children: /* @__PURE__ */ jsx8(ReprodutorAudio, { url: a.url, mimha: false, duracaoSegundos: a.duracao_segundos }) }, a.id) : null
    ),
    tab === "links" && links?.map((l) => /* @__PURE__ */ jsxs7(Pressable7, { onPress: () => abrirLink(l), style: estilos7.linkLinha, children: [
      /* @__PURE__ */ jsx8(View7, { style: [estilos7.linkIcone, { backgroundColor: `${tema.primaria}1A` }], children: /* @__PURE__ */ jsx8(Ionicons7, { name: "link", size: 18, color: tema.primaria }) }),
      /* @__PURE__ */ jsxs7(View7, { style: { flex: 1, minWidth: 0 }, children: [
        !!l.metadados?.titulo && /* @__PURE__ */ jsx8(Text7, { numberOfLines: 1, style: { fontSize: 14, fontWeight: "600", color: tema.texto }, children: String(l.metadados.titulo) }),
        /* @__PURE__ */ jsx8(Text7, { numberOfLines: 2, style: { fontSize: 12.5, color: tema.textoSuave }, children: String(l.metadados?.url ?? l.conteudo ?? "") })
      ] })
    ] }, l.id)),
    temMais && !aCarregar && /* @__PURE__ */ jsx8(
      Pressable7,
      {
        onPress: () => {
          const ultimo = tab === "links" ? links?.at(-1)?.id : anexos?.at(-1)?.id;
          if (ultimo) void carregar(ultimo);
        },
        style: { alignItems: "center", paddingVertical: 10 },
        children: /* @__PURE__ */ jsx8(Text7, { style: { fontSize: 13.5, fontWeight: "700", color: tema.primaria }, children: "Ver mais" })
      }
    )
  ] });
}
function AdicionarMembrosSheet({ conversa, contactos, aoFechar, aoAdicionar }) {
  const tema = useTema();
  const [escolhidos, setEscolhidos] = useState8(/* @__PURE__ */ new Set());
  const candidatos = useMemo6(() => {
    const jaNoGrupo = new Set(conversa.participantes.filter((p) => !p.saiu_em).map((p) => `${p.tipo}:${p.id_externo}`));
    return contactos.filter((c) => !jaNoGrupo.has(`${c.tipo}:${c.id_externo}`));
  }, [conversa, contactos]);
  const alvos = candidatos.filter((c) => escolhidos.has(`${c.tipo}:${c.id_externo}`));
  return /* @__PURE__ */ jsxs7(Sheet, { visivel: true, aoFechar, titulo: "Adicionar membros", children: [
    /* @__PURE__ */ jsx8(View7, { style: { maxHeight: 340 }, children: /* @__PURE__ */ jsx8(
      ListaPerformante,
      {
        data: candidatos,
        keyExtractor: (p) => `${p.tipo}:${p.id_externo}`,
        estimatedItemSize: 54,
        renderItem: ({ item: p }) => {
          const chave = `${p.tipo}:${p.id_externo}`;
          const marcado = escolhidos.has(chave);
          return /* @__PURE__ */ jsxs7(
            Pressable7,
            {
              onPress: () => setEscolhidos((a) => {
                const n = new Set(a);
                if (marcado) n.delete(chave);
                else n.add(chave);
                return n;
              }),
              style: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 8 },
              children: [
                /* @__PURE__ */ jsx8(Ionicons7, { name: marcado ? "checkmark-circle" : "ellipse-outline", size: 22, color: marcado ? tema.primaria : tema.textoSuave }),
                /* @__PURE__ */ jsx8(Avatar, { nome: p.nome ?? p.id_externo, url: p.foto ?? null, tamanho: 36 }),
                /* @__PURE__ */ jsx8(Text7, { style: { flex: 1, fontSize: 15, fontWeight: "600", color: tema.texto }, numberOfLines: 1, children: p.nome ?? p.id_externo })
              ]
            }
          );
        },
        ListEmptyComponent: /* @__PURE__ */ jsx8(Text7, { style: { padding: 20, color: tema.textoSuave }, children: "Sem contactos para adicionar." })
      }
    ) }),
    /* @__PURE__ */ jsx8(
      Pressable7,
      {
        disabled: !alvos.length,
        onPress: () => void aoAdicionar(alvos),
        style: { marginHorizontal: 16, marginTop: 10, borderRadius: 24, paddingVertical: 13, alignItems: "center", backgroundColor: tema.primaria, opacity: alvos.length ? 1 : 0.4 },
        children: /* @__PURE__ */ jsxs7(Text7, { style: { color: tema.primariaContraste, fontWeight: "700", fontSize: 15 }, children: [
          "Adicionar",
          alvos.length ? ` (${alvos.length})` : ""
        ] })
      }
    )
  ] });
}
var estilos7 = StyleSheet7.create({
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
import { Ionicons as Ionicons8 } from "@expo/vector-icons";
import { useEffect as useEffect10, useMemo as useMemo7, useRef as useRef8, useState as useState9 } from "react";
import { ActivityIndicator as ActivityIndicator4, Alert as Alert4, Pressable as Pressable8, StyleSheet as StyleSheet8, Text as Text8, TextInput as TextInput5, View as View8 } from "react-native";
import { useSafeAreaInsets as useSafeAreaInsets4 } from "react-native-safe-area-context";
import { jsx as jsx9, jsxs as jsxs8 } from "react/jsx-runtime";
var DEBOUNCE_MS = 350;
function NovaConversaScreen({ onVoltar, onCriada, pesquisarContactos, textoSugestoes = "Sugest\xF5es" }) {
  const { api, engine, contactos, identidade } = useMakaChat();
  const tema = useTema();
  const insets = useSafeAreaInsets4();
  const conversas = useConversas(false);
  const podeGrupos = useFuncionalidadeAtiva("grupos");
  const [busca, setBusca] = useState9("");
  const [resultados, setResultados] = useState9(null);
  const [aPesquisar, setAPesquisar] = useState9(false);
  const [modoGrupo, setModoGrupo] = useState9(false);
  const [escolhidos, setEscolhidos] = useState9(/* @__PURE__ */ new Map());
  const [nomeGrupo, setNomeGrupo] = useState9("");
  const [aCriar, setACriar] = useState9(false);
  const pedidoAtual = useRef8(0);
  const sugestoes = useMemo7(() => {
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
  useEffect10(() => {
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
      Alert4.alert("N\xE3o foi poss\xEDvel iniciar a conversa", e?.message ?? "Tenta de novo.");
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
      Alert4.alert("N\xE3o foi poss\xEDvel criar o grupo", e?.message ?? "Tenta de novo.");
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
  return /* @__PURE__ */ jsxs8(View8, { style: { flex: 1, backgroundColor: tema.fundo }, children: [
    /* @__PURE__ */ jsxs8(View8, { style: [estilos8.header, { paddingTop: insets.top + 8, backgroundColor: tema.superficie }], children: [
      /* @__PURE__ */ jsx9(Pressable8, { onPress: onVoltar, style: { padding: 6 }, hitSlop: 8, children: /* @__PURE__ */ jsx9(Ionicons8, { name: "arrow-back", size: 24, color: tema.texto }) }),
      /* @__PURE__ */ jsxs8(View8, { style: [estilos8.pesquisa, { backgroundColor: tema.fundo }], children: [
        /* @__PURE__ */ jsx9(Ionicons8, { name: "search", size: 17, color: tema.textoSuave }),
        /* @__PURE__ */ jsx9(
          TextInput5,
          {
            value: busca,
            onChangeText: setBusca,
            placeholder: "Pesquisar pessoas",
            placeholderTextColor: tema.textoSuave,
            style: { flex: 1, fontSize: 15, color: tema.texto, paddingVertical: 9 },
            returnKeyType: "search"
          }
        ),
        aPesquisar ? /* @__PURE__ */ jsx9(ActivityIndicator4, { size: "small", color: tema.textoSuave }) : busca.length > 0 ? /* @__PURE__ */ jsx9(Pressable8, { onPress: () => setBusca(""), hitSlop: 6, children: /* @__PURE__ */ jsx9(Ionicons8, { name: "close-circle", size: 18, color: tema.textoSuave }) }) : null
      ] })
    ] }),
    podeGrupos && !modoGrupo && /* @__PURE__ */ jsxs8(Pressable8, { onPress: () => setModoGrupo(true), style: [estilos8.linhaGrupo, { backgroundColor: tema.superficie }], children: [
      /* @__PURE__ */ jsx9(View8, { style: [estilos8.iconeGrupo, { backgroundColor: tema.primaria }], children: /* @__PURE__ */ jsx9(Ionicons8, { name: "people", size: 20, color: tema.primariaContraste }) }),
      /* @__PURE__ */ jsx9(Text8, { style: { fontSize: 15.5, fontWeight: "600", color: tema.texto }, children: "Novo grupo" })
    ] }),
    modoGrupo && /* @__PURE__ */ jsxs8(View8, { style: [estilos8.barraGrupo, { backgroundColor: tema.superficie }], children: [
      /* @__PURE__ */ jsx9(
        TextInput5,
        {
          value: nomeGrupo,
          onChangeText: setNomeGrupo,
          placeholder: "Nome do grupo (opcional)",
          placeholderTextColor: tema.textoSuave,
          style: [estilos8.inputNome, { backgroundColor: tema.fundo, color: tema.texto }]
        }
      ),
      /* @__PURE__ */ jsx9(
        Pressable8,
        {
          onPress: () => {
            setModoGrupo(false);
            setEscolhidos(/* @__PURE__ */ new Map());
            setNomeGrupo("");
          },
          hitSlop: 8,
          style: { padding: 6 },
          children: /* @__PURE__ */ jsx9(Ionicons8, { name: "close", size: 22, color: tema.textoSuave })
        }
      )
    ] }),
    !busca.trim() && /* @__PURE__ */ jsx9(Text8, { style: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, fontSize: 12.5, fontWeight: "700", color: tema.textoSuave, textTransform: "uppercase" }, children: textoSugestoes }),
    /* @__PURE__ */ jsx9(
      ListaPerformante,
      {
        data: lista,
        keyExtractor: (p) => `${p.tipo}:${p.id_externo}`,
        estimatedItemSize: 62,
        renderItem: ({ item: p }) => {
          const marcado = escolhidos.has(`${p.tipo}:${p.id_externo}`);
          return /* @__PURE__ */ jsxs8(
            Pressable8,
            {
              disabled: aCriar,
              onPress: () => modoGrupo ? alternarEscolhido(p) : void criarPrivada(p),
              style: ({ pressed }) => [estilos8.pessoa, pressed && { backgroundColor: "rgba(0,0,0,0.05)" }],
              children: [
                modoGrupo && /* @__PURE__ */ jsx9(
                  Ionicons8,
                  {
                    name: marcado ? "checkmark-circle" : "ellipse-outline",
                    size: 22,
                    color: marcado ? tema.primaria : tema.textoSuave
                  }
                ),
                /* @__PURE__ */ jsx9(Avatar, { nome: p.nome ?? p.id_externo, url: p.foto ?? null, tamanho: 44 }),
                /* @__PURE__ */ jsx9(Text8, { style: { flex: 1, fontSize: 15.5, fontWeight: "600", color: tema.texto }, numberOfLines: 1, children: p.nome ?? p.id_externo })
              ]
            }
          );
        },
        ListEmptyComponent: /* @__PURE__ */ jsx9(Text8, { style: { padding: 24, textAlign: "center", color: tema.textoSuave }, children: busca.trim() ? aPesquisar ? "A pesquisar\u2026" : "Sem resultados." : "Sem sugest\xF5es ainda \u2014 usa a pesquisa." }),
        contentContainerStyle: { paddingBottom: modoGrupo ? 96 : 24 }
      }
    ),
    modoGrupo && /* @__PURE__ */ jsx9(View8, { style: [estilos8.rodapeGrupo, { paddingBottom: Math.max(insets.bottom, 12) }], children: /* @__PURE__ */ jsx9(
      Pressable8,
      {
        disabled: escolhidos.size < 2 || aCriar,
        onPress: () => void criarGrupo(),
        style: [estilos8.botaoCriar, { backgroundColor: tema.primaria, opacity: escolhidos.size >= 2 && !aCriar ? 1 : 0.4 }],
        children: aCriar ? /* @__PURE__ */ jsx9(ActivityIndicator4, { color: tema.primariaContraste }) : /* @__PURE__ */ jsxs8(Text8, { style: { color: tema.primariaContraste, fontWeight: "700", fontSize: 15 }, children: [
          "Criar grupo (",
          escolhidos.size,
          ")"
        ] })
      }
    ) })
  ] });
}
var estilos8 = StyleSheet8.create({
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

// src/chamadas.tsx
import { Ionicons as Ionicons9 } from "@expo/vector-icons";
import { useSafeAreaInsets as useSafeAreaInsets5 } from "react-native-safe-area-context";
import { createContext as createContext2, useCallback as useCallback4, useContext as useContext2, useEffect as useEffect11, useMemo as useMemo8, useRef as useRef9, useState as useState10 } from "react";
import { AppState as AppState3, Modal as Modal3, Platform as Platform3, Pressable as Pressable9, StatusBar as StatusBar3, StyleSheet as StyleSheet9, Text as Text9, useWindowDimensions as useWindowDimensions3, View as View9 } from "react-native";
import { Fragment as Fragment2, jsx as jsx10, jsxs as jsxs9 } from "react/jsx-runtime";
var alcanceGlobalChamadas = globalThis;
var Ctx = alcanceGlobalChamadas.__makaChatChamadasCtx ??= createContext2(null);
function useChamadas() {
  const ctx = useContext2(Ctx);
  if (!ctx) throw new Error("useChamadas requer <ChamadasProvider>");
  return ctx;
}
function useChamadasOpcional() {
  return useContext2(Ctx);
}
var globalsRegistados = false;
async function iniciarServicoChamada(titulo) {
  if (Platform3.OS !== "android") return;
  try {
    if (obterPushMakaChat()?.configChamadas?.()?.servicoChamadaAtiva) return;
  } catch {
  }
  const notifee = obterNotifee();
  if (!notifee?.displayNotification) return;
  try {
    await notifee.createChannel({ id: "makachat_chamada_ativa", name: "Chamada em curso", importance: 3 });
    await notifee.displayNotification({
      id: "makachat_chamada_ativa",
      title: "Chamada em curso",
      body: titulo,
      android: {
        channelId: "makachat_chamada_ativa",
        asForegroundService: true,
        ongoing: true,
        smallIcon: "ic_launcher",
        pressAction: { id: "default" }
      }
    });
  } catch {
  }
}
async function pararServicoChamada() {
  if (Platform3.OS !== "android") return;
  const notifee = obterNotifee();
  await notifee?.stopForegroundService?.().catch?.(() => void 0);
  await notifee?.cancelNotification?.("makachat_chamada_ativa").catch?.(() => void 0);
}
function ChamadasProvider({ children }) {
  const { api, engine, subscreverChamadas } = useMakaChat();
  const tema = useTema();
  const livekit = useMemo8(() => obterLiveKit(), []);
  const lkClient = useMemo8(() => obterLiveKitClient(), []);
  const suportado = !!livekit && !!lkClient;
  const podePartilhaEcra = useFuncionalidadeAtiva("chamadas.partilha_ecra");
  const [ativa, setAtiva] = useState10(null);
  const [conversa, setConversa] = useState10(null);
  const [tiles, setTiles] = useState10([]);
  const [inicioEm, setInicioEm] = useState10(null);
  const [erro, setErro] = useState10(null);
  const [mudo, setMudo] = useState10(false);
  const [camara, setCamara] = useState10(false);
  const [altifalante, setAltifalante] = useState10(true);
  const [ecra, setEcra] = useState10(false);
  const [minimizada, setMinimizada] = useState10(false);
  const room = useRef9(null);
  const falhada = useRef9(false);
  const faseRef = useRef9(null);
  const facing = useRef9("user");
  const conversaRef = useRef9(null);
  const desligarRef = useRef9(async () => void 0);
  const sozinhoTimer = useRef9(null);
  const chamadaIdRef = useRef9(null);
  const atendendoRef = useRef9(null);
  const retomandoRef = useRef9(false);
  useEffect11(() => {
    chamadaIdRef.current = ativa?.chamada.id ?? null;
  }, [ativa]);
  useEffect11(() => {
    faseRef.current = ativa?.fase ?? null;
    if (ativa?.fase === "a_ligar") comecarToque("ligar");
    else if (ativa?.fase === "a_receber") comecarToque("receber");
    else pararToque();
    return pararToque;
  }, [ativa?.fase]);
  useEffect11(() => {
    const push = obterPushMakaChat();
    if (!push?.configChamadas) return;
    try {
      if (!push.configChamadas()?.servicoChamadaAtiva) return;
      if (ativa?.fase === "em_curso") {
        const nome = ativa.iniciador?.nome ?? conversa?.titulo ?? "Chamada";
        const foto = ativa.iniciador?.foto_url ?? conversa?.foto_url ?? null;
        push.iniciarChamadaAtiva({ nome, foto, tipo: ativa.chamada.tipo });
      } else {
        push.pararChamadaAtiva();
      }
    } catch {
    }
  }, [ativa?.fase]);
  const limpar = useCallback4(() => {
    if (sozinhoTimer.current) {
      clearTimeout(sozinhoTimer.current);
      sozinhoTimer.current = null;
    }
    void room.current?.disconnect?.();
    room.current = null;
    falhada.current = false;
    atendendoRef.current = null;
    if (livekit?.AudioSession) void livekit.AudioSession.stopAudioSession?.();
    setAtiva(null);
    setConversa(null);
    setTiles([]);
    setInicioEm(null);
    setErro(null);
    setMudo(false);
    setCamara(false);
    setEcra(false);
    setMinimizada(false);
    void pararServicoChamada();
  }, [livekit]);
  const comecarTimer = useCallback4(() => {
    setInicioEm((atual) => atual ?? Date.now());
    void iniciarServicoChamada(conversa?.titulo ?? "MakaChat");
  }, [conversa?.titulo]);
  const carregarConversa = useCallback4(
    async (conversaId) => {
      const local = await engine.storage.obterConversa(conversaId);
      setConversa(local);
      if (local) return;
      const remota = await api.obterConversa(conversaId).catch(() => null);
      if (remota?.conversa) setConversa(remota.conversa);
    },
    [engine, api]
  );
  const sincronizarTiles = useCallback4(() => {
    const r = room.current;
    if (!r || !lkClient) return;
    const Track = lkClient.Track;
    const novos = [];
    const proporcaoDe = (pub) => {
      const dim = pub?.dimensions ?? pub?.track?.mediaStreamTrack?.getSettings?.();
      return dim?.width && dim?.height ? dim.width / dim.height : null;
    };
    const localCam = r.localParticipant?.getTrackPublication?.(Track.Source.Camera);
    novos.push({
      chave: "local",
      local: true,
      nome: "Tu",
      trackRef: localCam?.track ? { participant: r.localParticipant, publication: localCam, source: Track.Source.Camera } : null,
      proporcao: proporcaoDe(localCam)
    });
    for (const participante of r.remoteParticipants?.values?.() ?? []) {
      const cam = participante.getTrackPublication?.(Track.Source.Camera);
      const ecra2 = participante.getTrackPublication?.(Track.Source.ScreenShare);
      const ecraVivo = ecra2?.isSubscribed && ecra2.track && !ecra2.isMuted ? ecra2 : null;
      const camViva = cam?.track && !cam.isMuted ? cam : null;
      const pub = ecraVivo ?? camViva;
      novos.push({
        chave: participante.identity,
        local: false,
        nome: participante.name || "Participante",
        trackRef: pub ? { participant: participante, publication: pub, source: pub === ecraVivo ? Track.Source.ScreenShare : Track.Source.Camera } : null,
        proporcao: proporcaoDe(pub),
        pausado: !pub && !!cam?.track && !!cam.isMuted
      });
    }
    setTiles(novos);
  }, [lkClient]);
  const ligarSala = useCallback4(
    async (token, wsUrl, video) => {
      if (!suportado) {
        setErro("Chamadas indispon\xEDveis \u2014 a app n\xE3o inclui o m\xF3dulo LiveKit.");
        return false;
      }
      if (!globalsRegistados) {
        livekit.registerGlobals();
        globalsRegistados = true;
      }
      await livekit.AudioSession.configureAudio?.({
        android: { audioTypeOptions: livekit.AndroidAudioTypePresets?.communication }
      }).catch(() => void 0);
      await livekit.AudioSession.startAudioSession?.().catch(() => void 0);
      const r = new lkClient.Room({
        adaptiveStream: true,
        dynacast: true,
        reconnectPolicy: {
          nextRetryDelayInMs: (contexto) => contexto.elapsedMs > 9e4 ? null : Math.min(500 * 2 ** contexto.retryCount, 1e4)
        }
      });
      room.current = r;
      const RoomEvent = lkClient.RoomEvent;
      r.on(RoomEvent.TrackSubscribed, sincronizarTiles);
      r.on(RoomEvent.TrackUnsubscribed, sincronizarTiles);
      r.on(RoomEvent.LocalTrackPublished, sincronizarTiles);
      r.on(RoomEvent.LocalTrackUnpublished, sincronizarTiles);
      r.on(RoomEvent.TrackMuted, sincronizarTiles);
      r.on(RoomEvent.TrackUnmuted, sincronizarTiles);
      r.on(RoomEvent.ParticipantConnected, sincronizarTiles);
      r.on(RoomEvent.ParticipantDisconnected, sincronizarTiles);
      const verificarSozinho = () => {
        if (conversaRef.current?.tipo === "grupo" || faseRef.current !== "em_curso") return;
        const remotosLigados = r.remoteParticipants?.size ?? r.participants?.size ?? 0;
        if (remotosLigados === 0) {
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
      r.on(RoomEvent.ParticipantConnected, verificarSozinho);
      r.on(RoomEvent.ParticipantDisconnected, verificarSozinho);
      try {
        await r.connect(wsUrl, token);
      } catch (e) {
        console.error("[makachat] liga\xE7\xE3o LiveKit falhou:", e);
        setErro("N\xE3o foi poss\xEDvel ligar ao servidor de chamadas.");
        return false;
      }
      try {
        await r.localParticipant.setMicrophoneEnabled(true);
        if (video) {
          await r.localParticipant.setCameraEnabled(true);
          setCamara(true);
        }
      } catch (e) {
        console.error("[makachat] media falhou:", e);
        setErro(video ? "Sem acesso \xE0 c\xE2mara/microfone \u2014 verifica as permiss\xF5es." : "Sem acesso ao microfone \u2014 verifica as permiss\xF5es.");
        return false;
      }
      sincronizarTiles();
      verificarSozinho();
      return true;
    },
    [suportado, livekit, lkClient, sincronizarTiles]
  );
  useEffect11(() => {
    const sub = AppState3.addEventListener("change", (estado) => {
      const r = room.current;
      if (!r || !lkClient) return;
      if (estado !== "active" && camara) {
        void r.localParticipant?.setCameraEnabled?.(false);
      } else if (estado === "active" && camara) {
        void r.localParticipant?.setCameraEnabled?.(true);
      }
    });
    return () => sub.remove();
  }, [camara, lkClient]);
  useEffect11(
    () => subscreverChamadas((evento) => {
      if (evento.evento === "iniciada") {
        if (chamadaIdRef.current === evento.chamada.id) {
          setAtiva((a) => a?.fase === "a_receber" ? { ...a, chamada: evento.chamada, iniciador: evento.iniciador } : a);
          return;
        }
        void engine.minhaIdentidadeId(evento.chamada.conversa_id).then((minha) => {
          if (minha && evento.chamada.iniciador_identidade_id === minha) return;
          setAtiva({ chamada: evento.chamada, fase: "a_receber", iniciador: evento.iniciador });
          void carregarConversa(evento.chamada.conversa_id);
        });
      } else if (evento.evento === "atendida") {
        if (faseRef.current === "a_ligar" || faseRef.current === "em_curso") {
          setAtiva((a) => a ? { ...a, fase: "em_curso", chamada: evento.chamada } : a);
          comecarTimer();
        }
      } else if (evento.evento === "participante_saiu") {
      } else if (!falhada.current) {
        limpar();
      }
    }),
    [subscreverChamadas, engine, limpar, comecarTimer, carregarConversa]
  );
  const falhar = useCallback4(
    async (chamadaId) => {
      falhada.current = true;
      await api.terminarChamada(chamadaId).catch(() => void 0);
      setAtiva((a) => a ? { ...a, fase: "falhada" } : a);
    },
    [api]
  );
  const iniciar = useCallback4(
    async (conversaId, tipo) => {
      if (!suportado) return;
      const r = await api.iniciarChamada(conversaId, tipo);
      setAtiva({ chamada: r.chamada, fase: "a_ligar" });
      void carregarConversa(conversaId);
      if (r.livekit_token && r.ws_url) {
        const ok = await ligarSala(r.livekit_token, r.ws_url, tipo === "video");
        if (!ok) await falhar(r.chamada.id);
      }
    },
    [suportado, api, ligarSala, falhar, carregarConversa]
  );
  const entrar = useCallback4(
    async (chamadaId, tipo) => {
      if (!suportado) return;
      atendendoRef.current = chamadaId;
      const r = await api.atenderChamada(chamadaId);
      setAtiva({ chamada: r.chamada, fase: "em_curso" });
      void carregarConversa(r.chamada.conversa_id);
      if (r.livekit_token && r.ws_url) {
        const ok = await ligarSala(r.livekit_token, r.ws_url, tipo === "video");
        if (atendendoRef.current !== chamadaId) {
          void room.current?.disconnect?.();
          room.current = null;
          return;
        }
        if (!ok) {
          await falhar(chamadaId);
          return;
        }
      }
      comecarTimer();
    },
    [suportado, api, ligarSala, falhar, comecarTimer, carregarConversa]
  );
  const tocarEmApp = useCallback4(
    async (chamadaId, chamadaTipo, conversaId) => {
      if (chamadaIdRef.current === chamadaId) return;
      void carregarConversa(conversaId);
      setAtiva({
        chamada: {
          id: chamadaId,
          conversa_id: conversaId,
          iniciador_identidade_id: "",
          tipo: chamadaTipo,
          estado: "a_tocar",
          iniciada_em: (/* @__PURE__ */ new Date()).toISOString(),
          atendida_em: null,
          terminada_em: null,
          duracao_segundos: null
        },
        fase: "a_receber"
      });
    },
    [carregarConversa]
  );
  const retomarPendente = useCallback4(async () => {
    const push = obterPushMakaChat();
    if (!push?.obterChamadaPendente || retomandoRef.current) return;
    retomandoRef.current = true;
    try {
      const pendente = await push.obterChamadaPendente().catch(() => null);
      if (!pendente) return;
      push.cancelarNotificacaoChamada?.(pendente.chamada_id);
      if (pendente.acao === "rejeitar") {
        await api.rejeitarChamada(pendente.chamada_id).catch(() => void 0);
        return;
      }
      if (pendente.acao === "atender") {
        await entrar(pendente.chamada_id, pendente.chamada_tipo).catch(() => void 0);
        return;
      }
      await tocarEmApp(pendente.chamada_id, pendente.chamada_tipo, pendente.conversa_id);
    } finally {
      retomandoRef.current = false;
    }
  }, [api, entrar, tocarEmApp]);
  useEffect11(() => {
    void retomarPendente();
    const sub = AppState3.addEventListener("change", (estado) => {
      if (estado === "active") void retomarPendente();
    });
    return () => sub.remove();
  }, [retomarPendente]);
  useEffect11(() => {
    const push = obterPushMakaChat();
    if (!push?.aoChamadaPush) return;
    const sub = push.aoChamadaPush((chamada) => {
      if (chamada.acao === "parar") {
        if (atendendoRef.current === chamada.chamada_id) return;
        if (chamadaIdRef.current === chamada.chamada_id && faseRef.current === "a_receber") limpar();
        return;
      }
      if (chamada.acao !== "tocar") return;
      if (chamadaIdRef.current === chamada.chamada_id) return;
      push.cancelarNotificacaoChamada?.(chamada.chamada_id);
      void tocarEmApp(chamada.chamada_id, chamada.chamada_tipo, chamada.conversa_id);
    });
    push.ouvinteChamadasPronto?.(true);
    return () => {
      push.ouvinteChamadasPronto?.(false);
      sub.remove();
    };
  }, [limpar, tocarEmApp]);
  const atender = async () => {
    if (!ativa) return;
    const r = await api.atenderChamada(ativa.chamada.id);
    if (r.livekit_token && r.ws_url) {
      const ok = await ligarSala(r.livekit_token, r.ws_url, ativa.chamada.tipo === "video");
      if (!ok) {
        await falhar(ativa.chamada.id);
        return;
      }
    }
    setAtiva({ ...ativa, fase: "em_curso", chamada: r.chamada });
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
  const alternarCamara = async () => {
    const novo = !camara;
    if (novo && ecra) {
      setEcra(false);
      await room.current?.localParticipant?.setScreenShareEnabled?.(false).catch?.(() => void 0);
    }
    setCamara(novo);
    await room.current?.localParticipant?.setCameraEnabled?.(novo).catch(() => void 0);
  };
  const trocarCamara = async () => {
    const Track = lkClient?.Track;
    const pub = room.current?.localParticipant?.getTrackPublication?.(Track?.Source?.Camera);
    const track = pub?.track;
    if (!track?.restartTrack) return;
    facing.current = facing.current === "user" ? "environment" : "user";
    await track.restartTrack({ facingMode: facing.current }).catch(() => void 0);
  };
  const alternarEcra = async () => {
    const novo = !ecra;
    if (novo && camara) {
      setCamara(false);
      await room.current?.localParticipant?.setCameraEnabled?.(false).catch(() => void 0);
    }
    setEcra(novo);
    await room.current?.localParticipant?.setScreenShareEnabled?.(novo).catch?.(() => {
      setEcra(!novo);
    });
  };
  const alternarAltifalante = async () => {
    const novo = !altifalante;
    setAltifalante(novo);
    await livekit?.AudioSession?.selectAudioOutput?.(novo ? "speaker" : "earpiece").catch(() => void 0);
  };
  const valor = useMemo8(
    () => ({ iniciar, entrar, retomarPendente, ativa, suportado }),
    [iniciar, entrar, retomarPendente, ativa, suportado]
  );
  return /* @__PURE__ */ jsxs9(Ctx.Provider, { value: valor, children: [
    children,
    ativa && !minimizada && /* @__PURE__ */ jsx10(
      EcraChamada,
      {
        ativa,
        conversa,
        tiles,
        inicioEm,
        erro,
        mudo,
        camara,
        altifalante,
        ecra,
        livekit,
        aoAtender: () => void atender(),
        aoDesligar: () => void desligar(),
        aoMudo: () => {
          const m = !mudo;
          setMudo(m);
          void room.current?.localParticipant?.setMicrophoneEnabled?.(!m).catch(() => void 0);
        },
        aoCamara: () => void alternarCamara(),
        aoTrocarCamara: () => void trocarCamara(),
        aoAltifalante: () => void alternarAltifalante(),
        aoEcra: Platform3.OS === "android" && podePartilhaEcra ? () => void alternarEcra() : void 0,
        aoMinimizar: () => setMinimizada(true),
        tema
      }
    ),
    ativa && minimizada && /* @__PURE__ */ jsxs9(Pressable9, { onPress: () => setMinimizada(false), style: estilos9.pill, children: [
      /* @__PURE__ */ jsx10(Avatar, { nome: conversa?.titulo ?? "?", url: conversa?.foto_url, tamanho: 28 }),
      /* @__PURE__ */ jsx10(Text9, { style: { color: "#fff", fontWeight: "700", fontSize: 13 }, children: ativa.fase === "em_curso" && inicioEm ? /* @__PURE__ */ jsx10(Duracao, { desde: inicioEm }) : "Chamada\u2026" }),
      /* @__PURE__ */ jsx10(Ionicons9, { name: "expand-outline", size: 16, color: "rgba(255,255,255,0.8)" })
    ] })
  ] });
}
function EcraChamada({ ativa, conversa, tiles, inicioEm, erro, mudo, camara, altifalante, ecra, livekit, aoAtender, aoDesligar, aoMudo, aoCamara, aoTrocarCamara, aoAltifalante, aoEcra, aoMinimizar, tema }) {
  const { width, height } = useWindowDimensions3();
  const insets = useSafeAreaInsets5();
  const [alturaBandeja, setAlturaBandeja] = useState10(0);
  const acimaControlos = insets.bottom + 24 + (alturaBandeja || 84) + 14;
  const video = ativa.chamada.tipo === "video";
  const titulo = ativa.fase === "a_receber" ? ativa.iniciador?.nome ?? conversa?.titulo ?? "Algu\xE9m" : conversa?.titulo ?? "Chamada";
  const foto = ativa.fase === "a_receber" ? ativa.iniciador?.foto_url ?? null : conversa?.foto_url ?? null;
  const VideoTrack = livekit?.VideoTrack;
  const remotos = tiles.filter((t) => !t.local && t.trackRef);
  const local = tiles.find((t) => t.local && t.trackRef);
  const remotoPausado = tiles.some((t) => !t.local && t.pausado);
  const alturaPip = local?.proporcao ? Math.min(200, Math.max(84, Math.round(112 / local.proporcao))) : 168;
  const emCurso = ativa.fase === "em_curso";
  const subtitulo = ativa.fase === "falhada" ? "Chamada falhada" : ativa.fase === "a_ligar" ? "A chamar\u2026" : ativa.fase === "a_receber" ? `Chamada de ${video ? "v\xEDdeo" : "voz"}` : inicioEm ? void 0 : "A ligar\u2026";
  return /* @__PURE__ */ jsxs9(Modal3, { visible: true, animationType: "slide", onRequestClose: aoMinimizar, children: [
    /* @__PURE__ */ jsx10(StatusBar3, { animated: true, barStyle: "light-content" }),
    /* @__PURE__ */ jsxs9(View9, { style: { flex: 1, backgroundColor: "#0f172a" }, children: [
      emCurso && video && VideoTrack && remotos.length > 0 && /* @__PURE__ */ jsx10(View9, { style: { ...StyleSheet9.absoluteFillObject, flexDirection: "row", flexWrap: "wrap" }, children: remotos.map((t) => /* @__PURE__ */ jsxs9(View9, { style: { width: remotos.length === 1 ? width : width / 2, height: remotos.length <= 2 ? height : height / Math.ceil(remotos.length / 2) }, children: [
        /* @__PURE__ */ jsx10(VideoTrack, { trackRef: t.trackRef, style: { flex: 1 }, objectFit: "contain", zOrder: 0 }),
        /* @__PURE__ */ jsx10(Text9, { style: estilos9.nomeTile, children: t.nome })
      ] }, t.chave)) }),
      emCurso && video && VideoTrack && local && /* @__PURE__ */ jsxs9(View9, { style: [estilos9.pip, { bottom: acimaControlos, height: alturaPip }], children: [
        /* @__PURE__ */ jsx10(VideoTrack, { trackRef: local.trackRef, style: { flex: 1 }, objectFit: "contain", mirror: true, zOrder: 1 }),
        !camara && /* @__PURE__ */ jsx10(View9, { style: estilos9.pipOff, children: /* @__PURE__ */ jsx10(Ionicons9, { name: "videocam-off", size: 22, color: "rgba(255,255,255,0.8)" }) })
      ] }),
      (!emCurso || !video || remotos.length === 0) && /* @__PURE__ */ jsxs9(View9, { style: estilos9.centro, children: [
        ativa.fase === "a_receber" || ativa.fase === "a_ligar" ? /* @__PURE__ */ jsx10(Pulso, { children: /* @__PURE__ */ jsx10(Avatar, { nome: titulo, url: foto, tamanho: 132 }) }) : /* @__PURE__ */ jsx10(Avatar, { nome: titulo, url: foto, tamanho: 132 }),
        /* @__PURE__ */ jsx10(Text9, { style: { color: "#fff", fontSize: 28, fontWeight: "800", marginTop: 20, textAlign: "center", paddingHorizontal: 32 }, children: titulo }),
        /* @__PURE__ */ jsx10(Text9, { style: { color: "rgba(255,255,255,0.7)", fontSize: 16, marginTop: 8, textAlign: "center" }, children: subtitulo ?? (inicioEm ? /* @__PURE__ */ jsx10(Duracao, { desde: inicioEm }) : null) }),
        emCurso && remotoPausado && /* @__PURE__ */ jsxs9(View9, { style: estilos9.pausaPill, children: [
          /* @__PURE__ */ jsx10(Ionicons9, { name: "videocam-off", size: 14, color: "rgba(255,255,255,0.75)" }),
          /* @__PURE__ */ jsx10(Text9, { style: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: "600" }, children: "C\xE2mara em pausa" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs9(View9, { style: [estilos9.topo, { paddingTop: insets.top + 8 }], children: [
        /* @__PURE__ */ jsx10(Pressable9, { onPress: aoMinimizar, style: { padding: 8 }, children: /* @__PURE__ */ jsx10(Ionicons9, { name: "chevron-down", size: 26, color: "#fff" }) }),
        emCurso && inicioEm && video && remotos.length > 0 && /* @__PURE__ */ jsx10(Text9, { style: { color: "#fff", fontWeight: "700" }, children: /* @__PURE__ */ jsx10(Duracao, { desde: inicioEm }) }),
        /* @__PURE__ */ jsx10(View9, { style: { width: 42 } })
      ] }),
      erro && /* @__PURE__ */ jsx10(View9, { style: [estilos9.erro, { bottom: acimaControlos }], children: /* @__PURE__ */ jsx10(Text9, { style: { color: "#fff", fontWeight: "700", fontSize: 13, textAlign: "center" }, children: erro }) }),
      ativa.fase === "a_receber" ? (
        // incoming: dois botões grandes com rótulo, afastados
        /* @__PURE__ */ jsxs9(View9, { style: [estilos9.controlosReceber, { bottom: insets.bottom + 36 }], children: [
          /* @__PURE__ */ jsx10(Botao, { icone: "call", cor: "#ef4444", aoTocar: aoDesligar, grande: true, rodado: true, rotulo: "Recusar" }),
          /* @__PURE__ */ jsx10(Pulso, { children: /* @__PURE__ */ jsx10(Botao, { icone: "call", cor: "#10b981", aoTocar: aoAtender, grande: true, rotulo: "Atender" }) })
        ] })
      ) : ativa.fase === "falhada" ? /* @__PURE__ */ jsx10(View9, { style: [estilos9.controlosReceber, { bottom: insets.bottom + 36 }], children: /* @__PURE__ */ jsx10(Botao, { icone: "close", aoTocar: aoDesligar, rotulo: "Fechar" }) }) : (
        // em curso: bandeja arredondada com o desligar integrado
        /* @__PURE__ */ jsxs9(
          View9,
          {
            style: [estilos9.bandeja, { bottom: insets.bottom + 24 }],
            onLayout: (e) => setAlturaBandeja(e.nativeEvent.layout.height),
            children: [
              /* @__PURE__ */ jsx10(Botao, { icone: mudo ? "mic-off" : "mic", ativo: mudo, aoTocar: aoMudo }),
              video && /* @__PURE__ */ jsx10(Botao, { icone: camara ? "videocam" : "videocam-off", ativo: !camara, aoTocar: aoCamara }),
              video && camara && /* @__PURE__ */ jsx10(Botao, { icone: "camera-reverse-outline", aoTocar: aoTrocarCamara }),
              /* @__PURE__ */ jsx10(Botao, { icone: altifalante ? "volume-high" : "volume-low", ativo: altifalante, aoTocar: aoAltifalante }),
              aoEcra && /* @__PURE__ */ jsx10(Botao, { icone: ecra ? "stop-circle-outline" : "share-outline", ativo: ecra, aoTocar: aoEcra }),
              /* @__PURE__ */ jsx10(Botao, { icone: "call", cor: "#ef4444", aoTocar: aoDesligar, rodado: true })
            ]
          }
        )
      )
    ] })
  ] });
}
function Botao({ icone, cor, aoTocar, grande, rodado, ativo, rotulo }) {
  const lado = grande ? 76 : 60;
  const fundo = cor ?? (ativo ? "#ffffff" : "rgba(255,255,255,0.18)");
  const corIcone = ativo && !cor ? "#0f172a" : "#fff";
  const circulo = /* @__PURE__ */ jsx10(
    Pressable9,
    {
      onPress: aoTocar,
      style: ({ pressed }) => ({
        width: lado,
        height: lado,
        borderRadius: lado / 2,
        backgroundColor: fundo,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.8 : 1
      }),
      children: /* @__PURE__ */ jsx10(
        Ionicons9,
        {
          name: icone,
          size: grande ? 34 : 26,
          color: corIcone,
          style: rodado ? { transform: [{ rotate: "135deg" }] } : void 0
        }
      )
    }
  );
  if (!rotulo) return circulo;
  return /* @__PURE__ */ jsxs9(View9, { style: { alignItems: "center", gap: 10 }, children: [
    circulo,
    /* @__PURE__ */ jsx10(Text9, { style: { color: "#fff", fontSize: 14, fontWeight: "600" }, children: rotulo })
  ] });
}
function Duracao({ desde }) {
  const [, forcar] = useState10(0);
  useEffect11(() => {
    const timer = setInterval(() => forcar((n) => n + 1), 1e3);
    return () => clearInterval(timer);
  }, []);
  return /* @__PURE__ */ jsx10(Fragment2, { children: duracaoMmSs(Math.max(0, Math.floor((Date.now() - desde) / 1e3))) });
}
var estilos9 = StyleSheet9.create({
  centro: { ...StyleSheet9.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  topo: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 52, paddingHorizontal: 10 },
  pip: { position: "absolute", right: 14, width: 112, height: 168, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  // câmara desligada: tapa o último frame SEM desmontar a SurfaceView
  pipOff: { ...StyleSheet9.absoluteFillObject, backgroundColor: "#1e293b", alignItems: "center", justifyContent: "center" },
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

export {
  SqliteStorage,
  obterShareIntent,
  obterNotifee,
  obterPushMakaChat,
  tocarSom,
  comecarToque,
  pararToque,
  MakaChatProvider,
  useMakaChat,
  useMakaChatOpcional,
  useTema,
  useVersaoChat,
  useConversas,
  useMensagens,
  useEnviarMensagem,
  useTypingConversa,
  usePresenca,
  useFuncionalidadeAtiva,
  useLigacao,
  useSemLigacao,
  useMensagemRecebida,
  useTotalNaoLidas,
  useTotalNaoLidasOpcional,
  ListaPerformante,
  Avatar,
  NomeComBadge,
  horaCurta,
  rotuloDia,
  Sheet,
  ConversasScreen,
  previewConversa,
  ReprodutorAudio,
  GravadorAudio,
  tipoDeMime,
  escolherFotosEVideos,
  escolherFicheiro,
  enviarAnexoLocal,
  registarFicheiroLocal,
  LobbyFotos,
  Galeria,
  VisualizadorVideo,
  CartaoRegistoChamada,
  Bolha,
  ChatScreen,
  InfoConversaScreen,
  NovaConversaScreen,
  useChamadas,
  useChamadasOpcional,
  ChamadasProvider
};
//# sourceMappingURL=chunk-KASK5CUP.js.map