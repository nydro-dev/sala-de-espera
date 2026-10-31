/* Sala de Espera — Dobra sem ecrã: deslizar, peças novas pela semente e repetição das jogadas (Fase 8).
   Corre no browser (js/games/dobra.js) e no servidor (functions/_lib/validar.js). */
(function (G) {
  "use strict";
  const L = G.SalaLogica;
  const VEC = { left: [0, -1], right: [0, 1], up: [-1, 0], down: [1, 0] };
  const DIRS = { l: "left", r: "right", u: "up", d: "down" };
  const UNDOS = 3;
  const SIZES = { s3: 3, s4: 4, s5: 5 };

  const at = (tiles, r, c) => tiles.find(t => t.r === r && t.c === c);
  /* Casas vazias, linha a linha (a ordem conta: a peça nova sai de uma posição desta lista). */
  function vazias(tiles, n) { const out = []; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!at(tiles, r, c)) out.push([r, c]); return out; }
  /* A n.ª peça nova do jogo: valor e casa, ou null se não houver espaço (e aí o contador não avança). */
  function nascer(tiles, n, seed, idx) {
    const e = vazias(tiles, n); if (!e.length) return null;
    const rnd = L.rng("dobra:" + seed + ":" + idx);
    const v = rnd() < .9 ? 2 : 4, [r, c] = e[rnd() * e.length | 0];
    return { v, r, c };
  }
  function podeMover(tiles, n) {
    if (vazias(tiles, n).length) return true;
    for (const t of tiles) { const a = at(tiles, t.r, t.c + 1), b = at(tiles, t.r + 1, t.c); if ((a && a.v === t.v) || (b && b.v === t.v)) return true; }
    return false;
  }
  /* Empurra as peças para um lado. Muda as peças no sítio: as que se juntam ficam marcadas com dead
     (a que fica com merged) até o jogo as tirar. */
  function deslizar(tiles, n, dir) {
    const vec = VEC[dir];
    let moved = false, gained = 0, best = 0;
    for (let line = 0; line < n; line++) {
      /* As peças da linha, pela ordem em que vão encostar. */
      const cells = [];
      for (let k = 0; k < n; k++) {
        const i = vec[1] === 1 || vec[0] === 1 ? n - 1 - k : k;
        const r = vec[0] ? i : line, c = vec[0] ? line : i;
        const t = at(tiles, r, c); if (t) cells.push(t);
      }
      let pos = 0, last = null;
      for (const t of cells) {
        const target = vec[1] === 1 || vec[0] === 1 ? n - 1 - pos : pos;
        if (last && last.v === t.v && !last.merged) {
          t.r = last.r; t.c = last.c; t.dead = true; last.merged = true; last.v *= 2;
          gained += last.v; best = Math.max(best, last.v); moved = true; last = null;
          continue;
        }
        const r = vec[0] ? target : line, c = vec[0] ? line : target;
        if (t.r !== r || t.c !== c) moved = true;
        t.r = r; t.c = c; last = t; pos++;
      }
    }
    return { moved, gained, best };
  }

  /* Repete um jogo inteiro: log é uma cadeia com l, r, u, d (jogadas) e z (desfazer).
     Devolve { ok, score, over, big } ou { erro }. */
  function repetir(o) {
    const n = SIZES[o.diff]; if (!n) return { erro: "tabuleiro" };
    if (L.seedNum(o.seed) < 0) return { erro: "semente" };
    if (typeof o.log !== "string" || o.log.length > 200000 || !/^[lrudz]*$/.test(o.log)) return { erro: "jogadas" };
    let tiles = [], spawns = 0, score = 0, prev = null, undos = UNDOS, over = false;
    const spawn = () => { const t = nascer(tiles, n, o.seed, spawns); if (t) { spawns++; tiles.push(t); } };
    spawn(); spawn();
    for (const ch of o.log) {
      if (over) return { erro: "jogadas depois do fim" };
      if (ch === "z") {
        if (!prev || !undos) return { erro: "desfazer" };
        ({ tiles, score, spawns } = JSON.parse(prev)); prev = null; undos--;
        continue;
      }
      const snap = JSON.stringify({ tiles: tiles.map(t => ({ v: t.v, r: t.r, c: t.c })), score, spawns });
      tiles.forEach(t => { delete t.merged; delete t.dead; });
      const res = deslizar(tiles, n, DIRS[ch]);
      if (!res.moved) return { erro: "jogada sem efeito" };
      prev = snap; score += res.gained;
      tiles = tiles.filter(t => !t.dead);
      spawn();
      if (!podeMover(tiles, n)) over = true;
    }
    return { ok: true, score, over, big: tiles.length ? Math.max(...tiles.map(t => t.v)) : 0 };
  }

  L.dobra = { UNDOS, SIZES, DIRS, vazias, nascer, podeMover, deslizar, repetir };
})(typeof globalThis !== "undefined" ? globalThis : self);
