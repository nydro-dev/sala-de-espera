-- Ranking online (Fase 8): contas anónimas e resultados. Correr uma vez na base D1 "sala-de-espera":
--   npx wrangler d1 execute sala-de-espera --remote --file server/online.sql
-- Nada aqui identifica uma pessoa: uma alcunha escolhida pelo jogador, o resumo (hash) do código de
-- recuperação e os resultados. Sem email, sem IP, sem aparelho. Prazos de apagamento em server/lib/comum.js.

CREATE TABLE IF NOT EXISTS contas (
  id INTEGER PRIMARY KEY,
  chave TEXT NOT NULL UNIQUE,   -- SHA-256 do código de recuperação (o código em si nunca é guardado)
  alcunha TEXT NOT NULL,
  criada TEXT NOT NULL,         -- data UTC (AAAA-MM-DD)
  visto TEXT NOT NULL           -- último dia com atividade (para apagar contas paradas há um ano)
);

-- Melhor resultado de cada conta por jogo e dificuldade (rankings de sempre).
CREATE TABLE IF NOT EXISTS melhores (
  conta INTEGER NOT NULL,
  jogo TEXT NOT NULL,
  modo TEXT NOT NULL,
  pontos INTEGER NOT NULL,
  tempo INTEGER NOT NULL,
  quando TEXT NOT NULL,
  PRIMARY KEY (conta, jogo, modo)
);
CREATE INDEX IF NOT EXISTS melhores_rank ON melhores (jogo, modo, pontos DESC, tempo ASC);

-- Desafio do dia: uma só tentativa por conta, jogo e dia (também as perdidas, para fechar o dia).
CREATE TABLE IF NOT EXISTS diarios (
  conta INTEGER NOT NULL,
  jogo TEXT NOT NULL,
  dia TEXT NOT NULL,
  pontos INTEGER NOT NULL,
  tempo INTEGER NOT NULL,
  ganhou INTEGER NOT NULL,
  quando TEXT NOT NULL,
  PRIMARY KEY (conta, jogo, dia)
);
CREATE INDEX IF NOT EXISTS diarios_rank ON diarios (jogo, dia, pontos DESC, tempo ASC);

-- Tabuleiros já enviados por cada conta (o mesmo tabuleiro não conta duas vezes).
CREATE TABLE IF NOT EXISTS tabuleiros (
  conta INTEGER NOT NULL,
  jogo TEXT NOT NULL,
  tab TEXT NOT NULL,
  quando TEXT NOT NULL,         -- data e hora UTC
  PRIMARY KEY (conta, jogo, tab)
);
CREATE INDEX IF NOT EXISTS tabuleiros_quando ON tabuleiros (conta, quando);
