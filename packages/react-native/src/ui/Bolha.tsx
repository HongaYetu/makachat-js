import { Ionicons } from '@expo/vector-icons';
import { Anexo, Mensagem, MetadadosPartilha, ParticipanteConversa } from '@hongayetu/makachat-core';
import React, { useMemo, useRef, useState } from 'react';
import {
    Animated,
    Image,
    Linking,
    PanResponder,
    Pressable,
    StyleSheet,
    Text,
    Vibration,
    View,
} from 'react-native';
import { useMakaChat, useTema } from '../provider';
import { ReprodutorAudio } from './audio';
import { Avatar, duracaoMmSs, horaCurta, NomeComBadge } from './comum';
import { tamanhoLegivel } from './media';

/** ids UUIDv7 são ordenáveis — a comparação de watermarks é lexicográfica. */
function idMaiorOuIgual(watermark: string | null, mensagemId: string): boolean {
    return !!watermark && watermark >= mensagemId;
}

export function Ticks({ mensagem, outros, cor }: { mensagem: Mensagem; outros: ParticipanteConversa[]; cor: string }) {
    if (mensagem.estado_envio === 'a_enviar') return <Ionicons name="time-outline" size={13} color={cor} />;
    if (mensagem.estado_envio === 'falhou') return <Ionicons name="alert-circle-outline" size={13} color="#fca5a5" />;

    const entregue = outros.some((p) => idMaiorOuIgual(p.ultima_entrega_mensagem_id, mensagem.id));
    const lida = outros.some((p) => idMaiorOuIgual(p.ultima_leitura_mensagem_id, mensagem.id));

    if (lida) return <Ionicons name="checkmark-done" size={14} color="#38bdf8" />;
    if (entregue) return <Ionicons name="checkmark-done" size={14} color={cor} />;

    return <Ionicons name="checkmark" size={14} color={cor} />;
}

function agruparReacoes(reacoes: { identidade_id: string; emoji: string }[]) {
    const mapa = new Map<string, number>();

    for (const r of reacoes) mapa.set(r.emoji, (mapa.get(r.emoji) ?? 0) + 1);

    return [...mapa.entries()].map(([emoji, contagem]) => ({ emoji, contagem }));
}

// ---------------------------------------------------------------- cartões

export function CartaoRegistoChamada({ mensagem, aoLigar }: { mensagem: Mensagem; aoLigar?(tipo: 'audio' | 'video'): void }) {
    const tema = useTema();
    const meta = (mensagem.metadados ?? {}) as { chamada_tipo?: string; resultado?: string; duracao_segundos?: number | null };
    const video = meta.chamada_tipo === 'video';
    const atendida = meta.resultado === 'atendida';

    return (
        <View style={[estilos.cartaoChamada, { backgroundColor: tema.superficie }]}>
            <View style={[estilos.chamadaIcone, { backgroundColor: atendida ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)' }]}>
                <Ionicons
                    name={video ? (atendida ? 'videocam' : 'videocam-off') : (atendida ? 'call' : 'call-outline')}
                    size={18}
                    color={atendida ? '#10b981' : '#ef4444'}
                />
            </View>
            <View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: tema.texto }}>Chamada de {video ? 'vídeo' : 'voz'}</Text>
                <Text style={{ fontSize: 12, color: atendida ? tema.textoSuave : '#ef4444', fontWeight: atendida ? '400' : '700' }}>
                    {atendida ? `Duração ${duracaoMmSs(meta.duracao_segundos ?? 0)}` : 'Não atendida'} · {horaCurta(mensagem.criada_em)}
                </Text>
            </View>
            {aoLigar && (
                <Pressable onPress={() => aoLigar(video ? 'video' : 'audio')} style={[estilos.chamadaLigar, { backgroundColor: tema.primaria }]}>
                    <Ionicons name={video ? 'videocam' : 'call'} size={17} color={tema.primariaContraste} />
                </Pressable>
            )}
        </View>
    );
}

