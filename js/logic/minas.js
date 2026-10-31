/* Sala de Espera — Minas sem ecrã: tabuleiros, minas pela semente, pontuação e repetição das jogadas (Fase 8).
   Tudo em coordenadas do tabuleiro "deitado" (canónico, como no PC); o jogo transpõe no telemóvel ao alto.
   Corre no browser (js/games/minas.js) e no servidor (functions/_lib/validar.js). */
(function (G) {
  "use strict";
  const L = G.SalaLogica, { shuffle, rng } = L;
  const CFG = { beginner: { w: 8, h: 8, m: 8 }, easy: { w: 9, h: 9, m: 10 }, medium: { w: 16, h: 16, m: 40 }, hard: { w: 30, h: 16, m: 99 }, extreme: { w: 30, h: 20, m: 130 } };
  const BASE = { beginner: 250, easy: 500, medium: 2000, hard: 5000, extreme: 9000 };
  const PAR = { beginner: 30, easy: 60, medium: 240, hard: 600, extreme: 1080 }; /* segundos de referência para o bónus */
  const DAILY_DIFF = "medium";

  /* Casas à volta de i num tabuleiro w × h. */
  const vizinhos = (w, h, i) => { const x = i % w, y = (i / w) | 0, r = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < w && ny < h) r.push(ny * w + nx); } return r; };
  const numeros = (w, h, mine) => mine.map((_, i) => vizinhos(w, h, i).reduce((s, j) => s + mine[j], 0));
  /* Abre a partir de s (sem minas à volta, continua), saltando as bandeiras. */
  function abrir(w, h, B, s, onOpen) {
    const q = [s];
    while (q.length) {
      const c = q.shift(); if (B.open[c] || (B.flag && B.flag[c])) continue;
      B.open[c] = 1; if (onOpen) onOpen(c);
      if (!B.num[c]) for (const j of vizinhos(w, h, c)) if (!B.open[j] && !(B.flag && B.flag[j])) q.push(j);
    }
  }

  /* Jogo normal e duelo: minas pela semente, longe da primeira casa aberta. Devolve as minas em canónico. */
  function plantar(diff, seed, first) {
    const c = CFG[diff], n = c.w * c.h, ban = new Set([first, ...vizinhos(c.w, c.h, first)]);
    const mine = Array(n).fill(0);
    shuffle([...Array(n).keys()].filter(i => !ban.has(i)), rng("minas:" + seed)).slice(0, c.m).forEach(i => mine[i] = 1);
    return mine;
  }
  /* Desafio do dia: minas postas pela data e a maior mancha de zeros já aberta (em empate, a primeira). */
  function diario(ds) {
    const c = CFG[DAILY_DIFF], { w, h, m } = c, n = w * h;
    const mine = Array(n).fill(0);
    shuffle([...Array(n).keys()], L.diario("minas", ds)).slice(0, m).forEach(i => mine[i] = 1);
    const num = numeros(w, h, mine), open = Array(n).fill(0);
    const seen = new Uint8Array(n); let best = -1, bestSize = 0;
    for (let i = 0; i < n; i++) {
      if (seen[i] || mine[i] || num[i]) continue;
      let size = 0; const q = [i]; seen[i] = 1;
      while (q.length) { const x = q.pop(); size++; for (const j of vizinhos(w, h, x)) if (!seen[j] && !mine[j] && !num[j]) { seen[j] = 1; q.push(j); } }
      if (size > bestSize) { bestSize = size; best = i; }
    }
    if (best < 0) best = mine.findIndex(v => !v);
    abrir(w, h, { open, num }, best);
    return { diff: DAILY_DIFF, w, h, m, mine, num, open, start: best };
  }
  /* Pontos de uma vitória: base × bónus de rapidez (×2 no máximo, ×0,25 no mínimo). */
  function pontos(diff, time) {
    const t = Math.max(1, time), par = PAR[diff], base = BASE[diff];
    const mult = t <= par ? 1 + (par - t) / par : Math.max(0.25, par / t);
    return { base, par, mult, total: Math.round(base * mult) };
  }

  /* Repete as jogadas registadas (M.log), cada uma [casa canónica, 0 = abrir (num número aberto, o atalho)
     ou 1 = bandeira], com as mesmas regras do jogo. o: { diff, mine, open (casas já abertas no início, ou
     nada), first (primeira casa, nos jogos normais), log }. Devolve { ok, won, opened } ou { erro }. */
  function repetir(o) {
    const c = CFG[o.diff]; if (!c) return { erro: "dificuldade" };
    const { w, h, m } = c, n = w * h, log = o.log;
    if (!Array.isArray(log) || log.length > 20000) return { erro: "jogadas" };
    const B = { mine: o.mine, num: numeros(w, h, o.mine), open: o.open ? o.open.slice() : Array(n).fill(0), flag: Array(n).fill(0) };
    let state = "play", started = !!o.open;
    const reveal = list => {
      for (const s of list) {
        if (B.flag[s] || B.open[s]) continue;
        if (B.mine[s]) { state = "over"; return; }
        abrir(w, h, B, s);
      }
    };
    for (const e of log) {
      if (state !== "play") return { erro: "jogadas depois do fim" };
      if (!Array.isArray(e) || e.length !== 2) return { erro: "jogadas" };
      const [i, a] = e;
      if (!Number.isInteger(i) || i < 0 || i >= n || (a !== 0 && a !== 1)) return { erro: "jogadas" };
      if (B.open[i]) {
        /* atalho: num número com as bandeiras certas à volta, abre o resto */
        if (!B.num[i]) continue;
        const ns = vizinhos(w, h, i);
        if (ns.filter(j => B.flag[j]).length !== B.num[i]) continue;
        const todo = ns.filter(j => !B.flag[j] && !B.open[j]);
        if (todo.length) reveal(todo);
      } else if (a === 1) B.flag[i] ^= 1;
      else {
        if (!started) { if (i !== o.first) return { erro: "primeira casa" }; started = true; }
        reveal([i]);
      }
      if (state === "play" && B.open.reduce((s, v) => s + v, 0) === n - m) state = "won";
    }
    const opened = B.open.reduce((s, v) => s + v, 0);
    return { ok: true, won: state === "won", lost: state === "over", opened };
  }

  L.minas = { CFG, BASE, PAR, DAILY_DIFF, vizinhos, numeros, abrir, plantar, diario, pontos, repetir };
})(typeof globalThis !== "undefined" ? globalThis : self);
