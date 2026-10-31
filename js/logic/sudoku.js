/* Sala de Espera — Sudoku sem ecrã: gerador, avaliador, pontuação e repetição das jogadas (Fase 8).
   Corre no browser (js/games/sudoku.js) e no servidor (functions/_lib/validar.js). */
(function (G) {
  "use strict";
  const L = G.SalaLogica, { shuffle } = L;
  const BASE = { beginner: 500, easy: 1000, medium: 2000, hard: 3500, evil: 5000 };
  const SPAN = { beginner: 1200, easy: 2400, medium: 2400, hard: 2400, evil: 3600 }; /* segundos até o tempo esgotar a base */
  /* Casas dadas (objetivo) e técnicas exigidas pelo avaliador lógico: [mínima, máxima]. */
  const GIVENS = { beginner: 46, easy: 40, medium: 32, hard: 26, evil: 17 };
  const LEVEL = { beginner: [1, 1], easy: [1, 1], medium: [1, 2], hard: [2, 3], evil: [3, 4] };

  const rowOf = i => (i / 9) | 0, colOf = i => i % 9, boxOf = i => ((rowOf(i) / 3) | 0) * 3 + ((colOf(i) / 3) | 0);
  const PEERS = [...Array(81)].map((_, i) => { const p = []; for (let j = 0; j < 81; j++) if (j !== i && (rowOf(j) === rowOf(i) || colOf(j) === colOf(i) || boxOf(j) === boxOf(i))) p.push(j); return p; });
  const UNITS = [];
  for (let k = 0; k < 9; k++) {
    UNITS.push([...Array(9)].map((_, c) => k * 9 + c));
    UNITS.push([...Array(9)].map((_, r) => r * 9 + k));
    UNITS.push([...Array(9)].map((_, j) => (((k / 3) | 0) * 3 + ((j / 3) | 0)) * 9 + (k % 3) * 3 + (j % 3)));
  }
  const unitsOf = i => UNITS.filter(u => u.includes(i));
  const ok = (g, i, v) => { for (const p of PEERS[i]) if (g[p] === v) return false; return true; };
  function fill(g, rnd) { const i = g.indexOf(0); if (i < 0) return true; for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rnd)) { if (ok(g, i, v)) { g[i] = v; if (fill(g, rnd)) return true; g[i] = 0; } } return false; }
  function count(g, lim) {
    let best = -1, bc = 10;
    for (let i = 0; i < 81; i++) if (!g[i]) { let c = 0; for (let v = 1; v <= 9; v++) if (ok(g, i, v)) c++; if (c < bc) { bc = c; best = i; if (c < 2) break; } }
    if (best < 0) return 1; if (bc === 0) return 0;
    let n = 0; for (let v = 1; v <= 9 && n < lim; v++) if (ok(g, best, v)) { g[best] = v; n += count(g, lim - n); g[best] = 0; }
    return n;
  }
  /* ---------- Avaliador lógico: resolve como uma pessoa e diz que técnicas foram precisas ----------
     1 = só casas óbvias (sozinhos e escondidos); 2 = candidatos alinhados, pares e trios;
     3 = asa-X, peixe-espada e asa-XY; 4 = nem isso chega (precisa de técnicas mais duras). */
  const BIT = v => 1 << v, ALL = 0x3FE;
  const pc = m => { let c = 0; while (m) { m &= m - 1; c++; } return c; };
  const digitsOf = m => { const r = []; for (let v = 1; v <= 9; v++) if (m & BIT(v)) r.push(v); return r; };
  const ROWS = UNITS.filter((_, k) => k % 3 === 0), COLS = UNITS.filter((_, k) => k % 3 === 1), BOXES = UNITS.filter((_, k) => k % 3 === 2);
  function rate(puzzle) {
    const g = puzzle.slice(), cand = Array(81).fill(0);
    for (let i = 0; i < 81; i++) if (!g[i]) { let m = ALL; for (const p of PEERS[i]) if (g[p]) m &= ~BIT(g[p]); cand[i] = m; }
    const place = (i, v) => { g[i] = v; cand[i] = 0; for (const p of PEERS[i]) cand[p] &= ~BIT(v); };
    const elim = (cells, mask) => { let ch = false; for (const i of cells) if (!g[i] && (cand[i] & mask)) { cand[i] &= ~mask; ch = true; } return ch; };
    const singles = () => {
      for (let i = 0; i < 81; i++) if (!g[i]) { if (!cand[i]) return -1; if (pc(cand[i]) === 1) { place(i, digitsOf(cand[i])[0]); return 1; } }
      for (const u of UNITS) for (let v = 1; v <= 9; v++) {
        let at = -1, n = 0, done = false;
        for (const i of u) { if (g[i] === v) { done = true; break; } if (cand[i] & BIT(v)) { n++; at = i; } }
        if (!done && n === 1) { place(at, v); return 1; }
        if (!done && n === 0) return -1;
      }
      return 0;
    };
    const level2 = () => {
      /* candidatos alinhados: dentro de um bloco só numa linha/coluna, ou numa linha/coluna só dentro de um bloco */
      for (const a of UNITS) for (const b of UNITS) {
        if (a === b) continue;
        const inter = a.filter(i => b.includes(i)); if (inter.length !== 3) continue;
        for (let v = 1; v <= 9; v++) {
          const inA = a.filter(i => !g[i] && cand[i] & BIT(v));
          if (inA.length && inA.every(i => inter.includes(i)) && elim(b.filter(i => !inter.includes(i)), BIT(v))) return 1;
        }
      }
      /* pares e trios nus e escondidos */
      for (const u of UNITS) {
        const open = u.filter(i => !g[i]);
        for (const size of [2, 3]) {
          const combos = [];
          const pick = (s, acc) => { if (acc.length === size) { combos.push(acc.slice()); return; } for (let k = s; k < open.length; k++) { acc.push(open[k]); pick(k + 1, acc); acc.pop(); } };
          pick(0, []);
          for (const cset of combos) {
            const m = cset.reduce((x, i) => x | cand[i], 0);
            if (pc(m) === size && elim(open.filter(i => !cset.includes(i)), m)) return 1;
          }
          const ds = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(v => !u.some(i => g[i] === v));
          const dcombos = [];
          const pickd = (s, acc) => { if (acc.length === size) { dcombos.push(acc.slice()); return; } for (let k = s; k < ds.length; k++) { acc.push(ds[k]); pickd(k + 1, acc); acc.pop(); } };
          pickd(0, []);
          for (const dset of dcombos) {
            const dm = dset.reduce((x, v) => x | BIT(v), 0);
            const cells = open.filter(i => cand[i] & dm);
            if (cells.length === size && cells.some(i => cand[i] & ~dm)) { cells.forEach(i => { cand[i] &= dm; }); return 1; }
          }
        }
      }
      return 0;
    };
    const fish = (size) => {
      for (const [base, cover] of [[ROWS, COLS], [COLS, ROWS]]) for (let v = 1; v <= 9; v++) {
        const lines = base.map(u => u.filter(i => !g[i] && cand[i] & BIT(v)));
        const idx = lines.map((l, k) => k).filter(k => lines[k].length >= 2 && lines[k].length <= size);
        const pos = l => cover.findIndex(c => c.includes(l));
        const go = (s, acc) => {
          if (acc.length === size) {
            const covers = new Set(); acc.forEach(k => lines[k].forEach(i => covers.add(pos(i))));
            if (covers.size !== size) return 0;
            const inBase = new Set(); acc.forEach(k => base[k].forEach(i => inBase.add(i)));
            for (const c of covers) if (elim(cover[c].filter(i => !inBase.has(i)), BIT(v))) return 1;
            return 0;
          }
          for (let k = s; k < idx.length; k++) { acc.push(idx[k]); if (go(k + 1, acc)) return 1; acc.pop(); }
          return 0;
        };
        if (go(0, [])) return 1;
      }
      return 0;
    };
    const xyWing = () => {
      const bi = [...Array(81).keys()].filter(i => !g[i] && pc(cand[i]) === 2);
      for (const p of bi) for (const a of bi) for (const b of bi) {
        if (a === p || b === p || a >= b || !PEERS[p].includes(a) || !PEERS[p].includes(b)) continue;
        const [x, y] = digitsOf(cand[p]);
        const ma = cand[a], mb = cand[b];
        for (const [u, w] of [[x, y], [y, x]]) {
          if (!(ma & BIT(u)) || ma === cand[p] || !(mb & BIT(w)) || mb === cand[p]) continue;
          const za = ma & ~BIT(u), zb = mb & ~BIT(w);
          if (za !== zb || pc(za) !== 1) continue;
          if (elim(PEERS[a].filter(i => i !== b && PEERS[b].includes(i)), za)) return 1;
        }
      }
      return 0;
    };
    let level = 1;
    for (let guard = 0; guard < 2000; guard++) {
      if (g.every(Boolean)) return level;
      const s = singles(); if (s < 0) return 9; if (s) continue;
      if (level2()) { level = Math.max(level, 2); continue; }
      if (fish(2) || fish(3) || xyWing()) { level = Math.max(level, 3); continue; }
      return 4;
    }
    return 4;
  }

  /* Resolve um tabuleiro (casa com menos hipóteses primeiro). */
  function solve(p) {
    const g = p.slice();
    const rec = () => {
      let best = -1, bc = 10;
      for (let i = 0; i < 81; i++) if (!g[i]) { let c = 0; for (let v = 1; v <= 9; v++) if (ok(g, i, v)) c++; if (c < bc) { bc = c; best = i; if (c < 2) break; } }
      if (best < 0) return true; if (!bc) return false;
      for (let v = 1; v <= 9; v++) if (ok(g, best, v)) { g[best] = v; if (rec()) return true; g[best] = 0; }
      return false;
    };
    return rec() ? g : null;
  }
  /* Tabuleiro no link do duelo: os números dados, e cada sequência de casas vazias numa letra (a = 1, b = 2…). */
  function packBoard(p) {
    let out = "", z = 0;
    const flush = () => { while (z > 0) { const k = Math.min(26, z); out += String.fromCharCode(96 + k); z -= k; } };
    for (const v of p) { if (v) { flush(); out += v; } else z++; }
    flush(); return out;
  }
  function unpackBoard(str) {
    if (typeof str !== "string" || !/^[1-9a-z]+$/.test(str)) return null;
    const out = [];
    for (const ch of str) { if (ch >= "a") for (let k = 0; k < ch.charCodeAt(0) - 96; k++) out.push(0); else out.push(+ch); }
    return out.length === 81 ? out : null;
  }

  function attempt(diff, rnd) {
    const sol = Array(81).fill(0); fill(sol, rnd);
    const g = sol.slice(); let givens = 81;
    for (const i of shuffle([...Array(81).keys()], rnd)) {
      if (givens <= GIVENS[diff]) break;
      const v = g[i]; g[i] = 0;
      if (count(g.slice(), 2) !== 1) g[i] = v; else givens--;
    }
    return { puzzle: g, solution: sol, level: rate(g) };
  }
  /* Gera até encontrar um puzzle que peça as técnicas certas. Há sempre semente (desafio do dia, duelo ou
     jogo normal desde a Fase 6.1), sem limite de tempo: o resultado tem de ser igual em qualquer aparelho.
     Devolve também k, o número da tentativa escolhida, para o servidor reconstruir a solução (Fase 8). */
  function generate(diff, rnd) {
    const [lo, hi] = LEVEL[diff] || [1, 4];
    let best = null;
    for (let k = 0; k < 400; k++) {
      const a = attempt(diff, rnd); a.k = k;
      if (a.level >= lo && a.level <= hi) return a;
      if (!best || Math.abs(a.level - lo) < Math.abs(best.level - lo)) best = a;
    }
    return best;
  }

  /* ---------- Pontuação ---------- */
  function score(s) {
    const base = BASE[s.diff];
    const tPen = Math.round(s.time * base / (SPAN[s.diff] || 2400));   /* perde a base toda em 20, 40 ou 60 min */
    const ePen = Math.round(s.errors * base * 0.05);
    const hPen = Math.round(s.hints * base * 0.10);
    const total = Math.max(Math.round(base * 0.1), base - tPen - ePen - hPen);
    return { base, tPen, ePen, hPen, total };
  }

  /* ---------- Solução sem gerar o puzzle (Fase 8) ----------
     Cada tentativa do gerador gasta números da semente só no fill (a solução) e no baralhar das 81 casas;
     verificar a unicidade e avaliar as técnicas não gastam nenhum. Por isso a solução da tentativa k
     obtém-se repetindo só essas duas coisas, em menos de um milissegundo por tentativa (escolher as
     casas dadas custaria até ~100 ms, demais para o plano gratuito do servidor). */
  function solucao(rnd, k) {
    let sol = null;
    for (let j = 0; j <= k; j++) {
      sol = Array(81).fill(0); fill(sol, rnd);
      if (j < k) shuffle([...Array(81).keys()], rnd);
    }
    return sol;
  }
  /* Repete as jogadas registadas (S.log) a partir das casas dadas. Cada registo é [casa, valor, tipo]:
     tipo 0 = escrever (valor 0 = apagar), 1 = pista, 2 = desfazer (repõe o valor anterior).
     Conta os erros e as pistas como o jogo os conta e confirma que o tabuleiro acaba resolvido.
     As casas dadas vêm do aparelho: o servidor confirma que batem certo com a solução e que não são
     mais fáceis do que a dificuldade pede, mas não as volta a escolher (ver solucao). */
  function repetir(o) {
    const { diff, k, log } = o;
    if (!BASE[diff]) return { erro: "dificuldade" };
    if (!Number.isInteger(k) || k < 0 || k >= 400) return { erro: "tentativa" };
    const sol = solucao(o.rnd, k);
    const puzzle = String(o.puzzle || "").split("").map(Number);
    if (puzzle.length !== 81 || puzzle.some((v, i) => !(v >= 0 && v <= 9) || (v && v !== sol[i]))) return { erro: "tabuleiro" };
    if (puzzle.filter(Boolean).length < GIVENS[diff]) return { erro: "tabuleiro" };
    if (!Array.isArray(log) || log.length > 5000) return { erro: "jogadas" };
    const vals = puzzle.slice(); let errors = 0, hints = 0;
    for (const e of log) {
      if (!Array.isArray(e) || e.length !== 3) return { erro: "jogadas" };
      const [i, v, f] = e;
      if (!Number.isInteger(i) || i < 0 || i > 80 || puzzle[i] || !Number.isInteger(v) || v < 0 || v > 9 || ![0, 1, 2].includes(f)) return { erro: "jogadas" };
      if (f === 0 && v && v !== sol[i]) errors++;
      if (f === 1) { if (v !== sol[i]) return { erro: "jogadas" }; hints++; }
      vals[i] = v;
    }
    if (!vals.every((v, i) => v === sol[i])) return { erro: "por resolver" };
    return { ok: true, errors, hints };
  }

  L.sudoku = { BASE, SPAN, GIVENS, LEVEL, PEERS, UNITS, unitsOf, rowOf, colOf, boxOf, count, rate, solve, attempt, generate, score, packBoard, unpackBoard, solucao, repetir };
})(typeof globalThis !== "undefined" ? globalThis : self);
