import { Conversa, DadosEnvioMensagem, Funcionalidade, Mensagem, Presenca, Typing } from '@hongayetu/makachat-core';
import { useCallback, useEffect, useState } from 'react';
import { useMakaChat } from './provider';

/** Re-renderiza quando o SyncEngine notifica uma nova versão do storage. */
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

export function useEnviarMensagem(): (dados: DadosEnvioMensagem) => Promise<Mensagem> {
    const { engine } = useMakaChat();

    return useCallback((dados: DadosEnvioMensagem) => engine.enviarMensagem(dados), [engine]);
}

export function useTypingConversa(conversaId: string | null): Typing | null {
    const { subscreverTyping } = useMakaChat();
    const [typing, setTyping] = useState<Typing | null>(null);

    useEffect(() => {
        if (!conversaId) {
            return;
        }

        return subscreverTyping((evento) => {
            if (evento.conversa_id === conversaId) {
                setTyping(evento.ativo ? evento : null);
            }
        });
    }, [subscreverTyping, conversaId]);

    return typing;
}

export function usePresenca(identidadeId: string | null): Presenca | null {
    const { subscreverPresenca } = useMakaChat();
    const [presenca, setPresenca] = useState<Presenca | null>(null);

    useEffect(() => {
        if (!identidadeId) {
            return;
        }

        return subscreverPresenca((evento) => {
            if (evento.identidade_id === identidadeId) {
                setPresenca(evento);
            }
        });
    }, [subscreverPresenca, identidadeId]);

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
