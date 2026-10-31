/* Envio de um resultado para o ranking online (Fase 8). O servidor repete as jogadas e calcula os pontos
   (server/lib/validar.js); o desafio do dia conta uma só vez por conta, e o mesmo tabuleiro também. */
import { json, falha, hoje, agora, corpo, contaDoPedido, limpar } from "../../server/lib/comum.js";
import { validar } from "../../server/lib/validar.js";

const POR_HORA = 120; /* resultados por conta e por hora: mais do que isto não é uma pessoa a jogar */
const ERROS = {
  tempo: "O tempo deste jogo não é possível.", dia: "Este desafio já não é de hoje.", "por acabar": "O jogo não está acabado.",
  semente: "Este jogo é de uma versão antiga da app.", jogo: "Este jogo não tem ranking online."
};

export async function onRequestPost({ request, env, waitUntil }) {
  const c = await contaDoPedido(request, env); if (!c) return falha(401, "Código desconhecido.");
  const b = await corpo(request); if (!b) return falha(400, "Pedido inválido.");
  const v = validar(b, hoje());
  if (v.erro) return falha(422, ERROS[v.erro] || "O servidor não conseguiu confirmar este jogo (" + v.erro + ").");
  const DB = env.DB, t = agora();
  const n = await DB.prepare("SELECT COUNT(*) AS n FROM tabuleiros WHERE conta = ?1 AND quando > ?2").bind(c.id, new Date(Date.now() - 36e5).toISOString().slice(0, 19).replace("T", " ")).first("n");
  if (n >= POR_HORA) return falha(429, "Demasiados resultados numa hora.");

  let pos = null, total = null;
  if (v.dia) {
    const r = await DB.prepare("INSERT INTO diarios (conta, jogo, dia, pontos, tempo, ganhou, quando) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) ON CONFLICT DO NOTHING")
      .bind(c.id, v.jogo, v.dia, v.pontos, v.tempo, v.ganhou ? 1 : 0, t).run();
    if (!r.meta.changes) return falha(409, "O desafio de hoje já tinha sido enviado (só a primeira tentativa conta).");
    if (v.pontos > 0) {
      const q = await DB.batch([
        DB.prepare("SELECT COUNT(*) AS n FROM diarios WHERE jogo = ?1 AND dia = ?2 AND pontos > 0 AND (pontos > ?3 OR (pontos = ?3 AND tempo < ?4))").bind(v.jogo, v.dia, v.pontos, v.tempo),
        DB.prepare("SELECT COUNT(*) AS n FROM diarios WHERE jogo = ?1 AND dia = ?2 AND pontos > 0").bind(v.jogo, v.dia)
      ]);
      pos = q[0].results[0].n + 1; total = q[1].results[0].n;
    }
  } else {
    const r = await DB.prepare("INSERT INTO tabuleiros (conta, jogo, tab, quando) VALUES (?1, ?2, ?3, ?4) ON CONFLICT DO NOTHING").bind(c.id, v.jogo, v.tab, t).run();
    if (!r.meta.changes) return falha(409, "Este tabuleiro já tinha sido enviado.");
    /* Fica só o melhor de cada conta: mais pontos e, em empate, menos tempo. */
    await DB.prepare("INSERT INTO melhores (conta, jogo, modo, pontos, tempo, quando) VALUES (?1, ?2, ?3, ?4, ?5, ?6) " +
      "ON CONFLICT (conta, jogo, modo) DO UPDATE SET pontos = excluded.pontos, tempo = excluded.tempo, quando = excluded.quando " +
      "WHERE excluded.pontos > melhores.pontos OR (excluded.pontos = melhores.pontos AND excluded.tempo < melhores.tempo)")
      .bind(c.id, v.jogo, v.modo, v.pontos, v.tempo, t).run();
    const q = await DB.batch([
      DB.prepare("SELECT COUNT(*) AS n FROM melhores WHERE jogo = ?1 AND modo = ?2 AND (pontos > ?3 OR (pontos = ?3 AND tempo < ?4))").bind(v.jogo, v.modo, v.pontos, v.tempo),
      DB.prepare("SELECT COUNT(*) AS n FROM melhores WHERE jogo = ?1 AND modo = ?2").bind(v.jogo, v.modo)
    ]);
    pos = q[0].results[0].n + 1; total = q[1].results[0].n;
  }
  if (Math.random() < 0.02) waitUntil(limpar(env).catch(() => {}));
  return json({ pontos: v.pontos, ganhou: v.ganhou, pos, total }, 201);
}

export function onRequest() { return new Response(null, { status: 405, headers: { Allow: "POST" } }); }
