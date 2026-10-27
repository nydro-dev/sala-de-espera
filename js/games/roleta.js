/* Sala de Espera — Roleta europeia (um zero), fichas virtuais da banca comum */
(function () {
  "use strict";
  const { el, fmtNum, store, sound, vibrate, motion, fx, toast } = Sala;
  const C = Sala.casino;

  const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const colorOf = n => n === 0 ? "green" : REDS.has(n) ? "red" : "black";
  const CHIPS = [10, 25, 100, 500];
  const SEG = 2 * Math.PI / 37;

  /* Apostas: chave → [rótulo, prémio total por ficha (aposta incluída), teste] */
  const BETS = {
    red: ["Vermelho", 2, n => colorOf(n) === "red"], black: ["Preto", 2, n => colorOf(n) === "black"],
    even: ["Par", 2, n => n > 0 && n % 2 === 0], odd: ["Ímpar", 2, n => n % 2 === 1],
    low: ["1 a 18", 2, n => n >= 1 && n <= 18], high: ["19 a 36", 2, n => n >= 19],
    d1: ["1.ª dúzia", 3, n => n >= 1 && n <= 12], d2: ["2.ª dúzia", 3, n => n >= 13 && n <= 24], d3: ["3.ª dúzia", 3, n => n >= 25],
    c1: ["1.ª coluna", 3, n => n > 0 && n % 3 === 1], c2: ["2.ª coluna", 3, n => n > 0 && n % 3 === 2], c3: ["3.ª coluna", 3, n => n > 0 && n % 3 === 0]
  };
  const betInfo = k => k.startsWith("n:") ? ["Número " + k.slice(2), 36, n => n === +k.slice(2)] : BETS[k];

  let S = null, els = null, chip = 25, offChange = null, raf = 0, spinning = false;
  function load() { S = Object.assign({ bets: {}, stack: [], lastBets: null, history: [], last: null, angle: 0, pending: null }, store.get("rl", {})); }
  const save = () => { if (S) store.set("rl", S); };
  const total = () => Object.values(S.bets).reduce((a, b) => a + b, 0);

  /* ---------- Apostas ---------- */
  function place(k) {
    if (spinning) return;
    if (total() + chip > C.balance) { toast("Não tens fichas para isso. Saldo: " + fmtNum(C.balance) + "."); sound.error(); return; }
    S.bets[k] = (S.bets[k] || 0) + chip; S.stack.push([k, chip]);
    sound.tap(); vibrate(8); save(); render();
  }
  function undo() { if (spinning) return; const s = S.stack.pop(); if (!s) return; S.bets[s[0]] -= s[1]; if (S.bets[s[0]] <= 0) delete S.bets[s[0]]; sound.tap(); save(); render(); }
  function clear() { if (spinning) return; S.bets = {}; S.stack = []; sound.tap(); save(); render(); }
  function repeat() {
    if (spinning || !S.lastBets) return;
    const t = Object.values(S.lastBets).reduce((a, b) => a + b, 0);
    if (t > C.balance) { toast("O saldo não chega para repetir (" + fmtNum(t) + " fichas)."); return; }
    S.bets = Object.assign({}, S.lastBets); S.stack = Object.entries(S.bets).map(([k, v]) => [k, v]);
    sound.tap(); save(); render();
  }

  /* ---------- Girar ---------- */
  function spin() {
    if (spinning) return;
    const t = total();
    if (t < C.MIN_BET) { toast("Aposta pelo menos " + C.MIN_BET + " fichas."); return; }
    if (!C.take(t)) { toast("Saldo insuficiente."); return; }
    C.round();
    const n = C.rand(37);
    let pay = 0; const wins = [];
    for (const k in S.bets) { const b = betInfo(k); if (b[2](n)) { pay += S.bets[k] * b[1]; wins.push(k); } }
    S.pending = { n, pay, staked: t, wins };
    S.lastBets = Object.assign({}, S.bets);
    save();
    spinning = true; render();
    sound.open();
    /* No telemóvel, a mesa fica por baixo da roda: sobe até à roda para se ver o giro. */
    const w = document.querySelector(".rl-wheel");
    if (w) { const r = w.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) w.scrollIntoView({ behavior: motion() ? "smooth" : "auto", block: "center" }); }
    animate(n, () => settle());
  }
  function settle() {
    const p = S.pending; if (!p) return;
    S.pending = null; spinning = false;
    if (p.pay) C.give(p.pay);
    S.last = p.n; S.history.unshift(p.n); S.history = S.history.slice(0, 12);
    S.lastWins = p.wins;
    const net = p.pay - p.staked;
    S.note = net > 0 ? "Ganhaste " + fmtNum(net) + " fichas." : net < 0 ? "Perdeste " + fmtNum(-net) + " fichas." : "Recuperaste a aposta.";
    S.bets = {}; S.stack = [];
    save();
    if (els) {
      if (net > 0 && p.wins.some(k => k.startsWith("n:"))) { sound.win(); vibrate([30, 50, 30]); fx.confetti(); }
      else if (net > 0) { sound.line(); vibrate(25); }
      else if (net < 0) sound.error(); else sound.tap();
      render();
    }
    C.checkBust(false);
  }

  /* ---------- Roda ---------- */
  function drawWheel(cv) {
    const r = devicePixelRatio || 1, size = cv.clientWidth || 300;
    cv.width = size * r; cv.height = size * r;
    const x = cv.getContext("2d"); x.setTransform(r, 0, 0, r, 0, 0);
    const c = size / 2, R = c - 2;
    x.clearRect(0, 0, size, size);
    x.beginPath(); x.arc(c, c, R, 0, 7); x.fillStyle = "#FFC301"; x.fill();
    ORDER.forEach((n, k) => {
      const a0 = -Math.PI / 2 + k * SEG - SEG / 2;
      x.beginPath(); x.moveTo(c, c); x.arc(c, c, R - 6, a0, a0 + SEG); x.closePath();
      x.fillStyle = { red: "#C0262D", black: "#1A181D", green: "#0B6E4F" }[colorOf(n)]; x.fill();
      x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 1; x.stroke();
      x.save(); x.translate(c, c); x.rotate(a0 + SEG / 2 + Math.PI / 2);
      x.fillStyle = "#fff"; x.font = "700 " + Math.round(size * .042) + "px Roboto, system-ui, sans-serif"; x.textAlign = "center";
      x.fillText(String(n), 0, -(R - 6) + size * .06); x.restore();
    });
    x.beginPath(); x.arc(c, c, R * .62, 0, 7); x.fillStyle = "#0B6E4F"; x.fill();
    x.beginPath(); x.arc(c, c, R * .55, 0, 7); x.fillStyle = "#09B5FF"; x.fill();
    x.beginPath(); x.arc(c, c, R * .16, 0, 7); x.fillStyle = "#FFC301"; x.fill();
    for (let i = 0; i < 8; i++) { x.save(); x.translate(c, c); x.rotate(i * Math.PI / 4); x.fillStyle = "#1A181D"; x.fillRect(-2, -R * .5, 4, R * .34); x.restore(); }
  }
  function setAngle(a) { const cv = document.getElementById("rl-cv"); if (cv) cv.style.transform = "rotate(" + a + "rad)"; }
  /* Bola: ângulo no ecrã (−π/2 é o topo) e raio em fração do raio da roda. */
  const TOP = -Math.PI / 2, R_TRACK = .9, R_POCKET = .7;
  function setBall(a, rf, show) {
    const b = document.getElementById("rl-ballmark"), w = document.querySelector(".rl-wheel"); if (!b || !w) return;
    b.hidden = !show; if (!show) return;
    const size = w.clientWidth, c = size / 2, R = c - 2, d = b.offsetWidth || size * .055;
    b.style.transform = "translate(" + (c + Math.cos(a) * R * rf - d / 2) + "px," + (c + Math.sin(a) * R * rf - d / 2) + "px)";
  }
  /* Ângulo no ecrã da casa de um número, com a roda rodada de "a". */
  const pocketOf = n => TOP + ORDER.indexOf(n) * SEG;
  /* Onde a bola fica parada (nas versões antigas a roda parava com o número no topo). */
  const restAngle = () => S.ballRel != null ? S.angle + S.ballRel : TOP;
  function animate(n, done) {
    /* A roda pára num sítio ao acaso: o número só se sabe quando a bola assenta na casa. */
    const from = S.angle % (2 * Math.PI);
    const to = from - 2 * Math.PI * (4 + Math.random()) - Math.random() * 2 * Math.PI;
    const rel = pocketOf(n);
    S.angle = to; S.ballRel = rel;
    if (!motion() || !els) { S.ballA = (S.angle + rel) % (2 * Math.PI); setAngle(S.angle); setBall(S.angle + rel, R_POCKET, true); setTimeout(done, motion() ? 0 : 250); return; }
    const t0 = performance.now(), dur = 6200, pd = .58;                 /* pd: altura em que a bola cai da pista */
    const ease = p => 1 - Math.pow(1 - p, 3), wheelAt = p => from + (to - from) * ease(p);
    /* Depois de cair, a bola ainda salta umas casas à frente antes de assentar (e roda com a roda). */
    const slip = (2 + Math.floor(Math.random() * 4)) * SEG * (Math.random() < .5 ? 1 : -1);
    const bFrom = S.ballA != null ? S.ballA : TOP;
    /* Na pista, a bola corre no sentido dos ponteiros e tem de chegar ao ponto exato onde cai. */
    const land = wheelAt(pd) + rel + slip;
    let D = land - bFrom; D = ((D % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) + 2 * Math.PI * 7;
    const eb = p => 1 - Math.pow(1 - p, 2.2), ebEnd = eb(1);
    let lastSeg = -1, bounced = 0;
    const step = now => {
      const p = Math.min(1, (now - t0) / dur), a = wheelAt(p);
      setAngle(a);
      let ba, rf;
      if (p < pd) { ba = bFrom + D * eb(p / pd) / ebEnd; rf = R_TRACK; }
      else {
        const q = Math.min(1, (p - pd) / .3), qe = 1 - Math.pow(1 - q, 2);
        ba = a + rel + slip * (1 - qe);
        rf = R_POCKET + (R_TRACK - R_POCKET) * (1 - qe) + Math.abs(Math.sin(q * Math.PI * 4)) * .06 * (1 - q);
        if (q < 1 && q > bounced / 4) { bounced++; sound.flag(); }
      }
      setBall(ba, rf, true);
      const sg = Math.floor(a / SEG); if (sg !== lastSeg) { lastSeg = sg; if (p < pd) sound.tap(); }
      if (p < 1) raf = requestAnimationFrame(step);
      else { raf = 0; S.ballA = (S.angle + rel) % (2 * Math.PI); vibrate(15); done(); }
    };
    raf = requestAnimationFrame(step);
  }


  /* ---------- Ecrã ---------- */
  function mount(c) {
    if (!S) load();
    if (S.pending) { spinning = false; settle(); } /* uma jogada interrompida é paga logo */
    els = c; spinning = false;
    c.stats.innerHTML = C.statsHtml("rl");

    const wheel = el("div", { class: "rl-wheel" }, '<canvas id="rl-cv" aria-label="Roda da roleta"></canvas><div class="rl-ballmark" id="rl-ballmark" hidden></div>');
    const result = el("div", { class: "rl-result", id: "rl-res", role: "status" });
    const hist = el("div", { class: "rl-hist", id: "rl-hist", "aria-label": "Últimos números" });
    const note = el("div", { class: "msg", id: "rl-note" });
    const left = el("div", { class: "rl-left" }); left.append(wheel, result, note, hist);
    const lay = el("div", { class: "rl-layout" }); lay.append(left, buildBoard());
    c.board.append(lay);

    const chips = C.chipRow(CHIPS, chip, v => { chip = v; sound.tap(); });
    const row1 = el("div", { class: "casino-actions" });
    [["rl-undo", "Desfazer", undo], ["rl-clear", "Limpar", clear], ["rl-repeat", "Repetir", repeat], ["rl-spin", "Girar", spin]].forEach(([id, l, f]) => {
      const b = el("button", { class: "btn" + (id === "rl-spin" ? " primary" : ""), type: "button", id }, l); b.onclick = f; row1.appendChild(b);
    });
    const bClose = el("button", { class: "btn ghost", type: "button" }, "Fechar a banca"); bClose.onclick = () => C.askClose();
    const tip = el("p", { class: "hint" }, "Escolhe a ficha e toca na mesa para apostar. Fichas virtuais, sem valor.");
    const kb = el("p", { class: "hint for-mouse" }, "Teclado: <kbd>Espaço</kbd> girar, <kbd>Ctrl</kbd>+<kbd>Z</kbd> desfazer, <kbd>R</kbd> repetir.");
    c.controls.append(chips, row1, bClose, tip, kb);

    const cv = document.getElementById("rl-cv");
    requestAnimationFrame(() => { drawWheel(cv); setAngle(S.angle); setBall(restAngle(), R_POCKET, S.last != null); });
    addEventListener("resize", redraw);
    offChange = C.onChange(() => { if (els) C.drawStats("rl", total()); });
    render();
  }
  function redraw() { const cv = document.getElementById("rl-cv"); if (cv) drawWheel(cv); if (!spinning) setBall(restAngle(), R_POCKET, S.last != null); }
  function unmount() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (S && S.pending) settle();
    spinning = false; save(); removeEventListener("resize", redraw); if (offChange) offChange(); els = null;
  }

  function buildBoard() {
    const b = el("div", { class: "rl-board", id: "rl-board", role: "group", "aria-label": "Mesa de apostas" });
    const cell = (k, label, cls, col, row, span) => {
      const d = el("button", { type: "button", class: "rl-cell " + cls, "data-k": k, "aria-label": betInfo(k)[0] }, cls === "out" ? '<span class="vt">' + label + "</span>" : label);
      d.style.gridColumn = col; d.style.gridRow = row + (span ? " / span " + span : "");
      d.onclick = () => place(k);
      b.appendChild(d);
    };
    cell("n:0", "0", "zero", "3 / span 3", 1);
    for (let r = 0; r < 12; r++) for (let j = 0; j < 3; j++) { const n = r * 3 + j + 1; cell("n:" + n, String(n), "n " + colorOf(n), String(3 + j), r + 2); }
    ["d1", "d2", "d3"].forEach((k, i) => cell(k, BETS[k][0], "out", "2", 2 + i * 4, 4));
    [["low", "1–18"], ["even", "Par"], ["red", "Vermelho"], ["black", "Preto"], ["odd", "Ímpar"], ["high", "19–36"]].forEach(([k, l], i) => cell(k, l, "out", "1", 2 + i * 2, 2));
    ["c1", "c2", "c3"].forEach((k, i) => cell(k, "2:1", "small", String(3 + i), 14));
    return b;
  }

  function render() {
    if (!els) return;
    const t = total();
    document.querySelectorAll("#rl-board .rl-cell").forEach(d => {
      const k = d.dataset.k, v = S.bets[k];
      let st = d.querySelector(".stake");
      if (v) { if (!st) { st = el("span", { class: "stake" }); d.appendChild(st); } st.textContent = v >= 1000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0).replace(".", ",") + "k" : v; }
      else if (st) st.remove();
      d.classList.toggle("hit", !spinning && S.last != null && betInfo(k)[2](S.last) && !t);
      d.disabled = spinning;
    });
    const res = document.getElementById("rl-res");
    if (spinning) res.innerHTML = '<span class="rl-ball">…</span><span>A girar</span>';
    else if (S.last != null) res.innerHTML = '<span class="rl-ball ' + colorOf(S.last) + '">' + S.last + "</span><span>" + ({ red: "Vermelho", black: "Preto", green: "Zero" })[colorOf(S.last)] + (S.last ? " · " + (S.last % 2 ? "Ímpar" : "Par") : "") + "</span>";
    else res.innerHTML = "<span>Faz as tuas apostas</span>";
    document.getElementById("rl-hist").innerHTML = S.history.map(n => '<span class="' + colorOf(n) + '">' + n + "</span>").join("");
    document.getElementById("rl-note").textContent = spinning ? "" : (t ? "" : S.note || "");
    const sp = document.getElementById("rl-spin"); sp.disabled = spinning || t < C.MIN_BET; sp.textContent = t ? "Girar · " + fmtNum(t) : "Girar";
    document.getElementById("rl-undo").disabled = spinning || !S.stack.length;
    document.getElementById("rl-clear").disabled = spinning || !t;
    document.getElementById("rl-repeat").disabled = spinning || !S.lastBets || !!t;
    C.drawStats("rl", spinning ? S.pending && S.pending.staked : t);
  }

  function onKey(e) {
    const k = e.key.toLowerCase();
    if (k === " " || k === "enter") { spin(); e.preventDefault(); }
    else if (k === "z" && (e.ctrlKey || e.metaKey)) { undo(); e.preventDefault(); }
    else if (k === "r") repeat();
  }

  function help() {
    return "<h4>Objetivo</h4><p>Apostar onde vai parar a bola. A roleta é europeia: números de 1 a 36, metade vermelhos e metade pretos, e um só zero, verde.</p>" +
      "<h4>Como se joga</h4><ul><li>Escolhe o valor da ficha e toca na mesa para apostar. Podes pôr várias fichas em vários sítios.</li>" +
      "<li><b>Girar</b> lança a bola. <b>Repetir</b> volta a pôr as apostas da jogada anterior; <b>Desfazer</b> tira a última ficha.</li>" +
      "<li>Teclado: <kbd>Espaço</kbd> girar, <kbd>Ctrl</kbd>+<kbd>Z</kbd> desfazer, <kbd>R</kbd> repetir.</li></ul>" +
      "<h4>Prémios</h4><ul><li>Número certo: 35 para 1.</li><li>Dúzia ou coluna (2:1): 2 para 1.</li><li>Vermelho, Preto, Par, Ímpar, 1–18 e 19–36: 1 para 1.</li>" +
      "<li>Se sair o zero, perdem todas as apostas exceto a do próprio zero.</li></ul>" +
      "<h4>Banca e ranking</h4><ul><li>O Blackjack e a Roleta usam a mesma banca, que começa com 1000 fichas virtuais, sem valor real e sem compras.</li>" +
      "<li>Se ficares abaixo de 10 fichas, a banca fecha e começas outra. Também a podes fechar quando quiseres.</li>" +
      "<li>Cada banca fechada entra no ranking do casino com o maior saldo que atingiu.</li></ul>";
  }

  Sala.registerGame({
    id: "roleta", name: "Roleta", ready: true, rankAs: "casino",
    diffs: [{ id: "banca", label: "Maior saldo" }],
    desc: "Roleta europeia de um só zero. Fichas virtuais, sem dinheiro.",
    art: '<svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" fill="var(--ink)"/><circle cx="18" cy="18" r="15" fill="none" stroke="var(--yellow)" stroke-width="4" stroke-dasharray="4.71 4.71"/><circle cx="18" cy="18" r="7" fill="var(--blue)"/><circle cx="18" cy="7.5" r="2" fill="var(--surface)"/></svg>',
    lastDiff: () => "banca",
    meta() {
      if (!S) load();
      const out = [{ text: "Saldo " + fmtNum(C.balance) + " fichas", cls: "blue" }];
      if (S.history.length) out.push({ text: "Último: " + S.history[0] });
      return out;
    },
    help, mount, unmount, onKey, save,
    tick() { C.tick(); }
  });
})();
