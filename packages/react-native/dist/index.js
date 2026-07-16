import {
  Avatar,
  Bolha,
  CartaoRegistoChamada,
  ChamadasProvider,
  ChatScreen,
  ConversasScreen,
  Galeria,
  GravadorAudio,
  InfoConversaScreen,
  ListaPerformante,
  LobbyFotos,
  MakaChatProvider,
  NomeComBadge,
  NovaConversaScreen,
  ReprodutorAudio,
  Sheet,
  SqliteStorage,
  VisualizadorVideo,
  comecarToque,
  enviarAnexoLocal,
  escolherFicheiro,
  escolherFotosEVideos,
  horaCurta,
  obterNotifee,
  obterPushMakaChat,
  obterShareIntent,
  pararToque,
  previewConversa,
  registarFicheiroLocal,
  rotuloDia,
  tipoDeMime,
  tocarSom,
  useCanalHub,
  useChamadas,
  useChamadasOpcional,
  useConversas,
  useEnviarMensagem,
  useFuncionalidadeAtiva,
  useLigacao,
  useMakaChat,
  useMakaChatOpcional,
  useMensagemRecebida,
  useMensagens,
  usePresenca,
  useSemLigacao,
  useTema,
  useTotalNaoLidas,
  useTotalNaoLidasOpcional,
  useTypingConversa,
  useVersaoChat
} from "./chunk-MNVC4CCI.js";

// src/index.ts
export * from "@hongayetu/makachat-core";

