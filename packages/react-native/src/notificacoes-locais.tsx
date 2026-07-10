import { Mensagem } from '@hongayetu/makachat-core';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { obterNotifee } from './opcionais';
import { useMakaChat } from './provider';

/**
 * Notificações LOCAIS de mensagens recebidas pelo SOCKET (o hub só envia FCM
 * quando o destinatário está offline): dispara quando a conversa NÃO está
 * visível — utilizador noutra página — ou a app está em background com o
 * socket ainda vivo. Montar dentro do <MakaChatProvider>; sem @notifee
 * instalado é um no-op. O tap traz `data: { makachat: '1', conversa_id }` —
 * o router de push da app (notifee onForegroundEvent/getInitialNotification)
 * trata a navegação.
 *
 * Avatar: usa a foto do remetente (largeIcon + person.icon no estilo
 * MESSAGING do Android); sem foto usa `avatarPadrao` (URL) se fornecido,
 * senão o placeholder do sistema.
 */
export function NotificacoesLocais({ avatarPadrao }: { avatarPadrao?: string } = {}) {
    const { engine, subscreverMensagens, estaVisivel } = useMakaChat();

    useEffect(() => {
        const notifee = obterNotifee();

        if (!notifee?.displayNotification) return;

        return subscreverMensagens((mensagem: Mensagem) => {
            // a olhar para a conversa (ecrã visível + app ativa) → sem notificação
            if (estaVisivel(mensagem.conversa_id) && AppState.currentState === 'active') return;

            void (async () => {
                try {
                    const conversa = await engine.storage.obterConversa(mensagem.conversa_id);
                    const remetente = conversa?.participantes.find(
                        (p) => p.identidade_id === mensagem.remetente_identidade_id,
                    );
                    const grupo = conversa?.tipo === 'grupo';
                    const nomeRemetente = remetente?.nome ?? 'Alguém';
                    // grupo → título/avatar da conversa; privada → nome/foto do remetente
                    const titulo = grupo ? (conversa?.titulo ?? 'Grupo') : (nomeRemetente ?? conversa?.titulo ?? 'Nova mensagem');
                    const avatar = (grupo ? conversa?.foto_url : remetente?.foto_url) ?? avatarPadrao;

                    await notifee.createChannel({ id: 'makachat_mensagens', name: 'Mensagens', importance: 4 });
                    await notifee.displayNotification({
                        id: `mkm_${mensagem.conversa_id}`,
                        title: titulo,
                        body: grupo ? `${nomeRemetente}: ${previewDe(mensagem)}` : previewDe(mensagem),
                        data: { makachat: '1', conversa_id: mensagem.conversa_id },
                        android: {
                            channelId: 'makachat_mensagens',
                            smallIcon: 'ic_launcher',
                            // avatar circular estilo WhatsApp (URL remoto suportado)
                            ...(avatar ? { largeIcon: avatar, circularLargeIcon: true } : {}),
                            style: {
                                type: 4, // AndroidStyle.MESSAGING
                                person: { name: nomeRemetente, ...(avatar && !grupo ? { icon: avatar } : {}) },
                                ...(grupo ? { group: true, title: titulo } : {}),
                                messages: [
                                    {
                                        text: previewDe(mensagem),
                                        timestamp: Date.parse(mensagem.criada_em) || undefined,
                                        person: {
                                            name: nomeRemetente,
                                            ...(remetente?.foto_url ? { icon: remetente.foto_url } : {}),
                                        },
                                    },
                                ],
                            },
                            pressAction: { id: 'default' },
                        },
                        ios: {
                            // iOS: attachments exigem ficheiro local — avatar rico fica
                            // para a fase NSE; aqui vai título/corpo padrão
                        },
                    });
                } catch {
                    // sem canal/permissão — falha em silêncio
                }
            })();
        });
    }, [engine, subscreverMensagens, estaVisivel, avatarPadrao]);

    return null;
}

function previewDe(mensagem: Mensagem): string {
    if (mensagem.eliminada) return 'Mensagem eliminada';

    switch (mensagem.tipo) {
        case 'foto':
            return mensagem.conteudo ?? '📷 Foto';
        case 'video':
            return mensagem.conteudo ?? '🎥 Vídeo';
        case 'audio':
            return '🎤 Mensagem de voz';
        case 'ficheiro':
            return '📎 Ficheiro';
        case 'chamada':
            // registo de chamada (ex.: "Chamada de voz não atendida") — sem toque, é o correto
            return `📞 ${mensagem.conteudo ?? 'Chamada'}`;
        default:
            return mensagem.conteudo ?? 'Nova mensagem';
    }
}
