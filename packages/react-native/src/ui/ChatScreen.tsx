import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Anexo, Conversa, Mensagem, ParticipanteConversa } from '@hongayetu/makachat-core';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    AppState,
    KeyboardAvoidingView,
    Linking,
    Platform,
    Pressable,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useEnviarMensagem, useFuncionalidadeAtiva, useMensagens, useTypingConversa, useVersaoChat } from '../hooks';
import { obterKeyboardController } from '../opcionais';
import { useMakaChat, useTema } from '../provider';
import { tocarSom } from '../sons';
import { GravadorAudio } from './audio';
import { Bolha } from './Bolha';
import { Avatar, contraparteDe, ItemSheet, ListaPerformante, NomeComBadge, Pulso, rotuloDia, Sheet } from './comum';
import {
    enviarAnexoLocal,
    escolherFicheiro,
    escolherFotosEVideos,
    FicheiroLocal,
    Galeria,
    LobbyFotos,
    VisualizadorVideo,
} from './media';

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export interface ChatScreenProps {
    conversaId: string;
    /** voltar à lista (header) */
    onVoltar?(): void;
    /** abrir info da conversa/grupo */
    onAbrirInfo?(conversa: Conversa): void;
    /** abrir outra conversa (ex.: mensagem direta a partir das reações) */
    onAbrirOutraConversa?(conversaId: string): void;
    /** iniciar/entrar em chamadas — liga ao ChamadasProvider da app */
    chamadas?: { iniciar(conversaId: string, tipo: 'audio' | 'video'): Promise<void>; entrar(chamadaId: string, tipo: 'audio' | 'video'): Promise<void> } | null;
    /** compat: abrir anexos fora (por omissão usa galeria/player internos) */
    onAbrirAnexo?(url: string, tipo: string): void;
    /**
     * O ecrã está em foco de NAVEGAÇÃO? (ex.: useIsFocused do react-navigation).
     * Ecrãs montados em stacks/tabs inativos não devem marcar mensagens como lidas.
     */
    emFoco?: boolean;
    /**
     * Ícones da status bar enquanto o chat está em foco: 'escura' (ícones
     * escuros — default, o chat tem fundo claro), 'clara' (ícones claros,
     * para temas escuros) ou null para a app gerir sozinha.
     */
    barraEstado?: 'escura' | 'clara' | null;
}

interface ItemLista {
    tipo: 'mensagem' | 'separador' | 'typing';
    chave: string;
    mensagem?: Mensagem;
    rotulo?: string;
    primeiraDoBloco?: boolean;
    ultimaDoBloco?: boolean;
}

/** Conversa completa estilo WhatsApp — paridade com o ConversaPainel da web. */
// KeyboardAvoidingView do react-native-keyboard-controller (robusto em
// Android/edge-to-edge, requer <KeyboardProvider> na app) — senão o do RN.
const KC = obterKeyboardController();
const CampoTeclado = (KC?.KeyboardAvoidingView ?? KeyboardAvoidingView) as typeof KeyboardAvoidingView;

