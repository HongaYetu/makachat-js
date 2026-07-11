import { Ionicons } from '@expo/vector-icons';
import { AlvoParticipante, Conversa } from '@hongayetu/makachat-core';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConversas, useFuncionalidadeAtiva } from '../hooks';
import { useMakaChat, useTema } from '../provider';
import { Avatar, ListaPerformante } from './comum';

export interface NovaConversaScreenProps {
    onVoltar(): void;
    /** conversa criada (privada ou grupo) — a app navega para o chat */
    onCriada(conversa: Conversa): void;
    /**
     * Pesquisa de contactos NO serviço (API da app): recebe o texto e devolve
     * alvos. Sem esta prop, a pesquisa filtra localmente as sugestões.
     */
    pesquisarContactos?(q: string): Promise<AlvoParticipante[]>;
    /** rótulo da secção sem pesquisa (padrão: "Sugestões") */
    textoSugestoes?: string;
}

const DEBOUNCE_MS = 350;

/**
 * Ecrã "Nova conversa" completo do SDK: sugestões (contactos do provider +
 * pessoas das conversas existentes), pesquisa server-side delegada à app e
 * modo grupo com seleção múltipla. A app só fornece dados e navegação.
 */
export function NovaConversaScreen({ onVoltar, onCriada, pesquisarContactos, textoSugestoes = 'Sugestões' }: NovaConversaScreenProps) {
    const { api, engine, contactos, identidade } = useMakaChat();
    const tema = useTema();
    const insets = useSafeAreaInsets();
    const conversas = useConversas(false);
    const podeGrupos = useFuncionalidadeAtiva('grupos');

    const [busca, setBusca] = useState('');
    const [resultados, setResultados] = useState<AlvoParticipante[] | null>(null);
    const [aPesquisar, setAPesquisar] = useState(false);
    const [modoGrupo, setModoGrupo] = useState(false);
    const [escolhidos, setEscolhidos] = useState<Map<string, AlvoParticipante>>(new Map());
    const [nomeGrupo, setNomeGrupo] = useState('');
    const [aCriar, setACriar] = useState(false);
    const pedidoAtual = useRef(0);

    // sugestões: contactos fornecidos pela app + pessoas com quem já falo
    const sugestoes = useMemo(() => {
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

    // pesquisa: no serviço (debounce) quando a app fornece; senão filtro local
    useEffect(() => {
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
            void pesquisarContactos(q)
                .then((lista) => {
                    if (pedidoAtual.current !== pedido) return; // resposta obsoleta

                    setResultados(lista.filter((p) => !(p.id_externo === identidade.id && p.tipo === identidade.tipo)));
                })
                .catch(() => {
                    if (pedidoAtual.current === pedido) setResultados([]);
                })
                .finally(() => {
                    if (pedidoAtual.current === pedido) setAPesquisar(false);
                });
        }, DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [busca, pesquisarContactos, sugestoes, identidade]);

    const lista = busca.trim() ? (resultados ?? []) : sugestoes;

    const criarPrivada = async (alvo: AlvoParticipante) => {
        if (aCriar) return;

        setACriar(true);

        try {
            const { conversa } = await api.criarPrivada(alvo);
            await engine.atualizarConversas();
            onCriada(conversa);
        } catch (e) {
            // 403 do hub = bloqueios/privacidade (autorização de contacto)
            Alert.alert('Não foi possível iniciar a conversa', (e as Error)?.message ?? 'Tenta de novo.');
        } finally {
            setACriar(false);
        }
    };

    const criarGrupo = async () => {
        const membros = [...escolhidos.values()];

        if (aCriar || membros.length < 2) return;

        setACriar(true);

        try {
            const nomePadrao = membros.map((p) => (p.nome ?? p.id_externo).split(' ')[0]).join(', ');
            const { conversa } = await api.criarGrupo(nomeGrupo.trim() || nomePadrao, membros);
            await engine.atualizarConversas();
            onCriada(conversa);
        } catch (e) {
            Alert.alert('Não foi possível criar o grupo', (e as Error)?.message ?? 'Tenta de novo.');
        } finally {
            setACriar(false);
        }
    };

    const alternarEscolhido = (p: AlvoParticipante) => {
        const chave = `${p.tipo}:${p.id_externo}`;

        setEscolhidos((atual) => {
            const novo = new Map(atual);

            if (novo.has(chave)) novo.delete(chave);
            else novo.set(chave, p);

            return novo;
        });
    };

    return (
        <View style={{ flex: 1, backgroundColor: tema.fundo }}>
            {/* header com pesquisa embutida */}
            <View style={[estilos.header, { paddingTop: insets.top + 8, backgroundColor: tema.superficie }]}>
                <Pressable onPress={onVoltar} style={{ padding: 6 }} hitSlop={8}>
                    <Ionicons name="arrow-back" size={24} color={tema.texto} />
                </Pressable>
                <View style={[estilos.pesquisa, { backgroundColor: tema.fundo }]}>
                    <Ionicons name="search" size={17} color={tema.textoSuave} />
                    <TextInput
                        value={busca}
                        onChangeText={setBusca}
                        placeholder="Pesquisar pessoas"
                        placeholderTextColor={tema.textoSuave}
                        style={{ flex: 1, fontSize: 15, color: tema.texto, paddingVertical: 9 }}
                        returnKeyType="search"
                    />
                    {aPesquisar ? (
                        <ActivityIndicator size="small" color={tema.textoSuave} />
                    ) : busca.length > 0 ? (
                        <Pressable onPress={() => setBusca('')} hitSlop={6}>
                            <Ionicons name="close-circle" size={18} color={tema.textoSuave} />
                        </Pressable>
                    ) : null}
                </View>
            </View>

            {/* modo grupo: entrada + nome */}
            {podeGrupos && !modoGrupo && (
                <Pressable onPress={() => setModoGrupo(true)} style={[estilos.linhaGrupo, { backgroundColor: tema.superficie }]}>
                    <View style={[estilos.iconeGrupo, { backgroundColor: tema.primaria }]}>
                        <Ionicons name="people" size={20} color={tema.primariaContraste} />
                    </View>
                    <Text style={{ fontSize: 15.5, fontWeight: '600', color: tema.texto }}>Novo grupo</Text>
                </Pressable>
            )}
            {modoGrupo && (
                <View style={[estilos.barraGrupo, { backgroundColor: tema.superficie }]}>
                    <TextInput
                        value={nomeGrupo}
                        onChangeText={setNomeGrupo}
                        placeholder="Nome do grupo (opcional)"
                        placeholderTextColor={tema.textoSuave}
                        style={[estilos.inputNome, { backgroundColor: tema.fundo, color: tema.texto }]}
                    />
                    <Pressable
                        onPress={() => {
                            setModoGrupo(false);
                            setEscolhidos(new Map());
                            setNomeGrupo('');
                        }}
                        hitSlop={8}
                        style={{ padding: 6 }}
                    >
                        <Ionicons name="close" size={22} color={tema.textoSuave} />
                    </Pressable>
                </View>
            )}

            {!busca.trim() && (
                <Text style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, fontSize: 12.5, fontWeight: '700', color: tema.textoSuave, textTransform: 'uppercase' }}>
                    {textoSugestoes}
                </Text>
            )}

            <ListaPerformante
                data={lista}
                keyExtractor={(p: AlvoParticipante) => `${p.tipo}:${p.id_externo}`}
                estimatedItemSize={62}
                renderItem={({ item: p }: { item: AlvoParticipante }) => {
                    const marcado = escolhidos.has(`${p.tipo}:${p.id_externo}`);

                    return (
                        <Pressable
                            disabled={aCriar}
                            onPress={() => (modoGrupo ? alternarEscolhido(p) : void criarPrivada(p))}
                            style={({ pressed }: { pressed: boolean }) => [estilos.pessoa, pressed && { backgroundColor: 'rgba(0,0,0,0.05)' }]}
                        >
                            {modoGrupo && (
                                <Ionicons
                                    name={marcado ? 'checkmark-circle' : 'ellipse-outline'}
                                    size={22}
                                    color={marcado ? tema.primaria : tema.textoSuave}
                                />
                            )}
                            <Avatar nome={p.nome ?? p.id_externo} url={p.foto ?? null} tamanho={44} />
                            <Text style={{ flex: 1, fontSize: 15.5, fontWeight: '600', color: tema.texto }} numberOfLines={1}>
                                {p.nome ?? p.id_externo}
                            </Text>
                        </Pressable>
                    );
                }}
                ListEmptyComponent={
                    <Text style={{ padding: 24, textAlign: 'center', color: tema.textoSuave }}>
                        {busca.trim()
                            ? aPesquisar
                                ? 'A pesquisar…'
                                : 'Sem resultados.'
                            : 'Sem sugestões ainda — usa a pesquisa.'}
                    </Text>
                }
                contentContainerStyle={{ paddingBottom: modoGrupo ? 96 : 24 }}
            />

            {/* criar grupo (fixo em baixo) */}
            {modoGrupo && (
                <View style={[estilos.rodapeGrupo, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                    <Pressable
                        disabled={escolhidos.size < 2 || aCriar}
                        onPress={() => void criarGrupo()}
                        style={[estilos.botaoCriar, { backgroundColor: tema.primaria, opacity: escolhidos.size >= 2 && !aCriar ? 1 : 0.4 }]}
                    >
                        {aCriar ? (
                            <ActivityIndicator color={tema.primariaContraste} />
                        ) : (
                            <Text style={{ color: tema.primariaContraste, fontWeight: '700', fontSize: 15 }}>
                                Criar grupo ({escolhidos.size})
                            </Text>
                        )}
                    </Pressable>
                </View>
            )}
        </View>
    );
}

const estilos = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 8,
        paddingBottom: 10,
    },
    pesquisa: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 21,
        paddingHorizontal: 12,
        marginRight: 6,
    },
    linhaGrupo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    iconeGrupo: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    barraGrupo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    inputNome: {
        flex: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 9,
        fontSize: 14.5,
    },
    pessoa: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 9,
    },
    rodapeGrupo: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 16,
        paddingTop: 10,
    },
    botaoCriar: {
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 14,
        paddingVertical: 13,
    },
});
