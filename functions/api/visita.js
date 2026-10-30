/* Contador de visitas sem cookies nem identificadores (Fase 7).
   Cada aparelho manda no máximo um pedido por dia, só com o tipo de visita; aqui soma-se 1 ao total
   desse dia e desse tipo. Não se guarda IP, aparelho, browser nem nada que identifique alguém. */
const TIPOS = new Set(["novo", "1-6", "7-29", "30+"]);
const ORIGENS = new Set(["direto", "duelo"]);

export async function onRequestPost({ request, env }) {
  let b = {};
  try { b = await request.json(); } catch (e) { return new Response(null, { status: 400 }); }
  const tipo = TIPOS.has(b.r) ? b.r : null, origem = ORIGENS.has(b.o) ? b.o : "direto";
  if (!tipo || !env.DB) return new Response(null, { status: 400 });
  const dia = new Date().toISOString().slice(0, 10); /* data do servidor (UTC), não a do aparelho */
  await env.DB.prepare(
    "INSERT INTO visitas (dia, tipo, origem, n) VALUES (?1, ?2, ?3, 1) ON CONFLICT (dia, tipo, origem) DO UPDATE SET n = n + 1"
  ).bind(dia, tipo, origem).run();
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

export function onRequest() { return new Response(null, { status: 405, headers: { Allow: "POST" } }); }
