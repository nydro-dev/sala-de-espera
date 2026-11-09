/* Código de reserva (Fase 8.1). POST com a palavra-passe gera um código novo (o anterior deixa de valer)
   e devolve-o, só esta vez. */
import { json, falha, corpo, contaDoPedido, conferirComLimite, novoCodigo, resumo, SEM_SESSAO } from "../../server/lib/comum.js";

export async function onRequestPost({ request, env }) {
  const c = await contaDoPedido(request, env); if (!c) return falha(401, SEM_SESSAO);
  const b = await corpo(request, 2000); if (!b) return falha(400, "Pedido inválido.");
  const conta = await env.DB.prepare("SELECT id, nome, senha FROM contas WHERE id = ?1").bind(c.id).first();
  const err = await conferirComLimite(env, conta, b.senha); if (err) return err;
  const reserva = novoCodigo();
  await env.DB.prepare("UPDATE contas SET reserva = ?1 WHERE id = ?2").bind(await resumo("reserva", reserva.replace(/-/g, "")), c.id).run();
  return json({ reserva });
}

export function onRequest() { return new Response(null, { status: 405, headers: { Allow: "POST" } }); }
