import { Ionicons } from '@expo/vector-icons';
import { AlvoParticipante, Conversa } from '@hongayetu/makachat-core';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConversas } from '../hooks';
import { obterShareIntent } from '../opcionais';
import { useMakaChat, useTema } from '../provider';
import { Avatar, ListaPerformante } from './comum';
import { previewConversa } from './ConversasScreen';
import { enviarAnexoLocal, FicheiroLocal, registarFicheiroLocal, tipoDeMime } from './media';

// presença do peer é estática por build — o hook abaixo ramifica uma vez só
const shareIntentMod = obterShareIntent();

/**
 * Deteta conteúdo partilhado do SO (via `expo-share-intent`, peer opcional) e
 * normaliza para `FicheiroLocal[]` + texto. Devolve null se o peer não existir
 * ou não houver partilha pendente. Para apps só-chat ligarem partilha→mensagem.
 */
export function usePartilhaRecebida(): { itens: FicheiroLocal[]; texto: string | null; limpar(): void } | null {
    if (!shareIntentMod?.useShareIntent) return null;

    /* eslint-disable react-hooks/rules-of-hooks */
    const { hasShareIntent, shareIntent, resetShareIntent } = shareIntentMod.useShareIntent({ resetOnBackground: true });

    return useMemo(() => {
        if (!hasShareIntent) return null;

        const itens: FicheiroLocal[] = (shareIntent?.files ?? []).map(
            (f: { path: string; mimeType?: string; fileName?: string; width?: number; height?: number; duration?: number }) => ({
                uri: f.path,
                mime: f.mimeType ?? 'application/octet-stream',
                nome: f.fileName ?? 'partilha',
                tipo: tipoDeMime(f.mimeType),
                largura: f.width ?? undefined,
                altura: f.height ?? undefined,
                duracao_segundos: f.duration != null ? Math.round(f.duration / 1000) : undefined,
            }),
        );
        const txt = (shareIntent?.text ?? shareIntent?.webUrl ?? null) as string | null;

        if (!itens.length && !txt) return null;

        return { itens, texto: txt, limpar: resetShareIntent as () => void };
    }, [hasShareIntent, shareIntent, resetShareIntent]);
    /* eslint-enable react-hooks/rules-of-hooks */
}

export interface PartilharScreenProps {
    /** media/ficheiros já em uri local (partilha do SO ou seleção) */
    itens: FicheiroLocal[];
    /** texto/link partilhado — pré-preenche a legenda */
    texto?: string;
    onFechar(): void;
    /** ids das conversas para onde foi enviado (a app pode abrir a 1ª) */
    onEnviado(conversaIds: string[]): void;
    /** pesquisa server-side de contactos (opcional — senão filtra sugestões) */
    pesquisarContactos?(q: string): Promise<AlvoParticipante[]>;
}

type Destino = { conversa: Conversa } | { contacto: AlvoParticipante };
const chaveDestino = (d: Destino) => ('conversa' in d ? `c:${d.conversa.id}` : `u:${d.contacto.tipo}:${d.contacto.id_externo}`);

/**
 * Ecrã do SDK "Partilhar com…": escolhe uma ou várias conversas/contactos,
 * faz upload das media/ficheiros e envia com legenda. Reutilizável por qualquer
 * serviço — a app só entrega os `itens` (ex.: do share intent do SO).
 */