function CartaoPartilha({ mensagem, minha }: { mensagem: Mensagem; minha: boolean }) {
    const tema = useTema();
    const { aoAbrirPartilha } = useMakaChat();
    const meta = (mensagem.metadados ?? {}) as MetadadosPartilha;

    const abrir = () => {
        if (aoAbrirPartilha) return aoAbrirPartilha(meta);
        if (meta.url) void Linking.openURL(meta.url).catch(() => undefined);
    };

    return (
        <Pressable onPress={abrir} style={[estilos.partilha, { backgroundColor: minha ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.05)' }]}>
            {meta.imagem_url ? <Image source={{ uri: meta.imagem_url }} style={{ width: 62, height: 62 }} /> : null}
            <View style={{ flex: 1, padding: 9, justifyContent: 'center' }}>
                <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: minha ? tema.bolhaMinhaTexto : tema.texto }}>
                    {String(meta.titulo ?? meta.url ?? 'Partilha')}
                </Text>
                {meta.subtitulo ? (
                    <Text numberOfLines={1} style={{ fontSize: 12, color: minha ? tema.bolhaMinhaTexto : tema.textoSuave, opacity: 0.8 }}>
                        {meta.subtitulo}
                    </Text>
                ) : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                    <Ionicons name="link-outline" size={11} color={minha ? tema.bolhaMinhaTexto : tema.textoSuave} />
                    <Text style={{ fontSize: 10, color: minha ? tema.bolhaMinhaTexto : tema.textoSuave, opacity: 0.7 }}>
                        {String(meta.contexto_tipo ?? 'ligação')}
                    </Text>
                </View>
            </View>
        </Pressable>
    );
}

function iconeFicheiro(nome?: string | null): keyof typeof Ionicons.glyphMap {
    const ext = (nome ?? '').split('.').pop()?.toLowerCase() ?? '';

    if (ext === 'pdf') return 'document-text';
    if (['doc', 'docx'].includes(ext)) return 'document-text-outline';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'grid-outline';
    if (['zip', 'rar', '7z'].includes(ext)) return 'file-tray-full-outline';
    if (['mp3', 'wav', 'm4a', 'ogg'].includes(ext)) return 'musical-notes-outline';

    return 'document-outline';
}

function AnexoView({ anexo, minha, aoAbrirFoto, aoAbrirUrl }: {
    anexo: Anexo;
    minha: boolean;
    aoAbrirFoto(anexo: Anexo): void;
    aoAbrirUrl(url: string): void;
}) {
    const tema = useTema();
    const corTexto = minha ? tema.bolhaMinhaTexto : tema.texto;

    if (anexo.tipo === 'foto' && anexo.url) {
        return (
            <Pressable onPress={() => aoAbrirFoto(anexo)}>
                <Image source={{ uri: anexo.url }} style={estilos.foto} />
            </Pressable>
        );
    }

    if (anexo.tipo === 'video' && anexo.url) {
        return (
            <Pressable onPress={() => aoAbrirUrl(anexo.url as string)} style={estilos.foto}>
                <Image source={{ uri: anexo.url }} style={StyleSheet.absoluteFillObject as object} />
                <View style={estilos.playVideo}>
                    <Ionicons name="play" size={26} color="#fff" />
                </View>
            </Pressable>
        );
    }

    if (anexo.tipo === 'audio' && anexo.url) {
        return <ReprodutorAudio url={anexo.url} mimha={minha} duracaoSegundos={anexo.duracao_segundos} />;
    }

    return (
        <Pressable onPress={() => anexo.url && aoAbrirUrl(anexo.url)} style={[estilos.ficheiro, { backgroundColor: minha ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.05)' }]}>
            <Ionicons name={iconeFicheiro(anexo.nome_ficheiro)} size={26} color={corTexto} />
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: '600', color: corTexto }}>
                    {anexo.nome_ficheiro ?? 'Ficheiro'}
                </Text>
                <Text style={{ fontSize: 11, color: corTexto, opacity: 0.7 }}>
                    {tamanhoLegivel(anexo.tamanho_bytes)} {(anexo.nome_ficheiro ?? '').split('.').pop()?.toUpperCase()}
                </Text>
            </View>
            <Ionicons name="download-outline" size={20} color={corTexto} />
        </Pressable>
    );
}

// ---------------------------------------------------------------- bolha

export interface BolhaProps {
    mensagem: Mensagem;
    minha: boolean;
    grupo: boolean;
    autor: ParticipanteConversa | null;
    outros: ParticipanteConversa[];
    primeiraDoBloco: boolean;
    ultimaDoBloco: boolean;
    respondida: Mensagem | null;
    destacada: boolean;
    aoResponder(): void;
    aoLongPress(): void;
    aoVerReacoes(): void;
    aoClicarCitacao(id: string): void;
    aoAbrirFoto(anexo: Anexo): void;
    aoAbrirUrl(url: string): void;
    aoLigar?(tipo: 'audio' | 'video'): void;
}

/** Bolha Messenger/WhatsApp: agrupamento, swipe para responder, long-press, reações. */
export function Bolha({
    mensagem: m,
    minha,
    grupo,
    autor,
    outros,
    primeiraDoBloco,
    ultimaDoBloco,
    respondida,
    destacada,
    aoResponder,
    aoLongPress,
    aoVerReacoes,
    aoClicarCitacao,
    aoAbrirFoto,
    aoAbrirUrl,
    aoLigar,
}: BolhaProps) {
    const tema = useTema();
    const arrasto = useRef(new Animated.Value(0)).current;
    const disparou = useRef(false);
    const [reagiu] = useState(false);
    void reagiu;

    const responder = useMemo(
        () =>
            PanResponder.create({
                onMoveShouldSetPanResponder: (_e: unknown, g: { dx: number; dy: number }) =>
                    !m.eliminada && g.dx > 14 && Math.abs(g.dy) < 12,
                onPanResponderMove: (_e: unknown, g: { dx: number }) => {
                    const x = Math.min(Math.max(g.dx, 0), 80);
                    arrasto.setValue(x);

                    if (x >= 60 && !disparou.current) {
                        disparou.current = true;
                        Vibration.vibrate(8);
                    }
                },
                onPanResponderRelease: (_e: unknown, g: { dx: number }) => {
                    if (g.dx >= 60) aoResponder();

                    disparou.current = false;
                    Animated.spring(arrasto, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 240 }).start();
                },
                onPanResponderTerminate: () => {
                    disparou.current = false;
                    Animated.spring(arrasto, { toValue: 0, useNativeDriver: true }).start();
                },
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [m.id, m.eliminada],
    );

    // tipos especiais renderizados fora da bolha clássica
    if (m.tipo === 'sistema') {
        return (
            <View style={estilos.sistema}>
                <Text style={[estilos.sistemaTexto, { color: tema.textoSuave }]}>{m.conteudo}</Text>
            </View>
        );
    }

    if (m.tipo === 'chamada') {
        return (
            <View style={{ alignItems: 'center', marginVertical: 4 }}>
                <CartaoRegistoChamada mensagem={m} aoLigar={aoLigar} />
            </View>
        );
    }

    const grupos = agruparReacoes(m.reacoes);
    const corTexto = minha ? tema.bolhaMinhaTexto : tema.texto;

    return (
        <Animated.View
            style={[
                { flexDirection: 'row', justifyContent: minha ? 'flex-end' : 'flex-start', paddingHorizontal: 10, marginTop: primeiraDoBloco ? 6 : 1.5 },
                { transform: [{ translateX: arrasto }] },
                destacada && { backgroundColor: 'rgba(79,70,229,0.12)', borderRadius: 12 },
            ]}
            {...responder.panHandlers}
        >
            {!minha && (
                <View style={{ width: 30, marginRight: 4, justifyContent: 'flex-end' }}>
                    {ultimaDoBloco && <Avatar nome={autor?.nome ?? '?'} url={autor?.foto_url} tamanho={26} />}
                </View>
            )}
            <Pressable
                onLongPress={m.eliminada ? undefined : aoLongPress}
                delayLongPress={280}
                style={[
                    estilos.bolha,
                    {
                        backgroundColor: minha ? tema.bolhaMinha : tema.bolhaOutro,
                        borderRadius: tema.raio,
                        marginBottom: grupos.length ? 12 : 0,
                    },
                    minha
                        ? { borderBottomRightRadius: ultimaDoBloco ? 6 : tema.raio }
                        : { borderBottomLeftRadius: ultimaDoBloco ? 6 : tema.raio },
                ]}
            >
                {grupo && !minha && primeiraDoBloco && (
                    <NomeComBadge nome={autor?.nome ?? '…'} metadados={autor?.metadados} estilo={{ fontSize: 12, fontWeight: '800', color: tema.primaria }} />
                )}
                {respondida && m.resposta_a_id && (
                    <Pressable onPress={() => aoClicarCitacao(m.resposta_a_id as string)} style={[estilos.citacao, { backgroundColor: minha ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.06)' }]}>
                        <Text numberOfLines={1} style={{ fontSize: 12, color: corTexto, opacity: 0.85 }}>
                            <Ionicons name="arrow-undo-outline" size={11} /> {respondida.conteudo ?? '📎 anexo'}
                        </Text>
                    </Pressable>
                )}
                {m.anexos.map((a) => (
                    <AnexoView key={a.id} anexo={a} minha={minha} aoAbrirFoto={aoAbrirFoto} aoAbrirUrl={aoAbrirUrl} />
                ))}
                {!m.eliminada && (m.tipo === 'partilha' || m.tipo === 'link') && <CartaoPartilha mensagem={m} minha={minha} />}
                {m.eliminada ? (
                    <Text style={{ fontStyle: 'italic', color: corTexto, opacity: 0.6, fontSize: 15 }}>
                        <Ionicons name="ban-outline" size={14} /> Mensagem eliminada
                    </Text>
                ) : m.conteudo ? (
                    <Text style={{ fontSize: 16, lineHeight: 22, color: corTexto }}>{m.conteudo}</Text>
                ) : null}
                <View style={estilos.rodape}>
                    {m.encaminhada_de_id && <Ionicons name="arrow-redo-outline" size={11} color={corTexto} style={{ opacity: 0.6 }} />}
                    <Text style={{ fontSize: 10, color: corTexto, opacity: 0.6 }}>
                        {m.editada_em ? 'editada · ' : ''}
                        {horaCurta(m.criada_em)}
                    </Text>
                    {minha && <Ticks mensagem={m} outros={outros} cor={corTexto} />}
                </View>

                {grupos.length > 0 && (
                    <Pressable onPress={aoVerReacoes} style={[estilos.chipsReacoes, { backgroundColor: tema.superficie }, minha ? { right: 8 } : { left: 8 }]}>
                        {grupos.map((g) => (
                            <Text key={g.emoji} style={{ fontSize: 12 }}>
                                {g.emoji}
                                {g.contagem > 1 ? <Text style={{ fontSize: 10, fontWeight: '700', color: tema.textoSuave }}> {g.contagem}</Text> : null}
                            </Text>
                        ))}
                    </Pressable>
                )}
            </Pressable>
        </Animated.View>
    );
}

const estilos = StyleSheet.create({
    sistema: { alignSelf: 'center', backgroundColor: 'rgba(100,116,139,0.12)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4, marginVertical: 5, maxWidth: '86%' },
    sistemaTexto: { fontSize: 12, textAlign: 'center' },
    bolha: { maxWidth: '76%', paddingHorizontal: 11, paddingVertical: 7, gap: 4, shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
    citacao: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
    rodape: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-end' },
    foto: { width: 218, height: 218, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.15)', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    playVideo: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
    ficheiro: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 10, width: 230 },
    partilha: { flexDirection: 'row', borderRadius: 12, overflow: 'hidden', width: 240 },
    cartaoChamada: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9, shadowColor: '#0f172a', shadowOpacity: 0.07, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
    chamadaIcone: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    chamadaLigar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
    chipsReacoes: { position: 'absolute', bottom: -11, flexDirection: 'row', gap: 3, borderRadius: 12, paddingHorizontal: 7, paddingVertical: 2.5, shadowColor: '#0f172a', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
});
