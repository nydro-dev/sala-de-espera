/* Ranking online (Fase 8): os 20 primeiros de um jogo e modo (ou do desafio de um dia) e, se o pedido
   trouxer o código da conta, o lugar de quem pergunta. Só alcunhas, pontos e tempos. */
import { json, falha, hoje, contaDoPedido } from "../../server/lib/comum.js";
import { JOGOS } from "../../server/lib/validar.js";

const TOP = 20;

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url), jogo = u.searchParams.get("jogo"), modo = u.searchParams.get("modo");
  if (!JOGOS[jogo] || !JOGOS[jogo].includes(modo)) return falha(400, "Jogo ou modo desconhecido.");
  const dia = modo === "dia" ? (u.searchParams.get("dia") || hoje()) : null;
  if (dia && !/^\d{4}-\d{2}-\d{2}$/.test(dia)) return falha(400, "Dia inválido.");
  const c = request.headers.get("Authorization") ? await contaDoPedido(request, env) : null;
  const DB = env.DB;
  const [tabela, filtro, args] = dia
    ? ["diarios", "r.jogo = ?1 AND r.dia = ?2 AND r.pontos > 0", [jogo, dia]]
    : ["melhores", "r.jogo = ?1 AND r.modo = ?2", [jogo, modo]];
  const q = [
    DB.prepare("SELECT r.conta, c.alcunha, r.pontos, r.tempo FROM " + tabela + " r JOIN contas c ON c.id = r.conta WHERE " + filtro + " ORDER BY r.pontos DESC, r.tempo ASC, r.quando ASC LIMIT " + TOP).bind(...args),
    DB.prepare("SELECT COUNT(*) AS n FROM " + tabela + " r WHERE " + filtro).bind(...args)
  ];
  if (c) q.push(DB.prepare("SELECT r.pontos, r.tempo, " + (dia ? "r.ganhou" : "1 AS ganhou") + " FROM " + tabela + " r WHERE " + filtro.replace(" AND r.pontos > 0", "") + " AND r.conta = ?3").bind(...args, c.id));
  const res = await DB.batch(q);
  const lista = res[0].results.map((r, i) => ({ pos: i + 1, alcunha: r.alcunha, pontos: r.pontos, tempo: r.tempo, eu: !!c && r.conta === c.id }));
  let eu = null;
  const mine = c && res[2].results[0];
  if (mine) {
    if (mine.pontos > 0) {
      const n = await DB.prepare("SELECT COUNT(*) AS n FROM " + tabela + " r WHERE " + filtro + " AND (r.pontos > ?3 OR (r.pontos = ?3 AND r.tempo < ?4))").bind(...args, mine.pontos, mine.tempo).first("n");
      eu = { pos: n + 1, pontos: mine.pontos, tempo: mine.tempo, alcunha: c.alcunha };
    } else eu = { pos: null, pontos: 0, tempo: mine.tempo, alcunha: c.alcunha, perdeu: true };
  }
  return json({ jogo, modo, dia, total: res[1].results[0].n, lista, eu });
}

export function onRequest() { return new Response(null, { status: 405, headers: { Allow: "GET" } }); }