export function ChatScreen({ conversaId, onVoltar, onAbrirInfo, onAbrirOutraConversa, chamadas, onAbrirAnexo, emFoco = true, barraEstado = 'escura' }: ChatScreenProps) {
    const { engine, api, socket, identidade, registarVisivel } = useMakaChat();
    const tema = useTema();
    const insets = useSafeAreaInsets();
    // Folga do composer: paddingBottom CONSTANTE (insets da nav bar) e a dupla
    // compensação anulada por keyboardVerticalOffset negativo no CampoTeclado —
    // o offset entra no interpolate do animador do keyboard-controller, por isso
    // a compensação é contínua durante toda a animação (sem trocas → sem saltos).
    const padFundoInput = Math.max(insets.bottom, 8);
    const versao = useVersaoChat();
    const mensagens = useMensagens(conversaId, 500);
    const typing = useTypingConversa(conversaId);
    const enviar = useEnviarMensagem();

    const podeReagir = useFuncionalidadeAtiva('reacoes');
    const podeEncaminhar = useFuncionalidadeAtiva('encaminhar');
    const podeFoto = useFuncionalidadeAtiva('media.foto');
    const podeFicheiro = useFuncionalidadeAtiva('media.ficheiro');
    const podeAudioMsg = useFuncionalidadeAtiva('media.audio');
    const podeAudioChamada = useFuncionalidadeAtiva('chamadas.audio');
    const podeVideoChamada = useFuncionalidadeAtiva('chamadas.video');

    const [conversa, setConversa] = useState<Conversa | null>(null);
    const [texto, setTexto] = useState('');
    const [responderA, setResponderA] = useState<Mensagem | null>(null);
    const [editar, setEditar] = useState<Mensagem | null>(null);
    const [acoesDe, setAcoesDe] = useState<Mensagem | null>(null);
    const [reacoesDe, setReacoesDe] = useState<Mensagem | null>(null);
    const [encaminhar, setEncaminhar] = useState<Mensagem | null>(null);
    const [menuAberto, setMenuAberto] = useState(false);
    const [anexoMenu, setAnexoMenu] = useState(false);
    const [fotosPendentes, setFotosPendentes] = useState<FicheiroLocal[]>([]);
    const [aEnviarMedia, setAEnviarMedia] = useState(false);
    const [aGravar, setAGravar] = useState(false);
    const [galeriaDe, setGaleriaDe] = useState<string | null>(null);
    const [videoAberto, setVideoAberto] = useState<string | null>(null);
    const [destacada, setDestacada] = useState<string | null>(null);
    const [novas, setNovas] = useState(0);
    const [noFundo, setNoFundo] = useState(true);
    const [pesquisaAberta, setPesquisaAberta] = useState(false);
    const [pesquisaQ, setPesquisaQ] = useState('');
    const [resultados, setResultados] = useState<Mensagem[]>([]);
    const [resultadoIdx, setResultadoIdx] = useState(0);
    const [appAtiva, setAppAtiva] = useState(AppState.currentState === 'active');

    const lista = useRef<{ scrollToOffset(o: { offset: number; animated?: boolean }): void; scrollToIndex(o: { index: number; animated?: boolean; viewPosition?: number }): void } | null>(null);
    const ultimaVista = useRef<string | null>(null);
    const aCarregarAntigas = useRef(false);
    // Visibilidade do botão "descer" por VIEWABILITY (não por eventos de scroll):
    // está-se no fundo quando o item de índice 0 (mensagem mais recente, fundo
    // visual da lista invertida) está visível — vale para scroll do dedo,
    // programático ou novas mensagens, sem timers nem corridas. Durante a
    // descida programática a flag aDescer segura o botão escondido; limpa-se
    // deterministicamente quando o índice 0 fica visível (ou se o utilizador
    // agarrar a lista — onScrollBeginDrag).
    const aDescer = useRef(false);
    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 10 }).current;
    const aoMudarVisiveis = useRef(({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
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
    const semMaisAntigas = useRef(false);

    const eu = conversa?.participantes.find((p) => p.id_externo === identidade.id && p.tipo === identidade.tipo) ?? null;
    const outros = (conversa?.participantes ?? []).filter((p) => p.identidade_id !== eu?.identidade_id && !p.saiu_em);
    const contraparte = conversa ? contraparteDe(conversa, identidade) : null;
    const grupo = conversa?.tipo === 'grupo';
    const fechada = conversa?.estado === 'fechada';

    // entrada na conversa + visibilidade + conversa fresca (visível só quando em foco)
    useEffect(() => {
        void engine.entrarConversa(conversaId);

        if (!emFoco) return;

        const sair = registarVisivel(conversaId);

        return sair;
    }, [engine, conversaId, registarVisivel, emFoco]);

    useEffect(() => {
        void engine.storage.obterConversa(conversaId).then(setConversa);
    }, [engine, conversaId, versao]);

    useEffect(() => {
        const sub = AppState.addEventListener('change', (estado) => setAppAtiva(estado === 'active'));

        return () => sub.remove();
    }, []);

    // marcar lidas: só com app ativa, ecrã em foco de navegação e no fundo da lista
    useEffect(() => {
        const ultima = mensagens.at(-1);

        if (!ultima || !appAtiva || !emFoco || !noFundo) return;
        if (ultimaVista.current === ultima.id) return;

        ultimaVista.current = ultima.id;
        void engine.marcarLidas(conversaId).catch(() => undefined);
        setNovas(0);
    }, [mensagens, appAtiva, emFoco, noFundo, engine, conversaId]);

    // contagem de novas quando o scroll está recuado — pelo ID da última (como a
    // web): paginar antigas não conta, janela cheia (500) conta na mesma, e as
    // próprias mensagens não contam. O diff de comprimento cobre lotes do delta.
    const totalAnterior = useRef(mensagens.length);
    const ultimaContada = useRef<string | null>(null);
    useEffect(() => {
        const ultima = mensagens.at(-1);
        const anterior = ultimaContada.current;
        const totalAntes = totalAnterior.current;

        totalAnterior.current = mensagens.length;
        ultimaContada.current = ultima?.id ?? null;

        if (!ultima || anterior === null || ultima.id === anterior) return; // 1ª carga / sem nova

        const minha = ultima.remetente_identidade_id === eu?.identidade_id || ultima.estado_envio === 'a_enviar';

        if (!noFundo && !minha) {
            setNovas((n) => n + Math.max(1, mensagens.length - totalAntes));
        }
    }, [mensagens, noFundo, eu?.identidade_id]);

    // typing do próprio
    const ultimoTyping = useRef(0);
    const aoEscrever = (valor: string) => {
        setTexto(valor);

        const agora = Date.now();

        if (valor && agora - ultimoTyping.current > 3000) {
            ultimoTyping.current = agora;
            socket.typing(conversaId, true);
        }
    };

    // ---------------- envio ----------------

    const aoEnviar = async () => {
        const conteudo = texto.trim();

        if (!conteudo) return;

        if (editar) {
            await engine.editarMensagem(editar.id, conteudo).catch(() => undefined);
            setEditar(null);
            setTexto('');

            return;
        }

        setTexto('');
        setResponderA(null);
        socket.typing(conversaId, false);
        tocarSom('enviada');

        await enviar({ conversa_id: conversaId, tipo: 'texto', conteudo, resposta_a_id: responderA?.id }).catch(() => undefined);
        descerParaFundo();
    };

    const enviarFotos = async (legenda: string) => {
        setAEnviarMedia(true);

        try {
            const anexos: Anexo[] = [];

            for (const f of fotosPendentes) {
                anexos.push(await enviarAnexoLocal(api, f));
            }

            const tipo = fotosPendentes.some((f) => f.tipo === 'video') ? 'video' : 'foto';
            setFotosPendentes([]);
            await enviar(
                { conversa_id: conversaId, tipo, conteudo: legenda || undefined, anexo_ids: anexos.map((a) => a.id), resposta_a_id: responderA?.id },
                anexos,
            );
            setResponderA(null);
            descerParaFundo();
        } catch (e) {
            // detalhe do erro no alerta — diagnosticar upload (rede/limite/permissão)
            Alert.alert('Falha no envio', `Não foi possível enviar as fotos. ${(e as Error)?.message ?? ''}`.trim());
        } finally {
            setAEnviarMedia(false);
        }
    };

    const enviarFicheiroLocal = async (f: FicheiroLocal) => {
        setAEnviarMedia(true);

        try {
            const anexo = await enviarAnexoLocal(api, f);
            await enviar({ conversa_id: conversaId, tipo: f.tipo === 'ficheiro' ? 'ficheiro' : f.tipo, anexo_ids: [anexo.id] }, [anexo]);
            descerParaFundo();
        } catch (e) {
            Alert.alert('Falha no envio', `Não foi possível enviar. ${(e as Error)?.message ?? ''}`.trim());
        } finally {
            setAEnviarMedia(false);
        }
    };

    // ---------------- navegação para mensagem (citação/pesquisa) ----------------

    const indicePorId = useMemo(() => {
        const mapa = new Map<string, number>();
        itensLista(mensagens, typing, eu?.identidade_id ?? null).forEach((item, i) => {
            if (item.mensagem) mapa.set(item.mensagem.id, i);
        });

        return mapa;
    }, [mensagens, typing, eu?.identidade_id]);

    const irParaMensagem = useCallback(
        async (id: string) => {
            for (let tentativa = 0; tentativa < 10; tentativa++) {
                const idx = indicePorId.get(id);

                if (idx !== undefined) {
                    lista.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
                    setDestacada(id);
                    setTimeout(() => setDestacada(null), 1600);

                    return;
                }

                const carregadas = await engine.carregarMensagens(conversaId, mensagens[0]?.id).catch(() => 0);

                if (!carregadas) return;
            }
        },
        [indicePorId, engine, conversaId, mensagens],
    );

    // ---------------- pesquisa na conversa ----------------

    const executarPesquisa = async () => {
        const q = pesquisaQ.trim();

        if (!q) return;

        const r = await api.pesquisarMensagens(conversaId, q).catch(() => ({ mensagens: [] as Mensagem[] }));
        setResultados(r.mensagens);
        setResultadoIdx(0);

        if (r.mensagens[0]) void irParaMensagem(r.mensagens[0].id);
    };

    const navegarResultado = (direcao: 1 | -1) => {
        if (!resultados.length) return;

        const idx = (resultadoIdx + direcao + resultados.length) % resultados.length;
        setResultadoIdx(idx);
        void irParaMensagem(resultados[idx].id);
    };

    // ---------------- itens/sheets ----------------

    const itens = useMemo(() => itensLista(mensagens, typing, eu?.identidade_id ?? null), [mensagens, typing, eu?.identidade_id]);

    const itensAcoes = (m: Mensagem): ItemSheet[] => {
        const minha = m.remetente_identidade_id === eu?.identidade_id;
        const lista: ItemSheet[] = [
            { icone: 'arrow-undo-outline', rotulo: 'Responder', acao: () => { setEditar(null); setResponderA(m); } },
        ];

        if (podeEncaminhar && !m.eliminada) lista.push({ icone: 'arrow-redo-outline', rotulo: 'Encaminhar', acao: () => setEncaminhar(m) });
        if (minha && m.tipo === 'texto' && !m.eliminada) lista.push({ icone: 'pencil-outline', rotulo: 'Editar', acao: () => { setResponderA(null); setEditar(m); setTexto(m.conteudo ?? ''); } });

        if (!m.eliminada) {
            lista.push({
                icone: 'trash-outline',
                rotulo: minha ? 'Eliminar…' : 'Eliminar para mim',
                destrutivo: true,
                acao: () => {
                    if (!minha) {
                        void engine.eliminarMensagem(conversaId, m.id, false);

                        return;
                    }

                    Alert.alert('Eliminar mensagem?', undefined, [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Para mim', onPress: () => void engine.eliminarMensagem(conversaId, m.id, false) },
                        { text: 'Para todos', style: 'destructive', onPress: () => void engine.eliminarMensagem(conversaId, m.id, true) },
                    ]);
                },
            });
        }

        return lista;
    };

    // banner "entrar na chamada" só faz sentido em GRUPOS — numa privada ou a
    // chamada está a tocar-te (UI de receção) ou já estás nela
    const banner = conversa?.chamada_ativa && chamadas && !fechada && conversa.tipo === 'grupo';

    return (
        <View style={{ flex: 1, backgroundColor: tema.fundo }}>
            {/* status bar do chat (o header claro precisa de ícones escuros);
                configurável pela app via barraEstado, null desliga */}
            {emFoco && barraEstado != null && (
                <StatusBar animated barStyle={barraEstado === 'clara' ? 'light-content' : 'dark-content'} />
            )}
            {/* header */}
            <View style={[estilos.header, { backgroundColor: tema.superficie }]}>
                {onVoltar && (
                    <Pressable onPress={onVoltar} style={{ padding: 6 }}>
                        <Ionicons name="chevron-back" size={24} color={tema.texto} />
                    </Pressable>
                )}
                <Pressable style={estilos.headerCentro} onPress={() => conversa && onAbrirInfo?.(conversa)}>
                    <Avatar nome={conversa?.titulo ?? '?'} url={conversa?.foto_url} tamanho={38} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                        <NomeComBadge nome={conversa?.titulo ?? '…'} metadados={contraparte?.metadados} estilo={{ fontSize: 16, fontWeight: '700', color: tema.texto }} />
                        <Presenca contraparte={contraparte} typingAtivo={!!typing?.ativo} grupo={grupo} totalMembros={conversa?.participantes.filter((p) => !p.saiu_em).length ?? 0} />
                    </View>
                </Pressable>
                <Pressable onPress={() => { setPesquisaAberta(!pesquisaAberta); setResultados([]); setPesquisaQ(''); }} style={{ padding: 6 }}>
                    <Ionicons name="search" size={21} color={tema.texto} />
                </Pressable>
                {chamadas && podeAudioChamada && !fechada && (
                    <Pressable onPress={() => void chamadas.iniciar(conversaId, 'audio')} style={{ padding: 6 }}>
                        <Ionicons name="call-outline" size={21} color={tema.texto} />
                    </Pressable>
                )}
                {chamadas && podeVideoChamada && !fechada && (
                    <Pressable onPress={() => void chamadas.iniciar(conversaId, 'video')} style={{ padding: 6 }}>
                        <Ionicons name="videocam-outline" size={22} color={tema.texto} />
                    </Pressable>
                )}
                <Pressable onPress={() => setMenuAberto(true)} style={{ padding: 6 }}>
                    <Ionicons name="ellipsis-vertical" size={20} color={tema.texto} />
                </Pressable>
            </View>

            {/* pesquisa na conversa */}
            {pesquisaAberta && (
                <View style={[estilos.pesquisaBarra, { backgroundColor: tema.superficie }]}>
                    <Ionicons name="search" size={16} color={tema.textoSuave} />
                    <TextInput
                        autoFocus
                        value={pesquisaQ}
                        onChangeText={setPesquisaQ}
                        onSubmitEditing={() => (resultados.length ? navegarResultado(1) : void executarPesquisa())}
                        placeholder="Pesquisar nesta conversa…"
                        placeholderTextColor={tema.textoSuave}
                        style={{ flex: 1, fontSize: 14.5, color: tema.texto, paddingVertical: 7 }}
                    />
                    {resultados.length > 0 && (
                        <Text style={{ fontSize: 12, color: tema.textoSuave }}>{resultadoIdx + 1}/{resultados.length}</Text>
                    )}
                    <Pressable onPress={() => navegarResultado(-1)} style={{ padding: 4 }}>
                        <Ionicons name="chevron-up" size={19} color={tema.textoSuave} />
                    </Pressable>
                    <Pressable onPress={() => navegarResultado(1)} style={{ padding: 4 }}>
                        <Ionicons name="chevron-down" size={19} color={tema.textoSuave} />
                    </Pressable>
                    <Pressable onPress={() => setPesquisaAberta(false)} style={{ padding: 4 }}>
                        <Ionicons name="close" size={19} color={tema.textoSuave} />
                    </Pressable>
                </View>
            )}

            {/* banner: chamada a decorrer */}
            {banner && conversa?.chamada_ativa && (
                <View style={estilos.bannerChamada}>
                    <Pulso>
                        <Ionicons name={conversa.chamada_ativa.tipo === 'video' ? 'videocam' : 'call'} size={18} color="#fff" />
                    </Pulso>
                    <Text style={{ flex: 1, color: '#fff', fontWeight: '700', fontSize: 13.5 }}>
                        Chamada de {conversa.chamada_ativa.tipo === 'video' ? 'vídeo' : 'voz'} a decorrer
                    </Text>
                    <Pressable
                        onPress={() => void chamadas?.entrar(conversa.chamada_ativa!.id, conversa.chamada_ativa!.tipo)}
                        style={estilos.bannerEntrar}
                    >
                        <Text style={{ color: '#059669', fontWeight: '800', fontSize: 13 }}>Entrar</Text>
                    </Pressable>
                </View>
            )}

            {/* lista invertida */}
            <View style={{ flex: 1 }}>
                <ListaPerformante
                    ref={lista as never}
                    data={itens}
                    inverted
                    keyExtractor={(item: ItemLista) => item.chave}
                    estimatedItemSize={64}
                    extraData={`${versao}_${destacada}`}
                    // spacers como CONTEÚDO (não padding): numa lista inverted o header
                    // renderiza no fundo visual (folga acima do input). paddingVertical no
                    // contentContainer é buggy em inverted/Android — re-clampa sem o padding.
                    ListHeaderComponent={<View style={{ height: 10 }} />}
                    ListFooterComponent={<View style={{ height: 8 }} />}
                    viewabilityConfig={viewabilityConfig}
                    onViewableItemsChanged={aoMudarVisiveis}
                    onScrollBeginDrag={() => {
                        aDescer.current = false; // o utilizador agarrou — viewability governa
                    }}
                    onEndReachedThreshold={0.6}
                    onEndReached={() => {
                        if (aCarregarAntigas.current || semMaisAntigas.current || mensagens.length < 50) return;

                        aCarregarAntigas.current = true;
                        void engine
                            .carregarMensagens(conversaId, mensagens[0]?.id)
                            .then((n) => {
                                if (!n) semMaisAntigas.current = true;
                            })
                            .finally(() => {
                                aCarregarAntigas.current = false;
                            });
                    }}
                    renderItem={({ item }: { item: ItemLista }) => {
                        if (item.tipo === 'separador') {
                            return (
                                <View style={estilos.separador}>
                                    <Text style={[estilos.separadorTexto, { color: tema.textoSuave }]}>{item.rotulo}</Text>
                                </View>
                            );
                        }

                        if (item.tipo === 'typing') {
                            return <TypingBolha />;
                        }

                        const m = item.mensagem as Mensagem;
                        const minha = m.remetente_identidade_id === eu?.identidade_id || m.estado_envio === 'a_enviar';
                        const autor = conversa?.participantes.find((p) => p.identidade_id === m.remetente_identidade_id) ?? null;
                        const respondida = m.resposta_a_id ? mensagens.find((x) => x.id === m.resposta_a_id) ?? null : null;

                        return (
                            <Bolha
                                mensagem={m}
                                minha={minha}
                                grupo={!!grupo}
                                autor={autor}
                                outros={outros}
                                primeiraDoBloco={item.primeiraDoBloco ?? true}
                                ultimaDoBloco={item.ultimaDoBloco ?? true}
                                respondida={respondida}
                                destacada={destacada === m.id}
                                aoResponder={() => { setEditar(null); setResponderA(m); }}
                                aoLongPress={() => setAcoesDe(m)}
                                aoVerReacoes={() => setReacoesDe(m)}
                                aoClicarCitacao={(id) => void irParaMensagem(id)}
                                aoAbrirFoto={(a) => (onAbrirAnexo && a.url ? onAbrirAnexo(a.url, 'foto') : setGaleriaDe(a.id))}
                                aoAbrirUrl={(url) => {
                                    const anexo = m.anexos.find((a) => a.url === url);

                                    if (anexo?.tipo === 'video') setVideoAberto(url);
                                    else void Linking.openURL(url).catch(() => undefined);
                                }}
                                aoLigar={chamadas && !fechada ? (tipo) => void chamadas.iniciar(conversaId, tipo) : undefined}
                            />
                        );
                    }}
                />

                {/* botão para o fundo + novas */}
                {!noFundo && (
                    <Pressable onPress={descerParaFundo} style={[estilos.paraFundo, novas > 0 ? { backgroundColor: tema.primaria } : { backgroundColor: tema.superficie }]}>
                        {novas > 0 && (
                            <Text style={{ color: tema.primariaContraste, fontWeight: '800', fontSize: 12 }}>
                                {novas} {novas === 1 ? 'nova' : 'novas'}
                            </Text>
                        )}
                        <Ionicons name="chevron-down" size={18} color={novas > 0 ? tema.primariaContraste : tema.textoSuave} />
                    </Pressable>
                )}
            </View>

            {/* responder/editar preview */}
            {(responderA || editar) && (
                <View style={[estilos.previa, { backgroundColor: tema.superficie }]}>
                    <Ionicons name={editar ? 'pencil-outline' : 'arrow-undo-outline'} size={17} color={tema.primaria} />
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: tema.textoSuave }}>
                        {editar ? 'A editar mensagem' : `${(responderA && conversa?.participantes.find((p) => p.identidade_id === responderA.remetente_identidade_id)?.nome) ?? ''}: ${responderA?.conteudo ?? '📎 anexo'}`}
                    </Text>
                    <Pressable onPress={() => { setResponderA(null); setEditar(null); if (editar) setTexto(''); }}>
                        <Ionicons name="close-circle" size={20} color={tema.textoSuave} />
                    </Pressable>
                </View>
            )}

            {/* input / fechada / gravador */}
            {fechada ? (
                <View style={[estilos.fechada, { backgroundColor: tema.superficie, paddingBottom: Math.max(insets.bottom, 12) }]}>
                    <Ionicons name="lock-closed-outline" size={16} color={tema.textoSuave} />
                    <Text style={{ flex: 1, fontSize: 13, color: tema.textoSuave }}>
                        {conversa?.fecho_motivo ?? 'Esta conversa está fechada.'}
                    </Text>
                </View>
            ) : aGravar ? (
                <GravadorAudio
                    aoCancelar={() => setAGravar(false)}
                    aoTerminar={(uri, duracao) => {
                        setAGravar(false);
                        void enviarFicheiroLocal({ uri, mime: 'audio/m4a', nome: `voz_${Date.now()}.m4a`, tipo: 'audio', duracao_segundos: duracao });
                    }}
                />
            ) : (
                <CampoTeclado
                    // translate-with-padding: anima por transform (GPU, sem re-layout
                    // por frame — "padding" refazia o layout da lista a cada frame e
                    // engasgava/saltava em dispositivos modestos)
                    behavior={KC ? ('translate-with-padding' as never) : Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={-(Math.max(insets.bottom, 8) - 8)}
                >
                    <View style={[estilos.inputLinha, { backgroundColor: tema.superficie, paddingBottom: padFundoInput }]}>
                        {(podeFoto || podeFicheiro) && (
                            <Pressable onPress={() => setAnexoMenu(true)} style={{ padding: 7 }}>
                                <Ionicons name="attach" size={24} color={tema.textoSuave} />
                            </Pressable>
                        )}
                        <TextInput
                            value={texto}
                            onChangeText={aoEscrever}
                            placeholder="Mensagem"
                            placeholderTextColor={tema.textoSuave}
                            multiline
                            style={[estilos.input, { backgroundColor: tema.fundo, color: tema.texto }]}
                        />
                        {texto.trim() ? (
                            <Pressable onPress={() => void aoEnviar()} style={[estilos.enviar, { backgroundColor: tema.primaria }]}>
                                <Ionicons name={editar ? 'checkmark' : 'send'} size={19} color={tema.primariaContraste} />
                            </Pressable>
                        ) : podeAudioMsg ? (
                            <Pressable onPress={() => setAGravar(true)} style={[estilos.enviar, { backgroundColor: tema.primaria }]}>
                                <Ionicons name="mic" size={20} color={tema.primariaContraste} />
                            </Pressable>
                        ) : (
                            <View style={{ width: 42 }} />
                        )}
                    </View>
                </CampoTeclado>
            )}

            {/* sheets */}
            <Sheet visivel={acoesDe !== null} aoFechar={() => setAcoesDe(null)} itens={acoesDe ? itensAcoes(acoesDe) : []}>
                {acoesDe && podeReagir && !acoesDe.eliminada && (
                    <View style={estilos.emojis}>
                        {EMOJIS.map((e) => (
                            <Pressable
                                key={e}
                                onPress={() => {
                                    const alvo = acoesDe;
                                    setAcoesDe(null);

                                    if (alvo) void engine.alternarReacao(conversaId, alvo.id, e);
                                }}
                                style={{ padding: 6 }}
                            >
                                <Text style={{ fontSize: 26 }}>{e}</Text>
                            </Pressable>
                        ))}
                    </View>
                )}
            </Sheet>

            <Sheet visivel={menuAberto} aoFechar={() => setMenuAberto(false)} itens={itensMenuConversa()} />

            {reacoesDe && conversa && (
                <SheetReacoes
                    mensagem={mensagens.find((m) => m.id === reacoesDe.id) ?? reacoesDe}
                    conversa={conversa}
                    euId={eu?.identidade_id ?? null}
                    aoFechar={() => setReacoesDe(null)}
                    aoRemoverMinha={(emoji) => void engine.alternarReacao(conversaId, reacoesDe.id, emoji)}
                    aoMensagem={onAbrirOutraConversa ? async (p) => {
                        const { conversa: nova } = await api.criarPrivada({ id_externo: p.id_externo, tipo: p.tipo, nome: p.nome });
                        await engine.atualizarConversas();
                        onAbrirOutraConversa(nova.id);
                    } : undefined}
                />
            )}

            {encaminhar && (
                <SheetEncaminhar
                    aoFechar={() => setEncaminhar(null)}
                    aoConfirmar={(ids) => {
                        for (const id of ids) {
                            void engine.enviarMensagem({
                                conversa_id: id,
                                tipo: encaminhar.tipo,
                                conteudo: encaminhar.conteudo ?? undefined,
                                encaminhada_de_id: encaminhar.id,
                                metadados: encaminhar.metadados ?? undefined,
                            });
                        }

                        setEncaminhar(null);
                    }}
                />
            )}

            <Sheet
                visivel={anexoMenu}
                aoFechar={() => setAnexoMenu(false)}
                titulo="Anexar"
                itens={[
                    ...(podeFoto
                        ? [{
                              icone: 'images-outline' as const,
                              rotulo: 'Fotos e vídeos',
                              acao: () => void escolherFotosEVideos().then((f) => f.length && setFotosPendentes(f)),
                          }]
                        : []),
                    ...(podeFicheiro
                        ? [{
                              icone: 'document-outline' as const,
                              rotulo: 'Ficheiro',
                              acao: () => void escolherFicheiro().then((f) => f && void enviarFicheiroLocal(f)),
                          }]
                        : []),
                ]}
            />

            {/* modais de media */}
            {fotosPendentes.length > 0 && (
                <LobbyFotos
                    ficheiros={fotosPendentes}
                    aoMudar={setFotosPendentes}
                    aoAdicionarMais={() => void escolherFotosEVideos().then((f) => setFotosPendentes((a) => [...a, ...f].slice(0, 10)))}
                    aoEnviar={(legenda) => void enviarFotos(legenda)}
                    aoFechar={() => setFotosPendentes([])}
                    aEnviar={aEnviarMedia}
                    insets={insets}
                />
            )}
            {galeriaDe && (
                <Galeria
                    mensagens={mensagens}
                    inicialAnexoId={galeriaDe}
                    aoFechar={() => setGaleriaDe(null)}
                    aoResponder={(m) => setResponderA(m)}
                    aoEncaminhar={podeEncaminhar ? (m) => setEncaminhar(m) : undefined}
                    insets={insets}
                />
            )}
            {videoAberto && <VisualizadorVideo url={videoAberto} aoFechar={() => setVideoAberto(null)} insets={insets} />}
        </View>
    );

    function itensMenuConversa(): ItemSheet[] {
        const itens: ItemSheet[] = [];

        if (conversa) {
            itens.push({ icone: 'information-circle-outline', rotulo: grupo ? 'Info do grupo' : 'Ver contacto', acao: () => onAbrirInfo?.(conversa) });

            const silenciada = !!conversa.participante?.silenciada_ate && new Date(conversa.participante.silenciada_ate) > new Date();
            itens.push(
                silenciada
                    ? { icone: 'notifications-outline', rotulo: 'Reativar notificações', acao: () => void engine.silenciarConversa(conversaId, null) }
                    : { icone: 'notifications-off-outline', rotulo: 'Silenciar (sempre)', acao: () => void engine.silenciarConversa(conversaId, '9999-12-31T00:00:00.000Z') },
            );
            itens.push({
                icone: 'archive-outline',
                rotulo: conversa.participante?.arquivada ? 'Desarquivar' : 'Arquivar',
                acao: () => void api.atualizarPreferencias(conversaId, { arquivada: !conversa.participante?.arquivada }).then(() => engine.atualizarConversas()),
            });
        }

        return itens;
    }
}

// ---------------------------------------------------------------- presença no header

function Presenca({ contraparte, typingAtivo, grupo, totalMembros }: {
    contraparte: ParticipanteConversa | null;
    typingAtivo: boolean;
    grupo: boolean;
    totalMembros: number;
}) {
    const { subscreverPresenca, socket } = useMakaChat();
    const tema = useTema();
    const [online, setOnline] = useState(false);

    useEffect(() => {
        if (!contraparte) return;

        return subscreverPresenca((p) => {
            if (p.identidade_id === contraparte.identidade_id) setOnline(p.online);
        });
    }, [contraparte, subscreverPresenca, socket]);

    if (typingAtivo) return <Text style={{ fontSize: 12, color: tema.primaria, fontWeight: '600' }}>a escrever…</Text>;
    if (grupo) return <Text style={{ fontSize: 12, color: tema.textoSuave }}>{totalMembros} membros</Text>;
    if (online) return <Text style={{ fontSize: 12, color: '#10b981', fontWeight: '600' }}>online</Text>;

    return null;
}

// ---------------------------------------------------------------- typing bolha

function TypingBolha() {
    const tema = useTema();

    return (
        <View style={{ flexDirection: 'row', paddingHorizontal: 10, marginTop: 6 }}>
            <View style={{ width: 30, marginRight: 4 }} />
            <View style={{ backgroundColor: tema.bolhaOutro, borderRadius: tema.raio, borderBottomLeftRadius: 6, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', gap: 4 }}>
                {[0, 1, 2].map((i) => (
                    <PontoTyping key={i} atraso={i * 160} />
                ))}
            </View>
        </View>
    );
}

function PontoTyping({ atraso }: { atraso: number }) {
    const tema = useTema();
    const [opaco, setOpaco] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => setOpaco((o) => !o), 480);
        const arranque = setTimeout(() => setOpaco(true), atraso);

        return () => {
            clearInterval(timer);
            clearTimeout(arranque);
        };
    }, [atraso]);

    return <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tema.textoSuave, opacity: opaco ? 0.85 : 0.3 }} />;
}

