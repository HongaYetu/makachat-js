import { Icon } from '@iconify/react';
import { AlvoParticipante, Anexo, Conversa, dividirLinks, idMaiorOuIgual, Mensagem, MensagemLink, ParticipanteConversa, ReciboParticipante, rotuloTipoIdentidade } from '@hongayetu/makachat-core';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ReprodutorAudio } from './audio';
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
import { tocarSom } from './sons';

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

/** Contraparte de uma privada (o participante que não sou eu). */
function contraparteDe(c: Conversa, identidade: { id: string; tipo: string }) {
    if (c.tipo !== 'privada') return null;

    return c.participantes.find((p) => !(p.id_externo === identidade.id && p.tipo === identidade.tipo)) ?? null;
}

/** Badge de verificação (metadados.verificado) ao lado do nome — nem todos os serviços o usam. */
export function NomeComBadge({ nome, metadados, className = '' }: {
    nome: React.ReactNode; metadados?: Record<string, unknown> | null; className?: string;
}) {
    return (
        <span className={`inline-flex min-w-0 items-center gap-1 ${className}`}>
            <span className="min-w-0 truncate">{nome}</span>
            {metadados?.verificado === true && (
                <Icon icon="tabler:rosette-discount-check-filled" className="shrink-0 text-[1.05em] text-[var(--maka-primaria)]" />
            )}
        </span>
    );
}

/** Cartão genérico de partilha/link — o serviço fornece o payload, a app decide a navegação. */
function CartaoPartilha({ mensagem, minha, aoAbrir }: {
    mensagem: Mensagem; minha: boolean; aoAbrir?(metadados: NonNullable<Mensagem['metadados']>): void;
}) {
    const meta = mensagem.metadados ?? {};

    const abrir = () => {
        if (aoAbrir) return aoAbrir(meta);
        if (typeof meta.url === 'string') window.open(meta.url, '_blank', 'noopener');
    };

    return (
        <button
            onClick={abrir}
            className={`flex w-[260px] cursor-pointer items-stretch gap-0 overflow-hidden rounded-xl border-0 p-0 text-left text-inherit transition-transform hover:scale-[1.01] ${minha ? 'bg-white/15' : 'bg-black/5'}`}
        >
            {typeof meta.imagem_url === 'string' && (
                <img src={meta.imagem_url} alt="" className="h-[72px] w-[72px] shrink-0 object-cover" />
            )}
            <span className="flex min-w-0 flex-col justify-center gap-0.5 px-3 py-2">
                <span className="truncate text-sm font-bold">{String(meta.titulo ?? meta.url ?? 'Partilha')}</span>
                {typeof meta.subtitulo === 'string' && <span className="truncate text-xs opacity-75">{meta.subtitulo}</span>}
                <span className="flex items-center gap-1 text-[10px] opacity-60">
                    <Icon icon={mensagem.tipo === 'link' ? 'tabler:link' : 'tabler:external-link'} />
                    {String(meta.contexto_tipo ?? 'ligação')}
                </span>
            </span>
        </button>
    );
}

/** 'cima' quando não há espaço abaixo do elemento clicado para um menu de ~alturaEstimada px. */
function direcaoMenu(e: React.MouseEvent, alturaEstimada = 220): 'cima' | 'baixo' {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();

    return r.bottom + alturaEstimada > window.innerHeight && r.top > alturaEstimada ? 'cima' : 'baixo';
}

/** Fecha um popup ao clicar fora do elemento marcado com data-maka-pop=chave. */
export function useFecharFora(ativo: boolean, chave: string, fechar: () => void): void {
    useEffect(() => {
        if (!ativo) return;

        const aoMousedown = (e: MouseEvent) => {
            if (!(e.target as Element | null)?.closest?.(`[data-maka-pop="${chave}"]`)) fechar();
        };

        document.addEventListener('mousedown', aoMousedown);

        return () => document.removeEventListener('mousedown', aoMousedown);
    }, [ativo, chave, fechar]);
}

// ---------------------------------------------------------------- lista

export interface MakaChatConversasProps {
    arquivadas?: boolean;
    conversaAtivaId?: string | null;
    onAbrirConversa(conversa: Conversa): void;
    /** título do estado vazio (padrão: "Ainda sem conversas") */
    tituloVazio?: string;
    /** subtítulo do estado vazio */
    textoVazio?: string;
    /** estado vazio COMPLETAMENTE custom da app — substitui o do SDK */
    renderVazio?(): React.ReactNode;
}

