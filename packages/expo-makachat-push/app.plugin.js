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


const { withAndroidManifest, withInfoPlist, withEntitlementsPlist, withXcodeProject, withDangerousMod, AndroidConfig } = carregarConfigPlugins();
const fs = require('fs');
const path = require('path');

const NSE_NOME = 'MakachatNSE';

/**
 * Cria a pasta ios/MakachatNSE com os fontes da extensão: template do
 * NotificationService com o App Group substituído, InboxDatabase do módulo,
 * Info.plist e entitlements (App Group + Communication Notifications).
 * Sobrevive a `prebuild --clean` — é regenerada a cada prebuild.
 */
function escreverFontesNse(projectRoot, appGroup) {
    const destino = path.join(projectRoot, 'ios', NSE_NOME);
    fs.mkdirSync(destino, { recursive: true });

    const servico = fs
        .readFileSync(path.join(__dirname, 'nse-source', 'NotificationService.swift'), 'utf8')
        .replace('group.com.hongayetu.SUBSTITUIR', appGroup);
    fs.writeFileSync(path.join(destino, 'NotificationService.swift'), servico);

    fs.copyFileSync(
        path.join(__dirname, 'ios', 'InboxDatabase.swift'),
        path.join(destino, 'InboxDatabase.swift'),
    );

    fs.writeFileSync(
        path.join(destino, `${NSE_NOME}-Info.plist`),
        `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key><string>$(DEVELOPMENT_LANGUAGE)</string>
    <key>CFBundleDisplayName</key><string>${NSE_NOME}</string>
    <key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
    <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
    <key>CFBundleName</key><string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key><string>XPC!</string>
    <key>CFBundleShortVersionString</key><string>$(MARKETING_VERSION)</string>
    <key>CFBundleVersion</key><string>$(CURRENT_PROJECT_VERSION)</string>
    <key>NSExtension</key>
    <dict>
        <key>NSExtensionPointIdentifier</key><string>com.apple.usernotifications.service</string>
        <key>NSExtensionPrincipalClass</key><string>$(PRODUCT_MODULE_NAME).NotificationService</string>
    </dict>
</dict>
</plist>
`,
    );

    fs.writeFileSync(
        path.join(destino, `${NSE_NOME}.entitlements`),
        `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.application-groups</key>
    <array><string>${appGroup}</string></array>
</dict>
</plist>
`,
    );
}

/**
 * Injeta o target da NSE no .pbxproj (grupo, target app_extension, build
 * phases e build settings). Idempotente — se o target já existe, não faz nada.
 */
function injetarTargetNse(xcodeProject, { bundleId, team, marketingVersion, buildNumber }) {
    // idempotência por nome real do target (o pbxTargetByName procura por
    // comentário e falha com nomes quoted — duplicaria a cada prebuild)
    const targets = xcodeProject.hash.project.objects.PBXNativeTarget || {};
    const jaExiste = Object.keys(targets).some(
        (chave) => !chave.includes('_comment') && String(targets[chave]?.name ?? '').replace(/"/g, '') === NSE_NOME,
    );

    if (jaExiste) {
        return;
    }

    // o addTarget do xcode rebenta sem estas secções em projetos sem targets extra
    const objetos = xcodeProject.hash.project.objects;
    objetos.PBXTargetDependency = objetos.PBXTargetDependency || {};
    objetos.PBXContainerItemProxy = objetos.PBXContainerItemProxy || {};

    const ficheiros = [
        'NotificationService.swift',
        'InboxDatabase.swift',
        `${NSE_NOME}-Info.plist`,
        `${NSE_NOME}.entitlements`,
    ];

    const grupo = xcodeProject.addPbxGroup(ficheiros, NSE_NOME, NSE_NOME);

    // pendura o grupo novo no grupo raiz do projeto
    const grupos = xcodeProject.hash.project.objects.PBXGroup;
    Object.keys(grupos).forEach((chave) => {
        if (!chave.includes('_comment') && grupos[chave].name === undefined && grupos[chave].path === undefined) {
            xcodeProject.addToPbxGroup(grupo.uuid, chave);
        }
    });

    // target app_extension — o xcode lib também cria a copy phase "Embed App
    // Extensions" no primeiro target (a app) e a dependência entre targets
    const alvo = xcodeProject.addTarget(NSE_NOME, 'app_extension', NSE_NOME, `${bundleId}.${NSE_NOME}`);

    xcodeProject.addBuildPhase(
        ['NotificationService.swift', 'InboxDatabase.swift'],
        'PBXSourcesBuildPhase',
        'Sources',
        alvo.uuid,
    );
    xcodeProject.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', alvo.uuid);
    xcodeProject.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', alvo.uuid);

    const configuracoes = xcodeProject.pbxXCBuildConfigurationSection();

    for (const chave in configuracoes) {
        const settings = configuracoes[chave]?.buildSettings;

        if (settings?.PRODUCT_NAME === `"${NSE_NOME}"`) {
            settings.INFOPLIST_FILE = `${NSE_NOME}/${NSE_NOME}-Info.plist`;
            settings.CODE_SIGN_ENTITLEMENTS = `${NSE_NOME}/${NSE_NOME}.entitlements`;
            settings.CODE_SIGN_STYLE = 'Automatic';
            settings.SWIFT_VERSION = '5.0';
            settings.IPHONEOS_DEPLOYMENT_TARGET = '15.1';
            settings.TARGETED_DEVICE_FAMILY = '"1,2"';
            settings.MARKETING_VERSION = marketingVersion;
            settings.CURRENT_PROJECT_VERSION = buildNumber;
            settings.GENERATE_INFOPLIST_FILE = 'NO';

            if (team) {
                settings.DEVELOPMENT_TEAM = team;
            }
        }
    }

    if (team) {
        xcodeProject.addTargetAttribute('DevelopmentTeam', team, alvo);
    }
}

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

        // Communication Notifications (avatar estilo iMessage na NSE): a app
        // declara que doa INSendMessageIntent.
        const atividades = new Set(config.modResults.NSUserActivityTypes ?? []);
        atividades.add('INSendMessageIntent');
        config.modResults.NSUserActivityTypes = [...atividades];

        return config;
    });

    const appGroupNse = opcoes.nse?.appGroup;

    // Entitlements do target da APP: Communication Notifications sempre; App
    // Group quando a NSE está configurada (inbox partilhado app↔extensão).
    config = withEntitlementsPlist(config, (config) => {
        config.modResults['com.apple.developer.usernotifications.communication'] = true;

        if (appGroupNse) {
            const grupos = new Set(config.modResults['com.apple.security.application-groups'] ?? []);
            grupos.add(appGroupNse);
            config.modResults['com.apple.security.application-groups'] = [...grupos];
        }

        return config;
    });

    // NSE automática (opt-in): ["@hongayetu/expo-makachat-push", { "nse": {
    // "appGroup": "group.com.hongayetu.<app>" } }]. Gera os fontes e injeta o
    // target no pbxproj a cada prebuild — `prebuild --clean` é seguro.
    if (appGroupNse) {
        config = withDangerousMod(config, [
            'ios',
            (config) => {
                escreverFontesNse(config.modRequest.projectRoot, appGroupNse);

                return config;
            },
        ]);

        config = withXcodeProject(config, (config) => {
            injetarTargetNse(config.modResults, {
                bundleId: config.ios?.bundleIdentifier ?? 'com.hongayetu.app',
                team: config.ios?.appleTeamId,
                marketingVersion: config.version ?? '1.0.0',
                buildNumber: config.ios?.buildNumber ?? '1',
            });

            return config;
        });
    }

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
