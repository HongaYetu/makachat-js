import { Icon } from '@iconify/react';
import { Conversa } from '@hongayetu/makachat-core';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useConversas, useSemLigacao, useVersaoChat } from './hooks';
import { useMakaChat } from './provider';
import { AvatarWeb, ConversaPainel, MakaChatConversas, useFecharFora } from './ui';
import { v } from './tema';

// ---------------------------------------------------------------- BoxFull / BoxMin

export interface BoxProps {
    /** abre esta conversa (ex.: vindo de um botão "Falar com a loja") */
    conversaAbertaId?: string | null;
    /** nome do parâmetro de query string que abre uma conversa ao carregar (default 'conversa'; false desliga) */
    queryParam?: string | false;
}

/** Página inteira: ocupa o viewport todo e ignora o layout do site. */
export function MakaChatBoxFull({ conversaAbertaId, queryParam = 'conversa' }: BoxProps = {}) {
    return (
        <div className="fixed inset-0 z-[9000] bg-[var(--maka-fundo)]">
            <DuasColunas conversaAbertaId={conversaAbertaId} queryParam={queryParam} />
        </div>
    );
}

/** Preenche 100% do contentor onde for montado (ex.: área útil de um admin). */
export function MakaChatBoxMin({ conversaAbertaId, queryParam = 'conversa' }: BoxProps = {}) {
    return (
        <div className="h-full min-h-[420px] w-full overflow-hidden rounded-2xl bg-[var(--maka-fundo)] shadow-sm ring-1 ring-black/[.05]">
            <DuasColunas conversaAbertaId={conversaAbertaId} queryParam={queryParam} />
        </div>
    );
}

