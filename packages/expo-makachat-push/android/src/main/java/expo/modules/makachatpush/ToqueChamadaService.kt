package expo.modules.makachatpush

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator

/**
 * Toque de chamada CONTÍNUO com a app fechada (opt-in `toqueContinuo` do
 * config plugin; padrão do kanda-notifications): foreground service que toca
 * o ringtone real do dispositivo em loop + vibração, com a notificação
 * CallStyle partilhada. Para em atender/rejeitar/`parar`/timeout 45s.
 */
class ToqueChamadaService : Service() {

    companion object {
        private const val TIMEOUT_MS = 45_000L
        private const val ACAO_PARAR = "parar"

        fun iniciar(
            context: Context,
            titulo: String,
            chamadaId: String,
            chamadaTipo: String,
            conversaId: String,
            chaveServico: String,
            fotoUrl: String?,
        ) {
            val intent = Intent(context, ToqueChamadaService::class.java).apply {
                putExtra("titulo", titulo)
                putExtra("chamada_id", chamadaId)
                putExtra("chamada_tipo", chamadaTipo)
                putExtra("conversa_id", conversaId)
                putExtra("chave_servico", chaveServico)
                putExtra("foto", fotoUrl ?: "")
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun parar(context: Context) {
            context.startService(
                Intent(context, ToqueChamadaService::class.java).apply { action = ACAO_PARAR },
            )
        }
    }

    private var player: MediaPlayer? = null
    private var vibrador: Vibrator? = null
    private val handler = Handler(Looper.getMainLooper())
    private val timeout = Runnable { stopSelf() }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACAO_PARAR || intent == null) {
            stopSelf()

            return START_NOT_STICKY
        }

        val chamadaId = intent.getStringExtra("chamada_id") ?: run {
            stopSelf()

            return START_NOT_STICKY
        }

        val notificacao = MakachatFcmService.construirNotificacaoChamada(
            applicationContext,
            intent.getStringExtra("titulo") ?: "Chamada",
            chamadaId,
            intent.getStringExtra("chamada_tipo") ?: "audio",
            intent.getStringExtra("conversa_id") ?: "",
            intent.getStringExtra("chave_servico") ?: "",
            intent.getStringExtra("foto")?.takeIf { it.isNotEmpty() },
        )

        // mesmo id da notificação base — atender/rejeitar/parar cancelam-na
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            startForeground(chamadaId.hashCode(), notificacao, ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL)
        } else {
            startForeground(chamadaId.hashCode(), notificacao)
        }

        tocar()
        vibrar()
        handler.removeCallbacks(timeout)
        handler.postDelayed(timeout, TIMEOUT_MS)

        return START_NOT_STICKY
    }

    private fun tocar() {
        if (player != null) return

        try {
            // URI REAL do ringtone (o simbólico falha em vários OEMs — nota do Kanda)
            val uri = RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_RINGTONE)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                ?: return

            player = MediaPlayer().apply {
                setDataSource(this@ToqueChamadaService, uri)
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build(),
                )
                isLooping = true
                prepare()
                start()
            }

            (getSystemService(Context.AUDIO_SERVICE) as AudioManager)
                .requestAudioFocus(null, AudioManager.STREAM_RING, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
        } catch (_: Exception) {
            // sem som — a vibração e a notificação continuam
        }
    }

    private fun vibrar() {
        try {
            @Suppress("DEPRECATION")
            vibrador = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            val padrao = longArrayOf(0, 1000, 500)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrador?.vibrate(VibrationEffect.createWaveform(padrao, 0))
            } else {
                @Suppress("DEPRECATION")
                vibrador?.vibrate(padrao, 0)
            }
        } catch (_: Exception) {
            // sem vibração
        }
    }

    override fun onDestroy() {
        handler.removeCallbacks(timeout)

        try {
            player?.stop()
            player?.release()
        } catch (_: Exception) {
            // já libertado
        }

        player = null
        vibrador?.cancel()
        vibrador = null

        try {
            @Suppress("DEPRECATION")
            (getSystemService(Context.AUDIO_SERVICE) as AudioManager).abandonAudioFocus(null)
        } catch (_: Exception) {
            // sem foco
        }

        super.onDestroy()
    }
}
