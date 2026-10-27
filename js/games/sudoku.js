/* Sala de Espera — Sudoku */
(function () {
  "use strict";
  const { el, esc, fmtTime, fmtNum, shuffle, store, sound, vibrate, motion, toast, modal, ranking, ui, finish } = Sala;

  const DIFFS = [{ id: "beginner", label: "Iniciante" }, { id: "easy", label: "Fácil" }, { id: "medium", label: "Médio" }, { id: "hard", label: "Difícil" }, { id: "evil", label: "Diabólico" }];
  const BASE = { beginner: 500, easy: 1000, medium: 2000, hard: 3500, evil: 5000 };
  const SPAN = { beginner: 1200, easy: 2400, medium: 2400, hard: 2400, evil: 3600 }; /* segundos até o tempo esgotar a base */
  /* Casas dadas (objetivo) e técnicas exigidas pelo avaliador lógico: [mínima, máxima]. */
  const GIVENS = { beginner: 46, easy: 40, medium: 32, hard: 26, evil: 17 };
  const LEVEL = { beginner: [1, 1], easy: [1, 1], medium: [1, 2], hard: [2, 3], evil: [3, 4] };

  /* ---------- Gerador (solução única garantida) ---------- */
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
  function fill(g) { const i = g.indexOf(0); if (i < 0) return true; for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) { if (ok(g, i, v)) { g[i] = v; if (fill(g)) return true; g[i] = 0; } } return false; }
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

  function attempt(diff) {
    const sol = Array(81).fill(0); fill(sol);
    const g = sol.slice(); let givens = 81;
    for (const i of shuffle([...Array(81).keys()])) {
      if (givens <= GIVENS[diff]) break;
      const v = g[i]; g[i] = 0;
      if (count(g.slice(), 2) !== 1) g[i] = v; else givens--;
    }
    return { puzzle: g, solution: sol, level: rate(g) };
  }
  /* Gera até encontrar um puzzle que peça as técnicas certas (com limite de tempo, por segurança). */
  function generate(diff) {
    const [lo, hi] = LEVEL[diff] || [1, 4], t0 = Date.now();
    let best = null;
    for (let k = 0; k < 400; k++) {
      const a = attempt(diff);
      if (a.level >= lo && a.level <= hi) return a;
      if (!best || Math.abs(a.level - lo) < Math.abs(best.level - lo)) best = a;
      if (Date.now() - t0 > 2500) break;
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

  /* ---------- Estado ---------- */
  let S = null, els = null, hist = [], anims = {};
  function load() {
    let d = store.get("sudoku", null);
    if (!d) { /* dados da versão anterior */
      try { const old = JSON.parse(Sala.store.raw("sudoku") || "null"); if (old && old.puzzle) d = Object.assign({ hints: 0 }, old); } catch (e) {}
    }
    if (d && d.puzzle && d.solution) { S = Object.assign({ hints: 0, noteMode: false }, d); return true; }
    return false;
  }
  const save = () => { if (S) store.set("sudoku", S); };
  const progress = () => S && !S.done && S.vals.some((v, i) => v && !S.puzzle[i]);

  function newGame(diff) {
    diff = diff || (S && S.diff) || "medium";
    const { puzzle, solution } = generate(diff);
    S = { diff, puzzle, solution, vals: puzzle.slice(), notes: Array(81).fill(0), sel: puzzle.indexOf(0), errors: 0, hints: 0, time: 0, done: false, noteMode: false };
    hist = []; anims = {};
    save();
    if (els) { msg(""); syncDiff(); render(); animateBoardIn(); }
  }
  function askNew(diff) {
    if (!progress()) return newGame(diff);
    modal.open({
      title: "Começar outro jogo?",
      body: "<p>O jogo atual vai ficar sem efeito e não conta para o ranking.</p>",
      actions: [{ label: "Continuar este", onClick: () => syncDiff() }, { label: "Novo jogo", primary: true, onClick: () => newGame(diff) }],
      onClose: syncDiff
    });
  }

  /* ---------- Ecrã ---------- */
  function mount(c) {
    if (!S && !load()) newGame("medium");
    els = c; hist = []; anims = {};
    c.stats.innerHTML = ui.stat("Tempo", "s-time", "hl") + ui.stat("Erros", "s-err") + ui.stat("Pistas", "s-hint") + ui.stat("Recorde", "s-best");

    const grid = el("div", { class: "sgrid", role: "grid", "aria-label": "Tabuleiro de Sudoku" });
    for (let i = 0; i < 81; i++) {
      const cell = el("div", { class: "sc", role: "gridcell" });
      cell.addEventListener("click", () => { S.sel = i; sound.tap(); render(); });
      cell.addEventListener("animationend", () => { delete anims[i]; cell.classList.remove("pop", "wave"); cell.style.removeProperty("--d"); });
      grid.appendChild(cell);
    }
    const m = el("div", { class: "msg", id: "s-msg", role: "status" });
    c.board.append(grid, m);

    const diffSeg = ui.seg(DIFFS, S.diff, id => askNew(id), "Dificuldade"); diffSeg.classList.add("wrap");
    diffSeg.id = "s-diff";
    const top = el("div", { class: "row" });
    const bNew = el("button", { class: "btn", type: "button" }, ui.ICON.plus + "Novo jogo");
    bNew.onclick = () => askNew(S.diff);
    top.append(bNew);

    const pad = el("div", { class: "pad", id: "s-pad" });
    for (let v = 1; v <= 9; v++) {
      const b = el("button", { type: "button", "aria-label": "Número " + v }, v + '<span class="left"></span>');
      b.onclick = () => input(v);
      pad.appendChild(b);
    }
    const tools = el("div", { class: "tools" });
    const tool = (id, icon, label, fn) => { const b = el("button", { class: "btn", type: "button", id }, icon + "<span>" + label + "</span>"); b.onclick = fn; tools.appendChild(b); return b; };
    tool("s-notes", ui.ICON.pencil, "Notas", () => { S.noteMode = !S.noteMode; sound.tap(); save(); render(); });
    tool("s-erase", ui.ICON.erase, "Apagar", erase);
    tool("s-undo", ui.ICON.undo, "Desfazer", undo);
    tool("s-hintb", ui.ICON.bulb, "Pista", hint);

    const kb = el("p", { class: "hint for-mouse" }, "Teclado: setas, <kbd>1</kbd>–<kbd>9</kbd>, <kbd>N</kbd> notas, <kbd>⌫</kbd> apagar, <kbd>Ctrl</kbd>+<kbd>Z</kbd> desfazer.");
    c.controls.append(diffSeg, pad, tools, top, kb);

    if (S.done) msg("Resolvido. Começa outro quando quiseres.");
    render();
    animateBoardIn();
  }
  function unmount() { save(); els = null; }
  function syncDiff() {
    const s = document.getElementById("s-diff"); if (!s) return;
    s.querySelectorAll("button").forEach((b, k) => b.setAttribute("aria-pressed", String(DIFFS[k].id === S.diff)));
  }
  function msg(t, bad) { const m = document.getElementById("s-msg"); if (m) { m.textContent = t; m.className = "msg" + (bad ? " bad" : ""); } }

  function render() {
    if (!els) return;
    const grid = els.board.querySelector(".sgrid"), cells = grid.children;
    const sv = S.sel >= 0 ? S.vals[S.sel] : 0;
    const peers = S.sel >= 0 ? new Set(PEERS[S.sel]) : new Set();
    for (let i = 0; i < 81; i++) {
      const c = cells[i], v = S.vals[i];
      let cls = "sc";
      if (S.puzzle[i]) cls += " given";
      if (peers.has(i)) cls += " peer";
      if (sv && v === sv && i !== S.sel) cls += " same";
      if (v && !S.puzzle[i] && v !== S.solution[i]) cls += " err";
      if (i === S.sel) cls += " sel";
      if (anims[i]) cls += " " + anims[i];
      c.className = cls;
      if (v) { if (c.textContent !== String(v) || c.firstChild && c.firstChild.nodeType !== 3) c.textContent = v; }
      else if (S.notes[i]) {
        let h = '<div class="notes">';
        for (let n = 1; n <= 9; n++) h += "<span" + (n === sv ? ' class="m"' : "") + ">" + (S.notes[i] & (1 << n) ? n : "") + "</span>";
        c.innerHTML = h + "</div>";
      } else if (c.textContent) c.textContent = "";
      const r = rowOf(i) + 1, col = colOf(i) + 1;
      c.setAttribute("aria-label", "Linha " + r + ", coluna " + col + (v ? ", " + v : ", vazia"));
      c.setAttribute("aria-selected", String(i === S.sel));
    }
    const pad = document.getElementById("s-pad");
    [...pad.children].forEach((b, k) => {
      const v = k + 1; let n = 0;
      for (let i = 0; i < 81; i++) if (S.vals[i] === v && v === S.solution[i]) n++;
      b.disabled = n >= 9 || S.done;
      b.querySelector(".left").textContent = 9 - n || "";
    });
    pad.classList.toggle("notes-on", !!S.noteMode);
    const nb = document.getElementById("s-notes");
    nb.classList.toggle("on", !!S.noteMode); nb.setAttribute("aria-pressed", String(!!S.noteMode));
    nb.querySelector("span").textContent = S.noteMode ? "Notas: sim" : "Notas";
    stats();
  }
  function stats() {
    if (!els) return;
    const set = (id, t) => { const n = document.getElementById(id); if (n) n.textContent = t; };
    set("s-time", fmtTime(S.time)); set("s-err", S.errors); set("s-hint", S.hints);
    const b = ranking.best("sudoku", S.diff); set("s-best", b ? fmtNum(b.score) : "—");
  }

  /* ---------- Animações ---------- */
  function anim(i, cls, delay) {
    if (!motion() || !els) return;
    const c = els.board.querySelector(".sgrid").children[i];
    c.classList.remove("pop", "wave"); void c.offsetWidth;
    anims[i] = cls; c.style.setProperty("--d", (delay || 0) + "ms"); c.classList.add(cls);
  }
  function animateBoardIn() {
    if (!motion() || !els) return;
    for (let i = 0; i < 81; i++) if (S.puzzle[i]) anim(i, "pop", (rowOf(i) + colOf(i)) * 18);
  }
  const unitDone = u => u.every(i => S.vals[i] === S.solution[i]);

  /* ---------- Ações ---------- */
  function push() { hist.push({ vals: S.vals.slice(), notes: S.notes.slice() }); if (hist.length > 300) hist.shift(); }
  function input(v) {
    const i = S.sel; if (i < 0 || S.puzzle[i] || S.done) return;
    if (S.noteMode) {
      if (S.vals[i]) return;
      push(); S.notes[i] ^= (1 << v); sound.note();
    } else if (S.vals[i] === v) {
      push(); S.vals[i] = 0; sound.tap();
    } else {
      const before = unitsOf(i).map(unitDone);
      push(); S.vals[i] = v; S.notes[i] = 0;
      if (v !== S.solution[i]) {
        S.errors++; sound.error(); vibrate(60); anim(i, "pop");
        if (!(S.errors % 3)) toast(S.errors + " erros: cada um custa pontos.");
      } else {
        for (const p of PEERS[i]) S.notes[p] &= ~(1 << v);
        anim(i, "pop"); sound.place(); vibrate(10);
        const fresh = unitsOf(i).filter((u, k) => !before[k] && unitDone(u));
        if (fresh.length && !isSolved()) {
          setTimeout(() => sound.line(), 90); vibrate([15, 40, 15]);
          const seen = new Set();
          fresh.forEach(u => u.forEach(j => { if (!seen.has(j)) { seen.add(j); anim(j, "wave", (Math.abs(rowOf(j) - rowOf(i)) + Math.abs(colOf(j) - colOf(i))) * 45); } }));
        }
      }
    }
    check(); save(); render();
  }
  function erase() {
    const i = S.sel; if (i < 0 || S.puzzle[i] || S.done || (!S.vals[i] && !S.notes[i])) return;
    push(); S.vals[i] = 0; S.notes[i] = 0; sound.tap(); save(); render();
  }
  function undo() {
    if (S.done) return;
    const h = hist.pop(); if (!h) { toast("Nada para desfazer."); return; }
    S.vals = h.vals; S.notes = h.notes; sound.tap(); save(); render();
  }
  function hint() {
    if (S.done) return;
    let i = S.sel;
    if (i < 0 || S.vals[i] === S.solution[i]) {
      const cand = []; for (let k = 0; k < 81; k++) if (S.vals[k] !== S.solution[k]) cand.push(k);
      if (!cand.length) return; i = cand[Math.random() * cand.length | 0];
    }
    push(); S.vals[i] = S.solution[i]; S.notes[i] = 0; S.sel = i; S.hints++;
    for (const p of PEERS[i]) S.notes[p] &= ~(1 << S.solution[i]);
    sound.place(); anim(i, "pop");
    msg("Pista usada: custa " + fmtNum(BASE[S.diff] * 0.1) + " pontos.");
    check(); save(); render();
  }
  const isSolved = () => S.vals.every((v, i) => v === S.solution[i]);
  function check() {
    if (!isSolved()) return;
    S.done = true; save();
    if (motion() && els) for (let i = 0; i < 81; i++) anim(i, "wave", (rowOf(i) + colOf(i)) * 35);
    const sc = score(S), dl = DIFFS.find(d => d.id === S.diff).label;
    msg("Resolvido em " + fmtTime(S.time) + ".");
    setTimeout(() => finish({
      game: "sudoku", diff: S.diff, diffLabel: dl, title: "Sudoku resolvido", score: sc.total, time: S.time,
      breakdown: [["Base (" + dl + ")", fmtNum(sc.base)], ["Tempo " + fmtTime(S.time), "−" + fmtNum(sc.tPen)], ["Erros × " + S.errors, "−" + fmtNum(sc.ePen)], ["Pistas × " + S.hints, "−" + fmtNum(sc.hPen)]],
      extra: { errors: S.errors, hints: S.hints },
      onNew: () => newGame(S.diff)
    }), motion() ? 900 : 100);
  }

  function onKey(e) {
    const k = e.key; let i = S.sel < 0 ? 0 : S.sel;
    if (/^[1-9]$/.test(k)) { input(+k); e.preventDefault(); }
    else if (k === "Backspace" || k === "Delete" || k === "0") { erase(); e.preventDefault(); }
    else if (k === "n" || k === "N") { S.noteMode = !S.noteMode; save(); render(); }
    else if ((k === "z" || k === "Z") && (e.ctrlKey || e.metaKey)) { undo(); e.preventDefault(); }
    else if (k.startsWith("Arrow")) {
      const r = rowOf(i), c = colOf(i);
      if (k === "ArrowUp") i = ((r + 8) % 9) * 9 + c; if (k === "ArrowDown") i = ((r + 1) % 9) * 9 + c;
      if (k === "ArrowLeft") i = r * 9 + (c + 8) % 9; if (k === "ArrowRight") i = r * 9 + (c + 1) % 9;
      S.sel = i; render(); e.preventDefault();
    }
  }
  function tick() {
    if (!S || S.done) return;
    S.time++;
    const t = document.getElementById("s-time"); if (t) t.textContent = fmtTime(S.time);
    if (S.time % 5 === 0) save();
  }

  function help() {
    return "<h4>Objetivo</h4><p>Preencher a grelha de 9×9 de modo que cada linha, cada coluna e cada bloco de 3×3 tenham os números de 1 a 9, sem repetir. Cada jogo tem uma só solução.</p>" +
      "<h4>Dificuldades</h4><ul><li><b>Iniciante e Fácil:</b> resolvem-se só com casas óbvias (o único número possível numa casa, ou a única casa possível para um número).</li>" +
      "<li><b>Médio:</b> menos ajudas; às vezes pede candidatos alinhados ou pares.</li><li><b>Difícil:</b> pede sempre técnicas como candidatos alinhados, pares e trios, ou asa-X.</li>" +
      "<li><b>Diabólico:</b> o mínimo de casas dadas e técnicas avançadas (asa-X, peixe-espada, asa-XY ou mais).</li></ul>" +
      "<h4>Controlos</h4><ul>" +
      "<li><b>Toque ou rato:</b> escolher a casa e depois o número no teclado numérico do ecrã.</li>" +
      "<li><b>Notas:</b> com as notas ligadas, os números ficam como apontamentos pequenos na casa.</li>" +
      "<li><b>Teclado:</b> setas para mover, <kbd>1</kbd>–<kbd>9</kbd> para escrever, <kbd>N</kbd> para as notas, <kbd>⌫</kbd> para apagar, <kbd>Ctrl</kbd>+<kbd>Z</kbd> para desfazer.</li>" +
      "<li>O número pequeno por baixo de cada tecla diz quantos faltam colocar.</li></ul>" +
      "<h4>Pontuação</h4><ul>" +
      "<li>Base: 500 no Iniciante, 1000 no Fácil, 2000 no Médio, 3500 no Difícil e 5000 no Diabólico.</li>" +
      "<li>O tempo vai descontando: a base esgota-se aos 20 minutos no Iniciante, aos 40 no Fácil, Médio e Difícil, e aos 60 no Diabólico.</li>" +
      "<li>Cada erro tira 5 % da base; cada pista, 10 %.</li>" +
      "<li>Nunca desce abaixo de 10 % da base. O top 10 de cada dificuldade fica no ranking.</li></ul>";
  }

  Sala.registerGame({
    id: "sudoku", name: "Sudoku", ready: true, diffs: DIFFS,
    desc: "Números de 1 a 9, sem repetir. Cinco dificuldades, sempre com solução única.",
    art: '<svg viewBox="0 0 36 36"><rect x="2" y="2" width="32" height="32" rx="5" fill="var(--surface)" stroke="var(--ink)" stroke-width="2"/><path d="M12.7 2v32M23.3 2v32M2 12.7h32M2 23.3h32" stroke="var(--ink)" stroke-width="1.4"/><rect x="13.4" y="13.4" width="9.2" height="9.2" fill="var(--blue)"/><text x="7.3" y="10.4" font-size="7.5" font-weight="700" text-anchor="middle" fill="var(--ink)" font-family="Roboto,sans-serif">5</text><text x="18" y="21" font-size="7.5" font-weight="700" text-anchor="middle" fill="var(--on-accent)" font-family="Roboto,sans-serif">3</text><text x="28.7" y="31.6" font-size="7.5" font-weight="700" text-anchor="middle" fill="var(--blue-ink)" font-family="Roboto,sans-serif">8</text></svg>',
    lastDiff: () => (S || load() && S) ? S.diff : "medium",
    meta() {
      const out = [];
      if (S || load()) { if (progress()) out.push({ text: "Jogo a meio · " + fmtTime(S.time), cls: "blue" }); }
      const b = ranking.best("sudoku", (S && S.diff) || "medium");
      if (b) out.push({ text: "Recorde " + fmtNum(b.score) + " pts" });
      return out;
    },
    help, mount, unmount, tick, onKey, save
  });
})();
