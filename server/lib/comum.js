/* Peças comuns das funções do ranking online (Fase 8, contas da Fase 8.1): respostas, contas, sessões e limpeza. */

export const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});
export const falha = (status, erro) => json({ erro }, status);
export const hoje = () => new Date().toISOString().slice(0, 10);
export const agora = () => new Date().toISOString().slice(0, 19).replace("T", " ");

/* Lê o corpo JSON com um limite de tamanho (os registos de jogadas mais longos andam pelas dezenas de KB). */
export async function corpo(request, max = 300000) {
  const n = +request.headers.get("Content-Length");
  if (n > max) return null;
  try { const t = await request.text(); return t.length > max ? null : JSON.parse(t); } catch (e) { return null; }
}

/* ---------- Códigos ao acaso e resumos ----------
   Códigos de reserva: 16 caracteres em Crockford base32 (80 bits ao acaso), em grupos de 4, dados uma vez.
   Sessões: 32 bytes ao acaso em base64url. O servidor guarda só o SHA-256 de uns e de outros. */
const CROCK = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export function novoCodigo() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  let s = ""; for (let i = 0; i < 16; i++) s += CROCK[b[i] & 31];
  return s.match(/.{4}/g).join("-");
}
/* Aceita minúsculas, espaços e hífenes à vontade; I e L contam como 1, O como 0 (como nos códigos de duelo). */
export function normCodigo(c) {
  const s = String(c || "").toUpperCase().replace(/[\s-]/g, "").replace(/[IL]/g, "1").replace(/O/g, "0");
  return /^[0-9A-HJKMNP-TV-Z]{16}$/.test(s) ? s : null;
}
const hex = buf => [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, "0")).join("");
export async function resumo(tipo, valor) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("sala-de-espera:" + tipo + ":" + valor)));
}
function novoToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* ---------- Palavras-passe (Fase 8.1) ----------
   PBKDF2-SHA256 com sal de 16 bytes, pela WebCrypto (sem bibliotecas). O número de iterações fica guardado
   com cada resumo, por isso pode subir mais tarde: quem entrar com um resumo mais fraco é atualizado.
   O plano gratuito dá ~10 ms de CPU por pedido e a Cloudflare aceita até 100 000 iterações; o valor em uso
   vem de PBKDF2_ITER (wrangler.toml), escolhido medindo no ar. */
const ITER_PADRAO = 60000, ITER_MAX = 100000;
export const iteracoes = env => Math.min(ITER_MAX, Math.max(10000, +(env && env.PBKDF2_ITER) || ITER_PADRAO));
async function pbkdf2(senha, sal, iter) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: iter }, k, 256));
}
const deHex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
export async function resumoSenha(senha, iter) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  return "pbkdf2-sha256$" + iter + "$" + hex(sal) + "$" + hex(await pbkdf2(senha, sal, iter));
}
/* { ok, fraco }: fraco = o resumo guardado tem menos iterações do que as de agora (atualizar). */
export async function confereSenha(senha, guardado, iterAgora) {
  const p = String(guardado || "").split("$");
  if (p.length !== 4 || p[0] !== "pbkdf2-sha256") return { ok: false };
  const iter = +p[1], esperado = deHex(p[3]), obtido = await pbkdf2(senha, deHex(p[2]), iter);
  let dif = esperado.length ^ obtido.length;
  for (let i = 0; i < esperado.length; i++) dif |= esperado[i] ^ obtido[i];
  return { ok: dif === 0, fraco: iter < iterAgora };
}
export function validaSenha(senha, alcunha) {
  const s = String(senha || "");
  if (s.length < 8) return "A palavra-passe tem de ter pelo menos 8 caracteres.";
  if (s.length > 128) return "A palavra-passe é demasiado longa (máximo 128 caracteres).";
  if (alcunha && chaveNome(s) === chaveNome(alcunha)) return "A palavra-passe não pode ser a alcunha.";
  return null;
}

/* ---------- Limite de tentativas falhadas (palavra-passe e código de reserva) ---------- */
const TENTATIVAS_HORA = 10;
const umaHoraAtras = () => new Date(Date.now() - 36e5).toISOString().slice(0, 19).replace("T", " ");
export async function bloqueado(env, nome) {
  const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM tentativas WHERE nome = ?1 AND quando > ?2").bind(nome, umaHoraAtras()).first("n");
  return n >= TENTATIVAS_HORA;
}
export const falhou = (env, nome) => env.DB.prepare("INSERT INTO tentativas (nome, quando) VALUES (?1, ?2)").bind(nome, agora()).run();
export const BLOQUEADO = "Demasiadas tentativas falhadas para esta alcunha. Espera uma hora e tenta outra vez.";

/* ---------- Sessões ----------
   Um token por aparelho (cabeçalho Authorization: Bearer <token>). Expira ao fim de 12 meses sem uso e
   renova-se com o uso; a data de uso só se escreve uma vez por dia, para poupar escritas. */
