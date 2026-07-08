package expo.modules.makachatpush

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONArray
import org.json.JSONObject

/** Inbox de pushes: escrito pelo FCM service, drenado pelo JS. WAL para concorrência. */
class InboxDatabase private constructor(context: Context) :
    SQLiteOpenHelper(context.applicationContext, "makachat_push_inbox.db", null, 2) {

    companion object {
        @Volatile private var instancia: InboxDatabase? = null

        fun get(context: Context): InboxDatabase =
            instancia ?: synchronized(this) {
                instancia ?: InboxDatabase(context).also { instancia = it }
            }
    }

    override fun onConfigure(db: SQLiteDatabase) {
        db.enableWriteAheadLogging()
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """CREATE TABLE inbox (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chave_servico TEXT NOT NULL,
                conversa_id TEXT NOT NULL,
                mensagem_json TEXT NOT NULL,
                recebida_em TEXT NOT NULL
            )"""
        )
        criarV2(db)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 2) criarV2(db)
    }

    /** v2: histórico por conversa (MessagingStyle) + config da resposta nativa. */
    private fun criarV2(db: SQLiteDatabase) {
        db.execSQL(
            """CREATE TABLE IF NOT EXISTS historico (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversa_id TEXT NOT NULL,
                remetente TEXT NOT NULL,
                corpo TEXT NOT NULL,
                minha INTEGER NOT NULL DEFAULT 0,
                em INTEGER NOT NULL
            )"""
        )
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_historico_conversa ON historico (conversa_id, id)")
        db.execSQL("CREATE TABLE IF NOT EXISTS config (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)")
    }

    fun inserir(chaveServico: String, conversaId: String, mensagemJson: String, recebidaEm: String) {
        writableDatabase.insert("inbox", null, ContentValues().apply {
            put("chave_servico", chaveServico)
            put("conversa_id", conversaId)
            put("mensagem_json", mensagemJson)
            put("recebida_em", recebidaEm)
        })
    }

    fun contagem(): Int =
        readableDatabase.rawQuery("SELECT COUNT(*) FROM inbox", null).use {
            it.moveToFirst(); it.getInt(0)
        }

    /** Devolve tudo como JSON e limpa — atómico. */
    fun drenar(): String {
        val db = writableDatabase
        db.beginTransaction()
        try {
            val lista = JSONArray()
            db.rawQuery("SELECT chave_servico, conversa_id, mensagem_json, recebida_em FROM inbox ORDER BY id", null)
                .use { cursor ->
                    while (cursor.moveToNext()) {
                        lista.put(JSONObject().apply {
                            put("chave_servico", cursor.getString(0))
                            put("conversa_id", cursor.getString(1))
                            put("mensagem_json", cursor.getString(2))
                            put("recebida_em", cursor.getString(3))
                        })
                    }
                }
            db.execSQL("DELETE FROM inbox")
            db.setTransactionSuccessful()
            return lista.toString()
        } finally {
            db.endTransaction()
        }
    }

    // ------------------------------------------------------------ histórico (MessagingStyle)

    data class LinhaHistorico(val remetente: String, val corpo: String, val minha: Boolean, val em: Long)

    fun inserirHistorico(conversaId: String, remetente: String, corpo: String, minha: Boolean) {
        val db = writableDatabase
        db.insert("historico", null, ContentValues().apply {
            put("conversa_id", conversaId)
            put("remetente", remetente)
            put("corpo", corpo)
            put("minha", if (minha) 1 else 0)
            put("em", System.currentTimeMillis())
        })
        // mantém só as últimas 12 por conversa
        db.execSQL(
            "DELETE FROM historico WHERE conversa_id = ? AND id NOT IN (SELECT id FROM historico WHERE conversa_id = ? ORDER BY id DESC LIMIT 12)",
            arrayOf(conversaId, conversaId),
        )
    }

    fun historicoDe(conversaId: String, limite: Int = 8): List<LinhaHistorico> {
        val lista = mutableListOf<LinhaHistorico>()
        readableDatabase.rawQuery(
            "SELECT remetente, corpo, minha, em FROM historico WHERE conversa_id = ? ORDER BY id DESC LIMIT ?",
            arrayOf(conversaId, limite.toString()),
        ).use { cursor ->
            while (cursor.moveToNext()) {
                lista.add(LinhaHistorico(cursor.getString(0), cursor.getString(1), cursor.getInt(2) == 1, cursor.getLong(3)))
            }
        }
        return lista.reversed()
    }

    fun limparHistorico(conversaId: String) {
        writableDatabase.delete("historico", "conversa_id = ?", arrayOf(conversaId))
    }

    // ------------------------------------------------------------ config da resposta nativa

    fun gravarConfig(chave: String, valor: String) {
        writableDatabase.insertWithOnConflict(
            "config",
            null,
            ContentValues().apply { put("chave", chave); put("valor", valor) },
            SQLiteDatabase.CONFLICT_REPLACE,
        )
    }

    fun obterConfig(chave: String): String? =
        readableDatabase.rawQuery("SELECT valor FROM config WHERE chave = ?", arrayOf(chave)).use {
            if (it.moveToFirst()) it.getString(0) else null
        }
}
