import { Ionicons } from '@expo/vector-icons';
import { AlvoParticipante, Conversa } from '@hongayetu/makachat-core';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useConversas, useFuncionalidadeAtiva, useSemLigacao, useVersaoChat } from '../hooks';
import { useMakaChat, useTema } from '../provider';
import {
    Avatar,
    BadgeNaoLidas,
    contraparteDe,
    horaCurta,
    ItemSheet,
    ListaPerformante,
    NomeComBadge,
    Pulso,
    Sheet,
} from './comum';

/** Tudo o que o topo (pesquisa + arquivadas) precisa — passado ao renderTopo. */
export interface TopoConversasContexto {
    busca: string;
    setBusca(q: string): void;
    /** undefined quando não aplicável (já nas arquivadas ou sem onAbrirArquivadas) */
    abrirArquivadas?(): void;
    arquivadas: boolean;
}

export interface ConversasScreenProps {
    arquivadas?: boolean;
    onAbrirConversa(conversa: Conversa): void;
    /** abre esta conversa ao montar (deep link/push) — equivalente mobile do ?conversa= */
    conversaInicial?: string | null;
    /** navegar para o modo arquivadas (a app decide: outro ecrã ou estado local) */
    onAbrirArquivadas?(): void;
    textoVazio?: string;
    /**
     * Topo CUSTOM da app (pesquisa/arquivadas ao estilo dela): recebe a busca
     * controlada e a ação de arquivadas. Sem isto, o topo interno padrão é usado.
     */
    renderTopo?(ctx: TopoConversasContexto): React.ReactNode;
    /**
     * Nova conversa CUSTOM: o FAB chama isto (ex.: navegar para um ecrã com o
     * NovaConversaScreen). Sem isto, abre o sheet interno de contactos.
     */
    onNovaConversa?(): void;
}

const SEMPRE = '9999-12-31T00:00:00.000Z';

