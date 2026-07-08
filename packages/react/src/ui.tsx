import { Icon } from '@iconify/react';
import { Anexo, Conversa, idMaiorOuIgual, Mensagem, ParticipanteConversa } from '@hongayetu/makachat-core';
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
                    <Icon icon="mdi:chat-outline" className="text-4xl opacity-40" />
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
    /** abrir outra conversa (ex.: "mensagem" a partir do modal de reações) */
    aoAbrirOutraConversa?(conversaId: string): void;
}

export function ConversaPainel({ conversaId, compacto = false, aoFechar, aoAbrirOutraConversa }: ConversaPainelProps) {
    const { engine, socket, identidade, api, registarVisivel } = useMakaChat();
    const chamadas = useChamadasOpcional();
    const versao = useVersaoChat();
    const mensagens = useMensagens(conversaId, 100);
    const typing = useTypingConversa(conversaId);
    const enviar = useEnviarMensagem();

    const podeAudioChamada = useFuncionalidadeAtiva('chamadas.audio');
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
    const [menuConversa, setMenuConversa] = useState(false);
    const [confirmarEliminarConversa, setConfirmarEliminarConversa] = useState(false);

    const fim = useRef<HTMLDivElement>(null);
    const ficheiro = useRef<HTMLInputElement>(null);
    const fotoInput = useRef<HTMLInputElement>(null);
    const ultimoTyping = useRef(0);
    const refsBolhas = useRef(new Map<string, HTMLDivElement>());

    useEffect(() => registarVisivel(conversaId), [registarVisivel, conversaId]);

    useEffect(() => {
        void engine.storage.obterConversa(conversaId).then(setConversa);
    }, [engine, conversaId, versao]);

    useEffect(() => {
        setContexto(null);
        void engine.carregarMensagens(conversaId).catch(() => undefined);
        void api.obterContexto(conversaId).then((r) => setContexto(r.contexto ?? null)).catch(() => undefined);
        void engine.entrarConversa(conversaId);
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
            await engine.editarMensagem(alvo.id, conteudo).catch(() => undefined);

            return;
        }

        const resposta = responderA;
        setResponderA(null);
        void enviar({ conversa_id: conversaId, conteudo, resposta_a_id: resposta?.id });
    };

    /** Upload + envio via engine: aparece já no chat com preview local. */
    const enviarFicheiro = async (f: File, legenda?: string, forcarTipo?: 'ficheiro') => {
        setAEnviarMedia(true);

        try {
            const tipo = forcarTipo ?? (f.type.startsWith('image/') ? 'foto' : f.type.startsWith('video/') ? 'video' : f.type.startsWith('audio/') ? 'audio' : 'ficheiro');
            const criado = await api.criarMedia({ tipo, mime: f.type, nome_ficheiro: f.name });
            await api.carregarMedia(criado.upload, f, f.type);
            await api.confirmarMedia(criado.anexo_id);

            const preview: Anexo = {
                id: criado.anexo_id,
                tipo: tipo as Anexo['tipo'],
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

    /** Scroll até à mensagem citada, com destaque. */
    const irParaMensagem = async (mensagemId: string) => {
        for (let tentativa = 0; tentativa < 4; tentativa++) {
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
                {chamadas && podeAudioChamada && <BotaoIcone titulo="Chamada de áudio" onClick={() => void chamadas.iniciar(conversaId, 'audio')}><Icon icon="mdi:phone" /></BotaoIcone>}
                {chamadas && podeVideoChamada && <BotaoIcone titulo="Chamada de vídeo" onClick={() => void chamadas.iniciar(conversaId, 'video')}><Icon icon="mdi:video-outline" /></BotaoIcone>}
                <span className="relative">
                    <BotaoIcone titulo="Opções da conversa" onClick={() => setMenuConversa(!menuConversa)}><Icon icon="mdi:dots-vertical" /></BotaoIcone>
                    {menuConversa && (
                        <div className="absolute right-0 top-10 z-[5] min-w-[190px] animate-maka-subir overflow-hidden rounded-xl bg-[var(--maka-superficie)] shadow-xl ring-1 ring-black/5">
                            <ItemMenu onClick={() => { setMenuConversa(false); void engine.marcarNaoLida(conversaId).catch(() => undefined); aoFechar?.(); }}>
                                <Icon icon="mdi:email-mark-as-unread" className="inline align-[-2px]" /> Marcar como não lida
                            </ItemMenu>
                            {podeEliminarConversa && (
                                <ItemMenu onClick={() => { setMenuConversa(false); setConfirmarEliminarConversa(true); }}>
                                    <Icon icon="mdi:delete-outline" className="inline align-[-2px]" /> Eliminar conversa
                                </ItemMenu>
                            )}
                        </div>
                    )}
                </span>
                {aoFechar && <BotaoIcone titulo="Fechar" onClick={aoFechar}><Icon icon="mdi:close" /></BotaoIcone>}
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
                    <BotaoIcone titulo="Cancelar" onClick={() => { setResponderA(null); setEditar(null); setTexto(''); }}><Icon icon="mdi:close" /></BotaoIcone>
                </div>
            )}

            {/* input com gravação de áudio */}
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
                aoGravarAudio={(blob) => void enviarFicheiro(new File([blob], 'voz.webm', { type: blob.type || 'audio/webm' }))}
            />
            {menuAnexo && (
                <div className="absolute bottom-16 left-3 z-[6] min-w-[190px] animate-maka-subir overflow-hidden rounded-xl bg-[var(--maka-superficie)] shadow-xl ring-1 ring-black/5">
                    <ItemMenu onClick={() => { setMenuAnexo(false); fotoInput.current?.click(); }}>
                        <Icon icon="mdi:image-outline" className="inline align-[-2px] text-[var(--maka-primaria)]" /> Fotos e vídeos
                    </ItemMenu>
                    <ItemMenu onClick={() => { setMenuAnexo(false); ficheiro.current?.click(); }}>
                        <Icon icon="mdi:file-outline" className="inline align-[-2px] text-[var(--maka-primaria)]" /> Ficheiro
                    </ItemMenu>
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
            {reacoesDe && conversa && (
                <ModalReacoes
                    mensagem={mensagens.find((m) => m.id === reacoesDe.id) ?? reacoesDe}
                    conversa={conversa}
                    euId={eu?.identidade_id ?? null}
                    aoFechar={() => setReacoesDe(null)}
                    aoRemoverMinha={(emoji) => void engine.alternarReacao(conversaId, reacoesDe.id, emoji)}
                    aoMensagem={
                        conversa.tipo === 'grupo' && aoAbrirOutraConversa
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
    podeMedia: boolean; podeGravar: boolean; aEnviarMedia: boolean; aoAnexar(): void; aoGravarAudio(blob: Blob): void;
}) {
    const [aGravar, setAGravar] = useState(false);
    const [segundos, setSegundos] = useState(0);
    const gravador = useRef<MediaRecorder | null>(null);
    const pedacos = useRef<Blob[]>([]);
    const cancelado = useRef(false);
    const timer = useRef<ReturnType<typeof setInterval> | null>(null);

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
                    aoGravarAudio(new Blob(pedacos.current, { type: rec.mimeType || 'audio/webm' }));
                }
            };
            rec.start();
            gravador.current = rec;
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
            <div className={`flex items-center gap-3 bg-[var(--maka-superficie)] ${compacto ? 'p-2' : 'p-3'}`}>
                <span className="h-3 w-3 animate-maka-pulsar rounded-full bg-red-500" />
                <span className="font-mono text-sm text-[var(--maka-texto)]">
                    {String(Math.floor(segundos / 60)).padStart(2, '0')}:{String(segundos % 60).padStart(2, '0')}
                </span>
                <span className="flex-1 text-xs text-[var(--maka-texto-suave)]">a gravar…</span>
                <BotaoIcone titulo="Cancelar" onClick={() => terminar(true)}><Icon icon="mdi:delete-outline" className="text-red-500" /></BotaoIcone>
                <button
                    onClick={() => terminar(false)}
                    className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-[var(--maka-primaria)] text-[var(--maka-primaria-contraste)] shadow-md transition-transform hover:scale-105"
                >
                    <Icon icon="mdi:send" className="text-lg" />
                </button>
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-2 bg-[var(--maka-superficie)] ${compacto ? 'p-2' : 'p-3'}`}>
            {podeMedia && (
                <BotaoIcone titulo="Anexar" onClick={aoAnexar}>
                    {aEnviarMedia ? <Icon icon="mdi:loading" className="animate-spin" /> : <Icon icon="mdi:paperclip" />}
                </BotaoIcone>
            )}
            <textarea
                rows={1}
                className="maka-scroll min-w-0 flex-1 resize-none rounded-2xl border border-slate-300/60 bg-[var(--maka-fundo)] px-4 py-2.5 text-sm leading-5 text-[var(--maka-texto)] outline-none transition-shadow placeholder:text-[var(--maka-texto-suave)] focus:ring-2 focus:ring-[var(--maka-primaria)]"
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
                    <Icon icon="mdi:microphone" className="text-lg" />
                </button>
            ) : (
                <button
                    onClick={aoEnviar}
                    className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-[var(--maka-primaria)] text-[var(--maka-primaria-contraste)] shadow-md transition-transform hover:scale-105 active:scale-95"
                >
                    <Icon icon="mdi:send" className="text-lg" />
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
}

function Bolha({ mensagem: m, minha, grupo, participantes, outros, acoes, todas, destacada, registarRef, aoAbrirFoto, aoClicarCitacao, aoVerReacoes, podeReagir }: {
    mensagem: Mensagem; minha: boolean; grupo?: boolean;
    participantes: ParticipanteConversa[]; outros: ParticipanteConversa[]; acoes: AcoesBolha; todas: Mensagem[];
    destacada: boolean; registarRef(el: HTMLDivElement | null): void;
    aoAbrirFoto(url: string): void; aoClicarCitacao(id: string): void; aoVerReacoes(): void; podeReagir: boolean;
}) {
    const [hover, setHover] = useState(false);
    const [picker, setPicker] = useState(false);
    const [menu, setMenu] = useState(false);
    const respondida = m.resposta_a_id ? todas.find((x) => x.id === m.resposta_a_id) : null;
    const grupos = agruparReacoes(m.reacoes);

    if (m.tipo === 'sistema') {
        return (
            <div ref={registarRef} className="my-1 self-center rounded-full bg-slate-500/10 px-3.5 py-1 text-xs text-[var(--maka-texto-suave)]">
                {m.conteudo}
            </div>
        );
    }

    const mostrarBarra = hover || picker || menu;

    const barra = mostrarBarra && !m.eliminada && (
        <div className="relative flex shrink-0 items-center gap-0.5 self-center rounded-full bg-[var(--maka-superficie)] px-1.5 py-1 shadow-md ring-1 ring-black/5">
            {podeReagir && (
                <button
                    className="grid h-7 w-7 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-base text-[var(--maka-texto-suave)] hover:bg-[var(--maka-fundo)] hover:text-[var(--maka-texto)]"
                    title="Reagir"
                    onClick={() => { setPicker(!picker); setMenu(false); }}
                >
                    <Icon icon="mdi:emoticon-happy-outline" />
                </button>
            )}
            <button className="grid h-7 w-7 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-base text-[var(--maka-texto-suave)] hover:bg-[var(--maka-fundo)] hover:text-[var(--maka-texto)]" title="Responder" onClick={acoes.responder}>
                <Icon icon="mdi:reply" />
            </button>
            {(acoes.editar || acoes.eliminar || acoes.encaminhar) && (
                <button className="grid h-7 w-7 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-base text-[var(--maka-texto-suave)] hover:bg-[var(--maka-fundo)] hover:text-[var(--maka-texto)]" title="Mais opções" onClick={() => { setMenu(!menu); setPicker(false); }}>
                    <Icon icon="mdi:dots-horizontal" />
                </button>
            )}

            {picker && (
                <div className={`absolute -top-11 z-[3] flex animate-maka-subir items-center gap-1.5 rounded-full bg-[var(--maka-superficie)] px-3 py-1.5 shadow-xl ring-1 ring-black/10 ${minha ? 'right-0' : 'left-0'}`}>
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
                <div className={`absolute top-9 z-[3] min-w-[150px] overflow-hidden rounded-xl bg-[var(--maka-superficie)] shadow-xl ring-1 ring-black/5 ${minha ? 'right-0' : 'left-0'}`}>
                    {acoes.encaminhar && <ItemMenu onClick={acoes.encaminhar}><Icon icon="mdi:share" className="inline align-[-2px]" /> Encaminhar</ItemMenu>}
                    {acoes.editar && <ItemMenu onClick={acoes.editar}><Icon icon="mdi:pencil-outline" className="inline align-[-2px]" /> Editar</ItemMenu>}
                    {acoes.eliminar && <ItemMenu onClick={acoes.eliminar}><Icon icon="mdi:delete-outline" className="inline align-[-2px]" /> Eliminar</ItemMenu>}
                </div>
            )}
        </div>
    );

    return (
        <div
            ref={registarRef}
            className={`relative flex items-stretch gap-1.5 pt-1 ${grupos.length ? 'pb-3' : ''} ${minha ? 'justify-end' : 'justify-start'}`}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => {
                setHover(false);

                if (!picker) setMenu(false);
            }}
        >
            {minha && barra}
            <div
                className={`flex max-w-[72%] flex-col gap-1 rounded-[var(--maka-raio)] px-3 py-2 shadow-sm transition-shadow ${
                    destacada ? 'ring-2 ring-[var(--maka-primaria)]' : ''
                } ${minha ? 'rounded-br-md bg-[var(--maka-bolha-minha)] text-[var(--maka-bolha-minha-texto)]' : 'rounded-bl-md bg-[var(--maka-bolha-outro)] text-[var(--maka-texto)]'}`}
            >
                {grupo && !minha && (
                    <span className="text-xs font-bold text-[var(--maka-primaria)]">
                        {participantes.find((p) => p.identidade_id === m.remetente_identidade_id)?.nome ?? '…'}
                    </span>
                )}
                {m.resposta_a_id && (
                    <button
                        onClick={() => aoClicarCitacao(m.resposta_a_id as string)}
                        className={`cursor-pointer truncate rounded-md border-0 px-2 py-1 text-left text-xs text-inherit opacity-90 transition-opacity hover:opacity-100 ${minha ? 'bg-white/20' : 'bg-black/5'}`}
                    >
                        <Icon icon="mdi:reply" className="mr-1 inline align-[-2px]" />
                        {respondida ? (respondida.conteudo ?? '📎 anexo') : 'Ver mensagem original'}
                    </button>
                )}
                {m.anexos.map((a) => <AnexoView key={a.id} anexo={a} aoAbrirFoto={aoAbrirFoto} />)}
                {m.eliminada ? (
                    <em className="flex items-center gap-1 opacity-60"><Icon icon="mdi:cancel" /> Mensagem eliminada</em>
                ) : (
                    m.conteudo && <span className="whitespace-pre-wrap text-sm leading-relaxed">{m.conteudo}</span>
                )}
                <span className="flex items-center gap-1 self-end text-[10px] opacity-60">
                    {m.encaminhada_de_id && <Icon icon="mdi:share" />}{m.editada_em ? 'editada · ' : ''}{horaCurtaWeb(m.criada_em)}
                    {minha && <TicksWeb mensagem={m} outros={outros} />}
                </span>
            </div>

            {/* chips de reações agrupadas — clicar abre a lista de quem reagiu */}
            {grupos.length > 0 && (
                <button
                    onClick={aoVerReacoes}
                    className={`absolute -bottom-1 z-[1] flex cursor-pointer items-center gap-1 rounded-full border-0 bg-[var(--maka-superficie)] px-2 py-px text-[12px] shadow-md ring-1 ring-black/5 transition-transform hover:scale-105 ${minha ? 'right-3' : 'left-3'}`}
                >
                    {grupos.map((g) => (
                        <span key={g.emoji}>
                            {g.emoji}
                            {g.contagem > 1 && <span className="ml-0.5 text-[10px] font-bold text-[var(--maka-texto-suave)]">{g.contagem}</span>}
                        </span>
                    ))}
                </button>
            )}

            {!minha && barra}
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
            <div className="w-[340px] animate-maka-subir overflow-hidden rounded-2xl bg-[var(--maka-superficie)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3">
                    <span className="font-bold text-[var(--maka-texto)]">Reações</span>
                    <BotaoIcone titulo="Fechar" onClick={aoFechar}><Icon icon="mdi:close" /></BotaoIcone>
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
                                        <Icon icon="mdi:chat-outline" />
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
            <div className="flex w-[460px] max-w-[94vw] animate-maka-subir flex-col overflow-hidden rounded-2xl bg-[var(--maka-superficie)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3">
                    <span className="font-bold text-[var(--maka-texto)]">
                        Enviar {ficheiros.length === 1 ? 'foto' : `${ficheiros.length} fotos`}
                    </span>
                    <BotaoIcone titulo="Fechar" onClick={aoFechar}><Icon icon="mdi:close" /></BotaoIcone>
                </div>

                {/* destaque da primeira + grelha de miniaturas */}
                <img src={urls[0]} className="max-h-[42vh] w-full bg-black object-contain" alt="" />
                <div className="maka-scroll flex gap-2 overflow-x-auto px-3 py-2.5">
                    {urls.map((u, i) => (
                        <span key={i} className="relative shrink-0">
                            <img src={u} className="h-16 w-16 rounded-lg object-cover ring-1 ring-black/10" alt="" />
                            <button
                                onClick={() => aoRemover(i)}
                                className="absolute -right-1.5 -top-1.5 grid h-5 w-5 cursor-pointer place-items-center rounded-full border-0 bg-slate-900 text-[10px] text-white shadow"
                                title="Remover"
                            >
                                <Icon icon="mdi:close" />
                            </button>
                        </span>
                    ))}
                    {ficheiros.length < 10 && (
                        <button
                            onClick={aoAdicionarMais}
                            className="grid h-16 w-16 shrink-0 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-slate-300 bg-transparent text-xl text-[var(--maka-texto-suave)] hover:border-[var(--maka-primaria)] hover:text-[var(--maka-primaria)]"
                            title="Adicionar mais"
                        >
                            <Icon icon="mdi:plus" />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2 p-3">
                    <input
                        autoFocus
                        className="min-w-0 flex-1 rounded-full border border-slate-300/60 bg-[var(--maka-fundo)] px-4 py-2.5 text-sm text-[var(--maka-texto)] outline-none focus:ring-2 focus:ring-[var(--maka-primaria)]"
                        placeholder="Legenda (opcional)"
                        value={legenda}
                        onChange={(e) => setLegenda(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && aoEnviar(legenda)}
                    />
                    <button
                        onClick={() => aoEnviar(legenda)}
                        className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-[var(--maka-primaria)] text-[var(--maka-primaria-contraste)] shadow-md transition-transform hover:scale-105"
                    >
                        <Icon icon="mdi:send" className="text-lg" />
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
    if (a.tipo === 'audio') return <ReprodutorAudio url={a.url} />;

    return <CartaoFicheiro anexo={a} />;
}

const ICONE_POR_EXTENSAO: Record<string, string> = {
    pdf: 'mdi:file-pdf-box',
    doc: 'mdi:file-word-box', docx: 'mdi:file-word-box',
    xls: 'mdi:file-excel-box', xlsx: 'mdi:file-excel-box', csv: 'mdi:file-excel-box',
    ppt: 'mdi:file-powerpoint-box', pptx: 'mdi:file-powerpoint-box',
    zip: 'mdi:folder-zip', rar: 'mdi:folder-zip', '7z': 'mdi:folder-zip',
    mp3: 'mdi:file-music', wav: 'mdi:file-music', webm: 'mdi:file-music',
    jpg: 'mdi:file-image', jpeg: 'mdi:file-image', png: 'mdi:file-image', gif: 'mdi:file-image',
    txt: 'mdi:file-document-outline',
};

function CartaoFicheiro({ anexo: a }: { anexo: Anexo }) {
    const nome = a.nome_ficheiro ?? 'Ficheiro';
    const extensao = (nome.includes('.') ? nome.split('.').pop() ?? '' : '').toLowerCase();
    const icone = ICONE_POR_EXTENSAO[extensao] ?? 'mdi:file-outline';
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
                <Icon icon="mdi:download" className="text-lg" />
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
                <Botao titulo="Responder" onClick={() => aoResponder(atual.mensagem)}><Icon icon="mdi:reply" /></Botao>
                {aoEncaminhar && <Botao titulo="Reencaminhar" onClick={() => aoEncaminhar(atual.mensagem)}><Icon icon="mdi:share" /></Botao>}
                <a
                    href={urlDownload(atual.url)}
                    download={atual.nome}
                    title="Baixar"
                    onClick={(e) => e.stopPropagation()}
                    className="grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-white/15 text-lg text-white transition-colors hover:bg-white/30"
                >
                    <Icon icon="mdi:download" />
                </a>
                <Botao titulo="Eliminar" onClick={() => aoEliminar(atual.mensagem)}><Icon icon="mdi:delete-outline" /></Botao>
                <Botao titulo="Fechar" onClick={aoFechar}><Icon icon="mdi:close" /></Botao>
            </div>

            {indice > 0 && (
                <button
                    className="absolute left-4 top-1/2 grid h-12 w-12 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-0 bg-white/15 text-2xl text-white hover:bg-white/25"
                    onClick={(e) => { e.stopPropagation(); setIndice(indice - 1); }}
                >
                    <Icon icon="mdi:chevron-left" />
                </button>
            )}
            {indice < itens.length - 1 && (
                <button
                    className="absolute right-4 top-1/2 grid h-12 w-12 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-0 bg-white/15 text-2xl text-white hover:bg-white/25"
                    onClick={(e) => { e.stopPropagation(); setIndice(indice + 1); }}
                >
                    <Icon icon="mdi:chevron-right" />
                </button>
            )}
        </div>
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
            <div className="flex max-h-[70vh] w-[360px] animate-maka-subir flex-col overflow-hidden rounded-2xl bg-[var(--maka-superficie)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3">
                    <span className="font-bold text-[var(--maka-texto)]">{titulo}</span>
                    <BotaoIcone titulo="Fechar" onClick={aoFechar}><Icon icon="mdi:close" /></BotaoIcone>
                </div>
                <div className="maka-scroll flex-1 overflow-auto">
                    {conversas.map((c) => (
                        <button
                            key={c.id}
                            onClick={() => alternar(c.id)}
                            className="flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-4 py-2.5 text-left hover:bg-[var(--maka-fundo)]"
                        >
                            <Icon
                                icon={escolhidas.has(c.id) ? 'mdi:checkbox-marked-circle' : 'mdi:checkbox-blank-circle-outline'}
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
    if (mensagem.estado_envio === 'a_enviar') return <Icon icon="mdi:clock-outline" />;
    if (mensagem.estado_envio === 'falhou') return <Icon icon="mdi:alert-circle-outline" className="text-red-500" />;

    const entregue = outros.length > 0 && outros.every((p) => idMaiorOuIgual(p.ultima_entrega_mensagem_id, mensagem.id));
    const lida = outros.length > 0 && outros.every((p) => idMaiorOuIgual(p.ultima_leitura_mensagem_id, mensagem.id));

    return <Icon icon={entregue || lida ? 'mdi:check-all' : 'mdi:check'} className={`text-[13px] ${lida ? 'opacity-100' : 'opacity-60'}`} />;
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
