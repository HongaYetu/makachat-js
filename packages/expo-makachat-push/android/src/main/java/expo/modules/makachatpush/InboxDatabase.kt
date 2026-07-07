package expo.modules.makachatpush

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONArray
import org.json.JSONObject

/** Inbox de pushes: escrito pelo FCM service, drenado pelo JS. WAL para concorrência. */
class InboxDatabase private constructor(context: Context) :
    SQLiteOpenHelper(context.applicationContext, "makachat_push_inbox.db", null, 1) {

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
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {}

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
}