export function MakaChatConversas({ arquivadas = false, conversaAtivaId, onAbrirConversa, tituloVazio, textoVazio, renderVazio }: MakaChatConversasProps) {
    const { engine, api, contactos, identidade, obterOnline } = useMakaChat();
    const podeGrupos = useFuncionalidadeAtiva('grupos');
    const podeEliminarConversa = useFuncionalidadeAtiva('conversas.eliminar');
    // serviços com conversas só de sistema (ex.: via encomenda) não criam
    const podeCriarConversa = useFuncionalidadeAtiva('conversas.criar');
    const versao = useVersaoChat();
    const [verArquivadas, setVerArquivadas] = useState(arquivadas);
    const [conversas, setConversas] = useState<Conversa[]>([]);
    const [menuDe, setMenuDe] = useState<string | null>(null);
    const [busca, setBusca] = useState('');
    const [criarGrupo, setCriarGrupo] = useState(false);
    const [verOnline, setVerOnline] = useState(false);
    const [confirmarEliminar, setConfirmarEliminar] = useState<Conversa | null>(null);

    const [menuDirecao, setMenuDirecao] = useState<'cima' | 'baixo'>('baixo');
    const [resultadosServidor, setResultadosServidor] = useState<Conversa[] | null>(null);
    const [proximoCursor, setProximoCursor] = useState<string | null>(null);
    const [aCarregar, setACarregar] = useState(true);
    const aPaginar = useRef(false);

    useEffect(() => {
        void engine.storage.listarConversas(verArquivadas).then(setConversas);
    }, [engine, verArquivadas, versao]);

    // busca ao servidor ao montar — o popover do dock pode abrir antes do socket
    // ligar (ou com o socket em falha) e o storage ainda estar vazio
    useEffect(() => {
        let ativo = true;

        void engine
            .atualizarConversas()
            .catch(() => undefined)
            .finally(() => {
                if (ativo) setACarregar(false);
            });

        return () => {
            ativo = false;
        };
    }, [engine]);

    // pesquisa também no servidor (debounce 300ms) — apanha conversas fora do cache local
    useEffect(() => {
        const q = busca.trim();

        if (!q) {
            setResultadosServidor(null);

            return;
        }

        const temporizador = setTimeout(() => {
            void api
                .listarConversas({ q, arquivadas: verArquivadas, limite: 30 })
                .then(async (r) => {
                    setResultadosServidor(r.conversas);
                    await engine.storage.upsertConversas(r.conversas);
                })
                .catch(() => setResultadosServidor(null));
        }, 300);

        return () => clearTimeout(temporizador);
    }, [api, engine, busca, verArquivadas]);

    // paginação: perto do fim da lista, busca a página seguinte por cursor
    const aoScrollLista = async (e: React.UIEvent<HTMLDivElement>) => {
        const el = e.currentTarget;

        if (busca.trim() || aPaginar.current) return;
        if (el.scrollHeight - el.scrollTop - el.clientHeight > 120) return;

        const ultima = conversas.at(-1);

        if (!ultima || proximoCursor === 'fim') return;

        aPaginar.current = true;

        try {
            const r = await api.listarConversas({
                arquivadas: verArquivadas,
                cursor: String(ultima.ultima_atividade_em),
                limite: 30,
            });

            if (r.conversas.length) {
                await engine.storage.upsertConversas(r.conversas);
            } else {
                setProximoCursor('fim');
            }
        } finally {
            aPaginar.current = false;
        }
    };

    useFecharFora(menuDe !== null, 'menu-lista', () => setMenuDe(null));

    const preferencia = async (c: Conversa, dados: { arquivada?: boolean; fixada?: boolean }) => {
        setMenuDe(null);
        await api.atualizarPreferencias(c.id, dados).catch(() => undefined);
        await engine.atualizarConversas();
        // arquivadas saem da lista local imediatamente
        if (dados.arquivada !== undefined) setConversas((atuais) => atuais.filter((x) => x.id !== c.id));
    };

    return (
        <div className="flex h-full flex-col bg-[var(--maka-superficie)]">
            <div className="flex items-center gap-1 px-4 pt-2.5 pb-0.5">
                <span className="flex-1 text-[15px] font-bold text-[var(--maka-texto)]">
                    {verArquivadas ? 'Arquivadas' : 'Conversas'}
                </span>
                {obterOnline && !verArquivadas && (
                    <BotaoIcone titulo="Pessoas online" onClick={() => setVerOnline(true)}>
                        <span className="relative grid place-items-center">
                            <Icon icon="tabler:users" />
                            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-[var(--maka-superficie)]" />
                        </span>
                    </BotaoIcone>
                )}
                <BotaoIcone titulo={verArquivadas ? 'Voltar às conversas' : 'Arquivadas'} onClick={() => setVerArquivadas(!verArquivadas)}>
                    <Icon icon={verArquivadas ? 'tabler:arrow-left' : 'tabler:archive'} />
                </BotaoIcone>
                {podeCriarConversa && (
                    <BotaoIcone titulo="Nova conversa" onClick={() => setCriarGrupo(true)}>
                        <Icon icon="tabler:message-plus" />
                    </BotaoIcone>
                )}
            </div>
            <div className="px-3 pb-2 pt-2">
                <div className="flex items-center gap-2 rounded-full bg-[var(--maka-fundo)] px-3.5 py-2">
                    <Icon icon="tabler:search" className="shrink-0 text-[var(--maka-texto-suave)]" />
                    <input
                        className="w-full border-0 bg-transparent text-sm text-[var(--maka-texto)] outline-none placeholder:text-[var(--maka-texto-suave)]"
                        placeholder="Pesquisar conversas"
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                    />
                    {busca && (
                        <button onClick={() => setBusca('')} className="grid cursor-pointer place-items-center border-0 bg-transparent p-0 text-[var(--maka-texto-suave)]">
                            <Icon icon="tabler:x" className="text-sm" />
                        </button>
                    )}
                </div>
            </div>
            <div className="maka-scroll min-h-0 flex-1 overflow-y-auto" onScroll={(e) => void aoScrollLista(e)}>
            {conversas.length === 0 && (
                aCarregar ? (
                    <div className="flex flex-col items-center gap-2 pt-16 text-[var(--maka-texto-suave)]">
                        <Icon icon="tabler:loader-2" className="animate-spin text-3xl text-[var(--maka-primaria)]" />
                        <span className="text-sm">A carregar conversas…</span>
                    </div>
                ) : busca.trim() ? (
                    <div className="pt-16 text-center text-sm text-[var(--maka-texto-suave)]">Sem resultados.</div>
                ) : renderVazio ? (
                    <>{renderVazio()}</>
                ) : (
                    <div className="flex flex-col items-center px-8 pt-14 text-center">
                        <div className="mb-4 grid h-20 w-20 place-items-center rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--maka-primaria) 10%, transparent)' }}>
                            <Icon icon={verArquivadas ? 'tabler:archive' : 'tabler:messages'} className="text-4xl text-[var(--maka-primaria)]" />
                        </div>
                        <span className="mb-1 text-[15px] font-extrabold text-[var(--maka-texto)]">
                            {tituloVazio ?? (verArquivadas ? 'Nada arquivado' : 'Ainda sem conversas')}
                        </span>
                        <span className="text-[13px] leading-snug text-[var(--maka-texto-suave)]">
                            {textoVazio ??
                                (verArquivadas
                                    ? 'As conversas que arquivares aparecem aqui.'
                                    : 'Quando começares a falar com alguém, as conversas aparecem aqui.')}
                        </span>
                        {!verArquivadas && podeCriarConversa && (
                            <button
                                onClick={() => setCriarGrupo(true)}
                                className="mt-4 flex cursor-pointer items-center gap-1.5 rounded-full border-0 bg-[var(--maka-primaria)] px-4 py-2.5 text-sm font-bold text-[var(--maka-primaria-contraste)] shadow-md"
                            >
                                <Icon icon="tabler:plus" />
                                Começar conversa
                            </button>
                        )}
                    </div>
                )
            )}
            {(busca.trim() && resultadosServidor
                ? resultadosServidor
                : conversas.filter((c) => !busca.trim() || (c.titulo ?? '').toLowerCase().includes(busca.trim().toLowerCase()))
            ).map((c) => {
                const ativa = c.id === conversaAtivaId;
                const naoLidas = c.participante?.mensagens_nao_lidas ?? 0;

                return (
                    <div key={c.id} className="group relative px-2 py-0.5">
                    <button
                        onClick={() => onAbrirConversa(c)}
                        className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border-0 px-3 py-2.5 text-left transition-colors ${
                            ativa
                                ? 'bg-[color-mix(in_srgb,var(--maka-primaria)_10%,transparent)]'
                                : 'bg-transparent hover:bg-black/[.04]'
                        }`}
                    >
                        <span className="relative shrink-0">
                            <AvatarWeb nome={c.titulo ?? '?'} url={c.foto_url} grupo={c.tipo === 'grupo'} />
                            {/* bolinha online da contraparte (snapshot no connect + eventos) */}
                            {c.tipo === 'privada' &&
                                (() => {
                                    const outro = contraparteDe(c, identidade);

                                    return outro && engine.presencaDe(outro.identidade_id)?.online ? (
                                        <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-[var(--maka-superficie)]" />
                                    ) : null;
                                })()}
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className={`block truncate text-sm text-[var(--maka-texto)] ${naoLidas ? 'font-bold' : 'font-semibold'}`}>
                                <NomeComBadge nome={c.titulo ?? 'Conversa'} metadados={contraparteDe(c, identidade)?.metadados} />
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
                            <span className="flex items-center gap-1">
                                {c.chamada_ativa && (
                                    <Icon icon="tabler:phone-filled" className="animate-maka-pulsar text-[13px] text-emerald-500" />
                                )}
                                {c.participante?.silenciada_ate && new Date(c.participante.silenciada_ate) > new Date() && (
                                    <Icon icon="tabler:bell-off" className="text-[13px] text-[var(--maka-texto-suave)]" />
                                )}
                                {c.participante?.fixada && <Icon icon="tabler:pin-filled" className="text-[13px] text-[var(--maka-texto-suave)]" />}
                            </span>
                        </span>
                    </button>
                    <button
                        data-maka-pop="menu-lista"
                        onClick={(e) => { setMenuDirecao(direcaoMenu(e)); setMenuDe(menuDe === c.id ? null : c.id); }}
                        className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-0 bg-[var(--maka-superficie)] text-[var(--maka-texto-suave)] opacity-0 shadow ring-1 ring-black/[.05] transition-opacity group-hover:opacity-100"
                        title="Opções"
                    >
                        <Icon icon="tabler:chevron-down" />
                    </button>
                    {menuDe === c.id && (
                        <div data-maka-pop="menu-lista" className={`absolute right-3 ${menuDirecao === 'cima' ? 'bottom-12' : 'top-12'} z-[6] min-w-[190px] animate-maka-subir overflow-hidden rounded-xl bg-[var(--maka-superficie)] shadow-maka-pop ring-1 ring-black/[.05]`}>
                            <ItemMenu onClick={() => { setMenuDe(null); void engine.marcarNaoLida(c.id).catch(() => undefined); }}>
                                <Icon icon="tabler:mail-opened" className="inline align-[-2px]" /> Marcar como não lida
                            </ItemMenu>
                            <ItemMenu onClick={() => void preferencia(c, { fixada: !c.participante?.fixada })}>
                                <Icon icon={c.participante?.fixada ? 'tabler:pinned-off' : 'tabler:pin'} className="inline align-[-2px]" /> {c.participante?.fixada ? 'Desafixar' : 'Fixar'}
                            </ItemMenu>
                            <ItemMenu onClick={() => {
                                setMenuDe(null);
                                const silenciada = !!c.participante?.silenciada_ate && new Date(c.participante.silenciada_ate) > new Date();
                                void engine.silenciarConversa(c.id, silenciada ? null : '9999-12-31T00:00:00.000Z');
                            }}>
                                <Icon icon={c.participante?.silenciada_ate && new Date(c.participante.silenciada_ate) > new Date() ? 'tabler:bell' : 'tabler:bell-off'} className="inline align-[-2px]" /> {c.participante?.silenciada_ate && new Date(c.participante.silenciada_ate) > new Date() ? 'Reativar notificações' : 'Silenciar'}
                            </ItemMenu>
                            <ItemMenu onClick={() => void preferencia(c, { arquivada: !verArquivadas })}>
                                <Icon icon={verArquivadas ? 'tabler:archive-off' : 'tabler:archive'} className="inline align-[-2px]" /> {verArquivadas ? 'Desarquivar' : 'Arquivar'}
                            </ItemMenu>
                            {podeEliminarConversa && (
                                <ItemMenu onClick={() => { setMenuDe(null); setConfirmarEliminar(c); }}>
                                    <Icon icon="tabler:trash" className="inline align-[-2px]" /> Eliminar conversa
                                </ItemMenu>
                            )}
                        </div>
                    )}
                    </div>
                );
            })}
            </div>
            {criarGrupo && (
                <NovaConversaModal
                    conversas={conversas}
                    contactos={contactos}
                    podeGrupos={podeGrupos}
                    aoFechar={() => setCriarGrupo(false)}
                    aoCriada={(c) => { setCriarGrupo(false); onAbrirConversa(c); }}
                />
            )}
            {verOnline && (
                <OnlineModal
                    aoFechar={() => setVerOnline(false)}
                    aoCriada={(c) => { setVerOnline(false); onAbrirConversa(c); }}
                />
            )}
            {confirmarEliminar && (
                <ConfirmarDialogo
                    titulo="Eliminar conversa?"
                    descricao="O histórico desaparece para ti. A outra pessoa mantém a conversa dela."
                    aoFechar={() => setConfirmarEliminar(null)}
                    botoes={[{ rotulo: 'Eliminar conversa', destrutivo: true, acao: () => void engine.eliminarConversa(confirmarEliminar.id) }]}
                />
            )}
        </div>
    );
}

/** Contrapartes das conversas privadas + contactos da app, sem duplicados. */
function pessoasConhecidas(conversas: Conversa[], contactos: AlvoParticipante[], excluir: Set<string> = new Set()): AlvoParticipante[] {
    const mapa = new Map<string, AlvoParticipante>();

    for (const c of contactos) mapa.set(`${c.tipo}:${c.id_externo}`, c);

    for (const conversa of conversas) {
        if (conversa.tipo !== 'privada') continue;

        for (const p of conversa.participantes) {
            mapa.set(`${p.tipo}:${p.id_externo}`, { id_externo: p.id_externo, tipo: p.tipo, nome: p.nome, foto: p.foto_url });
        }
    }

    return [...mapa.values()].filter((p) => !excluir.has(`${p.tipo}:${p.id_externo}`));
}

/** Info da conversa/grupo: participantes, papéis e gestão (renomear, foto, membros, sair). */
function InfoConversa({ conversa, eu, aoFechar, aoAbrirOutraConversa, aoSaiu }: {
    conversa: Conversa; eu: ParticipanteConversa; aoFechar(): void;
    aoAbrirOutraConversa?(id: string): void; aoSaiu(): void;
}) {
    const { api, engine, contactos, aoVerPerfil } = useMakaChat();
    const podeCriarConversa = useFuncionalidadeAtiva('conversas.criar');
    const grupo = conversa.tipo === 'grupo';
    const souAdmin = grupo && ['dono', 'admin'].includes(eu.papel);
    const [nome, setNome] = useState(conversa.titulo ?? '');
    const [adicionar, setAdicionar] = useState(false);
    const [confirmarSair, setConfirmarSair] = useState(false);
    const [aEnviarFoto, setAEnviarFoto] = useState(false);
    const [conversas, setConversas] = useState<Conversa[]>([]);
    const fotoInput = useRef<HTMLInputElement>(null);
    const membros = conversa.participantes.filter((p) => !p.saiu_em);
    const contraparteInfo = !grupo ? membros.find((p) => p.identidade_id !== eu.identidade_id && p.tipo !== 'sistema') ?? null : null;

    useEffect(() => {
        void engine.storage.listarConversas(false).then(setConversas);
    }, [engine]);

    const renomear = async () => {
        if (nome.trim() && nome.trim() !== conversa.titulo) {
            await api.atualizarGrupo(conversa.id, { titulo: nome.trim() }).catch(() => undefined);
            await engine.atualizarConversas();
        }
    };

    const mudarFoto = async (f: File) => {
        setAEnviarFoto(true);

        try {
            const criado = await api.criarMedia({ tipo: 'foto', mime: f.type, nome_ficheiro: f.name });
            await api.carregarMedia(criado.upload, f, f.type);
            const { anexo } = await api.confirmarMedia(criado.anexo_id, { duravel: true });
            await api.atualizarGrupo(conversa.id, { foto_url: anexo.url });
            await engine.atualizarConversas();
        } finally {
            setAEnviarFoto(false);
        }
    };

    const mensagemDireta = async (p: ParticipanteConversa) => {
        const { conversa: nova } = await api.criarPrivada({ id_externo: p.id_externo, tipo: p.tipo, nome: p.nome });
        await engine.atualizarConversas();
        aoFechar();
        aoAbrirOutraConversa?.(nova.id);
    };

    return (
        <div className="fixed inset-0 z-[10000] grid place-items-center bg-slate-900/50 backdrop-blur-sm" onClick={aoFechar}>
            <div className="flex max-h-[80vh] w-[380px] animate-maka-subir flex-col overflow-hidden rounded-2xl bg-[var(--maka-superficie)] shadow-maka-modal" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3">
                    <span className="font-bold text-[var(--maka-texto)]">{grupo ? 'Info do grupo' : 'Info da conversa'}</span>
                    <BotaoIcone titulo="Fechar" onClick={aoFechar}><Icon icon="tabler:x" /></BotaoIcone>
                </div>

                <div className="flex flex-col items-center gap-2 px-4 pb-3">
                    <span className="relative">
                        <AvatarWeb nome={conversa.titulo ?? '?'} url={conversa.foto_url} tamanho={72} grupo={grupo} />
                        {souAdmin && (
                            <button
                                onClick={() => fotoInput.current?.click()}
                                title="Mudar foto"
                                className="absolute -bottom-1 -right-1 grid h-7 w-7 cursor-pointer place-items-center rounded-full border-0 bg-[var(--maka-primaria)] text-sm text-[var(--maka-primaria-contraste)] shadow"
                            >
                                {aEnviarFoto ? <Icon icon="tabler:loader-2" className="animate-spin" /> : <Icon icon="tabler:camera" />}
                            </button>
                        )}
                        <input ref={fotoInput} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void mudarFoto(f); e.target.value = ''; }} />
                    </span>
                    {souAdmin ? (
                        <input
                            className="w-full rounded-full border border-solid border-slate-300/60 bg-[var(--maka-fundo)] px-4 py-2 text-center text-sm font-bold text-[var(--maka-texto)] outline-none focus:ring-2 focus:ring-[var(--maka-primaria)]"
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            onBlur={() => void renomear()}
                            onKeyDown={(e) => e.key === 'Enter' && void renomear()}
                        />
                    ) : (
                        <span className="font-bold text-[var(--maka-texto)]">{conversa.titulo}</span>
                    )}
                    <span className="text-xs text-[var(--maka-texto-suave)]">{grupo ? `${membros.length} membros` : ''}</span>
                    {contraparteInfo && engine.presencaDe(contraparteInfo.identidade_id)?.online && (
                        <span className="text-xs font-semibold text-emerald-500">online</span>
                    )}
                    {/* "Ver perfil" — só quando o serviço fornece a navegação (ex.: kanda) */}
                    {contraparteInfo && aoVerPerfil && (
                        <button
                            onClick={() => aoVerPerfil(contraparteInfo)}
                            className="mt-1 flex cursor-pointer items-center gap-1.5 rounded-full border border-solid border-[var(--maka-primaria)] bg-transparent px-4 py-1.5 text-sm font-bold text-[var(--maka-primaria)]"
                        >
                            <Icon icon="tabler:user-circle" /> Ver perfil
                        </button>
                    )}
                </div>

                <div className="maka-scroll min-h-0 flex-1 overflow-auto border-0 border-t border-solid border-black/5">
                    {membros.map((p) => {
                        const souEu = p.identidade_id === eu.identidade_id;

                        return (
                            <div key={p.identidade_id} className="flex items-center gap-3 px-4 py-2.5">
                                <span className="relative shrink-0">
                                    <AvatarWeb nome={p.nome} url={p.foto_url} tamanho={36} />
                                    {!souEu && engine.presencaDe(p.identidade_id)?.online && (
                                        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-[var(--maka-superficie)]" />
                                    )}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold text-[var(--maka-texto)]">{souEu ? 'Tu' : p.nome}</span>
                                    <span className="text-xs text-[var(--maka-texto-suave)]">
                                        {p.papel === 'dono' ? 'Dono' : p.papel === 'admin' ? 'Admin' : rotuloTipoIdentidade(p.tipo)}
                                    </span>
                                </span>
                                {!souEu && aoVerPerfil && (
                                    <BotaoIcone titulo="Ver perfil" onClick={() => aoVerPerfil(p)}>
                                        <Icon icon="tabler:user-circle" />
                                    </BotaoIcone>
                                )}
                                {!souEu && podeCriarConversa && <BotaoIcone titulo="Mensagem" onClick={() => void mensagemDireta(p)}><Icon icon="tabler:message-circle" /></BotaoIcone>}
                                {!souEu && souAdmin && p.papel !== 'dono' && (
                                    <BotaoIcone
                                        titulo={p.papel === 'admin' ? 'Remover de administrador' : 'Tornar administrador'}
                                        onClick={() => {
                                            void api
                                                .mudarPapel(conversa.id, p.identidade_id, p.papel === 'admin' ? 'membro' : 'admin')
                                                .then(() => engine.atualizarConversas())
                                                .catch(() => undefined);
                                        }}
                                    >
                                        <Icon icon={p.papel === 'admin' ? 'tabler:shield-off' : 'tabler:shield-plus'} />
                                    </BotaoIcone>
                                )}
                                {!souEu && souAdmin && (
                                    <BotaoIcone titulo="Remover do grupo" onClick={() => { void api.removerParticipante(conversa.id, p.identidade_id).then(() => engine.atualizarConversas()); }}>
                                        <Icon icon="tabler:user-minus" className="text-red-500" />
                                    </BotaoIcone>
                                )}
                            </div>
                        );
                    })}

                    {/* media da conversa (Fotos/Ficheiros/Áudios/Links) */}
                    <MediaDaConversaWeb conversaId={conversa.id} />
                </div>

                {grupo && (
                    <div className="flex gap-2 p-3">
                        {souAdmin && (
                            <button onClick={() => setAdicionar(true)} className="flex-1 cursor-pointer rounded-full border-0 bg-[var(--maka-primaria)] py-2.5 text-sm font-bold text-[var(--maka-primaria-contraste)] shadow-sm">
                                Adicionar membros
                            </button>
                        )}
                        <button onClick={() => setConfirmarSair(true)} className="flex-1 cursor-pointer rounded-full border-0 bg-red-600/10 py-2.5 text-sm font-bold text-red-600">
                            Sair do grupo
                        </button>
                    </div>
                )}
            </div>

            {adicionar && (
                <div onClick={(e) => e.stopPropagation()}>
                    <AdicionarMembros
                        conversa={conversa}
                        conversas={conversas}
                        contactos={contactos}
                        aoFechar={() => setAdicionar(false)}
                    />
                </div>
            )}
            {confirmarSair && (
                <div onClick={(e) => e.stopPropagation()}>
                    <ConfirmarDialogo
                        titulo="Sair do grupo?"
                        aoFechar={() => setConfirmarSair(false)}
                        botoes={[{ rotulo: 'Sair do grupo', destrutivo: true, acao: () => { void api.sairDaConversa(conversa.id).then(() => engine.atualizarConversas()); aoSaiu(); } }]}
                    />
                </div>
            )}
        </div>
    );
}

const TABS_MEDIA: { chave: 'fotos' | 'ficheiros' | 'audios' | 'links'; rotulo: string }[] = [
    { chave: 'fotos', rotulo: 'Fotos' },
    { chave: 'ficheiros', rotulo: 'Ficheiros' },
    { chave: 'audios', rotulo: 'Áudios' },
    { chave: 'links', rotulo: 'Links' },
];

/** Tabs de media da conversa na info — fonte: GET /conversas/:id/media (hub, paginado). */
function MediaDaConversaWeb({ conversaId }: { conversaId: string }) {
    const { api } = useMakaChat();
    const [tab, setTab] = useState<(typeof TABS_MEDIA)[number]['chave']>('fotos');
    const [anexos, setAnexos] = useState<(Anexo & { mensagem_id: string })[] | null>(null);
    const [links, setLinks] = useState<MensagemLink[] | null>(null);
    const [aCarregar, setACarregar] = useState(false);
    const [temMais, setTemMais] = useState(false);
    const LIMITE = 24;

    const carregar = async (antesDe?: string) => {
        setACarregar(true);

        try {
            const r = await api.listarMedia(conversaId, tab, { antes_de: antesDe, limite: LIMITE });

            if (tab === 'links') {
                const novos = r.links ?? [];
                setLinks((a) => (antesDe ? [...(a ?? []), ...novos] : novos));
                setTemMais(novos.length === LIMITE);
            } else {
                const novos = r.anexos ?? [];
                setAnexos((a) => (antesDe ? [...(a ?? []), ...novos] : novos));
                setTemMais(novos.length === LIMITE);
            }
        } catch {
            if (tab === 'links') setLinks([]);
            else setAnexos([]);
        } finally {
            setACarregar(false);
        }
    };

    useEffect(() => {
        setAnexos(null);
        setLinks(null);
        void carregar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conversaId, tab]);

    const urlDoLink = (l: MensagemLink) => l.metadados?.url ?? dividirLinks(l.conteudo ?? '').find((p) => p.url)?.url;
    const vazio = tab === 'links' ? links !== null && links.length === 0 : anexos !== null && anexos.length === 0;

    return (
        <div className="border-0 border-t border-solid border-black/5 px-4 py-3">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[var(--maka-texto-suave)]">Media da conversa</span>
            <div className="mb-2 flex gap-1.5">
                {TABS_MEDIA.map((t) => (
                    <button
                        key={t.chave}
                        onClick={() => setTab(t.chave)}
                        className={`cursor-pointer rounded-full border-0 px-3 py-1.5 text-xs font-bold ${
                            tab === t.chave
                                ? 'bg-[var(--maka-primaria)] text-[var(--maka-primaria-contraste)]'
                                : 'bg-black/[.06] text-[var(--maka-texto-suave)]'
                        }`}
                    >
                        {t.rotulo}
                    </button>
                ))}
            </div>

            {aCarregar && anexos === null && links === null && (
                <div className="flex items-center gap-2 py-4 text-sm text-[var(--maka-texto-suave)]">
                    <Icon icon="tabler:loader-2" className="animate-spin" /> A carregar…
                </div>
            )}
            {vazio && !aCarregar && (
                <div className="py-3 text-sm text-[var(--maka-texto-suave)]">
                    Ainda não há {TABS_MEDIA.find((t) => t.chave === tab)?.rotulo.toLowerCase()} nesta conversa.
                </div>
            )}

            {tab === 'fotos' && !!anexos?.length && (
                <div className="grid grid-cols-3 gap-1">
                    {anexos.map((a) =>
                        a.url ? (
                            <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer">
                                <img src={a.url} alt="" className="aspect-square w-full rounded-lg object-cover" />
                            </a>
                        ) : null,
                    )}
                </div>
            )}

            {tab === 'ficheiros' &&
                anexos?.map((a) => (
                    <a
                        key={a.id}
                        href={a.url ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-semibold text-[var(--maka-texto)] no-underline hover:bg-black/[.04]"
                    >
                        <Icon icon="tabler:file" className="shrink-0 text-lg text-[var(--maka-texto-suave)]" />
                        <span className="min-w-0 flex-1 truncate">{a.nome_ficheiro ?? 'Ficheiro'}</span>
                        <Icon icon="tabler:download" className="shrink-0 text-[var(--maka-texto-suave)]" />
                    </a>
                ))}

            {tab === 'audios' &&
                anexos?.map((a) => (a.url ? <div key={a.id} className="py-1"><ReprodutorAudio url={a.url} duracaoSegundos={a.duracao_segundos} /></div> : null))}

            {tab === 'links' &&
                links?.map((l) => {
                    const url = urlDoLink(l);

                    return (
                        <a
                            key={l.id}
                            href={url ? String(url) : '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2.5 rounded-lg px-2 py-2 no-underline hover:bg-black/[.04]"
                        >
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--maka-primaria) 10%, transparent)' }}>
                                <Icon icon="tabler:link" className="text-[var(--maka-primaria)]" />
                            </span>
                            <span className="min-w-0 flex-1">
                                {!!l.metadados?.titulo && <span className="block truncate text-sm font-semibold text-[var(--maka-texto)]">{String(l.metadados.titulo)}</span>}
                                <span className="block truncate text-xs text-[var(--maka-texto-suave)]">{String(url ?? l.conteudo ?? '')}</span>
                            </span>
                        </a>
                    );
                })}

            {temMais && !aCarregar && (
                <button
                    onClick={() => {
                        const ultimo = tab === 'links' ? links?.at(-1)?.id : anexos?.at(-1)?.id;

                        if (ultimo) void carregar(ultimo);
                    }}
                    className="mt-2 w-full cursor-pointer rounded-full border-0 bg-transparent py-1.5 text-sm font-bold text-[var(--maka-primaria)]"
                >
                    Ver mais
                </button>
            )}
        </div>
    );
}

/** Relatório de entrega de uma mensagem de grupo (quem entregou / quem viu). */
function RelatorioEntregaWeb({ conversaId, mensagem, aoFechar }: {
    conversaId: string; mensagem: Mensagem; aoFechar(): void;
}) {
    const { api } = useMakaChat();
    const [recibos, setRecibos] = useState<ReciboParticipante[] | null>(null);

    useEffect(() => {
        let vivo = true;

        void api
            .recibosDaMensagem(conversaId, mensagem.id)
            .then((r) => vivo && setRecibos(r.recibos))
            .catch(() => vivo && setRecibos([]));

        return () => {
            vivo = false;
        };
    }, [api, conversaId, mensagem.id]);

    const vistos = (recibos ?? []).filter((r) => r.vista);
    const entregues = (recibos ?? []).filter((r) => r.entregue && !r.vista);

    const seccao = (titulo: string, icone: string, cor: string, lista: ReciboParticipante[]) =>
        lista.length > 0 && (
            <div className="mt-4">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--maka-texto-suave)]">
                    <Icon icon={icone} style={{ color: cor }} /> {titulo} · {lista.length}
                </div>
                {lista.map((r) => (
                    <div key={r.identidade_id} className="flex items-center gap-3 py-2">
                        <AvatarWeb nome={r.nome} url={r.foto_url} tamanho={36} />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--maka-texto)]">{r.nome}</span>
                        <Icon icon={icone} style={{ color: cor }} />
                    </div>
                ))}
            </div>
        );

    return (
        <div className="fixed inset-0 z-[10003] grid place-items-center bg-slate-900/50" onClick={aoFechar}>
            <div className="flex max-h-[74vh] w-[360px] animate-maka-subir flex-col overflow-hidden rounded-2xl bg-[var(--maka-superficie)] shadow-maka-modal" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3">
                    <span className="font-bold text-[var(--maka-texto)]">Relatório de entrega</span>
                    <BotaoIcone titulo="Fechar" onClick={aoFechar}><Icon icon="tabler:x" /></BotaoIcone>
                </div>
                <div className="maka-scroll min-h-0 flex-1 overflow-auto px-4 pb-4">
                    {mensagem.conteudo && (
                        <div className="truncate text-[13px] italic text-[var(--maka-texto-suave)]">“{mensagem.conteudo}”</div>
                    )}
                    {recibos === null ? (
                        <div className="flex items-center gap-2 py-6 text-sm text-[var(--maka-texto-suave)]">
                            <Icon icon="tabler:loader-2" className="animate-spin" /> A carregar…
                        </div>
                    ) : vistos.length === 0 && entregues.length === 0 ? (
                        <div className="py-6 text-center text-sm text-[var(--maka-texto-suave)]">Ainda ninguém recebeu esta mensagem.</div>
                    ) : (
                        <>
                            {seccao('Visto por', 'tabler:checks', '#0ea5e9', vistos)}
                            {seccao('Entregue a', 'tabler:checks', 'var(--maka-texto-suave)', entregues)}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function AdicionarMembros({ conversa, conversas, contactos, aoFechar }: {
    conversa: Conversa; conversas: Conversa[]; contactos: AlvoParticipante[]; aoFechar(): void;
}) {
    const { api, engine } = useMakaChat();
    const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set());
    const jaNoGrupo = new Set(conversa.participantes.filter((p) => !p.saiu_em).map((p) => `${p.tipo}:${p.id_externo}`));
    const pessoas = pessoasConhecidas(conversas, contactos, jaNoGrupo);

    const adicionar = async () => {
        const membros = pessoas.filter((p) => escolhidos.has(`${p.tipo}:${p.id_externo}`));
        await api.adicionarParticipantes(conversa.id, membros);
        await engine.atualizarConversas();
        aoFechar();
    };

    return (
        <div className="fixed inset-0 z-[10003] grid place-items-center bg-slate-900/50" onClick={aoFechar}>
            <div className="flex max-h-[70vh] w-[340px] animate-maka-subir flex-col overflow-hidden rounded-2xl bg-[var(--maka-superficie)] shadow-maka-modal" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3">
                    <span className="font-bold text-[var(--maka-texto)]">Adicionar membros</span>
                    <BotaoIcone titulo="Fechar" onClick={aoFechar}><Icon icon="tabler:x" /></BotaoIcone>
                </div>
                <div className="maka-scroll min-h-0 flex-1 overflow-auto">
                    {pessoas.length === 0 && <div className="px-4 py-6 text-sm text-[var(--maka-texto-suave)]">Toda a gente conhecida já está no grupo.</div>}
                    {pessoas.map((p) => {
                        const chave = `${p.tipo}:${p.id_externo}`;
                        const marcado = escolhidos.has(chave);

                        return (
                            <button key={chave} onClick={() => setEscolhidos((a) => { const n = new Set(a); marcado ? n.delete(chave) : n.add(chave); return n; })} className="flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-4 py-2.5 text-left hover:bg-black/[.04]">
                                <Icon icon={marcado ? 'tabler:circle-check-filled' : 'tabler:circle'} className={`text-xl ${marcado ? 'text-[var(--maka-primaria)]' : 'text-[var(--maka-texto-suave)]'}`} />
                                <AvatarWeb nome={p.nome ?? p.id_externo} url={p.foto} tamanho={32} />
                                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--maka-texto)]">{p.nome ?? p.id_externo}</span>
                            </button>
                        );
                    })}
                </div>
                <div className="p-3">
                    <button disabled={escolhidos.size === 0} onClick={() => void adicionar()} className="w-full cursor-pointer rounded-full border-0 bg-[var(--maka-primaria)] py-2.5 text-sm font-bold text-[var(--maka-primaria-contraste)] disabled:opacity-40">
                        Adicionar{escolhidos.size > 0 ? ` (${escolhidos.size})` : ''}
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * Pessoas online segundo o SERVIÇO (`obterOnline` no provider — ex.: quem
 * sigo). Refresca a cada 30s enquanto aberto; tap abre/cria a privada.
 */
function OnlineModal({ aoFechar, aoCriada }: { aoFechar(): void; aoCriada(c: Conversa): void }) {
    const { api, engine, obterOnline, identidade } = useMakaChat();
    const [pessoas, setPessoas] = useState<AlvoParticipante[] | null>(null);
    const [aCriar, setACriar] = useState(false);

    useEffect(() => {
        if (!obterOnline) return;

        let vivo = true;

        const carregar = () =>
            void obterOnline()
                .then((lista) => {
                    if (vivo) setPessoas(lista.filter((p) => !(p.id_externo === identidade.id && p.tipo === identidade.tipo)));
                })
                .catch(() => {
                    if (vivo) setPessoas([]);
                });

        carregar();
        const timer = setInterval(carregar, 30_000);

        return () => {
            vivo = false;
            clearInterval(timer);
        };
    }, [obterOnline, identidade]);

    const abrirConversa = async (p: AlvoParticipante) => {
        if (aCriar) return;

        setACriar(true);

        try {
            const { conversa } = await api.criarPrivada(p);
            await engine.atualizarConversas();
            aoCriada(conversa);
        } catch {
            setACriar(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] grid place-items-center bg-slate-900/50 backdrop-blur-sm" onClick={aoFechar}>
            <div className="flex max-h-[74vh] w-[360px] animate-maka-subir flex-col overflow-hidden rounded-2xl bg-[var(--maka-superficie)] shadow-maka-modal" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3">
                    <span className="flex items-center gap-2 font-bold text-[var(--maka-texto)]">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        Online agora
                    </span>
                    <BotaoIcone titulo="Fechar" onClick={aoFechar}><Icon icon="tabler:x" /></BotaoIcone>
                </div>
                <div className="maka-scroll min-h-0 flex-1 overflow-auto pb-2">
                    {pessoas === null && (
                        <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-[var(--maka-texto-suave)]">
                            <Icon icon="tabler:loader-2" className="animate-spin" /> A carregar…
                        </div>
                    )}
                    {pessoas !== null && pessoas.length === 0 && (
                        <div className="px-4 py-8 text-center text-sm text-[var(--maka-texto-suave)]">Ninguém online agora.</div>
                    )}
                    {(pessoas ?? []).map((p) => (
                        <button
                            key={`${p.tipo}:${p.id_externo}`}
                            disabled={aCriar}
                            onClick={() => void abrirConversa(p)}
                            className="flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-4 py-2.5 text-left hover:bg-black/[.04]"
                        >
                            <span className="relative">
                                <AvatarWeb nome={p.nome ?? p.id_externo} url={p.foto} tamanho={38} />
                                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-[var(--maka-superficie)]" />
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--maka-texto)]">{p.nome ?? p.id_externo}</span>
                            <Icon icon="tabler:message-circle" className="text-[var(--maka-texto-suave)]" />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

function NovaConversaModal({ conversas, contactos, podeGrupos, aoFechar, aoCriada }: {
    conversas: Conversa[]; contactos: AlvoParticipante[]; podeGrupos: boolean; aoFechar(): void; aoCriada(c: Conversa): void;
}) {
    const { api, engine, identidade, pesquisarContactos } = useMakaChat();
    const [nome, setNome] = useState('');
    const [busca, setBusca] = useState('');
    const [resultados, setResultados] = useState<AlvoParticipante[] | null>(null);
    const [aPesquisar, setAPesquisar] = useState(false);
    // Map (não Set): os escolhidos têm de sobreviver a pesquisas que mudam a lista
    const [escolhidos, setEscolhidos] = useState<Map<string, AlvoParticipante>>(new Map());
    const pedidoAtual = useRef(0);
    const sugestoes = pessoasConhecidas(conversas, contactos, new Set([`${identidade.tipo}:${identidade.id}`]));

    // pesquisa NO serviço (debounce) quando a app fornece; senão filtro local
    useEffect(() => {
        const q = busca.trim();

        if (!q) {
            setResultados(null);
            setAPesquisar(false);

            return;
        }

        if (!pesquisarContactos) {
            const ql = q.toLowerCase();
            setResultados(sugestoes.filter((p) => (p.nome ?? p.id_externo).toLowerCase().includes(ql)));

            return;
        }

        setAPesquisar(true);
        const pedido = ++pedidoAtual.current;
        const timer = setTimeout(() => {
            void pesquisarContactos(q)
                .then((lista) => {
                    if (pedidoAtual.current !== pedido) return; // resposta obsoleta

                    setResultados(lista.filter((p) => !(p.id_externo === identidade.id && p.tipo === identidade.tipo)));
                })
                .catch(() => {
                    if (pedidoAtual.current === pedido) setResultados([]);
                })
                .finally(() => {
                    if (pedidoAtual.current === pedido) setAPesquisar(false);
                });
        }, 350);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [busca, pesquisarContactos]);

    const pessoas = busca.trim() ? (resultados ?? []) : sugestoes;
    const grupo = escolhidos.size > 1;
    const membros = [...escolhidos.values()];
    // sem nome escrito, o grupo nasce com os primeiros nomes dos membros
    const nomePadrao = membros.map((p) => (p.nome ?? p.id_externo).split(' ')[0]).join(', ');

    const criar = async () => {
        if (escolhidos.size === 0) return;

        const { conversa } = grupo
            ? await api.criarGrupo(nome.trim() || nomePadrao, membros)
            : await api.criarPrivada({ id_externo: membros[0].id_externo, tipo: membros[0].tipo, nome: membros[0].nome, foto: membros[0].foto });
        await engine.atualizarConversas();
        aoCriada(conversa);
    };

    return (
        <div className="fixed inset-0 z-[10000] grid place-items-center bg-slate-900/50 backdrop-blur-sm" onClick={aoFechar}>
            <div className="flex max-h-[74vh] w-[380px] animate-maka-subir flex-col overflow-hidden rounded-2xl bg-[var(--maka-superficie)] shadow-maka-modal" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3">
                    <span className="font-bold text-[var(--maka-texto)]">Nova conversa</span>
                    <BotaoIcone titulo="Fechar" onClick={aoFechar}><Icon icon="tabler:x" /></BotaoIcone>
                </div>
                <div className="px-4 pb-2">
                    <div className="flex items-center gap-2 rounded-full bg-[var(--maka-fundo)] px-3.5">
                        <Icon icon="tabler:search" className="shrink-0 text-[var(--maka-texto-suave)]" />
                        <input
                            autoFocus
                            className="w-full border-0 bg-transparent py-2.5 text-sm text-[var(--maka-texto)] outline-none"
                            placeholder="Pesquisar pessoas"
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                        />
                        {aPesquisar && <Icon icon="tabler:loader-2" className="shrink-0 animate-spin text-[var(--maka-texto-suave)]" />}
                    </div>
                </div>
                {podeGrupos && !busca.trim() && (
                    <div className="px-4 pb-1 text-xs text-[var(--maka-texto-suave)]">
                        Escolhe uma pessoa — ou várias para criar um grupo.
                    </div>
                )}
                {grupo && (
                    <div className="px-4 pb-2 pt-1">
                        <input
                            className="w-full rounded-full border border-solid border-slate-300/60 bg-[var(--maka-fundo)] px-4 py-2.5 text-sm text-[var(--maka-texto)] outline-none focus:ring-2 focus:ring-[var(--maka-primaria)]"
                            placeholder={`Nome do grupo (padrão: ${nomePadrao})`}
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                        />
                    </div>
                )}
                <div className="maka-scroll min-h-0 flex-1 overflow-auto">
                    {pessoas.length === 0 && (
                        <div className="px-4 py-6 text-sm text-[var(--maka-texto-suave)]">
                            {busca.trim() ? (aPesquisar ? 'A pesquisar…' : 'Sem resultados.') : 'Sem contactos conhecidos — usa a pesquisa.'}
                        </div>
                    )}
                    {pessoas.map((p) => {
                        const chave = `${p.tipo}:${p.id_externo}`;
                        const marcado = escolhidos.has(chave);

                        return (
                            <button
                                key={chave}
                                onClick={() => setEscolhidos((a) => {
                                    if (marcado) { const n = new Map(a); n.delete(chave); return n; }

                                    // sem flag de grupos, só uma pessoa de cada vez
                                    return podeGrupos ? new Map(a).set(chave, p) : new Map([[chave, p]]);
                                })}
                                className="flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-4 py-2.5 text-left hover:bg-black/[.04]"
                            >
                                <Icon icon={marcado ? 'tabler:circle-check-filled' : 'tabler:circle'} className={`text-xl ${marcado ? 'text-[var(--maka-primaria)]' : 'text-[var(--maka-texto-suave)]'}`} />
                                <AvatarWeb nome={p.nome ?? p.id_externo} url={p.foto} tamanho={34} />
                                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--maka-texto)]">{p.nome ?? p.id_externo}</span>
                            </button>
                        );
                    })}
                </div>
                <div className="p-3">
                    <button
                        disabled={escolhidos.size === 0}
                        onClick={() => void criar()}
                        className="w-full cursor-pointer rounded-full border-0 bg-[var(--maka-primaria)] py-2.5 text-sm font-bold text-[var(--maka-primaria-contraste)] shadow-md disabled:cursor-default disabled:opacity-40"
                    >
                        {grupo ? `Criar grupo (${escolhidos.size})` : 'Iniciar conversa'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function previewConversa(c: Conversa): string {
    const u = c.ultima_mensagem;

    if (!u) return '';
    if (u.eliminada) return '🚫 Mensagem eliminada';

    const p: Record<string, string> = { foto: '📷 Foto', video: '🎬 Vídeo', audio: '🎤 Áudio', ficheiro: '📎 Ficheiro', chamada: '📞 Chamada', partilha: '🔗 Partilha', link: '🔗 Link' };

    return u.tipo === 'texto' || u.tipo === 'sistema' || u.tipo === 'chamada' ? (u.conteudo ?? '') : (p[u.tipo] ?? '');
}

// ---------------------------------------------------------------- painel

export interface ConversaPainelProps {
    conversaId: string;
    compacto?: boolean;
    aoFechar?(): void;
    /** box do dock: botão de minimizar no header (header único, sem barra própria da box) */
    aoMinimizar?(): void;
    /** abrir outra conversa (ex.: "mensagem" a partir do modal de reações) */
    aoAbrirOutraConversa?(conversaId: string): void;
}

export function ConversaPainel({ conversaId, compacto = false, aoFechar, aoMinimizar, aoAbrirOutraConversa }: ConversaPainelProps) {
    const { engine, socket, identidade, api, registarVisivel } = useMakaChat();
    const chamadas = useChamadasOpcional();
    const versao = useVersaoChat();
    const mensagens = useMensagens(conversaId, 500);
    const typing = useTypingConversa(conversaId);
    const enviar = useEnviarMensagem();

    const podeAudioChamada = useFuncionalidadeAtiva('chamadas.audio');
    const podeCriarConversa = useFuncionalidadeAtiva('conversas.criar');
    const podeVideoChamada = useFuncionalidadeAtiva('chamadas.video');
    const podeFicheiro = useFuncionalidadeAtiva('media.ficheiro');
    const podeFoto = useFuncionalidadeAtiva('media.foto');
    const podeAudioMedia = useFuncionalidadeAtiva('media.audio');
    const podeReagir = useFuncionalidadeAtiva('reacoes');
    const podeEncaminhar = useFuncionalidadeAtiva('encaminhar');
    const podeEliminarConversa = useFuncionalidadeAtiva('conversas.eliminar');
    const podeMedia = podeFicheiro || podeFoto;

    const [conversa, setConversa] = useState<Conversa | null>(null);
    const [contexto, setContexto] = useState<{ titulo: string; subtitulo?: string; linhas?: string[] } | null>(null);
    const [texto, setTexto] = useState('');
    const [responderA, setResponderA] = useState<Mensagem | null>(null);
    const [editar, setEditar] = useState<Mensagem | null>(null);
    const [encaminhar, setEncaminhar] = useState<Mensagem | null>(null);
    const [reacoesDe, setReacoesDe] = useState<Mensagem | null>(null);
    const [fotosPendentes, setFotosPendentes] = useState<File[]>([]);
    const [aEnviarMedia, setAEnviarMedia] = useState(false);
    const [lightbox, setLightbox] = useState<{ itens: ItemGaleria[]; indice: number } | null>(null);
    const [menuAnexo, setMenuAnexo] = useState(false);
    const [destacada, setDestacada] = useState<string | null>(null);
    const [eliminarDe, setEliminarDe] = useState<Mensagem | null>(null);
    const [relatorioDe, setRelatorioDe] = useState<Mensagem | null>(null);
    const [pesquisaAberta, setPesquisaAberta] = useState(false);
    const [pesquisaQ, setPesquisaQ] = useState('');
    const [resultados, setResultados] = useState<Mensagem[]>([]);
    const [resultadoIdx, setResultadoIdx] = useState(0);
    const aCarregarAntigas = useRef(false);
    const semMaisAntigas = useRef(false);
    const [aCarregarIniciais, setACarregarIniciais] = useState(true);
    const [menuConversa, setMenuConversa] = useState(false);
    const [infoAberta, setInfoAberta] = useState(false);
    const [confirmarEliminarConversa, setConfirmarEliminarConversa] = useState(false);

    const fim = useRef<HTMLDivElement>(null);
    const lista = useRef<HTMLDivElement>(null);
    const [noFundo, setNoFundo] = useState(true);
    const [novas, setNovas] = useState(0);
    const [focada, setFocada] = useState(() => (typeof document === 'undefined' ? true : document.hasFocus()));
    const anteriorUltimaId = useRef<string | null>(null);
    const ficheiro = useRef<HTMLInputElement>(null);
    const fotoInput = useRef<HTMLInputElement>(null);
    const ultimoTyping = useRef(0);
    const refsBolhas = useRef(new Map<string, HTMLDivElement>());

    useEffect(() => registarVisivel(conversaId), [registarVisivel, conversaId]);

    useFecharFora(menuConversa, 'menu-cabecalho', () => setMenuConversa(false));
    useFecharFora(menuAnexo, 'menu-anexo', () => setMenuAnexo(false));

    useEffect(() => {
        void engine.storage.obterConversa(conversaId).then(setConversa);
    }, [engine, conversaId, versao]);

    useEffect(() => {
        setContexto(null);
        anteriorUltimaId.current = null;
        setNovas(0);
        setNoFundo(true);
        setPesquisaAberta(false);
        setPesquisaQ('');
        setResultados([]);
        semMaisAntigas.current = false;
        setACarregarIniciais(true);

        let ativo = true;

        void engine
            .carregarMensagens(conversaId)
            .catch(() => undefined)
            .finally(() => {
                if (ativo) setACarregarIniciais(false);
            });
        void api.obterContexto(conversaId).then((r) => setContexto(r.contexto ?? null)).catch(() => undefined);
        void engine.entrarConversa(conversaId);

        return () => {
            ativo = false;
        };
    }, [engine, api, socket, conversaId]);

    // foco da página (só marcamos lida com a janela ativa)
    useEffect(() => {
        const aoFoco = () => setFocada(true);
        const aoBlur = () => setFocada(false);
        const aoVisibilidade = () => setFocada(document.visibilityState === 'visible' && document.hasFocus());

        window.addEventListener('focus', aoFoco);
        window.addEventListener('blur', aoBlur);
        document.addEventListener('visibilitychange', aoVisibilidade);

        return () => {
            window.removeEventListener('focus', aoFoco);
            window.removeEventListener('blur', aoBlur);
            document.removeEventListener('visibilitychange', aoVisibilidade);
        };
    }, []);

    const scrollParaFundo = (suave = true) => {
        // após o layout do render atual (a mensagem nova já medida)
        requestAnimationFrame(() => {
            const el = lista.current;

            if (!el) return;

            el.scrollTo({ top: el.scrollHeight, behavior: suave ? 'smooth' : 'auto' });

            // correção final: as bolinhas de typing saem noutro render e as imagens
            // medem tarde — se ficámos perto do fundo, encosta de vez
            setTimeout(() => {
                const alvo = lista.current;

                if (alvo && alvo.scrollHeight - alvo.scrollTop - alvo.clientHeight < 200) {
                    alvo.scrollTop = alvo.scrollHeight;
                }
            }, 280);
        });
    };

    const aoScroll = () => {
        const el = lista.current;

        if (!el) return;

        const fundo = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        setNoFundo(fundo);

        if (fundo) setNovas(0);

        // paginação para trás: perto do topo, carrega mais 50 preservando a posição
        if (el.scrollTop < 60 && !aCarregarAntigas.current && !semMaisAntigas.current && mensagens.length >= 50) {
            aCarregarAntigas.current = true;

            const alturaAntes = el.scrollHeight;

            void engine
                .carregarMensagens(conversaId, mensagens[0]?.id)
                .then((carregadas) => {
                    if (!carregadas) semMaisAntigas.current = true;

                    requestAnimationFrame(() => {
                        const alvo = lista.current;

                        if (alvo) alvo.scrollTop += alvo.scrollHeight - alturaAntes;
                    });
                })
                .catch(() => undefined)
                .finally(() => {
                    aCarregarAntigas.current = false;
                });
        }
    };

    // chegada de mensagens: scroll/lida só com foco + fundo; recuado conta as novas
    useEffect(() => {
        const ultima = mensagens.at(-1);

        if (!ultima) return;

        const primeiraCarga = anteriorUltimaId.current === null;
        const haNova = ultima.id !== anteriorUltimaId.current;
        anteriorUltimaId.current = ultima.id;

        if (!haNova) return;

        const minha = ultima.remetente_identidade_id === eu?.identidade_id || ultima.estado_envio === 'a_enviar';

        // o scroll segue sempre que estás no fundo; o FOCO só decide o marcar-como-lida
        if (primeiraCarga || minha || noFundo) {
            scrollParaFundo(!primeiraCarga);

            if (focada && (noFundo || primeiraCarga)) void engine.marcarLidas(conversaId);
        } else {
            setNovas((n) => n + 1);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mensagens, conversaId]);

    // ganhar foco ou voltar ao fundo com a conversa aberta → marca lida
    useEffect(() => {
        if (focada && noFundo && mensagens.length) {
            void engine.marcarLidas(conversaId);
            setNovas(0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [focada, noFundo]);

    // typing só arrasta o scroll se já estiver no fundo
    useEffect(() => {
        if (typing?.ativo && noFundo) fim.current?.scrollIntoView({ behavior: 'smooth' });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [typing?.ativo]);

    // fechada pelo serviço (ex.: sem encomendas ativas) — histórico visível, envio bloqueado
    const fechada = conversa?.estado === 'fechada';

    const eu = useMemo(
        () => conversa?.participantes.find((p) => p.id_externo === identidade.id && p.tipo === identidade.tipo) ?? null,
        [conversa, identidade],
    );
    const outros = (conversa?.participantes ?? []).filter((p) => p.identidade_id !== eu?.identidade_id && !p.saiu_em && p.tipo !== 'sistema');
    const grupoHeader = conversa?.tipo === 'grupo';
    const contraparte = conversa?.tipo === 'privada' ? outros[0] : null;
    const presenca = usePresenca(contraparte?.identidade_id ?? null);
    // recomputa com `versao` (presença bumpa notificar) — online no header do grupo
    const membrosOnline = grupoHeader ? outros.filter((p) => engine.presencaDe(p.identidade_id)?.online).length : 0;
    // nunca mostrar o "a escrever" da própria identidade (ex.: mesma conta em duas abas)
    const typingOutro = typing && typing.identidade_id !== eu?.identidade_id ? typing : null;
    const nomeTyping = typingOutro
        ? (conversa?.participantes.find((p) => p.identidade_id === typingOutro.identidade_id)?.nome ?? null)
        : null;

    const aoEnviar = async () => {
        const conteudo = texto.trim();

        if (!conteudo) return;

        setTexto('');

        if (editar) {
            const alvo = editar;
            setEditar(null);
            await engine.editarMensagem(alvo.id, conteudo).catch(() => undefined);

            return;
        }

        const resposta = responderA;
        setResponderA(null);
        tocarSom('enviada');
        void enviar({ conversa_id: conversaId, conteudo, resposta_a_id: resposta?.id });
    };

    /** Upload + envio via engine: aparece já no chat com preview local. */
    const enviarFicheiro = async (f: File, legenda?: string, forcarTipo?: 'ficheiro', duracaoSegundos?: number) => {
        setAEnviarMedia(true);

        try {
            const tipo = forcarTipo ?? (f.type.startsWith('image/') ? 'foto' : f.type.startsWith('video/') ? 'video' : f.type.startsWith('audio/') ? 'audio' : 'ficheiro');
            const criado = await api.criarMedia({ tipo, mime: f.type, nome_ficheiro: f.name });
            await api.carregarMedia(criado.upload, f, f.type);
            // duração medida na gravação — o webm do MediaRecorder não traz
            // duração no container (duration=Infinity), só nós a sabemos
            await api.confirmarMedia(criado.anexo_id, duracaoSegundos ? { duracao_segundos: duracaoSegundos } : undefined);

            const preview: Anexo = {
                id: criado.anexo_id,
                tipo: tipo as Anexo['tipo'],
                nome_ficheiro: f.name,
                mime: f.type,
                tamanho_bytes: f.size,
                largura: null,
                altura: null,
                duracao_segundos: duracaoSegundos ?? null,
                blurhash: null,
                estado: 'pronto',
                url: URL.createObjectURL(f),
            };

            await enviar(
                { conversa_id: conversaId, tipo: tipo as never, conteudo: legenda, anexo_ids: [criado.anexo_id] },
                [preview],
            );
        } finally {
            setAEnviarMedia(false);
        }
    };

    /** Lobby multi-fotos: uploads em paralelo → UMA mensagem com todos os anexos. */
    const enviarFotos = async (ficheiros: File[], legenda?: string) => {
        setAEnviarMedia(true);

        try {
            const resultados = await Promise.all(
                ficheiros.map(async (f) => {
                    const criado = await api.criarMedia({ tipo: 'foto', mime: f.type, nome_ficheiro: f.name });
                    await api.carregarMedia(criado.upload, f, f.type);
                    await api.confirmarMedia(criado.anexo_id);

                    const preview: Anexo = {
                        id: criado.anexo_id,
                        tipo: 'foto',
                        nome_ficheiro: f.name,
                        mime: f.type,
                        tamanho_bytes: f.size,
                        largura: null,
                        altura: null,
                        duracao_segundos: null,
                        blurhash: null,
                        estado: 'pronto',
                        url: URL.createObjectURL(f),
                    };

                    return { anexo_id: criado.anexo_id, preview };
                }),
            );

            await enviar(
                { conversa_id: conversaId, tipo: 'foto', conteudo: legenda, anexo_ids: resultados.map((r) => r.anexo_id) },
                resultados.map((r) => r.preview),
            );
        } finally {
            setAEnviarMedia(false);
        }
    };

    const abrirGaleria = (url: string) => {
        const itens: ItemGaleria[] = mensagens.flatMap((m) =>
            m.anexos
                .filter((a) => a.tipo === 'foto' && a.url)
                .map((a) => ({ url: a.url as string, nome: a.nome_ficheiro ?? 'foto.jpg', mensagem: m })),
        );
        const indice = Math.max(0, itens.findIndex((i) => i.url === url));
        setLightbox({ itens, indice });
    };

    const executarPesquisa = async () => {
        const q = pesquisaQ.trim();

        if (!q) return;

        const r = await api.pesquisarMensagens(conversaId, q).catch(() => ({ mensagens: [] as Mensagem[] }));
        setResultados(r.mensagens);
        setResultadoIdx(0);

        if (r.mensagens[0]) void irParaMensagem(r.mensagens[0].id);
    };

    const navegarResultado = (direcao: 1 | -1) => {
        if (!resultados.length) return;

        const idx = (resultadoIdx + direcao + resultados.length) % resultados.length;
        setResultadoIdx(idx);
        void irParaMensagem(resultados[idx].id);
    };

    /** Scroll até à mensagem citada, com destaque. */
    const irParaMensagem = async (mensagemId: string) => {
        for (let tentativa = 0; tentativa < 12; tentativa++) {
            const el = refsBolhas.current.get(mensagemId);

            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setDestacada(mensagemId);
                setTimeout(() => setDestacada(null), 1600);

                return;
            }

            const maisAntiga = mensagens[0];
            const carregadas = await engine.carregarMensagens(conversaId, maisAntiga?.id).catch(() => 0);

            if (!carregadas) return;
        }
    };

    return (
        <div className="relative flex h-full min-w-0 flex-col bg-[var(--maka-fundo)] text-[var(--maka-texto)]">
            {/* header */}
            <div className={`z-[1] flex items-center gap-3 border-0 border-b border-solid border-black/[.06] bg-[var(--maka-superficie)] ${compacto ? 'px-3 py-2' : 'px-4 py-2.5'}`}>
                <span className="relative cursor-pointer" onClick={() => setInfoAberta(true)}>
                    <AvatarWeb nome={conversa?.titulo ?? '?'} url={conversa?.foto_url} tamanho={compacto ? 34 : 42} grupo={conversa?.tipo === 'grupo'} />
                    {presenca?.online && (
                        <span className="absolute -bottom-0.5 -right-0.5 block h-3 w-3 rounded-full border-2 border-[var(--maka-superficie)] bg-emerald-500" />
                    )}
                </span>
                <span className="min-w-0 flex-1 cursor-pointer" onClick={() => setInfoAberta(true)}>
                    <span className={`block truncate font-bold ${compacto ? 'text-[13px]' : 'text-[15px]'}`}>
                        <NomeComBadge nome={conversa?.titulo ?? '…'} metadados={contraparte?.metadados} />
                    </span>
                    <span className={`block text-xs ${typingOutro ? 'italic text-[var(--maka-primaria)]' : (presenca?.online || membrosOnline > 0) ? 'text-emerald-600' : 'text-[var(--maka-texto-suave)]'}`}>
                        {typingOutro
                            ? 'a escrever…'
                            : grupoHeader
                              ? membrosOnline > 0
                                  ? `${membrosOnline} online`
                                  : `${outros.length + 1} membros`
                              : presenca?.online
                                ? 'online'
                                : ''}
                    </span>
                </span>
                {/* no dock (compacto) o header é único e estreito: pesquisa e chamadas vivem no menu ⋯ */}
                {!compacto && (
                    <BotaoIcone titulo="Pesquisar na conversa" onClick={() => { setPesquisaAberta(!pesquisaAberta); setResultados([]); setPesquisaQ(''); }}>
                        <Icon icon="tabler:search" />
                    </BotaoIcone>
                )}
                {!compacto && chamadas && podeAudioChamada && !fechada && <BotaoIcone titulo="Chamada de áudio" onClick={() => void chamadas.iniciar(conversaId, 'audio')}><Icon icon="tabler:phone" /></BotaoIcone>}
                {!compacto && chamadas && podeVideoChamada && !fechada && <BotaoIcone titulo="Chamada de vídeo" onClick={() => void chamadas.iniciar(conversaId, 'video')}><Icon icon="tabler:video" /></BotaoIcone>}
                <span className="relative" data-maka-pop="menu-cabecalho">
                    <BotaoIcone titulo="Opções da conversa" onClick={() => setMenuConversa(!menuConversa)}><Icon icon="tabler:dots-vertical" /></BotaoIcone>
                    {menuConversa && (
                        <div className="absolute right-0 top-10 z-[5] min-w-[190px] animate-maka-subir overflow-hidden rounded-xl bg-[var(--maka-superficie)] shadow-maka-pop ring-1 ring-black/[.05]">
                            {compacto && (
                                <ItemMenu onClick={() => { setMenuConversa(false); setPesquisaAberta(!pesquisaAberta); setResultados([]); setPesquisaQ(''); }}>
                                    <Icon icon="tabler:search" className="inline align-[-2px]" /> Pesquisar na conversa
                                </ItemMenu>
                            )}
                            {compacto && chamadas && podeAudioChamada && !fechada && (
                                <ItemMenu onClick={() => { setMenuConversa(false); void chamadas.iniciar(conversaId, 'audio'); }}>
                                    <Icon icon="tabler:phone" className="inline align-[-2px]" /> Chamada de áudio
                                </ItemMenu>
                            )}
                            {compacto && chamadas && podeVideoChamada && !fechada && (
                                <ItemMenu onClick={() => { setMenuConversa(false); void chamadas.iniciar(conversaId, 'video'); }}>
                                    <Icon icon="tabler:video" className="inline align-[-2px]" /> Chamada de vídeo
                                </ItemMenu>
                            )}
                            <ItemMenu onClick={() => { setMenuConversa(false); void engine.marcarNaoLida(conversaId).catch(() => undefined); aoFechar?.(); }}>
                                <Icon icon="tabler:mail-opened" className="inline align-[-2px]" /> Marcar como não lida
                            </ItemMenu>
                            {podeEliminarConversa && (
                                <ItemMenu onClick={() => { setMenuConversa(false); setConfirmarEliminarConversa(true); }}>
                                    <Icon icon="tabler:trash" className="inline align-[-2px]" /> Eliminar conversa
                                </ItemMenu>
                            )}
                        </div>
                    )}
                </span>
                {aoMinimizar && <BotaoIcone titulo="Minimizar" onClick={aoMinimizar}><Icon icon="tabler:minus" /></BotaoIcone>}
                {aoFechar && <BotaoIcone titulo="Fechar" onClick={aoFechar}><Icon icon="tabler:x" /></BotaoIcone>}
            </div>

            {pesquisaAberta && (
                <div className="flex items-center gap-2 border-0 border-b border-solid border-black/[.06] bg-[var(--maka-superficie)] px-3 py-2">
                    <Icon icon="tabler:search" className="shrink-0 text-[var(--maka-texto-suave)]" />
                    <input
                        autoFocus
                        className="min-w-0 flex-1 border-0 bg-transparent text-sm text-[var(--maka-texto)] outline-none placeholder:text-[var(--maka-texto-suave)]"
                        placeholder="Pesquisar nesta conversa…"
                        value={pesquisaQ}
                        onChange={(e) => setPesquisaQ(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') e.shiftKey ? navegarResultado(-1) : resultados.length ? navegarResultado(1) : void executarPesquisa();
                            if (e.key === 'Escape') setPesquisaAberta(false);
                        }}
                    />
                    {resultados.length > 0 && (
                        <span className="shrink-0 text-xs text-[var(--maka-texto-suave)]">{resultadoIdx + 1}/{resultados.length}</span>
                    )}
                    <BotaoIcone titulo="Anterior" onClick={() => navegarResultado(-1)}><Icon icon="tabler:chevron-up" /></BotaoIcone>
                    <BotaoIcone titulo="Seguinte" onClick={() => navegarResultado(1)}><Icon icon="tabler:chevron-down" /></BotaoIcone>
                    <BotaoIcone titulo="Fechar" onClick={() => setPesquisaAberta(false)}><Icon icon="tabler:x" /></BotaoIcone>
                </div>
            )}
            {/* banner "entrar" só em GRUPOS — numa privada ou toca-te ou já estás nela */}
            {conversa?.chamada_ativa && conversa.tipo === 'grupo' && chamadas && chamadas.ativa?.chamada.id !== conversa.chamada_ativa.id && (
                <div className="flex items-center gap-2.5 border-0 border-b border-solid border-black/[.06] bg-emerald-50 px-4 py-2">
                    <span className="grid h-8 w-8 animate-maka-pulsar place-items-center rounded-full bg-emerald-500 text-white">
                        <Icon icon={conversa.chamada_ativa.tipo === 'video' ? 'tabler:video' : 'tabler:phone'} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-emerald-800">
                        Chamada de {conversa.chamada_ativa.tipo === 'video' ? 'vídeo' : 'voz'} a decorrer
                    </span>
                    <button
                        onClick={() => void chamadas.entrar(conversa.chamada_ativa!.id, conversa.chamada_ativa!.tipo)}
                        className="cursor-pointer rounded-full border-0 bg-emerald-500 px-4 py-1.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105"
                    >
                        Entrar
                    </button>
                </div>
            )}
            {contexto && (
                <div className="border-0 border-b border-solid border-black/[.06] bg-[var(--maka-superficie)] px-4 py-2 text-[13px]">
                    <span className="font-bold">{contexto.titulo}</span>
                    {contexto.subtitulo && <span className="text-[var(--maka-texto-suave)]"> — {contexto.subtitulo}</span>}
                    {contexto.linhas?.map((l, i) => (
                        <div key={i} className="text-[var(--maka-texto-suave)]">{l}</div>
                    ))}
                </div>
            )}

            {/* mensagens */}
            <div className="relative min-h-0 flex-1">
            <div ref={lista} onScroll={aoScroll} className={`maka-scroll flex h-full flex-col gap-1 overflow-y-auto overflow-x-hidden ${compacto ? 'p-2.5' : 'p-4'}`}>
                {aCarregarIniciais && mensagens.length === 0 && (
                    <div className="grid flex-1 place-items-center text-[var(--maka-texto-suave)]">
                        <Icon icon="tabler:loader-2" className="animate-spin text-2xl text-[var(--maka-primaria)]" />
                    </div>
                )}
                {mensagens.map((m, i) => {
                    const anterior = mensagens[i - 1];
                    const seguinte = mensagens[i + 1];
                    const mesmaAnterior = anterior && anterior.tipo !== 'sistema' && anterior.remetente_identidade_id === m.remetente_identidade_id;
                    const mesmaSeguinte = seguinte && seguinte.tipo !== 'sistema' && seguinte.remetente_identidade_id === m.remetente_identidade_id;
                    const autor = conversa?.participantes.find((p) => p.identidade_id === m.remetente_identidade_id);

                    return (
                    <Bolha
                        key={m.id}
                        compacto={compacto}
                        primeiraDoBloco={!mesmaAnterior}
                        ultimaDoBloco={!mesmaSeguinte}
                        autor={autor ?? null}
                        registarRef={(el) => {
                            if (el) refsBolhas.current.set(m.id, el);
                            else refsBolhas.current.delete(m.id);
                        }}
                        mensagem={m}
                        minha={m.remetente_identidade_id === eu?.identidade_id || m.estado_envio === 'a_enviar'}
                        grupo={conversa?.tipo === 'grupo'}
                        participantes={conversa?.participantes ?? []}
                        outros={outros}
                        destacada={destacada === m.id}
                        podeReagir={podeReagir}
                        aoAbrirFoto={abrirGaleria}
                        aoClicarCitacao={(id) => void irParaMensagem(id)}
                        aoVerReacoes={() => setReacoesDe(m)}
                        acoes={{
                            reagir: podeReagir ? (emoji) => void engine.alternarReacao(conversaId, m.id, emoji) : undefined,
                            responder: () => { setEditar(null); setResponderA(m); },
                            editar: m.remetente_identidade_id === eu?.identidade_id && m.tipo === 'texto' && !m.eliminada
                                ? () => { setResponderA(null); setEditar(m); setTexto(m.conteudo ?? ''); }
                                : undefined,
                            eliminar: !m.eliminada ? () => setEliminarDe(m) : undefined,
                            encaminhar: podeEncaminhar ? () => setEncaminhar(m) : undefined,
                            // relatório de entrega: só nas MINHAS mensagens de grupo
                            relatorio:
                                conversa?.tipo === 'grupo' &&
                                m.remetente_identidade_id === eu?.identidade_id &&
                                !m.eliminada &&
                                m.estado_envio !== 'a_enviar' &&
                                m.estado_envio !== 'falhou'
                                    ? () => setRelatorioDe(m)
                                    : undefined,
                        }}
                        todas={mensagens}
                    />
                    );
                })}
                {typingOutro && (
                    <div className="flex justify-start pt-1">
                        <span className="mr-1.5 w-7 shrink-0" />
                        <div className="flex items-center gap-2 rounded-[var(--maka-raio)] rounded-bl-md bg-[var(--maka-bolha-outro)] px-3.5 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,.04),0_4px_14px_-4px_rgba(15,23,42,.08)]">
                            {conversa?.tipo === 'grupo' && nomeTyping && (
                                <span className="text-xs font-bold text-[var(--maka-primaria)]">{nomeTyping}</span>
                            )}
                            <span className="flex items-end gap-1">
                                <span className="h-2 w-2 animate-maka-salto rounded-full bg-[var(--maka-texto-suave)]" />
                                <span className="h-2 w-2 animate-maka-salto rounded-full bg-[var(--maka-texto-suave)] [animation-delay:.15s]" />
                                <span className="h-2 w-2 animate-maka-salto rounded-full bg-[var(--maka-texto-suave)] [animation-delay:.3s]" />
                            </span>
                        </div>
                    </div>
                )}
                <div ref={fim} />
            </div>

            {!noFundo && (
                <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[4] flex justify-center">
                    <button
                        onClick={() => { scrollParaFundo(); setNovas(0); }}
                        className={`pointer-events-auto flex animate-maka-flutuar cursor-pointer items-center gap-1.5 rounded-full border-0 shadow-lg transition-all duration-200 ease-out hover:scale-105 ${
                            novas > 0
                                ? 'bg-[var(--maka-primaria)] px-3.5 py-2 text-[13px] font-bold text-[var(--maka-primaria-contraste)]'
                                : 'grid h-10 w-10 place-items-center bg-[var(--maka-superficie)] text-lg text-[var(--maka-texto)] ring-1 ring-black/[.05]'
                        }`}
                    >
                        {novas > 0 ? `${novas} ${novas === 1 ? 'mensagem nova' : 'mensagens novas'}` : <Icon icon="tabler:chevron-down" />}
                        {novas > 0 && <Icon icon="tabler:chevron-down" />}
                    </button>
                </div>
            )}
            </div>

            {/* conversa fechada pelo serviço: aviso no lugar do input */}
            {fechada && (
                <div className="flex items-center justify-center gap-2 border-0 border-t border-solid border-black/[.06] bg-[var(--maka-superficie)] px-4 py-3 text-center text-[13px] text-[var(--maka-texto-suave)]">
                    <Icon icon="tabler:lock" className="shrink-0 text-base" />
                    <span>
                        <span className="font-semibold text-[var(--maka-texto)]">Esta conversa está fechada.</span>
                        {conversa?.fecho_motivo ? ` ${conversa.fecho_motivo}` : ''}
                    </span>
                </div>
            )}

            {/* barra de resposta/edição */}
            {!fechada && (responderA || editar) && (
                <div className="flex items-center gap-2 border-t-2 border-[var(--maka-primaria)] bg-[var(--maka-superficie)] px-3 py-1.5 text-[13px]">
                    <span className="font-bold text-[var(--maka-primaria)]">{editar ? 'Editar' : 'Responder'}</span>
                    <span className="min-w-0 flex-1 truncate text-[var(--maka-texto-suave)]">{(editar ?? responderA)?.conteudo ?? '📎 anexo'}</span>
                    <BotaoIcone titulo="Cancelar" onClick={() => { setResponderA(null); setEditar(null); setTexto(''); }}><Icon icon="tabler:x" /></BotaoIcone>
                </div>
            )}

            {/* input com gravação de áudio */}
            {!fechada && (
            <div data-maka-pop="menu-anexo">
            <BarraInput
                compacto={compacto}
                texto={texto}
                setTexto={(valor) => {
                    setTexto(valor);

                    const agora = Date.now();

                    if (agora - ultimoTyping.current > 3000) {
                        ultimoTyping.current = agora;
                        socket.typing(conversaId, true);
                    }
                }}
                placeholder={editar ? 'Editar mensagem…' : 'Escreve uma mensagem…'}
                aoEnviar={() => void aoEnviar()}
                podeMedia={podeMedia}
                podeGravar={podeAudioMedia}
                aEnviarMedia={aEnviarMedia}
                aoAnexar={() => setMenuAnexo(!menuAnexo)}
                aoGravarAudio={(blob, duracao) => void enviarFicheiro(new File([blob], 'voz.webm', { type: blob.type || 'audio/webm' }), undefined, undefined, duracao)}
            />
            {menuAnexo && (
                <div data-maka-pop="menu-anexo" className="absolute bottom-16 left-3 z-[6] min-w-[190px] animate-maka-subir overflow-hidden rounded-xl bg-[var(--maka-superficie)] shadow-maka-pop ring-1 ring-black/[.05]">
                    <ItemMenu onClick={() => { setMenuAnexo(false); fotoInput.current?.click(); }}>
                        <Icon icon="tabler:photo" className="inline align-[-2px] text-[var(--maka-primaria)]" /> Fotos e vídeos
                    </ItemMenu>
                    <ItemMenu onClick={() => { setMenuAnexo(false); ficheiro.current?.click(); }}>
                        <Icon icon="tabler:file" className="inline align-[-2px] text-[var(--maka-primaria)]" /> Ficheiro
                    </ItemMenu>
                </div>
            )}
            </div>
            )}
            <input
                ref={fotoInput}
                type="file"
                accept="image/*,video/*"
                multiple
                hidden
                onChange={(e) => {
                    const escolhidos = Array.from(e.target.files ?? []);
                    const imagens = escolhidos.filter((f) => f.type.startsWith('image/'));
                    const videos = escolhidos.filter((f) => !f.type.startsWith('image/'));

                    if (imagens.length) setFotosPendentes((atuais) => [...atuais, ...imagens].slice(0, 10));

                    for (const v of videos) void enviarFicheiro(v);

                    e.target.value = '';
                }}
            />
            <input
                ref={ficheiro}
                type="file"
                hidden
                onChange={(e) => {
                    const f = e.target.files?.[0];

                    if (f) void enviarFicheiro(f, undefined, 'ficheiro');

                    e.target.value = '';
                }}
            />

            {/* modais */}
            {encaminhar && (
                <EscolherConversas
                    titulo="Encaminhar para…"
                    aoFechar={() => setEncaminhar(null)}
                    aoConfirmar={(ids) => {
                        for (const id of ids) {
                            void socket.enviarMensagem({
                                conversa_id: id,
                                ref_cliente: crypto.randomUUID(),
                                tipo: encaminhar.tipo as never,
                                conteudo: encaminhar.conteudo ?? undefined,
                                encaminhada_de_id: encaminhar.id,
                            });
                        }

                        setEncaminhar(null);
                    }}
                />
            )}
            {fotosPendentes.length > 0 && (
                <PreviewFotos
                    ficheiros={fotosPendentes}
                    aoRemover={(indice) => setFotosPendentes((atuais) => atuais.filter((_, i) => i !== indice))}
                    aoAdicionarMais={() => fotoInput.current?.click()}
                    aoFechar={() => setFotosPendentes([])}
                    aoEnviar={(legenda) => {
                        const lista = fotosPendentes;
                        setFotosPendentes([]);
                        void enviarFotos(lista, legenda || undefined);
                    }}
                />
            )}
            {lightbox && (
                <Galeria
                    itens={lightbox.itens}
                    indiceInicial={lightbox.indice}
                    aoFechar={() => setLightbox(null)}
                    aoResponder={(m) => { setLightbox(null); setEditar(null); setResponderA(m); }}
                    aoEncaminhar={podeEncaminhar ? (m) => { setLightbox(null); setEncaminhar(m); } : undefined}
                    aoEliminar={(m) => { setLightbox(null); setEliminarDe(m); }}
                />
            )}
            {eliminarDe && (
                <ConfirmarDialogo
                    titulo="Eliminar mensagem?"
                    aoFechar={() => setEliminarDe(null)}
                    botoes={[
                        ...(eliminarDe.remetente_identidade_id === eu?.identidade_id
                            ? [{
                                  rotulo: 'Eliminar para todos',
                                  destrutivo: true,
                                  acao: () => void engine.eliminarMensagem(conversaId, eliminarDe.id, true),
                              }]
                            : []),
                        {
                            rotulo: 'Eliminar para mim',
                            destrutivo: true,
                            acao: () => void engine.eliminarMensagem(conversaId, eliminarDe.id, false),
                        },
                    ]}
                />
            )}
            {relatorioDe && (
                <RelatorioEntregaWeb conversaId={conversaId} mensagem={relatorioDe} aoFechar={() => setRelatorioDe(null)} />
            )}
            {confirmarEliminarConversa && (
                <ConfirmarDialogo
                    titulo="Eliminar conversa?"
                    descricao="O histórico desaparece para ti. A outra pessoa mantém a conversa dela."
                    aoFechar={() => setConfirmarEliminarConversa(false)}
                    botoes={[{
                        rotulo: 'Eliminar conversa',
                        destrutivo: true,
                        acao: () => {
                            void engine.eliminarConversa(conversaId);
                            aoFechar?.();
                        },
                    }]}
                />
            )}
            {infoAberta && conversa && eu && (
                <InfoConversa
                    conversa={conversa}
                    eu={eu}
                    aoFechar={() => setInfoAberta(false)}
                    aoAbrirOutraConversa={aoAbrirOutraConversa}
                    aoSaiu={() => { setInfoAberta(false); aoFechar?.(); }}
                />
            )}
            {reacoesDe && conversa && (
                <ModalReacoes
                    mensagem={mensagens.find((m) => m.id === reacoesDe.id) ?? reacoesDe}
                    conversa={conversa}
                    euId={eu?.identidade_id ?? null}
                    aoFechar={() => setReacoesDe(null)}
                    aoRemoverMinha={(emoji) => void engine.alternarReacao(conversaId, reacoesDe.id, emoji)}
                    aoMensagem={
                        conversa.tipo === 'grupo' && aoAbrirOutraConversa && podeCriarConversa
                            ? async (p) => {
                                  const { conversa: nova } = await api.criarPrivada({ id_externo: p.id_externo, tipo: p.tipo, nome: p.nome });
                                  await engine.atualizarConversas();
                                  setReacoesDe(null);
                                  aoAbrirOutraConversa(nova.id);
                              }
                            : undefined
                    }
                />
            )}
        </div>
    );
}

/** Compat: nome antigo. */
export function MakaChatConversa({ conversaId }: { conversaId: string }) {
    return <ConversaPainel conversaId={conversaId} />;
}

// ---------------------------------------------------------------- barra de input (texto + gravação de áudio)

function BarraInput({ compacto, texto, setTexto, placeholder, aoEnviar, podeMedia, podeGravar, aEnviarMedia, aoAnexar, aoGravarAudio }: {
    compacto: boolean; texto: string; setTexto(v: string): void; placeholder: string; aoEnviar(): void;
    podeMedia: boolean; podeGravar: boolean; aEnviarMedia: boolean; aoAnexar(): void; aoGravarAudio(blob: Blob, duracaoSegundos: number): void;
}) {
    const [aGravar, setAGravar] = useState(false);
    const [segundos, setSegundos] = useState(0);
    const gravador = useRef<MediaRecorder | null>(null);
    const pedacos = useRef<Blob[]>([]);
    const cancelado = useRef(false);
    const timer = useRef<ReturnType<typeof setInterval> | null>(null);
    // duração medida por timestamp (o estado `segundos` estaria stale no onstop)
    const inicioGravacao = useRef(0);

    const pararTimer = () => {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
    };

    const comecarGravacao = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const rec = new MediaRecorder(
                stream,
                MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? { mimeType: 'audio/webm;codecs=opus' } : undefined,
            );

            pedacos.current = [];
            cancelado.current = false;
            rec.ondataavailable = (e) => e.data.size && pedacos.current.push(e.data);
            rec.onstop = () => {
                stream.getTracks().forEach((t) => t.stop());

                if (!cancelado.current && pedacos.current.length) {
                    const duracao = Math.max(1, Math.round((Date.now() - inicioGravacao.current) / 1000));
                    aoGravarAudio(new Blob(pedacos.current, { type: rec.mimeType || 'audio/webm' }), duracao);
                }
            };
            rec.start();
            gravador.current = rec;
            inicioGravacao.current = Date.now();
            setSegundos(0);
            setAGravar(true);
            timer.current = setInterval(() => setSegundos((s) => s + 1), 1000);
        } catch {
            window.alert('Sem acesso ao microfone.');
        }
    };

    const terminar = (cancelar: boolean) => {
        cancelado.current = cancelar;
        gravador.current?.stop();
        gravador.current = null;
        pararTimer();
        setAGravar(false);
    };

    if (aGravar) {
        return (
            <div className={`flex items-center gap-3 border-0 border-t border-solid border-black/[.06] bg-[var(--maka-superficie)] ${compacto ? 'p-2' : 'p-3'}`}>
                <span className="h-3 w-3 animate-maka-pulsar rounded-full bg-red-500" />
                <span className="font-mono text-sm text-[var(--maka-texto)]">
                    {String(Math.floor(segundos / 60)).padStart(2, '0')}:{String(segundos % 60).padStart(2, '0')}
                </span>
                <span className="flex-1 text-xs text-[var(--maka-texto-suave)]">a gravar…</span>
                <BotaoIcone titulo="Cancelar" onClick={() => terminar(true)}><Icon icon="tabler:trash" className="text-red-500" /></BotaoIcone>
                <button
                    onClick={() => terminar(false)}
                    className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-[var(--maka-primaria)] text-[var(--maka-primaria-contraste)] shadow-md transition-transform hover:scale-105"
                >
                    <Icon icon="tabler:send-2" className="text-lg" />
                </button>
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-2 border-0 border-t border-solid border-black/[.06] bg-[var(--maka-superficie)] ${compacto ? 'p-2' : 'p-3'}`}>
            {podeMedia && (
                <BotaoIcone titulo="Anexar" onClick={aoAnexar}>
                    {aEnviarMedia ? <Icon icon="tabler:loader-2" className="animate-spin" /> : <Icon icon="tabler:paperclip" />}
                </BotaoIcone>
            )}
            <textarea
                rows={1}
                className="maka-scroll min-w-0 flex-1 resize-none rounded-2xl border border-solid border-slate-300/60 bg-[var(--maka-fundo)] px-4 py-2.5 text-sm leading-5 text-[var(--maka-texto)] outline-none transition-shadow placeholder:text-[var(--maka-texto-suave)] focus:ring-2 focus:ring-[var(--maka-primaria)]"
                style={{ maxHeight: 132 }}
                value={texto}
                placeholder={placeholder}
                onChange={(e) => {
                    setTexto(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 132)}px`;
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        aoEnviar();
                        (e.target as HTMLTextAreaElement).style.height = 'auto';
                    }
                }}
            />
            {texto.trim() === '' && podeGravar ? (
                <button
                    onClick={() => void comecarGravacao()}
                    title="Gravar áudio"
                    className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-[var(--maka-primaria)] text-[var(--maka-primaria-contraste)] shadow-md transition-transform hover:scale-105 active:scale-95"
                >
                    <Icon icon="tabler:microphone" className="text-lg" />
                </button>
            ) : (
                <button
                    onClick={aoEnviar}
                    className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-[var(--maka-primaria)] text-[var(--maka-primaria-contraste)] shadow-md transition-transform hover:scale-105 active:scale-95"
                >
                    <Icon icon="tabler:send-2" className="text-lg" />
                </button>
            )}
        </div>
    );
}

// ---------------------------------------------------------------- bolha

interface AcoesBolha {
    reagir?: (emoji: string) => void;
    responder(): void;
    editar?: () => void;
    eliminar?: () => void;
    encaminhar?: () => void;
    relatorio?: () => void;
}

function Bolha({ mensagem: m, minha, grupo, participantes, outros, acoes, todas, destacada, registarRef, aoAbrirFoto, aoClicarCitacao, aoVerReacoes, podeReagir, primeiraDoBloco = true, ultimaDoBloco = true, autor = null, compacto = false }: {
    mensagem: Mensagem; minha: boolean; grupo?: boolean;
    participantes: ParticipanteConversa[]; outros: ParticipanteConversa[]; acoes: AcoesBolha; todas: Mensagem[];
    destacada: boolean; registarRef(el: HTMLDivElement | null): void;
    aoAbrirFoto(url: string): void; aoClicarCitacao(id: string): void; aoVerReacoes(): void; podeReagir: boolean;
    primeiraDoBloco?: boolean; ultimaDoBloco?: boolean; autor?: ParticipanteConversa | null; compacto?: boolean;
}) {
    const [hover, setHover] = useState(false);
    const [picker, setPicker] = useState(false);
    const [menu, setMenu] = useState(false);
    const [menuCima, setMenuCima] = useState(false);
    const [pickerBaixo, setPickerBaixo] = useState(false);

    useFecharFora(picker || menu, `bolha-${m.id}`, () => { setPicker(false); setMenu(false); });

    const { aoAbrirPartilha } = useMakaChat();
    const respondida = m.resposta_a_id ? todas.find((x) => x.id === m.resposta_a_id) : null;
    const grupos = agruparReacoes(m.reacoes);

    if (m.tipo === 'sistema') {
        return (
            <div ref={registarRef} className="my-1 self-center rounded-full bg-slate-500/10 px-3.5 py-1 text-xs text-[var(--maka-texto-suave)]">
                {m.conteudo}
            </div>
        );
    }

    if (m.tipo === 'chamada') {
        return (
            <div ref={registarRef} className="my-1 self-center">
                <CartaoRegistoChamada mensagem={m} />
            </div>
        );
    }

    const mostrarBarra = hover || picker || menu;

    const barra = mostrarBarra && !m.eliminada && (
        <div data-maka-pop={`bolha-${m.id}`} className={`absolute z-[2] flex items-center gap-0.5 rounded-full bg-[var(--maka-superficie)] px-1.5 py-1 shadow-md ring-1 ring-black/[.05] ${
            compacto
                ? `bottom-full ${minha ? 'right-1' : 'left-1'}` // dock: colada ao topo da bolha, sem tapar o conteúdo — ao lado não cabe
                : `top-1/2 -translate-y-1/2 ${minha ? 'right-[calc(100%+8px)]' : 'left-[calc(100%+8px)]'}`
        }`}>
            {podeReagir && (
                <button
                    className="grid h-7 w-7 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-base text-[var(--maka-texto-suave)] hover:bg-black/[.04] hover:text-[var(--maka-texto)]"
                    title="Reagir"
                    onClick={(e) => { setPickerBaixo(direcaoMenu(e, 70) === 'baixo' && (e.currentTarget as HTMLElement).getBoundingClientRect().top < 90); setPicker(!picker); setMenu(false); }}
                >
                    <Icon icon="tabler:mood-smile" />
                </button>
            )}
            <button className="grid h-7 w-7 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-base text-[var(--maka-texto-suave)] hover:bg-black/[.04] hover:text-[var(--maka-texto)]" title="Responder" onClick={acoes.responder}>
                <Icon icon="tabler:arrow-back-up" />
            </button>
            {(acoes.editar || acoes.eliminar || acoes.encaminhar) && (
                <button className="grid h-7 w-7 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-base text-[var(--maka-texto-suave)] hover:bg-black/[.04] hover:text-[var(--maka-texto)]" title="Mais opções" onClick={(e) => { setMenuCima(direcaoMenu(e, 170) === 'cima'); setMenu(!menu); setPicker(false); }}>
                    <Icon icon="tabler:dots" />
                </button>
            )}
        </div>
    );

    // ancorados à bolha e a abrir para o interior — nas boxes estreitas do dock
    // nunca saem do contentor (a lista corta overflow-x; para fora dava scroll x).
    // Verticalmente seguem a POSIÇÃO DA BARRA (topo no dock, centro no normal),
    // senão numa mensagem comprida o menu abria longe do botão.
    const posBaixo = compacto ? 'top-0' : 'top-1/2 mt-5';
    const posCima = compacto ? 'bottom-full mb-10' : 'bottom-1/2 mb-5';
    const popovers = !m.eliminada && (
        <>
            {picker && (
                <div data-maka-pop={`bolha-${m.id}`} className={`absolute ${pickerBaixo ? posBaixo : posCima} z-[3] flex animate-maka-subir items-center gap-1.5 rounded-full bg-[var(--maka-superficie)] px-3 py-1.5 shadow-maka-pop ring-1 ring-black/[.05] ${minha ? 'right-0' : 'left-0'}`}>
                    {EMOJIS.map((e) => (
                        <button
                            key={e}
                            className="cursor-pointer border-0 bg-transparent p-0 text-lg transition-transform hover:scale-125"
                            onClick={() => { acoes.reagir?.(e); setPicker(false); setHover(false); }}
                        >
                            {e}
                        </button>
                    ))}
                </div>
            )}
            {menu && (
                <div data-maka-pop={`bolha-${m.id}`} className={`absolute ${menuCima ? posCima : posBaixo} z-[3] min-w-[150px] overflow-hidden rounded-xl bg-[var(--maka-superficie)] shadow-maka-pop ring-1 ring-black/[.05] ${minha ? 'right-0' : 'left-0'}`}>
                    {acoes.encaminhar && <ItemMenu onClick={acoes.encaminhar}><Icon icon="tabler:share-3" className="inline align-[-2px]" /> Encaminhar</ItemMenu>}
                    {acoes.relatorio && <ItemMenu onClick={acoes.relatorio}><Icon icon="tabler:checks" className="inline align-[-2px]" /> Relatório de entrega</ItemMenu>}
                    {acoes.editar && <ItemMenu onClick={acoes.editar}><Icon icon="tabler:pencil" className="inline align-[-2px]" /> Editar</ItemMenu>}
                    {acoes.eliminar && <ItemMenu onClick={acoes.eliminar}><Icon icon="tabler:trash" className="inline align-[-2px]" /> Eliminar</ItemMenu>}
                </div>
            )}
        </>
    );

    return (
        <div
            ref={registarRef}
            className={`relative flex rounded-xl pt-1 ${destacada ? 'animate-maka-flash' : ''} ${grupos.length ? 'pb-3' : ''} ${minha ? 'justify-end' : 'justify-start'}`}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => {
                setHover(false);

                if (!picker) setMenu(false);
            }}
        >
            {!minha && (
                <span className="mr-1.5 w-7 shrink-0 self-end">
                    {ultimaDoBloco && <AvatarWeb nome={autor?.nome ?? '?'} url={autor?.foto_url} tamanho={28} />}
                </span>
            )}
            <div
                className={`relative flex max-w-[72%] flex-col gap-1 rounded-[var(--maka-raio)] px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,.04),0_4px_14px_-4px_rgba(15,23,42,.08)] transition-shadow ${
                    destacada ? 'ring-2 ring-[var(--maka-primaria)]' : ''
                } ${minha
                    ? `bg-[var(--maka-bolha-minha)] text-[var(--maka-bolha-minha-texto)] ${ultimaDoBloco ? 'rounded-br-md' : 'rounded-r-md'}`
                    : `bg-[var(--maka-bolha-outro)] text-[var(--maka-texto)] ${ultimaDoBloco ? 'rounded-bl-md' : 'rounded-l-md'}`}`}
            >
                {barra}
                {popovers}
                {grupo && !minha && primeiraDoBloco && (
                    <span className="text-xs font-bold text-[var(--maka-primaria)]">
                        <NomeComBadge nome={autor?.nome ?? '…'} metadados={autor?.metadados} />
                    </span>
                )}
                {m.resposta_a_id && (
                    <button
                        onClick={() => aoClicarCitacao(m.resposta_a_id as string)}
                        className={`cursor-pointer truncate rounded-md border-0 px-2 py-1 text-left text-xs text-inherit opacity-90 transition-opacity hover:opacity-100 ${minha ? 'bg-white/20' : 'bg-black/5'}`}
                    >
                        <Icon icon="tabler:arrow-back-up" className="mr-1 inline align-[-2px]" />
                        {respondida ? (respondida.conteudo ?? '📎 anexo') : 'Ver mensagem original'}
                    </button>
                )}
                {m.anexos.map((a) => <AnexoView key={a.id} anexo={a} aoAbrirFoto={aoAbrirFoto} />)}
                {!m.eliminada && (m.tipo === 'partilha' || m.tipo === 'link') && (
                    <CartaoPartilha mensagem={m} minha={minha} aoAbrir={aoAbrirPartilha} />
                )}
                {m.eliminada ? (
                    <em className="flex items-center gap-1 opacity-60"><Icon icon="tabler:ban" /> Mensagem eliminada</em>
                ) : (
                    m.conteudo && (
                        <span className="whitespace-pre-wrap text-sm leading-relaxed">
                            {dividirLinks(m.conteudo).map((p, i) =>
                                p.url ? (
                                    <a
                                        key={i}
                                        href={p.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-semibold underline"
                                        style={{ color: 'inherit' }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {p.texto}
                                    </a>
                                ) : (
                                    <span key={i}>{p.texto}</span>
                                ),
                            )}
                        </span>
                    )
                )}
                <span className="flex items-center gap-1 self-end text-[10px] opacity-60">
                    {m.encaminhada_de_id && <Icon icon="tabler:share-3" />}{m.editada_em ? 'editada · ' : ''}{horaCurtaWeb(m.criada_em)}
                    {minha && <TicksWeb mensagem={m} outros={outros} />}
                </span>
            </div>

            {/* chips de reações agrupadas — clicar abre a lista de quem reagiu */}
            {grupos.length > 0 && (
                <button
                    onClick={aoVerReacoes}
                    className={`absolute -bottom-1 z-[1] flex cursor-pointer items-center gap-1 rounded-full border-0 bg-[var(--maka-superficie)] px-2 py-px text-[12px] shadow-md ring-1 ring-black/[.05] transition-transform hover:scale-105 ${minha ? 'right-3' : 'left-10'}`}
                >
                    {grupos.map((g) => (
                        <span key={g.emoji}>
                            {g.emoji}
                            {g.contagem > 1 && <span className="ml-0.5 text-[10px] font-bold text-[var(--maka-texto-suave)]">{g.contagem}</span>}
                        </span>
                    ))}
                </button>
            )}

        </div>
    );
}

function agruparReacoes(reacoes: { identidade_id: string; emoji: string }[]) {
    const mapa = new Map<string, number>();

    for (const r of reacoes) {
        mapa.set(r.emoji, (mapa.get(r.emoji) ?? 0) + 1);
    }

    return [...mapa.entries()].map(([emoji, contagem]) => ({ emoji, contagem }));
}

// ---------------------------------------------------------------- modal de reações

function ModalReacoes({ mensagem, conversa, euId, aoFechar, aoRemoverMinha, aoMensagem }: {
    mensagem: Mensagem; conversa: Conversa; euId: string | null;
    aoFechar(): void; aoRemoverMinha(emoji: string): void; aoMensagem?(p: ParticipanteConversa): void | Promise<void>;
}) {
    return (
        <div className="fixed inset-0 z-[10000] grid place-items-center bg-slate-900/50 backdrop-blur-sm" onClick={aoFechar}>
            <div className="w-[340px] animate-maka-subir overflow-hidden rounded-2xl bg-[var(--maka-superficie)] shadow-maka-modal" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3">
                    <span className="font-bold text-[var(--maka-texto)]">Reações</span>
                    <BotaoIcone titulo="Fechar" onClick={aoFechar}><Icon icon="tabler:x" /></BotaoIcone>
                </div>
                <div className="maka-scroll max-h-[50vh] overflow-auto pb-2">
                    {mensagem.reacoes.length === 0 && (
                        <div className="px-4 pb-4 text-sm text-[var(--maka-texto-suave)]">Sem reações.</div>
                    )}
                    {mensagem.reacoes.map((r) => {
                        const p = conversa.participantes.find((x) => x.identidade_id === r.identidade_id);
                        const souEu = r.identidade_id === euId;

                        return (
                            <div key={r.identidade_id} className="flex items-center gap-3 px-4 py-2">
                                <AvatarWeb nome={p?.nome ?? '?'} url={p?.foto_url} tamanho={36} />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold text-[var(--maka-texto)]">
                                        {souEu ? 'Tu' : (p?.nome ?? 'Utilizador')}
                                    </span>
                                    {souEu && (
                                        <button
                                            onClick={() => { aoRemoverMinha(r.emoji); aoFechar(); }}
                                            className="cursor-pointer border-0 bg-transparent p-0 text-xs text-[var(--maka-texto-suave)] hover:text-red-500"
                                        >
                                            Toca para remover
                                        </button>
                                    )}
                                </span>
                                {!souEu && aoMensagem && p && (
                                    <BotaoIcone titulo={`Mensagem a ${p.nome}`} onClick={() => void aoMensagem(p)}>
                                        <Icon icon="tabler:message-circle" />
                                    </BotaoIcone>
                                )}
                                <span className="text-xl">{r.emoji}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------- lobby de fotos antes de enviar

function PreviewFotos({ ficheiros, aoRemover, aoAdicionarMais, aoFechar, aoEnviar }: {
    ficheiros: File[];
    aoRemover(indice: number): void;
    aoAdicionarMais(): void;
    aoFechar(): void;
    aoEnviar(legenda: string): void;
}) {
    const [legenda, setLegenda] = useState('');
    const urls = useMemo(() => ficheiros.map((f) => URL.createObjectURL(f)), [ficheiros]);

    useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

    return (
        <div className="fixed inset-0 z-[10001] grid place-items-center bg-slate-900/70 backdrop-blur-sm" onClick={aoFechar}>
            <div className="flex w-[460px] max-w-[94vw] animate-maka-subir flex-col overflow-hidden rounded-2xl bg-[var(--maka-superficie)] shadow-maka-modal" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3">
                    <span className="font-bold text-[var(--maka-texto)]">
                        Enviar {ficheiros.length === 1 ? 'foto' : `${ficheiros.length} fotos`}
                    </span>
                    <BotaoIcone titulo="Fechar" onClick={aoFechar}><Icon icon="tabler:x" /></BotaoIcone>
                </div>

                {/* destaque da primeira + grelha de miniaturas */}
                <img src={urls[0]} className="max-h-[42vh] w-full bg-black object-contain" alt="" />
                <div className="maka-scroll flex gap-2 overflow-x-auto px-3 py-2.5">
                    {urls.map((u, i) => (
                        <span key={i} className="relative shrink-0">
                            <img src={u} className="h-16 w-16 rounded-lg object-cover ring-1 ring-black/[.05]" alt="" />
                            <button
                                onClick={() => aoRemover(i)}
                                className="absolute -right-1.5 -top-1.5 grid h-5 w-5 cursor-pointer place-items-center rounded-full border-0 bg-slate-900 text-[10px] text-white shadow"
                                title="Remover"
                            >
                                <Icon icon="tabler:x" />
                            </button>
                        </span>
                    ))}
                    {ficheiros.length < 10 && (
                        <button
                            onClick={aoAdicionarMais}
                            className="grid h-16 w-16 shrink-0 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-slate-300 bg-transparent text-xl text-[var(--maka-texto-suave)] hover:border-[var(--maka-primaria)] hover:text-[var(--maka-primaria)]"
                            title="Adicionar mais"
                        >
                            <Icon icon="tabler:plus" />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2 p-3">
                    <input
                        autoFocus
                        className="min-w-0 flex-1 rounded-full border border-solid border-slate-300/60 bg-[var(--maka-fundo)] px-4 py-2.5 text-sm text-[var(--maka-texto)] outline-none focus:ring-2 focus:ring-[var(--maka-primaria)]"
                        placeholder="Legenda (opcional)"
                        value={legenda}
                        onChange={(e) => setLegenda(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && aoEnviar(legenda)}
                    />
                    <button
                        onClick={() => aoEnviar(legenda)}
                        className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-[var(--maka-primaria)] text-[var(--maka-primaria-contraste)] shadow-md transition-transform hover:scale-105"
                    >
                        <Icon icon="tabler:send-2" className="text-lg" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------- anexos / escolher conversas / helpers

function AnexoView({ anexo: a, aoAbrirFoto }: { anexo: Anexo; aoAbrirFoto(url: string): void }) {
    if (!a.url) return null;
    if (a.tipo === 'foto')
        return <img src={a.url} className="max-w-[240px] cursor-pointer rounded-xl transition-opacity hover:opacity-90" alt="" onClick={() => aoAbrirFoto(a.url as string)} />;
    if (a.tipo === 'video') return <video src={a.url} controls className="max-w-[260px] rounded-xl" />;
    if (a.tipo === 'audio') return <ReprodutorAudio url={a.url} duracaoSegundos={a.duracao_segundos} />;

    return <CartaoFicheiro anexo={a} />;
}

const ICONE_POR_EXTENSAO: Record<string, string> = {
    pdf: 'tabler:file-type-pdf',
    doc: 'tabler:file-type-doc', docx: 'tabler:file-type-doc',
    xls: 'tabler:file-type-xls', xlsx: 'tabler:file-type-xls', csv: 'tabler:file-type-xls',
    ppt: 'tabler:file-type-ppt', pptx: 'tabler:file-type-ppt',
    zip: 'tabler:file-zip', rar: 'tabler:file-zip', '7z': 'tabler:file-zip',
    mp3: 'tabler:file-music', wav: 'tabler:file-music', webm: 'tabler:file-music',
    jpg: 'tabler:photo', jpeg: 'tabler:photo', png: 'tabler:photo', gif: 'tabler:photo',
    txt: 'tabler:file-text',
};

function CartaoFicheiro({ anexo: a }: { anexo: Anexo }) {
    const nome = a.nome_ficheiro ?? 'Ficheiro';
    const extensao = (nome.includes('.') ? nome.split('.').pop() ?? '' : '').toLowerCase();
    const icone = ICONE_POR_EXTENSAO[extensao] ?? 'tabler:file';
    const tamanho = a.tamanho_bytes
        ? a.tamanho_bytes >= 1024 * 1024
            ? `${(a.tamanho_bytes / (1024 * 1024)).toFixed(1)} MB`
            : `${Math.max(1, Math.round(a.tamanho_bytes / 1024))} KB`
        : '';

    return (
        <div className="flex w-[250px] items-center gap-2.5 rounded-xl bg-black/10 p-2.5">
            <Icon icon={icone} className="shrink-0 text-4xl opacity-90" />
            <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold" title={nome}>{nome}</span>
                <span className="block text-[11px] opacity-70">
                    {[extensao.toUpperCase(), tamanho].filter(Boolean).join(' · ')}
                </span>
            </span>
            <a
                href={urlDownload(a.url as string)}
                download={nome}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/15 text-inherit transition-transform hover:scale-105"
                title="Descarregar"
            >
                <Icon icon="tabler:download" className="text-lg" />
            </a>
        </div>
    );
}

/** Galeria de fotos da conversa: navegação, contador e ações (responder, encaminhar, baixar, eliminar). */
interface ItemGaleria {
    url: string;
    nome: string;
    mensagem: Mensagem;
}

function Galeria({ itens, indiceInicial, aoFechar, aoResponder, aoEncaminhar, aoEliminar }: {
    itens: ItemGaleria[];
    indiceInicial: number;
    aoFechar(): void;
    aoResponder(m: Mensagem): void;
    aoEncaminhar?(m: Mensagem): void;
    aoEliminar(m: Mensagem): void;
}) {
    const [indice, setIndice] = useState(indiceInicial);
    const atual = itens[indice];

    useEffect(() => {
        const aoTecla = (e: KeyboardEvent) => {
            if (e.key === 'Escape') aoFechar();
            if (e.key === 'ArrowLeft') setIndice((i) => Math.max(0, i - 1));
            if (e.key === 'ArrowRight') setIndice((i) => Math.min(itens.length - 1, i + 1));
        };

        window.addEventListener('keydown', aoTecla);

        return () => window.removeEventListener('keydown', aoTecla);
    }, [itens.length, aoFechar]);

    const Botao = ({ titulo, onClick, children }: { titulo: string; onClick(): void; children: React.ReactNode }) => (
        <button
            title={titulo}
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border-0 bg-white/15 text-lg text-white transition-colors hover:bg-white/30"
        >
            {children}
        </button>
    );

    return (
        <div className="fixed inset-0 z-[10001] grid place-items-center bg-black/90 backdrop-blur-sm" onClick={aoFechar}>
            <img src={atual.url} className="max-h-[84vh] max-w-[90vw] rounded-xl shadow-2xl" alt="" onClick={(e) => e.stopPropagation()} />

            {/* topo: contador + barra de ações */}
            <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-white/15 px-3 py-1 text-sm text-white">
                {indice + 1} / {itens.length}
            </div>
            <div className="absolute right-4 top-4 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Botao titulo="Responder" onClick={() => aoResponder(atual.mensagem)}><Icon icon="tabler:arrow-back-up" /></Botao>
                {aoEncaminhar && <Botao titulo="Reencaminhar" onClick={() => aoEncaminhar(atual.mensagem)}><Icon icon="tabler:share-3" /></Botao>}
                <a
                    href={urlDownload(atual.url)}
                    download={atual.nome}
                    title="Baixar"
                    onClick={(e) => e.stopPropagation()}
                    className="grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-white/15 text-lg text-white transition-colors hover:bg-white/30"
                >
                    <Icon icon="tabler:download" />
                </a>
                <Botao titulo="Eliminar" onClick={() => aoEliminar(atual.mensagem)}><Icon icon="tabler:trash" /></Botao>
                <Botao titulo="Fechar" onClick={aoFechar}><Icon icon="tabler:x" /></Botao>
            </div>

            {indice > 0 && (
                <button
                    className="absolute left-4 top-1/2 grid h-12 w-12 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-0 bg-white/15 text-2xl text-white hover:bg-white/25"
                    onClick={(e) => { e.stopPropagation(); setIndice(indice - 1); }}
                >
                    <Icon icon="tabler:chevron-left" />
                </button>
            )}
            {indice < itens.length - 1 && (
                <button
                    className="absolute right-4 top-1/2 grid h-12 w-12 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-0 bg-white/15 text-2xl text-white hover:bg-white/25"
                    onClick={(e) => { e.stopPropagation(); setIndice(indice + 1); }}
                >
                    <Icon icon="tabler:chevron-right" />
                </button>
            )}
        </div>
    );
}

function ItemMenu({ onClick, children }: { onClick(): void; children: React.ReactNode }) {
    return (
        <button onClick={onClick} className="block w-full cursor-pointer whitespace-nowrap border-0 bg-transparent px-4 py-2 text-left text-[13px] text-[var(--maka-texto)] hover:bg-black/[.04]">
            {children}
        </button>
    );
}

function BotaoIcone({ onClick, titulo, children }: { onClick(): void; titulo: string; children: React.ReactNode }) {
    return (
        <button
            title={titulo}
            onClick={onClick}
            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-[17px] text-[var(--maka-texto-suave)] transition-colors hover:bg-black/[.04] hover:text-[var(--maka-texto)]"
        >
            {children}
        </button>
    );
}

/** Diálogo de confirmação da lib (nada de window.confirm). */
function ConfirmarDialogo({ titulo, descricao, botoes, aoFechar }: {
    titulo: string; descricao?: string;
    botoes: { rotulo: string; destrutivo?: boolean; acao(): void }[];
    aoFechar(): void;
}) {
    return (
        <div className="fixed inset-0 z-[10002] grid place-items-center bg-slate-900/50 backdrop-blur-sm" onClick={aoFechar}>
            <div className="w-[320px] animate-maka-subir overflow-hidden rounded-2xl bg-[var(--maka-superficie)] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="mb-1 font-bold text-[var(--maka-texto)]">{titulo}</div>
                {descricao && <div className="mb-3 text-[13px] text-[var(--maka-texto-suave)]">{descricao}</div>}
                <div className="mt-3 flex flex-col gap-2">
                    {botoes.map((b) => (
                        <button
                            key={b.rotulo}
                            onClick={() => { b.acao(); aoFechar(); }}
                            className={`w-full cursor-pointer rounded-full border-0 py-2.5 text-sm font-bold shadow-sm transition-transform hover:scale-[1.02] ${
                                b.destrutivo ? 'bg-red-600 text-white' : 'bg-[var(--maka-primaria)] text-[var(--maka-primaria-contraste)]'
                            }`}
                        >
                            {b.rotulo}
                        </button>
                    ))}
                    <button onClick={aoFechar} className="w-full cursor-pointer rounded-full border-0 bg-[var(--maka-fundo)] py-2.5 text-sm font-semibold text-[var(--maka-texto)]">
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
}

/** Multi-select de conversas — encaminhar para várias pessoas de uma vez. */
function EscolherConversas({ titulo, aoConfirmar, aoFechar }: { titulo: string; aoConfirmar(ids: string[]): void; aoFechar(): void }) {
    const { engine } = useMakaChat();
    const versao = useVersaoChat();
    const [conversas, setConversas] = useState<Conversa[]>([]);
    const [escolhidas, setEscolhidas] = useState<Set<string>>(new Set());

    useEffect(() => {
        void engine.storage.listarConversas(false).then(setConversas);
    }, [engine, versao]);

    const alternar = (id: string) => {
        setEscolhidas((atual) => {
            const novo = new Set(atual);

            if (novo.has(id)) novo.delete(id);
            else novo.add(id);

            return novo;
        });
    };

    return (
        <div className="fixed inset-0 z-[10000] grid place-items-center bg-slate-900/50 backdrop-blur-sm" onClick={aoFechar}>
            <div className="flex max-h-[70vh] w-[360px] animate-maka-subir flex-col overflow-hidden rounded-2xl bg-[var(--maka-superficie)] shadow-maka-modal" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3">
                    <span className="font-bold text-[var(--maka-texto)]">{titulo}</span>
                    <BotaoIcone titulo="Fechar" onClick={aoFechar}><Icon icon="tabler:x" /></BotaoIcone>
                </div>
                <div className="maka-scroll flex-1 overflow-auto">
                    {conversas.map((c) => (
                        <button
                            key={c.id}
                            onClick={() => alternar(c.id)}
                            className="flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-4 py-2.5 text-left hover:bg-black/[.04]"
                        >
                            <Icon
                                icon={escolhidas.has(c.id) ? 'tabler:circle-check-filled' : 'tabler:circle'}
                                className={`text-xl ${escolhidas.has(c.id) ? 'text-[var(--maka-primaria)]' : 'text-[var(--maka-texto-suave)]'}`}
                            />
                            <AvatarWeb nome={c.titulo ?? '?'} url={c.foto_url} tamanho={34} />
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--maka-texto)]">{c.titulo ?? 'Conversa'}</span>
                        </button>
                    ))}
                </div>
                <div className="p-3">
                    <button
                        disabled={escolhidas.size === 0}
                        onClick={() => aoConfirmar([...escolhidas])}
                        className="w-full cursor-pointer rounded-full border-0 bg-[var(--maka-primaria)] py-2.5 text-sm font-bold text-[var(--maka-primaria-contraste)] shadow-md transition-opacity disabled:cursor-default disabled:opacity-40"
                    >
                        Enviar{escolhidas.size > 0 ? ` (${escolhidas.size})` : ''}
                    </button>
                </div>
            </div>
        </div>
    );
}

function TicksWeb({ mensagem, outros }: { mensagem: Mensagem; outros: ParticipanteConversa[] }) {
    if (mensagem.estado_envio === 'a_enviar') return <Icon icon="tabler:clock" />;
    if (mensagem.estado_envio === 'falhou') return <Icon icon="tabler:alert-circle" className="text-red-500" />;

    const entregue = outros.length > 0 && outros.every((p) => idMaiorOuIgual(p.ultima_entrega_mensagem_id, mensagem.id));
    const lida = outros.length > 0 && outros.every((p) => idMaiorOuIgual(p.ultima_leitura_mensagem_id, mensagem.id));

    // ✓ enviada · ✓✓ entregue (cinzento) · ✓✓ lida (AZUL) — igual ao mobile
    return (
        <Icon
            icon={entregue || lida ? 'tabler:checks' : 'tabler:check'}
            className={`text-[13px] ${lida ? 'text-sky-400' : 'opacity-60'}`}
        />
    );
}

export function AvatarWeb({ nome, url, tamanho = 44, grupo = false }: { nome: string; url?: string | null; tamanho?: number; grupo?: boolean }) {
    if (!url && grupo) {
        return (
            <span
                className="grid shrink-0 place-items-center rounded-full bg-[var(--maka-primaria)] text-[var(--maka-primaria-contraste)] ring-1 ring-black/[.05]"
                style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.5 }}
            >
                <Icon icon="tabler:users-group" />
            </span>
        );
    }

    if (url) {
        return (
            <img
                src={url}
                alt={nome}
                className="shrink-0 rounded-full object-cover ring-1 ring-black/[.05]"
                style={{ width: tamanho, height: tamanho }}
            />
        );
    }

    return (
        <span
            className="grid shrink-0 place-items-center rounded-full bg-[var(--maka-primaria)] font-bold text-[var(--maka-primaria-contraste)] ring-1 ring-black/[.05]"
            style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.42 }}
        >
            {nome.trim().charAt(0).toUpperCase() || '?'}
        </span>
    );
}

/** Acrescenta download=1 (o servidor responde com Content-Disposition: attachment). */
function urlDownload(url: string): string {
    return `${url}${url.includes('?') ? '&' : '?'}download=1`;
}

export function horaCurtaWeb(iso: string): string {
    const data = new Date(iso);

    if (data.toDateString() === new Date().toDateString()) {
        return data.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    }

    return data.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
}

/** Registo de chamada no chat — mais robusto que texto de sistema: resultado, duração e ligar de novo. */
function CartaoRegistoChamada({ mensagem: m }: { mensagem: Mensagem }) {
    const chamadas = useChamadasOpcional();
    const meta = (m.metadados ?? {}) as { chamada_tipo?: string; resultado?: string; duracao_segundos?: number | null };
    const video = meta.chamada_tipo === 'video';
    const atendida = meta.resultado === 'atendida';
    const dur = meta.duracao_segundos ?? 0;
    const mmss = `${String(Math.floor(dur / 60)).padStart(2, '0')}:${String(dur % 60).padStart(2, '0')}`;
    const podeLigar = useFuncionalidadeAtiva(video ? 'chamadas.video' : 'chamadas.audio');

    return (
        <div className="flex items-center gap-3 rounded-2xl bg-[var(--maka-superficie)] px-4 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,.04),0_4px_14px_-4px_rgba(15,23,42,.08)]">
            <span className={`grid h-9 w-9 place-items-center rounded-full ${atendida ? 'bg-emerald-500/15 text-emerald-600' : 'bg-red-500/15 text-red-500'}`}>
                <Icon icon={video ? (atendida ? 'tabler:video' : 'tabler:video-off') : (atendida ? 'tabler:phone' : 'tabler:phone-x')} />
            </span>
            <span className="flex flex-col">
                <span className="text-sm font-semibold text-[var(--maka-texto)]">Chamada de {video ? 'vídeo' : 'voz'}</span>
                <span className={`text-xs ${atendida ? 'text-[var(--maka-texto-suave)]' : 'font-semibold text-red-500'}`}>
                    {atendida ? `Duração ${mmss}` : 'Não atendida'} · {horaCurtaWeb(m.criada_em)}
                </span>
            </span>
            {chamadas && podeLigar && (
                <button
                    title="Ligar de novo"
                    onClick={() => void chamadas.iniciar(m.conversa_id, video ? 'video' : 'audio')}
                    className="ml-2 grid h-9 w-9 cursor-pointer place-items-center rounded-full border-0 bg-[var(--maka-primaria)] text-[var(--maka-primaria-contraste)] shadow-sm transition-transform hover:scale-105"
                >
                    <Icon icon={video ? 'tabler:video' : 'tabler:phone'} />
                </button>
            )}
        </div>
    );
}