function DuasColunas({ conversaAbertaId, queryParam }: BoxProps) {
    const { engine } = useMakaChat();
    const semLigacao = useSemLigacao();
    const [ativa, setAtiva] = useState<string | null>(conversaAbertaId ?? null);

    useEffect(() => {
        if (conversaAbertaId) setAtiva(conversaAbertaId);
    }, [conversaAbertaId]);

    // ?conversa=<id> seleciona ao carregar — mesmo fora da lista recente,
    // o entrarConversa vai buscá-la ao servidor e mete-a no storage
    useEffect(() => {
        if (!queryParam || typeof window === 'undefined') return;

        const id = new URLSearchParams(window.location.search).get(queryParam);

        if (!id) return;

        void engine.entrarConversa(id).then(() => setAtiva(id));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queryParam]);
    const [estreita, setEstreita] = useState(false);
    const ref = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;

        if (!el) return;

        const obs = new ResizeObserver(() => setEstreita(el.clientWidth < 640));
        obs.observe(el);

        return () => obs.disconnect();
    }, []);

    const mostrarLista = !estreita || !ativa;
    const mostrarPainel = !estreita || !!ativa;

    return (
        <div ref={ref} className="flex h-full flex-col">
            {semLigacao && (
                <div className="bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-800">
                    ⚠️ Sem ligação ao chat — a tentar reconectar…
                </div>
            )}
            <div className="flex min-h-0 flex-1">
            {mostrarLista && (
                <div className={`h-full border-0 border-r border-solid border-black/[.06] ${estreita ? 'w-full' : 'w-[340px] shrink-0'}`}>
                    <MakaChatConversas conversaAtivaId={ativa} onAbrirConversa={(c: Conversa) => setAtiva(c.id)} />
                </div>
            )}
            {mostrarPainel && (
                <div className="h-full min-w-0 flex-1">
                    {ativa ? (
                        <ConversaPainel
                            conversaId={ativa}
                            aoFechar={estreita ? () => setAtiva(null) : undefined}
                            aoAbrirOutraConversa={setAtiva}
                        />
                    ) : (
                        <div className="grid h-full place-items-center">
                            <div className="flex flex-col items-center gap-3 text-[var(--maka-texto-suave)]">
                                <span className="grid h-16 w-16 place-items-center rounded-full bg-[var(--maka-superficie)] text-3xl shadow-sm"><Icon icon="tabler:message-circle" className="text-[var(--maka-primaria)]" /></span>
                                <span className="text-sm">Escolhe uma conversa para começar</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------- Dock (boxes múltiplas estilo Facebook)

interface DockApi {
    abrir(conversaId: string, opcoes?: { minimizada?: boolean }): void;
    fechar(conversaId: string): void;
}

const DockCtx = createContext<DockApi | null>(null);

export function useDock(): DockApi {
    const ctx = useContext(DockCtx);

    if (!ctx) throw new Error('useDock requer <MakaChatDock>');

    return ctx;
}

/** Como useDock, mas devolve null fora do Dock (páginas sem sessão/provider). */
export function useDockOpcional(): DockApi | null {
    return useContext(DockCtx);
}

/**
 * **A `@layer` do CSS do SDK tem de ficar DEPOIS da `base` do Tailwind.**
 *
 * As cores destes componentes vêm de classes (`text-[var(--maka-primaria-contraste)]`,
 * `bg-[var(--maka-primaria)]`). Entre layers ganha a última e a especificidade
 * não conta: com o CSS do SDK numa layer anterior à `base`, o
 * `button { color: inherit; background-color: transparent }` do **preflight**
 * passa-lhe por cima, e o resultado é o botão flutuante com o ícone **preto** e
 * as barras das conversas minimizadas sem fundo. Não há erro nenhum — só fica
 * feio, e num sítio onde ninguém procura a causa.
 *
 * A ordem certa, no `app.css` de quem integra:
 *
 * ```css
 * @layer theme, base, components, makachat, utilities;
 * @import 'tailwindcss';
 * @import '@hongayetu/makachat-react/styles.css' layer(makachat);
 * ```
 */
export interface MakaChatDockProps {
    /** abre uma box automaticamente quando chega mensagem nova (default true) */
    autoAbrir?: boolean;
    /** query string que abre uma box ao carregar (default false — evita duplicar com BoxMin/BoxFull) */
    queryParam?: string | false;
    /** false = esconde launcher e boxes mantendo o contexto/estado (ex.: página onde já há BoxMin/BoxFull) */
    visivel?: boolean;
    maxBoxes?: number;

    /**
     * O ícone do botão flutuante.
     *
     * Por omissão é um balão **cheio** — a forma que a web inteira usa para um
     * lançador de chat, e a única que se lê bem a 24 px sobre uma cor forte: um
     * contorno fino sobre o gradiente fica lavado e parece um erro de carregamento.
     *
     * Cada app pode passar o seu (um `<Icon>` do Iconify, um SVG próprio, a sua
     * marca). Isto é o padrão, não a regra.
     */
    icone?: React.ReactNode;

    children?: React.ReactNode;
}

interface BoxAberta {
    conversaId: string;
    minimizada: boolean;
}

/** Quantas boxes cabem no ecrã: launcher + margens reservam ~96px; cada box ocupa 336 + 12 de gap. */
function boxesQueCabem(): number {
    if (typeof window === 'undefined') return 1;

    return Math.max(1, Math.floor((window.innerWidth - 96) / 348));
}

/**
 * Boxes múltiplas fixas no canto inferior direito: launcher com não lidas e
 * conversas recentes; boxes lado a lado, minimizáveis. Convive com BoxMin.
 */
export function MakaChatDock({ autoAbrir = true, visivel = true, maxBoxes = 3, queryParam = false, icone, children }: MakaChatDockProps) {
    const { estaVisivel, engine } = useMakaChat();
    const conversas = useConversas();
    const versao = useVersaoChat();
    const [boxes, setBoxes] = useState<BoxAberta[]>([]);
    const [popover, setPopover] = useState(false);
    const [capacidade, setCapacidade] = useState(() => boxesQueCabem());

    useFecharFora(popover, 'dock-popover', () => setPopover(false));

    // o limite real depende do espaço disponível — abrir mais fecha a mais antiga
    const limite = Math.max(1, Math.min(maxBoxes, capacidade));

    useEffect(() => {
        const aoRedimensionar = () => setCapacidade(boxesQueCabem());

        window.addEventListener('resize', aoRedimensionar);

        return () => window.removeEventListener('resize', aoRedimensionar);
    }, []);

    useEffect(() => {
        setBoxes((atuais) => (atuais.length > limite ? atuais.slice(-limite) : atuais));
    }, [limite]);

    const abrir = useCallback(
        (conversaId: string, opcoes?: { minimizada?: boolean }) => {
            const minimizada = opcoes?.minimizada ?? false;

            setPopover(false);
            setBoxes((atuais) => {
                if (atuais.some((b) => b.conversaId === conversaId)) {
                    // já aberta: só expande se o pedido NÃO for minimizado (autoAbrir não fecha nada)
                    return minimizada ? atuais : atuais.map((b) => (b.conversaId === conversaId ? { ...b, minimizada: false } : b));
                }

                return [...atuais, { conversaId, minimizada }].slice(-limite);
            });
        },
        [limite],
    );

    const fechar = useCallback((conversaId: string) => {
        setBoxes((atuais) => atuais.filter((b) => b.conversaId !== conversaId));
    }, []);

    useEffect(() => {
        if (!queryParam || typeof window === 'undefined') return;

        const id = new URLSearchParams(window.location.search).get(queryParam);

        if (!id) return;

        void engine.entrarConversa(id).then(() => abrir(id));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queryParam]);

    useEffect(() => {
        if (!autoAbrir || !visivel) return;

        const comNaoLidas = conversas.find(
            (c) => (c.participante?.mensagens_nao_lidas ?? 0) > 0 && !estaVisivel(c.id),
        );

        if (comNaoLidas && !boxes.some((b) => b.conversaId === comNaoLidas.id)) {
            // MINIMIZADA: barra com badge — o painel só monta quando o utilizador clica.
            // Abrir expandida marcava a conversa como lida sem qualquer interação.
            abrir(comNaoLidas.id, { minimizada: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [versao, autoAbrir]);

    const naoLidas = conversas.reduce((soma, c) => soma + (c.participante?.mensagens_nao_lidas ?? 0), 0);

    return (
        <DockCtx.Provider value={{ abrir, fechar }}>
            {children}
            {visivel && (
            <div className="fixed bottom-0 right-4 z-[9500] flex items-end gap-3">
                {boxes.map((box) => {
                    const conversa = conversas.find((c) => c.id === box.conversaId);

                    return (
                        <div
                            key={box.conversaId}
                            className={`flex w-[336px] animate-maka-subir flex-col overflow-hidden rounded-t-2xl bg-[var(--maka-superficie)] shadow-maka-modal ring-1 ring-black/[.05] transition-[height] duration-200 ${box.minimizada ? 'h-12' : 'h-[480px]'}`}
                        >
                            {box.minimizada ? (
                                // minimizada: barra com título/não-lidas; aberta usa só o header do painel (header único)
                                <button
                                    className="flex w-full cursor-pointer items-center gap-2.5 border-0 bg-[var(--maka-primaria)] px-3 py-2 text-left text-[var(--maka-primaria-contraste)]"
                                    onClick={() => setBoxes((a) => a.map((b) => (b.conversaId === box.conversaId ? { ...b, minimizada: false } : b)))}
                                >
                                    <AvatarWeb nome={conversa?.titulo ?? '?'} url={conversa?.foto_url} tamanho={26} />
                                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{conversa?.titulo ?? 'Conversa'}</span>
                                    {(conversa?.participante?.mensagens_nao_lidas ?? 0) > 0 && (
                                        <span
                                            className="animate-maka-pulsar"
                                            style={{
                                                boxSizing: 'border-box',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                minWidth: 18,
                                                height: 18,
                                                padding: '0 4px',
                                                borderRadius: 999,
                                                background: '#dc2626',
                                                color: '#fff',
                                                fontSize: 10,
                                                fontWeight: 700,
                                                lineHeight: 1,
                                            }}
                                        >
                                            {(conversa?.participante?.mensagens_nao_lidas ?? 0) > 99 ? '99+' : conversa?.participante?.mensagens_nao_lidas}
                                        </span>
                                    )}
                                    <span
                                        className="grid h-6 w-6 place-items-center rounded-full transition-colors hover:bg-black/15"
                                        onClick={(e) => { e.stopPropagation(); fechar(box.conversaId); }}
                                    >
                                        <Icon icon="tabler:x" className="text-sm" />
                                    </span>
                                </button>
                            ) : (
                                <div className="min-h-0 flex-1">
                                    <ConversaPainel
                                        conversaId={box.conversaId}
                                        compacto
                                        aoAbrirOutraConversa={abrir}
                                        aoMinimizar={() => setBoxes((a) => a.map((b) => (b.conversaId === box.conversaId ? { ...b, minimizada: true } : b)))}
                                        aoFechar={() => fechar(box.conversaId)}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}

                <div className="relative z-[20] mb-4" data-maka-pop="dock-popover">
                    {popover && (
                        // z acima dos menus internos das boxes (z-[1..6]) — senão os popovers das bolhas atravessam a lista
                        <div className="absolute bottom-16 right-0 z-[20] flex h-[440px] max-h-[70vh] w-[330px] animate-maka-subir flex-col overflow-hidden rounded-2xl bg-[var(--maka-superficie)] shadow-maka-modal ring-1 ring-black/[.05]">
                            <MakaChatConversas onAbrirConversa={(c: Conversa) => abrir(c.id)} />
                        </div>
                    )}
                    <button
                        onClick={() => setPopover(!popover)}
                        aria-label="Mensagens"
                        /*
                         * O fundo e a sombra vêm de variáveis CSS e não de
                         * classes: é assim que uma app lhes mexe sem bifurcar o
                         * componente — pelo `tema` do provider, ou por CSS seu
                         * sobre `--maka-lancador-*`.
                         */
                        style={{
                            /*
                             * A cor lisa vem **antes** do gradiente de propósito.
                             *
                             * O gradiente e a sombra usam `color-mix`, que um
                             * browser antigo não conhece: aí a declaração
                             * `background` é descartada inteira e o botão ficaria
                             * **transparente** — invisível, sem erro nenhum, e a
                             * única porta para o chat naquele site. Com a cor
                             * lisa por baixo, o pior caso é o aspecto de antes.
                             */
                            backgroundColor: v.primaria,
                            background: v.lancadorFundo,
                            boxShadow: v.lancadorSombra,
                        }}
                        className="relative grid h-14 w-14 cursor-pointer place-items-center rounded-full border-0 text-2xl text-[var(--maka-primaria-contraste)] transition-transform hover:scale-105 active:scale-95"
                    >
                        {icone ?? <Icon icon="tabler:message-circle-filled" />}
                        {naoLidas > 0 && (
                            <span
                                className="animate-maka-pulsar"
                                style={{
                                    position: 'absolute',
                                    top: -6,
                                    right: -6,
                                    boxSizing: 'border-box',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minWidth: 18,
                                    height: 18,
                                    padding: '0 4px',
                                    borderRadius: 999,
                                    border: '2px solid var(--maka-primaria)',
                                    background: '#dc2626',
                                    color: '#fff',
                                    fontSize: 10,
                                    fontWeight: 700,
                                    lineHeight: 1,
                                }}
                            >
                                {naoLidas > 99 ? '99+' : naoLidas}
                            </span>
                        )}
                    </button>
                </div>
            </div>
            )}
        </DockCtx.Provider>
    );
}
