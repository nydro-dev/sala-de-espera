/* Sala de Espera — Blackjack (fichas virtuais da banca comum) */
(function () {
  "use strict";
  const { el, fmtNum, store, sound, vibrate, motion, fx, toast, ui } = Sala;
  const C = Sala.casino;

  const DECKS = 6, RESHUFFLE_AT = 78; /* baralha de novo quando restam ~25 % das cartas */
  const CHIPS = [10, 25, 100, 500];
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const SUITS = ["♠", "♥", "♦", "♣"];
  const rank = c => c % 13, suit = c => (c / 13) | 0;
  const cval = c => { const r = rank(c); return r === 0 ? 11 : Math.min(10, r + 1); };
  function value(cards) {
    let t = 0, aces = 0;
    for (const c of cards) { t += cval(c); if (rank(c) === 0) aces++; }
    while (t > 21 && aces) { t -= 10; aces--; }
    return { total: t, soft: aces > 0 && t <= 21 };
  }
  const isBJ = h => h.cards.length === 2 && !h.fromSplit && value(h.cards).total === 21;

  /* ---------- Estado (guardado, para não perder a mão a meio) ---------- */
  let S = null, els = null, chip = 25, seen = {}, offChange = null, timers = [];
  function fresh() { return { phase: "bet", bet: 0, lastBet: 0, shoe: [], hands: [], dealer: [], active: 0, reveal: false, note: "" }; }
  function load() { S = Object.assign(fresh(), store.get("bj", {})); if (!Array.isArray(S.shoe)) S.shoe = []; }
  const save = () => { if (S) store.set("bj", S); };

  function newShoe() {
    const s = [];
    for (let d = 0; d < DECKS; d++) for (let c = 0; c < 52; c++) s.push(c);
    for (let i = s.length - 1; i > 0; i--) { const j = C.rand(i + 1); [s[i], s[j]] = [s[j], s[i]]; }
    return s;
  }
  const draw = () => S.shoe.pop();

  /* ---------- Ronda ---------- */
  function addChip(v) {
    if (S.phase !== "bet") return;
    if (S.bet + v > C.balance) { toast("Não tens fichas para isso. Saldo: " + fmtNum(C.balance) + "."); sound.error(); return; }
    S.bet += v; sound.tap(); vibrate(8); save(); render();
  }
  function clearBet() { if (S.phase !== "bet") return; S.bet = 0; sound.tap(); save(); render(); }
  function deal() {
    if (S.phase !== "bet") return;
    if (!S.bet && S.lastBet && S.lastBet <= C.balance) S.bet = S.lastBet;
    if (S.bet < C.MIN_BET) { toast("A aposta mínima é de " + C.MIN_BET + " fichas."); return; }
    if (!C.take(S.bet)) { toast("Saldo insuficiente."); return; }
    if (S.shoe.length < RESHUFFLE_AT) { S.shoe = newShoe(); toast("Baralhos novos no sapato."); }
    C.round();
    S.lastBet = S.bet;
    S.hands = [{ cards: [draw()], bet: S.bet, done: false }];
    S.dealer = [draw()];
    S.hands[0].cards.push(draw()); S.dealer.push(draw());
    S.bet = 0; S.active = 0; S.reveal = false; S.note = ""; S.phase = "play"; seen = {};
    sound.place();
    const up = cval(S.dealer[0]);
    if ((up === 11 || up === 10) && value(S.dealer).total === 21) { finishRound(); return; } /* a banca espreita */
    if (isBJ(S.hands[0])) { finishRound(); return; }
    save(); render();
  }
  const hand = () => S.hands[S.active];
  function canDouble() { const h = hand(); return S.phase === "play" && h && h.cards.length === 2 && !h.doubled && C.balance >= h.bet; }
  function canSplit() { const h = hand(); return S.phase === "play" && S.hands.length === 1 && h.cards.length === 2 && cval(h.cards[0]) === cval(h.cards[1]) && C.balance >= h.bet; }
  function hit() {
    if (S.phase !== "play") return;
    const h = hand(); h.cards.push(draw()); sound.place();
    const v = value(h.cards).total;
    if (v > 21) { sound.error(); vibrate(40); h.done = true; next(); }
    else if (v === 21) { h.done = true; next(); }
    else { save(); render(); }
  }
  function stand() { if (S.phase !== "play") return; hand().done = true; sound.tap(); next(); }
  function double() {
    if (!canDouble()) return;
    const h = hand(); C.take(h.bet); h.bet *= 2; h.doubled = true;
    h.cards.push(draw()); sound.place(); h.done = true;
    if (value(h.cards).total > 21) { sound.error(); vibrate(40); }
    next();
  }
  function split() {
    if (!canSplit()) return;
    const h = hand(); C.take(h.bet);
    const aces = rank(h.cards[0]) === 0;
    const a = { cards: [h.cards[0], draw()], bet: h.bet, done: aces, fromSplit: true };
    const b = { cards: [h.cards[1], draw()], bet: h.bet, done: aces, fromSplit: true };
    S.hands = [a, b]; S.active = 0; seen = {}; sound.place();
    if (aces) { next(); return; }
    if (value(a.cards).total === 21) { a.done = true; next(); return; }
    save(); render();
  }
  function next() {
    while (S.active < S.hands.length && S.hands[S.active].done) S.active++;
    if (S.active < S.hands.length) {
      const h = hand();
      if (value(h.cards).total === 21) { h.done = true; return next(); }
      save(); render(); return;
    }
    finishRound();
  }
  /* A banca joga toda de uma vez (fica com 17 ou mais, incluindo 17 com ás) e paga logo;
     a animação só mostra as cartas aos poucos. */
  function finishRound() {
    S.reveal = true;
    const allBust = S.hands.every(h => value(h.cards).total > 21);
    const onlyBJ = S.hands.length === 1 && isBJ(S.hands[0]);
    if (!allBust && !onlyBJ) while (value(S.dealer).total < 17) S.dealer.push(draw());
    const dv = value(S.dealer).total, dBJ = S.dealer.length === 2 && dv === 21;
    let paid = 0, staked = 0, best = "";
    for (const h of S.hands) {
      const pv = value(h.cards).total; staked += h.bet;
      let pay = 0, res;
      if (pv > 21) res = "Rebentou";
      else if (isBJ(h) && !dBJ) { pay = h.bet * 2.5; res = "Blackjack"; best = "bj"; }
      else if (isBJ(h) && dBJ) { pay = h.bet; res = "Empate"; }
      else if (dBJ) res = "Blackjack da banca";
      else if (dv > 21 || pv > dv) { pay = h.bet * 2; res = "Ganhou"; if (best !== "bj") best = "win"; }
      else if (pv === dv) { pay = h.bet; res = "Empate"; }
      else res = "Perdeu";
      h.res = res; h.pay = pay; paid += pay;
    }
    if (paid) C.give(paid);
    const net = paid - staked;
    S.note = net > 0 ? "Ganhaste " + fmtNum(net) + " fichas." : net < 0 ? "Perdeste " + fmtNum(-net) + " fichas." : "Empate: recebes a aposta de volta.";
    S.phase = "bet"; S.bet = S.lastBet <= C.balance ? S.lastBet : 0;
    save();
    const delay = motion() ? 450 + Math.max(0, S.dealer.length - 2) * 450 : 0;
    render();
    later(() => {
      if (best === "bj") { sound.win(); vibrate([30, 50, 30]); fx.confetti(); }
      else if (net > 0) { sound.line(); vibrate(25); }
      else if (net < 0) { sound.error(); }
      else sound.tap();
      showNote();
      C.checkBust(false);
    }, delay);
  }
  function later(f, ms) { timers.push(setTimeout(f, ms)); }

  /* ---------- Ecrã ---------- */
  function mount(c) {
    if (!S) load();
    els = c; seen = {};
    c.stats.innerHTML = C.statsHtml("bj");
    const table = el("div", { class: "table", id: "bj-table" });
    table.innerHTML =
      '<div class="bj-zone"><div class="lbl">Banca <span class="val" id="bj-dv"></span></div><div class="bj-cards" id="bj-dealer"></div></div>' +
      '<div class="note" id="bj-note" role="status"></div>' +
      '<div class="bj-zone"><div class="bj-hands" id="bj-hands"></div><div class="lbl">Tu</div></div>';
    c.board.append(table);

    const chips = C.chipRow(CHIPS, chip, v => { chip = v; addChip(v); });
    const betRow = el("div", { class: "casino-actions", id: "bj-betrow" });
    const bClear = el("button", { class: "btn", type: "button", id: "bj-clear" }, "Limpar aposta"); bClear.onclick = clearBet;
    const bDeal = el("button", { class: "btn primary", type: "button", id: "bj-deal" }, "Dar cartas"); bDeal.onclick = deal;
    betRow.append(bClear, bDeal);
    const playRow = el("div", { class: "casino-actions", id: "bj-playrow" });
    [["bj-hit", "Pedir", hit], ["bj-stand", "Ficar", stand], ["bj-double", "Dobrar", double], ["bj-split", "Dividir", split]].forEach(([id, l, f], k) => {
      const b = el("button", { class: "btn" + (k < 2 ? " primary" : ""), type: "button", id }, l); b.onclick = f; playRow.appendChild(b);
    });
    const bClose = el("button", { class: "btn ghost", type: "button" }, "Fechar a banca"); bClose.onclick = () => C.askClose();
    const kb = el("p", { class: "hint for-mouse" }, "Teclado: <kbd>Espaço</kbd> dar cartas, <kbd>P</kbd> pedir, <kbd>F</kbd> ficar, <kbd>D</kbd> dobrar, <kbd>V</kbd> dividir.");
    const tip = el("p", { class: "hint" }, "Toca nas fichas para apostar. Fichas virtuais, sem valor.");
    c.controls.append(chips, betRow, playRow, bClose, tip, kb);
    offChange = C.onChange(() => { if (els) drawStats(); });
    render(true);
    if (S.note) showNote();
  }
  function unmount() { save(); timers.forEach(clearTimeout); timers = []; if (offChange) offChange(); els = null; }

  function cardHtml(c, hidden, cls, delay) {
    if (hidden) return '<div class="pcard back ' + cls + '" style="--d:' + delay + 'ms" aria-label="Carta tapada"></div>';
    const s = suit(c), red = s === 1 || s === 2;
    return '<div class="pcard ' + (red ? "red " : "") + cls + '" style="--d:' + delay + 'ms" aria-label="' + RANKS[rank(c)] + " de " + ["espadas", "copas", "ouros", "paus"][s] + '"><span class="r">' + RANKS[rank(c)] + '</span><span class="s">' + SUITS[s] + '</span><span class="big">' + SUITS[s] + "</span></div>";
  }
  function valText(cards) { const v = value(cards); return v.soft && v.total < 21 ? (v.total - 10) + " / " + v.total : String(v.total); }

  function render(first) {
    if (!els) return;
    const anim = motion() && !first;
    /* Banca */
    const d = document.getElementById("bj-dealer");
    const prevD = seen.d || 0, wasHidden = seen.hidden;
    d.innerHTML = S.dealer.map((c, i) => {
      const hidden = i === 1 && !S.reveal;
      let cls = "";
      if (anim && i >= prevD) cls = "deal";
      else if (anim && i === 1 && wasHidden && S.reveal) cls = "flip";
      /* Cartas iniciais intercaladas com as do jogador; as que a banca tira no fim vêm uma a uma. */
      const delay = i < 2 ? i * 240 + 120 : (i - 1) * 450;
      return cardHtml(c, hidden, cls, anim ? delay : 0);
    }).join("");
    seen.d = S.dealer.length; seen.hidden = !S.reveal;
    document.getElementById("bj-dv").textContent = S.dealer.length ? (S.reveal ? valText(S.dealer) : valText([S.dealer[0]])) : "—";
    /* Jogador */
    const hs = document.getElementById("bj-hands");
    hs.classList.toggle("two", S.hands.length > 1);
    hs.innerHTML = S.hands.map((h, k) => {
      const prev = seen["h" + k] || 0;
      const cards = h.cards.map((c, i) => cardHtml(c, false, anim && i >= prev ? "deal" : "", anim ? (prev === 0 ? i * 240 : (i - prev) * 160) : 0)).join("");
      seen["h" + k] = h.cards.length;
      const resCls = h.res === "Ganhou" || h.res === "Blackjack" ? " win" : "";
      const showRes = S.phase === "bet" && h.res;
      return '<div class="bj-hand' + (S.phase === "play" && k === S.active && S.hands.length > 1 ? " active" : "") + '"><div class="bj-cards">' + cards + '</div><div class="lbl"><span class="val">' + valText(h.cards) + "</span> " + fmtNum(h.bet) + (h.doubled ? " ×2" : "") + "</div>" +
        (showRes ? '<span class="res' + resCls + '" data-later>' + h.res + "</span>" : "") + "</div>";
    }).join("") || '<div class="lbl" style="min-height:calc(var(--cw) * 1.4)">Faz a tua aposta</div>';
    if (anim && S.phase === "bet") hs.querySelectorAll("[data-later]").forEach(x => x.hidden = true);
    /* Botões */
    const betting = S.phase === "bet";
    document.getElementById("bj-betrow").hidden = !betting;
    document.getElementById("bj-playrow").hidden = betting;
    document.getElementById("bj-deal").textContent = S.bet ? "Dar cartas · " + fmtNum(S.bet) : "Dar cartas";
    document.getElementById("bj-deal").disabled = betting && S.bet < C.MIN_BET && !(S.lastBet && S.lastBet <= C.balance);
    document.getElementById("bj-clear").disabled = !S.bet;
    document.getElementById("bj-double").disabled = !canDouble();
    document.getElementById("bj-split").disabled = !canSplit();
    if (S.phase === "play") document.getElementById("bj-note").textContent = "";
    drawStats();
  }
  function showNote() {
    const n = document.getElementById("bj-note"); if (n) n.textContent = S.note || "";
    if (els) document.querySelectorAll("#bj-hands [data-later]").forEach(x => x.hidden = false);
  }
  function drawStats() {
    const inPlay = S.phase === "play" ? S.hands.reduce((s, h) => s + h.bet, 0) : S.bet;
    C.drawStats("bj", inPlay);
    if (S.phase === "bet") { const b = document.getElementById("bj-deal"); if (b) b.textContent = S.bet ? "Dar cartas · " + fmtNum(S.bet) : "Dar cartas"; }
  }

  function onKey(e) {
    const k = e.key.toLowerCase();
    if ((k === " " || k === "enter") && S.phase === "bet") { deal(); e.preventDefault(); }
    else if (k === "p") hit(); else if (k === "f") stand(); else if (k === "d") double(); else if (k === "v") split();
  }

  function help() {
    return "<h4>Objetivo</h4><p>Ficar mais perto de 21 do que a banca, sem passar. As figuras valem 10 e o ás vale 1 ou 11. Ás com uma carta de 10 nas duas primeiras cartas é blackjack.</p>" +
      "<h4>Como se joga</h4><ul>" +
      "<li>Toca nas fichas para apostar e depois em <b>Dar cartas</b>. A aposta mínima é de 10 fichas; a seguinte repete a anterior.</li>" +
      "<li><b>Pedir:</b> mais uma carta. <b>Ficar:</b> paras com o que tens.</li>" +
      "<li><b>Dobrar:</b> com duas cartas, dobras a aposta e recebes só mais uma.</li>" +
      "<li><b>Dividir:</b> com duas cartas do mesmo valor, fazes duas mãos (uma vez por ronda). Ases divididos recebem uma carta cada.</li>" +
      "<li>Teclado: <kbd>Espaço</kbd> dar cartas, <kbd>P</kbd> pedir, <kbd>F</kbd> ficar, <kbd>D</kbd> dobrar, <kbd>V</kbd> dividir.</li></ul>" +
      "<h4>Regras da mesa</h4><ul><li>Seis baralhos, baralhados de novo quando resta um quarto.</li><li>A banca pede até 17 e fica com qualquer 17, incluindo com ás.</li><li>Blackjack paga 3 para 2; as outras vitórias pagam 1 para 1; empate devolve a aposta. Não há seguro.</li></ul>" +
      "<h4>Banca e ranking</h4><ul><li>O Blackjack e a Roleta usam a mesma banca, que começa com 1000 fichas virtuais, sem valor real e sem compras.</li>" +
      "<li>Se ficares abaixo de 10 fichas, a banca fecha e começas outra. Também a podes fechar quando quiseres.</li>" +
      "<li>Cada banca fechada entra no ranking do casino com o maior saldo que atingiu.</li></ul>";
  }

  Sala.registerGame({
    id: "blackjack", name: "Blackjack", ready: true, rankAs: "casino",
    diffs: [{ id: "banca", label: "Maior saldo" }],
    desc: "Chegar o mais perto possível de 21 sem passar, contra a banca.",
    art: '<svg viewBox="0 0 36 36"><rect x="4" y="6" width="17" height="24" rx="3" fill="var(--surface)" stroke="var(--ink)" stroke-width="1.5" transform="rotate(-8 12 18)"/><rect x="15" y="6" width="17" height="24" rx="3" fill="var(--surface)" stroke="var(--ink)" stroke-width="1.5"/><text x="23.5" y="22.5" font-size="11" font-weight="900" text-anchor="middle" fill="var(--blue-ink)" font-family="Roboto,sans-serif">21</text></svg>',
    lastDiff: () => "banca",
    meta() {
      if (!S) load();
      const out = [{ text: "Saldo " + fmtNum(C.balance) + " fichas", cls: "blue" }];
      if (S.phase === "play") out.push({ text: "Mão a meio" });
      return out;
    },
    help, mount, unmount, onKey, save,
    tick() { C.tick(); }
  });
})();
