import { Ionicons } from '@expo/vector-icons';
import { Anexo, MakaApi, Mensagem } from '@hongayetu/makachat-core';
import React, { useState } from 'react';
import {
    Image,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from 'react-native';
import { obterDocumentPicker, obterFileSystem, obterImagePicker, obterVideo } from '../opcionais';
import { useTema } from '../provider';
import { ListaPerformante } from './comum';

export interface FicheiroLocal {
    uri: string;
    mime: string;
    nome: string;
    tipo: 'foto' | 'video' | 'audio' | 'ficheiro';
    largura?: number;
    altura?: number;
    duracao_segundos?: number;
}

// ---------------------------------------------------------------- pickers

export async function escolherFotosEVideos(): Promise<FicheiroLocal[]> {
    const picker = obterImagePicker();

    if (!picker) return [];

    const resultado = await picker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        selectionLimit: 10,
        quality: 0.85,
    });

    if (resultado.canceled) return [];

    return (resultado.assets as Array<{ uri: string; mimeType?: string; fileName?: string; width?: number; height?: number; duration?: number; type?: string }>).map((a) => ({
        uri: a.uri,
        mime: a.mimeType ?? (a.type === 'video' ? 'video/mp4' : 'image/jpeg'),
        nome: a.fileName ?? a.uri.split('/').pop() ?? 'media',
        tipo: (a.type === 'video' ? 'video' : 'foto') as 'foto' | 'video',
        largura: a.width,
        altura: a.height,
        duracao_segundos: a.duration ? Math.round(a.duration / 1000) : undefined,
    }));
}

export async function escolherFicheiro(): Promise<FicheiroLocal | null> {
    const picker = obterDocumentPicker();

    if (!picker) return null;

    const resultado = await picker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });

    if (resultado.canceled || !resultado.assets?.length) return null;

    const a = resultado.assets[0] as { uri: string; mimeType?: string; name?: string };

    return {
        uri: a.uri,
        mime: a.mimeType ?? 'application/octet-stream',
        nome: a.name ?? 'ficheiro',
        tipo: 'ficheiro',
    };
}

// ---------------------------------------------------------------- upload (criarMedia → PUT → confirmar)

export async function enviarAnexoLocal(api: MakaApi, ficheiro: FicheiroLocal, opcoes?: { duravel?: boolean }): Promise<Anexo> {
    const criado = await api.criarMedia({ tipo: ficheiro.tipo, mime: ficheiro.mime, nome_ficheiro: ficheiro.nome });
    const { token } = await api.sessao();
    const fs = obterFileSystem();

    if (fs?.uploadAsync) {
        // caminho recomendado: streaming direto do ficheiro local
        await fs.uploadAsync(criado.upload.url, ficheiro.uri, {
            httpMethod: 'PUT',
            uploadType: fs.FileSystemUploadType?.BINARY_CONTENT ?? 1,
            headers:
                criado.upload.metodo === 'endpoint'
                    ? { Authorization: `Bearer ${token}`, 'Content-Type': ficheiro.mime }
                    : { 'Content-Type': ficheiro.mime },
        });
    } else {
        const blob = await (await fetch(ficheiro.uri)).blob();
        await api.carregarMedia(criado.upload, blob, ficheiro.mime);
    }

    const { anexo } = await api.confirmarMedia(criado.anexo_id, {
        largura: ficheiro.largura,
        altura: ficheiro.altura,
        duracao_segundos: ficheiro.duracao_segundos,
        duravel: opcoes?.duravel,
    });

    return anexo;
}

// ---------------------------------------------------------------- lobby de fotos (preview + legenda)

