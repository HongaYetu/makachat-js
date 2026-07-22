package expo.modules.makachatpush

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Bundle

/**
 * Trampolim para abrir a app na conversa a partir do tap na notificação de
 * mensagem.
 *
 * Em API 29+ um BroadcastReceiver não pode lançar a app em background/killed
 * (BAL restrictions) e em API 31+ um "notification trampoline" via broadcast é
 * proibido — por isso o tap TEM de apontar para uma Activity (como as chamadas
 * já faziam com EcraChamadaActivity). Persiste a conversa pendente (o JS lê via
 * `obterConversaPendente` no arranque) e abre a app.
 */
class AbrirConversaActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val conversaId = intent.getStringExtra("conversa_id")
        if (conversaId != null) {
            getSharedPreferences(MakachatFcmService.PREFS, Context.MODE_PRIVATE)
                .edit().putString("conversa_pendente", conversaId).apply()
            MakachatFcmService.cancelarNotificacaoMensagens(this, conversaId)
        }

        packageManager.getLaunchIntentForPackage(packageName)?.let {
            it.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            startActivity(it)
        }

        finish()
    }
}
