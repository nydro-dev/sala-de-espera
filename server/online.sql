-- Ranking online (Fase 8; contas com palavra-passe desde a Fase 8.1). Correr uma vez na base D1 "sala-de-espera":
--   npx wrangler d1 execute sala-de-espera --remote --file server/online.sql
-- (Numa base da Fase 8, que já tem a tabela contas antiga, correr antes server/contas-v2.sql.)
-- Nada aqui identifica uma pessoa: uma alcunha escolhida pelo jogador, resumos da palavra-passe, do código de
-- reserva e das sessões, e os resultados. Sem email, sem IP, sem aparelho. Prazos de apagamento em server/lib/comum.js.

CREATE TABLE IF NOT EXISTS contas (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,    -- alcunha sem maiúsculas, acentos nem pontuação (a alcunha é única)
  alcunha TEXT NOT NULL,        -- como o jogador a escreveu
  senha TEXT NOT NULL,          -- PBKDF2-SHA256: "pbkdf2-sha256$iterações$sal$resumo" (a palavra-passe nunca é guardada)
  reserva TEXT,                 -- SHA-256 do código de reserva (NULL depois de usado)
  criada TEXT NOT NULL,         -- data UTC (AAAA-MM-DD)
  visto TEXT NOT NULL           -- último dia com atividade (para apagar contas paradas há um ano)
);

-- Sessões: uma por aparelho. Só o SHA-256 do token; expiram ao fim de 12 meses sem uso.
CREATE TABLE IF NOT EXISTS sessoes (
  chave TEXT PRIMARY KEY,
  conta INTEGER NOT NULL,
  criada TEXT NOT NULL,
  usada TEXT NOT NULL           -- último dia de uso
);
CREATE INDEX IF NOT EXISTS sessoes_conta ON sessoes (conta);

-- Tentativas falhadas de entrar (palavra-passe ou código de reserva), por alcunha; guardadas uma hora.
CREATE TABLE IF NOT EXISTS tentativas (
  nome TEXT NOT NULL,
  quando TEXT NOT NULL          -- data e hora UTC
);
CREATE INDEX IF NOT EXISTS tentativas_nome ON tentativas (nome, quando);

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
