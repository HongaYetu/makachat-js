import ExpoModulesCore

/// Regista o PushKit no arranque da app (didFinishLaunching) — requisito Apple
/// para receber VoIP pushes em cold start. Nada de LiveKit aqui: no modelo
/// JS-driven a media é ligada pelo JS (@livekit/react-native), não pelo nativo.
public class MakachatPushAppDelegateSubscriber: ExpoAppDelegateSubscriber {
    public func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        MakachatPushKitManager.shared.register()
        return true
    }
}