// src/ui/PartilharScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var shareIntentMod = obterShareIntent();
function usePartilhaRecebida() {
  if (!shareIntentMod?.useShareIntent) return null;
  const { hasShareIntent, shareIntent, resetShareIntent } = shareIntentMod.useShareIntent({ resetOnBackground: true });
  return useMemo(() => {
    if (!hasShareIntent) return null;
    const itens = (shareIntent?.files ?? []).map(
      (f) => ({
        uri: f.path,
        mime: f.mimeType ?? "application/octet-stream",
        nome: f.fileName ?? "partilha",
        tipo: tipoDeMime(f.mimeType),
        largura: f.width ?? void 0,
        altura: f.height ?? void 0,
        duracao_segundos: f.duration != null ? Math.round(f.duration / 1e3) : void 0
      })
    );
    const txt = shareIntent?.text ?? shareIntent?.webUrl ?? null;
    if (!itens.length && !txt) return null;
    return { itens, texto: txt, limpar: resetShareIntent };
  }, [hasShareIntent, shareIntent, resetShareIntent]);
}
var chaveDestino = (d) => "conversa" in d ? `c:${d.conversa.id}` : `u:${d.contacto.tipo}:${d.contacto.id_externo}`;
function PartilharParaConversaScreen({ itens, texto, onFechar, onEnviado, pesquisarContactos }) {
  const { api, engine, contactos, identidade } = useMakaChat();
  const tema = useTema();
  const insets = useSafeAreaInsets();
  const conversas = useConversas(false);
  const [busca, setBusca] = useState("");
  const [legenda, setLegenda] = useState(texto ?? "");
  const [escolhidos, setEscolhidos] = useState(/* @__PURE__ */ new Map());
  const [aEnviar, setAEnviar] = useState(false);
  const conversasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? conversas.filter((c) => (c.titulo ?? "").toLowerCase().includes(q)) : conversas;
  }, [conversas, busca]);
  const [resultadosPesquisa, setResultadosPesquisa] = useState(null);
  const contactosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const comConversa = new Set(conversas.flatMap((c) => c.participantes.map((p) => `${p.tipo}:${p.id_externo}`)));
    const base = resultadosPesquisa ?? contactos;
    return base.filter((ct) => !(ct.id_externo === identidade.id && ct.tipo === identidade.tipo)).filter((ct) => !comConversa.has(`${ct.tipo}:${ct.id_externo}`)).filter((ct) => !q || (ct.nome ?? "").toLowerCase().includes(q));
  }, [contactos, conversas, busca, resultadosPesquisa, identidade]);
  React.useEffect(() => {
    const q = busca.trim();
    if (!q || !pesquisarContactos) {
      setResultadosPesquisa(null);
      return;
    }
    let vivo = true;
    const t = setTimeout(() => {
      void pesquisarContactos(q).then((l) => vivo && setResultadosPesquisa(l)).catch(() => vivo && setResultadosPesquisa([]));
    }, 350);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [busca, pesquisarContactos]);
  const alternar = (d) => {
    const chave = chaveDestino(d);
    setEscolhidos((atual) => {
      const novo = new Map(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.set(chave, d);
      return novo;
    });
  };
  const enviarParaConversa = async (conversaId) => {
    const fotosVideos = itens.filter((i) => i.tipo === "foto" || i.tipo === "video");
    const ficheiros = itens.filter((i) => i.tipo === "ficheiro" || i.tipo === "audio");
    let legendaPorUsar = legenda.trim() || void 0;
    const consumirLegenda = () => {
      const l = legendaPorUsar;
      legendaPorUsar = void 0;
      return l;
    };
    if (fotosVideos.length) {
      const anexos = [];
      for (const f of fotosVideos) anexos.push(await enviarAnexoLocal(api, f));
      await engine.enviarMensagem(
        {
          conversa_id: conversaId,
          tipo: fotosVideos.some((f) => f.tipo === "video") ? "video" : "foto",
          anexo_ids: anexos.map((a) => a.id),
          conteudo: consumirLegenda()
        },
        anexos
      );
    }
    for (const f of ficheiros) {
      const anexo = await enviarAnexoLocal(api, f, { duravel: f.tipo === "ficheiro" });
      if (f.tipo === "ficheiro") await registarFicheiroLocal(engine.storage, anexo.id, f.uri);
      await engine.enviarMensagem({ conversa_id: conversaId, tipo: f.tipo, anexo_ids: [anexo.id], conteudo: consumirLegenda() }, [anexo]);
    }
    if (!itens.length && legendaPorUsar) {
      await engine.enviarMensagem({ conversa_id: conversaId, tipo: "texto", conteudo: consumirLegenda() });
    }
  };
  const enviar = async () => {
    if (aEnviar || escolhidos.size === 0) return;
    setAEnviar(true);
    try {
      const ids = [];
      for (const d of escolhidos.values()) {
        const conversaId = "conversa" in d ? d.conversa.id : (await api.criarPrivada(d.contacto)).conversa.id;
        await enviarParaConversa(conversaId);
        ids.push(conversaId);
      }
      await engine.atualizarConversas().catch(() => void 0);
      onEnviado(ids);
    } catch (e) {
      Alert.alert("Falha ao partilhar", e?.message ?? "Tenta de novo.");
    } finally {
      setAEnviar(false);
    }
  };
  const dados = [...conversasFiltradas.map((c) => ({ conversa: c })), ...contactosFiltrados.map((ct) => ({ contacto: ct }))];
  return /* @__PURE__ */ jsxs(View, { style: { flex: 1, backgroundColor: tema.fundo }, children: [
    /* @__PURE__ */ jsxs(View, { style: [estilos.header, { paddingTop: insets.top + 8, backgroundColor: tema.superficie }], children: [
      /* @__PURE__ */ jsx(Pressable, { onPress: onFechar, hitSlop: 8, style: { padding: 6 }, children: /* @__PURE__ */ jsx(Ionicons, { name: "close", size: 26, color: tema.texto }) }),
      /* @__PURE__ */ jsx(Text, { style: { fontSize: 18, fontWeight: "700", color: tema.texto, flex: 1 }, children: "Partilhar com\u2026" })
    ] }),
    itens.length > 0 && /* @__PURE__ */ jsx(ScrollView, { horizontal: true, showsHorizontalScrollIndicator: false, style: { flexGrow: 0 }, contentContainerStyle: estilos.previews, children: itens.map((it, i) => /* @__PURE__ */ jsx(View, { style: [estilos.preview, { backgroundColor: tema.superficie }], children: it.tipo === "foto" || it.tipo === "video" ? /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(Image, { source: { uri: it.uri }, style: estilos.previewImg }),
      it.tipo === "video" && /* @__PURE__ */ jsx(View, { style: estilos.previewBadge, children: /* @__PURE__ */ jsx(Ionicons, { name: "play", size: 14, color: "#fff" }) })
    ] }) : /* @__PURE__ */ jsxs(View, { style: estilos.previewFicheiro, children: [
      /* @__PURE__ */ jsx(Ionicons, { name: it.tipo === "audio" ? "musical-notes" : "document-text", size: 22, color: tema.primaria }),
      /* @__PURE__ */ jsx(Text, { numberOfLines: 2, style: { fontSize: 10.5, color: tema.textoSuave, textAlign: "center" }, children: it.nome })
    ] }) }, i)) }),
    /* @__PURE__ */ jsx(View, { style: [estilos.legenda, { backgroundColor: tema.superficie }], children: /* @__PURE__ */ jsx(
      TextInput,
      {
        value: legenda,
        onChangeText: setLegenda,
        placeholder: "Adicionar legenda\u2026",
        placeholderTextColor: tema.textoSuave,
        style: { flex: 1, color: tema.texto, fontSize: 15, paddingVertical: 6 },
        multiline: true
      }
    ) }),
    /* @__PURE__ */ jsxs(View, { style: [estilos.pesquisa, { backgroundColor: tema.superficie }], children: [
      /* @__PURE__ */ jsx(Ionicons, { name: "search", size: 17, color: tema.textoSuave }),
      /* @__PURE__ */ jsx(
        TextInput,
        {
          value: busca,
          onChangeText: setBusca,
          placeholder: "Pesquisar conversas e pessoas",
          placeholderTextColor: tema.textoSuave,
          style: { flex: 1, color: tema.texto, paddingVertical: 8, fontSize: 15 }
        }
      )
    ] }),
    /* @__PURE__ */ jsx(
      ListaPerformante,
      {
        data: dados,
        keyExtractor: (d) => chaveDestino(d),
        estimatedItemSize: 64,
        renderItem: ({ item: d }) => {
          const marcado = escolhidos.has(chaveDestino(d));
          const conversa = "conversa" in d ? d.conversa : null;
          const nome = conversa ? conversa.titulo ?? "Conversa" : d.contacto.nome ?? "Utilizador";
          const foto = conversa ? conversa.foto_url : d.contacto.foto ?? null;
          const sub = conversa ? previewConversa(conversa) : "Come\xE7ar conversa";
          return /* @__PURE__ */ jsxs(Pressable, { disabled: aEnviar, onPress: () => alternar(d), style: estilos.linha, children: [
            /* @__PURE__ */ jsx(
              Ionicons,
              {
                name: marcado ? "checkmark-circle" : "ellipse-outline",
                size: 22,
                color: marcado ? tema.primaria : tema.textoSuave
              }
            ),
            /* @__PURE__ */ jsx(Avatar, { nome, url: foto, tamanho: 46 }),
            /* @__PURE__ */ jsxs(View, { style: { flex: 1, minWidth: 0 }, children: [
              /* @__PURE__ */ jsx(Text, { numberOfLines: 1, style: { fontSize: 15.5, fontWeight: "600", color: tema.texto }, children: nome }),
              /* @__PURE__ */ jsx(Text, { numberOfLines: 1, style: { fontSize: 12.5, color: tema.textoSuave, marginTop: 1 }, children: sub })
            ] })
          ] });
        },
        ListEmptyComponent: /* @__PURE__ */ jsx(Text, { style: { color: tema.textoSuave, textAlign: "center", marginTop: 40 }, children: "Sem resultados." }),
        contentContainerStyle: { paddingBottom: 96 }
      }
    ),
    escolhidos.size > 0 && /* @__PURE__ */ jsx(View, { style: [estilos.rodape, { paddingBottom: Math.max(insets.bottom, 12), backgroundColor: tema.superficie }], children: /* @__PURE__ */ jsx(
      Pressable,
      {
        disabled: aEnviar,
        onPress: () => void enviar(),
        style: [estilos.botaoEnviar, { backgroundColor: tema.primaria, opacity: aEnviar ? 0.5 : 1 }],
        children: aEnviar ? /* @__PURE__ */ jsx(ActivityIndicator, { color: tema.primariaContraste }) : /* @__PURE__ */ jsxs(Text, { style: { color: tema.primariaContraste, fontWeight: "700", fontSize: 15 }, children: [
          "Enviar (",
          escolhidos.size,
          ")"
        ] })
      }
    ) })
  ] });
}
var estilos = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingBottom: 8 },
  previews: { gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  preview: { width: 72, height: 72, borderRadius: 10, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  previewImg: { width: "100%", height: "100%" },
  previewBadge: { position: "absolute", backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 12, padding: 4 },
  previewFicheiro: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, padding: 6 },
  legenda: { marginHorizontal: 14, marginBottom: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 2 },
  pesquisa: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, paddingHorizontal: 12, marginHorizontal: 14, marginBottom: 8 },
  linha: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  rodape: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10 },
  botaoEnviar: { alignItems: "center", justifyContent: "center", borderRadius: 14, paddingVertical: 13 }
});

