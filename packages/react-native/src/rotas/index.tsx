/**
 * Rotas do chat para expo-router. Este subcaminho (`.../rotas`) importa
 * expo-router — o núcleo do SDK continua agnóstico (telas por callbacks). A app
 * cria um grupo `app/(chat)/` com um `_layout` (LayoutChatMakaChat) e ficheiros
 * de 1 linha que re-exportam estas Rota*; navegação, tema e pesquisa vêm do
 * MakaChatProvider por cima.
 */
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChamadasOpcional } from '../chamadas';
import { obterNotifee, obterPushMakaChat } from '../opcionais';
import { useMakaChatOpcional, useTema } from '../provider';
import { ChatScreen } from '../ui/ChatScreen';
import { ConversasScreen } from '../ui/ConversasScreen';
import { InfoConversaScreen } from '../ui/InfoConversaScreen';
import { NovaConversaScreen } from '../ui/NovaConversaScreen';

/** Barra de estado (texto claro/escuro) a partir da luminância do fundo do tema. */
function barraDoFundo(fundo: string): 'clara' | 'escura' {
    const hex = fundo.replace('#', '');

    if (hex.length < 6) return 'escura';

    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminancia < 0.5 ? 'clara' : 'escura';
}

const voltar = () => (router.canGoBack() ? router.back() : router.replace('/'));

/**
 * Layout do grupo `(chat)`: um Stack sem cabeçalho com transição uniforme.
 * `screenOptions` permite à app afinar (ex.: animação, gestos).
 */
export function LayoutChatMakaChat({ screenOptions }: { screenOptions?: Record<string, unknown> }) {
    return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', ...screenOptions }} />;
}

/** `app/(chat)/chat/[id].tsx` — conversa. */
export function RotaConversa() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const ctx = useMakaChatOpcional();
    const chamadas = useChamadasOpcional();
    const emFoco = useIsFocused();

    // ao abrir/focar a conversa, limpa as notificações dela (local + nativa)
    useEffect(() => {
        if (!id || !emFoco) return;

        void obterNotifee()?.cancelNotification?.(`mkm_${id}`)?.catch?.(() => undefined);

        try {
            obterPushMakaChat()?.cancelarNotificacaoMensagens?.(id);
        } catch {
            // módulo push indisponível
        }
    }, [id, emFoco]);

    if (!id || !ctx) return null;

    // header custom do serviço (ex.: Humbi laranja) via provider — nesse caso o
    // próprio header gere a barra de estado; senão, header padrão + barra derivada
    const headerCustom = ctx.renderHeaderConversa;

    return (
        <ChatScreen
            conversaId={id}
            chamadas={chamadas ?? undefined}
            emFoco={emFoco}
            barraEstado={headerCustom ? null : barraDoFundo(ctx.tema.fundo)}
            renderHeader={headerCustom}
            onVoltar={voltar}
            onAbrirInfo={(c) => router.push(`/chat-info/${c.id}` as never)}
            onAbrirOutraConversa={(conversaId) => router.replace(`/chat/${conversaId}` as never)}
        />
    );
}

/** `app/(chat)/chat-info/[id].tsx` — info da conversa. */
export function RotaInfoConversa() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const ctx = useMakaChatOpcional();

    if (!id || !ctx) return null;

    return (
        <InfoConversaScreen
            conversaId={id}
            onVoltar={voltar}
            onSaiu={() => router.replace('/')}
            onAbrirOutraConversa={(conversaId) => router.replace(`/chat/${conversaId}` as never)}
        />
    );
}

/** `app/(chat)/nova-conversa.tsx` — nova conversa (pesquisa/sugestões do provider). */
export function RotaNovaConversa() {
    const ctx = useMakaChatOpcional();

    if (!ctx) return null;

    return (
        <NovaConversaScreen
            onVoltar={voltar}
            onCriada={(c) => router.replace(`/chat/${c.id}` as never)}
            pesquisarContactos={ctx.pesquisarContactos}
            textoSugestoes={ctx.textoSugestoes}
        />
    );
}

/** `app/(chat)/conversas-arquivadas.tsx` — lista de arquivadas. */
export function RotaArquivadas() {
    const ctx = useMakaChatOpcional();
    const tema = useTema();
    const insets = useSafeAreaInsets();

    if (!ctx) return null;

    return (
        <View style={{ flex: 1, backgroundColor: tema.fundo }}>
            <View style={[estilos.header, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={voltar} hitSlop={8} style={{ padding: 6 }}>
                    <Ionicons name="arrow-back" size={24} color={tema.texto} />
                </Pressable>
                <Text style={{ fontSize: 18, fontWeight: '700', color: tema.texto }}>Arquivadas</Text>
            </View>
            <ConversasScreen
                arquivadas
                onAbrirConversa={(c) => router.push(`/chat/${c.id}` as never)}
                textoVazio="Sem conversas arquivadas."
            />
        </View>
    );
}

/** `app/(chat)/pesquisar-conversas.tsx` — pesquisa dedicada (input no header). */
export function RotaPesquisarConversas() {
    const ctx = useMakaChatOpcional();
    const tema = useTema();
    const insets = useSafeAreaInsets();
    const [q, setQ] = useState('');
    const setBuscaRef = useRef<((q: string) => void) | null>(null);

    const mudar = (texto: string) => {
        setQ(texto);
        setBuscaRef.current?.(texto);
    };

    if (!ctx) return null;

    return (
        <View style={{ flex: 1, backgroundColor: tema.fundo }}>
            <View style={[estilos.header, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={voltar} hitSlop={8} style={{ padding: 6 }}>
                    <Ionicons name="arrow-back" size={24} color={tema.texto} />
                </Pressable>
                <View style={[estilos.pesquisa, { backgroundColor: tema.superficie }]}>
                    <Ionicons name="search" size={17} color={tema.textoSuave} />
                    <TextInput
                        autoFocus
                        value={q}
                        onChangeText={mudar}
                        placeholder="Pesquisar conversas"
                        placeholderTextColor={tema.textoSuave}
                        style={{ flex: 1, fontSize: 15, color: tema.texto, paddingVertical: 9 }}
                        returnKeyType="search"
                    />
                    {q.length > 0 && (
                        <Pressable onPress={() => mudar('')} hitSlop={6}>
                            <Ionicons name="close-circle" size={18} color={tema.textoSuave} />
                        </Pressable>
                    )}
                </View>
            </View>
            <ConversasScreen
                onAbrirConversa={(c) => router.push(`/chat/${c.id}` as never)}
                textoVazio="Sem resultados."
                renderTopo={(topo) => {
                    setBuscaRef.current = topo.setBusca;

                    return null;
                }}
            />
        </View>
    );
}

const estilos = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 10, paddingHorizontal: 8, gap: 6 },
    pesquisa: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 21, paddingHorizontal: 12, marginRight: 6 },
});
