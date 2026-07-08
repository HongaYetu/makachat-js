/**
 * Notificações nativas do browser — permitem avisar o utilizador de mensagens
 * e chamadas mesmo quando está noutra página/tab (o provider continua montado
 * no layout, ou a página está em background).
 */

export function notificacoesSuportadas(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
}

/** Pede permissão ao utilizador (chamar num gesto: clique/tap). */
export async function pedirPermissaoNotificacoes(): Promise<boolean> {
    if (!notificacoesSuportadas()) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;

    return (await Notification.requestPermission()) === 'granted';
}

/** Mostra uma notificação se houver permissão; clique foca a janela. */
export function mostrarNotificacao(
    titulo: string,
    opcoes: { corpo?: string; icone?: string; tag?: string },
    aoClicar?: () => void,
): void {
    if (!notificacoesSuportadas() || Notification.permission !== 'granted') return;

    try {
        const n = new Notification(titulo, {
            body: opcoes.corpo,
            icon: opcoes.icone ?? undefined,
            tag: opcoes.tag,
        });

        n.onclick = () => {
            window.focus();
            aoClicar?.();
            n.close();
        };
    } catch {
        // alguns browsers móveis exigem Service Worker — falha silenciosa
    }
}
