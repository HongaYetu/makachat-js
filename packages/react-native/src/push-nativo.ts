import { IdentidadeConfig, MakaApi } from '@hongayetu/makachat-core';
import { obterPushMakaChat } from './opcionais';

/**
 * Regista o dispositivo no MakaChat e liga a resposta ao vivo da notificação
 * (Android): o registo devolve um segredo que o serviço nativo usa para
 * enviar respostas com a app fechada (POST /v1/push/resposta).
 *
 * Chamar depois do login, com o token FCM da app:
 *   await ligarPushNativo(api, identidade, tokenFcm);
 */
export async function ligarPushNativo(
    api: MakaApi,
    identidade: IdentidadeConfig,
    tokenFcm: string,
    plataforma: 'android' | 'ios' = 'android',
): Promise<boolean> {
    const push = obterPushMakaChat();

    if (!push?.configurarResposta) return false;

    const registo = await api.registarDispositivo({ plataforma, fornecedor: 'fcm', token: tokenFcm });

    if (!registo?.segredo_resposta) return false;

    const sessao = await api.sessao();

    push.configurarResposta({
        api_url: sessao.api_url,
        token: tokenFcm,
        segredo: registo.segredo_resposta,
        meu_nome: identidade.nome,
    });

    return true;
}
