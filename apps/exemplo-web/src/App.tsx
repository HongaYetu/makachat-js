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
    { servico: 'svc_demo_a', segredo: 'segredo_demo_a_nao_usar_em_producao', id: 'carla', tipo: 'cliente', nome: 'Carla' },
    { servico: 'svc_demo_b', segredo: 'segredo_demo_b_nao_usar_em_producao', id: 'daria', tipo: 'cliente', nome: 'Dária' },
    { servico: 'svc_demo_b', segredo: 'segredo_demo_b_nao_usar_em_producao', id: 'elsa', tipo: 'cliente', nome: 'Elsa' },
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
            <div style={{ display: 'grid', placeItems: 'center', height: '100vh', fontFamily: 'system-ui' }}>
                <div style={{ textAlign: 'center', maxWidth: 460 }}>
                    <h1>MakaChat — Exemplo</h1>
                    <p style={{ color: '#64748b' }}>
                        1. Abre esta página em <b>duas janelas</b> (uma normal + uma anónima).<br />
                        2. Entra com uma pessoa em cada janela (do mesmo serviço).<br />
                        3. Clica num contacto para conversar.
                    </p>
                    {PERFIS.map((p) => (
                        <button
                            key={`${p.servico}:${p.tipo}:${p.id}`}
                            onClick={() => setPerfil(p)}
                            style={{ display: 'block', width: 340, margin: '8px auto', padding: 12, cursor: 'pointer', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', fontSize: 15 }}
                        >
                            Entrar como <b>{p.nome}</b> <small style={{ color: '#64748b' }}>({p.tipo} · {p.servico})</small>
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

const MODOS = [
    { chave: 'min', rotulo: 'Box Min', dica: 'preenche a área que lhe é dada (admin com sidebar)' },
    { chave: 'full', rotulo: 'Box Full', dica: 'ocupa a página inteira' },
    { chave: 'dock', rotulo: 'Dock', dica: 'boxes flutuantes estilo Facebook (launcher 💬 no canto)' },
] as const;

type Modo = (typeof MODOS)[number]['chave'];

function Layout({ perfil, aoSair }: { perfil: Perfil; aoSair(): void }) {
    const [modo, setModo] = useState<Modo>('min');
    const [conversaAberta, setConversaAberta] = useState<string | null>(null);

    return (
        <MakaChatDock visivel={modo === 'dock'}>
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui' }}>
            <header style={{ padding: '10px 16px', display: 'flex', gap: 10, alignItems: 'center', background: '#0f172a', color: '#fff' }}>
                <strong style={{ flex: 1 }}>
                    {perfil.nome} <small style={{ opacity: 0.7 }}>{perfil.tipo} · {perfil.servico}</small>
                </strong>
                {MODOS.map((m) => (
                    <button
                        key={m.chave}
                        onClick={() => setModo(m.chave)}
                        title={m.dica}
                        style={{ padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: modo === m.chave ? '#4f46e5' : '#1e293b', color: '#fff' }}
                    >
                        {m.rotulo}
                    </button>
                ))}
                <button onClick={aoSair} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#334155', color: '#fff' }}>
                    Sair
                </button>
            </header>

            <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
                <Contactos perfil={perfil} modo={modo} aoAbrirNoBox={(id) => setConversaAberta(id)} />

                <main style={{ flex: 1, minWidth: 0, padding: modo === 'min' ? 20 : 0 }}>
                    {modo === 'full' && <MakaChatBoxFull conversaAbertaId={conversaAberta} />}
                    {modo === 'min' && <MakaChatBoxMin conversaAbertaId={conversaAberta} />}
                    {modo === 'dock' && (
                        <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#64748b', textAlign: 'center', padding: 24 }}>
                            <div>
                                <div style={{ fontSize: 40 }}>👉 💬</div>
                                <p>
                                    <b>Modo Dock:</b> clica num contacto à esquerda ou no launcher 💬 no canto inferior direito.<br />
                                    As boxes abrem sozinhas quando recebes mensagem.
                                </p>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
        </MakaChatDock>
    );
}

/** Contactos do mesmo serviço — um clique cria/reabre a conversa e abre-a já. */
function Contactos({ perfil, modo, aoAbrirNoBox }: { perfil: Perfil; modo: Modo; aoAbrirNoBox(id: string): void }) {
    const { api, engine } = useMakaChat();
    const dock = useDock();
    const [aAbrir, setAAbrir] = useState<string | null>(null);

    const contactos = PERFIS.filter((p) => p.servico === perfil.servico && p.id !== perfil.id);

    const conversar = async (alvo: Perfil) => {
        setAAbrir(alvo.id);

        try {
            const { conversa } = await api.criarPrivada({ id_externo: alvo.id, tipo: alvo.tipo, nome: alvo.nome });
            await engine.atualizarConversas();

            if (modo === 'dock') {
                dock.abrir(conversa.id);
            } else {
                aoAbrirNoBox(conversa.id);
            }
        } catch (erro) {
            window.alert(`Não foi possível abrir a conversa: ${(erro as Error).message}\n\nO makachat-server está a correr em ${'http://127.0.0.1:3900'}?`);
        } finally {
            setAAbrir(null);
        }
    };

    return (
        <aside style={{ width: 230, borderRight: '1px solid #e2e8f0', padding: 14, background: '#f8fafc' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Contactos</div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>Clica para conversar</div>
            {contactos.map((c) => (
                <button
                    key={c.id}
                    onClick={() => void conversar(c)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: 6, borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 14 }}
                >
                    {aAbrir === c.id ? '⏳ ' : '💬 '}
                    <b>{c.nome}</b> <small style={{ color: '#64748b' }}>({c.tipo})</small>
                </button>
            ))}
        </aside>
    );
}
