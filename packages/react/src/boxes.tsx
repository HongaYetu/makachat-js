import { Conversa } from '@hongayetu/makachat-core';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useConversas, useVersaoChat } from './hooks';
import { useMakaChat } from './provider';
import { v } from './tema';
import { AvatarWeb, ConversaPainel, MakaChatConversas } from './ui';

// ---------------------------------------------------------------- BoxFull / BoxMin

/** Página inteira: ocupa o viewport todo e ignora o layout do site. */
export function MakaChatBoxFull() {
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: v.fundo }}>
            <DuasColunas />
        </div>
    );
}

/** Preenche 100% do contentor onde for montado (ex.: área útil de um admin). */
export function MakaChatBoxMin() {
    return (
        <div style={{ width: '100%', height: '100%', minHeight: 420, background: v.fundo, borderRadius: 12, overflow: 'hidden' }}>
            <DuasColunas />
        </div>
    );
}

function DuasColunas() {
    const [ativa, setAtiva] = useState<string | null>(null);
    const [larguraEstreita, setEstreita] = useState(false);
    const ref = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;

        if (!el) return;

        const obs = new ResizeObserver(() => setEstreita(el.clientWidth < 640));
        obs.observe(el);

        return () => obs.disconnect();
    }, []);

    const mostrarLista = !larguraEstreita || !ativa;
    const mostrarPainel = !larguraEstreita || !!ativa;

    return (
        <div ref={ref} style={{ display: 'flex', height: '100%' }}>
            {mostrarLista && (
                <div style={{ width: larguraEstreita ? '100%' : 340, borderRight: '1px solid rgba(100,116,139,.15)', height: '100%' }}>
                    <MakaChatConversas conversaAtivaId={ativa} onAbrirConversa={(c: Conversa) => setAtiva(c.id)} />
                </div>
            )}
            {mostrarPainel && (
                <div style={{ flex: 1, height: '100%', minWidth: 0 }}>
                    {ativa ? (
                        <ConversaPainel conversaId={ativa} aoFechar={larguraEstreita ? () => setAtiva(null) : undefined} />
                    ) : (
                        <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: v.textoSuave }}>
                            Escolhe uma conversa
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
    const { engine } = useMakaChat();
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

    // auto-abrir quando chega mensagem de conversa com não lidas e sem box
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
            <div style={{ position: 'fixed', bottom: 0, right: 16, display: 'flex', alignItems: 'flex-end', gap: 10, zIndex: 9500 }}>
                {boxes.map((box) => {
                    const conversa = conversas.find((c) => c.id === box.conversaId);

                    return (
                        <div key={box.conversaId} style={{ width: 330, background: v.superficie, borderRadius: '14px 14px 0 0', boxShadow: '0 4px 24px rgba(0,0,0,.22)', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: box.minimizada ? 44 : 460 }}>
                            <div
                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: v.primaria, color: v.primariaContraste, cursor: 'pointer' }}
                                onClick={() => setBoxes((a) => a.map((b) => (b.conversaId === box.conversaId ? { ...b, minimizada: !b.minimizada } : b)))}
                            >
                                <AvatarWeb nome={conversa?.titulo ?? '?'} url={conversa?.foto_url} tamanho={24} />
                                <span style={{ flex: 1, fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{conversa?.titulo ?? 'Conversa'}</span>
                                <span style={{ cursor: 'pointer', padding: '0 4px' }} onClick={(e) => { e.stopPropagation(); fechar(box.conversaId); }}>✕</span>
                            </div>
                            {!box.minimizada && (
                                <div style={{ flex: 1, minHeight: 0 }}>
                                    <ConversaPainel conversaId={box.conversaId} compacto />
                                </div>
                            )}
                        </div>
                    );
                })}

                <div style={{ position: 'relative', marginBottom: 16 }}>
                    {popover && (
                        <div style={{ position: 'absolute', bottom: 66, right: 0, width: 320, maxHeight: 420, background: v.superficie, borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '10px 14px', fontWeight: 700, color: v.texto }}>Mensagens</div>
                            <div style={{ flex: 1, overflow: 'auto' }}>
                                <MakaChatConversas onAbrirConversa={(c: Conversa) => abrir(c.id)} />
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => setPopover(!popover)}
                        style={{ width: 54, height: 54, borderRadius: '50%', border: 'none', background: v.primaria, color: v.primariaContraste, fontSize: 22, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,.25)', position: 'relative' }}
                    >
                        💬
                        {naoLidas > 0 && (
                            <span style={{ position: 'absolute', top: -4, right: -4, background: '#dc2626', color: '#fff', borderRadius: 999, fontSize: 11, fontWeight: 700, padding: '1px 6px' }}>{naoLidas}</span>
                        )}
                    </button>
                </div>
            </div>
        </DockCtx.Provider>
    );
}
