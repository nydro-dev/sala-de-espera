/* Peças comuns das funções do ranking online (Fase 8): respostas, contas e limpeza. */

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

/* ---------- Código de recuperação ----------
   16 caracteres em Crockford base32 (80 bits ao acaso), em grupos de 4. É a única "palavra-passe" da conta:
   o servidor guarda só o SHA-256, por isso quem o perder perde a conta (não há email para recuperar). */
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
export async function resumo(codigo) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("sala-de-espera:conta:" + codigo));
  return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, "0")).join("");
}
/* Conta de quem fez o pedido (cabeçalho Authorization: Bearer <código>), ou null. Marca o dia de atividade. */
export async function contaDoPedido(request, env) {
  const m = /^Bearer\s+(.+)$/i.exec(request.headers.get("Authorization") || "");
  const c = m && normCodigo(m[1]); if (!c) return null;
  const row = await env.DB.prepare("SELECT id, alcunha, criada, visto FROM contas WHERE chave = ?1").bind(await resumo(c)).first();
  if (row && row.visto !== hoje()) await env.DB.prepare("UPDATE contas SET visto = ?1 WHERE id = ?2").bind(hoje(), row.id).run();
  return row || null;
}

/* ---------- Alcunhas ----------
   2 a 16 caracteres: letras (com acentos), números, espaço, ponto, hífen, sublinhado e apóstrofo.
   Um filtro simples recusa palavrões e insultos comuns; não substitui a moderação (Fase 10). */
/* Palavras inteiras proibidas, começos de palavra proibidos e sequências proibidas mesmo com espaços pelo meio. */
const EXATAS = ["puta", "putas", "cona", "conas", "fdp", "pqp", "crlh", "foda", "fodas", "fode", "nazi", "admin", "cu"];
const COMECOS = ["caralh", "fodase", "foder", "fodid", "merda", "cabrao", "cabroe", "paneleir", "maricas", "boiola", "piroca", "hitler", "salazar", "retardad", "moderador", "administrador"];
const JUNTAS = ["caralh", "merda", "cabrao", "paneleir", "maricas", "boiola", "piroca", "hitler", "retardad", "saladeespera", "moderador"];
export function normAlcunha(a) {
  const s = String(a || "").normalize("NFC").replace(/\s+/g, " ").trim();
  if (s.length < 2 || s.length > 16) return { erro: "A alcunha tem de ter entre 2 e 16 caracteres." };
  if (!/^[\p{L}\p{N} ._'-]+$/u.test(s)) return { erro: "Usa só letras, números, espaços, pontos e hífenes." };
  const k = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[._'-]/g, " ").replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a");
  const pal = k.split(" ").filter(Boolean), junto = pal.join("");
  if (pal.some(w => EXATAS.includes(w) || COMECOS.some(r => w.startsWith(r))) || JUNTAS.some(r => junto.includes(r))) return { erro: "Essa alcunha não pode ser usada. Escolhe outra." };
  return { alcunha: s };
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
    DB.prepare("DELETE FROM melhores WHERE conta IN (" + velhas + ")").bind(d365),
    DB.prepare("DELETE FROM diarios WHERE conta IN (" + velhas + ")").bind(d365),
    DB.prepare("DELETE FROM tabuleiros WHERE conta IN (" + velhas + ")").bind(d365),
    DB.prepare("DELETE FROM contas WHERE visto < ?1").bind(d365)
  ]);
}
