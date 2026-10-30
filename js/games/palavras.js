/* Sala de Espera — Palavras (descobrir uma palavra de 4 a 7 letras em seis tentativas) */
(function () {
  "use strict";
  const { el, fmtNum, fmtTime, store, sound, vibrate, motion, fx, toast, ranking, ui, finish, stats: ST } = Sala;

  const TRIES = 6, LENS = [4, 5, 6, 7];
  const POINTS = [1000, 800, 600, 400, 250, 150];   /* por número de tentativas, igual em todos os tamanhos */
  const EPOCH = Date.UTC(2026, 9, 26);              /* palavra n.º 1: 26/10/2026 */
  /* A partir desta data, o tamanho da palavra do dia depende do dia da semana (antes, sempre 5). */
  const SIZES_FROM = "2026-10-28";
  const WEEK = [7, 5, 4, 5, 6, 5, 6];               /* domingo, segunda, terça, quarta, quinta, sexta, sábado */

  /* Modos do jogo livre: "livre" é o de 5 letras (o nome antigo fica, para não perder recordes);
     os outros são "livre4", "livre6" e "livre7". */
  const modeOf = L => L === 5 ? "livre" : "livre" + L;
  const isFree = m => m === "livre" || /^livre[4-7]$/.test(m);
  const lenOf = m => m === "livre" ? 5 : +String(m).slice(5);
  const DIFFS = [{ id: "dia", label: "Palavra do dia" }].concat(LENS.map(L => ({ id: modeOf(L), label: L + " letras" })));

  const key = w => w.normalize("NFD").replace(/[̀-ͯ]/g, "");  /* "ação" → "acao" */
  const words = s => (s || "").split(" ").filter(Boolean);
  const SOLS = { 4: words(window.SALA_SOLUCOES_4), 5: words(window.SALA_SOLUCOES), 6: words(window.SALA_SOLUCOES_6), 7: words(window.SALA_SOLUCOES_7) };
  const SOL = SOLS[5];
  const SOLSET = new Set([].concat(SOLS[4], SOLS[5], SOLS[6], SOLS[7]));
  const SHOWN = new Map();   /* forma sem acentos → forma escrita (as soluções têm prioridade) */
  [window.SALA_VALIDAS_4, window.SALA_VALIDAS, window.SALA_VALIDAS_6, window.SALA_VALIDAS_7].map(words).flat().concat([...SOLSET])
    .forEach(w => { const k = key(w); if (!SHOWN.has(k) || SOLSET.has(w)) SHOWN.set(k, w); });

  const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const dayNumber = ds => { const [y, m, d] = ds.split("-").map(Number); return Math.floor((Date.UTC(y, m - 1, d) - EPOCH) / 864e5) + 1; };
  const dateOf = n => new Date(EPOCH + (n - 1) * 864e5).toISOString().slice(0, 10);
  const dailyLen = ds => ds < SIZES_FROM ? 5 : WEEK[new Date(EPOCH + (dayNumber(ds) - 1) * 864e5).getUTCDay()];
  /* Cada tamanho tem a sua fila: a palavra é a n.ª da lista desse tamanho, contando só os dias desse tamanho.
     Nas de 5 letras, os dias antes de SIZES_FROM contam todos, por isso a fila continua sem repetir. */
  function dailyWord(ds) {
    const L = dailyLen(ds), n = dayNumber(ds); let k = 0;
    for (let i = 1; i <= n; i++) if (dailyLen(dateOf(i)) === L) k++;
    const list = SOLS[L];
    return list[((k - 1) % list.length + list.length) % list.length];
  }

  /* ---------- Estado ---------- */
  let P = null, els = null, typing = "", busy = false;
  /* Duelo: a palavra vem no link (só se lê depois de descodificado). */
  function freshDuel(D) { return { mode: "duelo", d: D.d, bid: D.bid, word: SHOWN.get(key(D.b)), guesses: [], done: false, won: false, time: 0 }; }
  let duelD = null;
  function freshGame(mode) {
    if (mode === "dia") { const d = today(); return { mode, date: d, n: dayNumber(d), word: dailyWord(d), guesses: [], done: false, won: false, time: 0 }; }
    const list = SOLS[lenOf(mode)];
    return { mode, word: list[Math.random() * list.length | 0], guesses: [], done: false, won: false, time: 0 };
  }
  const blankStats = () => ({ played: 0, won: 0, dist: [0, 0, 0, 0, 0, 0] });
  function ensure(m) {
    if (!P.games[m]) P.games[m] = freshGame(m);
    if (!P.stats[m]) P.stats[m] = blankStats();
  }
  function load() {
    P = Object.assign({ mode: "dia", freeMode: "livre", games: {}, streak: 0, bestStreak: 0, lastWin: null, stats: { dia: blankStats(), livre: blankStats() } }, store.get("palavras", {}));
    if (!isFree(P.freeMode)) P.freeMode = "livre";
    const g = P.games.dia;
    if (!g || g.date !== today()) P.games.dia = freshGame("dia");
    ensure("livre"); ensure(P.freeMode);
    /* A sequência quebra se falhou um dia inteiro. */
    if (P.lastWin && dayNumber(today()) - dayNumber(P.lastWin) > 1) P.streak = 0;
    store.set("palavras", P);
    /* As Palavras já contavam jogos e vitórias: passam para as estatísticas comuns (uma vez). */
    if (!store.get("statsSeeded:palavras", false)) {
      const d = P.stats.dia, l = P.stats.livre;
      if (d.played || l.played) {
        ST.seed("palavras", "dia", { played: d.played, won: d.won, streak: P.streak, best: P.bestStreak });
        ST.seed("palavras", "livre", { played: l.played, won: l.won });
        ST.seed("palavras", "*", { played: d.played + l.played, won: d.won + l.won, streak: P.streak, best: P.bestStreak });
      }
      store.set("statsSeeded:palavras", true);
    }
  }
  const save = () => { if (P) store.set("palavras", P); };
  const G = () => P.games[P.mode];
  const wl = () => G().word.length;
  const sizeLabel = L => L + " letras";
  const modeLabel = g => g.mode === "dia" ? "Palavra do dia" : "Jogo livre · " + sizeLabel(g.word.length);

  /* ---------- Avaliação (com letras repetidas) ---------- */
  function score(guess, word) {
    const g = key(guess), w = key(word), n = w.length, res = Array(n).fill("absent"), left = {};
    for (let i = 0; i < n; i++) if (g[i] === w[i]) res[i] = "correct"; else left[w[i]] = (left[w[i]] || 0) + 1;
    for (let i = 0; i < n; i++) if (res[i] !== "correct" && left[g[i]]) { res[i] = "present"; left[g[i]]--; }
    return res;
  }

  /* ---------- Ações ---------- */
  function type(ch) {
    if (busy || G().done || typing.length >= wl()) return;
    typing += ch; sound.tap(); renderRow(G().guesses.length, true);
  }
  function erase() { if (busy || G().done || !typing) return; typing = typing.slice(0, -1); sound.tap(); renderRow(G().guesses.length); }
  function submit() {
    const g = G(); if (busy || g.done) return;
    if (typing.length < wl()) { shake("Faltam letras."); return; }
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
    const g = G();
    if (g.mode === "duelo") { g.done = true; g.won = won; g.points = won ? POINTS[g.guesses.length - 1] : 0; return; }
    ensure(g.mode);
    const st = P.stats[g.mode];
    g.done = true; g.won = won; st.played++;
    if (won) {
      st.won++; st.dist[g.guesses.length - 1]++;
      if (g.mode === "dia") {
        P.streak = P.lastWin && dayNumber(g.date) - dayNumber(P.lastWin) === 1 ? P.streak + 1 : 1;
        P.lastWin = g.date; P.bestStreak = Math.max(P.bestStreak, P.streak);
      }
    } else if (g.mode === "dia") P.streak = 0;
    g.points = won ? pointsFor(g) : 0;
    if (!won) ST.record("palavras", g.mode, { won: false, time: g.time });
  }
  function pointsFor(g) {
    const base = POINTS[g.guesses.length - 1];
    const bonus = g.mode === "dia" ? Math.min(1, (P.streak - 1) * .1) : 0;   /* +10 % por dia seguido, até ao dobro */
    return Math.round(base * (1 + bonus));
  }
  function result(won) {
    const g = G();
    renderAll();
    if (g.mode === "duelo") {
      finish({ game: "palavras", diff: g.d || "livre", diffLabel: modeLabel(g), score: g.points, time: g.time, won, duel: duelD,
        breakdown: [["Palavra", g.word.toUpperCase()], ["Tentativas", (won ? g.guesses.length : "X") + " de " + TRIES], ["Tempo", fmtTime(g.time)]] });
      return;
    }
    if (!won) { msg("A palavra era " + g.word.toUpperCase() + ".", true); return; }
    const base = POINTS[g.guesses.length - 1];
    finish({
      game: "palavras", diff: g.mode, diffLabel: modeLabel(g), title: g.mode === "dia" ? "Palavra do dia nº " + g.n : "Acertaste", score: g.points, time: g.time,
      breakdown: [["Tentativas", g.guesses.length + " de " + TRIES], ["Pontos pela tentativa", fmtNum(base)]].concat(g.mode === "dia" ? [["Sequência de " + P.streak + " dia" + (P.streak > 1 ? "s" : ""), "+" + fmtNum(g.points - base)]] : []),
      share: shareInfo(g),
      challenge: isFree(g.mode) ? { d: g.mode, b: g.word } : null,
      newLabel: g.mode === "dia" ? "Jogo livre" : "Outra palavra",
      onNew: () => { if (g.mode === "dia") Sala.go("palavras"); else newFree(); }
    });
  }
  function newFree() { const m = isFree(P.mode) ? P.mode : P.freeMode; P.games[m] = freshGame(m); typing = ""; save(); if (P.mode !== m) setMode(m); else { buildGrid(); renderAll(); } }
  function setMode(m) {
    if (busy) return;
    P.mode = m; if (isFree(m)) { P.freeMode = m; ensure(m); }
    typing = ""; save();
    const s = document.getElementById("w-len"); if (s) s.querySelectorAll("button").forEach((b, k) => b.setAttribute("aria-pressed", String(modeOf(LENS[k]) === m)));
    buildGrid(); renderAll();
  }
  function giveUp() {
    const g = G(); if (g.done || !isFree(g.mode)) return;
    endGame(false); save(); renderAll(); msg("A palavra era " + g.word.toUpperCase() + ".", true);
  }
  /* Partilha sem revelar a palavra: só as cores de cada tentativa. */
  function shareInfo(g) {
    const L = g.word.length, sz = L === 5 ? "" : " (" + sizeLabel(L) + ")";
    const head = (g.mode === "dia" ? "Palavras nº " + g.n + sz : "Palavras · jogo livre (" + sizeLabel(L) + ")") + " · " + (g.won ? g.guesses.length : "X") + "/" + TRIES;
    const rows = g.guesses.map(w => score(w, g.word).map(r => r === "correct" ? 2 : r === "present" ? 1 : 0));
    const text = "Sala de Espera · " + head + "\n" + rows.map(r => r.map(v => ["⬜", "🟨", "🟦"][v]).join("")).join("\n") + "\n" + Sala.SITE;
    const lines = [g.won ? "Acertou à " + g.guesses.length + ".ª tentativa" : "Não acertou desta vez"];
    if (g.mode === "dia" && P.streak) lines.push("Sequência de " + P.streak + (P.streak === 1 ? " dia" : " dias"));
    return { title: "Palavras", sub: (g.mode === "dia" ? "Palavra do dia nº " + g.n : "Jogo livre") + " · " + sizeLabel(L), lost: "X/" + TRIES, lines, grid: rows, text };
  }
  function share() {
    const g = G(); if (!g.done) return;
    const i = shareInfo(g);
    Sala.share({ title: i.title, sub: i.sub, big: (g.won ? g.guesses.length : "X") + "/" + TRIES, unit: "", lines: i.lines, grid: i.grid, text: i.text });
  }

  /* ---------- Ecrã ---------- */
  /* A palavra do dia abre-se pelo desafio do dia (#/palavras/dia); o cartão do menu abre o jogo livre. */
  function mount(c, opts) {
    if (!P) load(); else if (P.games.dia.date !== today()) load();
    duelD = (opts && opts.duel) || null;
    if (duelD && (!P.games.duelo || P.games.duelo.bid !== duelD.bid)) P.games.duelo = freshDuel(duelD);
    P.mode = duelD ? "duelo" : opts && opts.daily ? "dia" : P.freeMode;
    if (isFree(P.mode)) ensure(P.mode);
    save();
    els = c; typing = ""; busy = false;
    c.stats.innerHTML = ui.stat("Sequência", "w-streak", "hl") + ui.stat("Melhor", "w-bstreak") + ui.stat("Vitórias", "w-wins") + ui.stat("Recorde", "w-best");
    c.board.append(el("div", { class: "w-grid", id: "w-grid", "aria-label": "Tentativas" }), el("div", { class: "msg", id: "w-msg", role: "status" }));
    let seg;
    if (duelD) seg = Sala.duel.tag(duelD);
    else if (P.mode === "dia") seg = el("div", { class: "mode-tag" }, ui.ICON.cal + "Palavra do dia nº " + P.games.dia.n + " · " + sizeLabel(P.games.dia.word.length) + " · " + Sala.daily.label(P.games.dia.date));
    else { seg = ui.seg(LENS.map(L => ({ id: modeOf(L), label: sizeLabel(L) })), P.mode, id => setMode(id), "Tamanho da palavra"); seg.id = "w-len"; }
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
    const bShare = el("button", { class: "btn", type: "button", id: "w-share" }, ui.ICON.share + "Partilhar"); bShare.onclick = share;
    const bNew = el("button", { class: "btn", type: "button", id: "w-new" }, ui.ICON.plus + "Outra palavra"); bNew.onclick = () => { const g = G(); if (isFree(g.mode) && !g.done && g.guesses.length) giveUp(); newFree(); };
    const bOther = el("button", { class: "btn", type: "button" }, !isFree(P.mode) ? ui.ICON.plus + "Jogo livre" : ui.ICON.cal + "Palavra do dia");
    bOther.onclick = () => Sala.go(!isFree(P.mode) ? "palavras" : "palavras/dia");
    /* Desafiar com a mesma palavra (também depois de falhar). */
    const bDuel = el("button", { class: "btn", type: "button", id: "w-duel", hidden: true }, '<svg viewBox="0 0 24 24"><path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6M16 16l4 4M19 21l2-2"/></svg>Desafiar');
    bDuel.onclick = () => { const g = G(); if (isFree(g.mode) && g.done) Sala.duel.challenge("palavras", { d: g.mode, b: g.word, s: g.points || 0, t: g.time, p: 0, w: g.won }); };
    if (duelD) actions.append(bOther); else actions.append(bShare, bDuel, bNew, bOther);
    const tip = el("p", { class: "hint", id: "w-tip" });
    c.controls.append(seg, kb, actions, tip);
    buildGrid(); renderAll();
  }
  function unmount() { save(); timers.forEach(clearTimeout); timers = []; els = null; duelD = null; }
  function msg(t, bad) { const m = document.getElementById("w-msg"); if (m) { m.textContent = t; m.className = "msg" + (bad ? " bad" : ""); } }

  function buildGrid() {
    const g = document.getElementById("w-grid"); if (!g) return; g.innerHTML = "";
    const L = wl(); g.dataset.l = L; g.style.setProperty("--wl", L);
    for (let r = 0; r < TRIES; r++) {
      const row = el("div", { class: "w-row" });
      for (let i = 0; i < L; i++) row.appendChild(el("div", { class: "w-cell" }));
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
    const g = G(), st = P.stats[g.mode] || blankStats();
    const set = (id, v) => { const n = document.getElementById(id); if (n) n.textContent = v; };
    set("w-streak", P.streak + (P.streak === 1 ? " dia" : " dias")); set("w-bstreak", P.bestStreak);
    set("w-wins", st.played ? Math.round(st.won / st.played * 100) + " %" : "—");
    const b = ranking.best("palavras", g.mode === "duelo" ? g.d || "livre" : g.mode); set("w-best", b ? fmtNum(b.score) : "—");
    const sh = document.getElementById("w-share"); if (sh) sh.disabled = !g.done;
    const nw = document.getElementById("w-new"); if (nw) nw.hidden = !isFree(g.mode);
    const du = document.getElementById("w-duel"); if (du) du.hidden = !(isFree(g.mode) && g.done);
    const tip = document.getElementById("w-tip"), L = g.word.length;
    if (g.mode === "duelo") tip.textContent = g.done ? "Duelo terminado." : "A mesma palavra de " + L + " letras que " + duelD.n + " teve de descobrir. Os acentos e o ç aparecem sozinhos.";
    else if (g.mode === "dia" && g.done) tip.textContent = "Palavra do dia nº " + g.n + " feita. A próxima chega à meia-noite, com " + sizeLabel(dailyLen(nextDay(g.date))) + "; até lá, há o jogo livre.";
    else if (g.mode === "dia") tip.textContent = "Palavra do dia nº " + g.n + ", de " + L + " letras. Os acentos e o ç aparecem sozinhos.";
    else tip.textContent = "Jogo livre: palavras de " + L + " letras ao acaso, sem contar para a sequência. Os acentos e o ç aparecem sozinhos.";
    if (g.done && !g.won) msg("A palavra era " + g.word.toUpperCase() + ".", true);
    else if (g.done) msg("Acertaste em " + g.guesses.length + ".");
    else msg("");
  }
  const nextDay = ds => dateOf(dayNumber(ds) + 1);
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
    const g = G(), word = g.guesses[r], res = score(word, g.word), step = word.length > 5 ? 210 : 260;
    [...row.children].forEach((c, i) => {
      c.textContent = word[i].toUpperCase(); c.className = "w-cell filled";
      later(() => { c.classList.add("flip"); later(() => { c.className = "w-cell flip " + res[i]; sound.tap(); }, 170); }, i * step);
    });
    later(() => { renderRow(r); done(); }, word.length * step + 200);
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
    return "<h4>Objetivo</h4><p>Descobrir uma palavra portuguesa de 4 a 7 letras em seis tentativas. Cada tentativa tem de ser uma palavra que exista, com o mesmo número de letras.</p>" +
      "<h4>Cores</h4><ul><li><b>Azul:</b> a letra está na palavra e no sítio certo.</li><li><b>Amarelo:</b> a letra está na palavra, mas noutro sítio.</li><li><b>Cinzento:</b> a letra não está na palavra (ou já apareceu todas as vezes que aparece).</li></ul>" +
      "<h4>Acentos</h4><p>Não precisas de os escrever: \"acao\" conta como \"ação\" e \"c\" serve para \"ç\". As palavras seguem o Acordo Ortográfico de 1990 e não têm k, w nem y.</p>" +
      "<h4>Modos</h4><ul><li><b>Palavra do dia:</b> a mesma palavra para toda a gente, uma por dia, com sequência de dias seguidos. O tamanho muda com o dia da semana: 4 letras à terça, 5 à segunda, quarta e sexta, 6 à quinta e ao sábado e 7 ao domingo. Está no desafio do dia, no topo do menu.</li><li><b>Jogo livre:</b> palavras ao acaso, quantas quiseres, com o tamanho que escolheres (4 a 7 letras). É o que abre o cartão Palavras.</li></ul>" +
      "<h4>Duelo</h4><p>No fim de um jogo livre, <b>Desafiar</b> manda um link com a mesma palavra (escondida) e o teu resultado. Ganha quem acertar em menos tentativas; em empate, quem foi mais rápido.</p>" +
      "<h4>Controlos</h4><ul><li>Teclado do ecrã ou do computador: letras, <kbd>Enter</kbd> para enviar, <kbd>⌫</kbd> para apagar.</li><li><b>Partilhar</b> envia uma imagem e os quadrados coloridos, sem revelar a palavra.</li></ul>" +
      "<h4>Pontuação</h4><ul><li>1000, 800, 600, 400, 250 ou 150 pontos se acertares à 1.ª, 2.ª, 3.ª, 4.ª, 5.ª ou 6.ª tentativa, em qualquer tamanho.</li><li>Na palavra do dia, cada dia seguido dá +10 %, até ao dobro.</li><li>A palavra do dia e cada tamanho do jogo livre têm o seu top 10.</li></ul>" +
      "<h4>Créditos</h4><p>Palavras do dicionário pt_PT do Projecto Natura (Universidade do Minho, MPL 1.1), escolhidas com as frequências de legendas em português europeu do OpenSubtitles compiladas por Hermit Dave (CC BY-SA 4.0).</p>";
  }

  /* Códigos curtos dos tamanhos novos: número da palavra na lista desse tamanho (10 bits), tentativas
     (7 = falhou) e tempo. O de 5 letras continua a ser o PAL, com o formato de sempre. */
  const sizeCode = L => ({
    pre: "PA" + L, bits: [10, 3, 14],
    pack(x) {
      const i = SOLS[L].indexOf(x.b), k = x.w ? POINTS.indexOf(x.s) + 1 : 7;
      if (x.d !== modeOf(L) || i < 0 || !k) return null;
      return [i, k, Math.min(16383, Math.round(x.t) || 0)];
    },
    unpack: v => SOLS[L][v[0]] && v[1] ? { d: modeOf(L), b: SOLS[L][v[0]], w: v[1] < 7 ? 1 : 0, s: v[1] < 7 ? POINTS[v[1] - 1] : 0, p: 0, t: v[2] } : null,
    ctx: x => key(x.b)
  });

  Sala.registerGame({
    id: "palavras", name: "Palavras", ready: true, diffs: DIFFS,
    desc: "Descobrir palavras de 4 a 7 letras em seis tentativas.",
    art: '<svg viewBox="0 0 36 36"><rect x="2" y="11" width="9.5" height="14" rx="2" fill="var(--blue)"/><rect x="13.25" y="11" width="9.5" height="14" rx="2" fill="var(--yellow)"/><rect x="24.5" y="11" width="9.5" height="14" rx="2" fill="var(--cover)"/><text x="6.75" y="21.5" font-size="8" font-weight="900" text-anchor="middle" fill="var(--on-blue)" font-family="Roboto,sans-serif">P</text><text x="18" y="21.5" font-size="8" font-weight="900" text-anchor="middle" fill="var(--on-accent)" font-family="Roboto,sans-serif">T</text></svg>',
    lastDiff: () => (P && P.mode !== "duelo" && P.mode) || "livre",
    duel: true, duelTime: true,
    /* Código curto: número da palavra na lista de soluções, tentativas (7 = falhou) e tempo.
       A própria palavra entra na verificação: se a lista mudar, o código antigo é recusado. */
    code: {
      pre: "PAL", bits: [11, 3, 14],
      pack(x) {
        const i = SOL.indexOf(x.b), k = x.w ? POINTS.indexOf(x.s) + 1 : 7;
        if (x.d !== "livre" || i < 0 || !k) return null;
        return [i, k, Math.min(16383, Math.round(x.t) || 0)];
      },
      unpack: v => SOL[v[0]] && v[1] ? { d: "livre", b: SOL[v[0]], w: v[1] < 7 ? 1 : 0, s: v[1] < 7 ? POINTS[v[1] - 1] : 0, p: 0, t: v[2] } : null,
      ctx: x => key(x.b)
    },
    codes: [4, 6, 7].map(sizeCode),
    duelOk: D => isFree(D.d) && typeof D.b === "string" && D.b.length === lenOf(D.d) && SHOWN.has(key(D.b)),
    duelLabel: d => "Jogo livre · " + sizeLabel(isFree(d) ? lenOf(d) : 5),
    duelText: r => r.w ? (POINTS.indexOf(r.s) + 1 || "?") + "/" + TRIES + " · " + fmtTime(r.t) : "X/" + TRIES,
    daily: true, dailyLost: "Falhou", dailyTitle: "Palavra do dia",
    dailyPlaying() { if (!P || P.games.dia.date !== today()) load(); const d = P.games.dia; return !d.done && d.guesses.length > 0; },
    /* O resultado do dia vem do próprio jogo (as Palavras já tinham a palavra do dia antes do desafio). */
    dailyResult() {
      if (!P || P.games.dia.date !== today()) load();
      const d = P.games.dia; if (!d.done) return null;
      return { date: d.date, won: d.won, score: d.points || 0, time: d.time, extra: { tries: d.guesses.length, len: d.word.length } };
    },
    dailyText: r => (r.won ? r.extra.tries : "X") + "/" + TRIES + (r.won ? " · " + fmtNum(r.score) + " pts" : ""),
    meta() {
      if (!P || P.games.dia.date !== today()) load();
      const out = [];
      if (LENS.some(L => { const g = P.games[modeOf(L)]; return g && !g.done && g.guesses.length; })) out.push({ text: "Jogo livre a meio", cls: "blue" });
      const b = ranking.best("palavras", P.freeMode); if (b) out.push({ text: "Recorde " + fmtNum(b.score) + " pts" });
      return out;
    },
    help, mount, unmount, tick, onKey, save
  });
  /* Para os testes: tamanho e palavra do dia de uma data. */
  Sala.palavrasDia = ds => ({ len: dailyLen(ds), word: dailyWord(ds), n: dayNumber(ds) });
})();
