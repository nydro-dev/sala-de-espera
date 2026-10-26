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
  const SOON = [
    { name: "2048", desc: "Juntar peças iguais até chegar ao 2048.", art: '<svg viewBox="0 0 36 36"><rect x="2" y="2" width="15" height="15" rx="3" fill="var(--blue)"/><rect x="19" y="2" width="15" height="15" rx="3" fill="var(--yellow)"/><rect x="2" y="19" width="15" height="15" rx="3" fill="var(--cover)"/><rect x="19" y="19" width="15" height="15" rx="3" fill="var(--ink)"/></svg>' },
    { name: "Palavras", desc: "Descobrir a palavra do dia em seis tentativas.", art: '<svg viewBox="0 0 36 36"><rect x="2" y="11" width="9.5" height="14" rx="2" fill="var(--blue)"/><rect x="13.25" y="11" width="9.5" height="14" rx="2" fill="var(--yellow)"/><rect x="24.5" y="11" width="9.5" height="14" rx="2" fill="var(--cover)"/></svg>' },
    { name: "Solitário", desc: "O clássico das cartas, com sete colunas.", art: '<svg viewBox="0 0 36 36"><rect x="5" y="4" width="18" height="25" rx="3" fill="var(--cover)" transform="rotate(-10 14 16)"/><rect x="13" y="7" width="18" height="25" rx="3" fill="var(--surface)" stroke="var(--ink)" stroke-width="1.5"/><path d="M22 14c-2.5 3-4 4.4-4 6a2 2 0 0 0 4 .3 2 2 0 0 0 4-.3c0-1.6-1.5-3-4-6z" fill="var(--ink)"/></svg>' },
    { name: "Cobra", desc: "Comer, crescer e não bater em nada.", art: '<svg viewBox="0 0 36 36"><path d="M6 28h12V18h12V8" fill="none" stroke="var(--blue)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="30" cy="8" r="3.5" fill="var(--ink)"/><circle cx="9" cy="10" r="3" fill="var(--yellow)"/></svg>' },
    { name: "Blackjack", desc: "Chegar o mais perto possível de 21 sem passar, contra a banca.", art: '<svg viewBox="0 0 36 36"><rect x="4" y="6" width="17" height="24" rx="3" fill="var(--surface)" stroke="var(--ink)" stroke-width="1.5" transform="rotate(-8 12 18)"/><rect x="15" y="6" width="17" height="24" rx="3" fill="var(--surface)" stroke="var(--ink)" stroke-width="1.5"/><text x="23.5" y="22.5" font-size="11" font-weight="900" text-anchor="middle" fill="var(--blue-ink)" font-family="Roboto,sans-serif">21</text></svg>' },
    { name: "Roleta", desc: "Roleta europeia de um só zero. Fichas virtuais, sem dinheiro.", art: '<svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" fill="var(--ink)"/><circle cx="18" cy="18" r="15" fill="none" stroke="var(--yellow)" stroke-width="4" stroke-dasharray="4.71 4.71"/><circle cx="18" cy="18" r="7" fill="var(--blue)"/><circle cx="18" cy="7.5" r="2" fill="var(--surface)"/></svg>' }
  ];

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
