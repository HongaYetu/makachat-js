import { Anexo, Conversa, idMaiorOuIgual, Mensagem, ParticipanteConversa } from '@hongayetu/makachat-core';
import React, { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { useChamadasOpcional } from './chamadas';
import { useEnviarMensagem, useFuncionalidadeAtiva, useMensagens, usePresenca, useTypingConversa, useVersaoChat } from './hooks';
import { useMakaChat } from './provider';
import { v } from './tema';

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

// ---------------------------------------------------------------- lista

export interface MakaChatConversasProps {
    arquivadas?: boolean;
    conversaAtivaId?: string | null;
    onAbrirConversa(conversa: Conversa): void;
}

export function MakaChatConversas({ arquivadas = false, conversaAtivaId, onAbrirConversa }: MakaChatConversasProps) {
    const { engine } = useMakaChat();
    const versao = useVersaoChat();
    const [conversas, setConversas] = useState<Conversa[]>([]);

    useEffect(() => {
        void engine.storage.listarConversas(arquivadas).then(setConversas);
    }, [engine, arquivadas, versao]);

    return (
        <div style={{ overflowY: 'auto', height: '100%', background: v.superficie }}>
            {conversas.length === 0 && <div style={{ textAlign: 'center', color: v.textoSuave, marginTop: 48 }}>Sem conversas</div>}
            {conversas.map((c) => (
                <div
                    key={c.id}
                    onClick={() => onAbrirConversa(c)}
                    style={{
                        display: 'flex', gap: 12, padding: '11px 14px', cursor: 'pointer', alignItems: 'center',
                        borderLeft: c.id === conversaAtivaId ? `3px solid ${'var(--maka-primaria)'}` : '3px solid transparent',
                        background: c.id === conversaAtivaId ? v.fundo : 'transparent', transition: 'background .15s',
                    }}
                >
                    <AvatarWeb nome={c.titulo ?? '?'} url={c.foto_url} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: v.texto, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.titulo ?? 'Conversa'}</div>
                        <div style={{ color: v.textoSuave, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {previewConversa(c)}
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <span style={{ fontSize: 11, color: v.textoSuave }}>{horaCurtaWeb(c.ultima_atividade_em)}</span>
                        {(c.participante?.mensagens_nao_lidas ?? 0) > 0 && (
                            <span style={{ background: v.primaria, color: v.primariaContraste, borderRadius: 999, fontSize: 11, fontWeight: 700, padding: '1px 7px' }}>
                                {c.participante?.mensagens_nao_lidas}
                            </span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

function previewConversa(c: Conversa): string {
    const u = c.ultima_mensagem;

    if (!u) return '';
    if (u.eliminada) return '🚫 Mensagem eliminada';

    const p: Record<string, string> = { foto: '📷 Foto', video: '🎬 Vídeo', audio: '🎤 Áudio', ficheiro: '📎 Ficheiro', chamada: '📞 Chamada' };

    return u.tipo === 'texto' || u.tipo === 'sistema' ? (u.conteudo ?? '') : (p[u.tipo] ?? '');
}

// ---------------------------------------------------------------- painel

export interface ConversaPainelProps {
    conversaId: string;
    /** modo dock: paddings menores */
    compacto?: boolean;
    aoFechar?(): void;
}

export function ConversaPainel({ conversaId, compacto = false, aoFechar }: ConversaPainelProps) {
    const { engine, socket, identidade, api } = useMakaChat();
    const chamadas = useChamadasOpcional();
    const versao = useVersaoChat();
    const mensagens = useMensagens(conversaId, 100);
    const typing = useTypingConversa(conversaId);
    const enviar = useEnviarMensagem();

    const podeAudio = useFuncionalidadeAtiva('chamadas.audio');
    const podeVideo = useFuncionalidadeAtiva('chamadas.video');
    const podeMedia = useFuncionalidadeAtiva('media.ficheiro') || useFuncionalidadeAtiva('media.foto');
    const podeReagir = useFuncionalidadeAtiva('reacoes');
    const podeEncaminhar = useFuncionalidadeAtiva('encaminhar');

    const [conversa, setConversa] = useState<Conversa | null>(null);
    const [contexto, setContexto] = useState<{ titulo: string; subtitulo?: string; linhas?: string[] } | null>(null);
    const [texto, setTexto] = useState('');
    const [responderA, setResponderA] = useState<Mensagem | null>(null);
    const [editar, setEditar] = useState<Mensagem | null>(null);
    const [encaminhar, setEncaminhar] = useState<Mensagem | null>(null);
    const [aEnviarMedia, setAEnviarMedia] = useState(false);
    const fim = useRef<HTMLDivElement>(null);
    const ficheiro = useRef<HTMLInputElement>(null);
    const ultimoTyping = useRef(0);

    useEffect(() => {
        void engine.storage.obterConversa(conversaId).then(setConversa);
    }, [engine, conversaId, versao]);

    useEffect(() => {
        setContexto(null);
        void api.obterContexto(conversaId).then((r) => setContexto(r.contexto ?? null)).catch(() => undefined);
        void socket.entrarConversa(conversaId).catch(() => undefined);
    }, [api, socket, conversaId]);

    useEffect(() => {
        if (mensagens.length) void engine.marcarLidas(conversaId);

        fim.current?.scrollIntoView({ behavior: 'smooth' });
    }, [engine, conversaId, mensagens.length]);

    const eu = useMemo(
        () => conversa?.participantes.find((p) => p.id_externo === identidade.id && p.tipo === identidade.tipo) ?? null,
        [conversa, identidade],
    );
    const outros = (conversa?.participantes ?? []).filter((p) => p.identidade_id !== eu?.identidade_id && !p.saiu_em);
    const contraparte = conversa?.tipo === 'privada' ? outros[0] : null;
    const presenca = usePresenca(contraparte?.identidade_id ?? null);

    const aoEnviar = async () => {
        const conteudo = texto.trim();

        if (!conteudo) return;

        setTexto('');

        if (editar) {
            const alvo = editar;
            setEditar(null);
            await socket.editarMensagem(alvo.id, conteudo).catch(() => undefined);

            return;
        }

        const resposta = responderA;
        setResponderA(null);
        void enviar({ conversa_id: conversaId, conteudo, resposta_a_id: resposta?.id });
    };

    const aoEscolherFicheiro = async (f: File) => {
        setAEnviarMedia(true);

        try {
            const tipo = f.type.startsWith('image/') ? 'foto' : f.type.startsWith('video/') ? 'video' : f.type.startsWith('audio/') ? 'audio' : 'ficheiro';
            const criado = await api.criarMedia({ tipo, mime: f.type, nome_ficheiro: f.name });
            await api.carregarMedia(criado.upload, f, f.type);
            await api.confirmarMedia(criado.anexo_id);
            await socket.enviarMensagem({ conversa_id: conversaId, ref_cliente: crypto.randomUUID(), tipo: tipo as never, anexo_ids: [criado.anexo_id] });
        } finally {
            setAEnviarMedia(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: v.fundo, color: v.texto, minWidth: 0 }}>
            {/* header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: compacto ? '8px 10px' : '10px 16px', background: v.superficie, boxShadow: '0 1px 3px rgba(0,0,0,.06)', zIndex: 1 }}>
                <AvatarWeb nome={conversa?.titulo ?? '?'} url={conversa?.foto_url} tamanho={compacto ? 32 : 40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: compacto ? 14 : 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{conversa?.titulo ?? '…'}</div>
                    <div style={{ fontSize: 12, color: presenca?.online ? '#16a34a' : v.textoSuave }}>
                        {typing ? 'a escrever…' : presenca?.online ? 'online' : ''}
                    </div>
                </div>
                {chamadas && podeAudio && <BotaoIcone titulo="Chamada de áudio" onClick={() => void chamadas.iniciar(conversaId, 'audio')}>📞</BotaoIcone>}
                {chamadas && podeVideo && <BotaoIcone titulo="Chamada de vídeo" onClick={() => void chamadas.iniciar(conversaId, 'video')}>📹</BotaoIcone>}
                {aoFechar && <BotaoIcone titulo="Fechar" onClick={aoFechar}>✕</BotaoIcone>}
            </div>

            {contexto && (
                <div style={{ background: v.superficie, borderBottom: `1px solid ${'var(--maka-fundo)'}`, padding: '7px 14px', fontSize: 13 }}>
                    <strong>{contexto.titulo}</strong>
                    {contexto.subtitulo && <span style={{ color: v.textoSuave }}> — {contexto.subtitulo}</span>}
                    {contexto.linhas?.map((l, i) => <div key={i} style={{ color: v.textoSuave }}>{l}</div>)}
                </div>
            )}

            {/* mensagens */}
            <div style={{ flex: 1, overflowY: 'auto', padding: compacto ? 8 : 14, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {mensagens.map((m) => (
                    <Bolha
                        key={m.id}
                        mensagem={m}
                        minha={m.remetente_identidade_id === eu?.identidade_id || m.estado_envio === 'a_enviar'}
                        grupo={conversa?.tipo === 'grupo'}
                        participantes={conversa?.participantes ?? []}
                        outros={outros}
                        acoes={{
                            reagir: podeReagir ? (emoji) => void socket.alternarReacao(m.id, emoji) : undefined,
                            responder: () => { setEditar(null); setResponderA(m); },
                            editar: m.remetente_identidade_id === eu?.identidade_id && m.tipo === 'texto' && !m.eliminada
                                ? () => { setResponderA(null); setEditar(m); setTexto(m.conteudo ?? ''); }
                                : undefined,
                            eliminar: m.remetente_identidade_id === eu?.identidade_id && !m.eliminada
                                ? () => void socket.eliminarMensagem(m.id, true)
                                : undefined,
                            encaminhar: podeEncaminhar ? () => setEncaminhar(m) : undefined,
                        }}
                        todas={mensagens}
                    />
                ))}
                <div ref={fim} />
            </div>

            {/* barra de resposta/edição */}
            {(responderA || editar) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: v.superficie, borderTop: `2px solid ${'var(--maka-primaria)'}`, fontSize: 13 }}>
                    <span style={{ color: v.primaria, fontWeight: 700 }}>{editar ? 'Editar' : 'Responder'}</span>
                    <span style={{ color: v.textoSuave, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {(editar ?? responderA)?.conteudo ?? '📎 anexo'}
                    </span>
                    <BotaoIcone titulo="Cancelar" onClick={() => { setResponderA(null); setEditar(null); setTexto(''); }}>✕</BotaoIcone>
                </div>
            )}

            {/* input */}
            <div style={{ display: 'flex', gap: 8, padding: compacto ? 8 : 12, background: v.superficie, alignItems: 'center' }}>
                {podeMedia && (
                    <>
                        <input ref={ficheiro} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void aoEscolherFicheiro(f); e.target.value = ''; }} />
                        <BotaoIcone titulo="Anexar" onClick={() => ficheiro.current?.click()}>{aEnviarMedia ? '⏳' : '📎'}</BotaoIcone>
                    </>
                )}
                <input
                    style={{ flex: 1, borderRadius: 999, border: '1px solid rgba(100,116,139,.25)', padding: '10px 16px', fontSize: 14, outline: 'none', background: v.fundo, color: v.texto }}
                    value={texto}
                    placeholder={editar ? 'Editar mensagem…' : 'Escreve uma mensagem…'}
                    onChange={(e) => {
                        setTexto(e.target.value);

                        const agora = Date.now();

                        if (agora - ultimoTyping.current > 3000) {
                            ultimoTyping.current = agora;
                            socket.typing(conversaId, true);
                        }
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && void aoEnviar()}
                />
                <button
                    onClick={() => void aoEnviar()}
                    style={{ width: 42, height: 42, borderRadius: '50%', border: 'none', background: v.primaria, color: v.primariaContraste, fontSize: 16, cursor: 'pointer' }}
                >
                    ➤
                </button>
            </div>

            {encaminhar && (
                <EscolherConversa
                    titulo="Encaminhar para…"
                    aoFechar={() => setEncaminhar(null)}
                    aoEscolher={(c) => {
                        void socket.enviarMensagem({
                            conversa_id: c.id,
                            ref_cliente: crypto.randomUUID(),
                            tipo: encaminhar.tipo as never,
                            conteudo: encaminhar.conteudo ?? undefined,
                            encaminhada_de_id: encaminhar.id,
                        });
                        setEncaminhar(null);
                    }}
                />
            )}
        </div>
    );
}

/** Compat: nome antigo. */
export function MakaChatConversa({ conversaId }: { conversaId: string }) {
    return <ConversaPainel conversaId={conversaId} />;
}

// ---------------------------------------------------------------- bolha

interface AcoesBolha {
    reagir?: (emoji: string) => void;
    responder(): void;
    editar?: () => void;
    eliminar?: () => void;
    encaminhar?: () => void;
}

function Bolha({ mensagem: m, minha, grupo, participantes, outros, acoes, todas }: {
    mensagem: Mensagem; minha: boolean; grupo?: boolean;
    participantes: ParticipanteConversa[]; outros: ParticipanteConversa[]; acoes: AcoesBolha; todas: Mensagem[];
}) {
    const [hover, setHover] = useState(false);
    const [menu, setMenu] = useState(false);
    const respondida = m.resposta_a_id ? todas.find((x) => x.id === m.resposta_a_id) : null;

    if (m.tipo === 'sistema') {
        return (
            <div style={{ alignSelf: 'center', background: 'rgba(100,116,139,.12)', color: v.textoSuave, fontSize: 12, padding: '4px 12px', borderRadius: 999, margin: '4px 0' }}>
                {m.conteudo}
            </div>
        );
    }

    return (
        <div
            style={{ display: 'flex', justifyContent: minha ? 'flex-end' : 'flex-start', position: 'relative' }}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => { setHover(false); setMenu(false); }}
        >
            <div style={{
                background: minha ? v.bolhaMinha : v.bolhaOutro, color: minha ? v.bolhaMinhaTexto : v.texto,
                borderRadius: v.raio, padding: '7px 12px', maxWidth: '72%', display: 'flex', flexDirection: 'column', gap: 3,
                boxShadow: '0 1px 2px rgba(0,0,0,.07)',
            }}>
                {grupo && !minha && (
                    <div style={{ fontSize: 12, fontWeight: 700, color: v.primaria }}>
                        {participantes.find((p) => p.identidade_id === m.remetente_identidade_id)?.nome ?? '…'}
                    </div>
                )}
                {respondida && (
                    <div style={{ borderLeft: `3px solid ${minha ? v.bolhaMinhaTexto : 'var(--maka-primaria)'}`, opacity: .75, paddingLeft: 8, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {respondida.conteudo ?? '📎 anexo'}
                    </div>
                )}
                {m.anexos.map((a) => <AnexoView key={a.id} anexo={a} />)}
                {m.eliminada ? <em style={{ opacity: .6 }}>🚫 Mensagem eliminada</em> : m.conteudo && <span style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{m.conteudo}</span>}
                {m.reacoes.length > 0 && (
                    <div style={{ fontSize: 13, background: 'rgba(0,0,0,.08)', alignSelf: 'flex-start', borderRadius: 999, padding: '1px 7px' }}>
                        {m.reacoes.map((r) => r.emoji).join(' ')}
                    </div>
                )}
                <span style={{ fontSize: 10, opacity: .65, alignSelf: 'flex-end' }}>
                    {m.encaminhada_de_id ? '↪ ' : ''}{m.editada_em ? 'editada · ' : ''}{horaCurtaWeb(m.criada_em)} {minha && <TicksWeb mensagem={m} outros={outros} />}
                </span>
            </div>

            {hover && !m.eliminada && (
                <div style={{ position: 'absolute', top: -30, [minha ? 'right' : 'left']: 8, display: 'flex', gap: 2, background: v.superficie, borderRadius: 999, boxShadow: '0 2px 10px rgba(0,0,0,.15)', padding: '3px 6px', zIndex: 2 } as CSSProperties}>
                    {acoes.reagir && EMOJIS.map((e) => (
                        <span key={e} style={{ cursor: 'pointer', fontSize: 15 }} onClick={() => acoes.reagir?.(e)}>{e}</span>
                    ))}
                    <span style={{ cursor: 'pointer', fontSize: 14, color: v.textoSuave }} title="Responder" onClick={acoes.responder}>↩</span>
                    {(acoes.editar || acoes.eliminar || acoes.encaminhar) && (
                        <span style={{ cursor: 'pointer', fontSize: 14, color: v.textoSuave }} onClick={() => setMenu(!menu)}>⋯</span>
                    )}
                    {menu && (
                        <div style={{ position: 'absolute', top: 26, right: 0, background: v.superficie, borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,.18)', overflow: 'hidden', minWidth: 130 }}>
                            {acoes.encaminhar && <ItemMenu onClick={acoes.encaminhar}>↪ Encaminhar</ItemMenu>}
                            {acoes.editar && <ItemMenu onClick={acoes.editar}>✏️ Editar</ItemMenu>}
                            {acoes.eliminar && <ItemMenu onClick={acoes.eliminar}>🗑 Eliminar</ItemMenu>}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function AnexoView({ anexo: a }: { anexo: Anexo }) {
    if (!a.url) return null;
    if (a.tipo === 'foto') return <img src={a.url} style={{ maxWidth: 240, borderRadius: 10, cursor: 'pointer' }} alt="" onClick={() => window.open(a.url as string, '_blank')} />;
    if (a.tipo === 'video') return <video src={a.url} controls style={{ maxWidth: 260, borderRadius: 10 }} />;
    if (a.tipo === 'audio') return <audio src={a.url} controls style={{ maxWidth: 240 }} />;

    return <a href={a.url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>📎 Ficheiro{a.tamanho_bytes ? ` (${Math.round(a.tamanho_bytes / 1024)} KB)` : ''}</a>;
}

function ItemMenu({ onClick, children }: { onClick(): void; children: React.ReactNode }) {
    return (
        <div onClick={onClick} style={{ padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: v.texto, whiteSpace: 'nowrap' }}>
            {children}
        </div>
    );
}

function BotaoIcone({ onClick, titulo, children }: { onClick(): void; titulo: string; children: React.ReactNode }) {
    return (
        <button title={titulo} onClick={onClick} style={{ border: 'none', background: 'transparent', fontSize: 17, cursor: 'pointer', color: v.textoSuave, padding: 6 }}>
            {children}
        </button>
    );
}

function EscolherConversa({ titulo, aoEscolher, aoFechar }: { titulo: string; aoEscolher(c: Conversa): void; aoFechar(): void }) {
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 10000, display: 'grid', placeItems: 'center' }} onClick={aoFechar}>
            <div style={{ background: v.superficie, borderRadius: v.raio, width: 360, maxHeight: '70vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
                <div style={{ padding: '12px 16px', fontWeight: 700, color: v.texto }}>{titulo}</div>
                <div style={{ flex: 1, overflow: 'auto' }}>
                    <MakaChatConversas onAbrirConversa={aoEscolher} />
                </div>
            </div>
        </div>
    );
}

function TicksWeb({ mensagem, outros }: { mensagem: Mensagem; outros: ParticipanteConversa[] }) {
    if (mensagem.estado_envio === 'a_enviar') return <span>🕓</span>;
    if (mensagem.estado_envio === 'falhou') return <span style={{ color: '#dc2626' }}>!</span>;

    const entregue = outros.length > 0 && outros.every((p) => idMaiorOuIgual(p.ultima_entrega_mensagem_id, mensagem.id));
    const lida = outros.length > 0 && outros.every((p) => idMaiorOuIgual(p.ultima_leitura_mensagem_id, mensagem.id));

    return <span style={{ opacity: lida ? 1 : .65 }}>{entregue || lida ? '✓✓' : '✓'}</span>;
}

export function AvatarWeb({ nome, url, tamanho = 44 }: { nome: string; url?: string | null; tamanho?: number }) {
    const base: CSSProperties = { width: tamanho, height: tamanho, borderRadius: '50%', flexShrink: 0 };

    if (url) return <img src={url} style={{ ...base, objectFit: 'cover' }} alt={nome} />;

    return (
        <div style={{ ...base, background: v.primaria, color: v.primariaContraste, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: tamanho * 0.42 }}>
            {nome.trim().charAt(0).toUpperCase() || '?'}
        </div>
    );
}

export function horaCurtaWeb(iso: string): string {
    const data = new Date(iso);

    if (data.toDateString() === new Date().toDateString()) {
        return data.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    }

    return data.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
}
