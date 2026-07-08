import {
    Ack,
    RespostaChamada,
    AlvoParticipante,
    Anexo,
    Conversa,
    CredenciaisSessao,
    FlagFuncionalidade,
    Mensagem,
    ObterToken,
} from './tipos';

export class ErroApi extends Error {
    constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message);
    }
}

/**
 * Cliente REST do makachat-server. Obtém/renova o token através do callback
 * `obterToken` fornecido pela app (que fala com o backend do próprio serviço).
 */
export class MakaApi {
    private credenciais: CredenciaisSessao | null = null;

    constructor(private readonly obterToken: ObterToken) {}

    async sessao(): Promise<CredenciaisSessao> {
        if (!this.credenciais) {
            this.credenciais = await this.obterToken();
        }

        return this.credenciais;
    }

    invalidarSessao(): void {
        this.credenciais = null;
    }

    private async pedir<T>(caminho: string, init?: RequestInit, tentativa = 0): Promise<T> {
        const { token, api_url } = await this.sessao();

        const resposta = await fetch(`${api_url}${caminho}`, {
            ...init,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...(init?.headers ?? {}),
            },
        });

        if (resposta.status === 401 && tentativa === 0) {
            this.invalidarSessao();

            return this.pedir<T>(caminho, init, 1);
        }

        const corpo = (await resposta.json().catch(() => ({}))) as Ack;

        if (!resposta.ok || corpo.estado === 'erro') {
            throw new ErroApi(corpo.texto ?? `Erro ${resposta.status}`, resposta.status);
        }

