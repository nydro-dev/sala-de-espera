/* Sala de Espera — Solitário (Klondike, 3 cartas) sem ecrã: baralho pela semente, regras, pontos e
   repetição das jogadas (Fase 8). O estado S é o mesmo objeto que o jogo guarda.
   Corre no browser (js/games/solitario.js) e no servidor (functions/_lib/validar.js). */
(function (G) {
  "use strict";
  const L = G.SalaLogica, { shuffle } = L;
  const rk = c => c % 13, st = c => (c / 13) | 0, isRed = c => st(c) === 1 || st(c) === 2;
  /* Pontos por jogada; no fim junta-se o bónus de tempo. */
  const PTS = { toTab: 5, toFound: 10, flip: 5, fromFound: -15, recycle: -20, undo: -10 };
  const BONUS = 1000, BONUS_T = 900; /* o bónus desce de 1000 a 0 em 15 minutos */
  const HIST = 60;
  const top = a => a[a.length - 1];

  function fresh(rnd) {
    const d = shuffle([...Array(52).keys()], rnd);
    const tab = [];
    for (let i = 0; i < 7; i++) { const col = []; for (let j = 0; j <= i; j++) col.push({ c: d.pop(), up: j === i }); tab.push(col); }
    return { diff: "d3", stock: d, waste: [], found: [[], [], [], []], tab, score: 0, time: 0, moves: 0, passes: 0, undos: 0, over: false, won: false, hist: [] };
  }
  const addPts = (S, n) => { S.score = Math.max(0, S.score + n); };
  function snapshot(S) {
    S.hist.push(JSON.stringify({ stock: S.stock, waste: S.waste, found: S.found, tab: S.tab, score: S.score, moves: S.moves, passes: S.passes }));
    if (S.hist.length > HIST) S.hist.shift();
  }

  /* ---------- Regras ---------- */
  function canFound(S, c, i) { const f = S.found[i]; return f.length ? st(top(f)) === st(c) && rk(c) === rk(top(f)) + 1 : rk(c) === 0; }
  function canTab(S, c, i) {
    const col = S.tab[i];
    if (!col.length) return rk(c) === 12;
    const t = top(col);
    return t.up && isRed(t.c) !== isRed(c) && rk(c) === rk(t.c) - 1;
  }
  function cardsAt(S, src) {
    if (src.type === "waste") return [top(S.waste)];
    if (src.type === "found") return [top(S.found[src.i])];
    return S.tab[src.i].slice(src.k).map(o => o.c);
  }
  function legal(S, src, dst) {
    const cards = cardsAt(S, src), c = cards[0];
    if (dst.type === "found") return src.type !== "found" && cards.length === 1 && canFound(S, c, dst.i);
    if (src.type === "tab" && src.i === dst.i) return false;
    return canTab(S, c, dst.i);
  }
  /* Uma origem que se pode mexer (para o servidor, que não confia em quem manda as jogadas). */
  function movable(S, src) {
    if (!src) return false;
    if (src.type === "waste") return S.waste.length > 0;
    if (src.type === "found") return Number.isInteger(src.i) && src.i >= 0 && src.i < 4 && S.found[src.i].length > 0;
    if (src.type === "tab") { const col = Number.isInteger(src.i) && src.i >= 0 && src.i < 7 && S.tab[src.i]; return !!col && Number.isInteger(src.k) && src.k >= 0 && src.k < col.length && col[src.k].up; }
    return false;
  }

  /* ---------- Jogadas (mudam S) ---------- */
  /* Leva a carta (ou o grupo) de src para dst. Devolve false, ou { flip } com a carta que se virou (−1 se nenhuma). */
  function mover(S, src, dst) {
    if (!legal(S, src, dst)) return false;
    snapshot(S);
    let cards;
    if (src.type === "waste") cards = [S.waste.pop()];
    else if (src.type === "found") cards = [S.found[src.i].pop()];
    else cards = S.tab[src.i].splice(src.k).map(o => o.c);
    if (dst.type === "found") { S.found[dst.i].push(cards[0]); addPts(S, PTS.toFound); }
    else {
      S.tab[dst.i].push(...cards.map(c => ({ c, up: true })));
      if (src.type === "waste") addPts(S, PTS.toTab);
      if (src.type === "found") addPts(S, PTS.fromFound);
    }
    let flip = -1;
    if (src.type === "tab") {
      const t = top(S.tab[src.i]);
      if (t && !t.up) { t.up = true; addPts(S, PTS.flip); flip = t.c; }
    }
    S.moves++;
    return { flip };
  }
  /* Vira 3 cartas do baralho, ou volta a pô-lo quando acaba. Devolve false, { recycled: true } ou { drawn }. */
  function virar(S) {
    if (!S.stock.length) {
      if (!S.waste.length) return false;
      snapshot(S);
      S.stock = S.waste.reverse(); S.waste = [];
      S.passes++; addPts(S, PTS.recycle); S.moves++;
      return { recycled: true };
    }
    snapshot(S);
    const drawn = [];
    for (let k = 0; k < 3 && S.stock.length; k++) { const c = S.stock.pop(); S.waste.push(c); drawn.push(c); }
    S.moves++;
    return { drawn };
  }
  function desfazer(S) {
    if (!S.hist.length) return false;
    const p = JSON.parse(S.hist.pop());
    Object.assign(S, p); S.undos++; addPts(S, PTS.undo);
    return true;
  }
  const ganhou = S => S.found.every(f => f.length === 13);
  const bonus = time => Math.max(0, Math.round(BONUS * (1 - time / BONUS_T)));

  /* Repete um jogo a partir do baralho. log: "d" (virar o baralho), "u" (desfazer) ou
     [origem, i, k, destino, j] com origem e destino "w" (cartas viradas), "f" (fundações) ou "t" (colunas).
     Devolve { ok, won, score (sem o bónus), found, moves } ou { erro }. */
  const TYPES = { w: "waste", f: "found", t: "tab" };
  function repetir(o) {
    if (!Array.isArray(o.log) || o.log.length > 20000) return { erro: "jogadas" };
    const S = fresh(o.rnd);
    for (const e of o.log) {
      if (ganhou(S)) return { erro: "jogadas depois do fim" };
      if (e === "d") { if (!virar(S)) return { erro: "baralho vazio" }; continue; }
      if (e === "u") { if (!desfazer(S)) return { erro: "desfazer" }; continue; }
      if (!Array.isArray(e) || e.length !== 5 || !TYPES[e[0]] || (e[3] !== "f" && e[3] !== "t")) return { erro: "jogadas" };
      const src = { type: TYPES[e[0]], i: e[1], k: e[2] }, dst = { type: TYPES[e[3]], i: e[4] };
      if (!Number.isInteger(dst.i) || dst.i < 0 || dst.i >= (dst.type === "found" ? 4 : 7)) return { erro: "jogadas" };
      if (!movable(S, src) || !mover(S, src, dst)) return { erro: "jogada ilegal" };
    }
    return { ok: true, won: ganhou(S), score: S.score, found: S.found.reduce((a, f) => a + f.length, 0), moves: S.moves };
  }

  L.solitario = { PTS, BONUS, BONUS_T, HIST, rk, st, isRed, top, fresh, canFound, canTab, cardsAt, legal, movable, mover, virar, desfazer, ganhou, bonus, repetir };
})(typeof globalThis !== "undefined" ? globalThis : self);
