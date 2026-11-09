/* Mudar a palavra-passe (Fase 8.1): pede a atual; as outras sessões da conta terminam, esta fica. */
import { json, falha, corpo, contaDoPedido, conferirComLimite, validaSenha, resumoSenha, iteracoes, SEM_SESSAO } from "../../server/lib/comum.js";

export async function onRequestPost({ request, env }) {
  const c = await contaDoPedido(request, env); if (!c) return falha(401, SEM_SESSAO);
  const b = await corpo(request, 2000); if (!b) return falha(400, "Pedido inválido.");
  const e = validaSenha(b.nova, c.alcunha); if (e) return falha(400, e);
  const conta = await env.DB.prepare("SELECT id, nome, senha FROM contas WHERE id = ?1").bind(c.id).first();
  const err = await conferirComLimite(env, conta, b.atual); if (err) return err;
  await env.DB.batch([
    env.DB.prepare("UPDATE contas SET senha = ?1 WHERE id = ?2").bind(await resumoSenha(b.nova, iteracoes(env)), c.id),
    env.DB.prepare("DELETE FROM sessoes WHERE conta = ?1 AND chave <> ?2").bind(c.id, c.sessao)
  ]);
  return json({ ok: true });
}

export function onRequest() { return new Response(null, { status: 405, headers: { Allow: "POST" } }); }
