import { Conversa } from '@hongayetu/makachat-core';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useConversas, useVersaoChat } from './hooks';
import { AvatarWeb, ConversaPainel, MakaChatConversas } from './ui';

// ---------------------------------------------------------------- BoxFull / BoxMin

/** Página inteira: ocupa o viewport todo e ignora o layout do site. */
export function MakaChatBoxFull() {
    return (
        <div className="fixed inset-0 z-[9000] bg-[var(--maka-fundo)]">
            <DuasColunas />
        </div>
    );
}

/** Preenche 100% do contentor onde for montado (ex.: área útil de um admin). */
export function MakaChatBoxMin() {
    return (
        <div className="h-full min-h-[420px] w-full overflow-hidden rounded-2xl bg-[var(--maka-fundo)] shadow-sm ring-1 ring-black/5">
            <DuasColunas />
        </div>
    );
}

function DuasColunas() {
    const [ativa, setAtiva] = useState<string | null>(null);
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
        <div ref={ref} className="flex h-full">
            {mostrarLista && (
                <div className={`h-full border-r border-slate-500/10 ${estreita ? 'w-full' : 'w-[340px] shrink-0'}`}>
                    <MakaChatConversas conversaAtivaId={ativa} onAbrirConversa={(c: Conversa) => setAtiva(c.id)} />
                </div>
            )}
            {mostrarPainel && (
                <div className="h-full min-w-0 flex-1">
                    {ativa ? (
                        <ConversaPainel conversaId={ativa} aoFechar={estreita ? () => setAtiva(null) : undefined} />
                    ) : (
                        <div className="grid h-full place-items-center">
                            <div className="flex flex-col items-center gap-3 text-[var(--maka-texto-suave)]">
                                <span className="grid h-16 w-16 place-items-center rounded-full bg-[var(--maka-superficie)] text-3xl shadow-sm">💬</span>
                                <span className="text-sm">Escolhe uma conversa para começar</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------- Dock (boxes múltiplas estilo Facebook)

interface DockApi {
    abrir(conversaId: string): void;
    fechar(conversaId: string): void;
}

const DockCtx = createContext<DockApi | null>(null);

export function useDock(): DockApi {
    const ctx = useContext(DockCtx);

    if (!ctx) throw new Error('useDock requer <MakaChatDock>');

    return ctx;
}

export interface MakaChatDockProps {
    /** abre uma box automaticamente quando chega mensagem nova (default true) */
    autoAbrir?: boolean;
    maxBoxes?: number;
    children?: React.ReactNode;
}

interface BoxAberta {
    conversaId: string;
    minimizada: boolean;
}

/**
 * Boxes múltiplas fixas no canto inferior direito: launcher com não lidas e
 * conversas recentes; boxes lado a lado, minimizáveis. Convive com BoxMin.
 */
export function MakaChatDock({ autoAbrir = true, maxBoxes = 3, children }: MakaChatDockProps) {
    const conversas = useConversas();
    const versao = useVersaoChat();
    const [boxes, setBoxes] = useState<BoxAberta[]>([]);
    const [popover, setPopover] = useState(false);

    const abrir = useCallback(
        (conversaId: string) => {
            setPopover(false);
            setBoxes((atuais) => {
                if (atuais.some((b) => b.conversaId === conversaId)) {
                    return atuais.map((b) => (b.conversaId === conversaId ? { ...b, minimizada: false } : b));
                }

                return [...atuais, { conversaId, minimizada: false }].slice(-maxBoxes);
            });
        },
        [maxBoxes],
    );

    const fechar = useCallback((conversaId: string) => {
        setBoxes((atuais) => atuais.filter((b) => b.conversaId !== conversaId));
    }, []);

    useEffect(() => {
        if (!autoAbrir) return;

        const comNaoLidas = conversas.find((c) => (c.participante?.mensagens_nao_lidas ?? 0) > 0);

        if (comNaoLidas && !boxes.some((b) => b.conversaId === comNaoLidas.id)) {
            abrir(comNaoLidas.id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [versao, autoAbrir]);

    const naoLidas = conversas.reduce((soma, c) => soma + (c.participante?.mensagens_nao_lidas ?? 0), 0);

    return (
        <DockCtx.Provider value={{ abrir, fechar }}>
            {children}
            <div className="fixed bottom-0 right-4 z-[9500] flex items-end gap-3">
                {boxes.map((box) => {
                    const conversa = conversas.find((c) => c.id === box.conversaId);

                    return (
                        <div
                            key={box.conversaId}
                            className={`flex w-[336px] animate-maka-subir flex-col overflow-hidden rounded-t-2xl bg-[var(--maka-superficie)] shadow-2xl ring-1 ring-black/10 transition-[height] duration-200 ${box.minimizada ? 'h-12' : 'h-[480px]'}`}
                        >
                            <button
                                className="flex w-full cursor-pointer items-center gap-2.5 border-0 bg-[var(--maka-primaria)] px-3 py-2 text-left text-[var(--maka-primaria-contraste)]"
                                onClick={() => setBoxes((a) => a.map((b) => (b.conversaId === box.conversaId ? { ...b, minimizada: !b.minimizada } : b)))}
                            >
                                <AvatarWeb nome={conversa?.titulo ?? '?'} url={conversa?.foto_url} tamanho={26} />
                                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{conversa?.titulo ?? 'Conversa'}</span>
                                <span
                                    className="grid h-6 w-6 place-items-center rounded-full transition-colors hover:bg-black/15"
                                    onClick={(e) => { e.stopPropagation(); fechar(box.conversaId); }}
                                >
                                    ✕
                                </span>
                            </button>
                            {!box.minimizada && (
                                <div className="min-h-0 flex-1">
                                    <ConversaPainel conversaId={box.conversaId} compacto />
                                </div>
                            )}
                        </div>
                    );
                })}

                <div className="relative mb-4">
                    {popover && (
                        <div className="absolute bottom-16 right-0 flex max-h-[420px] w-[320px] animate-maka-subir flex-col overflow-hidden rounded-2xl bg-[var(--maka-superficie)] shadow-2xl ring-1 ring-black/10">
                            <div className="px-4 py-3 text-[15px] font-bold text-[var(--maka-texto)]">Mensagens</div>
                            <div className="maka-scroll flex-1 overflow-auto">
                                <MakaChatConversas onAbrirConversa={(c: Conversa) => abrir(c.id)} />
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => setPopover(!popover)}
                        className="relative grid h-14 w-14 cursor-pointer place-items-center rounded-full border-0 bg-[var(--maka-primaria)] text-2xl text-[var(--maka-primaria-contraste)] shadow-xl transition-transform hover:scale-105 active:scale-95"
                    >
                        💬
                        {naoLidas > 0 && (
                            <span className="absolute -right-1 -top-1 animate-maka-pulsar rounded-full bg-red-600 px-1.5 py-px text-[11px] font-bold text-white">
                                {naoLidas}
                            </span>
                        )}
                    </button>
                </div>
            </div>
        </DockCtx.Provider>
    );
}
