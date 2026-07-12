"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  EVENTOS_CLIENTE: () => EVENTOS_CLIENTE,
  EVENTOS_SERVIDOR: () => EVENTOS_SERVIDOR,
  ErroApi: () => ErroApi,
  FUNCIONALIDADES: () => FUNCIONALIDADES,
  MakaApi: () => MakaApi,
  MakaSocket: () => MakaSocket,
  MemoryStorage: () => MemoryStorage,
  SyncEngine: () => SyncEngine,
  dividirLinks: () => dividirLinks,
  idMaiorOuIgual: () => idMaiorOuIgual,
  rotuloTipoIdentidade: () => rotuloTipoIdentidade,
  uuid: () => uuid
});
module.exports = __toCommonJS(index_exports);

// src/tipos.ts
function idMaiorOuIgual(a, b) {
  return !!a && a >= b;
}
var ROTULOS_TIPO_IDENTIDADE = {
  cliente: "Cliente",
  negocio: "Neg\xF3cio",
  utilizador_kanda: "Utilizador do Kanda",
  sistema: "Sistema"
};
function rotuloTipoIdentidade(tipo) {
  if (ROTULOS_TIPO_IDENTIDADE[tipo]) return ROTULOS_TIPO_IDENTIDADE[tipo];
  const legivel = tipo.replaceAll("_", " ").trim();
  return legivel.charAt(0).toUpperCase() + legivel.slice(1);
}
function dividirLinks(texto) {
  const regex = /https?:\/\/[^\s<>"']+/gi;
  const partes = [];
  let cursor = 0;
  for (const m of texto.matchAll(regex)) {
    const inicio = m.index ?? 0;
    if (inicio > cursor) partes.push({ texto: texto.slice(cursor, inicio) });
    const url = m[0].replace(/[).,;!?]+$/, "");
    partes.push({ texto: url, url });
    cursor = inicio + url.length;
  }
  if (cursor < texto.length) partes.push({ texto: texto.slice(cursor) });
  return partes.length ? partes : [{ texto }];
}

