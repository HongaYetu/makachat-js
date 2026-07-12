import { Ionicons } from '@expo/vector-icons';
import { AlvoParticipante, Anexo, Conversa, dividirLinks, MensagemLink, ParticipanteConversa, rotuloTipoIdentidade } from '@hongayetu/makachat-core';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFuncionalidadeAtiva, useVersaoChat } from '../hooks';
import { useMakaChat, useTema } from '../provider';
import { ReprodutorAudio } from './audio';
import { FicheiroAnexo } from './Bolha';
import { Avatar, ListaPerformante, NomeComBadge, Sheet } from './comum';
import { enviarAnexoLocal, escolherFotosEVideos } from './media';

export interface InfoConversaScreenProps {
    conversaId: string;
    onVoltar?(): void;
    /** depois de sair/eliminar — voltar à lista */
    onSaiu?(): void;
    onAbrirOutraConversa?(conversaId: string): void;
    /** ícones da status bar (o header é claro): 'escura' default, 'clara' ou null p/ a app gerir */
    barraEstado?: 'escura' | 'clara' | null;
}

/** Info da conversa/grupo estilo WhatsApp: membros, papéis, foto, renomear, sair. */
export function InfoConversaScreen({ conversaId, onVoltar, onSaiu, onAbrirOutraConversa, barraEstado = 'escura' }: InfoConversaScreenProps) {
    const { engine, api, identidade, contactos, aoVerPerfil } = useMakaChat();
    const tema = useTema();
    const insets = useSafeAreaInsets();
    const versao = useVersaoChat();
    const podeGrupos = useFuncionalidadeAtiva('grupos');
    const podeCriarConversa = useFuncionalidadeAtiva('conversas.criar');

    const [conversa, setConversa] = useState<Conversa | null>(null);
    const [renomear, setRenomear] = useState(false);
    const [novoNome, setNovoNome] = useState('');
    const [adicionarAberto, setAdicionarAberto] = useState(false);
    const [membroDe, setMembroDe] = useState<ParticipanteConversa | null>(null);

    useEffect(() => {
        void engine.storage.obterConversa(conversaId).then(setConversa);
    }, [engine, conversaId, versao]);

    const eu = conversa?.participantes.find((p) => p.id_externo === identidade.id && p.tipo === identidade.tipo) ?? null;
    const souAdmin = eu?.papel === 'dono' || eu?.papel === 'admin';
    const grupo = conversa?.tipo === 'grupo';
    const membros = (conversa?.participantes ?? []).filter((p) => !p.saiu_em && p.tipo !== 'sistema');
    const contraparte = !grupo ? membros.find((p) => p.identidade_id !== eu?.identidade_id) ?? null : null;

    const atualizar = async () => {
        const { conversa: fresca } = await api.obterConversa(conversaId);
        await engine.storage.upsertConversas([fresca]);
        setConversa(fresca);
    };

    const mudarFoto = async () => {
        const fotos = await escolherFotosEVideos();
        const foto = fotos.find((f) => f.tipo === 'foto');

        if (!foto) return;

        try {
            // token durável (30 dias) — a foto do grupo fica visível sem expirar depressa
            const anexo = await enviarAnexoLocal(api, foto, { duravel: true });

            if (anexo.url) {
                await api.atualizarGrupo(conversaId, { foto_url: anexo.url });
                await atualizar();
            }
        } catch {
            Alert.alert('Falha', 'Não foi possível mudar a foto do grupo.');
        }
    };

    const guardarNome = async () => {
        const titulo = novoNome.trim();

        if (!titulo) return;

        await api.atualizarGrupo(conversaId, { titulo }).catch(() => undefined);
        setRenomear(false);
        await atualizar();
    };

    const sairDoGrupo = () => {
        Alert.alert('Sair do grupo?', 'Deixas de receber mensagens desta conversa.', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Sair',
                style: 'destructive',
                onPress: () => {
                    void api.sairDaConversa(conversaId).then(async () => {
                        await engine.storage.removerConversa(conversaId);
                        await engine.atualizarConversas();
                        onSaiu?.();
                    });
                },
            },
        ]);
    };

    const removerMembro = (p: ParticipanteConversa) => {
        Alert.alert(`Remover ${p.nome}?`, undefined, [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Remover',
                style: 'destructive',
                onPress: () => void api.removerParticipante(conversaId, p.identidade_id).then(atualizar),
            },
        ]);
    };

    if (!conversa) return <View style={{ flex: 1, backgroundColor: tema.fundo }} />;

    return (
        <View style={{ flex: 1, backgroundColor: tema.fundo }}>
            {barraEstado != null && (
                <StatusBar animated barStyle={barraEstado === 'clara' ? 'light-content' : 'dark-content'} />
            )}
            <View style={[estilos.header, { backgroundColor: tema.superficie, paddingTop: insets.top + 8 }]}>
                {onVoltar && (
                    <Pressable onPress={onVoltar} style={{ padding: 6 }}>
                        <Ionicons name="chevron-back" size={24} color={tema.texto} />
                    </Pressable>
                )}
                <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: tema.texto }}>
                    {grupo ? 'Info do grupo' : 'Contacto'}
                </Text>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
                {/* topo: foto + nome */}
                <View style={[estilos.topo, { backgroundColor: tema.superficie }]}>
                    <Pressable onPress={grupo && souAdmin ? () => void mudarFoto() : undefined}>
                        <Avatar nome={conversa.titulo ?? '?'} url={conversa.foto_url} tamanho={96} />
                        {grupo && souAdmin && (
                            <View style={[estilos.mudarFoto, { backgroundColor: tema.primaria }]}>
                                <Ionicons name="camera" size={15} color={tema.primariaContraste} />
                            </View>
                        )}
                    </Pressable>
                    {renomear ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
                            <TextInput
                                autoFocus
                                value={novoNome}
                                onChangeText={setNovoNome}
                                style={[estilos.inputNome, { backgroundColor: tema.fundo, color: tema.texto }]}
                            />
                            <Pressable onPress={() => void guardarNome()}>
                                <Ionicons name="checkmark-circle" size={30} color={tema.primaria} />
                            </Pressable>
                        </View>
                    ) : (
                        <Pressable
                            onPress={grupo && souAdmin ? () => { setNovoNome(conversa.titulo ?? ''); setRenomear(true); } : undefined}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}
                        >
                            <Text style={{ fontSize: 20, fontWeight: '800', color: tema.texto }}>{conversa.titulo}</Text>
                            {grupo && souAdmin && <Ionicons name="pencil" size={16} color={tema.textoSuave} />}
                        </Pressable>
                    )}
                    {grupo && <Text style={{ fontSize: 13, color: tema.textoSuave, marginTop: 3 }}>{membros.length} membros</Text>}
                    {!grupo && contraparte && engine.presencaDe(contraparte.identidade_id)?.online && (
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#10b981', marginTop: 3 }}>online</Text>
                    )}
                    {/* "Ver perfil" — só quando o serviço fornece a navegação (ex.: kanda) */}
                    {!grupo && contraparte && aoVerPerfil && (
                        <Pressable
                            onPress={() => aoVerPerfil(contraparte)}
                            style={[estilos.verPerfil, { borderColor: tema.primaria }]}
                        >
                            <Ionicons name="person-circle-outline" size={18} color={tema.primaria} />
                            <Text style={{ fontSize: 14, fontWeight: '700', color: tema.primaria }}>Ver perfil</Text>
                        </Pressable>
                    )}
                </View>

                {/* membros */}
                <View style={[estilos.seccao, { backgroundColor: tema.superficie }]}>
                    <Text style={[estilos.seccaoTitulo, { color: tema.textoSuave }]}>
                        {grupo ? 'Membros' : 'Participantes'}
                    </Text>
                    {grupo && souAdmin && podeGrupos && (
                        <Pressable onPress={() => setAdicionarAberto(true)} style={estilos.membro}>
                            <View style={[estilos.addIcone, { backgroundColor: tema.primaria }]}>
                                <Ionicons name="person-add" size={18} color={tema.primariaContraste} />
                            </View>
                            <Text style={{ fontSize: 15, fontWeight: '600', color: tema.primaria }}>Adicionar membros</Text>
                        </Pressable>
                    )}
                    {membros.map((p) => {
                        const souEuMesmo = p.identidade_id === eu?.identidade_id;

                        return (
                            <Pressable key={p.identidade_id} onPress={souEuMesmo ? undefined : () => setMembroDe(p)} style={estilos.membro}>
                                <View>
                                    <Avatar nome={p.nome} url={p.foto_url} tamanho={42} />
                                    {!souEuMesmo && engine.presencaDe(p.identidade_id)?.online && (
                                        <View style={[estilos.bolinhaMembro, { borderColor: tema.superficie }]} />
                                    )}
                                </View>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <NomeComBadge nome={souEuMesmo ? 'Tu' : p.nome} metadados={p.metadados} estilo={{ fontSize: 15, fontWeight: '600', color: tema.texto }} />
                                    <Text style={{ fontSize: 12, color: tema.textoSuave }}>{rotuloTipoIdentidade(p.tipo)}</Text>
                                </View>
                                {(p.papel === 'dono' || p.papel === 'admin') && (
                                    <View style={[estilos.papel, { borderColor: tema.primaria }]}>
                                        <Text style={{ fontSize: 10.5, fontWeight: '700', color: tema.primaria }}>
                                            {p.papel === 'dono' ? 'Dono' : 'Admin'}
                                        </Text>
                                    </View>
                                )}
                            </Pressable>
                        );
                    })}
                </View>

                {/* media da conversa (Fotos/Ficheiros/Áudios/Links) */}
                <MediaDaConversa conversaId={conversaId} />

                {/* sair */}
                {grupo && (
                    <View style={[estilos.seccao, { backgroundColor: tema.superficie }]}>
                        <Pressable onPress={sairDoGrupo} style={estilos.membro}>
                            <Ionicons name="exit-outline" size={22} color="#ef4444" />
                            <Text style={{ fontSize: 15, fontWeight: '600', color: '#ef4444' }}>Sair do grupo</Text>
                        </Pressable>
                    </View>
                )}
            </ScrollView>

            {/* ações sobre um membro */}
            <Sheet
                visivel={membroDe !== null}
                aoFechar={() => setMembroDe(null)}
                titulo={membroDe?.nome}
                itens={
                    membroDe
                        ? [
                              ...(aoVerPerfil
                                  ? [{
                                        icone: 'person-circle-outline' as const,
                                        rotulo: 'Ver perfil',
                                        acao: () => aoVerPerfil(membroDe),
                                    }]
                                  : []),
                              ...(onAbrirOutraConversa && podeCriarConversa
                                  ? [{
                                        icone: 'chatbubble-outline' as const,
                                        rotulo: 'Enviar mensagem',
                                        acao: () => {
                                            const p = membroDe;
                                            void api
                                                .criarPrivada({ id_externo: p.id_externo, tipo: p.tipo, nome: p.nome })
                                                .then(async ({ conversa: nova }) => {
                                                    await engine.atualizarConversas();
                                                    onAbrirOutraConversa(nova.id);
                                                });
                                        },
                                    }]
                                  : []),
                              ...(grupo && souAdmin && membroDe.papel !== 'dono'
                                  ? [
                                        {
                                            icone: (membroDe.papel === 'admin' ? 'shield-outline' : 'shield-checkmark-outline') as 'shield-outline' | 'shield-checkmark-outline',
                                            rotulo: membroDe.papel === 'admin' ? 'Remover de administrador' : 'Tornar administrador',
                                            acao: () => {
                                                const p = membroDe;
                                                void api
                                                    .mudarPapel(conversaId, p.identidade_id, p.papel === 'admin' ? 'membro' : 'admin')
                                                    .then(atualizar)
                                                    .catch(() => Alert.alert('Falha', 'Não foi possível alterar o papel.'));
                                            },
                                        },
                                        {
                                            icone: 'person-remove-outline' as const,
                                            rotulo: 'Remover do grupo',
                                            destrutivo: true,
                                            acao: () => removerMembro(membroDe),
                                        },
                                    ]
                                  : []),
                          ]
                        : []
                }
            />

            {adicionarAberto && (
                <AdicionarMembrosSheet
                    conversa={conversa}
                    contactos={contactos}
                    aoFechar={() => setAdicionarAberto(false)}
                    aoAdicionar={async (alvos) => {
                        setAdicionarAberto(false);
                        await api.adicionarParticipantes(conversaId, alvos).catch(() => undefined);
                        await atualizar();
                    }}
                />
            )}
        </View>
    );
}

