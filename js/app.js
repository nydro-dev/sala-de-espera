/* Sala de Espera — menu, navegação entre ecrãs, relógio comum e arranque. */
(function () {
  "use strict";
  const { $, el, esc, fmtNum, fmtTime, store, settings, ranking, modal, sound, toast, games, gameById, daily, ui } = Sala;

  /* ---------- Migração da versão anterior (ficheiro único) ---------- */
  if (!store.get("migrated", false)) {
    try {
      const old = JSON.parse(store.raw("minasBest") || "null");
      const BASE = { easy: 500, medium: 2000, hard: 5000 }, PAR = { easy: 60, medium: 240, hard: 600 };
      if (old) for (const d in old) {
        const t = Math.max(1, +old[d] || 0); if (!BASE[d] || !t) continue;
        const mult = t <= PAR[d] ? 1 + (PAR[d] - t) / PAR[d] : Math.max(0.25, PAR[d] / t);
        ranking.add("minas", d, { name: settings.name || "Eu", score: Math.round(BASE[d] * mult), time: t, extra: { migrado: true } });
      }
    } catch (e) {}
    store.set("migrated", true);
  }

  /* ---------- Jogos que vêm a seguir ---------- */
  const SOON = []; /* jogos por fazer: { name, desc, art } */

  /* ---------- Desafio do dia (topo do menu) ---------- */
  const SHORT = { palavras: "🔤", sudoku: "🔢", minas: "💣", soli: "🃏" };
  function dailyState(g) {
    const r = g.dailyResult ? g.dailyResult() : daily.result(g.id);
    if (r) return { done: true, r, text: g.dailyText && r.won ? g.dailyText(r) : r.won ? fmtNum(r.score) + " pts" : (g.dailyLost || "Sem vitória") + (r.score ? " · " + fmtNum(r.score) : ""), cls: r.won ? "good" : "" };
    if (g.dailyPlaying && g.dailyPlaying()) return { done: false, text: "A meio", cls: "blue" };
    return { done: false, text: "Por jogar", cls: "yellow" };
  }
  function drawDaily() {
    const box = $("m-daily"); box.innerHTML = "";
    const list = daily.GAMES.map(gameById).filter(g => g && g.ready && g.daily);
    if (!list.length) { box.hidden = true; return; }
    box.hidden = false;
    const states = list.map(dailyState), done = states.filter(s => s.done).length;
    const head = el("div", { class: "daily-head" }, '<span class="ico" aria-hidden="true">' + ui.ICON.cal + '</span><div><h2>Desafio do dia</h2><p>' + esc(daily.long().replace(/^./, c => c.toUpperCase())) + ". " + (done === list.length ? "Feito. Volta amanhã." : "Igual para todos; só a primeira tentativa conta.") + "</p></div>");
    if (done) {
      const b = el("button", { class: "btn", type: "button", "aria-label": "Partilhar o desafio do dia" }, ui.ICON.share + "<span>Partilhar</span>");
      b.onclick = () => shareDay(list, states);
      head.appendChild(b);
    }
    const row = el("div", { class: "daily-games" });
    list.forEach((g, k) => {
      const s = states[k];
      const b = el("button", { class: "dg" + (s.done ? " done" : ""), type: "button", "aria-label": g.name + " do dia, " + s.text });
      b.innerHTML = '<span class="art">' + g.art + '</span><span class="dg-txt"><b>' + esc(g.name) + '</b><span class="chip ' + s.cls + '">' + esc(s.text) + "</span></span>";
      b.onclick = () => { sound.tap(); go(g.id + "/dia"); };
      row.appendChild(b);
    });
    box.append(head, row);
  }
  function shareDay(list, states) {
    const ds = daily.today();
    let total = 0;
    const lines = list.map((g, k) => {
      const s = states[k]; if (s.done) total += s.r.score || 0;
      return g.name + ": " + (s.done ? (g.dailyText ? g.dailyText(s.r) : s.r.won ? fmtNum(s.r.score) + " pts em " + fmtTime(s.r.time) : (g.dailyLost || "sem vitória") + (s.r.score ? " · " + fmtNum(s.r.score) + " pts" : "")) : "por jogar");
    });
    const text = "Sala de Espera · Desafio do dia " + daily.label(ds) + "\n" + list.map((g, k) => SHORT[g.id] + " " + lines[k]).join("\n") + "\nTotal: " + fmtNum(total) + " pts\n" + Sala.SITE;
    Sala.share({ title: "Desafio do dia", sub: daily.label(ds), big: fmtNum(total), unit: "pts", lines, text });
  }

  /* ---------- Menu ----------
     Secções com cartões quadrados (2 colunas no telemóvel). Jogos que não estejam
     em nenhuma secção vão para "Outros", para nunca desaparecerem do menu. */
  const SECTIONS = [
    { id: "puz", label: "Puzzles", ids: ["sudoku", "minas", "palavras", "soli"] },
    { id: "arc", label: "Arcada", ids: ["dobra", "cobra"] },
    { id: "cas", label: "Casino", ids: ["blackjack", "roleta"] }
  ];
  function tile(g, sec, soon) {
    const art = (Sala.menuArt && Sala.menuArt[g.id]) ? Sala.menuArt[g.id]() : '<span class="mn-small">' + g.art + "</span>";
    const meta = soon ? [{ text: "Em breve", cls: "yellow" }] : (g.meta ? g.meta() : []);
    const chip = meta[0] ? '<span class="chip mn-chip ' + (meta[0].cls || "") + '">' + esc(meta[0].text) + "</span>" : "";
    const b = el("button", { class: "mn-tile mn-" + sec, type: "button", "aria-label": g.name + (meta.length ? ", " + meta.map(m => m.text).join(", ") : "") });
    if (soon) b.disabled = true;
    b.innerHTML = '<span class="mn-art">' + art + "</span>" + chip + '<span class="mn-txt"><b>' + esc(g.name) + '</b><span class="mn-desc">' + esc(g.desc) + "</span></span>";
    if (!soon) b.onclick = () => { sound.tap(); go(g.id); };
    return b;
  }
  function drawMenu() {
    drawDaily();
    const box = $("m-cards"); box.innerHTML = "";
    const ready = games.filter(g => g.ready), used = new Set();
    const secs = SECTIONS.map(s => ({ ...s, list: s.ids.map(gameById).filter(g => g && g.ready) }));
    secs.forEach(s => s.list.forEach(g => used.add(g.id)));
    const rest = ready.filter(g => !used.has(g.id));
    if (rest.length || SOON.length) secs.push({ id: "out", label: "Outros", list: rest, soon: SOON });
    secs.forEach(s => {
      if (!s.list.length && !(s.soon && s.soon.length)) return;
      const sec = el("section", { class: "mn-shelf mn-shelf-" + s.id, "aria-labelledby": "mn-h-" + s.id });
      sec.appendChild(el("h2", { class: "mn-shelf-title", id: "mn-h-" + s.id }, esc(s.label)));
      const grid = el("div", { class: "mn-tiles" });
      s.list.forEach(g => grid.appendChild(tile(g, s.id)));
      (s.soon || []).forEach(g => grid.appendChild(tile(g, s.id, true)));
      sec.appendChild(grid); box.appendChild(sec);
    });
  }

  /* ---------- Navegação (#/sudoku, #/minas) ---------- */
  let active = null, fromMenu = false;
  function go(id) { fromMenu = !!id && !active; location.hash = id ? "#/" + id : ""; }
  Sala.go = go;
  function route() {
    /* O jogo que se chamava 2048 passou a chamar-se Dobra: os links antigos continuam a funcionar. */
    if (/^#\/g2048(\/|$)/.test(location.hash)) { history.replaceState(null, "", "#/dobra"); }
    /* Duelo: #/duelo/<jogo>/<código> */
    const dm = location.hash.match(/^#\/duelo\/(\w+)\/([A-Za-z0-9_-]+)/);
    let duelData = null;
    if (modal.isOpen) modal.close(true);
    if (dm) {
      duelData = Sala.openDuel(dm[1], dm[2]);
      /* Sem jogo para começar (link inválido ou duelo já jogado): fica o menu por baixo da janela. */
      if (!duelData) { history.replaceState(null, "", location.pathname + location.search); fromMenu = false; }
    }
    const mm = duelData ? [null, duelData.g] : location.hash.match(/^#\/(\w+)(?:\/(\w+))?/) || [];
    const id = mm[1], g = id && gameById(id);
    const isDaily = mm[2] === "dia" && g && g.daily;
    if (active) { active.unmount(); active = null; }
    const body = { stats: $("g-stats"), board: $("g-board"), controls: $("g-controls") };
    Object.values(body).forEach(n => n.innerHTML = "");
    if (g && g.ready) {
      $("v-menu").hidden = true; $("v-game").hidden = false;
      const t = duelData ? "Duelo · " + g.name : isDaily ? (g.dailyTitle || g.name + " do dia") : g.name;
      $("g-title").textContent = t; document.title = t + " · Sala de Espera";
      active = g; g.mount(body, { daily: !!isDaily, duel: duelData });
      if (!store.get("seenHelp:" + g.id, false)) { store.set("seenHelp:" + g.id, true); setTimeout(() => Sala.showHelp(g.id), 250); }
    } else {
      $("v-game").hidden = true; $("v-menu").hidden = false; document.title = "Sala de Espera";
      drawMenu();
    }
    scrollTo(0, 0);
  }
  addEventListener("hashchange", route);

  /* Voltar: se viemos do menu, recua no histórico (o botão de recuar do Android fica coerente). */
  $("g-back").onclick = () => { sound.tap(); if (fromMenu) { fromMenu = false; history.back(); } else go(""); };
  $("g-help").onclick = () => active && Sala.showHelp(active.id);
  $("g-rank").onclick = () => active && (/^#\/duelo\//.test(location.hash) ? Sala.showRanking(active.id, null, null, "rivals") : Sala.showRanking(active.id, /\/dia$/.test(location.hash) ? "dia" : active.lastDiff && active.lastDiff()));
  $("m-rank").onclick = () => Sala.showRanking();
  $("m-settings").onclick = () => Sala.showSettings();

  /* ---------- Teclado: vai para o jogo ativo ---------- */
  document.addEventListener("keydown", e => {
    if (modal.isOpen || !active || !active.onKey) return;
    if (e.target.closest && e.target.closest("input,textarea,select")) return;
    if (e.key === "Escape") { go(""); return; }
    active.onKey(e);
  });

  /* ---------- Relógio comum: só conta com o jogo à vista e sem janelas abertas ---------- */
  setInterval(() => { if (active && active.tick && !document.hidden && !modal.isOpen) active.tick(); }, 1000);
  /* Ao sair da app (trocar de separador, bloquear o telemóvel), guarda logo o jogo. */
  document.addEventListener("visibilitychange", () => { if (document.hidden && active && active.save) active.save(); });
  addEventListener("pagehide", () => { if (active && active.save) active.save(); });

  route();

  /* ---------- Atualizações ----------
     O service worker novo instala-se sozinho; quando assume o controlo, aparece uma barra
     para recarregar (nunca recarrega a meio de um jogo sem o jogador pedir). */
  const SW = "serviceWorker" in navigator && location.protocol.startsWith("http");
  let reg = null, bar = null;
  function showUpdateBar() {
    if (bar) return;
    bar = el("div", { class: "update-bar", role: "status" }, "<span>Há uma versão nova da Sala de Espera.</span>");
    const b = el("button", { class: "btn primary", type: "button" }, "Atualizar");
    b.onclick = () => { if (active && active.save) active.save(); location.reload(); };
    const x = el("button", { class: "icon-btn", type: "button", "aria-label": "Depois" }, '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>');
    x.onclick = () => { bar.remove(); bar = null; };
    bar.append(b, x); document.body.appendChild(bar);
  }
  /* Versão em uso, perguntada ao service worker que controla a página. */
  function version() {
    return new Promise(res => {
      const c = SW && navigator.serviceWorker.controller; if (!c) return res(null);
      const ch = new MessageChannel(); const t = setTimeout(() => res(null), 1500);
      ch.port1.onmessage = e => { clearTimeout(t); res(e.data); };
      c.postMessage("version", [ch.port2]);
    });
  }
  /* Procura uma versão nova. Devolve "new" (a instalar ou pronta), "latest", "offline" ou "unsupported". */
  async function check() {
    if (!SW || !reg) return "unsupported";
    if (!navigator.onLine) return "offline";
    try { await reg.update(); } catch (e) { return "offline"; }
    const w = reg.installing || reg.waiting;
    if (!w) return bar ? "new" : "latest";
    await new Promise(res => { if (w.state === "activated") return res(); w.addEventListener("statechange", () => { if (w.state === "activated" || w.state === "redundant") res(); }); setTimeout(res, 15000); });
    return "new";
  }
  Sala.updates = { check, version, supported: SW };
  if (SW) {
    let had = !!navigator.serviceWorker.controller; /* na primeira instalação não há nada a atualizar */
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (had) showUpdateBar(); had = true; });
    addEventListener("load", () => navigator.serviceWorker.register("sw.js").then(r => { reg = r; }).catch(() => {}));
    /* Sempre que se volta à app espreita se há versão nova (no máximo uma vez por minuto):
       no iPhone, a app instalada costuma voltar do fundo sem recarregar, e sem isto nunca via as novidades. */
    let lastCheck = Date.now();
    const peek = () => { if (reg && Date.now() - lastCheck > 60 * 1000) { lastCheck = Date.now(); reg.update().catch(() => {}); } };
    document.addEventListener("visibilitychange", () => { if (!document.hidden) peek(); });
    addEventListener("pageshow", peek); addEventListener("focus", peek);
    setInterval(() => { if (reg && !document.hidden) { lastCheck = Date.now(); reg.update().catch(() => {}); } }, 60 * 60 * 1000);
  }
})();
