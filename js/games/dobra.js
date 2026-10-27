/* Sala de Espera — Dobra (juntar peças iguais, que dobram de valor) */
(function () {
  "use strict";
  const { el, esc, fmtNum, fmtTime, store, sound, vibrate, motion, fx, toast, modal, ranking, ui, finish } = Sala;

  /* O jogo chamava-se "2048" (id g2048): passa o jogo a meio, o ranking, as estatísticas e a ajuda vista
     para o nome novo. Os dados antigos ficam onde estavam (não se apaga nada). */
  (function migrate() {
    if (store.get("migr:dobra", false)) return;
    const old = store.get("g2048", null); if (old && !store.get("dobra", null)) store.set("dobra", old);
    const rank = store.get("rank", {}); let ch = false;
    for (const k of Object.keys(rank)) if (k.startsWith("g2048:") && !rank["dobra:" + k.slice(6)]) { rank["dobra:" + k.slice(6)] = rank[k]; ch = true; }
    if (ch) store.set("rank", rank);
    const st = store.get("stats", {}); if (st.g2048 && !st.dobra) { st.dobra = st.g2048; store.set("stats", st); }
    if (store.get("seenHelp:g2048", false)) store.set("seenHelp:dobra", true);
    store.set("migr:dobra", true);
  })();

  const DIFFS = [{ id: "s3", label: "3×3", n: 3 }, { id: "s4", label: "4×4", n: 4 }, { id: "s5", label: "5×5", n: 5 }];
  const sizeOf = id => DIFFS.find(d => d.id === id).n;
  const UNDOS = 3, SLIDE = 110;

  let S = null, els = null, busy = false, nextId = 1, touch = null, duelD = null;
  const KEY = () => duelD ? "dobra:duelo" : "dobra";
  /* Peças: { id, v, r, c }. Guardadas tal como estão, para retomar o jogo.
     As peças novas saem da semente do jogo (a n.ª peça usa "semente:n"): o mesmo jogo dá para mandar num duelo,
     e desfazer não muda a peça que vem a seguir. */
  function fresh(diff, seed) { return { diff, n: sizeOf(diff), seed: seed || Sala.duel.newSeed(), spawns: 0, tiles: [], score: 0, time: 0, over: false, reached: false, undos: UNDOS, prev: null, moves: 0 }; }
  function load() {
    const d = store.get(KEY(), null);
    if (d && d.tiles && d.n && (!duelD || d.bid === duelD.bid)) {
      S = d; nextId = Math.max(1, ...S.tiles.map(t => t.id + 1));
      if (!S.seed) { S.seed = Sala.duel.newSeed(); S.spawns = 0; S.legacy = true; } /* jogo começado antes das sementes: não dá para desafiar */
      return true;
    }
    return false;
  }
  const save = () => { if (S) store.set(KEY(), S); };
  const lastDiff = () => (S && !duelD && S.diff) || store.get("dobra", {}).diff || "s4";

  const at = (r, c) => S.tiles.find(t => t.r === r && t.c === c);
  function empty() { const out = []; for (let r = 0; r < S.n; r++) for (let c = 0; c < S.n; c++) if (!at(r, c)) out.push([r, c]); return out; }
  function spawn() {
    const e = empty(); if (!e.length) return null;
    const rnd = Sala.rng("dobra:" + S.seed + ":" + (S.spawns++));
    const v = rnd() < .9 ? 2 : 4, [r, c] = e[rnd() * e.length | 0];
    const t = { id: nextId++, v, r, c, born: true };
    S.tiles.push(t); return t;
  }
  function newGame(diff) {
    S = duelD ? fresh(duelD.d, duelD.b) : fresh(diff || lastDiff()); nextId = 1;
    if (duelD) S.bid = duelD.bid;
    spawn(); spawn();
    save(); if (els) { syncDiff(); build(); render(); msg(""); }
  }
  function askNew(diff) {
    if (!S || S.over || !S.moves) return newGame(diff);
    modal.open({
      title: "Começar outro jogo?",
      body: "<p>Este jogo (" + fmtNum(S.score) + " pontos) fica sem efeito e não entra no ranking.</p>",
      actions: [{ label: "Continuar este", onClick: () => syncDiff() }, { label: "Novo jogo", primary: true, onClick: () => newGame(diff) }],
      onClose: syncDiff
    });
  }

  /* ---------- Movimento ---------- */
  function canMove() {
    if (empty().length) return true;
    for (const t of S.tiles) { const a = at(t.r, t.c + 1), b = at(t.r + 1, t.c); if ((a && a.v === t.v) || (b && b.v === t.v)) return true; }
    return false;
  }
  function move(dir) {
    if (busy || S.over) return;
    const n = S.n, vec = { left: [0, -1], right: [0, 1], up: [-1, 0], down: [1, 0] }[dir];
    const snap = JSON.stringify({ tiles: S.tiles, score: S.score, spawns: S.spawns });
    S.tiles.forEach(t => { delete t.born; delete t.merged; delete t.dead; });
    let moved = false, gained = 0, best = 0;
    for (let line = 0; line < n; line++) {
      /* As peças da linha, pela ordem em que vão encostar. */
      const cells = [];
      for (let k = 0; k < n; k++) {
        const i = vec[1] === 1 || vec[0] === 1 ? n - 1 - k : k;
        const r = vec[0] ? i : line, c = vec[0] ? line : i;
        const t = at(r, c); if (t) cells.push(t);
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
    if (!moved) { sound.tap(); return; }
    S.prev = snap; S.moves++; S.score += gained;
    busy = true;
    const finishMove = () => {
      S.tiles = S.tiles.filter(t => !t.dead);
      spawn();
      busy = false;
      if (gained) { best >= 128 ? sound.line() : sound.place(); vibrate(best >= 256 ? 25 : 8); } else sound.tap();
      if (best >= 2048 && !S.reached) { S.reached = true; fx.confetti(); sound.win(); toast("Chegaste ao 2048! Podes continuar a jogar."); }
      if (!canMove()) gameOver();
      save(); render();
    };
    if (motion() && els) { render(true); setTimeout(finishMove, SLIDE); } else finishMove();
  }
  function undo() {
    if (busy || S.over || !S.prev) return;
    if (!S.undos) { toast("Já usaste os " + UNDOS + " desfazer deste jogo."); return; }
    const p = JSON.parse(S.prev); S.tiles = p.tiles; S.score = p.score; if (p.spawns != null) S.spawns = p.spawns; S.prev = null; S.undos--;
    S.tiles.forEach(t => { delete t.born; delete t.merged; delete t.dead; });
    sound.tap(); save(); build(); render();
  }
  function gameOver() {
    S.over = true; save();
    const big = Math.max(...S.tiles.map(t => t.v)), dl = DIFFS.find(d => d.id === S.diff).label;
    msg("Sem jogadas possíveis. Maior peça: " + big + "." + (duelD ? " Duelo terminado." : ""), true);
    const dD = duelD;
    setTimeout(() => finish({
      game: "dobra", diff: S.diff, diffLabel: dl, title: "Fim de jogo", score: S.score, time: S.time, duel: dD, progress: big,
      breakdown: [["Tabuleiro", dl], ["Maior peça", String(big)], ["Jogadas", fmtNum(S.moves)], ["Tempo", fmtTime(S.time)]],
      extra: { big }, onNew: () => newGame(S.diff),
      challenge: S.legacy ? null : { d: S.diff, b: S.seed, p: big }
    }), motion() ? 700 : 100);
  }

  /* ---------- Ecrã ---------- */
  function mount(c, opts) {
    const wantDuel = (opts && opts.duel) || null;
    if (!!wantDuel !== !!duelD || (wantDuel && duelD && wantDuel.bid !== duelD.bid)) { save(); S = null; }
    duelD = wantDuel;
    if (!S && !load()) newGame(lastDiff());
    els = c; busy = false;
    c.stats.innerHTML = ui.stat("Pontos", "t-score", "hl") + ui.stat("Recorde", "t-best") + ui.stat("Maior peça", "t-big") + ui.stat("Desfazer", "t-undo");
    const board = el("div", { class: "t-board", id: "t-board", role: "grid", "aria-label": "Tabuleiro" });
    c.board.append(board, el("div", { class: "msg", id: "t-msg", role: "status" }));
    const seg = duelD ? Sala.duel.tag(duelD) : ui.seg(DIFFS, S.diff, id => askNew(id), "Tabuleiro"); if (!duelD) seg.id = "t-diff";
    const row = el("div", { class: "casino-actions" });
    const bUndo = el("button", { class: "btn", type: "button", id: "t-undob" }, ui.ICON.undo + "Desfazer"); bUndo.onclick = undo;
    const bNew = el("button", { class: "btn", type: "button" }, ui.ICON.plus + (duelD ? "Jogo normal" : "Novo jogo")); bNew.onclick = () => duelD ? Sala.go("dobra") : askNew(S.diff);
    row.append(bUndo, bNew);
    const tip = el("p", { class: "hint" }, '<span class="for-touch">Desliza o dedo no tabuleiro para mover as peças.</span><span class="for-mouse">Setas ou <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> para mover; também dá para arrastar com o rato. <kbd>Ctrl</kbd>+<kbd>Z</kbd> desfaz.</span>');
    c.controls.append(seg, row, tip);
    /* Gestos: deslizar com o dedo ou arrastar com o rato */
    board.addEventListener("pointerdown", e => { touch = { x: e.clientX, y: e.clientY }; board.setPointerCapture && board.setPointerCapture(e.pointerId); });
    board.addEventListener("pointerup", e => {
      if (!touch) return; const dx = e.clientX - touch.x, dy = e.clientY - touch.y; touch = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
    });
    board.addEventListener("pointercancel", () => { touch = null; });
    build(); render();
    if (S.over) msg(duelD ? "Duelo terminado." : "Sem jogadas possíveis. Começa outro jogo.", true);
    else if (duelD) msg("As mesmas peças, pela mesma ordem, que " + duelD.n + " teve.");
    addEventListener("resize", layout);
  }
  function unmount() { save(); removeEventListener("resize", layout); els = null; if (duelD) { S = null; duelD = null; } }
  function syncDiff() { const s = document.getElementById("t-diff"); if (s) s.querySelectorAll("button").forEach((b, k) => b.setAttribute("aria-pressed", String(DIFFS[k].id === S.diff))); }
  function msg(t, bad) { const m = document.getElementById("t-msg"); if (m) { m.textContent = t; m.className = "msg" + (bad ? " bad" : ""); } }

  function build() {
    const b = document.getElementById("t-board"); if (!b) return;
    b.innerHTML = ""; b.style.setProperty("--n", S.n);
    for (let i = 0; i < S.n * S.n; i++) b.appendChild(el("div", { class: "t-slot" }));
    layout();
  }
  let geo = { cell: 0, gap: 0 };
  function layout() {
    const b = document.getElementById("t-board"); if (!b) return;
    const w = b.clientWidth, gap = Math.max(6, Math.round(w * (S.n === 5 ? .022 : .028))), cell = (w - gap * (S.n + 1)) / S.n;
    geo = { cell, gap };
    b.style.setProperty("--cell", cell + "px"); b.style.setProperty("--gap", gap + "px");
    [...b.querySelectorAll(".t-slot")].forEach((s, i) => { s.style.transform = pos(Math.floor(i / S.n), i % S.n); });
    b.querySelectorAll(".tile").forEach(t => { const d = S.tiles.find(x => x.id === +t.dataset.id); if (d) t.style.transform = pos(d.r, d.c); });
  }
  const pos = (r, c) => "translate(" + (geo.gap + c * (geo.cell + geo.gap)) + "px," + (geo.gap + r * (geo.cell + geo.gap)) + "px)";
  function render(sliding) {
    if (!els) return;
    const b = document.getElementById("t-board");
    const have = new Map([...b.querySelectorAll(".tile")].map(t => [+t.dataset.id, t]));
    for (const t of S.tiles) {
      let node = have.get(t.id);
      if (!node) { node = el("div", { class: "tile", "data-id": t.id }, "<span></span>"); node.style.transform = pos(t.r, t.c); b.appendChild(node); }
      have.delete(t.id);
      node.style.transform = pos(t.r, t.c);
      node.style.zIndex = t.dead ? 1 : 2;
      if (!sliding) {
        const v = t.v;
        node.className = "tile v" + Math.min(v, 4096) + (String(v).length > 3 ? " d" + String(v).length : "") + (t.born ? " born" : "") + (t.merged ? " merged" : "");
        node.firstChild.textContent = v;
        node.setAttribute("aria-label", String(v));
      }
    }
    if (!sliding) have.forEach(n => n.remove());
    const set = (id, v) => { const n = document.getElementById(id); if (n) n.textContent = v; };
    set("t-score", fmtNum(S.score));
    const best = ranking.best("dobra", S.diff); set("t-best", best ? fmtNum(Math.max(best.score, S.score)) : (S.score ? fmtNum(S.score) : "—"));
    set("t-big", S.tiles.length ? Math.max(...S.tiles.map(t => t.v)) : "—");
    set("t-undo", S.undos + " / " + UNDOS);
    const u = document.getElementById("t-undob"); if (u) u.disabled = !S.prev || !S.undos || S.over;
  }

  function onKey(e) {
    const k = e.key, m = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", a: "left", d: "right", w: "up", s: "down", A: "left", D: "right", W: "up", S: "down" }[k];
    if ((k === "z" || k === "Z") && (e.ctrlKey || e.metaKey)) { undo(); e.preventDefault(); return; }
    if (m) { move(m); e.preventDefault(); }
  }
  function tick() { if (S && !S.over && S.moves) { S.time++; if (S.time % 10 === 0) save(); } }

  function help() {
    return "<h4>Objetivo</h4><p>Juntar peças com o mesmo número para fazer peças cada vez maiores. Cada jogada empurra todas as peças para um lado; duas peças iguais que se encontram juntam-se numa só, com o dobro do valor. A meta é chegar ao 2048, mas dá para continuar depois.</p>" +
      "<h4>Controlos</h4><ul><li><b>Toque:</b> desliza o dedo no tabuleiro.</li><li><b>Teclado:</b> setas ou <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>; <kbd>Ctrl</kbd>+<kbd>Z</kbd> desfaz.</li><li><b>Rato:</b> arrasta no tabuleiro.</li>" +
      "<li><b>Desfazer:</b> anula a última jogada, até " + UNDOS + " vezes por jogo.</li></ul>" +
      "<h4>Pontuação</h4><ul><li>Cada junção soma o valor da peça nova (dois 8 dão 16 pontos).</li><li>O jogo acaba quando não houver jogadas, e aí entra no top 10 do tabuleiro escolhido.</li></ul>" +
      "<h4>Duelo</h4><p>No fim, <b>Desafiar</b> manda um link com o mesmo tabuleiro: as peças novas saem pela mesma ordem, enquanto as jogadas forem as mesmas. Ganha quem fizer mais pontos; em empate, quem fez a maior peça.</p>";
  }

  Sala.registerGame({
    statsKind: "score",
    id: "dobra", name: "Dobra", ready: true, diffs: DIFFS.map(d => ({ id: d.id, label: d.label })),
    desc: "Juntar peças iguais, que dobram de valor, até ao tabuleiro encher.",
    art: '<svg viewBox="0 0 36 36"><rect x="2" y="2" width="15" height="15" rx="3" fill="var(--blue)"/><rect x="19" y="2" width="15" height="15" rx="3" fill="var(--yellow)"/><rect x="2" y="19" width="15" height="15" rx="3" fill="var(--cover)"/><rect x="19" y="19" width="15" height="15" rx="3" fill="var(--ink)"/><text x="26.5" y="30.5" font-size="9" font-weight="900" text-anchor="middle" fill="var(--yellow)" font-family="Roboto,sans-serif">×2</text></svg>',
    lastDiff,
    duel: true,
    /* Código curto: tabuleiro, semente, pontos e maior peça (em potência de 2). O tempo não conta na Dobra. */
    code: {
      pre: "DOB", bits: [2, 16, 22, 5],
      pack(x) {
        const di = DIFFS.findIndex(d => d.id === x.d), sd = Sala.duelCode.seedNum(x.b), p = Math.round(x.p) || 0, e = p ? Math.log2(p) : 0;
        if (di < 0 || sd < 0 || !Number.isInteger(e)) return null;
        return [di, sd, Math.round(x.s) || 0, e];
      },
      unpack: v => DIFFS[v[0]] ? { d: DIFFS[v[0]].id, b: Sala.duelCode.seedStr(v[1]), s: v[2], p: v[3] ? 2 ** v[3] : 0, t: 0, w: 0 } : null
    },
    duelOk: D => DIFFS.some(x => x.id === D.d) && /^[a-z0-9]{4,20}$/.test(D.b),
    duelText: r => "Maior peça " + fmtNum(r.p),
    meta() {
      const out = []; if (!S) load();
      if (S && !S.over && S.moves) out.push({ text: "Jogo a meio · " + fmtNum(S.score) + " pts", cls: "blue" });
      const b = ranking.best("dobra", lastDiff()); if (b) out.push({ text: "Recorde " + fmtNum(b.score) + " pts" });
      return out;
    },
    help, mount, unmount, tick, onKey, save
  });
})();
