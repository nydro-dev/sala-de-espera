/* Conta do ranking online (Fase 8; alcunha + palavra-passe desde a Fase 8.1), sem email.
   POST cria (pede a confirmação de 13 anos ou mais) e devolve a sessão e o código de reserva, que só aparece
   esta vez; GET diz que conta é; PATCH muda a alcunha; DELETE apaga a conta e tudo o que tem (pede a palavra-passe). */
import { json, falha, hoje, corpo, novoCodigo, resumo, resumoSenha, iteracoes, validaSenha, novaSessao, contaDoPedido, normAlcunha, conferirComLimite, apagarConta, SEM_SESSAO } from "../../server/lib/comum.js";

const MAX_POR_DIA = 1000; /* contas novas por dia, no total: protege a quota gratuita de escritas e o CPU */
const OCUPADA = "Essa alcunha já tem dono. Escolhe outra.";

export async function onRequestPost({ request, env }) {
  const b = await corpo(request, 2000);
  if (!b) return falha(400, "Pedido inválido.");
  if (b.idade !== true) return falha(400, "O ranking online é para quem tem 13 anos ou mais.");
  const a = normAlcunha(b.alcunha); if (a.erro) return falha(400, a.erro);
  const e = validaSenha(b.senha, a.alcunha); if (e) return falha(400, e);
  const DB = env.DB;
  const q = await DB.batch([
    DB.prepare("SELECT COUNT(*) AS n FROM contas WHERE criada = ?1").bind(hoje()),
    DB.prepare("SELECT 1 AS x FROM contas WHERE nome = ?1").bind(a.nome)
  ]);
  if (q[0].results[0].n >= MAX_POR_DIA) return falha(429, "Hoje já foram criadas muitas contas. Tenta amanhã.");
  if (q[1].results.length) return falha(409, OCUPADA);
  const reserva = novoCodigo();
  const r = await DB.prepare("INSERT INTO contas (nome, alcunha, senha, reserva, criada, visto) VALUES (?1, ?2, ?3, ?4, ?5, ?5) ON CONFLICT (nome) DO NOTHING")
    .bind(a.nome, a.alcunha, await resumoSenha(b.senha, iteracoes(env)), await resumo("reserva", reserva.replace(/-/g, "")), hoje()).run();
  if (!r.meta.changes) return falha(409, OCUPADA); /* criada por outra pessoa entretanto */
  const sessao = await novaSessao(env, r.meta.last_row_id);
  return json({ sessao, alcunha: a.alcunha, reserva }, 201);
}

export async function onRequestGet({ request, env }) {
  const c = await contaDoPedido(request, env);
  return c ? json({ alcunha: c.alcunha, criada: c.criada, reserva: !!c.reserva }) : falha(401, SEM_SESSAO);
}

export async function onRequestPatch({ request, env }) {
  const c = await contaDoPedido(request, env); if (!c) return falha(401, SEM_SESSAO);
  const b = await corpo(request, 2000); if (!b) return falha(400, "Pedido inválido.");
  const a = normAlcunha(b.alcunha); if (a.erro) return falha(400, a.erro);
  const r = await env.DB.prepare("UPDATE contas SET alcunha = ?1, nome = ?2 WHERE id = ?3 AND NOT EXISTS (SELECT 1 FROM contas WHERE nome = ?2 AND id <> ?3)").bind(a.alcunha, a.nome, c.id).run();
  if (!r.meta.changes) return falha(409, OCUPADA);
  return json({ alcunha: a.alcunha });
}

export async function onRequestDelete({ request, env }) {
  const c = await contaDoPedido(request, env); if (!c) return falha(401, SEM_SESSAO);
  const b = await corpo(request, 2000); if (!b) return falha(400, "Pedido inválido.");
  const conta = await env.DB.prepare("SELECT id, nome, senha FROM contas WHERE id = ?1").bind(c.id).first();
  const err = await conferirComLimite(env, conta, b.senha); if (err) return err;
  await apagarConta(env, c.id);
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

export function onRequest() { return new Response(null, { status: 405, headers: { Allow: "GET, POST, PATCH, DELETE" } }); }
