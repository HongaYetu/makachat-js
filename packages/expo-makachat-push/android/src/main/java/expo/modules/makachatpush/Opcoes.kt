package expo.modules.makachatpush

import android.content.Context
import android.content.pm.PackageManager

/**
 * Flags dos serviços OPCIONAIS de chamada, injetadas como <meta-data> no
 * manifest da app pelo config plugin (app.plugin.js). Sem plugin/opções,
 * tudo desligado — o comportamento base (notificação CallStyle) mantém-se.
 */
object Opcoes {
    private fun meta(context: Context, chave: String): Boolean {
        return try {
            val info = context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
            info.metaData?.getBoolean(chave, false) ?: false
        } catch (_: Exception) {
            false
        }
    }

    /** Toque em loop contínuo até atender/rejeitar/timeout (ToqueChamadaService). */
    fun toqueContinuo(context: Context) = meta(context, "makachat_toque_continuo")

    /** Ecrã nativo de chamada recebida sobre o lockscreen (EcraChamadaActivity). */
    fun ecraNativo(context: Context) = meta(context, "makachat_ecra_nativo")

    /** Foreground service da chamada em curso (ChamadaAtivaService). */
    fun servicoChamadaAtiva(context: Context) = meta(context, "makachat_chamada_ativa")
}
