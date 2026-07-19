import { HubApi, CredenciaisSessao } from '@hongayetu/honga-hub-core';
import {
    AlvoParticipante,
    Anexo,
    Conversa,
    FlagFuncionalidade,
    Mensagem,
    MensagemLink,
    ReciboParticipante,
    RespostaChamada,
} from './tipos';

export { ErroApi } from '@hongayetu/honga-hub-core';

/**
 * O hub valida os alvos com rigor (`nome` não-vazio, `foto` URL absoluto) —
 * as apps alimentam alvos com avatares relativos/vazios e nomes em branco,
 * por isso limpamos aqui em vez de rebentar com "Payload inválido".
 */
function limparAlvo(alvo: AlvoParticipante): AlvoParticipante {
    const nome = alvo.nome?.trim();
    const foto = alvo.foto?.trim();

    return {
        id_externo: String(alvo.id_externo),
        tipo: alvo.tipo,
        ...(nome ? { nome } : {}),
        ...(foto && /^https?:\/\//i.test(foto) ? { foto } : {}),
    };
}

/**
 * Cliente REST do módulo CHAT. Compõe sobre o {@link HubApi} genérico
 * (sessão/token/`pedir`) e acrescenta os endpoints de chat. Delega
 * `sessao`/`invalidarSessao`/`pedir` para manter compatibilidade com quem
 * usava o antigo MakaApi. Uma app sem chat nunca instancia isto.
 */
export class MakaApi {
    constructor(private readonly hub: HubApi) {}

    sessao(): Promise<CredenciaisSessao> {
        return this.hub.sessao();
    }

    invalidarSessao(): void {
        this.hub.invalidarSessao();
    }

    pedir<T>(caminho: string, init?: RequestInit): Promise<T> {
        return this.hub.pedir<T>(caminho, init);
    }

    registarDispositivo(dados: Parameters<HubApi['registarDispositivo']>[0]) {
        return this.hub.registarDispositivo(dados);
    }

    removerDispositivo(token: string) {
        return this.hub.removerDispositivo(token);
    }

    listarConversas(opcoes?: { cursor?: string; arquivadas?: boolean; limite?: number; q?: string }) {
        const query = new URLSearchParams();

        if (opcoes?.cursor) query.set('cursor', opcoes.cursor);
        if (opcoes?.arquivadas) query.set('arquivadas', '1');
        if (opcoes?.limite) query.set('limite', String(opcoes.limite));
        if (opcoes?.q) query.set('q', opcoes.q);

        return this.hub.pedir<{ conversas: Conversa[]; proximo_cursor: string | null }>(`/v1/chat/conversas?${query}`);
    }

    obterConversa(conversaId: string) {
        return this.hub.pedir<{ conversa: Conversa }>(`/v1/chat/conversas/${conversaId}`);
    }

    criarPrivada(participante: AlvoParticipante) {
        return this.hub.pedir<{ conversa: Conversa }>('/v1/chat/conversas', {
            method: 'POST',
            body: JSON.stringify({ tipo: 'privada', participante: limparAlvo(participante) }),
        });
    }

    criarGrupo(titulo: string, participantes: AlvoParticipante[]) {
        return this.hub.pedir<{ conversa: Conversa }>('/v1/chat/conversas', {
            method: 'POST',
            body: JSON.stringify({ tipo: 'grupo', titulo, participantes: participantes.map(limparAlvo) }),
        });
    }

    /** Media da conversa por tipo — tabs da info (Fotos/Ficheiros/Áudios/Links). */
    listarMedia(conversaId: string, tipo: 'fotos' | 'videos' | 'audios' | 'ficheiros' | 'links', opcoes?: { antes_de?: string; limite?: number }) {
        const query = new URLSearchParams({ tipo });

        if (opcoes?.antes_de) query.set('antes_de', opcoes.antes_de);
        if (opcoes?.limite) query.set('limite', String(opcoes.limite));

        return this.hub.pedir<{ anexos?: (Anexo & { mensagem_id: string })[]; links?: MensagemLink[] }>(
            `/v1/chat/conversas/${conversaId}/media?${query.toString()}`,
        );
    }

    /** Relatório de entrega de uma mensagem (grupos): quem entregou / quem viu. */
    recibosDaMensagem(conversaId: string, mensagemId: string) {
        return this.hub.pedir<{ recibos: ReciboParticipante[] }>(`/v1/chat/conversas/${conversaId}/mensagens/${mensagemId}/recibos`);
    }

    listarMensagens(conversaId: string, opcoes?: { antes_de?: string; limite?: number }) {
        const query = new URLSearchParams();

        if (opcoes?.antes_de) query.set('antes_de', opcoes.antes_de);
        if (opcoes?.limite) query.set('limite', String(opcoes.limite));

        return this.hub.pedir<{ mensagens: Mensagem[]; proximo_cursor: string | null }>(
            `/v1/chat/conversas/${conversaId}/mensagens?${query}`,
        );
    }

    pesquisarMensagens(conversaId: string, q: string) {
        return this.hub.pedir<{ mensagens: Mensagem[] }>(
            `/v1/chat/conversas/${conversaId}/mensagens/pesquisa?q=${encodeURIComponent(q)}`,
        );
    }

    atualizarGrupo(conversaId: string, dados: { titulo?: string; foto_url?: string | null }) {
        return this.hub.pedir<{ conversa: Conversa }>(`/v1/chat/conversas/${conversaId}`, {
            method: 'PATCH',
            body: JSON.stringify(dados),
        });
    }

    atualizarPreferencias(
        conversaId: string,
        dados: { arquivada?: boolean; fixada?: boolean; silenciada_ate?: string | null },
    ) {
        return this.hub.pedir<{ conversa: Conversa }>(`/v1/chat/conversas/${conversaId}/preferencias`, {
            method: 'PATCH',
            body: JSON.stringify(dados),
        });
    }

    adicionarParticipantes(conversaId: string, participantes: AlvoParticipante[]) {
        return this.hub.pedir<{ conversa: Conversa }>(`/v1/chat/conversas/${conversaId}/participantes`, {
            method: 'POST',
            body: JSON.stringify({ participantes }),
        });
    }

    /** Promove/despromove um membro do grupo (papel do dono é intocável). */
    mudarPapel(conversaId: string, identidadeId: string, papel: 'admin' | 'membro') {
        return this.hub.pedir<{ conversa: Conversa }>(`/v1/chat/conversas/${conversaId}/participantes/${identidadeId}/papel`, {
            method: 'PATCH',
            body: JSON.stringify({ papel }),
        });
    }

    removerParticipante(conversaId: string, identidadeId: string) {
        return this.hub.pedir(`/v1/chat/conversas/${conversaId}/participantes/${identidadeId}`, { method: 'DELETE' });
    }

    sairDaConversa(conversaId: string) {
        return this.hub.pedir(`/v1/chat/conversas/${conversaId}/sair`, { method: 'POST' });
    }

    eliminarConversa(conversaId: string) {
        return this.hub.pedir(`/v1/chat/conversas/${conversaId}`, { method: 'DELETE' });
    }

    marcarNaoLida(conversaId: string) {
        return this.hub.pedir<{ mensagens_nao_lidas: number }>(`/v1/chat/conversas/${conversaId}/nao-lida`, { method: 'POST' });
    }

    listarFeatures() {
        return this.hub.pedir<{ features: FlagFuncionalidade[] }>('/v1/features');
    }

    criarMedia(dados: { tipo: string; mime?: string; nome_ficheiro?: string }) {
        return this.hub.pedir<{ anexo_id: string; limite_bytes: number; upload: { metodo: string; url: string } }>(
            '/v1/chat/media',
            { method: 'POST', body: JSON.stringify(dados) },
        );
    }

    async carregarMedia(upload: { metodo: string; url: string }, bytes: Blob | ArrayBuffer, mime?: string) {
        const { token } = await this.hub.sessao();

        const resposta = await fetch(upload.url, {
            method: 'PUT',
            headers:
                upload.metodo === 'endpoint'
                    ? { Authorization: `Bearer ${token}`, 'Content-Type': mime ?? 'application/octet-stream' }
                    : { 'Content-Type': mime ?? 'application/octet-stream' },
            body: bytes as BodyInit,
        });

        if (!resposta.ok) {
            throw new Error(`Upload falhou (${resposta.status})`);
        }
    }

    confirmarMedia(
        anexoId: string,
        meta?: { largura?: number; altura?: number; duracao_segundos?: number; blurhash?: string; duravel?: boolean },
    ) {
        return this.hub.pedir<{ anexo: Anexo }>(`/v1/chat/media/${anexoId}/confirmar`, {
            method: 'POST',
            body: JSON.stringify(meta ?? {}),
        });
    }

    iniciarChamada(conversaId: string, tipo: 'audio' | 'video') {
        return this.hub.pedir<RespostaChamada>('/v1/chat/chamadas', {
            method: 'POST',
            body: JSON.stringify({ conversa_id: conversaId, tipo }),
        });
    }

    atenderChamada(chamadaId: string) {
        return this.hub.pedir<RespostaChamada>(`/v1/chat/chamadas/${chamadaId}/atender`, { method: 'PATCH' });
    }

    /** O destinatário avisa que está A TOCAR → o autor passa de "A ligar…" a "A chamar…". */
    chamadaATocar(chamadaId: string) {
        return this.hub.pedir<{ estado: string }>(`/v1/chat/chamadas/${chamadaId}/a-tocar`, { method: 'PATCH' });
    }

    rejeitarChamada(chamadaId: string) {
        return this.hub.pedir<RespostaChamada>(`/v1/chat/chamadas/${chamadaId}/rejeitar`, { method: 'PATCH' });
    }

    terminarChamada(chamadaId: string) {
        return this.hub.pedir<RespostaChamada>(`/v1/chat/chamadas/${chamadaId}/terminar`, { method: 'PATCH' });
    }

    obterContexto(conversaId: string) {
        return this.hub.pedir<{ contexto: { titulo: string; subtitulo?: string; foto_url?: string | null; linhas?: string[] } | null }>(
            `/v1/chat/conversas/${conversaId}/contexto`,
        );
    }
}
