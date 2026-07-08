import { Ionicons } from '@expo/vector-icons';
import { Conversa, IdentidadeConfig, ParticipanteConversa } from '@hongayetu/makachat-core';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    FlatList,
    FlatListProps,
    Image,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { obterFlashList } from '../opcionais';
import { useTema } from '../provider';

// ---------------------------------------------------------------- lista performante

const flash = obterFlashList();

/** FlashList quando a app o instala (recomendado); senão FlatList. Mesmo contrato. */
export function ListaPerformante<T>(props: FlatListProps<T> & { estimatedItemSize?: number }) {
    if (flash?.FlashList) {
        const FlashList = flash.FlashList as React.ComponentType<Record<string, unknown>>;

        return <FlashList estimatedItemSize={72} {...(props as Record<string, unknown>)} />;
    }

    const { estimatedItemSize: _ignorado, ...resto } = props;

    return <FlatList {...resto} />;
}

// ---------------------------------------------------------------- avatar / nomes

export function Avatar({ nome, url, tamanho = 48 }: { nome: string; url?: string | null; tamanho?: number }) {
    const tema = useTema();

    if (url) {
        return <Image source={{ uri: url }} style={{ width: tamanho, height: tamanho, borderRadius: tamanho / 2 }} />;
    }

    return (
        <View
            style={{
                width: tamanho,
                height: tamanho,
                borderRadius: tamanho / 2,
                backgroundColor: tema.primaria,
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <Text style={{ color: tema.primariaContraste, fontWeight: '700', fontSize: tamanho * 0.42 }}>
                {(nome || '?').trim().charAt(0).toUpperCase()}
            </Text>
        </View>
    );
}

/** Nome + badge de verificação (metadados.verificado) — nem todos os serviços o usam. */
export function NomeComBadge({
    nome,
    metadados,
    estilo,
    numeroLinhas = 1,
}: {
    nome: string;
    metadados?: Record<string, unknown> | null;
    estilo?: object;
    numeroLinhas?: number;
}) {
    const tema = useTema();

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 }}>
            <Text numberOfLines={numeroLinhas} style={[{ flexShrink: 1 }, estilo]}>
                {nome}
            </Text>
            {metadados?.verificado === true && (
                <Ionicons name="checkmark-circle" size={15} color={tema.primaria} />
            )}
        </View>
    );
}

/** Contraparte de uma privada (o participante que não sou eu). */
export function contraparteDe(c: Conversa, identidade: IdentidadeConfig): ParticipanteConversa | null {
    if (c.tipo !== 'privada') return null;

    return c.participantes.find((p) => !(p.id_externo === identidade.id && p.tipo === identidade.tipo)) ?? null;
}

// ---------------------------------------------------------------- horas/datas

export function horaCurta(iso: string): string {
    const data = new Date(iso);
    const hoje = new Date();

    if (data.toDateString() === hoje.toDateString()) {
        return `${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}`;
    }

    return `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}`;
}

export function rotuloDia(iso: string): string {
    const data = new Date(iso);
    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(hoje.getDate() - 1);

    if (data.toDateString() === hoje.toDateString()) return 'Hoje';
    if (data.toDateString() === ontem.toDateString()) return 'Ontem';

    return data.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function duracaoMmSs(segundos: number): string {
    return `${String(Math.floor(segundos / 60)).padStart(2, '0')}:${String(Math.floor(segundos % 60)).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- sheet (Modal + Animated, sem deps)

export interface ItemSheet {
    icone: keyof typeof Ionicons.glyphMap;
    rotulo: string;
    destrutivo?: boolean;
    acao(): void;
}

/** Bottom sheet estilo WhatsApp: fundo escurecido, cartão a subir, itens com ícone. */
export function Sheet({
    visivel,
    aoFechar,
    titulo,
    itens,
    children,
}: {
    visivel: boolean;
    aoFechar(): void;
    titulo?: string;
    itens?: ItemSheet[];
    children?: React.ReactNode;
}) {
    const tema = useTema();
    const subida = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visivel) {
            subida.setValue(0);
            Animated.spring(subida, { toValue: 1, useNativeDriver: true, damping: 22, stiffness: 260 }).start();
        }
    }, [visivel, subida]);

    return (
        <Modal transparent visible={visivel} animationType="fade" onRequestClose={aoFechar}>
            <Pressable style={estilos.sheetFundo} onPress={aoFechar}>
                <Animated.View
                    style={[
                        estilos.sheetCartao,
                        { backgroundColor: tema.superficie },
                        { transform: [{ translateY: subida.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) }] },
                    ]}
                >
                    <Pressable onPress={() => undefined}>
                        <View style={estilos.sheetPega} />
                        {titulo ? (
                            <Text style={[estilos.sheetTitulo, { color: tema.textoSuave }]} numberOfLines={1}>
                                {titulo}
                            </Text>
                        ) : null}
                        {itens?.map((item) => (
                            <Pressable
                                key={item.rotulo}
                                onPress={() => {
                                    aoFechar();
                                    item.acao();
                                }}
                                style={({ pressed }: { pressed: boolean }) => [estilos.sheetItem, pressed && { backgroundColor: 'rgba(0,0,0,0.05)' }]}
                            >
                                <Ionicons
                                    name={item.icone}
                                    size={21}
                                    color={item.destrutivo ? '#ef4444' : tema.textoSuave}
                                />
                                <Text style={{ fontSize: 15, color: item.destrutivo ? '#ef4444' : tema.texto }}>
                                    {item.rotulo}
                                </Text>
                            </Pressable>
                        ))}
                        {children}
                    </Pressable>
                </Animated.View>
            </Pressable>
        </Modal>
    );
}

// ---------------------------------------------------------------- badges pequenos

export function BadgeNaoLidas({ contagem }: { contagem: number }) {
    const tema = useTema();

    if (contagem <= 0) return null;

    return (
        <View style={[estilos.badge, { backgroundColor: tema.primaria }]}>
            <Text style={{ color: tema.primariaContraste, fontSize: 11, fontWeight: '700' }}>
                {contagem > 99 ? '99+' : contagem}
            </Text>
        </View>
    );
}

/** Pulso suave (chamada a decorrer, a tocar...). */
export function Pulso({ children }: { children: React.ReactNode }) {
    const escala = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const ciclo = Animated.loop(
            Animated.sequence([
                Animated.timing(escala, { toValue: 1.18, duration: 620, useNativeDriver: true }),
                Animated.timing(escala, { toValue: 1, duration: 620, useNativeDriver: true }),
            ]),
        );
        ciclo.start();

        return () => ciclo.stop();
    }, [escala]);

    return <Animated.View style={{ transform: [{ scale: escala }] }}>{children}</Animated.View>;
}

const estilos = StyleSheet.create({
    sheetFundo: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
    sheetCartao: {
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        paddingBottom: 28,
        paddingTop: 8,
    },
    sheetPega: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(100,116,139,0.35)',
        marginBottom: 6,
    },
    sheetTitulo: { paddingHorizontal: 20, paddingVertical: 6, fontSize: 13, fontWeight: '600' },
    sheetItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 13 },
    badge: {
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        paddingHorizontal: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
