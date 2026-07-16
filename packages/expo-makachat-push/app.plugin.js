// o plugin vive fora da árvore da app (repo irmão) — resolve o config-plugins
// a partir da APP (cwd do prebuild), não do makachat-js
function carregarConfigPlugins() {
    const candidatos = ['expo/config-plugins', '@expo/config-plugins'];

    for (const nome of candidatos) {
        try {
            return require(nome);
        } catch {
            try {
                return require(require.resolve(nome, { paths: [process.cwd()] }));
            } catch {
                // tenta o próximo
            }
        }
    }

    throw new Error('expo-makachat-push: não foi possível resolver expo/config-plugins a partir da app');
}


const { withAndroidManifest, withInfoPlist, AndroidConfig } = carregarConfigPlugins();

/**
 * Config plugin do expo-makachat-push — serviços OPCIONAIS de chamada.
 *
 *   ["@hongayetu/expo-makachat-push", { "chamadas": {
 *       "toqueContinuo": true,       // toque em loop até atender (ToqueChamadaService)
 *       "ecraNativo": true,          // ecrã de chamada sobre o lockscreen (EcraChamadaActivity)
 *       "servicoChamadaAtiva": true, // chamada em curso viva em background (ChamadaAtivaService)
 *       "partilhaEcra": true         // partilha de ecrã (FGS mediaProjection do react-native-webrtc, API 34+)
 *   } }]
 *
 * Por omissão TUDO desligado: sem opções, nenhuma permissão/serviço novo entra
 * no APK e o comportamento base (notificação CallStyle) mantém-se. Cada flag
 * injeta as permissões + declarações + um <meta-data> que o Kotlin lê em runtime.
 */
module.exports = function withMakachatPush(config, opcoes = {}) {
    // iOS: modos de background sempre — VoIP (PushKit acorda a app p/ o CallKit),
    // audio (chamada em curso) e remote-notification. Independente das flags Android.
    config = withInfoPlist(config, (config) => {
        const modos = new Set(config.modResults.UIBackgroundModes ?? []);
        modos.add('voip');
        modos.add('audio');
        modos.add('remote-notification');
        config.modResults.UIBackgroundModes = [...modos];

        return config;
    });

    const chamadas = opcoes.chamadas ?? {};
    const toqueContinuo = chamadas.toqueContinuo === true;
    const ecraNativo = chamadas.ecraNativo === true;
    const servicoChamadaAtiva = chamadas.servicoChamadaAtiva === true;
    const partilhaEcra = chamadas.partilhaEcra === true;

    if (!toqueContinuo && !ecraNativo && !servicoChamadaAtiva && !partilhaEcra) {
        return config; // opt-in: sem opções, manifest intocado
    }

    return withAndroidManifest(config, (config) => {
        const manifesto = config.modResults;
        const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifesto);

        // ---- permissões (só as exigidas pelas flags ligadas) ----
        const permissoes = new Set(['android.permission.FOREGROUND_SERVICE', 'android.permission.VIBRATE', 'android.permission.WAKE_LOCK', 'android.permission.USE_FULL_SCREEN_INTENT']);

        if (toqueContinuo || servicoChamadaAtiva) {
            permissoes.add('android.permission.FOREGROUND_SERVICE_PHONE_CALL');
            // API 34+: o tipo phoneCall exige MANAGE_OWN_CALLS (permissão normal,
            // concedida na instalação) — sem ela o startForeground rebenta
            permissoes.add('android.permission.MANAGE_OWN_CALLS');
        }
        if (servicoChamadaAtiva) permissoes.add('android.permission.FOREGROUND_SERVICE_MICROPHONE');
        // API 34+ (targetSDK 34+): o MediaProjectionService do react-native-webrtc
        // rebenta com SecurityException sem esta permissão ao partilhar o ecrã
        if (partilhaEcra) permissoes.add('android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION');

        manifesto.manifest['uses-permission'] = manifesto.manifest['uses-permission'] ?? [];

        for (const nome of permissoes) {
            if (!manifesto.manifest['uses-permission'].some((p) => p.$['android:name'] === nome)) {
                manifesto.manifest['uses-permission'].push({ $: { 'android:name': nome } });
            }
        }

        // ---- meta-data (flags lidas pelo Kotlin via Opcoes.kt) ----
        const metas = [
            ['makachat_toque_continuo', toqueContinuo],
            ['makachat_ecra_nativo', ecraNativo],
            ['makachat_chamada_ativa', servicoChamadaAtiva],
        ];

        app['meta-data'] = app['meta-data'] ?? [];

        for (const [nome, valor] of metas) {
            if (!valor) continue;

            const existente = app['meta-data'].find((m) => m.$['android:name'] === nome);

            if (existente) existente.$['android:value'] = 'true';
            else app['meta-data'].push({ $: { 'android:name': nome, 'android:value': 'true' } });
        }

        // ---- serviços/activity (classes vivem na lib; declarar na app é válido) ----
        app.service = app.service ?? [];
        app.activity = app.activity ?? [];

        const garantirServico = (nome, tipoForeground) => {
            if (app.service.some((s) => s.$['android:name'] === nome)) return;

            app.service.push({
                $: {
                    'android:name': nome,
                    'android:exported': 'false',
                    'android:foregroundServiceType': tipoForeground,
                },
            });
        };

        if (toqueContinuo) {
            garantirServico('expo.modules.makachatpush.ToqueChamadaService', 'phoneCall');
        }

        if (servicoChamadaAtiva) {
            garantirServico('expo.modules.makachatpush.ChamadaAtivaService', 'phoneCall|microphone');
        }

        // declarada SEMPRE: o botão Atender da notificação usa esta activity como
        // trampolim (para o toque + persiste 'atender' + abre a app), com ou sem ecraNativo
        if (!app.activity.some((a) => a.$['android:name'] === 'expo.modules.makachatpush.EcraChamadaActivity')) {
            app.activity.push({
                $: {
                    'android:name': 'expo.modules.makachatpush.EcraChamadaActivity',
                    'android:exported': 'false',
                    'android:launchMode': 'singleTop',
                    'android:showWhenLocked': 'true',
                    'android:turnScreenOn': 'true',
                    'android:taskAffinity': '',
                    'android:excludeFromRecents': 'true',
                },
            });
        }

        return config;
    });
};
