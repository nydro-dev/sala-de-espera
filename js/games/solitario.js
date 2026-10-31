/* Sala de Espera — Solitário (Klondike, a tirar 3 cartas do baralho) */
(function () {
  "use strict";
  const { el, esc, fmtNum, fmtTime, store, sound, vibrate, motion, toast, modal, ranking, ui, finish, shuffle, clamp, daily, stats: ST } = Sala;

  const DIFFS = [{ id: "d3", label: "3 cartas" }];
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const SUITS = ["♠", "♥", "♦", "♣"];
  /* Baralho, regras e pontos em js/logic/solitario.js (o servidor repete os jogos com o mesmo código, Fase 8). */
  const LS = SalaLogica.solitario, { rk, st, isRed, top } = LS;
  const LABEL = "3 cartas";

  let S = null, els = null, drag = null, busy = false, autoT = 0, isDaily = false, duelD = null;
  const KEY = () => duelD ? "soli:duelo" : isDaily ? "soli:dia" : "soli";
  let geo = null;
  const P = new Map(); /* posição de cada carta: c → { x, y, z } */
  const flipped = new Set();

  /* ---------- Estado ---------- */
  const fresh = rnd => Object.assign(LS.fresh(rnd), { log: [] }); /* log: jogadas para o ranking online */
  function load() {
    const d = store.get(KEY(), null);
    if (d && d.tab && d.found && (duelD ? d.bid === duelD.bid : !isDaily || d.daily === daily.today())) { S = d; if (!S.hist) S.hist = []; return true; }
    return false;
  }
  const save = () => { if (S) store.set(KEY(), S); };
  const lastDiff = () => "d3";
  function newGame(practice) {
    clearTimeout(autoT); busy = false;
    if (duelD) { S = fresh(Sala.rng("soli:" + duelD.b)); S.seed = duelD.b; S.bid = duelD.bid; }
    else if (isDaily) { const ds = daily.today(); S = fresh(daily.rng("soli", ds)); S.daily = ds; if (practice === true) S.practice = true; }
    else { const seed = Sala.duel.newSeed(); S = fresh(Sala.rng("soli:" + seed)); S.seed = seed; }
    save();
    if (els) { els.board.classList.remove("win"); build(); render(); msg(duelD ? duelMsg() : isDaily ? dailyMsg() : ""); }
  }
  const duelMsg = () => S && S.over ? "Duelo terminado." : "Mesmo baralho de " + duelD.n + ". Sem saída? Termina e ficam os pontos.";
  function askNew() {
    if (!S || S.over || !S.moves) return newGame();
    modal.open({
      title: "Desistir deste jogo?",
      body: "<p>Este jogo (" + fmtNum(S.score) + " pontos) fica sem efeito e não entra no ranking.</p>",
      actions: [{ label: "Continuar este" }, { label: "Novo jogo", primary: true, onClick: () => { ST.record("soli", "d3", { won: false, time: S.time }); newGame(); } }]
    });
  }
  const dailyMsg = () => {
    const r = daily.result("soli");
    if (S && S.practice && !S.over) return "Repetição: esta não conta.";
    if (r) return r.won ? "Desafio feito: " + fmtNum(r.score) + " pontos em " + fmtTime(r.time) + "." : "Desafio de hoje terminado com " + fmtNum(r.score) + " pontos.";
    return "Sem saída? Termina e ficam os pontos que fizeste.";
  };
  /* Desafio do dia: o baralho pode não ter solução, por isso dá para terminar e ficar com os pontos. */
  function askEnd() {
    if (busy || S.over) return;
    if (!S.moves) { toast("Ainda não fizeste nenhuma jogada."); return; }
    modal.open({
      title: duelD ? "Terminar o duelo?" : "Terminar o desafio?",
      body: "<p>Ficas com os " + fmtNum(S.score) + " pontos que tens agora" + (duelD ? " e é esse o teu resultado no duelo" : S.practice ? "" : " e é esse o resultado de hoje") + ". O bónus de tempo só conta se arrumares as cartas todas.</p>",
      actions: [{ label: "Continuar a jogar" }, { label: "Terminar", primary: true, onClick: () => { setTimeout(endDaily, 0); } }]
    });
  }
  function endDaily() {
    S.over = true; S.won = false; S.hist = []; busy = false; save(); render();
    const found = S.found.reduce((a, f) => a + f.length, 0), dd = S.daily, practice = !!(dd && (S.practice || daily.result("soli", dd)));
    if (duelD) {
      msg(duelMsg());
      finish({ game: "soli", diff: "d3", diffLabel: LABEL, score: S.score, time: S.time, won: false, duel: duelD, progress: found,
        breakdown: [["Cartas nas fundações", found + " de 52"], ["Voltas ao baralho", String(S.passes)], ["Tempo", fmtTime(S.time)]] });
      return;
    }
    finish({
      game: "soli", diff: "d3", diffLabel: LABEL, title: "Desafio terminado", score: S.score, time: S.time, won: false, daily: dd, practice,
      breakdown: [["Cartas nas fundações", found + " de 52"], ["Voltas ao baralho", String(S.passes)], ["Desfazer usados", String(S.undos)], ["Tempo", fmtTime(S.time)]],
      extra: { moves: S.moves, found }, online: S.log ? { log: S.log } : null,
      share: { lost: found + "/52 cartas", lines: [found + " de 52 cartas arrumadas", "Tempo " + fmtTime(S.time)] },
      newLabel: "Jogo normal", onNew: () => Sala.go("soli")
    });
    if (els) msg(dailyMsg());
  }

  /* ---------- Regras ---------- */
  const canFound = (c, i) => LS.canFound(S, c, i), cardsAt = src => LS.cardsAt(S, src), legal = (src, dst) => LS.legal(S, src, dst);
  /* Onde está uma carta, e se pode ser mexida. */
  function where(c) {
    let k = S.stock.indexOf(c); if (k >= 0) return { type: "stock" };
    k = S.waste.indexOf(c); if (k >= 0) return { type: "waste", movable: k === S.waste.length - 1 };
    for (let i = 0; i < 4; i++) { k = S.found[i].indexOf(c); if (k >= 0) return { type: "found", i, movable: k === S.found[i].length - 1 }; }
    for (let i = 0; i < 7; i++) { k = S.tab[i].findIndex(o => o.c === c); if (k >= 0) return { type: "tab", i, k, movable: S.tab[i][k].up }; }
    return null;
  }
  /* Toque: fundações primeiro, depois as colunas (com cartas, e só então as vazias). */
  function bestTarget(src) {
    const cards = cardsAt(src);
    if (src.type !== "found" && cards.length === 1) for (let i = 0; i < 4; i++) if (canFound(cards[0], i)) return { type: "found", i };
    const start = src.type === "tab" ? src.i + 1 : 0;
    const order = [...Array(7).keys()].map(k => (start + k) % 7);
    for (const i of order) if (S.tab[i].length && legal(src, { type: "tab", i })) return { type: "tab", i };
    if (src.type === "tab" && src.k === 0) return null; /* um rei já no fundo não muda de coluna vazia */
    for (const i of order) if (!S.tab[i].length && legal(src, { type: "tab", i })) return { type: "tab", i };
    return null;
  }

  /* ---------- Jogadas ---------- */
  /* Registo para o ranking online (Fase 8): "d", "u" ou [origem, i, k, destino, j]. */
  const rec = e => { if (S.log) S.log.push(e); };
  function doMove(src, dst, quiet) {
    const r = LS.mover(S, src, dst); if (!r) return false;
    rec([src.type[0], src.i || 0, src.k || 0, dst.type[0], dst.i]);
    if (r.flip >= 0) flipped.add(r.flip);
    if (!quiet) { dst.type === "found" ? sound.place() : sound.tap(); vibrate(8); }
    afterMove();
    return true;
  }
  function drawCards() {
    if (busy || S.over) return;
    const r = LS.virar(S); if (!r) return;
    rec("d");
    if (r.recycled) sound.open(); else { r.drawn.forEach(c => flipped.add(c)); sound.note(); }
    afterMove();
  }
  function afterMove() {
    if (LS.ganhou(S)) { win(); return; }
    save(); render();
  }
  function undo() {
    if (busy || S.over) return;
    if (!LS.desfazer(S)) { toast("Não há jogadas para desfazer."); return; }
    rec("u");
    sound.tap(); save(); render();
  }
  const canAuto = () => !S.over && !S.stock.length && !S.waste.length && S.tab.every(col => col.every(o => o.up));
  /* Completar: leva as cartas para as fundações, da mais baixa para a mais alta. */
  function autoFinish() {
    if (busy || !canAuto()) return;
    busy = true;
    const stepOnce = () => {
      let best = null;
      for (let i = 0; i < 7; i++) {
        const col = S.tab[i]; if (!col.length) continue;
        const c = top(col).c;
        for (let f = 0; f < 4; f++) if (canFound(c, f) && (!best || rk(c) < rk(best.c))) best = { c, i, f };
      }
      if (!best) { busy = false; render(); return; }
      busy = false; doMove({ type: "tab", i: best.i, k: S.tab[best.i].length - 1 }, { type: "found", i: best.f }, true); busy = !S.over;
      if (motion()) sound.note();
      if (!S.over) { if (motion()) autoT = setTimeout(stepOnce, 70); else stepOnce(); }
    };
    stepOnce();
  }
  function win() {
    S.over = true; S.won = true; S.hist = []; busy = false; save(); render();
    const bonus = LS.bonus(S.time);
    const total = S.score + bonus;
    msg("Todas as cartas arrumadas!");
    if (els && motion()) {
      els.board.querySelectorAll(".sl-card").forEach(n => n.style.setProperty("--d", ((P.get(+n.dataset.c) || {}).z || 0) % 13 * 45 + "ms"));
      els.board.classList.add("win");
    }
    const dd = S.daily, practice = !!(dd && (S.practice || daily.result("soli", dd))), dD = duelD;
    if (dD) msg("Todas as cartas arrumadas! Duelo terminado.");
    setTimeout(() => {
      finish({
        game: "soli", diff: "d3", diffLabel: LABEL, title: "Ganhaste", score: total, time: S.time, daily: dd, practice, duel: dD, progress: 52,
        challenge: S.seed ? { d: "d3", b: S.seed, p: 52 } : null,
        breakdown: [["Pontos das jogadas", fmtNum(S.score)], ["Bónus de tempo", "+" + fmtNum(bonus)], ["Voltas ao baralho", String(S.passes)], ["Desfazer usados", String(S.undos)], ["Tempo", fmtTime(S.time)]],
        extra: { moves: S.moves },
        online: S.log && !dD ? (dd ? { log: S.log } : { seed: S.seed, log: S.log }) : null,
        share: { lines: ["52 de 52 cartas arrumadas", "Tempo " + fmtTime(S.time)] },
        newLabel: dd ? "Jogo normal" : "Novo jogo",
        onNew: () => dd ? Sala.go("soli") : newGame()
      });
      if (dd && els) msg(dailyMsg());
    }, motion() ? 1100 : 150);
  }

  /* ---------- Ecrã ---------- */
  function mount(c, opts) {
    const wantDuel = (opts && opts.duel) || null, want = !wantDuel && !!(opts && opts.daily);
    if (want !== isDaily || !!wantDuel !== !!duelD) { save(); S = null; isDaily = want; }
    duelD = wantDuel;
    if (duelD && S && S.bid !== duelD.bid) S = null;
    if (!S && !load()) newGame();
    els = c; busy = false; drag = null;
    c.stats.innerHTML = ui.stat("Pontos", "sl-score", "hl") + ui.stat("Tempo", "sl-time") + ui.stat("Jogadas", "sl-moves") + ui.stat("Recorde", "sl-best");
    const board = el("div", { class: "sl-board", id: "sl-board", role: "application", "aria-label": "Mesa do Solitário" });
    c.board.append(board, el("div", { class: "msg", id: "sl-msg", role: "status" }));
    els.board = board;
    const auto = el("button", { class: "btn primary block", type: "button", id: "sl-auto", hidden: true }, "Completar sozinho");
    auto.onclick = autoFinish;
    const row = el("div", { class: "casino-actions" });
    const bUndo = el("button", { class: "btn", type: "button", id: "sl-undob" }, ui.ICON.undo + "Desfazer"); bUndo.onclick = undo;
    if (isDaily || duelD) {
      const bEnd = el("button", { class: "btn", type: "button", id: "sl-end" }, '<svg viewBox="0 0 24 24"><path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/></svg>Terminar'); bEnd.onclick = askEnd;
      const bAgain = el("button", { class: "btn", type: "button", id: "sl-again", hidden: true }, ui.ICON.undo + "Repetir"); bAgain.onclick = () => newGame(true);
      const bNorm = el("button", { class: "btn", type: "button" }, ui.ICON.plus + "Jogo normal"); bNorm.onclick = () => Sala.go("soli");
      if (duelD) row.append(bUndo, bEnd, bNorm); else row.append(bUndo, bEnd, bAgain, bNorm);
    } else {
      const bNew = el("button", { class: "btn", type: "button" }, ui.ICON.plus + "Novo jogo"); bNew.onclick = askNew;
      row.append(bUndo, bNew);
    }
    const tip = el("p", { class: "hint" }, '<span class="for-touch">Toca numa carta para a mandar para o melhor sítio, ou arrasta-a.</span><span class="for-mouse">Clica numa carta para a mandar para o melhor sítio, ou arrasta-a. <kbd>Espaço</kbd> vira o baralho, <kbd>Ctrl</kbd>+<kbd>Z</kbd> desfaz.</span>');
    if (duelD) c.controls.append(Sala.duel.tag(duelD));
    else if (isDaily) c.controls.append(el("div", { class: "mode-tag" }, ui.ICON.cal + "Desafio de " + esc(daily.label(S.daily)) + " · 3 cartas"));
    c.controls.append(auto, row, tip);
    board.addEventListener("pointerdown", down);
    board.addEventListener("pointermove", moveDrag);
    board.addEventListener("pointerup", up);
    board.addEventListener("pointercancel", cancelDrag);
    build(); render();
    if (duelD) msg(duelMsg());
    else if (isDaily) msg(dailyMsg());
    else if (S.over) msg(S.won ? "Jogo ganho. Começa outro quando quiseres." : "");
    addEventListener("resize", onResize);
  }
  function unmount() { clearTimeout(autoT); busy = false; save(); removeEventListener("resize", onResize); els = null; drag = null; if (isDaily || duelD) { S = null; isDaily = false; duelD = null; } }
  function onResize() { if (els) { layout(); render(); } }
  function msg(t, bad) { const m = document.getElementById("sl-msg"); if (m) { m.textContent = t; m.className = "msg" + (bad ? " bad" : ""); } }

  function build() {
    const b = els && els.board; if (!b) return;
    b.innerHTML = "";
    const slot = (pile, i, text) => b.appendChild(el("div", { class: "sl-slot", "data-pile": pile, "data-i": i }, text || ""));
    slot("stock", 0, '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/></svg>');
    slot("waste", 0);
    for (let i = 0; i < 4; i++) slot("found", i, "A");
    for (let i = 0; i < 7; i++) slot("tab", i, "K");
    for (let c = 0; c < 52; c++) {
      const r = RANKS[rk(c)], s = SUITS[st(c)];
      b.appendChild(el("div", { class: "sl-card" + (isRed(c) ? " red" : ""), "data-c": c, "aria-label": r + s }, '<span class="r">' + r + '</span><span class="s">' + s + '</span><span class="b">' + s + "</span>"));
    }
    layout();
  }
  function layout() {
    const b = els && els.board; if (!b) return;
    const W = b.clientWidth, gap = Math.max(4, Math.round(W * .014)), cw = (W - gap * 8) / 7, ch = cw * 1.4;
    const wide = innerWidth >= 900;
    const y0 = gap + ch + Math.max(10, gap * 2.5);
    const maxH = Math.max(y0 + ch * 3.6, innerHeight - (wide ? 120 : 175));
    geo = { W, gap, cw, ch, y0, maxH, colX: i => gap + i * (cw + gap) };
    b.style.setProperty("--cw", cw + "px"); b.style.setProperty("--ch", ch + "px");
    b.querySelectorAll(".sl-slot").forEach(n => {
      const p = n.dataset.pile, i = +n.dataset.i;
      const x = p === "stock" ? geo.colX(0) : p === "waste" ? geo.colX(1) : p === "found" ? geo.colX(3 + i) : geo.colX(i);
      const y = p === "tab" ? y0 : gap;
      n.style.transform = "translate(" + x + "px," + y + "px)";
    });
  }
  /* Posições de todas as cartas, com as colunas apertadas se não couberem no ecrã. */
  function positions() {
    const { gap, cw, ch, y0, maxH, colX } = geo;
    P.clear();
    let z = 1;
    S.stock.forEach((c, j) => P.set(c, { x: colX(0), y: gap, z: z++, up: false }));
    const n = S.waste.length, fan = cw * .32;
    S.waste.forEach((c, j) => P.set(c, { x: colX(1) + Math.max(0, j - (n - 3)) * fan, y: gap, z: z++, up: true }));
    S.found.forEach((f, i) => f.forEach(c => P.set(c, { x: colX(3 + i), y: gap, z: z++, up: true })));
    let bottom = y0 + ch * 2;
    S.tab.forEach((col, i) => {
      const down = ch * .14, upo = ch * .3;
      let need = 0; for (let k = 0; k < col.length - 1; k++) need += col[k].up ? upo : down;
      const room = maxH - y0 - ch - gap, f = need > room ? Math.max(.45, room / need) : 1;
      let y = y0;
      col.forEach((o, k) => { P.set(o.c, { x: colX(i), y, z: 100 + k, up: o.up }); y += (o.up ? upo : down) * f; });
      bottom = Math.max(bottom, (col.length ? y - (top(col).up ? upo : down) * f : y0) + ch);
    });
    return bottom + gap;
  }
  function render() {
    if (!els || !geo) return;
    const b = els.board;
    const h = positions();
    b.style.height = h + "px";
    const dragging = new Set(drag && drag.moved ? drag.cards : []);
    b.querySelectorAll(".sl-card").forEach(n => {
      const c = +n.dataset.c, p = P.get(c); if (!p) return;
      n.classList.toggle("back", !p.up);
      if (!dragging.has(c)) { n.style.transform = "translate(" + p.x + "px," + p.y + "px)"; n.style.zIndex = p.z; }
      if (flipped.has(c) && p.up) { n.classList.remove("flip"); void n.offsetWidth; n.classList.add("flip"); }
    });
    flipped.clear();
    const stockSlot = b.querySelector('.sl-slot[data-pile="stock"]');
    if (stockSlot) stockSlot.classList.toggle("again", !S.stock.length && S.waste.length > 0);
    const set = (id, v) => { const x = document.getElementById(id); if (x) x.textContent = v; };
    set("sl-score", fmtNum(S.score)); set("sl-time", fmtTime(S.time)); set("sl-moves", fmtNum(S.moves));
    const best = ranking.best("soli", isDaily ? "dia" : "d3"); set("sl-best", best ? fmtNum(best.score) : "—");
    const be = document.getElementById("sl-end"), ba = document.getElementById("sl-again");
    if (be) be.hidden = S.over; if (ba) ba.hidden = !S.over;
    const u = document.getElementById("sl-undob"); if (u) u.disabled = !S.hist.length || S.over || busy;
    const a = document.getElementById("sl-auto"); if (a) a.hidden = !canAuto() && !busy;
  }

  /* ---------- Toque e arrastar ---------- */
  function down(e) {
    if (busy || S.over || (e.button && e.button > 0) || drag) return;
    const n = e.target.closest(".sl-card,.sl-slot"); if (!n) return;
    if (n.classList.contains("sl-slot")) { if (n.dataset.pile === "stock") drawCards(); return; }
    const loc = where(+n.dataset.c); if (!loc) return;
    if (loc.type === "stock") { drawCards(); return; }
    if (!loc.movable) return;
    e.preventDefault();
    drag = { src: loc, cards: cardsAt(loc), x: e.clientX, y: e.clientY, moved: false, node: n };
    try { n.setPointerCapture(e.pointerId); } catch (x) {}
  }
  function moveDrag(e) {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 7) return;
    if (!drag.moved) { drag.moved = true; drag.cards.forEach((c, k) => { const n = node(c); n.classList.add("drag"); n.style.zIndex = 1000 + k; }); }
    drag.dx = dx; drag.dy = dy;
    drag.cards.forEach(c => { const p = P.get(c); node(c).style.transform = "translate(" + (p.x + dx) + "px," + (p.y + dy) + "px)"; });
  }
  function up() {
    if (!drag) return;
    const d = drag; drag = null;
    d.cards.forEach(c => node(c).classList.remove("drag"));
    if (!d.moved) {
      const t = bestTarget(d.src);
      if (t) doMove(d.src, t);
      else { nope(d.cards); render(); }
      return;
    }
    const p = P.get(d.cards[0]), cx = p.x + d.dx + geo.cw / 2, cy = p.y + d.dy + geo.ch / 2;
    const t = hit(cx, cy);
    if (!(t && doMove(d.src, t))) { if (t) sound.error(); render(); }
  }
  function cancelDrag() { if (drag) { drag.cards.forEach(c => node(c).classList.remove("drag")); drag = null; render(); } }
  const node = c => els.board.querySelector('.sl-card[data-c="' + c + '"]');
  function hit(x, y) {
    const { gap, cw, ch, y0 } = geo;
    const col = clamp(Math.round((x - gap - cw / 2) / (cw + gap)), 0, 6);
    if (y < y0 - gap && col >= 3) return { type: "found", i: col - 3 };
    if (y < y0 - ch * .35) return null;
    return { type: "tab", i: col };
  }
  function nope(cards) {
    sound.tap();
    if (!motion()) return;
    cards.forEach(c => { const n = node(c); n.classList.remove("nope"); void n.offsetWidth; n.classList.add("nope"); });
  }

  function onKey(e) {
    if ((e.key === "z" || e.key === "Z") && (e.ctrlKey || e.metaKey)) { undo(); e.preventDefault(); return; }
    if (e.key === " " || e.key === "Enter") { drawCards(); e.preventDefault(); }
  }
  function tick() {
    if (S && !S.over && S.moves) { S.time++; const t = document.getElementById("sl-time"); if (t) t.textContent = fmtTime(S.time); if (S.time % 10 === 0) save(); }
  }

  function help() {
    return "<h4>Objetivo</h4><p>Levar as 52 cartas para as quatro fundações (em cima, à direita), uma por naipe, do Ás ao Rei.</p>" +
      "<h4>Regras</h4><ul><li>Nas sete colunas, as cartas descem uma a uma e alternam entre vermelho e preto (um 9 de copas vai para cima de um 10 de espadas ou de paus).</li>" +
      "<li>Podes mudar uma carta ou um grupo de cartas viradas de uma coluna para outra. A carta tapada que fica à vista vira-se sozinha.</li>" +
      "<li>Numa coluna vazia só entra um Rei (ou um grupo que comece por um Rei).</li>" +
      "<li>O baralho (em cima, à esquerda) vira 3 cartas de cada vez; só a de cima pode ser jogada. Quando acaba, toca no lugar vazio para voltar a virá-lo.</li></ul>" +
      "<h4>Controlos</h4><ul><li><b>Toque ou clique:</b> manda a carta para o melhor sítio possível (as fundações primeiro).</li><li><b>Arrastar:</b> leva a carta, ou o grupo, para onde quiseres.</li>" +
      "<li><b>Teclado:</b> <kbd>Espaço</kbd> vira o baralho, <kbd>Ctrl</kbd>+<kbd>Z</kbd> desfaz.</li><li><b>Completar sozinho:</b> aparece quando já estão todas as cartas viradas.</li></ul>" +
      "<h4>Pontuação</h4><ul><li>+10 por carta nas fundações; +5 por carta do baralho levada para as colunas; +5 por cada carta tapada que se vira.</li>" +
      "<li>−15 se uma carta sair das fundações; −20 por cada volta ao baralho; −10 por cada desfazer.</li>" +
      "<li>Ao ganhar soma-se o bónus de tempo: 1000 pontos, que descem até 0 aos 15 minutos.</li><li>Só os jogos ganhos entram no top 10.</li></ul>" +
      "<h4>Duelo</h4><p>Depois de ganhares, <b>Desafiar</b> cria um link com o mesmo baralho e o teu resultado. No duelo, como no desafio do dia, dá para <b>Terminar</b> e ficar com os pontos feitos. Ganha quem tiver mais pontos; em empate, quem arrumou mais cartas.</p>" +
      "<h4>Desafio do dia</h4><p>O mesmo baralho para toda a gente nesse dia. Como nem todos os baralhos têm solução, podes <b>Terminar</b> quando não houver saída e ficas com os pontos das jogadas. Só a primeira tentativa conta.</p>";
  }

  Sala.registerGame({
    id: "soli", name: "Solitário", ready: true, diffs: DIFFS,
    desc: "O clássico das cartas, com sete colunas.",
    art: '<svg viewBox="0 0 36 36"><rect x="5" y="4" width="18" height="25" rx="3" fill="var(--cover)" transform="rotate(-10 14 16)"/><rect x="13" y="7" width="18" height="25" rx="3" fill="var(--surface)" stroke="var(--ink)" stroke-width="1.5"/><path d="M22 14c-2.5 3-4 4.4-4 6a2 2 0 0 0 4 .3 2 2 0 0 0 4-.3c0-1.6-1.5-3-4-6z" fill="var(--ink)"/></svg>',
    lastDiff, emptyText: "Ainda não há jogos ganhos.<br>O primeiro é teu.",
    daily: true, dailyLost: "Terminado",
    duel: true, duelTime: true,
    /* Código curto: semente, pontos, tempo, cartas nas fundações e ganhou. */
    code: {
      pre: "SOL", bits: [16, 13, 14, 6, 1],
      pack(x) {
        const sd = Sala.duelCode.seedNum(x.b); if (x.d !== "d3" || sd < 0) return null;
        return [sd, Math.round(x.s) || 0, Math.min(16383, Math.round(x.t) || 0), Math.round(x.p) || 0, x.w ? 1 : 0];
      },
      unpack: v => v[3] > 52 || (v[4] && v[3] !== 52) ? null : { d: "d3", b: Sala.duelCode.seedStr(v[0]), s: v[1], t: v[2], p: v[3], w: v[4] }
    },
    duelOk: D => D.d === "d3" && /^[a-z0-9]{4,20}$/.test(D.b),
    duelText: r => r.w ? fmtTime(r.t) : r.p + " de 52 cartas",
    dailyPlaying() { const d = store.get("soli:dia", null); return !!(d && d.daily === daily.today() && !d.over && d.moves && !d.practice); },
    meta() {
      const out = []; if (!S) load();
      if (S && !S.over && S.moves) out.push({ text: "Jogo a meio · " + fmtNum(S.score) + " pts", cls: "blue" });
      const b = ranking.best("soli", "d3"); if (b) out.push({ text: "Recorde " + fmtNum(b.score) + " pts" });
      return out;
    },
    help, mount, unmount, tick, onKey, save
  });
})();
