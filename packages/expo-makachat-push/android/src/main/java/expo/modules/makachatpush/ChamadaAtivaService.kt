package expo.modules.makachatpush

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.graphics.drawable.IconCompat

/**
 * Chamada EM CURSO em background (opt-in `servicoChamadaAtiva` do config
 * plugin; padrão do kanda-notifications): foreground service phoneCall|
 * microphone com CallStyle.forOngoingCall + cronómetro, e WakeLock PARCIAL —
 * sem ele o Hermes é estrangulado em background e o ping do LiveKit cai.
 * Arrancado/parado pelo JS (ChamadasProvider) via módulo.
 */
class ChamadaAtivaService : Service() {

    companion object {
        private const val CANAL = "makachat_chamada_ativa"
        private const val ID_NOTIFICACAO = 43_001
        private const val WAKELOCK_MS = 4 * 60 * 60 * 1000L // 4h (chamadas longas)

        fun iniciar(context: Context, nome: String, foto: String?, tipo: String) {
            val intent = Intent(context, ChamadaAtivaService::class.java).apply {
                putExtra("nome", nome)
                putExtra("foto", foto ?: "")
                putExtra("tipo", tipo)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun parar(context: Context) {
            context.stopService(Intent(context, ChamadaAtivaService::class.java))
        }
    }

    private var wakeLock: PowerManager.WakeLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val nome = intent?.getStringExtra("nome") ?: "Chamada"
        val foto = intent?.getStringExtra("foto")?.takeIf { it.isNotEmpty() }
        val tipo = intent?.getStringExtra("tipo") ?: "audio"

        val gestor = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            gestor.createNotificationChannel(
                NotificationChannel(CANAL, "Chamada em curso", NotificationManager.IMPORTANCE_LOW),
            )
        }

        val avatar = ImagemHelper.avatarCircular(foto, nome)

        val abrir = packageManager.getLaunchIntentForPackage(packageName)?.let {
            it.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            PendingIntent.getActivity(this, ID_NOTIFICACAO, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        }

        val construtor = NotificationCompat.Builder(this, CANAL)
            .setSmallIcon(applicationInfo.icon)
            .setLargeIcon(avatar)
            .setContentTitle(nome)
            .setContentText(if (tipo == "video") "Chamada de vídeo em curso" else "Chamada em curso")
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setOngoing(true)
            .setContentIntent(abrir)
            // cronómetro da duração
            .setWhen(System.currentTimeMillis())
            .setShowWhen(true)
            .setUsesChronometer(true)

        if (Build.VERSION.SDK_INT >= 31 && abrir != null) {
            val pessoa = Person.Builder()
                .setName(nome)
                .setIcon(IconCompat.createWithBitmap(avatar))
                .setImportant(true)
                .build()
            construtor.setStyle(NotificationCompat.CallStyle.forOngoingCall(pessoa, abrir))
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            startForeground(
                ID_NOTIFICACAO,
                construtor.build(),
                ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE,
            )
        } else {
            startForeground(ID_NOTIFICACAO, construtor.build())
        }

        // WakeLock parcial: mantém o JS/LiveKit vivos com o ecrã desligado
        if (wakeLock == null) {
            try {
                wakeLock = (getSystemService(Context.POWER_SERVICE) as PowerManager)
                    .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "makachat:chamada_ativa")
                    .apply { acquire(WAKELOCK_MS) }
            } catch (_: Exception) {
                // sem wakelock — a chamada pode cair em standby profundo
            }
        }

        return START_NOT_STICKY
    }

    override fun onDestroy() {
        try {
            if (wakeLock?.isHeld == true) wakeLock?.release()
        } catch (_: Exception) {
            // já libertado
        }

        wakeLock = null
        super.onDestroy()
    }
}
