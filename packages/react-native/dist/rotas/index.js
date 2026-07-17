import {
  ChatScreen,
  ConversasScreen,
  InfoConversaScreen,
  NovaConversaScreen,
  obterNotifee,
  obterPushMakaChat,
  useChamadasOpcional,
  useMakaChatOpcional,
  useTema
} from "../chunk-GM2PV5FE.js";

// src/rotas/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { jsx, jsxs } from "react/jsx-runtime";
function barraDoFundo(fundo) {
  const hex = fundo.replace("#", "");
  if (hex.length < 6) return "escura";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminancia < 0.5 ? "clara" : "escura";
}
var voltar = () => router.canGoBack() ? router.back() : router.replace("/");
function LayoutChatMakaChat({ screenOptions }) {
  return /* @__PURE__ */ jsx(Stack, { screenOptions: { headerShown: false, animation: "slide_from_right", ...screenOptions } });
}
function RotaConversa() {
  const { id } = useLocalSearchParams();
  const ctx = useMakaChatOpcional();
  const chamadas = useChamadasOpcional();
  const emFoco = useIsFocused();
  useEffect(() => {
    if (!id || !emFoco) return;
    void obterNotifee()?.cancelNotification?.(`mkm_${id}`)?.catch?.(() => void 0);
    try {
      obterPushMakaChat()?.cancelarNotificacaoMensagens?.(id);
    } catch {
    }
  }, [id, emFoco]);
  if (!id || !ctx) return null;
  const headerCustom = ctx.renderHeaderConversa;
  return /* @__PURE__ */ jsx(
    ChatScreen,
    {
      conversaId: id,
      chamadas: chamadas ?? void 0,
      emFoco,
      barraEstado: headerCustom ? null : barraDoFundo(ctx.tema.fundo),
      renderHeader: headerCustom,
      onVoltar: voltar,
      onAbrirInfo: (c) => router.push(`/chat-info/${c.id}`),
      onAbrirOutraConversa: (conversaId) => router.replace(`/chat/${conversaId}`)
    }
  );
}
function RotaInfoConversa() {
  const { id } = useLocalSearchParams();
  const ctx = useMakaChatOpcional();
  if (!id || !ctx) return null;
  return /* @__PURE__ */ jsx(
    InfoConversaScreen,
    {
      conversaId: id,
      onVoltar: voltar,
      onSaiu: () => router.replace("/"),
      onAbrirOutraConversa: (conversaId) => router.replace(`/chat/${conversaId}`)
    }
  );
}
function RotaNovaConversa() {
  const ctx = useMakaChatOpcional();
  if (!ctx) return null;
  return /* @__PURE__ */ jsx(
    NovaConversaScreen,
    {
      onVoltar: voltar,
      onCriada: (c) => router.replace(`/chat/${c.id}`),
      pesquisarContactos: ctx.pesquisarContactos,
      textoSugestoes: ctx.textoSugestoes
    }
  );
}
function RotaArquivadas() {
  const ctx = useMakaChatOpcional();
  const tema = useTema();
  const insets = useSafeAreaInsets();
  if (!ctx) return null;
  return /* @__PURE__ */ jsxs(View, { style: { flex: 1, backgroundColor: tema.fundo }, children: [
    /* @__PURE__ */ jsxs(View, { style: [estilos.header, { paddingTop: insets.top + 8 }], children: [
      /* @__PURE__ */ jsx(Pressable, { onPress: voltar, hitSlop: 8, style: { padding: 6 }, children: /* @__PURE__ */ jsx(Ionicons, { name: "arrow-back", size: 24, color: tema.texto }) }),
      /* @__PURE__ */ jsx(Text, { style: { fontSize: 18, fontWeight: "700", color: tema.texto }, children: "Arquivadas" })
    ] }),
    /* @__PURE__ */ jsx(
      ConversasScreen,
      {
        arquivadas: true,
        onAbrirConversa: (c) => router.push(`/chat/${c.id}`),
        textoVazio: "Sem conversas arquivadas."
      }
    )
  ] });
}
function RotaPesquisarConversas() {
  const ctx = useMakaChatOpcional();
  const tema = useTema();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const setBuscaRef = useRef(null);
  const mudar = (texto) => {
    setQ(texto);
    setBuscaRef.current?.(texto);
  };
  if (!ctx) return null;
  return /* @__PURE__ */ jsxs(View, { style: { flex: 1, backgroundColor: tema.fundo }, children: [
    /* @__PURE__ */ jsxs(View, { style: [estilos.header, { paddingTop: insets.top + 8 }], children: [
      /* @__PURE__ */ jsx(Pressable, { onPress: voltar, hitSlop: 8, style: { padding: 6 }, children: /* @__PURE__ */ jsx(Ionicons, { name: "arrow-back", size: 24, color: tema.texto }) }),
      /* @__PURE__ */ jsxs(View, { style: [estilos.pesquisa, { backgroundColor: tema.superficie }], children: [
        /* @__PURE__ */ jsx(Ionicons, { name: "search", size: 17, color: tema.textoSuave }),
        /* @__PURE__ */ jsx(
          TextInput,
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
        q.length > 0 && /* @__PURE__ */ jsx(Pressable, { onPress: () => mudar(""), hitSlop: 6, children: /* @__PURE__ */ jsx(Ionicons, { name: "close-circle", size: 18, color: tema.textoSuave }) })
      ] })
    ] }),
    /* @__PURE__ */ jsx(
      ConversasScreen,
      {
        onAbrirConversa: (c) => router.push(`/chat/${c.id}`),
        textoVazio: "Sem resultados.",
        renderTopo: (topo) => {
          setBuscaRef.current = topo.setBusca;
          return null;
        }
      }
    )
  ] });
}
var estilos = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingBottom: 10, paddingHorizontal: 8, gap: 6 },
  pesquisa: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 21, paddingHorizontal: 12, marginRight: 6 }
});
export {
  LayoutChatMakaChat,
  RotaArquivadas,
  RotaConversa,
  RotaInfoConversa,
  RotaNovaConversa,
  RotaPesquisarConversas
};
//# sourceMappingURL=index.js.map