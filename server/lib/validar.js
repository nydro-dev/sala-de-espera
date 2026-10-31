/* Validação dos resultados enviados para o ranking online (Fase 8).
   O servidor não confia nos pontos que o aparelho diz: repete as jogadas no mesmo tabuleiro, com o mesmo
   código da app (js/logic/), e calcula os pontos ele próprio. O tempo vem do aparelho (o jogo pára quando
   a app vai para segundo plano, por isso o servidor não o pode medir); só se recusam tempos impossíveis.
   O que isto não impede: alguém que escreva um programa para resolver os tabuleiros. Ver PLANO.md. */
import "./janela.js";
import "../../js/logic/base.js";
import "../../js/logic/sudoku.js";
import "../../js/logic/minas.js";
import "../../js/logic/dobra.js";
import "../../js/logic/solitario.js";
import "../../js/logic/palavras.js";
import "../../js/data/validas.js";
import "../../js/data/solucoes.js";
import "../../js/data/validas-4.js";
import "../../js/data/solucoes-4.js";
import "../../js/data/validas-6.js";
import "../../js/data/solucoes-6.js";
import "../../js/data/validas-7.js";
import "../../js/data/solucoes-7.js";

const L = globalThis.SalaLogica, W = globalThis;
const LISTAS = L.palavras.listas({
  sol: { 4: W.SALA_SOLUCOES_4, 5: W.SALA_SOLUCOES, 6: W.SALA_SOLUCOES_6, 7: W.SALA_SOLUCOES_7 },
  val: { 4: W.SALA_VALIDAS_4, 5: W.SALA_VALIDAS, 6: W.SALA_VALIDAS_6, 7: W.SALA_VALIDAS_7 }
});

/* Jogos e modos com ranking online. "dia" é o desafio do dia. */
export const JOGOS = {
  sudoku: ["beginner", "easy", "medium", "hard", "evil", "dia"],
  minas: ["beginner", "easy", "medium", "hard", "extreme", "dia"],
  soli: ["d3", "dia"],
  dobra: ["s3", "s4", "s5"],
  palavras: ["dia"]
};
/* Tempos mínimos plausíveis (segundos), à volta dos recordes humanos conhecidos. */
const MIN_T = {
  sudoku: { beginner: 20, easy: 30, medium: 45, hard: 60, evil: 75 },
  minas: { beginner: 1, easy: 2, medium: 5, hard: 15, extreme: 25, dia: 3 },
  soli: 40
};
const MAX_T = 86400;

const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;
const somaDias = (ds, n) => new Date(Date.parse(ds + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const erro = e => ({ erro: e });

/* b: o corpo do pedido. hoje: data UTC do servidor. Devolve { erro } ou
   { jogo, modo, dia (só no desafio do dia), pontos, tempo, ganhou, tab (tabuleiro, só fora do desafio do dia) }. */
export function validar(b, hoje) {
  if (!b || typeof b !== "object") return erro("pedido");
  const { jogo, modo } = b;
  if (!JOGOS[jogo] || !JOGOS[jogo].includes(modo)) return erro("jogo");
  const tempo = b.tempo;
  if (!Number.isInteger(tempo) || tempo < 0 || tempo > MAX_T) return erro("tempo");
  const diario = modo === "dia";
  let dia = null;
  if (diario) {
    dia = b.dia;
    /* A data é a do aparelho (meia-noite local); aceita-se o dia de ontem, hoje e amanhã em UTC. */
    if (!DIA_RE.test(dia || "") || (dia !== hoje && dia !== somaDias(hoje, -1) && dia !== somaDias(hoje, 1))) return erro("dia");
  }
  const semente = () => L.seedNum(b.seed) >= 0 ? b.seed : null;
  const out = (pontos, ganhou, tab) => ({ jogo, modo, dia, pontos: Math.max(0, Math.round(pontos)), tempo, ganhou: !!ganhou, tab: diario ? null : tab });

  if (jogo === "sudoku") {
    const diff = diario ? "medium" : modo, seed = semente();
    if (!diario && !seed) return erro("semente");
    const rnd = diario ? L.diario("sudoku", dia) : L.rng("sudoku:" + seed);
    const r = L.sudoku.repetir({ diff, rnd, k: b.k, puzzle: b.puzzle, log: b.log });
    if (r.erro) return erro(r.erro);
    if (tempo < MIN_T.sudoku[diff]) return erro("tempo");
    return out(L.sudoku.score({ diff, time: tempo, errors: r.errors, hints: r.hints }).total, true, diff + ":" + seed);
  }

  if (jogo === "minas") {
    if (diario) {
      const D = L.minas.diario(dia);
      const r = L.minas.repetir({ diff: D.diff, mine: D.mine, open: D.open, log: b.log });
      if (r.erro) return erro(r.erro);
      if (r.lost) return out(0, false);
      if (!r.won) return erro("por acabar");
      if (tempo < MIN_T.minas.dia) return erro("tempo");
      return out(L.minas.pontos(D.diff, tempo).total, true);
    }
    const seed = semente(), c = L.minas.CFG[modo];
    if (!seed) return erro("semente");
    if (!Number.isInteger(b.first) || b.first < 0 || b.first >= c.w * c.h) return erro("primeira casa");
    const r = L.minas.repetir({ diff: modo, mine: L.minas.plantar(modo, seed, b.first), first: b.first, log: b.log });
    if (r.erro) return erro(r.erro);
    if (!r.won) return erro("por acabar");
    if (tempo < MIN_T.minas[modo]) return erro("tempo");
    return out(L.minas.pontos(modo, tempo).total, true, modo + ":" + seed + "." + b.first);
  }

  if (jogo === "soli") {
    const seed = semente();
    if (!diario && !seed) return erro("semente");
    const r = L.solitario.repetir({ rnd: diario ? L.diario("soli", dia) : L.rng("soli:" + seed), log: b.log });
    if (r.erro) return erro(r.erro);
    if (r.won) {
      if (tempo < MIN_T.soli) return erro("tempo");
      return out(r.score + L.solitario.bonus(tempo), true, "d3:" + seed);
    }
    /* No desafio do dia dá para terminar sem arrumar tudo e ficar com os pontos; no jogo normal só contam vitórias. */
    if (!diario || !r.moves) return erro("por acabar");
    return out(r.score, false);
  }

  if (jogo === "dobra") {
    const seed = semente(); if (!seed) return erro("semente");
    const r = L.dobra.repetir({ diff: modo, seed, log: b.log });
    if (r.erro) return erro(r.erro);
    if (!r.over) return erro("por acabar");
    return out(r.score, true, modo + ":" + seed);
  }

  if (jogo === "palavras") {
    const r = L.palavras.repetir({ ds: dia, guesses: b.guesses, lst: LISTAS });
    if (r.erro) return erro(r.erro);
    /* Online contam só os pontos da tentativa, sem o bónus de sequência (que depende do histórico do aparelho). */
    return out(r.won ? L.palavras.POINTS[r.tries - 1] : 0, r.won);
  }
  return erro("jogo");
}