        return corpo as T;
    }

    listarConversas(opcoes?: { cursor?: string; arquivadas?: boolean; limite?: number; q?: string }) {
        const query = new URLSearchParams();

        if (opcoes?.cursor) query.set('cursor', opcoes.cursor);
        if (opcoes?.arquivadas) query.set('arquivadas', '1');
        if (opcoes?.limite) query.set('limite', String(opcoes.limite));
        if (opcoes?.q) query.set('q', opcoes.q);

        return this.pedir<{ conversas: Conversa[]; proximo_cursor: string | null }>(`/v1/conversas?${query}`);
    }

    obterConversa(conversaId: string) {
        return this.pedir<{ conversa: Conversa }>(`/v1/conversas/${conversaId}`);
    }

    criarPrivada(participante: AlvoParticipante) {
        return this.pedir<{ conversa: Conversa }>('/v1/conversas', {
            method: 'POST',
            body: JSON.stringify({ tipo: 'privada', participante }),
        });
    }

    criarGrupo(titulo: string, participantes: AlvoParticipante[]) {
        return this.pedir<{ conversa: Conversa }>('/v1/conversas', {
            method: 'POST',
            body: JSON.stringify({ tipo: 'grupo', titulo, participantes }),
        });
    }

    listarMensagens(conversaId: string, opcoes?: { antes_de?: string; limite?: number }) {
        const query = new URLSearchParams();

        if (opcoes?.antes_de) query.set('antes_de', opcoes.antes_de);
        if (opcoes?.limite) query.set('limite', String(opcoes.limite));

        return this.pedir<{ mensagens: Mensagem[]; proximo_cursor: string | null }>(
            `/v1/conversas/${conversaId}/mensagens?${query}`,
        );
    }

    pesquisarMensagens(conversaId: string, q: string) {
        return this.pedir<{ mensagens: Mensagem[] }>(
            `/v1/conversas/${conversaId}/mensagens/pesquisa?q=${encodeURIComponent(q)}`,
        );
    }

    atualizarGrupo(conversaId: string, dados: { titulo?: string; foto_url?: string | null }) {
        return this.pedir<{ conversa: Conversa }>(`/v1/conversas/${conversaId}`, {
            method: 'PATCH',
            body: JSON.stringify(dados),
        });
    }

    atualizarPreferencias(
        conversaId: string,
        dados: { arquivada?: boolean; fixada?: boolean; silenciada_ate?: string | null },
    ) {
        return this.pedir<{ conversa: Conversa }>(`/v1/conversas/${conversaId}/preferencias`, {
            method: 'PATCH',
            body: JSON.stringify(dados),
        });
    }

    adicionarParticipantes(conversaId: string, participantes: AlvoParticipante[]) {
        return this.pedir<{ conversa: Conversa }>(`/v1/conversas/${conversaId}/participantes`, {
            method: 'POST',
            body: JSON.stringify({ participantes }),
        });
    }

    removerParticipante(conversaId: string, identidadeId: string) {
        return this.pedir(`/v1/conversas/${conversaId}/participantes/${identidadeId}`, { method: 'DELETE' });
    }

    sairDaConversa(conversaId: string) {
        return this.pedir(`/v1/conversas/${conversaId}/sair`, { method: 'POST' });
    }

    eliminarConversa(conversaId: string) {
        return this.pedir(`/v1/conversas/${conversaId}`, { method: 'DELETE' });
    }

    marcarNaoLida(conversaId: string) {
        return this.pedir<{ mensagens_nao_lidas: number }>(`/v1/conversas/${conversaId}/nao-lida`, { method: 'POST' });
    }

    listarFeatures() {
        return this.pedir<{ features: FlagFuncionalidade[] }>('/v1/features');
    }

    criarMedia(dados: { tipo: string; mime?: string; nome_ficheiro?: string }) {
        return this.pedir<{ anexo_id: string; limite_bytes: number; upload: { metodo: string; url: string } }>(
            '/v1/media',
            { method: 'POST', body: JSON.stringify(dados) },
        );
    }

    async carregarMedia(upload: { metodo: string; url: string }, bytes: Blob | ArrayBuffer, mime?: string) {
        const { token } = await this.sessao();

        const resposta = await fetch(upload.url, {
            method: 'PUT',
            headers:
                upload.metodo === 'endpoint'
                    ? { Authorization: `Bearer ${token}`, 'Content-Type': mime ?? 'application/octet-stream' }
                    : { 'Content-Type': mime ?? 'application/octet-stream' },
            body: bytes as BodyInit,
        });

        if (!resposta.ok) {
            throw new ErroApi(`Upload falhou (${resposta.status})`, resposta.status);
        }
    }

    confirmarMedia(
        anexoId: string,
        meta?: { largura?: number; altura?: number; duracao_segundos?: number; blurhash?: string; duravel?: boolean },
    ) {
        return this.pedir<{ anexo: Anexo }>(`/v1/media/${anexoId}/confirmar`, {
            method: 'POST',
            body: JSON.stringify(meta ?? {}),
        });
    }

    iniciarChamada(conversaId: string, tipo: 'audio' | 'video') {
        return this.pedir<RespostaChamada>('/v1/chamadas', {
            method: 'POST',
            body: JSON.stringify({ conversa_id: conversaId, tipo }),
        });
    }

    atenderChamada(chamadaId: string) {
        return this.pedir<RespostaChamada>(`/v1/chamadas/${chamadaId}/atender`, { method: 'PATCH' });
    }

    rejeitarChamada(chamadaId: string) {
        return this.pedir<RespostaChamada>(`/v1/chamadas/${chamadaId}/rejeitar`, { method: 'PATCH' });
    }

    terminarChamada(chamadaId: string) {
        return this.pedir<RespostaChamada>(`/v1/chamadas/${chamadaId}/terminar`, { method: 'PATCH' });
    }

    obterContexto(conversaId: string) {
        return this.pedir<{ contexto: { titulo: string; subtitulo?: string; foto_url?: string | null; linhas?: string[] } | null }>(
            `/v1/conversas/${conversaId}/contexto`,
        );
    }

    registarDispositivo(dados: {
        plataforma: 'ios' | 'android' | 'web';
        fornecedor: 'fcm' | 'apns_voip' | 'webpush';
        token: string;
        token_voip?: string;
        versao_app?: string;
    }) {
        return this.pedir<{ segredo_resposta?: string }>('/v1/dispositivos', {
            method: 'POST',
            body: JSON.stringify(dados),
        });
    }
}