const SESSAO_DIAS = 365;
export async function novaSessao(env, conta) {
  const t = novoToken();
  await env.DB.prepare("INSERT INTO sessoes (chave, conta, criada, usada) VALUES (?1, ?2, ?3, ?3)").bind(await resumo("sessao", t), conta, hoje()).run();
  return t;
}
export const fimDaSessao = () => new Date(Date.now() - SESSAO_DIAS * 864e5).toISOString().slice(0, 10);
export function tokenDoPedido(request) {
  const m = /^Bearer\s+([A-Za-z0-9_-]{43})$/.exec(request.headers.get("Authorization") || "");
  return m ? m[1] : null;
}
/* Conta de quem fez o pedido, ou null. Marca o dia de atividade da conta e da sessão. */
export async function contaDoPedido(request, env) {
  const t = tokenDoPedido(request); if (!t) return null;
  const chave = await resumo("sessao", t);
  const row = await env.DB.prepare("SELECT c.id, c.alcunha, c.criada, c.visto, c.reserva IS NOT NULL AS reserva, s.chave AS sessao, s.usada FROM sessoes s JOIN contas c ON c.id = s.conta WHERE s.chave = ?1").bind(chave).first();
  if (!row || row.usada < fimDaSessao()) return null;
  const d = hoje();
  if (row.usada !== d || row.visto !== d) await env.DB.batch([
    env.DB.prepare("UPDATE sessoes SET usada = ?1 WHERE chave = ?2").bind(d, chave),
    env.DB.prepare("UPDATE contas SET visto = ?1 WHERE id = ?2").bind(d, row.id)
  ]);
  return row;
}
export const SEM_SESSAO = "A sessão terminou. Entra outra vez com a alcunha e a palavra-passe.";

/* ---------- Alcunhas ----------
   2 a 16 caracteres: letras (com acentos), números, espaço, ponto, hífen, sublinhado e apóstrofo.
   Um filtro simples recusa palavrões e insultos comuns; não substitui a moderação (Fase 10). */
/* Palavras inteiras proibidas, começos de palavra proibidos e sequências proibidas mesmo com espaços pelo meio. */
const EXATAS = ["puta", "putas", "cona", "conas", "fdp", "pqp", "crlh", "foda", "fodas", "fode", "nazi", "admin", "cu"];
const COMECOS = ["caralh", "fodase", "foder", "fodid", "merda", "cabrao", "cabroe", "paneleir", "maricas", "boiola", "piroca", "hitler", "salazar", "retardad", "moderador", "administrador"];
const JUNTAS = ["caralh", "merda", "cabrao", "paneleir", "maricas", "boiola", "piroca", "hitler", "retardad", "saladeespera", "moderador"];
/* Chave da alcunha para ser única: sem maiúsculas, acentos, espaços nem pontuação ("Rui Pedro" = "rui.pedro" = "RUIPEDRO"). */
export function chaveNome(a) {
  return String(a || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}
export function normAlcunha(a) {
  const s = String(a || "").normalize("NFC").replace(/\s+/g, " ").trim();
  if (s.length < 2 || s.length > 16) return { erro: "A alcunha tem de ter entre 2 e 16 caracteres." };
  if (!/^[\p{L}\p{N} ._'-]+$/u.test(s)) return { erro: "Usa só letras, números, espaços, pontos e hífenes." };
  const k = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[._'-]/g, " ").replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a");
  const pal = k.split(" ").filter(Boolean), junto = pal.join("");
  if (pal.some(w => EXATAS.includes(w) || COMECOS.some(r => w.startsWith(r))) || JUNTAS.some(r => junto.includes(r))) return { erro: "Essa alcunha não pode ser usada. Escolhe outra." };
  return { alcunha: s, nome: chaveNome(s) };
}

/* ---------- Limpeza (prazos de apagamento, ver privacidade.html) ----------
   Desafios do dia e tabuleiros enviados: 90 dias. Contas sem atividade há 12 meses: apagadas com tudo.
   Corre de vez em quando, a reboque de um envio de resultado (não há tarefas agendadas no plano gratuito). */
export async function limpar(env) {
  const DB = env.DB, d90 = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10), d365 = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
  const velhas = "SELECT id FROM contas WHERE visto < ?1";
  await DB.batch([
    DB.prepare("DELETE FROM diarios WHERE dia < ?1").bind(d90),
    DB.prepare("DELETE FROM tabuleiros WHERE quando < ?1").bind(d90),
    DB.prepare("DELETE FROM sessoes WHERE usada < ?1").bind(fimDaSessao()),
    DB.prepare("DELETE FROM tentativas WHERE quando < ?1").bind(umaHoraAtras()),
    DB.prepare("DELETE FROM melhores WHERE conta IN (" + velhas + ")").bind(d365),
    DB.prepare("DELETE FROM diarios WHERE conta IN (" + velhas + ")").bind(d365),
    DB.prepare("DELETE FROM tabuleiros WHERE conta IN (" + velhas + ")").bind(d365),
    DB.prepare("DELETE FROM sessoes WHERE conta IN (" + velhas + ")").bind(d365),
    DB.prepare("DELETE FROM contas WHERE visto < ?1").bind(d365)
  ]);
}

/* Apaga uma conta e tudo o que tem (resultados e sessões). */
export const apagarConta = (env, id) => env.DB.batch(["melhores", "diarios", "tabuleiros", "sessoes"].map(t => env.DB.prepare("DELETE FROM " + t + " WHERE conta = ?1").bind(id))
  .concat(env.DB.prepare("DELETE FROM contas WHERE id = ?1").bind(id)));

/* Confere a palavra-passe de uma conta ({ id, nome, senha }) com o limite de tentativas; atualiza um resumo fraco.
   Devolve null se está certa, ou uma resposta de erro pronta a enviar. */
export async function conferirComLimite(env, c, senha) {
  if (await bloqueado(env, c.nome)) return falha(429, BLOQUEADO);
  const it = iteracoes(env), r = await confereSenha(String(senha || ""), c.senha, it);
  if (!r.ok) { await falhou(env, c.nome); return falha(401, "Palavra-passe errada."); }
  if (r.fraco) await env.DB.prepare("UPDATE contas SET senha = ?1 WHERE id = ?2").bind(await resumoSenha(String(senha), it), c.id).run();
  return null;
}
