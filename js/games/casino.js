/* Sala de Espera — banca comum do casino (Blackjack e Roleta).
   Fichas virtuais, sem valor nem compras. Cada banca começa com 1000 fichas;
   conta para o ranking o maior saldo que atingiu. */
(function () {
  "use strict";
  const { el, fmtTime, fmtNum, store, modal, ranking, ui, finish, toast } = Sala;

  const START = 1000, MIN_BET = 10;
  const DEFAULT = () => ({ balance: START, peak: START, time: 0, rounds: 0, started: new Date().toISOString() });
  let B = Object.assign(DEFAULT(), store.get("casino", {}));
  const save = () => store.set("casino", B);

  /* Número aleatório imparcial (crypto quando existe). */
  function rand(n) {
    try {
      const a = new Uint32Array(1), lim = Math.floor(0x100000000 / n) * n;
      do crypto.getRandomValues(a); while (a[0] >= lim);
      return a[0] % n;
    } catch (e) { return Math.floor(Math.random() * n); }
  }

  const listeners = new Set();
  function changed() { save(); listeners.forEach(f => f()); }

  const casino = {
    MIN_BET, START, rand,
    get balance() { return B.balance; },
    get peak() { return B.peak; },
    get rounds() { return B.rounds; },
    onChange(f) { listeners.add(f); return () => listeners.delete(f); },
    /* Tira fichas da banca (aposta). Devolve false se não houver saldo. */
    take(n) { if (n > B.balance) return false; B.balance -= n; changed(); return true; },
    /* Devolve fichas à banca (prémios e apostas devolvidas). */
    give(n) { B.balance += n; if (B.balance > B.peak) B.peak = B.balance; changed(); },
    round() { B.rounds++; changed(); },
    tick() { B.time++; if (B.time % 10 === 0) save(); },
    save,
    /* Depois de cada ronda: se não dá para a aposta mínima, a banca fecha. */
    checkBust(inPlay) {
      if (!inPlay && B.balance < MIN_BET) { close("bust"); return true; }
      return false;
    },
    askClose() {
      if (!B.rounds) { toast("Ainda não jogaste com esta banca."); return; }
      modal.open({
        title: "Fechar a banca?",
        body: "<p>O maior saldo desta banca (" + fmtNum(B.peak) + " fichas) entra no ranking e recomeças com " + fmtNum(START) + " fichas.</p>",
        actions: [{ label: "Continuar a jogar" }, { label: "Fechar a banca", primary: true, onClick: () => { setTimeout(() => close("closed"), 0); } }]
      });
    },
    statsHtml(prefix) {
      return ui.stat("Saldo", prefix + "-bal", "hl") + ui.stat("Em jogo", prefix + "-bet") + ui.stat("Pico da banca", prefix + "-peak") + ui.stat("Recorde", prefix + "-best");
    },
    drawStats(prefix, inPlay) {
      const set = (id, t) => { const n = document.getElementById(prefix + "-" + id); if (n) n.textContent = t; };
      set("bal", fmtNum(B.balance)); set("bet", fmtNum(inPlay || 0)); set("peak", fmtNum(B.peak));
      const best = ranking.best("casino", "banca"); set("best", best ? fmtNum(best.score) : "—");
    },
    /* Fichas para escolher a aposta. */
    chipRow(values, current, onPick) {
      const row = el("div", { class: "chips", role: "group", "aria-label": "Valor da ficha" });
      values.forEach(v => {
        const b = el("button", { type: "button", class: "chip-btn c" + v, "aria-pressed": String(v === current), "aria-label": v + " fichas" }, "<span>" + (v >= 1000 ? v / 1000 + "k" : v) + "</span>");
        b.onclick = () => { row.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); onPick(v); };
        row.appendChild(b);
      });
      return row;
    }
  };

  function close(why) {
    const peak = B.peak, rounds = B.rounds, time = B.time;
    B = DEFAULT(); save();
    finish({
      game: "casino", diff: "banca", diffLabel: "Casino", unit: "fichas",
      title: why === "bust" ? "Banca falida" : "Banca fechada",
      score: peak, time,
      breakdown: [["Rondas jogadas", fmtNum(rounds)], ["Tempo de jogo", fmtTime(time)], ["Nova banca", fmtNum(START) + " fichas"]],
      newLabel: "Nova banca",
      onNew: () => {}
    });
    listeners.forEach(f => f());
  }

  Sala.casino = casino;

  /* Ranking comum aos dois jogos (não aparece no menu). */
  Sala.registerGame({
    id: "casino", name: "Casino", ready: false, rankable: true, statsKind: "score",
    diffs: [{ id: "banca", label: "Maior saldo" }],
    unitLabel: "Fichas",
    emptyText: "Ainda não há bancas fechadas.<br>Uma banca entra aqui quando falir ou quando a fechares.",
    lastDiff: () => "banca"
  });
})();