/** Lista de conversas estilo WhatsApp: pesquisa, badges, long-press, FAB nova conversa. */
export function ConversasScreen({ arquivadas = false, onAbrirConversa, conversaInicial, onAbrirArquivadas, textoVazio, renderTopo, onNovaConversa }: ConversasScreenProps) {
    const { engine, api, identidade, contactos } = useMakaChat();
    const tema = useTema();
    const semLigacao = useSemLigacao();
    const conversas = useConversas(arquivadas);
    const versao = useVersaoChat();
    const podeGrupos = useFuncionalidadeAtiva('grupos');
    const podeEliminar = useFuncionalidadeAtiva('conversas.eliminar');
    // serviços com conversas só de sistema (ex.: via encomenda) não criam
    const podeCriar = useFuncionalidadeAtiva('conversas.criar');

    const [busca, setBusca] = useState('');
    const [resultadosServidor, setResultadosServidor] = useState<Conversa[] | null>(null);
    const [menuDe, setMenuDe] = useState<Conversa | null>(null);
    const [silenciarDe, setSilenciarDe] = useState<Conversa | null>(null);
    const [novaAberta, setNovaAberta] = useState(false);
    const aPaginar = useRef(false);
    const fimDaLista = useRef(false);

    // deep link: abre a conversa pedida mesmo que não esteja na lista recente
    useEffect(() => {
        if (!conversaInicial) return;

        void engine.entrarConversa(conversaInicial).then(async () => {
            const c = await engine.storage.obterConversa(conversaInicial);

            if (c) onAbrirConversa(c);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conversaInicial]);

    // pesquisa no servidor (debounce) — apanha conversas fora do cache local
    useEffect(() => {
        const q = busca.trim();

        if (!q) {
            setResultadosServidor(null);

            return;
        }

        const timer = setTimeout(() => {
            void api
                .listarConversas({ q, arquivadas, limite: 30 })
                .then(async (r) => {
                    setResultadosServidor(r.conversas);
                    await engine.storage.upsertConversas(r.conversas);
                })
                .catch(() => setResultadosServidor(null));
        }, 300);

        return () => clearTimeout(timer);
    }, [api, engine, busca, arquivadas]);

    const visiveis = useMemo(() => {
        const q = busca.trim().toLowerCase();

        if (q && resultadosServidor) return resultadosServidor;
        if (!q) return conversas;

        return conversas.filter((c) => (c.titulo ?? '').toLowerCase().includes(q));
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

    const preferencia = async (c: Conversa, dados: { arquivada?: boolean; fixada?: boolean }) => {
        await api.atualizarPreferencias(c.id, dados).catch(() => undefined);
        await engine.storage.upsertConversas([
            { ...c, participante: c.participante ? { ...c.participante, ...dados } : c.participante },
        ]);
        void engine.atualizarConversas();
    };

    const itensMenu = (c: Conversa): ItemSheet[] => {
        const silenciada = !!c.participante?.silenciada_ate && new Date(c.participante.silenciada_ate) > new Date();
        const itens: ItemSheet[] = [
            {
                icone: 'mail-unread-outline',
                rotulo: 'Marcar como não lida',
                acao: () => void engine.marcarNaoLida(c.id).catch(() => undefined),
            },
            {
                icone: c.participante?.fixada ? 'pin' : 'pin-outline',
                rotulo: c.participante?.fixada ? 'Desafixar' : 'Fixar',
                acao: () => void preferencia(c, { fixada: !c.participante?.fixada }),
            },
            silenciada
                ? { icone: 'notifications-outline', rotulo: 'Reativar notificações', acao: () => void engine.silenciarConversa(c.id, null) }
                : { icone: 'notifications-off-outline', rotulo: 'Silenciar…', acao: () => setSilenciarDe(c) },
            {
                icone: arquivadas ? 'archive' : 'archive-outline',
                rotulo: arquivadas ? 'Desarquivar' : 'Arquivar',
                acao: () => void preferencia(c, { arquivada: !arquivadas }),
            },
        ];

        if (podeEliminar) {
            itens.push({
                icone: 'trash-outline',
                rotulo: 'Eliminar conversa',
                destrutivo: true,
                acao: () =>
                    Alert.alert('Eliminar conversa?', 'O histórico desaparece para ti. A outra pessoa mantém a conversa dela.', [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Eliminar', style: 'destructive', onPress: () => void engine.eliminarConversa(c.id) },
                    ]),
            });
        }

        return itens;
    };

    const item = (c: Conversa) => {
        const naoLidas = c.participante?.mensagens_nao_lidas ?? 0;
        const silenciada = !!c.participante?.silenciada_ate && new Date(c.participante.silenciada_ate) > new Date();
        const contraparte = contraparteDe(c, identidade);

        return (
            <Pressable
                key={c.id}
                onPress={() => onAbrirConversa(c)}
                onLongPress={() => setMenuDe(c)}
                style={({ pressed }: { pressed: boolean }) => [estilos.item, pressed && { backgroundColor: 'rgba(0,0,0,0.04)' }]}
            >
                <Avatar nome={c.titulo ?? '?'} url={c.foto_url} tamanho={52} />
                <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={estilos.linhaTopo}>
                        <NomeComBadge
                            nome={c.titulo ?? 'Conversa'}
                            metadados={contraparte?.metadados}
                            estilo={[estilos.titulo, { color: tema.texto }, naoLidas > 0 && { fontWeight: '800' }]}
                        />
                        <Text style={{ fontSize: 12, color: naoLidas > 0 ? tema.primaria : tema.textoSuave }}>
                            {horaCurta(c.ultima_atividade_em)}
                        </Text>
                    </View>
                    <View style={estilos.linhaBaixo}>
                        <Text
                            numberOfLines={1}
                            style={{ flex: 1, fontSize: 13.5, color: tema.textoSuave, fontWeight: naoLidas > 0 ? '600' : '400' }}
                        >
                            {previewConversa(c)}
                        </Text>
                        {c.chamada_ativa && (
                            <Pulso>
                                <Ionicons name="call" size={15} color="#10b981" />
                            </Pulso>
                        )}
                        {silenciada && <Ionicons name="notifications-off" size={14} color={tema.textoSuave} />}
                        {c.participante?.fixada && <Ionicons name="pin" size={14} color={tema.textoSuave} />}
                        <BadgeNaoLidas contagem={naoLidas} />
                    </View>
                </View>
            </Pressable>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: tema.superficie }}>
            {semLigacao && (
                <View style={estilos.offline}>
                    <Text style={estilos.offlineTexto}>Sem ligação — a reconectar…</Text>
                </View>
            )}

            {/* topo: custom da app (renderTopo) ou pesquisa + arquivadas padrão */}
            {renderTopo ? (
                renderTopo({
                    busca,
                    setBusca,
                    abrirArquivadas: !arquivadas && onAbrirArquivadas ? onAbrirArquivadas : undefined,
                    arquivadas,
                })
            ) : (
            <>
            {/* pesquisa */}
            <View style={[estilos.pesquisa, { backgroundColor: tema.fundo }]}>
                <Ionicons name="search" size={17} color={tema.textoSuave} />
                <TextInput
                    value={busca}
                    onChangeText={setBusca}
                    placeholder="Pesquisar conversas"
                    placeholderTextColor={tema.textoSuave}
                    style={{ flex: 1, fontSize: 15, color: tema.texto, paddingVertical: 8 }}
                />
                {busca.length > 0 && (
                    <Pressable onPress={() => setBusca('')}>
                        <Ionicons name="close-circle" size={18} color={tema.textoSuave} />
                    </Pressable>
                )}
            </View>

            {/* atalho para arquivadas (estilo WhatsApp) */}
            {!arquivadas && onAbrirArquivadas && (
                <Pressable onPress={onAbrirArquivadas} style={({ pressed }: { pressed: boolean }) => [estilos.arquivadas, pressed && { opacity: 0.6 }]}>
                    <Ionicons name="archive-outline" size={19} color={tema.textoSuave} />
                    <Text style={{ fontSize: 14.5, fontWeight: '600', color: tema.texto }}>Arquivadas</Text>
                </Pressable>
            )}
            </>
            )}

            <ListaPerformante
                data={visiveis}
                keyExtractor={(c: Conversa) => c.id}
                renderItem={({ item: c }: { item: Conversa }) => item(c)}
                onEndReached={() => void paginar()}
                onEndReachedThreshold={0.4}
                extraData={versao}
                estimatedItemSize={72}
                ListEmptyComponent={
                    <Text style={{ textAlign: 'center', marginTop: 48, color: tema.textoSuave }}>
                        {textoVazio ?? (arquivadas ? 'Sem conversas arquivadas.' : 'Sem conversas — começa uma nova.')}
                    </Text>
                }
            />

            {/* FAB nova conversa */}
            {!arquivadas && podeCriar && (
                <Pressable
                    onPress={() => (onNovaConversa ? onNovaConversa() : setNovaAberta(true))}
                    style={({ pressed }: { pressed: boolean }) => [estilos.fab, { backgroundColor: tema.primaria }, pressed && { transform: [{ scale: 0.94 }] }]}
                >
                    <Ionicons name="chatbubble-ellipses" size={24} color={tema.primariaContraste} />
                </Pressable>
            )}

            {/* menu long-press */}
            <Sheet visivel={menuDe !== null} aoFechar={() => setMenuDe(null)} titulo={menuDe?.titulo ?? undefined} itens={menuDe ? itensMenu(menuDe) : []} />

            {/* opções de silenciar */}
            <Sheet
                visivel={silenciarDe !== null}
                aoFechar={() => setSilenciarDe(null)}
                titulo="Silenciar notificações"
                itens={
                    silenciarDe
                        ? [
                              { icone: 'time-outline', rotulo: '8 horas', acao: () => void engine.silenciarConversa(silenciarDe.id, new Date(Date.now() + 8 * 3600_000).toISOString()) },
                              { icone: 'time-outline', rotulo: '1 semana', acao: () => void engine.silenciarConversa(silenciarDe.id, new Date(Date.now() + 7 * 86400_000).toISOString()) },
                              { icone: 'notifications-off-outline', rotulo: 'Sempre', acao: () => void engine.silenciarConversa(silenciarDe.id, SEMPRE) },
                          ]
                        : []
                }
            />

            <NovaConversaSheet
                visivel={novaAberta}
                aoFechar={() => setNovaAberta(false)}
                conversas={conversas}
                contactos={contactos}
                podeGrupos={podeGrupos}
                aoCriada={(c) => {
                    setNovaAberta(false);
                    onAbrirConversa(c);
                }}
            />
        </View>
    );
}

// ---------------------------------------------------------------- nova conversa (1 → privada, 2+ → grupo)

function NovaConversaSheet({ visivel, aoFechar, conversas, contactos, podeGrupos, aoCriada }: {
    visivel: boolean;
    aoFechar(): void;
    conversas: Conversa[];
    contactos: AlvoParticipante[];
    podeGrupos: boolean;
    aoCriada(c: Conversa): void;
}) {
    const { api, engine, identidade } = useMakaChat();
    const tema = useTema();
    const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set());
    const [nome, setNome] = useState('');

    const pessoas = useMemo(() => {
        const mapa = new Map<string, AlvoParticipante>();

        for (const c of conversas) {
            for (const p of c.participantes) {
                if (p.tipo === 'sistema') continue;
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
    const nomePadrao = membros.map((p) => (p.nome ?? p.id_externo).split(' ')[0]).join(', ');

    const criar = async () => {
        if (!membros.length) return;

        const { conversa } = grupo
            ? await api.criarGrupo(nome.trim() || nomePadrao, membros)
            : await api.criarPrivada({ id_externo: membros[0].id_externo, tipo: membros[0].tipo, nome: membros[0].nome });
        await engine.atualizarConversas();
        setEscolhidos(new Set());
        setNome('');
        aoCriada(conversa);
    };

    return (
        <Sheet visivel={visivel} aoFechar={aoFechar} titulo="Nova conversa">
            {podeGrupos && (
                <Text style={{ paddingHorizontal: 20, paddingBottom: 6, fontSize: 12.5, color: tema.textoSuave }}>
                    Escolhe uma pessoa — ou várias para criar um grupo.
                </Text>
            )}
            {grupo && (
                <TextInput
                    value={nome}
                    onChangeText={setNome}
                    placeholder={`Nome do grupo (padrão: ${nomePadrao})`}
                    placeholderTextColor={tema.textoSuave}
                    style={[estilos.inputNome, { backgroundColor: tema.fundo, color: tema.texto }]}
                />
            )}
            <View style={{ maxHeight: 340 }}>
                <ListaPerformante
                    data={pessoas}
                    keyExtractor={(p: AlvoParticipante) => `${p.tipo}:${p.id_externo}`}
                    estimatedItemSize={56}
                    renderItem={({ item: p }: { item: AlvoParticipante }) => {
                        const chave = `${p.tipo}:${p.id_externo}`;
                        const marcado = escolhidos.has(chave);

                        return (
                            <Pressable
                                onPress={() =>
                                    setEscolhidos((a) => {
                                        if (marcado) {
                                            const n = new Set(a);
                                            n.delete(chave);

                                            return n;
                                        }

                                        return podeGrupos ? new Set(a).add(chave) : new Set([chave]);
                                    })
                                }
                                style={({ pressed }: { pressed: boolean }) => [estilos.pessoa, pressed && { backgroundColor: 'rgba(0,0,0,0.04)' }]}
                            >
                                <Ionicons
                                    name={marcado ? 'checkmark-circle' : 'ellipse-outline'}
                                    size={22}
                                    color={marcado ? tema.primaria : tema.textoSuave}
                                />
                                <Avatar nome={p.nome ?? p.id_externo} url={p.foto ?? null} tamanho={38} />
                                <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: tema.texto }} numberOfLines={1}>
                                    {p.nome ?? p.id_externo}
                                </Text>
                                <Text style={{ fontSize: 12, color: tema.textoSuave }}>{p.tipo}</Text>
                            </Pressable>
                        );
                    }}
                    ListEmptyComponent={
                        <Text style={{ padding: 20, color: tema.textoSuave }}>Sem contactos conhecidos.</Text>
                    }
                />
            </View>
            <Pressable
                disabled={!membros.length}
                onPress={() => void criar()}
                style={[estilos.botaoCriar, { backgroundColor: tema.primaria, opacity: membros.length ? 1 : 0.4 }]}
            >
                <Text style={{ color: tema.primariaContraste, fontWeight: '700', fontSize: 15 }}>
                    {grupo ? `Criar grupo (${escolhidos.size})` : 'Iniciar conversa'}
                </Text>
            </Pressable>
        </Sheet>
    );
}

export function previewConversa(c: Conversa): string {
    const u = c.ultima_mensagem;

    if (!u) return '';
    if (u.eliminada) return '🚫 Mensagem eliminada';

    const p: Record<string, string> = {
        foto: '📷 Foto',
        video: '🎬 Vídeo',
        audio: '🎤 Mensagem de voz',
        ficheiro: '📎 Ficheiro',
        partilha: '🔗 Partilha',
        link: '🔗 Link',
    };

    return u.tipo === 'texto' || u.tipo === 'sistema' || u.tipo === 'chamada' ? (u.conteudo ?? '') : (p[u.tipo] ?? '');
}

const estilos = StyleSheet.create({
    offline: { backgroundColor: '#fef3c7', paddingVertical: 5, alignItems: 'center' },
    offlineTexto: { color: '#92400e', fontSize: 12, fontWeight: '600' },
    pesquisa: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginHorizontal: 14,
        marginVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 22,
    },
    arquivadas: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 10 },
    item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 9 },
    linhaTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    linhaBaixo: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
    titulo: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
    fab: {
        position: 'absolute',
        right: 18,
        bottom: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },
    inputNome: {
        marginHorizontal: 16,
        marginBottom: 8,
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 15,
    },
    pessoa: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 9 },
    botaoCriar: {
        marginHorizontal: 16,
        marginTop: 10,
        borderRadius: 24,
        paddingVertical: 13,
        alignItems: 'center',
    },
});
