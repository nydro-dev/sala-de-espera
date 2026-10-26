/* Sala de Espera — Palavras (descobrir uma palavra de cinco letras em seis tentativas) */
(function () {
  "use strict";
  const { el, fmtNum, fmtTime, store, sound, vibrate, motion, fx, toast, ranking, ui, finish } = Sala;

  const LEN = 5, TRIES = 6;
  const DIFFS = [{ id: "dia", label: "Palavra do dia" }, { id: "livre", label: "Jogo livre" }];
  const POINTS = [1000, 800, 600, 400, 250, 150];   /* por número de tentativas */
  const EPOCH = Date.UTC(2026, 9, 26);              /* palavra n.º 1: 26/10/2026 */

  const key = w => w.normalize("NFD").replace(/[̀-ͯ]/g, "");  /* "ação" → "acao" */
  const SOL = (window.SALA_SOLUCOES || "").split(" ").filter(Boolean);
  const SOLSET = new Set(SOL);
  const SHOWN = new Map();   /* forma sem acentos → forma escrita (as soluções têm prioridade) */
  (window.SALA_VALIDAS || "").split(" ").concat(SOL).forEach(w => { const k = key(w); if (!SHOWN.has(k) || SOLSET.has(w)) SHOWN.set(k, w); });

  const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const dayNumber = ds => { const [y, m, d] = ds.split("-").map(Number); return Math.floor((Date.UTC(y, m - 1, d) - EPOCH) / 864e5) + 1; };
  const dailyWord = ds => SOL[((dayNumber(ds) - 1) % SOL.length + SOL.length) % SOL.length];

  /* ---------- Estado ---------- */
  let P = null, els = null, typing = "", busy = false;
  function freshGame(mode) {
    if (mode === "dia") { const d = today(); return { mode, date: d, n: dayNumber(d), word: dailyWord(d), guesses: [], done: false, won: false, time: 0 }; }
    return { mode, word: SOL[Math.random() * SOL.length | 0], guesses: [], done: false, won: false, time: 0 };
  }
  function load() {
    P = Object.assign({ mode: "dia", games: {}, streak: 0, bestStreak: 0, lastWin: null, stats: { dia: { played: 0, won: 0, dist: [0, 0, 0, 0, 0, 0] }, livre: { played: 0, won: 0, dist: [0, 0, 0, 0, 0, 0] } } }, store.get("palavras", {}));
    const g = P.games.dia;
    if (!g || g.date !== today()) P.games.dia = freshGame("dia");
    if (!P.games.livre) P.games.livre = freshGame("livre");
    /* A sequência quebra se falhou um dia inteiro. */
    if (P.lastWin && dayNumber(today()) - dayNumber(P.lastWin) > 1) P.streak = 0;
    store.set("palavras", P);
  }
  const save = () => { if (P) store.set("palavras", P); };
  const G = () => P.games[P.mode];

  /* ---------- Avaliação (com letras repetidas) ---------- */
  function score(guess, word) {
    const g = key(guess), w = key(word), res = Array(LEN).fill("absent"), left = {};
    for (let i = 0; i < LEN; i++) if (g[i] === w[i]) res[i] = "correct"; else left[w[i]] = (left[w[i]] || 0) + 1;
    for (let i = 0; i < LEN; i++) if (res[i] !== "correct" && left[g[i]]) { res[i] = "present"; left[g[i]]--; }
    return res;
  }

  /* ---------- Ações ---------- */
  function type(ch) {
    if (busy || G().done || typing.length >= LEN) return;
    typing += ch; sound.tap(); renderRow(G().guesses.length, true);
  }
  function erase() { if (busy || G().done || !typing) return; typing = typing.slice(0, -1); sound.tap(); renderRow(G().guesses.length); }
  function submit() {
    const g = G(); if (busy || g.done) return;
    if (typing.length < LEN) { shake("Faltam letras."); return; }
    const shown = SHOWN.get(typing);
    if (!shown) { shake("Essa palavra não está na lista."); return; }
    if (g.guesses.some(x => key(x) === typing)) { shake("Já tentaste essa palavra."); return; }
    g.guesses.push(shown); typing = "";
    const row = g.guesses.length - 1, won = key(shown) === key(g.word);
    if (won || g.guesses.length >= TRIES) endGame(won);
    save();
    busy = true;
    reveal(row, () => {
      busy = false; renderKeys();
      if (won) { sound.win(); vibrate([30, 50, 30]); bounce(row); later(() => result(true), motion() ? 900 : 100); }
      else if (g.done) { sound.error(); later(() => result(false), motion() ? 500 : 100); }
      else sound.place();
    });
  }
  let timers = [];
  const later = (f, ms) => timers.push(setTimeout(f, ms));
  function endGame(won) {
    const g = G(), st = P.stats[g.mode];
    g.done = true; g.won = won; st.played++;
    if (won) {
      st.won++; st.dist[g.guesses.length - 1]++;
      if (g.mode === "dia") {
        P.streak = P.lastWin && dayNumber(g.date) - dayNumber(P.lastWin) === 1 ? P.streak + 1 : 1;
        P.lastWin = g.date; P.bestStreak = Math.max(P.bestStreak, P.streak);
      }
    } else if (g.mode === "dia") P.streak = 0;
    g.points = won ? pointsFor(g) : 0;
  }
  function pointsFor(g) {
    const base = POINTS[g.guesses.length - 1];
    const bonus = g.mode === "dia" ? Math.min(1, (P.streak - 1) * .1) : 0;   /* +10 % por dia seguido, até ao dobro */
    return Math.round(base * (1 + bonus));
  }
  function result(won) {
    const g = G(), dl = DIFFS.find(d => d.id === g.mode).label;
    renderAll();
    if (!won) { msg("A palavra era " + g.word.toUpperCase() + ".", true); return; }
    const base = POINTS[g.guesses.length - 1];
    finish({
      game: "palavras", diff: g.mode, diffLabel: dl, title: g.mode === "dia" ? "Palavra do dia nº " + g.n : "Acertaste", score: g.points, time: g.time,
      breakdown: [["Tentativas", g.guesses.length + " de " + TRIES], ["Pontos pela tentativa", fmtNum(base)]].concat(g.mode === "dia" ? [["Sequência de " + P.streak + " dia" + (P.streak > 1 ? "s" : ""), "+" + fmtNum(g.points - base)]] : []),
      newLabel: g.mode === "dia" ? "Jogo livre" : "Outra palavra",
      onNew: () => { if (g.mode === "dia") setMode("livre"); else newFree(); }
    });
  }
  function newFree() { P.games.livre = freshGame("livre"); typing = ""; save(); if (P.mode !== "livre") setMode("livre"); else { buildGrid(); renderAll(); } }
  function setMode(m) {
    if (busy) return;
    P.mode = m; typing = ""; save();
    const s = document.getElementById("w-mode"); if (s) s.querySelectorAll("button").forEach((b, k) => b.setAttribute("aria-pressed", String(DIFFS[k].id === m)));
    buildGrid(); renderAll();
  }
  function giveUp() {
    const g = G(); if (g.done || g.mode !== "livre") return;
    endGame(false); save(); renderAll(); msg("A palavra era " + g.word.toUpperCase() + ".", true);
  }
  async function share() {
    const g = G(); if (!g.done) return;
    const head = (g.mode === "dia" ? "Palavras nº " + g.n : "Palavras · jogo livre") + " · " + (g.won ? g.guesses.length : "X") + "/" + TRIES;
    const grid = g.guesses.map(w => score(w, g.word).map(r => r === "correct" ? "🟦" : r === "present" ? "🟨" : "⬜").join("")).join("\n");
    const text = head + "\n" + grid;
    try { await navigator.clipboard.writeText(text); toast("Resultado copiado. Já o podes colar numa mensagem."); }
    catch (e) { toast("Não consegui copiar automaticamente."); }
  }

  /* ---------- Ecrã ---------- */
  function mount(c) {
    if (!P) load(); else if (P.games.dia.date !== today()) load();
    els = c; typing = ""; busy = false;
    c.stats.innerHTML = ui.stat("Sequência", "w-streak", "hl") + ui.stat("Melhor", "w-bstreak") + ui.stat("Vitórias", "w-wins") + ui.stat("Recorde", "w-best");
    c.board.append(el("div", { class: "w-grid", id: "w-grid", "aria-label": "Tentativas" }), el("div", { class: "msg", id: "w-msg", role: "status" }));
    const seg = ui.seg(DIFFS, P.mode, m => setMode(m), "Modo"); seg.id = "w-mode";
    const kb = el("div", { class: "w-kb", id: "w-kb", "aria-label": "Teclado" });
    ["qwertyuiop", "asdfghjkl", "<zxcvbnm>"].forEach(rowStr => {
      const row = el("div", { class: "w-kbrow" });
      for (const ch of rowStr) {
        const isEnter = ch === "<", isBack = ch === ">";
        const k = el("button", { type: "button", class: "w-key" + (isEnter || isBack ? " wide" : ""), "data-k": isEnter ? "enter" : isBack ? "back" : ch, "aria-label": isEnter ? "Enviar" : isBack ? "Apagar" : ch.toUpperCase() },
          isEnter ? "Enviar" : isBack ? '<svg viewBox="0 0 24 24"><path d="M9 6h11v12H9l-6-6z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/></svg>' : ch.toUpperCase());
        if ("kwy".includes(ch)) k.disabled = true;
        k.onclick = () => { k.blur(); isEnter ? submit() : isBack ? erase() : type(ch); };
        row.appendChild(k);
      }
      kb.appendChild(row);
    });
    const actions = el("div", { class: "casino-actions", id: "w-actions" });
    const bShare = el("button", { class: "btn", type: "button", id: "w-share" }, "Copiar resultado"); bShare.onclick = share;
    const bNew = el("button", { class: "btn", type: "button", id: "w-new" }, ui.ICON.plus + "Outra palavra"); bNew.onclick = () => { const g = P.games.livre; if (!g.done && g.guesses.length) giveUp(); newFree(); };
    actions.append(bShare, bNew);
    const tip = el("p", { class: "hint", id: "w-tip" });
    c.controls.append(seg, kb, actions, tip);
    buildGrid(); renderAll();
  }
  function unmount() { save(); timers.forEach(clearTimeout); timers = []; els = null; }
  function msg(t, bad) { const m = document.getElementById("w-msg"); if (m) { m.textContent = t; m.className = "msg" + (bad ? " bad" : ""); } }

  function buildGrid() {
    const g = document.getElementById("w-grid"); if (!g) return; g.innerHTML = "";
    for (let r = 0; r < TRIES; r++) {
      const row = el("div", { class: "w-row" });
      for (let i = 0; i < LEN; i++) row.appendChild(el("div", { class: "w-cell" }));
      g.appendChild(row);
    }
  }
  function renderRow(r, popLast) {
    const row = document.getElementById("w-grid").children[r]; if (!row) return;
    const g = G(), word = g.guesses[r];
    [...row.children].forEach((c, i) => {
      if (word) { c.textContent = word[i].toUpperCase(); c.className = "w-cell " + score(word, g.word)[i]; }
      else if (r === g.guesses.length && !g.done) {
        c.textContent = (typing[i] || "").toUpperCase(); c.className = "w-cell" + (typing[i] ? " filled" : "") + (popLast && i === typing.length - 1 ? " pop" : "");
      } else { c.textContent = ""; c.className = "w-cell"; }
    });
  }
  function renderAll() {
    if (!els) return;
    for (let r = 0; r < TRIES; r++) renderRow(r);
    renderKeys();
    const g = G(), st = P.stats[g.mode];
    const set = (id, v) => { const n = document.getElementById(id); if (n) n.textContent = v; };
    set("w-streak", P.streak + (P.streak === 1 ? " dia" : " dias")); set("w-bstreak", P.bestStreak);
    set("w-wins", st.played ? Math.round(st.won / st.played * 100) + " %" : "—");
    const b = ranking.best("palavras", g.mode); set("w-best", b ? fmtNum(b.score) : "—");
    document.getElementById("w-share").disabled = !g.done;
    document.getElementById("w-new").hidden = g.mode !== "livre";
    const tip = document.getElementById("w-tip");
    if (g.mode === "dia" && g.done) tip.textContent = "Palavra do dia nº " + g.n + " feita. A próxima chega à meia-noite; até lá, há o jogo livre.";
    else if (g.mode === "dia") tip.textContent = "Palavra do dia nº " + g.n + ". Os acentos e o ç aparecem sozinhos.";
    else tip.textContent = "Jogo livre: palavras ao acaso, sem contar para a sequência. Os acentos e o ç aparecem sozinhos.";
    if (g.done && !g.won) msg("A palavra era " + g.word.toUpperCase() + ".", true);
    else if (g.done) msg(g.mode === "dia" ? "Acertaste em " + g.guesses.length + "." : "Acertaste em " + g.guesses.length + ".");
    else msg("");
  }
  function renderKeys() {
    const g = G(), best = {};
    const rank = { absent: 1, present: 2, correct: 3 };
    g.guesses.forEach(w => score(w, g.word).forEach((r, i) => { const ch = key(w[i]); if (!best[ch] || rank[r] > rank[best[ch]]) best[ch] = r; }));
    document.querySelectorAll("#w-kb .w-key").forEach(k => { const st = best[k.dataset.k]; k.className = "w-key" + (k.classList.contains("wide") ? " wide" : "") + (st ? " " + st : ""); });
  }

  /* ---------- Animações ---------- */
  function reveal(r, done) {
    const row = document.getElementById("w-grid") && document.getElementById("w-grid").children[r];
    if (!row || !motion()) { if (row) renderRow(r); done(); return; }
    const g = G(), word = g.guesses[r], res = score(word, g.word);
    [...row.children].forEach((c, i) => {
      c.textContent = word[i].toUpperCase(); c.className = "w-cell filled";
      later(() => { c.classList.add("flip"); later(() => { c.className = "w-cell flip " + res[i]; sound.tap(); }, 170); }, i * 260);
    });
    later(() => { renderRow(r); done(); }, LEN * 260 + 200);
  }
  function bounce(r) {
    if (!motion()) return;
    const row = document.getElementById("w-grid").children[r];
    [...row.children].forEach((c, i) => later(() => c.classList.add("jump"), i * 90));
    later(() => fx.confetti(), 300);
  }
  function shake(text) {
    toast(text); sound.error(); vibrate(40);
    const row = document.getElementById("w-grid").children[G().guesses.length];
    if (row && motion()) { row.classList.remove("shake"); void row.offsetWidth; row.classList.add("shake"); }
  }

  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (k === "Enter") { submit(); e.preventDefault(); }
    else if (k === "Backspace") { erase(); e.preventDefault(); }
    else if (/^[a-zA-ZçÇáàâãéêíóôõúÁÀÂÃÉÊÍÓÔÕÚ]$/.test(k)) {
      const ch = key(k.toLowerCase()); if (!"kwy".includes(ch)) type(ch); e.preventDefault();
    }
  }
  function tick() { const g = P && G(); if (g && !g.done && g.guesses.length) g.time++; }

  function help() {
    return "<h4>Objetivo</h4><p>Descobrir uma palavra portuguesa de cinco letras em seis tentativas. Cada tentativa tem de ser uma palavra que exista.</p>" +
      "<h4>Cores</h4><ul><li><b>Azul:</b> a letra está na palavra e no sítio certo.</li><li><b>Amarelo:</b> a letra está na palavra, mas noutro sítio.</li><li><b>Cinzento:</b> a letra não está na palavra (ou já apareceu todas as vezes que aparece).</li></ul>" +
      "<h4>Acentos</h4><p>Não precisas de os escrever: \"acao\" conta como \"ação\" e \"c\" serve para \"ç\". As palavras seguem o Acordo Ortográfico de 1990 e não têm k, w nem y.</p>" +
      "<h4>Modos</h4><ul><li><b>Palavra do dia:</b> a mesma palavra para toda a gente, uma por dia, com sequência de dias seguidos.</li><li><b>Jogo livre:</b> palavras ao acaso, quantas quiseres.</li></ul>" +
      "<h4>Controlos</h4><ul><li>Teclado do ecrã ou do computador: letras, <kbd>Enter</kbd> para enviar, <kbd>⌫</kbd> para apagar.</li><li><b>Copiar resultado</b> copia os quadrados coloridos, sem revelar a palavra.</li></ul>" +
      "<h4>Pontuação</h4><ul><li>1000, 800, 600, 400, 250 ou 150 pontos se acertares à 1.ª, 2.ª, 3.ª, 4.ª, 5.ª ou 6.ª tentativa.</li><li>Na palavra do dia, cada dia seguido dá +10 %, até ao dobro.</li><li>Cada modo tem o seu top 10.</li></ul>" +
      "<h4>Créditos</h4><p>Palavras do dicionário pt_PT do Projecto Natura (Universidade do Minho, MPL 1.1), escolhidas com as frequências de legendas em português europeu do OpenSubtitles compiladas por Hermit Dave (CC BY-SA 4.0).</p>";
  }

  Sala.registerGame({
    id: "palavras", name: "Palavras", ready: true, diffs: DIFFS,
    desc: "Descobrir a palavra do dia em seis tentativas.",
    art: '<svg viewBox="0 0 36 36"><rect x="2" y="11" width="9.5" height="14" rx="2" fill="var(--blue)"/><rect x="13.25" y="11" width="9.5" height="14" rx="2" fill="var(--yellow)"/><rect x="24.5" y="11" width="9.5" height="14" rx="2" fill="var(--cover)"/><text x="6.75" y="21.5" font-size="8" font-weight="900" text-anchor="middle" fill="var(--on-accent)" font-family="Roboto,sans-serif">P</text><text x="18" y="21.5" font-size="8" font-weight="900" text-anchor="middle" fill="var(--on-accent)" font-family="Roboto,sans-serif">T</text></svg>',
    lastDiff: () => (P && P.mode) || "dia",
    meta() {
      if (!P || P.games.dia.date !== today()) load();
      const d = P.games.dia, out = [];
      out.push(d.done ? { text: "Palavra do dia feita" } : { text: "Palavra do dia por fazer", cls: "yellow" });
      if (P.streak) out.push({ text: "Sequência " + P.streak, cls: "blue" });
      return out;
    },
    help, mount, unmount, tick, onKey, save
  });
})();
