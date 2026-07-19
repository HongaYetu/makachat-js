// src/uuid.ts
function uuid() {
  const cripto = globalThis.crypto;
  if (cripto?.randomUUID) {
    return cripto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (cripto?.getRandomValues) {
    cripto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = bytes[6] & 15 | 64;
  bytes[8] = bytes[8] & 63 | 128;
  return formatar(bytes);
}
function uuidv7() {
  const cripto = globalThis.crypto;
  const bytes = new Uint8Array(16);
  if (cripto?.getRandomValues) {
    cripto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const ms = Date.now();
  bytes[0] = Math.floor(ms / 2 ** 40) & 255;
  bytes[1] = Math.floor(ms / 2 ** 32) & 255;
  bytes[2] = Math.floor(ms / 2 ** 24) & 255;
  bytes[3] = Math.floor(ms / 2 ** 16) & 255;
  bytes[4] = Math.floor(ms / 2 ** 8) & 255;
  bytes[5] = ms & 255;
  bytes[6] = bytes[6] & 15 | 112;
  bytes[8] = bytes[8] & 63 | 128;
  return formatar(bytes);
}
function formatar(bytes) {
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// src/api.ts
var ErroApi = class extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
  status;
};
var HubApi = class {
  constructor(obterToken) {
    this.obterToken = obterToken;
  }
  obterToken;
  credenciais = null;
  async sessao() {
    if (!this.credenciais) {
      this.credenciais = await this.obterToken();
    }
    return this.credenciais;
  }
  invalidarSessao() {
    this.credenciais = null;
  }
  async pedir(caminho, init, tentativa = 0) {
    const { token, api_url } = await this.sessao();
    const resposta = await fetch(`${api_url}${caminho}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...init?.headers ?? {}
      }
    });
    if (resposta.status === 401 && tentativa === 0) {
      this.invalidarSessao();
      return this.pedir(caminho, init, 1);
    }
    const corpo = await resposta.json().catch(() => ({}));
    if (!resposta.ok || corpo.estado === "erro") {
      throw new ErroApi(corpo.texto ?? `Erro ${resposta.status}`, resposta.status);
    }
    return corpo;
  }
  registarDispositivo(dados) {
    return this.pedir("/v1/dispositivos", {
      method: "POST",
      body: JSON.stringify(dados)
    });
  }
  /** Remove o token push desta identidade (logout). 1 identidade pode ter N tokens. */
  removerDispositivo(token) {
    return this.pedir("/v1/dispositivos", {
      method: "DELETE",
      body: JSON.stringify({ token })
    });
  }
};

// src/socket.ts
import { io } from "socket.io-client";
var HubSocket = class {
  socket = null;
  opcoes;
  namespace;
  /** handlers registados antes de ligar() — aplicados quando o socket nasce */
  handlers = [];
  /** canais nomeados subscritos (canal → handlers de evento) — re-subscritos no reconnect */
  canais = /* @__PURE__ */ new Map();
  /** evita dois sockets vivos quando ligar() é chamado em concorrência (ex.: StrictMode) */
  aLigar = null;
  geracao = 0;
  /** falhas seguidas do 1º connect (obterToken) — controla o backoff do retry */
  tentativasArranque = 0;
  retryAgendado = null;
  constructor(opcoes) {
    this.opcoes = opcoes;
    this.namespace = opcoes.namespace ?? "hub";
  }
  get ligado() {
    return this.socket?.connected ?? false;
  }
  get bruto() {
    return this.socket;
  }
  async ligar() {
    if (this.socket) {
      return;
    }
    if (this.aLigar) {
      return this.aLigar;
    }
    this.aLigar = this.ligarInterno().finally(() => {
      this.aLigar = null;
    });
    return this.aLigar;
  }
  async ligarInterno() {
    const geracao = this.geracao;
    let credenciais;
    try {
      credenciais = await this.opcoes.obterToken();
    } catch {
      this.agendarRetryArranque(geracao);
      return;
    }
    if (geracao !== this.geracao) {
      return;
    }
    this.socket = io(`${credenciais.socket_url}/${this.namespace}`, {
      auth: { token: credenciais.token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelayMax: 5e3
    });
    for (const [evento, handler] of this.handlers) {
      this.socket.on(evento, handler);
    }
    for (const [, set] of this.canais) {
      for (const { evento, handler } of set) this.socket.on(evento, handler);
    }
    this.socket.on("connect", () => {
      this.tentativasArranque = 0;
      this.opcoes.aoLigar?.();
      this.reidratarCanais();
    });
    this.socket.on("disconnect", () => this.opcoes.aoDesligar?.());
    this.socket.on("connect_error", async () => {
      const novas = await this.opcoes.obterToken().catch(() => null);
      if (novas && this.socket) {
        this.socket.auth.token = novas.token;
      }
    });
  }
  desligar() {
    this.geracao += 1;
    this.tentativasArranque = 0;
    if (this.retryAgendado) {
      clearTimeout(this.retryAgendado);
      this.retryAgendado = null;
    }
    this.socket?.disconnect();
    this.socket = null;
  }
  /**
   * Reconexão imediata (ex.: app volta do background — Android mata websockets
   * e o backoff do socket.io demoraria a notar). Se o 1º connect falhou (socket
   * ainda nulo), re-arranca do zero em vez de ficar morto até reiniciar a app.
   */
  garantirLigado() {
    if (!this.socket) {
      void this.ligar();
      return;
    }
    if (!this.socket.connected) {
      this.socket.connect();
    }
  }
  /** Backoff (1s→30s) para re-tentar o 1º connect enquanto o socket não existe. */
  agendarRetryArranque(geracao) {
    if (geracao !== this.geracao || this.retryAgendado) {
      return;
    }
    const atraso = Math.min(1e3 * 2 ** this.tentativasArranque, 3e4);
    this.tentativasArranque += 1;
    this.retryAgendado = setTimeout(() => {
      this.retryAgendado = null;
      if (geracao !== this.geracao || this.socket) {
        return;
      }
      void this.ligar();
    }, atraso);
  }
  on(evento, handler) {
    this.handlers.push([evento, handler]);
    this.socket?.on(evento, handler);
  }
  /**
   * Subscreve um CANAL nomeado do hub (estilo Pusher/Echo) reutilizando o
   * MESMO socket: faz join no canal e ouve `evento` nesse socket. O hub
   * autoriza o canal (delega ao serviço). Devolve uma função de cancelar
   * que sai do canal quando fica sem handlers. Re-subscreve sozinho no
   * reconnect (ver reidratarCanais).
   */
  subscreverCanal(canal, evento, handler) {
    const entrada = { evento, handler };
    let set = this.canais.get(canal);
    const primeira = !set;
    if (!set) {
      set = /* @__PURE__ */ new Set();
      this.canais.set(canal, set);
    }
    set.add(entrada);
    this.socket?.on(evento, entrada.handler);
    if (primeira && this.socket?.connected) {
      this.socket.emit("hub:canal:subscrever", { canal }, () => void 0);
    }
    return () => {
      const atual = this.canais.get(canal);
      if (!atual) return;
      atual.delete(entrada);
      this.socket?.off(evento, entrada.handler);
      if (atual.size === 0) {
        this.canais.delete(canal);
        if (this.socket?.connected) {
          this.socket.emit("hub:canal:sair", { canal }, () => void 0);
        }
      }
    };
  }
  /** Re-emite o join de todos os canais subscritos (chamado em cada connect). */
  reidratarCanais() {
    for (const canal of this.canais.keys()) {
      this.socket?.emit("hub:canal:subscrever", { canal }, () => void 0);
    }
  }
  /** Emissão fire-and-forget (sem ack). Usada por camadas por cima (ex.: typing). */
  emitir(evento, payload) {
    this.socket?.emit(evento, payload, () => void 0);
  }
  /** Emissão com ack tipado e timeout — base para as ações de módulos (ex.: chat). */
  emitirComAck(evento, payload) {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error("Socket desligado"));
        return;
      }
      this.socket.timeout(1e4).emit(evento, payload, (erro, ack) => {
        if (erro) {
          reject(erro);
        } else {
          resolve(ack);
        }
      });
    });
  }
};
export {
  ErroApi,
  HubApi,
  HubSocket,
  uuid,
  uuidv7
};
//# sourceMappingURL=index.js.map