import {
    ChamadasProvider,
    ChatScreen,
    Conversa,
    ConversasScreen,
    InfoConversaScreen,
    MakaChatProvider,
    useChamadas,
} from '@hongayetu/makachat-react-native';
import CryptoJS from 'crypto-js';
import { useMakaChat } from '@hongayetu/makachat-react-native';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

/**
 * QA mobile do MakaChat — mesmos perfis demo do exemplo-web.
 * AJUSTA o IP para a máquina onde corre o makachat-server (LAN, não localhost:
 * o telemóvel precisa de alcançar o servidor).
 */
const SERVIDOR = 'http://192.168.100.36:3900';

const PERFIS = [
    { servico: 'svc_demo_a', segredo: 'segredo_demo_a_nao_usar_em_producao', id: 'ana', tipo: 'cliente', nome: 'Ana' },
    { servico: 'svc_demo_a', segredo: 'segredo_demo_a_nao_usar_em_producao', id: 'bruno', tipo: 'motorista', nome: 'Bruno' },
    { servico: 'svc_demo_a', segredo: 'segredo_demo_a_nao_usar_em_producao', id: 'carla', tipo: 'cliente', nome: 'Carla' },
    { servico: 'svc_demo_b', segredo: 'segredo_demo_b_nao_usar_em_producao', id: 'daria', tipo: 'cliente', nome: 'Dária' },
    { servico: 'svc_demo_b', segredo: 'segredo_demo_b_nao_usar_em_producao', id: 'elsa', tipo: 'cliente', nome: 'Elsa' },
] as const;

type Perfil = (typeof PERFIS)[number];

// ---------------- JWT HS256 local (só para demo — em produção é o backend que emite)