export function PartilharParaConversaScreen({ itens, texto, onFechar, onEnviado, pesquisarContactos }: PartilharScreenProps) {
    const { api, engine, contactos, identidade } = useMakaChat();
    const tema = useTema();
    const insets = useSafeAreaInsets();
    const conversas = useConversas(false);

    const [busca, setBusca] = useState('');
    const [legenda, setLegenda] = useState(texto ?? '');
    const [escolhidos, setEscolhidos] = useState<Map<string, Destino>>(new Map());
    const [aEnviar, setAEnviar] = useState(false);

    const conversasFiltradas = useMemo(() => {
        const q = busca.trim().toLowerCase();

        return q ? conversas.filter((c) => (c.titulo ?? '').toLowerCase().includes(q)) : conversas;
    }, [conversas, busca]);

    // contactos SEM conversa existente (evita duplicar entradas na lista)
    const [resultadosPesquisa, setResultadosPesquisa] = useState<AlvoParticipante[] | null>(null);

    const contactosFiltrados = useMemo(() => {
        const q = busca.trim().toLowerCase();
        const comConversa = new Set(conversas.flatMap((c) => c.participantes.map((p) => `${p.tipo}:${p.id_externo}`)));
        const base = resultadosPesquisa ?? contactos;

        return base
            .filter((ct) => !(ct.id_externo === identidade.id && ct.tipo === identidade.tipo))
            .filter((ct) => !comConversa.has(`${ct.tipo}:${ct.id_externo}`))
            .filter((ct) => !q || (ct.nome ?? '').toLowerCase().includes(q));
    }, [contactos, conversas, busca, resultadosPesquisa, identidade]);

    // pesquisa server-side (opcional) — debounce simples
    React.useEffect(() => {
        const q = busca.trim();

        if (!q || !pesquisarContactos) {
            setResultadosPesquisa(null);

            return;
        }

        let vivo = true;
        const t = setTimeout(() => {
            void pesquisarContactos(q)
                .then((l) => vivo && setResultadosPesquisa(l))
                .catch(() => vivo && setResultadosPesquisa([]));
        }, 350);

        return () => {
            vivo = false;
            clearTimeout(t);
        };
    }, [busca, pesquisarContactos]);

    const alternar = (d: Destino) => {
        const chave = chaveDestino(d);

        setEscolhidos((atual) => {
            const novo = new Map(atual);

            if (novo.has(chave)) novo.delete(chave);
            else novo.set(chave, d);

            return novo;
        });
    };

    /** Envia os itens (+legenda) para UMA conversa. Legenda só na 1ª mensagem. */
    const enviarParaConversa = async (conversaId: string) => {
        const fotosVideos = itens.filter((i) => i.tipo === 'foto' || i.tipo === 'video');
        const ficheiros = itens.filter((i) => i.tipo === 'ficheiro' || i.tipo === 'audio');
        let legendaPorUsar: string | undefined = legenda.trim() || undefined;

        const consumirLegenda = () => {
            const l = legendaPorUsar;
            legendaPorUsar = undefined;

            return l;
        };

        if (fotosVideos.length) {
            const anexos = [];

            for (const f of fotosVideos) anexos.push(await enviarAnexoLocal(api, f));

            await engine.enviarMensagem(
                {
                    conversa_id: conversaId,
                    tipo: fotosVideos.some((f) => f.tipo === 'video') ? 'video' : 'foto',
                    anexo_ids: anexos.map((a) => a.id),
                    conteudo: consumirLegenda(),
                },
                anexos,
            );
        }

        for (const f of ficheiros) {
            const anexo = await enviarAnexoLocal(api, f, { duravel: f.tipo === 'ficheiro' });

            if (f.tipo === 'ficheiro') await registarFicheiroLocal(engine.storage, anexo.id, f.uri);

            await engine.enviarMensagem({ conversa_id: conversaId, tipo: f.tipo, anexo_ids: [anexo.id], conteudo: consumirLegenda() }, [anexo]);
        }

        // partilha só-texto
        if (!itens.length && legendaPorUsar) {
            await engine.enviarMensagem({ conversa_id: conversaId, tipo: 'texto', conteudo: consumirLegenda() });
        }
    };

    const enviar = async () => {
        if (aEnviar || escolhidos.size === 0) return;

        setAEnviar(true);

        try {
            const ids: string[] = [];

            for (const d of escolhidos.values()) {
                const conversaId = 'conversa' in d ? d.conversa.id : (await api.criarPrivada(d.contacto)).conversa.id;

                await enviarParaConversa(conversaId);
                ids.push(conversaId);
            }

            await engine.atualizarConversas().catch(() => undefined);
            onEnviado(ids);
        } catch (e) {
            Alert.alert('Falha ao partilhar', (e as Error)?.message ?? 'Tenta de novo.');
        } finally {
            setAEnviar(false);
        }
    };

    const dados: Destino[] = [...conversasFiltradas.map((c) => ({ conversa: c })), ...contactosFiltrados.map((ct) => ({ contacto: ct }))];

    return (
        <View style={{ flex: 1, backgroundColor: tema.fundo }}>
            <View style={[estilos.header, { paddingTop: insets.top + 8, backgroundColor: tema.superficie }]}>
                <Pressable onPress={onFechar} hitSlop={8} style={{ padding: 6 }}>
                    <Ionicons name="close" size={26} color={tema.texto} />
                </Pressable>
                <Text style={{ fontSize: 18, fontWeight: '700', color: tema.texto, flex: 1 }}>Partilhar com…</Text>
            </View>

            {/* pré-visualização do que vai ser partilhado */}
            {itens.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={estilos.previews}>
                    {itens.map((it, i) => (
                        <View key={i} style={[estilos.preview, { backgroundColor: tema.superficie }]}>
                            {it.tipo === 'foto' || it.tipo === 'video' ? (
                                <>
                                    <Image source={{ uri: it.uri }} style={estilos.previewImg} />
                                    {it.tipo === 'video' && (
                                        <View style={estilos.previewBadge}>
                                            <Ionicons name="play" size={14} color="#fff" />
                                        </View>
                                    )}
                                </>
                            ) : (
                                <View style={estilos.previewFicheiro}>
                                    <Ionicons name={it.tipo === 'audio' ? 'musical-notes' : 'document-text'} size={22} color={tema.primaria} />
                                    <Text numberOfLines={2} style={{ fontSize: 10.5, color: tema.textoSuave, textAlign: 'center' }}>
                                        {it.nome}
                                    </Text>
                                </View>
                            )}
                        </View>
                    ))}
                </ScrollView>
            )}

            {/* legenda */}
            <View style={[estilos.legenda, { backgroundColor: tema.superficie }]}>
                <TextInput
                    value={legenda}
                    onChangeText={setLegenda}
                    placeholder="Adicionar legenda…"
                    placeholderTextColor={tema.textoSuave}
                    style={{ flex: 1, color: tema.texto, fontSize: 15, paddingVertical: 6 }}
                    multiline
                />
            </View>

            {/* pesquisa */}
            <View style={[estilos.pesquisa, { backgroundColor: tema.superficie }]}>
                <Ionicons name="search" size={17} color={tema.textoSuave} />
                <TextInput
                    value={busca}
                    onChangeText={setBusca}
                    placeholder="Pesquisar conversas e pessoas"
                    placeholderTextColor={tema.textoSuave}
                    style={{ flex: 1, color: tema.texto, paddingVertical: 8, fontSize: 15 }}
                />
            </View>

            <ListaPerformante
                data={dados}
                keyExtractor={(d: Destino) => chaveDestino(d)}
                estimatedItemSize={64}
                renderItem={({ item: d }: { item: Destino }) => {
                    const marcado = escolhidos.has(chaveDestino(d));
                    const conversa = 'conversa' in d ? d.conversa : null;
                    const nome = conversa ? conversa.titulo ?? 'Conversa' : (d as { contacto: AlvoParticipante }).contacto.nome ?? 'Utilizador';
                    const foto = conversa ? conversa.foto_url : (d as { contacto: AlvoParticipante }).contacto.foto ?? null;
                    const sub = conversa ? previewConversa(conversa) : 'Começar conversa';

                    return (
                        <Pressable disabled={aEnviar} onPress={() => alternar(d)} style={estilos.linha}>
                            <Ionicons
                                name={marcado ? 'checkmark-circle' : 'ellipse-outline'}
                                size={22}
                                color={marcado ? tema.primaria : tema.textoSuave}
                            />
                            <Avatar nome={nome} url={foto} tamanho={46} />
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: '600', color: tema.texto }}>
                                    {nome}
                                </Text>
                                <Text numberOfLines={1} style={{ fontSize: 12.5, color: tema.textoSuave, marginTop: 1 }}>
                                    {sub}
                                </Text>
                            </View>
                        </Pressable>
                    );
                }}
                ListEmptyComponent={<Text style={{ color: tema.textoSuave, textAlign: 'center', marginTop: 40 }}>Sem resultados.</Text>}
                contentContainerStyle={{ paddingBottom: 96 }}
            />

            {/* rodapé enviar */}
            {escolhidos.size > 0 && (
                <View style={[estilos.rodape, { paddingBottom: Math.max(insets.bottom, 12), backgroundColor: tema.superficie }]}>
                    <Pressable
                        disabled={aEnviar}
                        onPress={() => void enviar()}
                        style={[estilos.botaoEnviar, { backgroundColor: tema.primaria, opacity: aEnviar ? 0.5 : 1 }]}
                    >
                        {aEnviar ? (
                            <ActivityIndicator color={tema.primariaContraste} />
                        ) : (
                            <Text style={{ color: tema.primariaContraste, fontWeight: '700', fontSize: 15 }}>Enviar ({escolhidos.size})</Text>
                        )}
                    </Pressable>
                </View>
            )}
        </View>
    );
}

const estilos = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingBottom: 8 },
    previews: { gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
    preview: { width: 72, height: 72, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    previewImg: { width: '100%', height: '100%' },
    previewBadge: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 12, padding: 4 },
    previewFicheiro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, padding: 6 },
    legenda: { marginHorizontal: 14, marginBottom: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 2 },
    pesquisa: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, marginHorizontal: 14, marginBottom: 8 },
    linha: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
    rodape: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10 },
    botaoEnviar: { alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 13 },
});