// src/push-nativo.ts
async function ligarPushNativo(api, identidade, tokenFcm, plataforma = "android") {
  const push = obterPushMakaChat();
  if (!push?.configurarResposta) return false;
  const registo = await api.registarDispositivo({ plataforma, fornecedor: "fcm", token: tokenFcm });
  if (!registo?.segredo_resposta) return false;
  const sessao = await api.sessao();
  push.configurarResposta({
    api_url: sessao.api_url,
    token: tokenFcm,
    segredo: registo.segredo_resposta,
    meu_nome: identidade.nome
  });
  return true;
}

// src/notificacoes-locais.tsx
import { useEffect } from "react";
import { AppState } from "react-native";
function NotificacoesLocais({ avatarPadrao } = {}) {
  const { engine, subscreverMensagens, estaVisivel } = useMakaChat();
  useEffect(() => {
    const notifee = obterNotifee();
    if (!notifee?.displayNotification) return;
    return subscreverMensagens((mensagem) => {
      if (estaVisivel(mensagem.conversa_id) && AppState.currentState === "active") return;
      void (async () => {
        try {
          const conversa = await engine.storage.obterConversa(mensagem.conversa_id);
          const remetente = conversa?.participantes.find(
            (p) => p.identidade_id === mensagem.remetente_identidade_id
          );
          const grupo = conversa?.tipo === "grupo";
          const nomeRemetente = remetente?.nome ?? "Algu\xE9m";
          const titulo = grupo ? conversa?.titulo ?? "Grupo" : nomeRemetente ?? conversa?.titulo ?? "Nova mensagem";
          const avatar = (grupo ? conversa?.foto_url : remetente?.foto_url) ?? avatarPadrao;
          const canalId = mensagem.silenciosa ? "makachat_silenciosas" : "makachat_mensagens";
          if (mensagem.silenciosa) {
            await notifee.createChannel({ id: "makachat_silenciosas", name: "Eventos silenciosos", importance: 2 });
          } else {
            await notifee.createChannel({ id: "makachat_mensagens", name: "Mensagens", importance: 4 });
          }
          await notifee.displayNotification({
            id: `mkm_${mensagem.conversa_id}`,
            title: titulo,
            body: grupo ? `${nomeRemetente}: ${previewDe(mensagem)}` : previewDe(mensagem),
            data: { makachat: "1", conversa_id: mensagem.conversa_id },
            android: {
              channelId: canalId,
              smallIcon: "ic_launcher",
              // avatar circular estilo WhatsApp (URL remoto suportado)
              ...avatar ? { largeIcon: avatar, circularLargeIcon: true } : {},
              style: {
                type: 4,
                // AndroidStyle.MESSAGING
                person: { name: nomeRemetente, ...avatar && !grupo ? { icon: avatar } : {} },
                ...grupo ? { group: true, title: titulo } : {},
                messages: [
                  {
                    text: previewDe(mensagem),
                    timestamp: Date.parse(mensagem.criada_em) || void 0,
                    person: {
                      name: nomeRemetente,
                      ...remetente?.foto_url ? { icon: remetente.foto_url } : {}
                    }
                  }
                ]
              },
              pressAction: { id: "default" }
            },
            ios: {
              // iOS: attachments exigem ficheiro local — avatar rico fica
              // para a fase NSE; aqui vai título/corpo padrão
            }
          });
        } catch {
        }
      })();
    });
  }, [engine, subscreverMensagens, estaVisivel, avatarPadrao]);
  return null;
}
function previewDe(mensagem) {
  if (mensagem.eliminada) return "Mensagem eliminada";
  switch (mensagem.tipo) {
    case "foto":
      return mensagem.conteudo ?? "\u{1F4F7} Foto";
    case "video":
      return mensagem.conteudo ?? "\u{1F3A5} V\xEDdeo";
    case "audio":
      return "\u{1F3A4} Mensagem de voz";
    case "ficheiro":
      return "\u{1F4CE} Ficheiro";
    case "chamada":
      return `\u{1F4DE} ${mensagem.conteudo ?? "Chamada"}`;
    default:
      return mensagem.conteudo ?? "Nova mensagem";
  }
}
export {
  Avatar,
  Bolha,
  CartaoRegistoChamada,
  ChamadasProvider,
  ChatScreen,
  ConversasScreen,
  Galeria,
  GravadorAudio,
  InfoConversaScreen,
  ListaPerformante,
  LobbyFotos,
  MakaChatProvider,
  NomeComBadge,
  NotificacoesLocais,
  NovaConversaScreen,
  PartilharParaConversaScreen,
  ReprodutorAudio,
  Sheet,
  SqliteStorage,
  VisualizadorVideo,
  comecarToque,
  enviarAnexoLocal,
  escolherFicheiro,
  escolherFotosEVideos,
  horaCurta,
  ligarPushNativo,
  pararToque,
  previewConversa,
  registarFicheiroLocal,
  rotuloDia,
  tipoDeMime,
  tocarSom,
  useCanalHub,
  useChamadas,
  useChamadasOpcional,
  useConversas,
  useEnviarMensagem,
  useFuncionalidadeAtiva,
  useLigacao,
  useMakaChat,
  useMakaChatOpcional,
  useMensagemRecebida,
  useMensagens,
  usePartilhaRecebida,
  usePresenca,
  useSemLigacao,
  useTema,
  useTotalNaoLidas,
  useTotalNaoLidasOpcional,
  useTypingConversa,
  useVersaoChat
};
//# sourceMappingURL=index.js.map