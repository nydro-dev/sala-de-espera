/* Sala de Espera — menu, navegação entre ecrãs, relógio comum e arranque. */
(function () {
  "use strict";
  const { $, el, esc, store, settings, ranking, modal, sound, games, gameById } = Sala;

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

  /* ---------- Menu ---------- */
  function drawMenu() {
    const box = $("m-cards"); box.innerHTML = "";
    games.filter(g => g.ready).forEach(g => {
      const b = el("button", { class: "card", type: "button" });
      const chips = (g.meta ? g.meta() : []).map(c => '<span class="chip ' + (c.cls || "") + '">' + esc(c.text) + "</span>").join("");
      b.innerHTML = '<span class="art">' + g.art + "</span><div><h2>" + esc(g.name) + "</h2><p>" + esc(g.desc) + '</p></div><div class="meta">' + (chips || '<span class="chip">Jogar</span>') + "</div>";
      b.onclick = () => { sound.tap(); go(g.id); };
      box.appendChild(b);
    });
    SOON.forEach(g => {
      const b = el("button", { class: "card", type: "button", disabled: true, "aria-label": g.name + ", em breve" });
      b.innerHTML = '<span class="art">' + g.art + "</span><div><h2>" + esc(g.name) + "</h2><p>" + esc(g.desc) + '</p></div><div class="meta"><span class="chip yellow">Em breve</span></div>';
      box.appendChild(b);
    });
  }

  /* ---------- Navegação (#/sudoku, #/minas) ---------- */
  let active = null, fromMenu = false;
  function go(id) { fromMenu = !!id && !active; location.hash = id ? "#/" + id : ""; }
  function route() {
    const id = (location.hash.match(/^#\/(\w+)/) || [])[1];
    const g = id && gameById(id);
    if (modal.isOpen) modal.close(true);
    if (active) { active.unmount(); active = null; }
    const body = { stats: $("g-stats"), board: $("g-board"), controls: $("g-controls") };
    Object.values(body).forEach(n => n.innerHTML = "");
    if (g && g.ready) {
      $("v-menu").hidden = true; $("v-game").hidden = false;
      $("g-title").textContent = g.name; document.title = g.name + " · Sala de Espera";
      active = g; g.mount(body);
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
  $("g-rank").onclick = () => active && Sala.showRanking(active.id, active.lastDiff && active.lastDiff());
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

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
