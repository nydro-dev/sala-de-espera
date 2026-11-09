/* Esqueci a palavra-passe (Fase 8.1): com a alcunha e o código de reserva, define-se uma palavra-passe nova.
   O código fica gasto, todas as sessões terminam e é dado um código de reserva novo (só esta vez). */
import { json, falha, corpo, normAlcunha, normCodigo, resumo, validaSenha, resumoSenha, iteracoes, novoCodigo, novaSessao, bloqueado, falhou, BLOQUEADO } from "../../server/lib/comum.js";

export async function onRequestPost({ request, env }) {
  const b = await corpo(request, 2000); if (!b) return falha(400, "Pedido inválido.");
  const a = normAlcunha(b.alcunha);
  const c = !a.erro && await env.DB.prepare("SELECT id, nome, alcunha, reserva FROM contas WHERE nome = ?1").bind(a.nome).first();
  if (!c) return falha(401, "Não há nenhuma conta com essa alcunha.");
  const e = validaSenha(b.nova, c.alcunha); if (e) return falha(400, e);
  if (await bloqueado(env, c.nome)) return falha(429, BLOQUEADO);
  const codigo = normCodigo(b.reserva);
  if (!codigo || !c.reserva || await resumo("reserva", codigo) !== c.reserva) {
    await falhou(env, c.nome);
    return falha(401, c.reserva ? "O código de reserva não está certo." : "Esta conta não tem código de reserva válido (já foi usado ou não foi gerado).");
  }
  const reserva = novoCodigo();
  const r = await env.DB.prepare("UPDATE contas SET senha = ?1, reserva = ?2 WHERE id = ?3 AND reserva = ?4")
    .bind(await resumoSenha(b.nova, iteracoes(env)), await resumo("reserva", reserva.replace(/-/g, "")), c.id, c.reserva).run();
  if (!r.meta.changes) return falha(409, "O código de reserva acabou de ser usado. Tenta entrar.");
  await env.DB.prepare("DELETE FROM sessoes WHERE conta = ?1").bind(c.id).run();
  return json({ sessao: await novaSessao(env, c.id), alcunha: c.alcunha, reserva }, 201);
}

export function onRequest() { return new Response(null, { status: 405, headers: { Allow: "POST" } }); }
