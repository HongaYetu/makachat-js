import { Anexo, Conversa, idMaiorOuIgual, Mensagem, ParticipanteConversa } from '@hongayetu/makachat-core';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useChamadasOpcional } from './chamadas';
import {
    useEnviarMensagem,
    useFuncionalidadeAtiva,
    useMensagens,
    usePresenca,
    useTypingConversa,
    useVersaoChat,
} from './hooks';
import { useMakaChat } from './provider';

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
        <div className="maka-scroll h-full overflow-y-auto bg-[var(--maka-superficie)]">
            {conversas.length === 0 && (
                <div className="flex flex-col items-center gap-2 pt-16 text-[var(--maka-texto-suave)]">
                    <span className="text-4xl opacity-40">💬</span>
                    <span className="text-sm">Sem conversas</span>
                </div>
            )}
            {conversas.map((c) => {
                const ativa = c.id === conversaAtivaId;
                const naoLidas = c.participante?.mensagens_nao_lidas ?? 0;

                return (
                    <button
                        key={c.id}
                        onClick={() => onAbrirConversa(c)}
                        className={`flex w-full cursor-pointer items-center gap-3 border-0 px-4 py-3 text-left transition-colors ${
                            ativa ? 'bg-[var(--maka-fundo)]' : 'bg-transparent hover:bg-[var(--maka-fundo)]'
                        }`}
                    >
                        <AvatarWeb nome={c.titulo ?? '?'} url={c.foto_url} />
                        <span className="min-w-0 flex-1">
                            <span className={`block truncate text-sm text-[var(--maka-texto)] ${naoLidas ? 'font-bold' : 'font-semibold'}`}>
                                {c.titulo ?? 'Conversa'}
                            </span>
                            <span className={`block truncate text-[13px] ${naoLidas ? 'font-medium text-[var(--maka-texto)]' : 'text-[var(--maka-texto-suave)]'}`}>
                                {previewConversa(c)}
                            </span>
                        </span>
                        <span className="flex flex-col items-end gap-1">
                            <span className="text-[11px] text-[var(--maka-texto-suave)]">{horaCurtaWeb(c.ultima_atividade_em)}</span>
                            {naoLidas > 0 && (
                                <span className="rounded-full bg-[var(--maka-primaria)] px-2 py-px text-[11px] font-bold text-[var(--maka-primaria-contraste)]">
                                    {naoLidas}
                                </span>
                            )}
                        </span>
                    </button>
                );
            })}
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
    const podeFicheiro = useFuncionalidadeAtiva('media.ficheiro');
    const podeFoto = useFuncionalidadeAtiva('media.foto');
    const podeReagir = useFuncionalidadeAtiva('reacoes');
    const podeEncaminhar = useFuncionalidadeAtiva('encaminhar');
    const podeMedia = podeFicheiro || podeFoto;

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
        void engine.carregarMensagens(conversaId).catch(() => undefined);
        void api.obterContexto(conversaId).then((r) => setContexto(r.contexto ?? null)).catch(() => undefined);
        void socket.entrarConversa(conversaId).catch(() => undefined);
    }, [engine, api, socket, conversaId]);

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
        <div className="flex h-full min-w-0 flex-col bg-[var(--maka-fundo)] text-[var(--maka-texto)]">
            {/* header */}
            <div className={`z-[1] flex items-center gap-3 bg-[var(--maka-superficie)] shadow-sm ${compacto ? 'px-3 py-2' : 'px-4 py-2.5'}`}>
                <span className="relative">
                    <AvatarWeb nome={conversa?.titulo ?? '?'} url={conversa?.foto_url} tamanho={compacto ? 34 : 42} />
                    {presenca?.online && (
                        <span className="absolute -bottom-0.5 -right-0.5 block h-3 w-3 rounded-full border-2 border-[var(--maka-superficie)] bg-emerald-500" />
                    )}
                </span>
                <span className="min-w-0 flex-1">
                    <span className={`block truncate font-bold ${compacto ? 'text-[13px]' : 'text-[15px]'}`}>{conversa?.titulo ?? '…'}</span>
                    <span className={`block text-xs ${typing ? 'italic text-[var(--maka-primaria)]' : presenca?.online ? 'text-emerald-600' : 'text-[var(--maka-texto-suave)]'}`}>
                        {typing ? 'a escrever…' : presenca?.online ? 'online' : ''}
                    </span>
                </span>
                {chamadas && podeAudio && <BotaoIcone titulo="Chamada de áudio" onClick={() => void chamadas.iniciar(conversaId, 'audio')}>📞</BotaoIcone>}
                {chamadas && podeVideo && <BotaoIcone titulo="Chamada de vídeo" onClick={() => void chamadas.iniciar(conversaId, 'video')}>📹</BotaoIcone>}
                {aoFechar && <BotaoIcone titulo="Fechar" onClick={aoFechar}>✕</BotaoIcone>}
            </div>

            {contexto && (
                <div className="border-b border-[var(--maka-fundo)] bg-[var(--maka-superficie)] px-4 py-2 text-[13px]">
                    <span className="font-bold">{contexto.titulo}</span>
                    {contexto.subtitulo && <span className="text-[var(--maka-texto-suave)]"> — {contexto.subtitulo}</span>}
                    {contexto.linhas?.map((l, i) => (
                        <div key={i} className="text-[var(--maka-texto-suave)]">{l}</div>
                    ))}
                </div>
            )}

            {/* mensagens */}
            <div className={`maka-scroll flex flex-1 flex-col gap-1 overflow-y-auto ${compacto ? 'p-2.5' : 'p-4'}`}>
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
                <div className="flex items-center gap-2 border-t-2 border-[var(--maka-primaria)] bg-[var(--maka-superficie)] px-3 py-1.5 text-[13px]">
                    <span className="font-bold text-[var(--maka-primaria)]">{editar ? 'Editar' : 'Responder'}</span>
                    <span className="min-w-0 flex-1 truncate text-[var(--maka-texto-suave)]">{(editar ?? responderA)?.conteudo ?? '📎 anexo'}</span>
                    <BotaoIcone titulo="Cancelar" onClick={() => { setResponderA(null); setEditar(null); setTexto(''); }}>✕</BotaoIcone>
                </div>
            )}

            {/* input */}
            <div className={`flex items-center gap-2 bg-[var(--maka-superficie)] ${compacto ? 'p-2' : 'p-3'}`}>
                {podeMedia && (
                    <>
                        <input ref={ficheiro} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void aoEscolherFicheiro(f); e.target.value = ''; }} />
                        <BotaoIcone titulo="Anexar" onClick={() => ficheiro.current?.click()}>{aEnviarMedia ? '⏳' : '📎'}</BotaoIcone>
                    </>
                )}
                <input
                    className="min-w-0 flex-1 rounded-full border border-slate-300/60 bg-[var(--maka-fundo)] px-4 py-2.5 text-sm text-[var(--maka-texto)] outline-none transition-shadow placeholder:text-[var(--maka-texto-suave)] focus:ring-2 focus:ring-[var(--maka-primaria)]"
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
                    className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-[var(--maka-primaria)] text-base text-[var(--maka-primaria-contraste)] shadow-md transition-transform hover:scale-105 active:scale-95"
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
            <div className="my-1 self-center rounded-full bg-slate-500/10 px-3.5 py-1 text-xs text-[var(--maka-texto-suave)]">
                {m.conteudo}
            </div>
        );
    }

    return (
        <div
            className={`relative flex animate-maka-subir ${minha ? 'justify-end' : 'justify-start'}`}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => { setHover(false); setMenu(false); }}
        >
            <div
                className={`flex max-w-[72%] flex-col gap-1 rounded-[var(--maka-raio)] px-3 py-2 shadow-sm ${
                    minha
                        ? 'rounded-br-md bg-[var(--maka-bolha-minha)] text-[var(--maka-bolha-minha-texto)]'
                        : 'rounded-bl-md bg-[var(--maka-bolha-outro)] text-[var(--maka-texto)]'
                }`}
            >
                {grupo && !minha && (
                    <span className="text-xs font-bold text-[var(--maka-primaria)]">
                        {participantes.find((p) => p.identidade_id === m.remetente_identidade_id)?.nome ?? '…'}
                    </span>
                )}
                {respondida && (
                    <span className={`truncate border-l-[3px] pl-2 text-xs opacity-75 ${minha ? 'border-[var(--maka-bolha-minha-texto)]' : 'border-[var(--maka-primaria)]'}`}>
                        {respondida.conteudo ?? '📎 anexo'}
                    </span>
                )}
                {m.anexos.map((a) => <AnexoView key={a.id} anexo={a} />)}
                {m.eliminada ? (
                    <em className="opacity-60">🚫 Mensagem eliminada</em>
                ) : (
                    m.conteudo && <span className="whitespace-pre-wrap text-sm leading-relaxed">{m.conteudo}</span>
                )}
                {m.reacoes.length > 0 && (
                    <span className="self-start rounded-full bg-black/10 px-2 py-px text-[13px]">
                        {m.reacoes.map((r) => r.emoji).join(' ')}
                    </span>
                )}
                <span className="self-end text-[10px] opacity-60">
                    {m.encaminhada_de_id ? '↪ ' : ''}{m.editada_em ? 'editada · ' : ''}{horaCurtaWeb(m.criada_em)}{' '}
                    {minha && <TicksWeb mensagem={m} outros={outros} />}
                </span>
            </div>

            {hover && !m.eliminada && (
                <div className={`absolute -top-8 z-[2] flex items-center gap-1 rounded-full bg-[var(--maka-superficie)] px-2 py-1 shadow-lg ring-1 ring-black/5 ${minha ? 'right-2' : 'left-2'}`}>
                    {acoes.reagir && EMOJIS.map((e) => (
                        <button key={e} className="cursor-pointer border-0 bg-transparent p-0 text-[15px] transition-transform hover:scale-125" onClick={() => acoes.reagir?.(e)}>
                            {e}
                        </button>
                    ))}
                    <button className="cursor-pointer border-0 bg-transparent p-0 text-sm text-[var(--maka-texto-suave)] hover:text-[var(--maka-texto)]" title="Responder" onClick={acoes.responder}>
                        ↩
                    </button>
                    {(acoes.editar || acoes.eliminar || acoes.encaminhar) && (
                        <button className="cursor-pointer border-0 bg-transparent p-0 text-sm text-[var(--maka-texto-suave)] hover:text-[var(--maka-texto)]" onClick={() => setMenu(!menu)}>
                            ⋯
                        </button>
                    )}
                    {menu && (
                        <div className="absolute right-0 top-8 min-w-[140px] overflow-hidden rounded-xl bg-[var(--maka-superficie)] shadow-xl ring-1 ring-black/5">
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
    if (a.tipo === 'foto')
        return <img src={a.url} className="max-w-[240px] cursor-pointer rounded-xl transition-opacity hover:opacity-90" alt="" onClick={() => window.open(a.url as string, '_blank')} />;
    if (a.tipo === 'video') return <video src={a.url} controls className="max-w-[260px] rounded-xl" />;
    if (a.tipo === 'audio') return <audio src={a.url} controls className="max-w-[240px]" />;

    return (
        <a href={a.url} target="_blank" rel="noreferrer" className="text-inherit underline-offset-2 hover:underline">
            📎 Ficheiro{a.tamanho_bytes ? ` (${Math.round(a.tamanho_bytes / 1024)} KB)` : ''}
        </a>
    );
}

function ItemMenu({ onClick, children }: { onClick(): void; children: React.ReactNode }) {
    return (
        <button onClick={onClick} className="block w-full cursor-pointer whitespace-nowrap border-0 bg-transparent px-4 py-2 text-left text-[13px] text-[var(--maka-texto)] hover:bg-[var(--maka-fundo)]">
            {children}
        </button>
    );
}

function BotaoIcone({ onClick, titulo, children }: { onClick(): void; titulo: string; children: React.ReactNode }) {
    return (
        <button
            title={titulo}
            onClick={onClick}
            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-[17px] text-[var(--maka-texto-suave)] transition-colors hover:bg-[var(--maka-fundo)] hover:text-[var(--maka-texto)]"
        >
            {children}
        </button>
    );
}

function EscolherConversa({ titulo, aoEscolher, aoFechar }: { titulo: string; aoEscolher(c: Conversa): void; aoFechar(): void }) {
    return (
        <div className="fixed inset-0 z-[10000] grid place-items-center bg-slate-900/50 backdrop-blur-sm" onClick={aoFechar}>
            <div
                className="flex max-h-[70vh] w-[360px] animate-maka-subir flex-col overflow-hidden rounded-2xl bg-[var(--maka-superficie)] shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-4 py-3 font-bold text-[var(--maka-texto)]">{titulo}</div>
                <div className="maka-scroll flex-1 overflow-auto">
                    <MakaChatConversas onAbrirConversa={aoEscolher} />
                </div>
            </div>
        </div>
    );
}

function TicksWeb({ mensagem, outros }: { mensagem: Mensagem; outros: ParticipanteConversa[] }) {
    if (mensagem.estado_envio === 'a_enviar') return <span>🕓</span>;
    if (mensagem.estado_envio === 'falhou') return <span className="font-bold text-red-500">!</span>;

    const entregue = outros.length > 0 && outros.every((p) => idMaiorOuIgual(p.ultima_entrega_mensagem_id, mensagem.id));
    const lida = outros.length > 0 && outros.every((p) => idMaiorOuIgual(p.ultima_leitura_mensagem_id, mensagem.id));

    return <span className={lida ? 'opacity-100' : 'opacity-60'}>{entregue || lida ? '✓✓' : '✓'}</span>;
}

export function AvatarWeb({ nome, url, tamanho = 44 }: { nome: string; url?: string | null; tamanho?: number }) {
    if (url) {
        return (
            <img
                src={url}
                alt={nome}
                className="shrink-0 rounded-full object-cover ring-2 ring-black/5"
                style={{ width: tamanho, height: tamanho }}
            />
        );
    }

    return (
        <span
            className="grid shrink-0 place-items-center rounded-full bg-[var(--maka-primaria)] font-bold text-[var(--maka-primaria-contraste)] ring-2 ring-black/5"
            style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.42 }}
        >
            {nome.trim().charAt(0).toUpperCase() || '?'}
        </span>
    );
}

export function horaCurtaWeb(iso: string): string {
    const data = new Date(iso);

    if (data.toDateString() === new Date().toDateString()) {
        return data.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    }

    return data.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
}
