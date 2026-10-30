-- Contador de visitas (Fase 7): só totais por dia, tipo de visita e origem.
CREATE TABLE IF NOT EXISTS visitas (
  dia TEXT NOT NULL,      -- AAAA-MM-DD (UTC)
  tipo TEXT NOT NULL,     -- novo | 1-6 | 7-29 | 30+ (dias desde a primeira visita neste aparelho)
  origem TEXT NOT NULL,   -- direto | duelo (entrou por um link de duelo)
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (dia, tipo, origem)
);
