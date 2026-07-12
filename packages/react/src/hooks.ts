import { Anexo, Conversa, DadosEnvioMensagem, Funcionalidade, Mensagem, Presenca, Typing } from '@hongayetu/makachat-core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMakaChat, useMakaChatOpcional } from './provider';

/** Re-renderiza quando o SyncEngine notifica uma nova versão do storage. */
/** Estado da ligação socket (true = online). */
export function useLigacao(): boolean {
    return useMakaChat().ligado;
}

/**
 * true só quando estamos desligados há mais de `atrasoMs` — evita falsos
 * positivos do banner "sem ligação" em reconexões normais (arranque, voltar
 * do background); desliga no instante em que a ligação volta.
 */
export function useSemLigacao(atrasoMs = 4000): boolean {
    const ligado = useLigacao();
    const [mostrar, setMostrar] = useState(false);

    useEffect(() => {
        if (ligado) {
            setMostrar(false);

            return;
        }

        const t = setTimeout(() => setMostrar(true), atrasoMs);

        return () => clearTimeout(t);
    }, [ligado, atrasoMs]);

    return mostrar;
}

export function useVersaoChat(): number {
    const { engine } = useMakaChat();
    const [versao, setVersao] = useState(engine.versaoAtual);

    useEffect(() => engine.subscrever(setVersao), [engine]);

    return versao;
}

export function useConversas(arquivadas = false): Conversa[] {
    const { engine } = useMakaChat();
    const versao = useVersaoChat();
    const [conversas, setConversas] = useState<Conversa[]>([]);

    useEffect(() => {
        let ativo = true;

        void engine.storage.listarConversas(arquivadas).then((lista) => {
            if (ativo) setConversas(lista);
        });

        return () => {
            ativo = false;
        };
    }, [engine, arquivadas, versao]);

    return conversas;
}

export function useMensagens(conversaId: string | null, limite = 50): Mensagem[] {
    const { engine } = useMakaChat();
    const versao = useVersaoChat();
    const [mensagens, setMensagens] = useState<Mensagem[]>([]);

    useEffect(() => {
        if (!conversaId) {
            setMensagens([]);

            return;
        }

        let ativo = true;

        void engine.storage.listarMensagens(conversaId, { limite }).then((lista) => {
            if (ativo) setMensagens(lista);
        });

        return () => {
            ativo = false;
        };
    }, [engine, conversaId, limite, versao]);

    return mensagens;
}

export function useEnviarMensagem(): (dados: DadosEnvioMensagem, anexosPreview?: Anexo[]) => Promise<Mensagem> {
    const { engine } = useMakaChat();

    return useCallback(
        (dados: DadosEnvioMensagem, anexosPreview?: Anexo[]) => engine.enviarMensagem(dados, anexosPreview),
        [engine],
    );
}

export function useTypingConversa(conversaId: string | null): Typing | null {
    const { subscreverTyping } = useMakaChat();
    const [typing, setTyping] = useState<Typing | null>(null);

    useEffect(() => {
        if (!conversaId) {
            return;
        }

        let temporizador: ReturnType<typeof setTimeout> | null = null;
        const cancelar = subscreverTyping((evento) => {
            if (evento.conversa_id !== conversaId) return;

            if (temporizador) clearTimeout(temporizador);

            if (evento.ativo) {
                setTyping(evento);
                // o emissor só manda true a cada ~3s — limpa sozinho se parar de escrever
                temporizador = setTimeout(() => setTyping(null), 4000);
            } else {
                setTyping(null);
            }
        });

        return () => {
            cancelar();

            if (temporizador) clearTimeout(temporizador);
        };
    }, [subscreverTyping, conversaId]);

    return typing;
}

export function usePresenca(identidadeId: string | null): Presenca | null {
    const { engine, subscreverPresenca } = useMakaChat();
    // estado inicial do engine (snapshot do connect) — não só eventos futuros
    const [presenca, setPresenca] = useState<Presenca | null>(identidadeId ? engine.presencaDe(identidadeId) : null);

    useEffect(() => {
        if (!identidadeId) {
            return;
        }

        setPresenca(engine.presencaDe(identidadeId));

        return subscreverPresenca((evento) => {
            if (evento.identidade_id === identidadeId) {
                setPresenca(evento);
            }
        });
    }, [engine, subscreverPresenca, identidadeId]);

    return presenca;
}

/** A UI esconde botões de funcionalidades desativadas para o serviço. */
export function useFuncionalidadeAtiva(funcionalidade: Funcionalidade, tipoConversa = '*'): boolean {
    const { features } = useMakaChat();

    const especifica = features.find((f) => f.funcionalidade === funcionalidade && f.tipo_conversa === tipoConversa);

    if (especifica) {
        return especifica.ativo;
    }

    return features.find((f) => f.funcionalidade === funcionalidade && f.tipo_conversa === '*')?.ativo ?? false;
}

/**
 * Reage a QUALQUER mensagem nova recebida, em qualquer página da app —
 * o servidor emite para a sala da identidade, não é preciso conversa aberta
 * nem UI de chat montada. Ex.: toasts próprios, badge na navbar, sons.
 */
export function useMensagemRecebida(handler: (mensagem: Mensagem) => void): void {
    const { subscreverMensagens } = useMakaChat();
    const ref = useRef(handler);
    ref.current = handler;

    useEffect(() => subscreverMensagens((m) => ref.current(m)), [subscreverMensagens]);
}

/** Total de mensagens não lidas em todas as conversas — badge global (navbar, título da página...). */
export function useTotalNaoLidas(): number {
    const { engine } = useMakaChat();
    const versao = useVersaoChat();
    const [total, setTotal] = useState(0);

    useEffect(() => {
        void engine.storage
            .listarConversas(false)
            .then((conversas) => setTotal(conversas.reduce((soma, c) => soma + (c.participante?.mensagens_nao_lidas ?? 0), 0)));
    }, [engine, versao]);

    return total;
}

/** Total de não lidas SEM exigir o provider — devolve 0 fora dele (badges em layouts). */
export function useTotalNaoLidasOpcional(): number {
    const contexto = useMakaChatOpcional();
    const engine = contexto?.engine ?? null;
    const [total, setTotal] = useState(0);

    useEffect(() => {
        if (!engine) {
            setTotal(0);

            return;
        }

        const atualizar = () =>
            void engine.storage
                .listarConversas(false)
                .then((conversas) => setTotal(conversas.reduce((soma, c) => soma + (c.participante?.mensagens_nao_lidas ?? 0), 0)));

        atualizar();

        return engine.subscrever(atualizar);
    }, [engine]);

    return total;
}
