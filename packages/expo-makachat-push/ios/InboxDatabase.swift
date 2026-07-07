import Foundation
import SQLite3

/// Inbox partilhado entre a app e a Notification Service Extension via App Group.
/// A NSE escreve (push com app fechada); o JS drena no arranque/foreground.
public final class InboxDatabase {
    public static let shared = InboxDatabase()
    private let fila = DispatchQueue(label: "makachat.push.inbox")
    private var db: OpaquePointer?

    public func abrir(appGroup: String?) {
        fila.sync {
            if db != nil { return }

            let diretorio: URL
            if let grupo = appGroup,
               let url = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: grupo) {
                diretorio = url
            } else {
                diretorio = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            }

            let caminho = diretorio.appendingPathComponent("makachat_push_inbox.db").path
            sqlite3_open(caminho, &db)
            exec("PRAGMA journal_mode=WAL")
            exec("""
                CREATE TABLE IF NOT EXISTS inbox (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    chave_servico TEXT NOT NULL,
                    conversa_id TEXT NOT NULL,
                    mensagem_json TEXT NOT NULL,
                    recebida_em TEXT NOT NULL
                )
            """)
        }
    }

    public func inserir(chaveServico: String, conversaId: String, mensagemJson: String) {
        fila.sync {
            var stmt: OpaquePointer?
            sqlite3_prepare_v2(db, "INSERT INTO inbox (chave_servico, conversa_id, mensagem_json, recebida_em) VALUES (?,?,?,?)", -1, &stmt, nil)
            let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
            sqlite3_bind_text(stmt, 1, chaveServico, -1, transient)
            sqlite3_bind_text(stmt, 2, conversaId, -1, transient)
            sqlite3_bind_text(stmt, 3, mensagemJson, -1, transient)
            sqlite3_bind_text(stmt, 4, ISO8601DateFormatter().string(from: Date()), -1, transient)
            sqlite3_step(stmt)
            sqlite3_finalize(stmt)
        }
    }

    public func contagem() -> Int {
        fila.sync {
            var stmt: OpaquePointer?
            sqlite3_prepare_v2(db, "SELECT COUNT(*) FROM inbox", -1, &stmt, nil)
            defer { sqlite3_finalize(stmt) }
            return sqlite3_step(stmt) == SQLITE_ROW ? Int(sqlite3_column_int(stmt, 0)) : 0
        }
    }

    public func drenar() -> String {
        fila.sync {
            var itens: [[String: String]] = []
            var stmt: OpaquePointer?
            sqlite3_prepare_v2(db, "SELECT chave_servico, conversa_id, mensagem_json, recebida_em FROM inbox ORDER BY id", -1, &stmt, nil)
            while sqlite3_step(stmt) == SQLITE_ROW {
                itens.append([
                    "chave_servico": String(cString: sqlite3_column_text(stmt, 0)),
                    "conversa_id": String(cString: sqlite3_column_text(stmt, 1)),
                    "mensagem_json": String(cString: sqlite3_column_text(stmt, 2)),
                    "recebida_em": String(cString: sqlite3_column_text(stmt, 3)),
                ])
            }
            sqlite3_finalize(stmt)
            exec("DELETE FROM inbox")

            let dados = try? JSONSerialization.data(withJSONObject: itens)
            return dados.flatMap { String(data: $0, encoding: .utf8) } ?? "[]"
        }
    }

    private func exec(_ sql: String) {
        sqlite3_exec(db, sql, nil, nil, nil)
    }
}
