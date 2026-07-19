import { Ack, CredenciaisSessao, ObterToken } from './tipos';

export class ErroApi extends Error {
    constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message);
    }
}

/**
 * Cliente REST GENÉRICO do Honga Hub. Obtém/renova o token através do callback
 * `obterToken` fornecido pela app (que fala com o backend do próprio serviço) e
 * expõe `pedir()` para as camadas de módulo (ex.: chat) fazerem pedidos
 * autenticados. Só trata de sessão + registo de dispositivos push (transversal);
 * os endpoints de chat vivem em @hongayetu/makachat-core (ChatApi).
 */
export class HubApi {
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

    async pedir<T>(caminho: string, init?: RequestInit, tentativa = 0): Promise<T> {
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

    /** Remove o token push desta identidade (logout). 1 identidade pode ter N tokens. */
    removerDispositivo(token: string) {
        return this.pedir<{ removido: boolean }>('/v1/dispositivos', {
            method: 'DELETE',
            body: JSON.stringify({ token }),
        });
    }
}