function b64url(palavras: CryptoJS.lib.WordArray): string {
    return CryptoJS.enc.Base64.stringify(palavras).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function assinarJwt(payload: Record<string, unknown>, segredo: string): string {
    const cab = b64url(CryptoJS.enc.Utf8.parse(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
    const corpo = b64url(CryptoJS.enc.Utf8.parse(JSON.stringify(payload)));

    return `${cab}.${corpo}.${b64url(CryptoJS.HmacSHA256(`${cab}.${corpo}`, segredo))}`;
}

function uuidSimples(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;

        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

// ---------------- navegação simples por estado (a app real usa o router dela)

type Ecra =
    | { nome: 'lista'; arquivadas?: boolean }
    | { nome: 'chat'; conversaId: string }
    | { nome: 'info'; conversaId: string };

function Chat({ perfil, aoSair }: { perfil: Perfil; aoSair(): void }) {
    const [ecra, setEcra] = useState<Ecra>({ nome: 'lista' });

    const getToken = useMemo(
        () => async () => {
            const agora = Math.floor(Date.now() / 1000);

            return {
                estado: 'ok',
                token: assinarJwt(
                    {
                        iss: perfil.servico,
                        sub: perfil.id,
                        tipo: perfil.tipo,
                        nome: perfil.nome,
                        metadados: perfil.id === 'ana' ? { verificado: true } : undefined,
                        jti: uuidSimples(),
                        iat: agora,
                        exp: agora + 900,
                    },
                    perfil.segredo,
                ),
                socket_url: SERVIDOR,
                api_url: SERVIDOR,
            };
        },
        [perfil],
    );

    const contactos = useMemo(
        () =>
            PERFIS.filter((p) => p.servico === perfil.servico && p.id !== perfil.id).map((p) => ({
                id_externo: p.id,
                tipo: p.tipo,
                nome: p.nome,
            })),
        [perfil],
    );

    return (
        <MakaChatProvider
            serviceKey={perfil.servico}
            identity={{ id: perfil.id, tipo: perfil.tipo, nome: perfil.nome }}
            getToken={getToken}
            contactos={contactos}
            tema={perfil.servico === 'svc_demo_b' ? { primaria: '#FF5A00' } : undefined}
        >
            <ChamadasProvider>
                <Ecras ecra={ecra} setEcra={setEcra} aoSair={aoSair} />
            </ChamadasProvider>
        </MakaChatProvider>
    );
}

function Ecras({ ecra, setEcra, aoSair }: { ecra: Ecra; setEcra(e: Ecra): void; aoSair(): void }) {
    const chamadas = useChamadas();

    usarPush(setEcra);

    if (ecra.nome === 'chat') {
        return (
            <ChatScreen
                conversaId={ecra.conversaId}
                chamadas={chamadas}
                onVoltar={() => setEcra({ nome: 'lista' })}
                onAbrirInfo={(c: Conversa) => setEcra({ nome: 'info', conversaId: c.id })}
                onAbrirOutraConversa={(id) => setEcra({ nome: 'chat', conversaId: id })}
            />
        );
    }

    if (ecra.nome === 'info') {
        return (
            <InfoConversaScreen
                conversaId={ecra.conversaId}
                onVoltar={() => setEcra({ nome: 'chat', conversaId: ecra.conversaId })}
                onSaiu={() => setEcra({ nome: 'lista' })}
                onAbrirOutraConversa={(id) => setEcra({ nome: 'chat', conversaId: id })}
            />
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <View style={estilos.topoLista}>
                <Text style={estilos.tituloApp}>{ecra.arquivadas ? 'Arquivadas' : 'MakaChat'}</Text>
                <Pressable onPress={ecra.arquivadas ? () => setEcra({ nome: 'lista' }) : aoSair}>
                    <Text style={{ color: '#4f46e5', fontWeight: '700' }}>{ecra.arquivadas ? 'Voltar' : 'Trocar perfil'}</Text>
                </Pressable>
            </View>
            <ConversasScreen
                arquivadas={ecra.arquivadas}
                onAbrirConversa={(c) => setEcra({ nome: 'chat', conversaId: c.id })}
                onAbrirArquivadas={() => setEcra({ nome: 'lista', arquivadas: true })}
            />
        </View>
    );
}

/** Push ligado: drena o inbox nativo ao arrancar/voltar e refresca badges. */
function usarPush(setEcra: (e: Ecra) => void) {
    const { engine } = useMakaChat();

    useEffect(() => {
        let push: {
            drenarInbox(): Promise<unknown[]>;
            aoReceberPush(cb: (i: { conversa_id: string }) => void): { remove(): void };
        } | null = null;

        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            push = require('@hongayetu/expo-makachat-push');
        } catch {
            return;
        }

        void push!.drenarInbox().then((itens) => {
            if (itens.length) void engine.atualizarConversas();
        });

        const sub = push!.aoReceberPush(() => void engine.atualizarConversas());

        return () => sub.remove();
    }, [engine, setEcra]);
}

export default function App() {
    const [perfil, setPerfil] = useState<Perfil | null>(null);

    if (!perfil) {
        return (
            <SafeAreaView style={estilos.seletor}>
                <StatusBar style="dark" />
                <Text style={estilos.tituloApp}>MakaChat — escolhe um perfil</Text>
                {PERFIS.map((p) => (
                    <Pressable key={`${p.servico}_${p.id}`} onPress={() => setPerfil(p)} style={estilos.perfil}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a' }}>{p.nome}</Text>
                        <Text style={{ fontSize: 12, color: '#64748b' }}>
                            {p.servico} · {p.tipo}
                        </Text>
                    </Pressable>
                ))}
                <Text style={{ marginTop: 18, fontSize: 12, color: '#94a3b8', paddingHorizontal: 24, textAlign: 'center' }}>
                    Servidor: {SERVIDOR} — ajusta o IP no App.tsx para a tua máquina.
                </Text>
            </SafeAreaView>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <StatusBar style="dark" />
            <Chat perfil={perfil} aoSair={() => setPerfil(null)} />
        </View>
    );
}

const estilos = StyleSheet.create({
    seletor: { flex: 1, backgroundColor: '#f4f5f7', paddingTop: 80, alignItems: 'stretch', gap: 10, paddingHorizontal: 20 },
    perfil: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 14, shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
    tituloApp: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
    topoLista: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 4, backgroundColor: '#fff' },
});
