/* Entrar e sair (Fase 8.1). POST com a alcunha e a palavra-passe abre uma sessão neste aparelho;
   DELETE termina a sessão deste aparelho, ou todas as da conta com ?todas=1. */
import { json, falha, corpo, normAlcunha, novaSessao, contaDoPedido, conferirComLimite, SEM_SESSAO } from "../../server/lib/comum.js";

export async function onRequestPost({ request, env }) {
  const b = await corpo(request, 2000); if (!b) return falha(400, "Pedido inválido.");
  const a = normAlcunha(b.alcunha);
  /* Alcunha inexistente: responde já, sem gastar CPU com o PBKDF2 (as alcunhas são públicas no ranking). */
  const c = !a.erro && await env.DB.prepare("SELECT id, nome, alcunha, senha FROM contas WHERE nome = ?1").bind(a.nome).first();
  if (!c) return falha(401, "Não há nenhuma conta com essa alcunha.");
  const err = await conferirComLimite(env, c, b.senha); if (err) return err;
  return json({ sessao: await novaSessao(env, c.id), alcunha: c.alcunha }, 201);
}

export async function onRequestDelete({ request, env }) {
  const c = await contaDoPedido(request, env); if (!c) return falha(401, SEM_SESSAO);
  if (new URL(request.url).searchParams.get("todas") === "1") await env.DB.prepare("DELETE FROM sessoes WHERE conta = ?1").bind(c.id).run();
  else await env.DB.prepare("DELETE FROM sessoes WHERE chave = ?1").bind(c.sessao).run();
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

export function onRequest() { return new Response(null, { status: 405, headers: { Allow: "POST, DELETE" } }); }
