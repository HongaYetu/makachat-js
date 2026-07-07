import {
    ChamadasProvider,
    MakaChatBoxFull,
    MakaChatBoxMin,
    MakaChatDock,
    MakaChatProvider,
    useDock,
    useMakaChat,
} from '@hongayetu/makachat-react';
import { SignJWT } from 'jose';
import React, { useState } from 'react';

const SERVIDOR = 'http://127.0.0.1:3900';

/**
 * ⚠️ SÓ PARA DEV: num serviço real o JWT é emitido pelo backend do serviço
 * (POST /api/makachat/token). Aqui assinamos no browser com os segredos do
 * seed de desenvolvimento para testar sem backend intermediário.
 */
interface Perfil {
    servico: string;
    segredo: string;
    id: string;
    tipo: string;
    nome: string;
}

const PERFIS: Perfil[] = [
    { servico: 'svc_demo_a', segredo: 'segredo_demo_a_nao_usar_em_producao', id: 'ana', tipo: 'cliente', nome: 'Ana' },
    { servico: 'svc_demo_a', segredo: 'segredo_demo_a_nao_usar_em_producao', id: 'bruno', tipo: 'motorista', nome: 'Bruno' },
    { servico: 'svc_demo_b', segredo: 'segredo_demo_b_nao_usar_em_producao', id: 'ana', tipo: 'cliente', nome: 'Ana (Serviço B)' },
    { servico: 'svc_demo_b', segredo: 'segredo_demo_b_nao_usar_em_producao', id: 'daria', tipo: 'cliente', nome: 'Dária' },
];

async function emitirTokenDev(perfil: Perfil): Promise<string> {
    return new SignJWT({ iss: perfil.servico, sub: perfil.id, tipo: perfil.tipo, nome: perfil.nome })
        .setProtectedHeader({ alg: 'HS256' })
        .setJti(crypto.randomUUID())
        .setExpirationTime('15m')
        .sign(new TextEncoder().encode(perfil.segredo));
}

export function App() {
    const [perfil, setPerfil] = useState<Perfil | null>(null);

    if (!perfil) {
        return (
            <div style={{ display: 'grid', placeItems: 'center', height: '100vh', gap: 0 }}>
                <div style={{ textAlign: 'center' }}>
                    <h1>MakaChat — Exemplo</h1>
                    <p>Escolhe a identidade (abre outra janela com outra identidade para conversar):</p>
                    {PERFIS.map((p) => (
                        <button
                            key={`${p.servico}:${p.tipo}:${p.id}`}
                            onClick={() => setPerfil(p)}
                            style={{ display: 'block', width: 320, margin: '8px auto', padding: 12, cursor: 'pointer' }}
                        >
                            {p.nome} — {p.tipo} @ {p.servico}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <MakaChatProvider
            key={`${perfil.servico}:${perfil.tipo}:${perfil.id}`}
            serviceKey={perfil.servico}
            identity={{ id: perfil.id, tipo: perfil.tipo, nome: perfil.nome }}
            getToken={async () => ({
                token: await emitirTokenDev(perfil),
                socket_url: SERVIDOR,
                api_url: SERVIDOR,
            })}
            tema={perfil.servico === 'svc_demo_b' ? { primaria: '#FF5A00' } : undefined}
        >
            <ChamadasProvider>
                <Layout perfil={perfil} aoSair={() => setPerfil(null)} />
            </ChamadasProvider>
        </MakaChatProvider>
    );
}

function Layout({ perfil, aoSair }: { perfil: Perfil; aoSair(): void }) {
    const { api, engine } = useMakaChat();
    const [modo, setModo] = useState<'full' | 'min' | 'dock'>('min');

    const novaConversa = async () => {
        const idExterno = window.prompt('id_externo do destinatário (ex: bruno)');

        if (!idExterno) return;

        const tipo = window.prompt('tipo (ex: motorista, cliente)', 'cliente') ?? 'cliente';
        const nome = window.prompt('nome', idExterno) ?? idExterno;
        const { conversa } = await api.criarPrivada({ id_externo: idExterno, tipo, nome });
        await engine.atualizarConversas();
        window.alert(`Conversa criada: ${conversa.id}`);
    };

    return (
        <MakaChatDock autoAbrir={modo === 'dock'}>
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: 10, display: 'flex', gap: 8, alignItems: 'center', background: '#0f172a', color: '#fff' }}>
                    <strong style={{ flex: 1 }}>
                        {perfil.nome} <small>({perfil.servico})</small>
                    </strong>
                    {(['full', 'min', 'dock'] as const).map((m) => (
                        <button key={m} onClick={() => setModo(m)} style={{ fontWeight: modo === m ? 700 : 400 }}>
                            Box {m}
                        </button>
                    ))}
                    <button onClick={novaConversa}>＋ conversa</button>
                    <button onClick={aoSair}>Sair</button>
                </div>
                <div style={{ flex: 1, minHeight: 0, padding: modo === 'min' ? 24 : 0 }}>
                    {modo === 'full' && <MakaChatBoxFull />}
                    {modo === 'min' && <MakaChatBoxMin />}
                    {modo === 'dock' && (
                        <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#64748b' }}>
                            Modo dock: usa o launcher 💬 no canto — as boxes abrem sozinhas quando chega mensagem.
                        </div>
                    )}
                </div>
            </div>
        </MakaChatDock>
    );
}