type TabMedia = 'fotos' | 'ficheiros' | 'audios' | 'links';

const TABS: { chave: TabMedia; rotulo: string }[] = [
    { chave: 'fotos', rotulo: 'Fotos' },
    { chave: 'ficheiros', rotulo: 'Ficheiros' },
    { chave: 'audios', rotulo: 'Áudios' },
    { chave: 'links', rotulo: 'Links' },
];

/** Tabs de media da conversa — fonte: GET /conversas/:id/media (hub, paginado). */
function MediaDaConversa({ conversaId }: { conversaId: string }) {
    const { api } = useMakaChat();
    const tema = useTema();
    const { width } = useWindowDimensions();
    const [tab, setTab] = useState<TabMedia>('fotos');
    const [anexos, setAnexos] = useState<(Anexo & { mensagem_id: string })[] | null>(null);
    const [links, setLinks] = useState<MensagemLink[] | null>(null);
    const [aCarregar, setACarregar] = useState(false);
    const [temMais, setTemMais] = useState(false);

    const LIMITE = 30;
    const ladoFoto = (width - 16 * 2 - 4 * 2) / 3;

    const carregar = async (maisAntesDe?: string) => {
        setACarregar(true);

        try {
            const r = await api.listarMedia(conversaId, tab, { antes_de: maisAntesDe, limite: LIMITE });

            if (tab === 'links') {
                const novos = r.links ?? [];
                setLinks((atuais) => (maisAntesDe ? [...(atuais ?? []), ...novos] : novos));
                setTemMais(novos.length === LIMITE);
            } else {
                const novos = r.anexos ?? [];
                setAnexos((atuais) => (maisAntesDe ? [...(atuais ?? []), ...novos] : novos));
                setTemMais(novos.length === LIMITE);
            }
        } catch {
            if (tab === 'links') setLinks([]);
            else setAnexos([]);
        } finally {
            setACarregar(false);
        }
    };

    useEffect(() => {
        setAnexos(null);
        setLinks(null);
        void carregar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conversaId, tab]);

    const abrirLink = (l: MensagemLink) => {
        const url = l.metadados?.url ?? dividirLinks(l.conteudo ?? '').find((p) => p.url)?.url;

        if (url) void Linking.openURL(String(url)).catch(() => undefined);
    };

    const vazio = tab === 'links' ? links !== null && links.length === 0 : anexos !== null && anexos.length === 0;

    return (
        <View style={[estilos.seccao, { backgroundColor: tema.superficie }]}>
            <Text style={[estilos.seccaoTitulo, { color: tema.textoSuave }]}>Media da conversa</Text>

            {/* tabs */}
            <View style={estilos.tabsLinha}>
                {TABS.map((t) => (
                    <Pressable
                        key={t.chave}
                        onPress={() => setTab(t.chave)}
                        style={[estilos.tab, tab === t.chave && { backgroundColor: tema.primaria }]}
                    >
                        <Text style={{ fontSize: 13, fontWeight: '700', color: tab === t.chave ? tema.primariaContraste : tema.textoSuave }}>
                            {t.rotulo}
                        </Text>
                    </Pressable>
                ))}
            </View>

            {aCarregar && anexos === null && links === null && (
                <ActivityIndicator style={{ paddingVertical: 18 }} color={tema.primaria} />
            )}
            {vazio && !aCarregar && (
                <Text style={{ paddingHorizontal: 18, paddingVertical: 14, fontSize: 13, color: tema.textoSuave }}>
                    Ainda não há {TABS.find((t) => t.chave === tab)?.rotulo.toLowerCase()} nesta conversa.
                </Text>
            )}

            {/* fotos: grelha 3 colunas */}
            {tab === 'fotos' && !!anexos?.length && (
                <View style={estilos.grelha}>
                    {anexos.map((a) =>
                        a.url ? (
                            <Pressable key={a.id} onPress={() => void Linking.openURL(a.url as string).catch(() => undefined)}>
                                <Image source={{ uri: a.url }} style={{ width: ladoFoto, height: ladoFoto, borderRadius: 8 }} />
                            </Pressable>
                        ) : null,
                    )}
                </View>
            )}

            {/* ficheiros: mesma linha das bolhas (baixa 1x, abre com o sistema) */}
            {tab === 'ficheiros' &&
                anexos?.map((a) => (
                    <View key={a.id} style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
                        <FicheiroAnexo anexo={a} minha={false} corTexto={tema.texto} />
                    </View>
                ))}

            {/* áudios: player normal */}
            {tab === 'audios' &&
                anexos?.map((a) =>
                    a.url ? (
                        <View key={a.id} style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
                            <ReprodutorAudio url={a.url} mimha={false} duracaoSegundos={a.duracao_segundos} />
                        </View>
                    ) : null,
                )}

            {/* links */}
            {tab === 'links' &&
                links?.map((l) => (
                    <Pressable key={l.id} onPress={() => abrirLink(l)} style={estilos.linkLinha}>
                        <View style={[estilos.linkIcone, { backgroundColor: `${tema.primaria}1A` }]}>
                            <Ionicons name="link" size={18} color={tema.primaria} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                            {!!l.metadados?.titulo && (
                                <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '600', color: tema.texto }}>
                                    {String(l.metadados.titulo)}
                                </Text>
                            )}
                            <Text numberOfLines={2} style={{ fontSize: 12.5, color: tema.textoSuave }}>
                                {String(l.metadados?.url ?? l.conteudo ?? '')}
                            </Text>
                        </View>
                    </Pressable>
                ))}

            {temMais && !aCarregar && (
                <Pressable
                    onPress={() => {
                        const ultimo = tab === 'links' ? links?.at(-1)?.id : anexos?.at(-1)?.id;

                        if (ultimo) void carregar(ultimo);
                    }}
                    style={{ alignItems: 'center', paddingVertical: 10 }}
                >
                    <Text style={{ fontSize: 13.5, fontWeight: '700', color: tema.primaria }}>Ver mais</Text>
                </Pressable>
            )}
        </View>
    );
}

