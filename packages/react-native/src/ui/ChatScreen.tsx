import { Conversa, idMaiorOuIgual, Mensagem, ParticipanteConversa } from '@hongayetu/makachat-core';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useEnviarMensagem, useMensagens, useTypingConversa, useVersaoChat } from '../hooks';
import { useMakaChat } from '../provider';
import { horaCurta } from './ConversasScreen';

export interface ChatScreenProps {
    conversaId: string;
    /** callback para abrir um anexo (visualizador de media da app) */
    onAbrirAnexo?(url: string, tipo: string): void;
}

/**
 * Ecrã de conversa estilo WhatsApp: bolhas, estados ✓/✓✓/✓✓azul por
 * watermark, typing, replies e anexos básicos. A app envolve com o seu header.
 */
export function ChatScreen({ conversaId, onAbrirAnexo }: ChatScreenProps) {
    const { engine, socket, identidade } = useMakaChat();
    const versao = useVersaoChat();
    const mensagens = useMensagens(conversaId, 100);
    const typing = useTypingConversa(conversaId);
    const enviar = useEnviarMensagem();

    const [conversa, setConversa] = useState<Conversa | null>(null);
    const [texto, setTexto] = useState('');
    const ultimoTyping = useRef(0);

    useEffect(() => {
        void engine.storage.obterConversa(conversaId).then(setConversa);
    }, [engine, conversaId, versao]);

    useEffect(() => {
        void socket.entrarConversa(conversaId).catch(() => undefined);
    }, [socket, conversaId]);

    useEffect(() => {
        if (mensagens.length) {
            void engine.marcarLidas(conversaId);
        }
    }, [engine, conversaId, mensagens.length]);

    const eu = useMemo(
        () =>
            conversa?.participantes.find((p) => p.id_externo === identidade.id && p.tipo === identidade.tipo) ?? null,
        [conversa, identidade],
    );
    const outros = useMemo(
        () => (conversa?.participantes ?? []).filter((p) => p.identidade_id !== eu?.identidade_id && !p.saiu_em),
        [conversa, eu],
    );

    const aoEscrever = (valor: string) => {
        setTexto(valor);

        const agora = Date.now();

        if (agora - ultimoTyping.current > 3000) {
            ultimoTyping.current = agora;
            socket.typing(conversaId, true);
        }
    };

    const aoEnviar = () => {
        const conteudo = texto.trim();

        if (!conteudo) {
            return;
        }

        setTexto('');
        void enviar({ conversa_id: conversaId, conteudo });
    };

    const invertidas = useMemo(() => [...mensagens].reverse(), [mensagens]);

    return (
        <KeyboardAvoidingView style={estilos.raiz} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <FlatList
                data={invertidas}
                inverted
                keyExtractor={(m: Mensagem) => m.id}
                renderItem={({ item }: { item: Mensagem }) => (
                    <Bolha
                        mensagem={item}
                        minha={item.remetente_identidade_id === eu?.identidade_id || item.estado_envio === 'a_enviar'}
                        outros={outros}
                        participantes={conversa?.participantes ?? []}
                        grupo={conversa?.tipo === 'grupo'}
                        onAbrirAnexo={onAbrirAnexo}
                    />
                )}
            />
            {typing && <Text style={estilos.typing}>a escrever…</Text>}
            <View style={estilos.rodape}>
                <TextInput
                    style={estilos.input}
                    value={texto}
                    onChangeText={aoEscrever}
                    placeholder="Mensagem"
                    multiline
                />
                <TouchableOpacity style={estilos.enviar} onPress={aoEnviar}>
                    <Text style={estilos.enviarTexto}>➤</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

function Bolha({
    mensagem,
    minha,
    outros,
    participantes,
    grupo,
    onAbrirAnexo,
}: {
    mensagem: Mensagem;
    minha: boolean;
    outros: ParticipanteConversa[];
    participantes: ParticipanteConversa[];
    grupo: boolean;
    onAbrirAnexo?(url: string, tipo: string): void;
}) {
    const remetente = participantes.find((p) => p.identidade_id === mensagem.remetente_identidade_id);

    return (
        <View style={[estilos.linhaBolha, minha ? estilos.linhaMinha : estilos.linhaOutro]}>
            <View style={[estilos.bolha, minha ? estilos.bolhaMinha : estilos.bolhaOutro]}>
                {grupo && !minha && <Text style={estilos.nomeRemetente}>{remetente?.nome ?? '…'}</Text>}

                {mensagem.anexos.map((anexo) =>
                    anexo.tipo === 'foto' && anexo.url ? (
                        <TouchableOpacity key={anexo.id} onPress={() => onAbrirAnexo?.(anexo.url as string, anexo.tipo)}>
                            <Image source={{ uri: anexo.url }} style={estilos.foto} />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            key={anexo.id}
                            onPress={() => anexo.url && onAbrirAnexo?.(anexo.url, anexo.tipo)}
                        >
                            <Text style={estilos.anexo}>
                                {anexo.tipo === 'video' ? '🎬' : anexo.tipo === 'audio' ? '🎤' : '📎'}{' '}
                                {anexo.tipo.toUpperCase()}
                            </Text>
                        </TouchableOpacity>
                    ),
                )}

                {mensagem.eliminada ? (
                    <Text style={estilos.eliminada}>🚫 Mensagem eliminada</Text>
                ) : (
                    !!mensagem.conteudo && <Text style={estilos.conteudo}>{mensagem.conteudo}</Text>
                )}

                {mensagem.reacoes.length > 0 && (
                    <Text style={estilos.reacoes}>{mensagem.reacoes.map((r) => r.emoji).join(' ')}</Text>
                )}

                <View style={estilos.rodapeBolha}>
                    {!!mensagem.editada_em && <Text style={estilos.meta}>editada</Text>}
                    <Text style={estilos.meta}>{horaCurta(mensagem.criada_em)}</Text>
                    {minha && <Ticks mensagem={mensagem} outros={outros} />}
                </View>
            </View>
        </View>
    );
}

/** ✓ guardada no servidor · ✓✓ entregue · ✓✓ azul lida (watermarks UUIDv7). */
function Ticks({ mensagem, outros }: { mensagem: Mensagem; outros: ParticipanteConversa[] }) {
    if (mensagem.estado_envio === 'a_enviar') {
        return <Text style={estilos.meta}>🕓</Text>;
    }

    if (mensagem.estado_envio === 'falhou') {
        return <Text style={[estilos.meta, estilos.falhou]}>!</Text>;
    }

    const entregue = outros.length > 0 && outros.every((p) => idMaiorOuIgual(p.ultima_entrega_mensagem_id, mensagem.id));
    const lida = outros.length > 0 && outros.every((p) => idMaiorOuIgual(p.ultima_leitura_mensagem_id, mensagem.id));

    return <Text style={[estilos.meta, lida && estilos.lida]}>{entregue || lida ? '✓✓' : '✓'}</Text>;
}

const estilos = StyleSheet.create({
    raiz: { flex: 1, backgroundColor: '#efeae2' },
    linhaBolha: { paddingHorizontal: 10, marginVertical: 2, flexDirection: 'row' },
    linhaMinha: { justifyContent: 'flex-end' },
    linhaOutro: { justifyContent: 'flex-start' },
    bolha: { maxWidth: '80%', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
    bolhaMinha: { backgroundColor: '#d9fdd3' },
    bolhaOutro: { backgroundColor: '#fff' },
    nomeRemetente: { fontSize: 12, fontWeight: '700', color: '#7c3aed', marginBottom: 2 },
    conteudo: { fontSize: 15, color: '#111' },
    eliminada: { fontSize: 14, fontStyle: 'italic', color: '#889' },
    reacoes: { fontSize: 13, marginTop: 3 },
    foto: { width: 220, height: 220, borderRadius: 8, marginBottom: 4 },
    anexo: { fontSize: 14, color: '#2563eb', marginBottom: 4 },
    rodapeBolha: { flexDirection: 'row', alignSelf: 'flex-end', gap: 4, marginTop: 2, alignItems: 'center' },
    meta: { fontSize: 11, color: '#889' },
    lida: { color: '#3b82f6' },
    falhou: { color: '#dc2626', fontWeight: '700' },
    typing: { paddingHorizontal: 14, paddingVertical: 4, color: '#557', fontStyle: 'italic' },
    rodape: { flexDirection: 'row', padding: 8, gap: 8, alignItems: 'flex-end', backgroundColor: '#f0f2f5' },
    input: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 8,
        maxHeight: 120,
        fontSize: 15,
    },
    enviar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#22c55e',
        alignItems: 'center',
        justifyContent: 'center',
    },
    enviarTexto: { color: '#fff', fontSize: 18 },
});
