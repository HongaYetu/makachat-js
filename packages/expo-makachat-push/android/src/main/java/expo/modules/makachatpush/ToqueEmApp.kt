package expo.modules.makachatpush

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator

/**
 * Toque de chamada EM-APP (app em foreground): o mesmo ringtone real do
 * dispositivo que o ToqueChamadaService usa, mas sem foreground service nem
 * notificação — o ecrã de chamada JS já está visível.
 */
object ToqueEmApp {
    private var player: MediaPlayer? = null
    private var vibrador: Vibrator? = null

    fun tocar(context: Context) {
        if (player != null) return

        try {
            // URI REAL do ringtone (o simbólico falha em vários OEMs — nota do Kanda)
            val uri = RingtoneManager.getActualDefaultRingtoneUri(context, RingtoneManager.TYPE_RINGTONE)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                ?: return

            player = MediaPlayer().apply {
                setDataSource(context, uri)
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

            @Suppress("DEPRECATION")
            (context.getSystemService(Context.AUDIO_SERVICE) as AudioManager)
                .requestAudioFocus(null, AudioManager.STREAM_RING, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
        } catch (_: Exception) {
            player = null
        }

        vibrar(context)
    }

    fun parar(context: Context) {
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
            (context.getSystemService(Context.AUDIO_SERVICE) as AudioManager).abandonAudioFocus(null)
        } catch (_: Exception) {
            // sem foco
        }
    }

    private fun vibrar(context: Context) {
        try {
            @Suppress("DEPRECATION")
            vibrador = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
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
}