function AdicionarMembrosSheet({ conversa, contactos, aoFechar, aoAdicionar }: {
    conversa: Conversa;
    contactos: AlvoParticipante[];
    aoFechar(): void;
    aoAdicionar(alvos: AlvoParticipante[]): Promise<void>;
}) {
    const tema = useTema();
    const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set());

    const candidatos = useMemo(() => {
        const jaNoGrupo = new Set(conversa.participantes.filter((p) => !p.saiu_em).map((p) => `${p.tipo}:${p.id_externo}`));

        return contactos.filter((c) => !jaNoGrupo.has(`${c.tipo}:${c.id_externo}`));
    }, [conversa, contactos]);

    const alvos = candidatos.filter((c) => escolhidos.has(`${c.tipo}:${c.id_externo}`));

    return (
        <Sheet visivel aoFechar={aoFechar} titulo="Adicionar membros">
            <View style={{ maxHeight: 340 }}>
                <ListaPerformante
                    data={candidatos}
                    keyExtractor={(p: AlvoParticipante) => `${p.tipo}:${p.id_externo}`}
                    estimatedItemSize={54}
                    renderItem={({ item: p }: { item: AlvoParticipante }) => {
                        const chave = `${p.tipo}:${p.id_externo}`;
                        const marcado = escolhidos.has(chave);

                        return (
                            <Pressable
                                onPress={() =>
                                    setEscolhidos((a) => {
                                        const n = new Set(a);

                                        if (marcado) n.delete(chave);
                                        else n.add(chave);

                                        return n;
                                    })
                                }
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 8 }}
                            >
                                <Ionicons name={marcado ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={marcado ? tema.primaria : tema.textoSuave} />
                                <Avatar nome={p.nome ?? p.id_externo} url={p.foto ?? null} tamanho={36} />
                                <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: tema.texto }} numberOfLines={1}>
                                    {p.nome ?? p.id_externo}
                                </Text>
                            </Pressable>
                        );
                    }}
                    ListEmptyComponent={<Text style={{ padding: 20, color: tema.textoSuave }}>Sem contactos para adicionar.</Text>}
                />
            </View>
            <Pressable
                disabled={!alvos.length}
                onPress={() => void aoAdicionar(alvos)}
                style={{ marginHorizontal: 16, marginTop: 10, borderRadius: 24, paddingVertical: 13, alignItems: 'center', backgroundColor: tema.primaria, opacity: alvos.length ? 1 : 0.4 }}
            >
                <Text style={{ color: tema.primariaContraste, fontWeight: '700', fontSize: 15 }}>
                    Adicionar{alvos.length ? ` (${alvos.length})` : ''}
                </Text>
            </Pressable>
        </Sheet>
    );
}

const estilos = StyleSheet.create({
    // paddingTop dinâmico (insets.top) aplicado inline no render
    header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 10, paddingHorizontal: 10, gap: 6 },
    topo: { alignItems: 'center', paddingVertical: 22, marginBottom: 10 },
    mudarFoto: { position: 'absolute', right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    inputNome: { minWidth: 200, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, fontSize: 16, fontWeight: '700' },
    seccao: { marginBottom: 10, paddingVertical: 6 },
    seccaoTitulo: { fontSize: 12.5, fontWeight: '700', paddingHorizontal: 18, paddingVertical: 6, textTransform: 'uppercase' },
    membro: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 8 },
    addIcone: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
    papel: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
    verPerfil: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
    bolinhaMembro: { position: 'absolute', right: -1, bottom: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#10b981', borderWidth: 2 },
    tabsLinha: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
    tab: { borderRadius: 16, paddingHorizontal: 13, paddingVertical: 6, backgroundColor: 'rgba(100,116,139,0.12)' },
    grelha: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingHorizontal: 16, paddingBottom: 8 },
    linkLinha: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 8 },
    linkIcone: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