// src/eventos.ts
var EVENTOS_CLIENTE = {
  ENVIAR: "chat:mensagem:enviar",
  EDITAR: "chat:mensagem:editar",
  ELIMINAR: "chat:mensagem:eliminar",
  ENTREGUES: "chat:mensagens:entregues",
  LIDAS: "chat:mensagens:lidas",
  REAGIR: "chat:reacao:alternar",
  TYPING: "chat:typing",
  ENTRAR_CONVERSA: "chat:conversa:entrar",
  SYNC: "chat:sync:desde"
};
var EVENTOS_SERVIDOR = {
  MENSAGEM_NOVA: "chat:mensagem:nova",
  MENSAGEM_ATUALIZADA: "chat:mensagem:atualizada",
  MENSAGEM_ELIMINADA: "chat:mensagem:eliminada",
  RECIBO: "chat:recibo:atualizado",
  REACAO: "chat:reacao:atualizada",
  TYPING: "chat:typing",
  PRESENCA: "chat:presenca",
  CONVERSA_ATUALIZADA: "chat:conversa:atualizada",
  PARTICIPANTE_ADICIONADO: "chat:participante:adicionado",
  PARTICIPANTE_REMOVIDO: "chat:participante:removido",
  PARTICIPANTE_ATUALIZADO: "chat:participante:atualizado",
  CHAMADA_INICIADA: "chat:chamada:iniciada",
  CHAMADA_ATENDIDA: "chat:chamada:atendida",
  CHAMADA_REJEITADA: "chat:chamada:rejeitada",
  CHAMADA_TERMINADA: "chat:chamada:terminada",
  CHAMADA_PARTICIPANTE_SAIU: "chat:chamada:participante_saiu"
};
var FUNCIONALIDADES = [
  "media.foto",
  "media.video",
  "media.ficheiro",
  "media.audio",
  "reacoes",
  "encaminhar",
  "grupos",
  "chamadas.audio",
  "chamadas.video",
  "chamadas.partilha_ecra",
  "conversas.eliminar",
  // criação de conversas pelo utilizador (nova conversa/mensagem direta);
  // serviços com conversas só de sistema (ex.: via encomenda) não a ativam
  "conversas.criar"
];

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
function limparAlvo(alvo) {
  const nome = alvo.nome?.trim();
  const foto = alvo.foto?.trim();
  return {
    id_externo: String(alvo.id_externo),
    tipo: alvo.tipo,
    ...nome ? { nome } : {},
    ...foto && /^https?:\/\//i.test(foto) ? { foto } : {}
  };
}
var MakaApi = class {
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
  listarConversas(opcoes) {
    const query = new URLSearchParams();
    if (opcoes?.cursor) query.set("cursor", opcoes.cursor);
    if (opcoes?.arquivadas) query.set("arquivadas", "1");
    if (opcoes?.limite) query.set("limite", String(opcoes.limite));
    if (opcoes?.q) query.set("q", opcoes.q);
    return this.pedir(`/v1/chat/conversas?${query}`);
  }
  obterConversa(conversaId) {
    return this.pedir(`/v1/chat/conversas/${conversaId}`);
  }
  criarPrivada(participante) {
    return this.pedir("/v1/chat/conversas", {
      method: "POST",
      body: JSON.stringify({ tipo: "privada", participante: limparAlvo(participante) })
    });
  }
  criarGrupo(titulo, participantes) {
    return this.pedir("/v1/chat/conversas", {
      method: "POST",
      body: JSON.stringify({ tipo: "grupo", titulo, participantes: participantes.map(limparAlvo) })
    });
  }
  /** Media da conversa por tipo — tabs da info (Fotos/Ficheiros/Áudios/Links). */
  listarMedia(conversaId, tipo, opcoes) {
    const query = new URLSearchParams({ tipo });
    if (opcoes?.antes_de) query.set("antes_de", opcoes.antes_de);
    if (opcoes?.limite) query.set("limite", String(opcoes.limite));
    return this.pedir(
      `/v1/chat/conversas/${conversaId}/media?${query.toString()}`
    );
  }
  listarMensagens(conversaId, opcoes) {
    const query = new URLSearchParams();
    if (opcoes?.antes_de) query.set("antes_de", opcoes.antes_de);
    if (opcoes?.limite) query.set("limite", String(opcoes.limite));
    return this.pedir(
      `/v1/chat/conversas/${conversaId}/mensagens?${query}`
    );
  }
  pesquisarMensagens(conversaId, q) {
    return this.pedir(
      `/v1/chat/conversas/${conversaId}/mensagens/pesquisa?q=${encodeURIComponent(q)}`
    );
  }
  atualizarGrupo(conversaId, dados) {
    return this.pedir(`/v1/chat/conversas/${conversaId}`, {
      method: "PATCH",
      body: JSON.stringify(dados)
    });
  }
  atualizarPreferencias(conversaId, dados) {
    return this.pedir(`/v1/chat/conversas/${conversaId}/preferencias`, {
      method: "PATCH",
      body: JSON.stringify(dados)
    });
  }
  adicionarParticipantes(conversaId, participantes) {
    return this.pedir(`/v1/chat/conversas/${conversaId}/participantes`, {
      method: "POST",
      body: JSON.stringify({ participantes })
    });
  }
  /** Promove/despromove um membro do grupo (papel do dono é intocável). */
  mudarPapel(conversaId, identidadeId, papel) {
    return this.pedir(`/v1/chat/conversas/${conversaId}/participantes/${identidadeId}/papel`, {
      method: "PATCH",
      body: JSON.stringify({ papel })
    });
  }
  removerParticipante(conversaId, identidadeId) {
    return this.pedir(`/v1/chat/conversas/${conversaId}/participantes/${identidadeId}`, { method: "DELETE" });
  }
  sairDaConversa(conversaId) {
    return this.pedir(`/v1/chat/conversas/${conversaId}/sair`, { method: "POST" });
  }
  eliminarConversa(conversaId) {
    return this.pedir(`/v1/chat/conversas/${conversaId}`, { method: "DELETE" });
  }
  marcarNaoLida(conversaId) {
    return this.pedir(`/v1/chat/conversas/${conversaId}/nao-lida`, { method: "POST" });
  }
  listarFeatures() {
    return this.pedir("/v1/features");
  }
  criarMedia(dados) {
    return this.pedir(
      "/v1/chat/media",
      { method: "POST", body: JSON.stringify(dados) }
    );
  }
  async carregarMedia(upload, bytes, mime) {
    const { token } = await this.sessao();
    const resposta = await fetch(upload.url, {
      method: "PUT",
      headers: upload.metodo === "endpoint" ? { Authorization: `Bearer ${token}`, "Content-Type": mime ?? "application/octet-stream" } : { "Content-Type": mime ?? "application/octet-stream" },
      body: bytes
    });
    if (!resposta.ok) {
      throw new ErroApi(`Upload falhou (${resposta.status})`, resposta.status);
    }
  }
  confirmarMedia(anexoId, meta) {
    return this.pedir(`/v1/chat/media/${anexoId}/confirmar`, {
      method: "POST",
      body: JSON.stringify(meta ?? {})
    });
  }
  iniciarChamada(conversaId, tipo) {
    return this.pedir("/v1/chat/chamadas", {
      method: "POST",
      body: JSON.stringify({ conversa_id: conversaId, tipo })
    });
  }
  atenderChamada(chamadaId) {
    return this.pedir(`/v1/chat/chamadas/${chamadaId}/atender`, { method: "PATCH" });
  }
  rejeitarChamada(chamadaId) {
    return this.pedir(`/v1/chat/chamadas/${chamadaId}/rejeitar`, { method: "PATCH" });
  }
  terminarChamada(chamadaId) {
    return this.pedir(`/v1/chat/chamadas/${chamadaId}/terminar`, { method: "PATCH" });
  }
  obterContexto(conversaId) {
    return this.pedir(
      `/v1/chat/conversas/${conversaId}/contexto`
    );
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
var import_socket = require("socket.io-client");
var MakaSocket = class {
  socket = null;
  opcoes;
  /** handlers registados antes de ligar() — aplicados quando o socket nasce */
  handlers = [];
  /** evita dois sockets vivos quando ligar() é chamado em concorrência (ex.: StrictMode) */
  aLigar = null;
  geracao = 0;
  constructor(opcoes) {
    this.opcoes = opcoes;
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
    const credenciais = await this.opcoes.obterToken();
    if (geracao !== this.geracao) {
      return;
    }
    this.socket = (0, import_socket.io)(`${credenciais.socket_url}/chat`, {
      auth: { token: credenciais.token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelayMax: 5e3
    });
    for (const [evento, handler] of this.handlers) {
      this.socket.on(evento, handler);
    }
    this.socket.on("connect", () => this.opcoes.aoLigar?.());
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
    this.socket?.disconnect();
    this.socket = null;
  }
  /**
   * Reconexão imediata (ex.: app volta do background — Android mata websockets
   * e o backoff do socket.io demoraria a notar). No-op se já ligado/sem socket.
   */
  garantirLigado() {
    if (this.socket && !this.socket.connected) {
      this.socket.connect();
    }
  }
  on(evento, handler) {
    this.handlers.push([evento, handler]);
    this.socket?.on(evento, handler);
  }
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
  enviarMensagem(dados) {
    return this.emitirComAck(EVENTOS_CLIENTE.ENVIAR, dados);
  }
  editarMensagem(mensagemId, conteudo) {
    return this.emitirComAck(EVENTOS_CLIENTE.EDITAR, {
      mensagem_id: mensagemId,
      conteudo
    });
  }
  eliminarMensagem(mensagemId, paraTodos) {
    return this.emitirComAck(EVENTOS_CLIENTE.ELIMINAR, {
      mensagem_id: mensagemId,
      para_todos: paraTodos
    });
  }
  marcarEntregues(conversaId, ateMensagemId) {
    return this.emitirComAck(EVENTOS_CLIENTE.ENTREGUES, { conversa_id: conversaId, ate_mensagem_id: ateMensagemId });
  }
  marcarLidas(conversaId, ateMensagemId) {
    return this.emitirComAck(EVENTOS_CLIENTE.LIDAS, { conversa_id: conversaId, ate_mensagem_id: ateMensagemId });
  }
  alternarReacao(mensagemId, emoji) {
    return this.emitirComAck(
      EVENTOS_CLIENTE.REAGIR,
      { mensagem_id: mensagemId, emoji }
    );
  }
  typing(conversaId, ativo) {
    this.socket?.emit(EVENTOS_CLIENTE.TYPING, { conversa_id: conversaId, ativo }, () => void 0);
  }
  entrarConversa(conversaId) {
    return this.emitirComAck(EVENTOS_CLIENTE.ENTRAR_CONVERSA, { conversa_id: conversaId });
  }
  sincronizarDesde(cursores, alteradasDesde) {
    return this.emitirComAck(EVENTOS_CLIENTE.SYNC, {
      cursores,
      ...alteradasDesde ? { alteradas_desde: alteradasDesde } : {}
    });
  }
};

// src/storage.ts
var MemoryStorage = class {
  conversas = /* @__PURE__ */ new Map();
  mensagens = /* @__PURE__ */ new Map();
  outbox = /* @__PURE__ */ new Map();
  meta = /* @__PURE__ */ new Map();
  async init() {
  }
  async upsertConversas(conversas) {
    for (const conversa of conversas) {
      const existente = this.conversas.get(conversa.id);
      this.conversas.set(conversa.id, { ...existente, ...conversa });
    }
  }
  async listarConversas(arquivadas = false) {
    return [...this.conversas.values()].filter((c) => (c.participante?.arquivada ?? false) === arquivadas).sort((a, b) => {
      const fixadaA = a.participante?.fixada ? 1 : 0;
      const fixadaB = b.participante?.fixada ? 1 : 0;
      if (fixadaA !== fixadaB) return fixadaB - fixadaA;
      return a.ultima_atividade_em < b.ultima_atividade_em ? 1 : -1;
    });
  }
  async obterConversa(conversaId) {
    return this.conversas.get(conversaId) ?? null;
  }
  async removerConversa(conversaId) {
    this.conversas.delete(conversaId);
    this.mensagens.delete(conversaId);
  }
  async upsertMensagens(novas) {
    for (const mensagem of novas) {
      const lista = this.mensagens.get(mensagem.conversa_id) ?? [];
      const porRef = lista.findIndex(
        (m) => m.ref_cliente === mensagem.ref_cliente && m.remetente_identidade_id === mensagem.remetente_identidade_id
      );
      const porId = lista.findIndex((m) => m.id === mensagem.id);
      const indice = porId >= 0 ? porId : porRef;
      if (indice >= 0) {
        lista[indice] = { ...lista[indice], ...mensagem };
      } else {
        lista.push(mensagem);
      }
      lista.sort((a, b) => a.id < b.id ? -1 : 1);
      this.mensagens.set(mensagem.conversa_id, lista);
    }
  }
  async removerMensagemPorRef(conversaId, refCliente) {
    const lista = this.mensagens.get(conversaId) ?? [];
    this.mensagens.set(
      conversaId,
      lista.filter((m) => m.ref_cliente !== refCliente)
    );
  }
  async removerMensagem(conversaId, mensagemId) {
    const lista = this.mensagens.get(conversaId) ?? [];
    this.mensagens.set(
      conversaId,
      lista.filter((m) => m.id !== mensagemId)
    );
  }
  async listarMensagens(conversaId, opcoes) {
    let lista = this.mensagens.get(conversaId) ?? [];
    if (opcoes?.antes_de) {
      lista = lista.filter((m) => m.id < opcoes.antes_de);
    }
    const limite = opcoes?.limite ?? 50;
    return lista.slice(-limite);
  }
  async cursores() {
    return [...this.mensagens.entries()].map(([conversa_id, lista]) => {
      const confirmadas = lista.filter((m) => !m.estado_envio || m.estado_envio === "enviada");
      return { conversa_id, ultimo_id: confirmadas.at(-1)?.id ?? null };
    });
  }
  async adicionarOutbox(item) {
    this.outbox.set(item.ref_cliente, item);
  }
  async listarOutbox() {
    return [...this.outbox.values()].sort((a, b) => a.criado_em < b.criado_em ? -1 : 1);
  }
  async atualizarOutbox(item) {
    this.outbox.set(item.ref_cliente, item);
  }
  async removerOutbox(refCliente) {
    this.outbox.delete(refCliente);
  }
  async aplicarRecibo(recibo) {
    const conversa = this.conversas.get(recibo.conversa_id);
    if (!conversa) {
      return;
    }
    conversa.participantes = conversa.participantes.map(
      (p) => p.identidade_id === recibo.identidade_id ? {
        ...p,
        ultima_entrega_mensagem_id: maiorId(p.ultima_entrega_mensagem_id, recibo.entregue_ate),
        ultima_leitura_mensagem_id: maiorId(p.ultima_leitura_mensagem_id, recibo.lido_ate)
      } : p
    );
  }
  async obterMeta(chave) {
    return this.meta.get(chave) ?? null;
  }
  async gravarMeta(chave, valor) {
    this.meta.set(chave, valor);
  }
  async limpar() {
    this.conversas.clear();
    this.mensagens.clear();
    this.outbox.clear();
    this.meta.clear();
  }
};
function maiorId(atual, novo) {
  if (!novo) return atual;
  if (!atual) return novo;
  return novo > atual ? novo : atual;
}
function aplicarReciboAConversa(conversa, recibo) {
  return {
    ...conversa,
    participantes: conversa.participantes.map(
      (p) => p.identidade_id === recibo.identidade_id ? {
        ...p,
        ultima_entrega_mensagem_id: maiorId(p.ultima_entrega_mensagem_id, recibo.entregue_ate),
        ultima_leitura_mensagem_id: maiorId(p.ultima_leitura_mensagem_id, recibo.lido_ate)
      } : p
    )
  };
}

// src/sync.ts
var SyncEngine = class {
  constructor(storage, api, socket, opcoes) {
    this.storage = storage;
    this.api = api;
    this.socket = socket;
    this.opcoes = opcoes;
    this.registarEventos();
  }
  storage;
  api;
  socket;
  opcoes;
  versao = 0;
  ouvintes = /* @__PURE__ */ new Set();
  aFazerFlush = false;
  /** fila de mutações locais da conversa — ver patchConversa */
  filaConversa = Promise.resolve();
  /** salas de conversa a (re)entrar em cada ligação — typing/presença chegam por aqui */
  salas = /* @__PURE__ */ new Set();
  /** última presença conhecida por identidade (snapshot do connect + eventos) —
   *  a lista de conversas mostra bolinhas sem abrir nenhuma conversa */
  presencas = /* @__PURE__ */ new Map();
  // ---- subscrição (usada pelos hooks) ----
  get versaoAtual() {
    return this.versao;
  }
  /** Última presença conhecida da identidade (null = nunca vista/offline). */
  presencaDe(identidadeId) {
    return this.presencas.get(identidadeId) ?? null;
  }
  subscrever(ouvinte) {
    this.ouvintes.add(ouvinte);
    return () => this.ouvintes.delete(ouvinte);
  }
  notificar() {
    this.versao += 1;
    for (const ouvinte of this.ouvintes) {
      ouvinte(this.versao);
    }
  }
  /**
   * Mutação local da conversa SERIALIZADA: lê a versão fresca e escreve sem
   * intercalar com outros writers. Sem isto, o upsert pós-ack do marcarLidas
   * do emissor podia gravar um snapshot lido ANTES do recibo do recetor e
   * regredir os ticks (lida → entregue) até reabrir a conversa.
   */
  patchConversa(conversaId, patch) {
    const passo = this.filaConversa.then(async () => {
      const fresca = await this.storage.obterConversa(conversaId);
      if (fresca) {
        await this.storage.upsertConversas([patch(fresca)]);
      }
    });
    this.filaConversa = passo.catch(() => void 0);
    return passo;
  }
  // ---- arranque / reconexão ----
  async iniciar() {
    await this.storage.init();
    await this.socket.ligar();
  }
  /** Chamado pelo MakaSocket em cada (re)ligação. */
  async aoLigar() {
    for (const conversaId of this.salas) {
      await this.socket.entrarConversa(conversaId).catch(() => void 0);
    }
    await this.atualizarConversas();
    await this.sincronizarDelta();
    await this.flushOutbox();
    await this.marcarEntreguesPendentes();
  }
  /** Marca como entregues as mensagens mais novas do que a minha última entrega, por conversa. */
  async marcarEntreguesPendentes() {
    const todas = [...await this.storage.listarConversas(false), ...await this.storage.listarConversas(true)];
    for (const c of todas) {
      const ultima = c.ultima_mensagem;
      if (!ultima) continue;
      const eu = c.participantes.find(
        (p) => p.id_externo === this.opcoes.identidade.id && p.tipo === this.opcoes.identidade.tipo
      );
      if (!idMaiorOuIgual(eu?.ultima_entrega_mensagem_id ?? null, ultima.id)) {
        await this.socket.marcarEntregues(c.id, ultima.id).catch(() => void 0);
      }
    }
  }
  /** Entra na sala da conversa (typing/presença), garante rejoin e a conversa no storage. */
  async entrarConversa(conversaId) {
    this.salas.add(conversaId);
    await this.socket.entrarConversa(conversaId).catch(() => void 0);
    await this.api.obterConversa(conversaId).then(async ({ conversa }) => {
      await this.storage.upsertConversas([conversa]);
      this.notificar();
    }).catch(() => void 0);
    await this.carregarMensagens(conversaId).catch(() => 0);
  }
  async atualizarConversas() {
    const { conversas } = await this.api.listarConversas({ limite: 100 });
    const arquivadas = await this.api.listarConversas({ arquivadas: true, limite: 100 });
    await this.storage.upsertConversas([...conversas, ...arquivadas.conversas]);
    this.notificar();
  }
  /**
   * Delta pós-reconexão: recupera mensagens novas E alteradas (reações,
   * edições, eliminações — via água alta `sync_em`) e faz as novas correr
   * o fluxo normal (aoMensagem → notificações/badges, marcar entregues),
   * como se tivessem chegado ao vivo.
   */
  async sincronizarDelta() {
    const cursores = await this.storage.cursores();
    if (!cursores.length) {
      return;
    }
    const alteradasDesde = await this.storage.obterMeta("sync_em");
    const ack = await this.socket.sincronizarDesde(cursores, alteradasDesde ?? void 0).catch(() => null);
    if (ack?.estado !== "ok") {
      return;
    }
    const cursorPorConversa = new Map(cursores.map((c) => [c.conversa_id, c.ultimo_id]));
    const recuperadas = [];
    for (const lote of ack.lotes) {
      await this.storage.upsertMensagens(lote.mensagens.map((m) => ({ ...m, estado_envio: "enviada" })));
      const cursor = cursorPorConversa.get(lote.conversa_id) ?? null;
      const novas = lote.mensagens.filter((m) => !cursor || m.id > cursor);
      if (!novas.length) {
        continue;
      }
      await this.socket.marcarEntregues(lote.conversa_id, novas.at(-1).id).catch(() => void 0);
      const conversa = await this.storage.obterConversa(lote.conversa_id);
      for (const mensagem of novas) {
        const remetente = conversa?.participantes.find((p) => p.identidade_id === mensagem.remetente_identidade_id);
        const minha = remetente?.id_externo === this.opcoes.identidade.id && remetente?.tipo === this.opcoes.identidade.tipo;
        if (!minha) {
          recuperadas.push(mensagem);
        }
      }
    }
    if (ack.agora) {
      await this.storage.gravarMeta("sync_em", ack.agora);
    }
    if (ack.lotes.length) {
      this.notificar();
    }
    for (const mensagem of recuperadas) {
      this.opcoes.aoMensagem?.(mensagem);
    }
  }
  /** Reflete o estado da chamada da conversa no storage — banner "a decorrer" na UI. */
  async atualizarChamadaAtiva(evento) {
    const conversa = await this.storage.obterConversa(evento.chamada.conversa_id);
    if (!conversa) return;
    const ativa = evento.evento === "iniciada" || evento.evento === "atendida" || evento.evento === "participante_saiu" ? {
      id: evento.chamada.id,
      tipo: evento.chamada.tipo,
      estado: evento.chamada.estado,
      iniciada_em: evento.chamada.iniciada_em,
      atendida_em: evento.chamada.atendida_em
    } : null;
    await this.storage.upsertConversas([{ ...conversa, chamada_ativa: ativa }]);
    this.notificar();
  }
  /** Mantém a lista viva: preview, ordem (topo) e contador sem esperar pelo REST. */
  async atualizarPreviewLocal(mensagem, recebida) {
    await this.patchConversa(mensagem.conversa_id, (conversa) => ({
      ...conversa,
      ultima_atividade_em: mensagem.criada_em,
      ultima_mensagem: {
        id: mensagem.id,
        tipo: mensagem.tipo,
        conteudo: mensagem.eliminada ? null : mensagem.conteudo,
        eliminada: mensagem.eliminada,
        remetente_identidade_id: mensagem.remetente_identidade_id,
        criada_em: mensagem.criada_em
      },
      participante: conversa.participante ? {
        ...conversa.participante,
        mensagens_nao_lidas: recebida ? conversa.participante.mensagens_nao_lidas + 1 : conversa.participante.mensagens_nao_lidas
      } : conversa.participante
    }));
  }
  /** Mensagens vindas do push nativo (inbox offline) — upsert idempotente por id + refresh da UI. */
  async ingerirMensagensPush(mensagens) {
    if (!mensagens.length) {
      return;
    }
    await this.storage.upsertMensagens(mensagens.map((m) => ({ ...m, estado_envio: "enviada" })));
    this.notificar();
  }
  /** Carrega histórico da conversa via REST para o storage (chamado ao abrir). */
  async carregarMensagens(conversaId, antesDe) {
    const { mensagens } = await this.api.listarMensagens(conversaId, { antes_de: antesDe, limite: 50 });
    if (mensagens.length) {
      await this.storage.upsertMensagens(mensagens.map((m) => ({ ...m, estado_envio: "enviada" })));
      this.notificar();
    }
    return mensagens.length;
  }
  // ---- envio offline-first ----
  async enviarMensagem(dados, anexosPreview = []) {
    const refCliente = uuid();
    const agora = (/* @__PURE__ */ new Date()).toISOString();
    const otimista = {
      // id provisório ordenável no fim da lista local; substituído pelo id do servidor
      id: `zz-local-${agora}-${refCliente}`,
      conversa_id: dados.conversa_id,
      remetente_identidade_id: "eu",
      tipo: dados.tipo ?? "texto",
      conteudo: dados.conteudo ?? null,
      resposta_a_id: dados.resposta_a_id ?? null,
      encaminhada_de_id: dados.encaminhada_de_id ?? null,
      ref_cliente: refCliente,
      editada_em: null,
      eliminada: false,
      reacoes: [],
      anexos: anexosPreview,
      criada_em: agora,
      estado_envio: "a_enviar"
    };
    await this.storage.upsertMensagens([otimista]);
    await this.atualizarPreviewLocal(otimista, false);
    await this.storage.adicionarOutbox({
      ref_cliente: refCliente,
      conversa_id: dados.conversa_id,
      dados,
      criado_em: agora,
      tentativas: 0
    });
    this.notificar();
    void this.flushOutbox();
    return otimista;
  }
  /** Flush idempotente: reenvio com o mesmo ref_cliente nunca duplica no servidor. */
  async flushOutbox() {
    if (this.aFazerFlush || !this.socket.ligado) {
      return;
    }
    this.aFazerFlush = true;
    try {
      for (const item of await this.storage.listarOutbox()) {
        try {
          const ack = await this.socket.enviarMensagem({ ...item.dados, ref_cliente: item.ref_cliente });
          if (ack.estado === "ok") {
            await this.storage.removerMensagemPorRef(item.conversa_id, item.ref_cliente);
            await this.storage.upsertMensagens([{ ...ack.mensagem, estado_envio: "enviada" }]);
            await this.storage.removerOutbox(item.ref_cliente);
            this.notificar();
          } else {
            await this.storage.removerOutbox(item.ref_cliente);
            await this.marcarFalhada(item.conversa_id, item.ref_cliente);
          }
        } catch {
          await this.storage.atualizarOutbox({ ...item, tentativas: item.tentativas + 1 });
        }
      }
    } finally {
      this.aFazerFlush = false;
    }
  }
  async marcarFalhada(conversaId, refCliente) {
    const mensagens = await this.storage.listarMensagens(conversaId, { limite: 500 });
    const alvo = mensagens.find((m) => m.ref_cliente === refCliente);
    if (alvo) {
      await this.storage.upsertMensagens([{ ...alvo, estado_envio: "falhou" }]);
    }
    this.notificar();
  }
  // ---- ações com aplicação local (o gateway exclui o remetente do broadcast) ----
  /** identidade_id desta identidade na conversa (público — a UI usa p/ atribuição de chamadas). */
  async minhaIdentidadeId(conversaId) {
    const conversa = await this.storage.obterConversa(conversaId);
    const eu = conversa?.participantes.find(
      (p) => p.id_externo === this.opcoes.identidade.id && p.tipo === this.opcoes.identidade.tipo
    );
    return eu?.identidade_id ?? null;
  }
  async alternarReacao(conversaId, mensagemId, emoji) {
    const ack = await this.socket.alternarReacao(mensagemId, emoji);
    if (ack.estado !== "ok") throw new Error(ack.texto ?? "Erro ao reagir");
    const minhaId = await this.minhaIdentidadeId(conversaId);
    const lista = await this.storage.listarMensagens(conversaId, { limite: 500 });
    const alvo = lista.find((m) => m.id === mensagemId);
    if (alvo && minhaId) {
      const reacoes = alvo.reacoes.filter((r) => r.identidade_id !== minhaId);
      if (ack.emoji) reacoes.push({ identidade_id: minhaId, emoji: ack.emoji });
      await this.storage.upsertMensagens([{ ...alvo, reacoes }]);
      this.notificar();
    }
  }
  async editarMensagem(mensagemId, conteudo) {
    const ack = await this.socket.editarMensagem(mensagemId, conteudo);
    if (ack.estado !== "ok") throw new Error(ack.texto ?? "Erro ao editar");
    await this.storage.upsertMensagens([{ ...ack.mensagem, estado_envio: "enviada" }]);
    this.notificar();
  }
  async eliminarMensagem(conversaId, mensagemId, paraTodos) {
    const ack = await this.socket.eliminarMensagem(mensagemId, paraTodos);
    if (ack.estado !== "ok") throw new Error(ack.texto ?? "Erro ao eliminar");
    if (paraTodos) {
      await this.storage.upsertMensagens([{ ...ack.mensagem, eliminada: true, conteudo: null, estado_envio: "enviada" }]);
    } else {
      await this.storage.removerMensagem(conversaId, mensagemId);
    }
    this.notificar();
  }
  async eliminarConversa(conversaId) {
    await this.api.eliminarConversa(conversaId);
    await this.storage.removerConversa(conversaId);
    this.notificar();
  }
  /** Silencia (ISO ou '9999-12-31T00:00:00Z' para sempre) ou reativa (null) as notificações da conversa. */
  async silenciarConversa(conversaId, ate) {
    await this.api.atualizarPreferencias(conversaId, { silenciada_ate: ate });
    await this.patchConversa(
      conversaId,
      (c) => c.participante ? { ...c, participante: { ...c.participante, silenciada_ate: ate } } : c
    );
    this.notificar();
  }
  async marcarNaoLida(conversaId) {
    const r = await this.api.marcarNaoLida(conversaId);
    await this.patchConversa(
      conversaId,
      (c) => c.participante ? { ...c, participante: { ...c.participante, mensagens_nao_lidas: r.mensagens_nao_lidas } } : c
    );
    this.notificar();
  }
  // ---- leituras ----
  async marcarLidas(conversaId) {
    const mensagens = await this.storage.listarMensagens(conversaId, { limite: 1 });
    const ultima = mensagens.at(-1);
    if (!ultima || ultima.estado_envio === "a_enviar") {
      return;
    }
    await this.socket.marcarLidas(conversaId, ultima.id).catch(() => void 0);
    await this.patchConversa(
      conversaId,
      (c) => c.participante ? { ...c, participante: { ...c.participante, mensagens_nao_lidas: 0 } } : c
    );
    this.notificar();
  }
  // ---- eventos do servidor ----
  registarEventos() {
    this.socket.on(EVENTOS_SERVIDOR.MENSAGEM_NOVA, (payload) => {
      void (async () => {
        this.opcoes.aoTyping?.({
          conversa_id: payload.mensagem.conversa_id,
          identidade_id: payload.mensagem.remetente_identidade_id,
          ativo: false
        });
        const existentes = await this.storage.listarMensagens(payload.mensagem.conversa_id, { limite: 500 });
        const duplicada = existentes.some((m) => m.id === payload.mensagem.id);
        await this.storage.upsertMensagens([{ ...payload.mensagem, estado_envio: "enviada" }]);
        const conversa = await this.storage.obterConversa(payload.mensagem.conversa_id);
        const remetente = conversa?.participantes.find(
          (p) => p.identidade_id === payload.mensagem.remetente_identidade_id
        );
        const minha = remetente?.id_externo === this.opcoes.identidade.id && remetente?.tipo === this.opcoes.identidade.tipo;
        if (!conversa) {
          await this.atualizarConversas();
        } else if (!duplicada) {
          await this.atualizarPreviewLocal(payload.mensagem, !minha && !payload.mensagem.silenciosa);
        }
        await this.socket.marcarEntregues(payload.mensagem.conversa_id, payload.mensagem.id).catch(() => void 0);
        this.notificar();
        if (!duplicada && !minha) {
          this.opcoes.aoMensagem?.(payload.mensagem);
        }
      })();
    });
    this.socket.on(
      EVENTOS_SERVIDOR.MENSAGEM_ATUALIZADA,
      (payload) => void this.storage.upsertMensagens([{ ...payload.mensagem, estado_envio: "enviada" }]).then(() => this.notificar())
    );
    this.socket.on(
      EVENTOS_SERVIDOR.MENSAGEM_ELIMINADA,
      (payload) => {
        void (async () => {
          const mensagens = await this.storage.listarMensagens(payload.conversa_id, { limite: 500 });
          const alvo = mensagens.find((m) => m.id === payload.mensagem_id);
          if (alvo) {
            await this.storage.upsertMensagens([{ ...alvo, eliminada: true, conteudo: null }]);
            this.notificar();
          }
        })();
      }
    );
    this.socket.on(EVENTOS_SERVIDOR.RECIBO, (recibo) => {
      void (async () => {
        if (!await this.storage.obterConversa(recibo.conversa_id)) {
          await this.api.obterConversa(recibo.conversa_id).then(({ conversa }) => this.storage.upsertConversas([conversa])).catch(() => void 0);
        }
        await this.patchConversa(recibo.conversa_id, (c) => {
          const atualizada = aplicarReciboAConversa(c, recibo);
          const eu = atualizada.participantes.find(
            (p) => p.id_externo === this.opcoes.identidade.id && p.tipo === this.opcoes.identidade.tipo
          );
          if (recibo.lido_ate && atualizada.participante && eu && recibo.identidade_id === eu.identidade_id && atualizada.participante.mensagens_nao_lidas > 0) {
            return { ...atualizada, participante: { ...atualizada.participante, mensagens_nao_lidas: 0 } };
          }
          return atualizada;
        });
        this.notificar();
      })();
    });
    this.socket.on(
      EVENTOS_SERVIDOR.REACAO,
      (payload) => {
        void (async () => {
          const mensagens = await this.storage.listarMensagens(payload.conversa_id, { limite: 500 });
          const alvo = mensagens.find((m) => m.id === payload.mensagem_id);
          if (!alvo) {
            return;
          }
          const reacoes = alvo.reacoes.filter((r) => r.identidade_id !== payload.identidade_id);
          if (payload.emoji) {
            reacoes.push({ identidade_id: payload.identidade_id, emoji: payload.emoji });
          }
          await this.storage.upsertMensagens([{ ...alvo, reacoes }]);
          this.notificar();
        })();
      }
    );
    this.socket.on(EVENTOS_SERVIDOR.CONVERSA_ATUALIZADA, (payload) => {
      void this.storage.upsertConversas([payload.conversa]).then(() => this.notificar());
    });
    this.socket.on(EVENTOS_SERVIDOR.PARTICIPANTE_ADICIONADO, () => void this.atualizarConversas());
    this.socket.on(EVENTOS_SERVIDOR.PARTICIPANTE_REMOVIDO, () => void this.atualizarConversas());
    this.socket.on(EVENTOS_SERVIDOR.PARTICIPANTE_ATUALIZADO, () => void this.atualizarConversas());
    for (const [nome, evento] of [
      [EVENTOS_SERVIDOR.CHAMADA_INICIADA, "iniciada"],
      [EVENTOS_SERVIDOR.CHAMADA_ATENDIDA, "atendida"],
      [EVENTOS_SERVIDOR.CHAMADA_REJEITADA, "rejeitada"],
      [EVENTOS_SERVIDOR.CHAMADA_TERMINADA, "terminada"],
      [EVENTOS_SERVIDOR.CHAMADA_PARTICIPANTE_SAIU, "participante_saiu"]
    ]) {
      this.socket.on(nome, (payload) => {
        void this.atualizarChamadaAtiva({ ...payload, evento });
        this.opcoes.aoChamada?.({ ...payload, evento });
      });
    }
    this.socket.on(EVENTOS_SERVIDOR.TYPING, (typing) => this.opcoes.aoTyping?.(typing));
    this.socket.on(EVENTOS_SERVIDOR.PRESENCA, (presenca) => {
      this.presencas.set(presenca.identidade_id, presenca);
      this.opcoes.aoPresenca?.(presenca);
      this.notificar();
    });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  EVENTOS_CLIENTE,
  EVENTOS_SERVIDOR,
  ErroApi,
  FUNCIONALIDADES,
  MakaApi,
  MakaSocket,
  MemoryStorage,
  SyncEngine,
  dividirLinks,
  idMaiorOuIgual,
  rotuloTipoIdentidade,
  uuid
});
//# sourceMappingURL=index.cjs.map