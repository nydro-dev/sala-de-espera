-- Fase 8.1: passa a base da Fase 8 (contas com código de recuperação) para as contas com palavra-passe.
-- Decisão do Rui Pedro (9/11/2026): a conta antiga dele é apagada, sem migração. ANTES de correr isto, ver o que
-- existe e confirmar que só há contas que se podem apagar:
--   npx wrangler d1 execute sala-de-espera --remote --command "SELECT id, alcunha, criada, visto FROM contas"
--   npx wrangler d1 execute sala-de-espera --remote --command "SELECT 'melhores', COUNT(*) FROM melhores UNION ALL SELECT 'diarios', COUNT(*) FROM diarios UNION ALL SELECT 'tabuleiros', COUNT(*) FROM tabuleiros"
-- Se houver contas de outras pessoas, parar e decidir primeiro o que lhes acontece.
-- Depois: --file server/contas-v2.sql e, a seguir, --file server/online.sql (cria as tabelas novas).
-- Apaga as contas antigas e os resultados delas (os ids novos voltariam a começar no 1 e herdariam os resultados).

DELETE FROM melhores;
DELETE FROM diarios;
DELETE FROM tabuleiros;
DROP TABLE IF EXISTS contas;
