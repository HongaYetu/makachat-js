import { Conversa, idMaiorOuIgual, Mensagem, ParticipanteConversa } from '@hongayetu/makachat-core';
import React, { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { useEnviarMensagem, useMensagens, useTypingConversa, useVersaoChat } from './hooks';
import { useMakaChat } from './provider';

export interface MakaChatConversasProps {
    arquivadas?: boolean;
    conversaAtivaId?: string | null;
    onAbrirConversa(conversa: Conversa): void;
}

/** Coluna de conversas (lista estilo WhatsApp Web). */
export function MakaChatConversas({ arquivadas = false, conversaAtivaId, onAbrirConversa }: MakaChatConversasProps) {
    const { engine } = useMakaChat();
    const versao = useVersaoChat();
    const [conversas, setConversas] = useState<Conversa[]>([]);

    useEffect(() => {
        void engine.storage.listarConversas(arquivadas).then(setConversas);
    }, [engine, arquivadas, versao]);

    return (
        <div style={css.lista}>
            {conversas.length === 0 && <div style={css.vazio}>Sem conversas</div>}
            {conversas.map((c) => (
                <div
                    key={c.id}
                    style={{ ...css.item, ...(c.id === conversaAtivaId ? css.itemAtivo : {}) }}
                    onClick={() => onAbrirConversa(c)}
                >
                    <AvatarWeb nome={c.titulo ?? '?'} url={c.foto_url} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={css.titulo}>{c.titulo ?? 'Conversa'}</div>
                        <div style={css.preview}>
                            {c.ultima_mensagem?.eliminada ? '🚫 Eliminada' : (c.ultima_mensagem?.conteudo ?? '')}
                        </div>
                    </div>
                    <div style={css.direita}>
                        <span style={css.hora}>{horaCurtaWeb(c.ultima_atividade_em)}</span>
                        {(c.participante?.mensagens_nao_lidas ?? 0) > 0 && (
                            <span style={css.badge}>{c.participante?.mensagens_nao_lidas}</span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

export interface MakaChatConversaProps {
    conversaId: string;
}

/** Painel da conversa: bolhas, ✓/✓✓/✓✓azul, typing e input. */
export function MakaChatConversa({ conversaId }: MakaChatConversaProps) {
    const { engine, socket, identidade } = useMakaChat();
    const versao = useVersaoChat();
    const mensagens = useMensagens(conversaId, 100);
    const typing = useTypingConversa(conversaId);
    const enviar = useEnviarMensagem();

    const [conversa, setConversa] = useState<Conversa | null>(null);
    const [texto, setTexto] = useState('');
    const fim = useRef<HTMLDivElement>(null);
    const ultimoTyping = useRef(0);

    const [contexto, setContexto] = useState<{ titulo: string; subtitulo?: string; linhas?: string[] } | null>(null);

    useEffect(() => {
        void engine.storage.obterConversa(conversaId).then(setConversa);
    }, [engine, conversaId, versao]);

    useEffect(() => {
        setContexto(null);
        void engine.api
            .obterContexto(conversaId)
            .then((r) => setContexto(r.contexto ?? null))
            .catch(() => undefined);
    }, [engine, conversaId]);

    useEffect(() => {
        void socket.entrarConversa(conversaId).catch(() => undefined);
    }, [socket, conversaId]);

    useEffect(() => {
        if (mensagens.length) {
            void engine.marcarLidas(conversaId);
        }

        fim.current?.scrollIntoView({ behavior: 'smooth' });
    }, [engine, conversaId, mensagens.length]);

    const eu = useMemo(
        () =>
            conversa?.participantes.find((p) => p.id_externo === identidade.id && p.tipo === identidade.tipo) ?? null,
        [conversa, identidade],
    );
    const outros = (conversa?.participantes ?? []).filter((p) => p.identidade_id !== eu?.identidade_id && !p.saiu_em);

    const aoEnviar = () => {
        const conteudo = texto.trim();

        if (!conteudo) return;

        setTexto('');
        void enviar({ conversa_id: conversaId, conteudo });
    };

    return (
        <div style={css.painel}>
            {contexto && (
                <div style={{ background: '#fff', borderBottom: '1px solid #ddd', padding: '8px 14px' }}>
                    <strong>{contexto.titulo}</strong>
                    {contexto.subtitulo && <span style={{ color: '#667' }}> — {contexto.subtitulo}</span>}
                    {contexto.linhas?.map((l, i) => (
                        <div key={i} style={{ fontSize: 13, color: '#667' }}>{l}</div>
                    ))}
                </div>
            )}
            <div style={css.mensagens}>
                {mensagens.map((m) => {
                    const minha = m.remetente_identidade_id === eu?.identidade_id || m.estado_envio === 'a_enviar';

                    return (
                        <div key={m.id} style={{ display: 'flex', justifyContent: minha ? 'flex-end' : 'flex-start' }}>
                            <div style={{ ...css.bolha, ...(minha ? css.bolhaMinha : {}) }}>
                                {conversa?.tipo === 'grupo' && !minha && (
                                    <div style={css.nomeRemetente}>
                                        {conversa.participantes.find(
                                            (p) => p.identidade_id === m.remetente_identidade_id,
                                        )?.nome ?? '…'}
                                    </div>
                                )}
                                {m.anexos.map((a) =>
                                    a.tipo === 'foto' && a.url ? (
                                        <img key={a.id} src={a.url} style={css.foto} alt="" />
                                    ) : (
                                        a.url && (
                                            <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
                                                📎 {a.tipo}
                                            </a>
                                        )
                                    ),
                                )}
                                {m.eliminada ? (
                                    <em style={{ color: '#889' }}>🚫 Mensagem eliminada</em>
                                ) : (
                                    m.conteudo && <span>{m.conteudo}</span>
                                )}
                                {m.reacoes.length > 0 && <div>{m.reacoes.map((r) => r.emoji).join(' ')}</div>}
                                <span style={css.meta}>
                                    {m.editada_em ? 'editada · ' : ''}
                                    {horaCurtaWeb(m.criada_em)} {minha && <TicksWeb mensagem={m} outros={outros} />}
                                </span>
                            </div>
                        </div>
                    );
                })}
                {typing && <div style={css.typing}>a escrever…</div>}
                <div ref={fim} />
            </div>
            <div style={css.rodape}>
                <input
                    style={css.input}
                    value={texto}
                    placeholder="Mensagem"
                    onChange={(e) => {
                        setTexto(e.target.value);

                        const agora = Date.now();

                        if (agora - ultimoTyping.current > 3000) {
                            ultimoTyping.current = agora;
                            socket.typing(conversaId, true);
                        }
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && aoEnviar()}
                />
                <button style={css.enviar} onClick={aoEnviar}>
                    ➤
                </button>
            </div>
        </div>
    );
}

function TicksWeb({ mensagem, outros }: { mensagem: Mensagem; outros: ParticipanteConversa[] }) {
    if (mensagem.estado_envio === 'a_enviar') return <span>🕓</span>;
    if (mensagem.estado_envio === 'falhou') return <span style={{ color: '#dc2626' }}>!</span>;

    const entregue = outros.length > 0 && outros.every((p) => idMaiorOuIgual(p.ultima_entrega_mensagem_id, mensagem.id));
    const lida = outros.length > 0 && outros.every((p) => idMaiorOuIgual(p.ultima_leitura_mensagem_id, mensagem.id));

    return <span style={{ color: lida ? '#3b82f6' : '#889' }}>{entregue || lida ? '✓✓' : '✓'}</span>;
}

export function AvatarWeb({ nome, url, tamanho = 44 }: { nome: string; url?: string | null; tamanho?: number }) {
    const base: CSSProperties = {
        width: tamanho,
        height: tamanho,
        borderRadius: '50%',
        flexShrink: 0,
    };

    if (url) {
        return <img src={url} style={{ ...base, objectFit: 'cover' }} alt={nome} />;
    }

    return (
        <div
            style={{
                ...base,
                background: '#cbd5e1',
                color: '#334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
            }}
        >
            {nome.trim().charAt(0).toUpperCase() || '?'}
        </div>
    );
}

function horaCurtaWeb(iso: string): string {
    const data = new Date(iso);

    if (data.toDateString() === new Date().toDateString()) {
        return data.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    }

    return data.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
}

const css: Record<string, CSSProperties> = {
    lista: { overflowY: 'auto', height: '100%' },
    item: { display: 'flex', gap: 12, padding: '10px 14px', cursor: 'pointer', alignItems: 'center' },
    itemAtivo: { background: '#f0f2f5' },
    titulo: { fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    preview: { color: '#667', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    direita: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 },
    hora: { fontSize: 12, color: '#889' },
    badge: {
        background: '#22c55e',
        color: '#fff',
        borderRadius: 10,
        fontSize: 12,
        fontWeight: 700,
        padding: '1px 7px',
    },
    vazio: { textAlign: 'center', color: '#889', marginTop: 48 },
    painel: { display: 'flex', flexDirection: 'column', height: '100%', background: '#efeae2' },
    mensagens: { flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 4 },
    bolha: {
        background: '#fff',
        borderRadius: 10,
        padding: '6px 10px',
        maxWidth: '70%',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
    },
    bolhaMinha: { background: '#d9fdd3' },
    nomeRemetente: { fontSize: 12, fontWeight: 700, color: '#7c3aed' },
    foto: { maxWidth: 260, borderRadius: 8 },
    meta: { fontSize: 11, color: '#889', alignSelf: 'flex-end' },
    typing: { color: '#557', fontStyle: 'italic', fontSize: 13 },
    rodape: { display: 'flex', gap: 8, padding: 10, background: '#f0f2f5' },
    input: { flex: 1, borderRadius: 20, border: '1px solid #ddd', padding: '9px 14px', fontSize: 15, outline: 'none' },
    enviar: {
        width: 42,
        height: 42,
        borderRadius: '50%',
        border: 'none',
        background: '#22c55e',
        color: '#fff',
        fontSize: 17,
        cursor: 'pointer',
    },
};
