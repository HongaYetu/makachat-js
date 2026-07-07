import { Conversa } from '@hongayetu/makachat-core';
import React from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useConversas } from '../hooks';

export interface ConversasScreenProps {
    arquivadas?: boolean;
    onAbrirConversa(conversa: Conversa): void;
    textoVazio?: string;
}

/** Lista de conversas estilo WhatsApp: avatar, título, preview, hora e não lidas. */
export function ConversasScreen({ arquivadas = false, onAbrirConversa, textoVazio }: ConversasScreenProps) {
    const conversas = useConversas(arquivadas);

    return (
        <FlatList
            data={conversas}
            keyExtractor={(c: Conversa) => c.id}
            ListEmptyComponent={<Text style={estilos.vazio}>{textoVazio ?? 'Sem conversas'}</Text>}
            renderItem={({ item }: { item: Conversa }) => (
                <TouchableOpacity style={estilos.item} onPress={() => onAbrirConversa(item)}>
                    <Avatar nome={item.titulo ?? '?'} url={item.foto_url} />
                    <View style={estilos.meio}>
                        <Text style={estilos.titulo} numberOfLines={1}>
                            {item.titulo ?? 'Conversa'}
                        </Text>
                        <Text style={estilos.preview} numberOfLines={1}>
                            {previewTexto(item)}
                        </Text>
                    </View>
                    <View style={estilos.direita}>
                        <Text style={estilos.hora}>{horaCurta(item.ultima_atividade_em)}</Text>
                        {(item.participante?.mensagens_nao_lidas ?? 0) > 0 && (
                            <View style={estilos.badge}>
                                <Text style={estilos.badgeTexto}>{item.participante?.mensagens_nao_lidas}</Text>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
            )}
        />
    );
}

export function Avatar({ nome, url, tamanho = 48 }: { nome: string; url?: string | null; tamanho?: number }) {
    const base = { width: tamanho, height: tamanho, borderRadius: tamanho / 2 };

    if (url) {
        return <Image source={{ uri: url }} style={base} />;
    }

    return (
        <View style={[base, estilos.avatarFallback]}>
            <Text style={estilos.avatarLetra}>{nome.trim().charAt(0).toUpperCase() || '?'}</Text>
        </View>
    );
}

function previewTexto(conversa: Conversa): string {
    const ultima = conversa.ultima_mensagem;

    if (!ultima) return '';
    if (ultima.eliminada) return '🚫 Mensagem eliminada';

    const porTipo: Record<string, string> = {
        foto: '📷 Foto',
        video: '🎬 Vídeo',
        audio: '🎤 Mensagem de voz',
        ficheiro: '📎 Ficheiro',
        chamada: '📞 Chamada',
    };

    return ultima.tipo === 'texto' ? (ultima.conteudo ?? '') : (porTipo[ultima.tipo] ?? '');
}

export function horaCurta(iso: string): string {
    const data = new Date(iso);
    const hoje = new Date();

    if (data.toDateString() === hoje.toDateString()) {
        return data.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    }

    return data.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
}

const estilos = StyleSheet.create({
    item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 12 },
    meio: { flex: 1 },
    titulo: { fontSize: 16, fontWeight: '600', color: '#111' },
    preview: { fontSize: 14, color: '#667', marginTop: 2 },
    direita: { alignItems: 'flex-end', gap: 6 },
    hora: { fontSize: 12, color: '#889' },
    badge: {
        backgroundColor: '#22c55e',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 5,
    },
    badgeTexto: { color: '#fff', fontSize: 12, fontWeight: '700' },
    vazio: { textAlign: 'center', color: '#889', marginTop: 48 },
    avatarFallback: { backgroundColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' },
    avatarLetra: { color: '#334155', fontSize: 18, fontWeight: '700' },
});