export function LobbyFotos({ ficheiros, aoMudar, aoAdicionarMais, aoEnviar, aoFechar, aEnviar }: {
    ficheiros: FicheiroLocal[];
    aoMudar(novos: FicheiroLocal[]): void;
    aoAdicionarMais(): void;
    aoEnviar(legenda: string): void;
    aoFechar(): void;
    aEnviar: boolean;
}) {
    const tema = useTema();
    const [legenda, setLegenda] = useState('');
    const { width } = useWindowDimensions();
    const lado = (width - 48) / 3;

    return (
        <Modal visible animationType="slide" onRequestClose={aoFechar}>
            <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
                <View style={estilos.lobbyTopo}>
                    <Pressable onPress={aoFechar} style={{ padding: 8 }}>
                        <Ionicons name="close" size={26} color="#fff" />
                    </Pressable>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                        {ficheiros.length} {ficheiros.length === 1 ? 'item' : 'itens'}
                    </Text>
                    <Pressable onPress={aoAdicionarMais} style={{ padding: 8 }}>
                        <Ionicons name="add-circle-outline" size={26} color="#fff" />
                    </Pressable>
                </View>
                <View style={estilos.lobbyGrelha}>
                    {ficheiros.map((f, i) => (
                        <View key={f.uri} style={{ width: lado, height: lado, borderRadius: 12, overflow: 'hidden' }}>
                            <Image source={{ uri: f.uri }} style={{ width: '100%', height: '100%' }} />
                            {f.tipo === 'video' && (
                                <View style={estilos.lobbyPlay}>
                                    <Ionicons name="play" size={22} color="#fff" />
                                </View>
                            )}
                            <Pressable
                                onPress={() => aoMudar(ficheiros.filter((_, j) => j !== i))}
                                style={estilos.lobbyRemover}
                            >
                                <Ionicons name="close" size={15} color="#fff" />
                            </Pressable>
                        </View>
                    ))}
                </View>
                <View style={estilos.lobbyFundo}>
                    <TextInput
                        value={legenda}
                        onChangeText={setLegenda}
                        placeholder="Adicionar legenda…"
                        placeholderTextColor="rgba(255,255,255,0.5)"
                        style={estilos.lobbyLegenda}
                    />
                    <Pressable
                        disabled={aEnviar || !ficheiros.length}
                        onPress={() => aoEnviar(legenda.trim())}
                        style={[estilos.lobbyEnviar, { backgroundColor: tema.primaria, opacity: aEnviar ? 0.5 : 1 }]}
                    >
                        <Ionicons name={aEnviar ? 'hourglass-outline' : 'send'} size={20} color={tema.primariaContraste} />
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

// ---------------------------------------------------------------- galeria fullscreen

/** Galeria com TODAS as fotos da conversa, paging horizontal + contador. */
export function Galeria({ mensagens, inicialAnexoId, aoFechar, aoResponder, aoEncaminhar }: {
    mensagens: Mensagem[];
    inicialAnexoId: string;
    aoFechar(): void;
    aoResponder?(mensagem: Mensagem): void;
    aoEncaminhar?(mensagem: Mensagem): void;
}) {
    const { width, height } = useWindowDimensions();
    const fotos = mensagens
        .flatMap((m) => m.anexos.filter((a) => a.tipo === 'foto' && a.url).map((a) => ({ anexo: a, mensagem: m })))
        .sort((a, b) => (a.mensagem.id < b.mensagem.id ? -1 : 1));
    const inicial = Math.max(0, fotos.findIndex((f) => f.anexo.id === inicialAnexoId));
    const [indice, setIndice] = useState(inicial);
    const atual = fotos[indice];

    return (
        <Modal visible animationType="fade" onRequestClose={aoFechar}>
            <View style={{ flex: 1, backgroundColor: '#000' }}>
                <ListaPerformante
                    data={fotos}
                    horizontal
                    pagingEnabled
                    initialScrollIndex={inicial}
                    getItemLayout={(_: unknown, index: number) => ({ length: width, offset: width * index, index })}
                    keyExtractor={(f: { anexo: Anexo }) => f.anexo.id}
                    onMomentumScrollEnd={(e: { nativeEvent: { contentOffset: { x: number } } }) =>
                        setIndice(Math.round(e.nativeEvent.contentOffset.x / width))
                    }
                    renderItem={({ item: f }: { item: { anexo: Anexo } }) => (
                        <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
                            <Image source={{ uri: f.anexo.url ?? undefined }} style={{ width, height: height * 0.8 }} resizeMode="contain" />
                        </View>
                    )}
                />
                <View style={estilos.galeriaTopo}>
                    <Pressable onPress={aoFechar} style={{ padding: 8 }}>
                        <Ionicons name="close" size={26} color="#fff" />
                    </Pressable>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>
                        {fotos.length ? indice + 1 : 0}/{fotos.length}
                    </Text>
                    <View style={{ width: 42 }} />
                </View>
                <View style={estilos.galeriaAcoes}>
                    {aoResponder && atual && (
                        <Pressable onPress={() => { aoFechar(); aoResponder(atual.mensagem); }} style={estilos.galeriaBotao}>
                            <Ionicons name="arrow-undo-outline" size={22} color="#fff" />
                            <Text style={estilos.galeriaRotulo}>Responder</Text>
                        </Pressable>
                    )}
                    {aoEncaminhar && atual && (
                        <Pressable onPress={() => { aoFechar(); aoEncaminhar(atual.mensagem); }} style={estilos.galeriaBotao}>
                            <Ionicons name="arrow-redo-outline" size={22} color="#fff" />
                            <Text style={estilos.galeriaRotulo}>Encaminhar</Text>
                        </Pressable>
                    )}
                </View>
            </View>
        </Modal>
    );
}

/** Player de vídeo fullscreen (expo-video, opcional); sem o módulo abre no browser/OS. */
export function VisualizadorVideo({ url, aoFechar }: { url: string; aoFechar(): void }) {
    const video = obterVideo();

    if (!video?.useVideoPlayer) return null;

    return <VideoInterno video={video} url={url} aoFechar={aoFechar} />;
}

function VideoInterno({ video, url, aoFechar }: { video: any; url: string; aoFechar(): void }) {
    const VideoView = video.VideoView;
    const player = video.useVideoPlayer(url, (p: { play(): void }) => {
        p.play();
    });

    return (
        <Modal visible animationType="fade" onRequestClose={aoFechar}>
            <View style={{ flex: 1, backgroundColor: '#000' }}>
                <VideoView player={player} style={{ flex: 1 }} contentFit="contain" nativeControls allowsFullscreen />
                <Pressable onPress={aoFechar} style={estilos.videoFechar}>
                    <Ionicons name="close" size={26} color="#fff" />
                </Pressable>
            </View>
        </Modal>
    );
}

export function tamanhoLegivel(bytes: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const estilos = StyleSheet.create({
    lobbyTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 52, paddingHorizontal: 12, paddingBottom: 8 },
    lobbyGrelha: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, alignContent: 'flex-start' },
    lobbyPlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
    lobbyRemover: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(15,23,42,0.8)', alignItems: 'center', justifyContent: 'center' },
    lobbyFundo: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, paddingBottom: 34 },
    lobbyLegenda: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11, color: '#fff', fontSize: 15 },
    lobbyEnviar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
    galeriaTopo: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 52, paddingHorizontal: 12 },
    galeriaAcoes: { position: 'absolute', bottom: 34, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 36 },
    galeriaBotao: { alignItems: 'center', gap: 3 },
    videoFechar: { position: 'absolute', top: 52, left: 12, padding: 8, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 22 },
    galeriaRotulo: { color: '#fff', fontSize: 11 },
});
