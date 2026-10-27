/* Sala de Espera — Minas */
(function () {
  "use strict";
  const { el, esc, fmtTime, fmtNum, shuffle, clamp, store, sound, vibrate, motion, fx, toast, modal, ranking, ui, finish, daily, stats: ST } = Sala;
  const DAILY_DIFF = "medium"; /* o desafio do dia é sempre um Médio (16×16, 40 minas) */

  const DIFFS = [{ id: "beginner", label: "Iniciante" }, { id: "easy", label: "Fácil" }, { id: "medium", label: "Médio" }, { id: "hard", label: "Difícil" }, { id: "extreme", label: "Extremo" }];
  const CFG = { beginner: { w: 8, h: 8, m: 8 }, easy: { w: 9, h: 9, m: 10 }, medium: { w: 16, h: 16, m: 40 }, hard: { w: 30, h: 16, m: 99 }, extreme: { w: 30, h: 20, m: 130 } };
  const BASE = { beginner: 250, easy: 500, medium: 2000, hard: 5000, extreme: 9000 };
  const PAR = { beginner: 30, easy: 60, medium: 240, hard: 600, extreme: 1080 }; /* segundos de referência para o bónus */
  const TOUCH_CS = 34; /* tamanho confortável para o dedo, com a lupa ligada */
  const FLAG = '<svg viewBox="0 0 20 20"><path d="M5.5 2.5v15" stroke="var(--ink)" stroke-width="2" stroke-linecap="round"/><path d="M6.5 3h9.5l-2.6 3.8L16 10.6H6.5z" fill="var(--yellow)" stroke="var(--ink)" stroke-width="1.2" stroke-linejoin="round"/></svg>';
  const MINE = '<svg viewBox="0 0 20 20"><path d="M10 1.5v17M1.5 10h17M4 4l12 12M16 4L4 16" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="10" r="5.6" fill="var(--ink)"/><circle cx="8.2" cy="8.2" r="1.5" fill="var(--surface)"/></svg>';

  let M = null, els = null, cur = -1, kbd = false, lp = null, lpFired = false, lastTouch = 0, isDaily = false;
  const KEY = () => isDaily ? "minas:dia" : "minas";

  /* ---------- Estado ---------- */
  function fresh(diff) {
    const c = CFG[diff];
    /* Ecrã estreito e ao alto: o tabuleiro grande roda para caber sem arrastar para o lado. */
    const narrow = innerWidth < 700 && innerHeight > innerWidth;
    const rot = c.w > c.h && narrow;
    const w = rot ? c.h : c.w, h = rot ? c.w : c.h, n = w * h;
    return { diff, w, h, m: c.m, mine: null, num: null, open: Array(n).fill(0), flag: Array(n).fill(0), state: "ready", time: 0, boom: -1, flagMode: false };
  }
  function load() {
    const d = store.get(KEY(), null);
    if (isDaily) { if (d && d.daily === daily.today() && d.open) { M = d; return true; } return false; }
    if (d && d.state === "play" && d.open && d.open.length === d.w * d.h) { M = d; return true; }
    return false;
  }
  /* O desafio do dia fica guardado até ao fim do dia (também acabado, para se ver o tabuleiro). */
  const save = () => { if (isDaily) { if (M) store.set(KEY(), M); return; } if (M && M.state === "play") store.set("minas", M); else store.del("minas"); };
  const lastDiff = () => store.get("minasDiff", "medium");

  function newGame(diff, practice) {
    const keepMode = M ? M.flagMode : false;
    if (isDaily) {
      M = dailyBoard(); if (practice) M.practice = true;
    } else {
      M = fresh(diff || (M && M.diff) || lastDiff());
      store.set("minasDiff", M.diff);
    }
    M.flagMode = keepMode;
    save(); cur = -1;
    if (els) { buildGrid(); msg(isDaily ? dailyMsg() : ""); syncDiff(); render(); toStart(); }
  }
  /* Com a lupa, o tabuleiro desliza: no desafio, mostra logo a zona já aberta. */
  function toStart() {
    if (!els || M.start == null || M.state !== "ready") return;
    requestAnimationFrame(() => {
      const sc = els && els.board.querySelector(".mscroll"), c = document.getElementById("m-grid").children[M.start];
      if (!sc || !c) return;
      const a = sc.getBoundingClientRect(), b = c.getBoundingClientRect();
      sc.scrollLeft += b.left - a.left - (a.width - b.width) / 2;
      sc.scrollTop += b.top - a.top - (a.height - b.height) / 2;
    });
  }
  /* Desafio do dia: minas postas pela semente e uma zona já aberta, igual para toda a gente
     (sem isto, a primeira casa escolhida mudaria o tabuleiro). Sem rodar, porque é quadrado. */
  function dailyBoard() {
    const ds = daily.today(), c = CFG[DAILY_DIFF], n = c.w * c.h, rnd = daily.rng("minas", ds);
    const B = { diff: DAILY_DIFF, daily: ds, w: c.w, h: c.h, m: c.m, mine: Array(n).fill(0), num: null, open: Array(n).fill(0), flag: Array(n).fill(0), state: "ready", time: 0, boom: -1, flagMode: false };
    shuffle([...Array(n).keys()], rnd).slice(0, c.m).forEach(i => B.mine[i] = 1);
    const prev = M; M = B;
    B.num = B.mine.map((_, i) => nb(i).reduce((s, j) => s + B.mine[j], 0));
    /* A zona de partida é a maior mancha de zeros (em empate, a primeira). */
    const seen = new Uint8Array(n); let best = -1, bestSize = 0;
    for (let i = 0; i < n; i++) {
      if (seen[i] || B.mine[i] || B.num[i]) continue;
      let size = 0; const q = [i]; seen[i] = 1;
      while (q.length) { const x = q.pop(); size++; for (const j of nb(x)) if (!seen[j] && !B.mine[j] && !B.num[j]) { seen[j] = 1; q.push(j); } }
      if (size > bestSize) { bestSize = size; best = i; }
    }
    if (best < 0) best = B.mine.findIndex(v => !v);
    const q = [best];
    while (q.length) { const x = q.shift(); if (B.open[x]) continue; B.open[x] = 1; if (!B.num[x]) for (const j of nb(x)) if (!B.open[j]) q.push(j); }
    B.start = best;
    M = prev;
    return B;
  }
  const dailyMsg = () => {
    const r = daily.result("minas");
    if (M && M.practice && M.state !== "won" && M.state !== "over") return "Repetição: esta não conta.";
    if (r) return r.won ? "Desafio feito: " + fmtNum(r.score) + " pontos em " + fmtTime(r.time) + "." : "Desafio de hoje: rebentou ao fim de " + fmtTime(r.time) + ". Amanhã há outro.";
    return M && M.state === "ready" ? "Começa a partir da zona já aberta." : "";
  };
  function askNew(diff) {
    if (!M || M.state !== "play") return newGame(diff);
    modal.open({
      title: "Começar outro jogo?",
      body: "<p>O tabuleiro atual fica sem efeito e não conta para o ranking.</p>",
      actions: [{ label: "Continuar este", onClick: () => syncDiff() }, { label: "Novo jogo", primary: true, onClick: () => { ST.record("minas", M.diff, { won: false, time: M.time }); newGame(diff); } }],
      onClose: syncDiff
    });
  }

  const nb = i => { const { w, h } = M, x = i % w, y = (i / w) | 0, r = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < w && ny < h) r.push(ny * w + nx); } return r; };
  function plant(safe) {
    const n = M.w * M.h, ban = new Set([safe, ...nb(safe)]);
    M.mine = Array(n).fill(0);
    shuffle([...Array(n).keys()].filter(i => !ban.has(i))).slice(0, M.m).forEach(i => M.mine[i] = 1);
    M.num = M.mine.map((_, i) => nb(i).reduce((s, j) => s + M.mine[j], 0));
  }

  /* ---------- Ecrã ---------- */
  function mount(c, opts) {
    const want = !!(opts && opts.daily);
    if (want !== isDaily) { save(); M = null; isDaily = want; }
    if (!M && !load()) newGame(lastDiff());
    els = c; cur = -1; kbd = false;
    c.stats.innerHTML = ui.stat("Minas", "m-left", "hl") + ui.stat("Tempo", "m-time") + ui.stat("Recorde", "m-best");
    const scroll = el("div", { class: "mscroll" });
    const grid = el("div", { class: "mgrid", id: "m-grid", role: "grid", "aria-label": "Campo de minas" });
    scroll.appendChild(grid);
    c.board.append(scroll, el("div", { class: "msg", id: "m-msg", role: "status" }));

    const diffSeg = isDaily
      ? el("div", { class: "mode-tag" }, ui.ICON.cal + "Desafio de " + esc(daily.label(M.daily)) + " · Médio")
      : ui.seg(DIFFS, M.diff, id => askNew(id), "Dificuldade");
    if (!isDaily) { diffSeg.id = "m-diff"; diffSeg.classList.add("wrap"); }
    const mode = el("div", { class: "minas-mode", role: "group", "aria-label": "Modo do toque" });
    const bOpen = el("button", { class: "btn", type: "button", id: "m-mopen" }, ui.ICON.pick + "Abrir");
    const bFlag = el("button", { class: "btn", type: "button", id: "m-mflag" }, ui.ICON.flag + "Bandeira");
    bOpen.onclick = () => { M.flagMode = false; sound.tap(); render(); };
    bFlag.onclick = () => { M.flagMode = true; sound.tap(); render(); };
    mode.append(bOpen, bFlag);
    const top = el("div", { class: "row" });
    const bNew = el("button", { class: "btn", type: "button" }, ui.ICON.plus + (isDaily ? "Jogo normal" : "Novo jogo"));
    bNew.onclick = () => isDaily ? Sala.go("minas") : askNew(M.diff);
    const bAgain = el("button", { class: "btn", type: "button", id: "m-again", hidden: true }, ui.ICON.undo + "Repetir (não conta)");
    bAgain.onclick = () => newGame(DAILY_DIFF, true);
    if (isDaily) top.append(bAgain);
    const bZoom = el("button", { class: "btn", type: "button", id: "m-zoom", hidden: true });
    bZoom.onclick = () => { store.set("minasZoom", !zoomOn()); sound.tap(); sizeGrid(); };
    top.append(bZoom, bNew);
    const kb = el("p", { class: "hint" }, '<span class="for-touch">Toque longo faz a ação contrária ao modo escolhido.</span><span class="for-mouse">Clique direito para a bandeira. Teclado: setas, <kbd>Espaço</kbd> abrir, <kbd>F</kbd> bandeira.</span>');
    c.controls.append(diffSeg, mode, top, kb);

    grid.addEventListener("click", e => {
      const t = e.target.closest(".mc"); if (!t) return;
      if (lpFired) { lpFired = false; return; }
      kbd = false; act(+t.dataset.i, M.flagMode ? "flag" : "open");
    });
    grid.addEventListener("contextmenu", e => {
      e.preventDefault();
      if (Date.now() - lastTouch < 1000) return; /* no Android, o toque longo também gera este evento */
      const t = e.target.closest(".mc"); if (t) act(+t.dataset.i, "flag");
    });
    grid.addEventListener("touchstart", e => {
      const t = e.target.closest(".mc"); if (!t) return; lpFired = false; lastTouch = Date.now();
      lp = setTimeout(() => { lpFired = true; act(+t.dataset.i, M.flagMode ? "open" : "flag"); }, 380);
    }, { passive: true });
    ["touchend", "touchmove", "touchcancel"].forEach(t => grid.addEventListener(t, () => clearTimeout(lp), { passive: true }));

    buildGrid();
    if (isDaily) msg(dailyMsg());
    else if (M.state === "won") msg("Campo limpo.");
    render();
    toStart();
    addEventListener("resize", sizeGrid);
  }
  function unmount() { save(); removeEventListener("resize", sizeGrid); if (els) els.board.parentNode.classList.remove("wide-board"); els = null; clearTimeout(lp); if (isDaily) { M = null; isDaily = false; } }
  function syncDiff() { const s = document.getElementById("m-diff"); if (s) s.querySelectorAll("button").forEach((b, k) => b.setAttribute("aria-pressed", String(DIFFS[k].id === M.diff))); }
  function msg(t, bad) { const m = document.getElementById("m-msg"); if (m) { m.textContent = t; m.className = "msg" + (bad ? " bad" : ""); } }

  function buildGrid() {
    const g = document.getElementById("m-grid"); g.innerHTML = "";
    g.style.gridTemplateColumns = "repeat(" + M.w + ",var(--cs))";
    const frag = document.createDocumentFragment();
    for (let i = 0; i < M.w * M.h; i++) frag.appendChild(el("div", { class: "mc", "data-i": i, role: "gridcell" }));
    g.appendChild(frag);
    sizeGrid();
  }
  /* Lupa: no telemóvel, os tabuleiros grandes ficam com casas do tamanho do dedo e o tabuleiro desliza. */
  const zoomOn = () => store.get("minasZoom", true);
  function sizeGrid() {
    if (!els) return;
    /* No PC, os tabuleiros largos ocupam a largura toda e as estatísticas passam para baixo. */
    els.board.parentNode.classList.toggle("wide-board", M.w > 16 && innerWidth >= 900);
    const avail = els.board.clientWidth || innerWidth - 32;
    const fit = Math.floor((avail - 10 - 2 * (M.w - 1)) / M.w);
    const small = fit < 28, zoom = small && zoomOn();
    const cs = zoom ? TOUCH_CS : clamp(fit, 16, 40);
    document.getElementById("m-grid").style.setProperty("--cs", cs + "px");
    const sc = els.board.querySelector(".mscroll");
    sc.classList.toggle("zoomed", zoom);
    sc.style.maxHeight = zoom ? Math.max(300, innerHeight - 340) + "px" : ""; /* deixa à vista os botões Abrir e Bandeira */
    const b = document.getElementById("m-zoom");
    if (b) {
      b.hidden = !small;
      b.innerHTML = zoom ? '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M8 11h6"/></svg>Ver tudo' : '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M8 11h6M11 8v6"/></svg>Ampliar';
    }
  }

  function render(newly) {
    if (!els) return;
    const cells = document.getElementById("m-grid").children; let f = 0;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i]; f += M.flag[i];
      let cls = "mc", html = "", color = "";
      if (M.open[i]) {
        cls = "mc o"; const n = M.num[i]; html = n ? String(n) : ""; color = n ? "var(--n" + n + ")" : "";
        if (newly && newly.has(i)) c.style.setProperty("--d", Math.min(newly.get(i) * 14, 420) + "ms");
      } else if ((M.state === "over") && M.mine && M.mine[i] && !M.flag[i]) {
        cls = "mc o mine-show" + (i === M.boom ? " boom" : ""); html = MINE;
        if (M.boom >= 0) { const bx = M.boom % M.w, by = (M.boom / M.w) | 0, d = Math.hypot(i % M.w - bx, ((i / M.w) | 0) - by); c.style.setProperty("--d", Math.round(d * 40) + "ms"); }
      } else if (M.flag[i]) {
        cls = "mc flagged" + (M.state === "over" && M.mine && !M.mine[i] ? " wrong" : ""); html = FLAG;
      }
      if (i === cur && kbd) cls += " cur";
      if (c.className !== cls) c.className = cls;
      if (c.dataset.h !== html) { c.innerHTML = html; c.dataset.h = html; }
      c.style.color = color;
    }
    const set = (id, t) => { const n = document.getElementById(id); if (n) n.textContent = t; };
    set("m-left", M.m - f); set("m-time", fmtTime(M.time));
    const b = ranking.best("minas", isDaily ? "dia" : M.diff); set("m-best", b ? fmtNum(b.score) : "—");
    const ag = document.getElementById("m-again"); if (ag) ag.hidden = !(M.state === "won" || M.state === "over");
    const bo = document.getElementById("m-mopen"), bf = document.getElementById("m-mflag");
    bo.classList.toggle("on", !M.flagMode); bo.setAttribute("aria-pressed", String(!M.flagMode));
    bf.classList.toggle("on", !!M.flagMode); bf.setAttribute("aria-pressed", String(!!M.flagMode));
  }

  /* ---------- Jogo ---------- */
  function act(i, what) {
    if (M.state === "over" || M.state === "won") return;
    if (M.open[i]) return chord(i);
    if (what === "flag") return toggleFlag(i);
    reveal([i]);
  }
  function toggleFlag(i) {
    if (M.open[i]) return;
    M.flag[i] ^= 1; sound.flag(); vibrate(20); save(); render();
  }
  function chord(i) {
    if (!M.num[i]) return;
    const ns = nb(i);
    if (ns.filter(j => M.flag[j]).length !== M.num[i]) { sound.tap(); return; }
    const todo = ns.filter(j => !M.flag[j] && !M.open[j]);
    if (todo.length) reveal(todo);
  }
  function reveal(list) {
    if (M.state === "ready") { if (!M.mine) plant(list[0]); M.state = "play"; }
    const order = new Map(); let step = 0;
    for (const s of list) {
      if (M.flag[s] || M.open[s]) continue;
      if (M.mine[s]) { M.boom = s; return lose(); }
      const q = [s];
      while (q.length) {
        const c = q.shift(); if (M.open[c] || M.flag[c]) continue;
        M.open[c] = 1; order.set(c, step++);
        if (!M.num[c]) for (const j of nb(c)) if (!M.open[j] && !M.flag[j]) q.push(j);
      }
    }
    if (order.size) { order.size > 6 ? sound.line() : sound.open(); vibrate(8); }
    save();
    if (!checkWin()) render(motion() ? order : null);
  }
  function lose() {
    M.state = "over"; save();
    render();
    sound.boom(); vibrate([90, 40, 160]);
    const cell = document.getElementById("m-grid").children[M.boom];
    if (cell) { const r = cell.getBoundingClientRect(); fx.burst(r.left + r.width / 2, r.top + r.height / 2); }
    if (motion() && els) { const sc = els.board.querySelector(".mscroll"); sc.classList.remove("shake"); void sc.offsetWidth; sc.classList.add("shake"); }
    msg("Boom. Ao fim de " + fmtTime(M.time) + ". Nova volta?", true);
    const dd = M.daily;
    if (!dd) { ST.record("minas", M.diff, { won: false, time: M.time }); return; }
    /* No desafio do dia, a derrota também se regista e partilha. */
    const practice = !!(M.practice || daily.result("minas", dd));
    const opened = M.open.reduce((a, b) => a + b, 0), total = M.w * M.h - M.m;
    setTimeout(() => {
      finish({
        game: "minas", diff: M.diff, diffLabel: "Médio", title: "Boom", score: 0, time: M.time, won: false, daily: dd, practice,
        breakdown: [["Casas abertas", fmtNum(opened) + " de " + fmtNum(total)], ["Tempo", fmtTime(M.time)]],
        share: { lost: "💥 Rebentou", lines: ["💥 Rebentou ao fim de " + fmtTime(M.time), fmtNum(Math.round(100 * opened / total)) + " % do campo limpo"] },
        newLabel: "Jogo normal", onNew: () => Sala.go("minas")
      });
      if (els) msg(dailyMsg(), true);
    }, motion() ? 1100 : 200);
  }
  function checkWin() {
    const n = M.w * M.h; let open = 0; for (let i = 0; i < n; i++) open += M.open[i];
    if (open !== n - M.m) return false;
    M.state = "won"; save();
    for (let i = 0; i < n; i++) if (M.mine[i]) M.flag[i] = 1;
    render();
    const t = Math.max(1, M.time), par = PAR[M.diff], base = BASE[M.diff];
    const mult = t <= par ? 1 + (par - t) / par : Math.max(0.25, par / t);
    const total = Math.round(base * mult), dl = DIFFS.find(d => d.id === M.diff).label;
    msg("Campo limpo em " + fmtTime(M.time) + ".");
    const dd = M.daily, practice = !!(dd && (M.practice || daily.result("minas", dd)));
    setTimeout(() => {
      finish({
        game: "minas", diff: M.diff, diffLabel: dl, title: "Campo limpo", score: total, time: M.time, daily: dd, practice,
        breakdown: [["Base (" + dl + ")", fmtNum(base)], ["Tempo " + fmtTime(M.time) + " (referência " + fmtTime(par) + ")", "× " + mult.toFixed(2).replace(".", ",")]],
        share: { lines: ["Campo limpo em " + fmtTime(M.time)] },
        newLabel: dd ? "Jogo normal" : "Novo jogo",
        onNew: () => dd ? Sala.go("minas") : newGame(M.diff)
      });
      if (dd && els) msg(dailyMsg());
    }, 350);
    return true;
  }

  function onKey(e) {
    const k = e.key, n = M.w * M.h;
    if (k.startsWith("Arrow")) {
      if (!kbd || cur < 0) { cur = cur < 0 ? Math.floor(M.h / 2) * M.w + Math.floor(M.w / 2) : cur; kbd = true; }
      else {
        const x = cur % M.w, y = (cur / M.w) | 0;
        if (k === "ArrowUp") cur = ((y + M.h - 1) % M.h) * M.w + x; if (k === "ArrowDown") cur = ((y + 1) % M.h) * M.w + x;
        if (k === "ArrowLeft") cur = y * M.w + (x + M.w - 1) % M.w; if (k === "ArrowRight") cur = y * M.w + (x + 1) % M.w;
      }
      render(); const c = document.getElementById("m-grid").children[cur]; if (c && c.scrollIntoView) c.scrollIntoView({ block: "nearest", inline: "nearest" });
      e.preventDefault();
    } else if ((k === " " || k === "Enter") && kbd && cur >= 0 && cur < n) { act(cur, "open"); e.preventDefault(); }
    else if ((k === "f" || k === "F") && kbd && cur >= 0) { act(cur, "flag"); e.preventDefault(); }
  }
  function tick() {
    if (!M || M.state !== "play") return;
    M.time++;
    const t = document.getElementById("m-time"); if (t) t.textContent = fmtTime(M.time);
    if (M.time % 5 === 0) save();
  }

  function help() {
    return "<h4>Objetivo</h4><p>Abrir todas as casas que não têm minas. Cada número diz quantas minas há nas oito casas à volta. A primeira casa que abres nunca tem mina.</p>" +
      "<h4>Tabuleiros</h4><ul><li>Iniciante: 8×8 com 8 minas.</li><li>Fácil: 9×9 com 10 minas.</li><li>Médio: 16×16 com 40 minas.</li><li>Difícil: 30×16 com 99 minas.</li><li>Extremo: 30×20 com 130 minas.</li><li>No telemóvel ao alto, os tabuleiros largos rodam (16×30 e 20×30). Com a lupa, as casas ficam do tamanho do dedo e o tabuleiro desliza; \"Ver tudo\" mostra-o inteiro.</li></ul>" +
      "<h4>Controlos</h4><ul>" +
      "<li><b>Rato:</b> clique abre, clique direito põe ou tira a bandeira.</li>" +
      "<li><b>Toque:</b> escolhe o modo (Abrir ou Bandeira) nos botões; o toque longo faz a ação contrária.</li>" +
      "<li><b>Atalho:</b> num número já rodeado das bandeiras certas, clicar abre as casas que faltam à volta.</li>" +
      "<li><b>Teclado:</b> setas para mover, <kbd>Espaço</kbd> ou <kbd>Enter</kbd> para abrir, <kbd>F</kbd> para a bandeira.</li></ul>" +
      "<h4>Pontuação</h4><ul>" +
      "<li>Base: 250 no Iniciante, 500 no Fácil, 2000 no Médio, 5000 no Difícil e 9000 no Extremo.</li>" +
      "<li>Bónus de rapidez: o tempo de referência é 30 segundos, 1, 4, 10 e 18 minutos. Acabar em metade desse tempo vale ×1,5; no dobro, ×0,5 (nunca menos de ×0,25).</li>" +
      "<li>Só as vitórias contam para o ranking.</li></ul>" +
      "<h4>Desafio do dia</h4><p>Um campo Médio (16×16, 40 minas) igual para toda a gente nesse dia, com uma zona já aberta para começar. O relógio só arranca na primeira jogada. Só a primeira tentativa conta, e rebentar também fica registado.</p>";
  }

  Sala.registerGame({
    id: "minas", name: "Minas", ready: true, diffs: DIFFS,
    desc: "Lógica e números para limpar o campo sem rebentar nada.",
    art: '<svg viewBox="0 0 36 36"><rect x="2" y="2" width="32" height="32" rx="6" fill="var(--cover)"/><rect x="2" y="18" width="16" height="16" rx="0" fill="var(--open)"/><path d="M8 3v13M3 9.5h11M4.5 5l7 7M11.5 5l-7 7" stroke="var(--ink)" stroke-width="1.6" stroke-linecap="round" transform="translate(16 0)"/><circle cx="24" cy="9.5" r="3.6" fill="var(--ink)"/><path d="M7 21.5v9" stroke="var(--ink)" stroke-width="1.6" stroke-linecap="round"/><path d="M7.6 22h6l-1.6 2.2 1.6 2.3h-6z" fill="var(--yellow)" stroke="var(--ink)" stroke-width=".9"/><text x="27" y="31" font-size="11" font-weight="900" text-anchor="middle" fill="var(--blue-ink)" font-family="Roboto,sans-serif">3</text></svg>',
    lastDiff,
    daily: true, dailyLost: "Rebentou",
    dailyPlaying() { const d = store.get("minas:dia", null); return !!(d && d.daily === daily.today() && d.state === "play" && !d.practice); },
    meta() {
      const out = [];
      if ((M && M.state === "play") || (!M && load())) out.push({ text: "Jogo a meio · " + fmtTime(M.time), cls: "blue" });
      const b = ranking.best("minas", (M && M.diff) || lastDiff());
      if (b) out.push({ text: "Recorde " + fmtNum(b.score) + " pts" });
      return out;
    },
    help, mount, unmount, tick, onKey, save
  });
})();