// ---------------------------------------------------------------- sheets auxiliares

function SheetReacoes({ mensagem, conversa, euId, aoFechar, aoRemoverMinha, aoMensagem }: {
    mensagem: Mensagem;
    conversa: Conversa;
    euId: string | null;
    aoFechar(): void;
    aoRemoverMinha(emoji: string): void;
    aoMensagem?(p: ParticipanteConversa): Promise<void>;
}) {
    const tema = useTema();

    return (
        <Sheet visivel aoFechar={aoFechar} titulo="Reações">
            {mensagem.reacoes.length === 0 && (
                <Text style={{ paddingHorizontal: 20, paddingVertical: 12, color: tema.textoSuave }}>Sem reações.</Text>
            )}
            {mensagem.reacoes.map((r) => {
                const p = conversa.participantes.find((x) => x.identidade_id === r.identidade_id);
                const souEu = r.identidade_id === euId;

                return (
                    <Pressable
                        key={r.identidade_id}
                        onPress={() => {
                            if (souEu) {
                                aoRemoverMinha(r.emoji);
                                aoFechar();
                            } else if (aoMensagem && p) {
                                aoFechar();
                                void aoMensagem(p);
                            }
                        }}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 9 }}
                    >
                        <Avatar nome={p?.nome ?? '?'} url={p?.foto_url} tamanho={36} />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, fontWeight: '600', color: tema.texto }}>{souEu ? 'Tu' : p?.nome ?? 'Utilizador'}</Text>
                            <Text style={{ fontSize: 12, color: tema.textoSuave }}>
                                {souEu ? 'Toca para remover' : aoMensagem ? 'Toca para enviar mensagem' : ''}
                            </Text>
                        </View>
                        <Text style={{ fontSize: 22 }}>{r.emoji}</Text>
                    </Pressable>
                );
            })}
        </Sheet>
    );
}

