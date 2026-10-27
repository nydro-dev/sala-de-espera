/* Sala de Espera — Cobra */
(function () {
  "use strict";
  const { el, fmtNum, fmtTime, store, sound, vibrate, motion, fx, modal, ranking, ui, finish } = Sala;

  const SPEEDS = [{ id: "lenta", label: "Lenta", ms: 170, mult: 1 }, { id: "normal", label: "Normal", ms: 120, mult: 2 }, { id: "rapida", label: "Rápida", ms: 85, mult: 3 }];
  const MODES = [{ id: "paredes", label: "Com paredes", suffix: "" }, { id: "livre", label: "Sem paredes", suffix: "-livre" }];
  const N = 20, APPLE = 10, GOLD = 50, GOLD_STEPS = 45, GOLD_CHANCE = .2;
  const speedOf = id => SPEEDS.find(s => s.id === id) || SPEEDS[1];
  const keyOf = (sp, mo) => sp + (MODES.find(m => m.id === mo) || MODES[0]).suffix;
  const labelOf = (sp, mo) => speedOf(sp).label + (mo === "livre" ? " · sem paredes" : "");
  const DIRS = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };

  let S = null, els = null, cv = null, cx = null, raf = 0, last = 0, acc = 0, queue = [], swipe = null, born = 0, deadAt = 0;
  let prevSnake = null, frac = 1, frame = 0, bgCache = null, bgKey = "";

  /* ---------- Estado ---------- */
  function fresh(speed, mode) {
    const m = N / 2 | 0;
    return { speed, mode, snake: [[m, 6], [m, 5], [m, 4]], dir: [0, 1], apple: null, gold: null, score: 0, apples: 0, golds: 0, time: 0, state: "ready", grow: 0 };
  }
  function load() { const d = store.get("cobra", null); if (d && d.snake && d.snake.length) { S = d; if (S.state === "run") S.state = "pause"; return true; } return false; }
  const save = () => { if (S) store.set("cobra", S); };
  const prefs = () => store.get("cobraPrefs", { speed: "normal", mode: "paredes" });
  const lastDiff = () => S ? keyOf(S.speed, S.mode) : keyOf(prefs().speed, prefs().mode);

  function newGame(speed, mode) {
    const p = prefs();
    speed = speed || (S && S.speed) || p.speed; mode = mode || (S && S.mode) || p.mode;
    store.set("cobraPrefs", { speed, mode });
    S = fresh(speed, mode); queue = []; acc = 0;
    S.apple = freeCell(); born = performance.now();
    save(); if (els) { els.wrap.classList.remove("shake"); syncSegs(); msg(""); draw(); stats(); }
  }
  function askNew(speed, mode) {
    if (!S || S.state === "over" || S.state === "ready" || !S.score) return newGame(speed, mode);
    if (S.state === "run") pause();
    modal.open({
      title: "Começar outro jogo?",
      body: "<p>Este jogo (" + fmtNum(S.score) + " pontos) fica sem efeito e não entra no ranking.</p>",
      actions: [{ label: "Continuar este", onClick: syncSegs }, { label: "Novo jogo", primary: true, onClick: () => newGame(speed, mode) }],
      onClose: syncSegs
    });
  }

  function freeCell() {
    const busy = new Set(S.snake.map(p => p[0] * N + p[1]));
    if (S.apple) busy.add(S.apple[0] * N + S.apple[1]);
    if (S.gold) busy.add(S.gold.p[0] * N + S.gold.p[1]);
    const free = []; for (let i = 0; i < N * N; i++) if (!busy.has(i)) free.push(i);
    if (!free.length) return null;
    const i = free[Math.random() * free.length | 0];
    return [i / N | 0, i % N];
  }
  const interval = () => speedOf(S.speed).ms * Math.max(.55, 1 - S.apples * .012);

  /* ---------- Jogo ---------- */
  function start() { if (S.state === "ready" || S.state === "pause") { S.state = "run"; acc = 0; prevSnake = null; last = performance.now(); sound.tap(); syncPause(); lock(true); } }
  function pause() { if (S.state === "run") { S.state = "pause"; save(); syncPause(); lock(false); draw(); } }
  /* Com o jogo a correr, a página não desliza: um dedo fora do tabuleiro não faz scroll sem querer. */
  function lock(on) { document.documentElement.classList.toggle("cb-lock", !!on); if (on) scrollTo(0, 0); }
  function togglePause() { if (S.state === "run") pause(); else if (S.state !== "over") start(); }
  function turn(name) {
    if (!S || S.state === "over") return;
    const d = DIRS[name], ref = queue.length ? queue[queue.length - 1] : S.dir;
    if (S.state !== "run") {
      /* Ao arrancar não deixa virar para trás (contra o próprio corpo). */
      if (!(d[0] === -ref[0] && d[1] === -ref[1])) queue = [d];
      start(); return;
    }
    if ((d[0] === ref[0] && d[1] === ref[1]) || (d[0] === -ref[0] && d[1] === -ref[1])) return;
    if (queue.length < 3) queue.push(d);
  }
  function step() {
    prevSnake = S.snake.map(p => p.slice()); /* para desenhar o movimento suave entre casas */
    if (queue.length) S.dir = queue.shift();
    const h = S.snake[0];
    let r = h[0] + S.dir[0], c = h[1] + S.dir[1];
    if (S.mode === "livre") { r = (r + N) % N; c = (c + N) % N; }
    else if (r < 0 || c < 0 || r >= N || c >= N) return die();
    const tailMoves = S.grow === 0;
    const body = tailMoves ? S.snake.slice(0, -1) : S.snake;
    if (body.some(p => p[0] === r && p[1] === c)) return die();
    S.snake.unshift([r, c]);
    const mult = speedOf(S.speed).mult;
    let ate = false;
    if (S.apple && S.apple[0] === r && S.apple[1] === c) {
      S.score += APPLE * mult; S.apples++; S.grow += 1; ate = true;
      sound.place(); vibrate(10);
      S.apple = null; S.apple = freeCell(); born = performance.now();
      if (!S.gold && Math.random() < GOLD_CHANCE) { const p = freeCell(); if (p) S.gold = { p, life: GOLD_STEPS, born: performance.now() }; }
    }
    if (S.gold && S.gold.p[0] === r && S.gold.p[1] === c) {
      S.score += GOLD * mult; S.golds++; S.grow += 2; S.gold = null; ate = true;
      sound.line(); vibrate(25);
    }
    if (S.gold && --S.gold.life <= 0) S.gold = null;
    if (S.grow > 0) S.grow--; else S.snake.pop();
    if (ate) stats();
    if (!S.apple) return die(true); /* encheu o tabuleiro */
  }
  function die(full) {
    S.state = "over"; deadAt = performance.now(); prevSnake = null; lock(false); save(); syncPause(); draw(); stats();
    if (full) { msg("Encheste o tabuleiro todo!"); }
    else {
      sound.boom(); vibrate([40, 40, 90]);
      if (els) {
        els.wrap.classList.remove("shake"); void els.wrap.offsetWidth; els.wrap.classList.add("shake");
        const rc = cv.getBoundingClientRect(), cs = rc.width / N, h = S.snake[0];
        fx.burst(rc.left + (h[1] + .5) * cs, rc.top + (h[0] + .5) * cs);
      }
    }
    if (!S.score) { msg("Sem pontos desta vez. Tenta outra vez.", true); return; }
    msg(full ? "" : "Fim de jogo.", !full);
    const lbl = labelOf(S.speed, S.mode);
    setTimeout(() => {
      if (!els || S.state !== "over") return;
      finish({
        game: "cobra", diff: keyOf(S.speed, S.mode), diffLabel: lbl, title: full ? "Ganhaste" : "Fim de jogo", score: S.score, time: S.time,
        breakdown: [["Modo", lbl], ["Maçãs", fmtNum(S.apples)], ["Maçãs douradas", fmtNum(S.golds)], ["Tamanho final", fmtNum(S.snake.length)], ["Tempo", fmtTime(S.time)]],
        extra: { len: S.snake.length }, onNew: () => newGame()
      });
    }, motion() ? 900 : 200);
  }

  /* ---------- Ciclo ---------- */
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(250, now - (last || now)); last = now;
    if (S.state === "run") {
      if (modal.isOpen || document.hidden) { pause(); return; }
      acc += dt;
      let guard = 0;
      while (acc >= interval() && S.state === "run" && guard++ < 5) { acc -= interval(); step(); }
      frac = S.state === "run" ? Math.min(1, acc / interval()) : 1;
    } else frac = 1;
    draw(now);
  }

  /* ---------- Desenho ---------- */
  let col = {};
  function readColors() {
    const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
    col = { bg: v("--surface"), alt: v("--surface-2"), line: v("--line"), wall: v("--line-strong"), body: v("--blue"), head: v("--blue-ink"), ink: v("--ink"), apple: "#E8352E", gold: v("--yellow"), bad: v("--bad"), muted: v("--muted") };
  }
  function rr(x, y, w, h, r) { cx.beginPath(); cx.roundRect ? cx.roundRect(x, y, w, h, r) : cx.rect(x, y, w, h); cx.fill(); }
  /* Fundo xadrez guardado numa imagem: só se redesenha quando muda o tamanho ou o tema. */
  function background(size, cs) {
    const dpr = devicePixelRatio || 1, key = size + "|" + dpr + "|" + col.bg + col.alt;
    if (bgKey !== key) {
      bgCache = document.createElement("canvas"); bgCache.width = bgCache.height = Math.round(size * dpr);
      const b = bgCache.getContext("2d"); b.setTransform(dpr, 0, 0, dpr, 0, 0);
      b.fillStyle = col.bg; b.fillRect(0, 0, size, size); b.fillStyle = col.alt;
      for (let r = 0; r < N; r++) for (let c = (r % 2); c < N; c += 2) b.fillRect(c * cs, r * cs, cs, cs);
      bgKey = key;
    }
    return bgCache;
  }
  /* Posição de cada segmento entre a casa anterior e a atual (t de 0 a 1). */
  function segPos(i, t) {
    const now = S.snake[i], was = prevSnake && prevSnake[i];
    if (!was || t >= 1) return [now[0], now[1]];
    if (Math.abs(was[0] - now[0]) + Math.abs(was[1] - now[1]) !== 1) return [now[0], now[1]]; /* atravessou a parede */
    return [was[0] + (now[0] - was[0]) * t, was[1] + (now[1] - was[1]) * t];
  }
  function draw(now) {
    if (!cx || !S) return;
    now = now || performance.now();
    if (frame++ % 30 === 0 || !col.bg) readColors();
    const dpr = devicePixelRatio || 1, size = cv.width / dpr, cs = size / N;
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.drawImage(background(size, cs), 0, 0);
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const anim = motion(), t = anim ? frac : 1;
    /* Maçã (cresce ao aparecer) */
    if (S.apple) {
      const k = anim ? Math.min(1, (now - born) / 220) : 1, s = .5 + .5 * (1 - Math.pow(1 - k, 3));
      const [r, c] = S.apple, x = (c + .5) * cs, y = (r + .5) * cs;
      cx.fillStyle = col.apple; cx.beginPath(); cx.arc(x, y + cs * .04, cs * .36 * s, 0, 6.29); cx.fill();
      cx.fillStyle = "#1D7A3E"; cx.beginPath(); cx.ellipse(x + cs * .12 * s, y - cs * .3 * s, cs * .13 * s, cs * .07 * s, -.6, 0, 6.29); cx.fill();
    }
    if (S.gold) {
      const [r, c] = S.gold.p, x = (c + .5) * cs, y = (r + .5) * cs;
      const pulse = anim ? 1 + .08 * Math.sin(now / 120) : 1, f = S.gold.life / GOLD_STEPS;
      cx.strokeStyle = col.gold; cx.lineWidth = Math.max(2, cs * .1);
      cx.beginPath(); cx.arc(x, y, cs * .46, -Math.PI / 2, -Math.PI / 2 + f * 6.283); cx.stroke();
      cx.fillStyle = col.gold; cx.beginPath(); cx.arc(x, y, cs * .3 * pulse, 0, 6.29); cx.fill();
      cx.fillStyle = "rgba(255,255,255,.8)"; cx.beginPath(); cx.arc(x - cs * .09, y - cs * .09, cs * .07, 0, 6.29); cx.fill();
    }
    /* Corpo: uma linha grossa e redonda pelos centros dos segmentos, cortada onde atravessa a parede */
    const pts = S.snake.map((_, i) => segPos(i, t));
    cx.strokeStyle = col.body; cx.lineWidth = cs * .78; cx.lineCap = "round"; cx.lineJoin = "round";
    cx.beginPath();
    pts.forEach((p, i) => {
      const x = (p[1] + .5) * cs, y = (p[0] + .5) * cs, q = pts[i - 1];
      if (!q || Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) > 1.01) cx.moveTo(x, y); else cx.lineTo(x, y);
    });
    if (pts.length === 1) cx.lineTo((pts[0][1] + .5) * cs + .1, (pts[0][0] + .5) * cs);
    cx.stroke();
    /* Cabeça com olhos a olhar para onde vai */
    const dead = S.state === "over" && S.apple !== null;
    const [hr, hc] = pts[0], hx = hc * cs, hy = hr * cs, pad = cs * .06;
    cx.fillStyle = dead ? col.bad : col.head; rr(hx + pad, hy + pad, cs - pad * 2, cs - pad * 2, cs * .32);
    const [dr, dc] = S.dir, ex = (hc + .5 + dc * .14) * cs, ey = (hr + .5 + dr * .14) * cs, off = cs * .18;
    const eyes = dr ? [[ex - off, ey], [ex + off, ey]] : [[ex, ey - off], [ex, ey + off]];
    eyes.forEach(([x, y]) => {
      cx.fillStyle = "#fff"; cx.beginPath(); cx.arc(x, y, cs * .12, 0, 6.29); cx.fill();
      cx.fillStyle = "#1A181D"; cx.beginPath(); cx.arc(x + dc * cs * .04, y + dr * cs * .04, cs * .06, 0, 6.29); cx.fill();
    });
    /* Moldura: contínua com paredes, tracejada sem elas */
    cx.strokeStyle = S.mode === "livre" ? col.line : col.wall; cx.lineWidth = S.mode === "livre" ? 2 : 4;
    cx.setLineDash(S.mode === "livre" ? [6, 6] : []); cx.strokeRect(1, 1, size - 2, size - 2); cx.setLineDash([]);
    /* Avisos por cima */
    if (S.state === "ready" || S.state === "pause") {
      cx.fillStyle = "rgba(0,0,0,.45)"; cx.fillRect(0, 0, size, size);
      cx.fillStyle = "#fff"; cx.textAlign = "center"; cx.textBaseline = "middle";
      cx.font = "900 " + Math.round(size * .075) + "px Roboto,system-ui,sans-serif";
      cx.fillText(S.state === "pause" ? "Pausa" : "Pronta?", size / 2, size / 2 - size * .05);
      cx.font = "500 " + Math.round(size * .042) + "px Roboto,system-ui,sans-serif";
      const touch = matchMedia("(hover:none) and (pointer:coarse)").matches;
      cx.fillText(touch ? "Desliza o dedo para começar" : "Carrega numa seta para começar", size / 2, size / 2 + size * .05);
    }
  }

  /* ---------- Ecrã ---------- */
  function mount(c) {
    if (!S && !load()) newGame();
    if (!S.apple && S.state !== "over") S.apple = freeCell();
    els = c;
    c.stats.innerHTML = ui.stat("Pontos", "cb-score", "hl") + ui.stat("Recorde", "cb-best") + ui.stat("Tamanho", "cb-len") + ui.stat("Tempo", "cb-time");
    const wrap = el("div", { class: "cb-wrap", id: "cb-wrap" });
    cv = el("canvas", { class: "cb-canvas", id: "cb-canvas", role: "img", "aria-label": "Tabuleiro da Cobra" });
    wrap.appendChild(cv); cx = cv.getContext("2d");
    c.board.append(wrap, el("div", { class: "msg", id: "cb-msg", role: "status" }));
    els.wrap = wrap;
    const segS = ui.seg(SPEEDS, S.speed, id => askNew(id, S.mode), "Velocidade"); segS.id = "cb-speed";
    const segM = ui.seg(MODES, S.mode, id => askNew(S.speed, id), "Paredes"); segM.id = "cb-mode";
    const row = el("div", { class: "casino-actions" });
    const bP = el("button", { class: "btn", type: "button", id: "cb-pause" }); bP.onclick = () => { togglePause(); };
    const bN = el("button", { class: "btn", type: "button" }, ui.ICON.plus + "Novo jogo"); bN.onclick = () => askNew();
    row.append(bP, bN);
    const tip = el("p", { class: "hint" }, '<span class="for-touch">Desliza o dedo no tabuleiro para mudar de direção.</span><span class="for-mouse">Setas ou <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> para virar, <kbd>Espaço</kbd> para pausa. Também dá para arrastar com o rato.</span>');
    c.controls.append(segS, segM, row, tip);
    cv.addEventListener("pointerdown", e => { e.preventDefault(); swipe = { x: e.clientX, y: e.clientY, moved: false }; try { cv.setPointerCapture(e.pointerId); } catch (x) {} });
    cv.addEventListener("pointermove", e => {
      if (!swipe) return;
      const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
      turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
      swipe = { x: e.clientX, y: e.clientY, moved: true }; /* dá para fazer várias curvas sem levantar o dedo */
    });
    cv.addEventListener("pointerup", () => { if (swipe && !swipe.moved && S.state !== "run" && S.state !== "over") start(); swipe = null; });
    cv.addEventListener("pointercancel", () => { swipe = null; });
    document.addEventListener("pointerdown", docDown);
    document.addEventListener("pointermove", docMove);
    document.addEventListener("pointerup", docUp);
    document.addEventListener("touchmove", noScroll, { passive: false });
    resize(); syncPause(); stats();
    if (S.state === "over") msg(S.score ? "Fim de jogo. Começa outro quando quiseres." : "Sem pontos desta vez. Tenta outra vez.", true);
    addEventListener("resize", resize);
    last = performance.now(); raf = requestAnimationFrame(loop);
  }
  function unmount() {
    pause(); save(); lock(false); cancelAnimationFrame(raf); raf = 0; removeEventListener("resize", resize);
    document.removeEventListener("pointerdown", docDown); document.removeEventListener("pointermove", docMove);
    document.removeEventListener("pointerup", docUp); document.removeEventListener("touchmove", noScroll);
    els = null; cv = cx = null; docSwipe = null;
  }
  /* Com o jogo a correr, deslizar em qualquer sítio do ecrã (fora dos botões) também vira a cobra. */
  let docSwipe = null;
  function docDown(e) {
    if (!S || S.state !== "run" || e.target === cv || (e.target.closest && e.target.closest("button,input,dialog,a"))) return;
    docSwipe = { x: e.clientX, y: e.clientY };
  }
  function docMove(e) {
    if (!docSwipe) return;
    const dx = e.clientX - docSwipe.x, dy = e.clientY - docSwipe.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 26) return;
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
    docSwipe = { x: e.clientX, y: e.clientY };
  }
  function docUp() { docSwipe = null; }
  function noScroll(e) { if (S && S.state === "run" && !modal.isOpen) e.preventDefault(); }
  function resize() {
    if (!cv) return;
    const area = els.board, wide = innerWidth >= 900;
    const size = Math.max(240, Math.floor(Math.min(area.clientWidth, 560, innerHeight - (wide ? 130 : 230))));
    const dpr = devicePixelRatio || 1;
    cv.style.width = cv.style.height = size + "px";
    cv.width = cv.height = Math.round(size * dpr);
    draw();
  }
  function stats() {
    const set = (id, v) => { const n = document.getElementById(id); if (n) n.textContent = v; };
    set("cb-score", fmtNum(S.score)); set("cb-len", fmtNum(S.snake.length)); set("cb-time", fmtTime(S.time));
    const b = ranking.best("cobra", keyOf(S.speed, S.mode)); set("cb-best", b ? fmtNum(b.score) : "—");
  }
  function syncPause() {
    const b = document.getElementById("cb-pause"); if (!b) return;
    const running = S.state === "run";
    b.innerHTML = running ? '<svg viewBox="0 0 24 24"><path d="M9 5v14M15 5v14"/></svg>Pausa' : '<svg viewBox="0 0 24 24"><path d="M7 4l12 8-12 8z"/></svg>' + (S.state === "pause" ? "Continuar" : "Começar");
    b.disabled = S.state === "over";
  }
  function syncSegs() {
    [["cb-speed", SPEEDS, S.speed], ["cb-mode", MODES, S.mode]].forEach(([id, list, cur]) => {
      const s = document.getElementById(id); if (s) s.querySelectorAll("button").forEach((b, k) => b.setAttribute("aria-pressed", String(list[k].id === cur)));
    });
    syncPause();
  }
  function msg(t, bad) { const m = document.getElementById("cb-msg"); if (m) { m.textContent = t; m.className = "msg" + (bad ? " bad" : ""); } }

  function onKey(e) {
    const m = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", a: "left", d: "right", w: "up", s: "down", A: "left", D: "right", W: "up", S: "down" }[e.key];
    if (m) { turn(m); e.preventDefault(); return; }
    if (e.key === " " || e.key === "p" || e.key === "P") { togglePause(); e.preventDefault(); return; }
    if (e.key === "Enter" && S.state === "over") { newGame(); e.preventDefault(); }
  }
  function tick() { if (S && S.state === "run") { S.time++; const n = document.getElementById("cb-time"); if (n) n.textContent = fmtTime(S.time); if (S.time % 10 === 0) save(); } }

  function help() {
    return "<h4>Objetivo</h4><p>Comer as maçãs e crescer o mais possível sem bater em nada. A cobra não para: só podes escolher para onde vira.</p>" +
      "<h4>Controlos</h4><ul><li><b>Toque:</b> desliza o dedo no tabuleiro (dá para fazer várias curvas sem levantar o dedo).</li><li><b>Teclado:</b> setas ou <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>; <kbd>Espaço</kbd> põe em pausa.</li><li><b>Rato:</b> arrasta no tabuleiro.</li><li>O jogo pára sozinho quando sais da app ou abres uma janela.</li></ul>" +
      "<h4>Modos</h4><ul><li><b>Com paredes:</b> bater na moldura ou no próprio corpo acaba o jogo.</li><li><b>Sem paredes:</b> sai de um lado e entra pelo outro; só acaba se te morderes.</li><li>A velocidade (Lenta, Normal ou Rápida) vai aumentando um pouco a cada maçã.</li></ul>" +
      "<h4>Pontuação</h4><ul><li>Maçã: 10 pontos × a velocidade (×1 Lenta, ×2 Normal, ×3 Rápida).</li><li>Às vezes aparece uma maçã dourada: vale 50 × a velocidade e desaparece quando o anel à volta se esgota.</li><li>Cada combinação de velocidade e paredes tem o seu top 10.</li></ul>";
  }

  Sala.registerGame({
    id: "cobra", name: "Cobra", ready: true, diffs: SPEEDS.map(s => ({ id: s.id, label: s.label })), rankModes: MODES,
    desc: "Comer, crescer e não bater em nada.",
    art: '<svg viewBox="0 0 36 36"><path d="M6 28h12V18h12V8" fill="none" stroke="var(--blue)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="30" cy="8" r="3.5" fill="var(--ink)"/><circle cx="9" cy="10" r="3" fill="var(--yellow)"/></svg>',
    lastDiff,
    meta() {
      const out = []; if (!S) load();
      if (S && (S.state === "pause" || S.state === "run") && S.score) out.push({ text: "Em pausa · " + fmtNum(S.score) + " pts", cls: "blue" });
      const k = lastDiff(), b = ranking.best("cobra", k); if (b) out.push({ text: "Recorde " + fmtNum(b.score) + " pts" });
      return out;
    },
    help, mount, unmount, tick, onKey, save
  });
})();
