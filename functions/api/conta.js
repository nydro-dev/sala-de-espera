/* Conta anónima do ranking online (Fase 8): alcunha + código de recuperação, sem email.
   POST cria (pede a confirmação de 13 anos ou mais), GET diz que conta é (serve também para entrar
   noutro aparelho com o código), PATCH muda a alcunha, DELETE apaga a conta e tudo o que tem. */
import { json, falha, hoje, corpo, novoCodigo, resumo, contaDoPedido, normAlcunha } from "../../server/lib/comum.js";

const MAX_POR_DIA = 1000; /* contas novas por dia, no total: protege a quota gratuita de escritas */

export async function onRequestPost({ request, env }) {
  const b = await corpo(request, 2000);
  if (!b) return falha(400, "Pedido inválido.");
  if (b.idade !== true) return falha(400, "O ranking online é para quem tem 13 anos ou mais.");
  const a = normAlcunha(b.alcunha); if (a.erro) return falha(400, a.erro);
  const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM contas WHERE criada = ?1").bind(hoje()).first("n");
  if (n >= MAX_POR_DIA) return falha(429, "Hoje já foram criadas muitas contas. Tenta amanhã.");
  const codigo = novoCodigo();
  await env.DB.prepare("INSERT INTO contas (chave, alcunha, criada, visto) VALUES (?1, ?2, ?3, ?3)").bind(await resumo(codigo.replace(/-/g, "")), a.alcunha, hoje()).run();
  return json({ codigo, alcunha: a.alcunha }, 201);
}

export async function onRequestGet({ request, env }) {
  const c = await contaDoPedido(request, env);
  return c ? json({ alcunha: c.alcunha, criada: c.criada }) : falha(401, "Código desconhecido.");
}

export async function onRequestPatch({ request, env }) {
  const c = await contaDoPedido(request, env); if (!c) return falha(401, "Código desconhecido.");
  const b = await corpo(request, 2000); if (!b) return falha(400, "Pedido inválido.");
  const a = normAlcunha(b.alcunha); if (a.erro) return falha(400, a.erro);
  await env.DB.prepare("UPDATE contas SET alcunha = ?1 WHERE id = ?2").bind(a.alcunha, c.id).run();
  return json({ alcunha: a.alcunha });
}

export async function onRequestDelete({ request, env }) {
  const c = await contaDoPedido(request, env); if (!c) return falha(401, "Código desconhecido.");
  const DB = env.DB;
  await DB.batch(["melhores", "diarios", "tabuleiros"].map(t => DB.prepare("DELETE FROM " + t + " WHERE conta = ?1").bind(c.id))
    .concat(DB.prepare("DELETE FROM contas WHERE id = ?1").bind(c.id)));
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

export function onRequest() { return new Response(null, { status: 405, headers: { Allow: "GET, POST, PATCH, DELETE" } }); }