function SheetEncaminhar({ aoFechar, aoConfirmar }: { aoFechar(): void; aoConfirmar(ids: string[]): void }) {
    const { engine } = useMakaChat();
    const tema = useTema();
    const [conversas, setConversas] = useState<Conversa[]>([]);
    const [escolhidas, setEscolhidas] = useState<Set<string>>(new Set());

    useEffect(() => {
        void engine.storage.listarConversas(false).then(setConversas);
    }, [engine]);

    return (
        <Sheet visivel aoFechar={aoFechar} titulo="Encaminhar para…">
            <View style={{ maxHeight: 360 }}>
                <ListaPerformante
                    data={conversas}
                    keyExtractor={(c: Conversa) => c.id}
                    estimatedItemSize={54}
                    renderItem={({ item: c }: { item: Conversa }) => {
                        const marcada = escolhidas.has(c.id);

                        return (
                            <Pressable
                                onPress={() =>
                                    setEscolhidas((a) => {
                                        const n = new Set(a);

                                        if (marcada) n.delete(c.id);
                                        else n.add(c.id);

                                        return n;
                                    })
                                }
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 8 }}
                            >
                                <Ionicons name={marcada ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={marcada ? tema.primaria : tema.textoSuave} />
                                <Avatar nome={c.titulo ?? '?'} url={c.foto_url} tamanho={36} />
                                <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: '600', color: tema.texto }}>
                                    {c.titulo ?? 'Conversa'}
                                </Text>
                            </Pressable>
                        );
                    }}
                />
            </View>
            <Pressable
                disabled={!escolhidas.size}
                onPress={() => aoConfirmar([...escolhidas])}
                style={{ marginHorizontal: 16, marginTop: 10, borderRadius: 24, paddingVertical: 13, alignItems: 'center', backgroundColor: tema.primaria, opacity: escolhidas.size ? 1 : 0.4 }}
            >
                <Text style={{ color: tema.primariaContraste, fontWeight: '700', fontSize: 15 }}>
                    Enviar{escolhidas.size ? ` (${escolhidas.size})` : ''}
                </Text>
            </Pressable>
        </Sheet>
    );
}

// ---------------------------------------------------------------- construção da lista (invertida)

/** Constrói itens invertidos: mensagens (agrupadas Messenger) + separadores de dia + typing. */
function itensLista(mensagens: Mensagem[], typing: { ativo: boolean; identidade_id: string } | null, euId: string | null): ItemLista[] {
    const itens: ItemLista[] = [];

    // lista invertida: índice 0 = fundo (mais recente)
    if (typing?.ativo && typing.identidade_id !== euId) {
        itens.push({ tipo: 'typing', chave: 'typing' });
    }

    for (let i = mensagens.length - 1; i >= 0; i--) {
        const m = mensagens[i];
        const anterior = mensagens[i - 1];
        const seguinte = mensagens[i + 1];

        const mesmoBlocoAnterior =
            !!anterior && anterior.remetente_identidade_id === m.remetente_identidade_id && anterior.tipo !== 'sistema' && m.tipo !== 'sistema' && mesmoDia(anterior.criada_em, m.criada_em);
        const mesmoBlocoSeguinte =
            !!seguinte && seguinte.remetente_identidade_id === m.remetente_identidade_id && seguinte.tipo !== 'sistema' && m.tipo !== 'sistema' && mesmoDia(seguinte.criada_em, m.criada_em);

        itens.push({
            tipo: 'mensagem',
            chave: m.id,
            mensagem: m,
            primeiraDoBloco: !mesmoBlocoAnterior,
            ultimaDoBloco: !mesmoBlocoSeguinte,
        });

        if (!anterior || !mesmoDia(anterior.criada_em, m.criada_em)) {
            itens.push({ tipo: 'separador', chave: `dia_${m.id}`, rotulo: rotuloDia(m.criada_em) });
        }
    }

    return itens;
}

function mesmoDia(a: string, b: string): boolean {
    return new Date(a).toDateString() === new Date(b).toDateString();
}

const estilos = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 8, paddingHorizontal: 8, gap: 2 },
    headerCentro: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, minWidth: 0 },
    pesquisaBarra: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 4 },
    bannerChamada: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#059669', paddingHorizontal: 14, paddingVertical: 9 },
    bannerEntrar: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 6 },
    separador: { alignSelf: 'center', backgroundColor: 'rgba(100,116,139,0.12)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 3, marginVertical: 8 },
    separadorTexto: { fontSize: 11.5, fontWeight: '600' },
    paraFundo: {
        position: 'absolute',
        bottom: 14,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 7,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
    },
    previa: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8 },
    fechada: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
    inputLinha: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingHorizontal: 8, paddingVertical: 7 },
    input: { flex: 1, borderRadius: 21, paddingHorizontal: 15, paddingTop: 10, paddingBottom: 10, fontSize: 15.5, maxHeight: 120 },
    enviar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
    emojis: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 16, paddingVertical: 6 },
});
