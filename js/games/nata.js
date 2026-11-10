/* Sala de Espera — Pastel de Nata (jogo idle).
   Regras em js/logic/nata.js. Aqui só o ecrã: o pastel para tocar, os produtores, as melhorias,
   o ganho com a app fechada e o "Fundar novo convento". Não entra em rankings (nem local nem online). */
(function () {
  "use strict";
  const { el, esc, store, sound, vibrate, motion, modal, toast } = Sala;
  const N = SalaLogica.nata, fmt = N.fmt, rate = N.fmtRate;
  const KEY = "nata", AWAY = 60 * 1000; /* mais de um minuto sem a app à vista conta como "estiveste fora" */

  let S = null, els = null, loop = 0, lastSave = 0, tab = "prod", qty = 1, lastSig = "";
  const now = () => Date.now();
  /* "1234 pastéis", "2,5 milhões de pastéis" */
  const pastéis = n => fmt(n) + (n >= 1e6 ? " de" : "") + (Math.floor(n) === 1 ? " pastel" : " pastéis");
  function load() { S = N.fix(store.get(KEY, null), now()); }
  function save() { if (S) { store.set(KEY, S); lastSave = now(); } }

  /* ---------- Desenhos (originais) ---------- */
  /* Pastel visto de cima: massa folhada canelada, creme e manchas queimadas. */
  function pastel(id) {
    let rim = "";
    for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, x = 50 + Math.cos(a) * 41, y = 50 + Math.sin(a) * 41; rim += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="8" fill="#C98A3A"/>'; }
    /* Manchas de caramelo: borrões irregulares, mais escuros no meio. */
    const blob = (x, y, r, k) => {
      /* Borrão arredondado: pontos à volta, ligados por curvas que passam pelo meio de cada lado. */
      const P = []; for (let j = 0; j < 7; j++) { const a = j / 7 * Math.PI * 2 + k, rr = r * (.72 + .4 * Math.abs(Math.sin(k * 3 + j * 1.7))); P.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * .8]); }
      const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], f = v => v.toFixed(1);
      let m = mid(P[6], P[0]), d = "M" + f(m[0]) + " " + f(m[1]);
      for (let j = 0; j < 7; j++) { const n = mid(P[j], P[(j + 1) % 7]); d += "Q" + f(P[j][0]) + " " + f(P[j][1]) + " " + f(n[0]) + " " + f(n[1]); }
      return d + "Z";
    };
    const spots = [[46, 42, 9, 1], [61, 52, 8, 2], [41, 59, 6, 3], [57, 35, 5, 4], [31, 46, 4, 5], [66, 64, 3.5, 6]]
      .map(([x, y, r, k]) => '<path d="' + blob(x, y, r * 1.25, k) + '" fill="#B56A22" opacity=".45" filter="url(#' + id + 'b)"/><path d="' + blob(x, y, r * .6, k + 1) + '" fill="#5B2E0E" opacity=".85"/>').join("");
    return '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
      '<defs><radialGradient id="' + id + 'c" cx=".45" cy=".42" r=".6"><stop offset="0" stop-color="#FFE7A0"/><stop offset=".7" stop-color="#F3C25A"/><stop offset="1" stop-color="#D99A35"/></radialGradient><filter id="' + id + 'b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6"/></filter></defs>' +
      '<ellipse cx="50" cy="93" rx="36" ry="5" fill="#000" opacity=".12"/>' + rim +
      '<circle cx="50" cy="50" r="41" fill="#B4742A"/>' +
      '<circle cx="50" cy="50" r="44.5" fill="none" stroke="#E2A653" stroke-width="1.4" opacity=".8"/>' +
      '<circle cx="50" cy="50" r="38.5" fill="none" stroke="#8E561C" stroke-width="1.2" opacity=".55"/>' +
      '<circle cx="50" cy="50" r="35.5" fill="none" stroke="#E2A653" stroke-width="1" opacity=".6"/>' +
      '<circle cx="50" cy="50" r="32" fill="url(#' + id + 'c)"/>' + spots +
      '<ellipse cx="40" cy="36" rx="9" ry="4" fill="#FFF6D6" opacity=".55" transform="rotate(-25 40 36)"/></svg>';
  }
  /* Ícones dos produtores (28×28, cores do tema). */
  const ICON = {
    avo: '<circle cx="14" cy="13" r="7" fill="#F6D9B8" stroke="var(--ink)" stroke-width="1.4"/><path d="M6.5 12.5C7 6 21 6 21.5 12.5C19 9.5 9 9.5 6.5 12.5Z" fill="var(--blue)"/><path d="M12 14h.01M16 14h.01" stroke="#14213D" stroke-width="2" stroke-linecap="round"/><path d="M12 17c1.2 1 2.8 1 4 0" stroke="#14213D" stroke-width="1.2" fill="none" stroke-linecap="round"/><path d="M7 26c1-4 4-6 7-6s6 2 7 6" fill="var(--blue-soft)" stroke="var(--ink)" stroke-width="1.4"/>',
    forno: '<path d="M4 24V14a10 10 0 0 1 20 0v10Z" fill="var(--sunken)" stroke="var(--ink)" stroke-width="1.4"/><path d="M9 24v-6a5 5 0 0 1 10 0v6" fill="var(--ink)"/><path d="M14 23c-3-1-3-4-1-6 0 2 2 2 2 0 2 2 2 5-1 6Z" fill="var(--yellow)"/><path d="M3 24.5h22" stroke="var(--ink)" stroke-width="1.6"/>',
    bairro: '<rect x="5" y="11" width="18" height="14" fill="var(--surface)" stroke="var(--ink)" stroke-width="1.4"/><path d="M3 11l2-6h18l2 6Z" fill="var(--blue)"/><path d="M3 11c2 2 4 2 5.5 0 1.5 2 3.5 2 5.5 0 2 2 4 2 5.5 0 1.5 2 3.5 2 5.5 0" fill="none" stroke="var(--ink)" stroke-width="1.2"/><rect x="8" y="15" width="7" height="6" fill="var(--blue-soft)" stroke="var(--ink)" stroke-width="1"/><rect x="17" y="15" width="3.5" height="10" fill="var(--yellow)"/>',
    fabrica: '<path d="M3 25V13l6 4v-4l6 4v-4l6 4V5h4v20Z" fill="var(--surface)" stroke="var(--ink)" stroke-width="1.4" stroke-linejoin="round"/><path d="M7 21h3M13 21h3" stroke="var(--blue)" stroke-width="2.4"/><path d="M23 4c0-2 2-2 2-3" stroke="var(--muted)" stroke-width="1.2" fill="none"/>',
    franq: '<path d="M14 26s-8-7.5-8-14a8 8 0 0 1 16 0c0 6.5-8 14-8 14Z" fill="var(--blue)" stroke="var(--ink)" stroke-width="1.2"/><circle cx="14" cy="12" r="4.5" fill="#F3C25A" stroke="#8E561C" stroke-width="1.6"/>',
    macau: '<path d="M2 19h24l-3 6H5Z" fill="var(--blue)" stroke="var(--ink)" stroke-width="1.2"/><rect x="5" y="12" width="6" height="6" fill="var(--yellow)" stroke="var(--ink)" stroke-width="1"/><rect x="11" y="12" width="6" height="6" fill="#C0262D" stroke="var(--ink)" stroke-width="1"/><rect x="8" y="6" width="6" height="6" fill="var(--blue-soft)" stroke="var(--ink)" stroke-width="1"/><path d="M20 18V8h2" stroke="var(--ink)" stroke-width="1.4" fill="none"/><path d="M1 27c3-1.5 5 1.5 8 0s5 1.5 8 0 5 1.5 9 0" stroke="var(--blue-ink)" stroke-width="1.2" fill="none"/>',
    lua: '<path d="M20 4a11 11 0 1 0 5 15A9 9 0 0 1 20 4Z" fill="var(--sunken)" stroke="var(--ink)" stroke-width="1.4"/><circle cx="10" cy="14" r="1.6" fill="var(--line)"/><circle cx="14" cy="21" r="2.2" fill="var(--line)"/><circle cx="16.5" cy="15" r="3.2" fill="#F3C25A" stroke="#8E561C" stroke-width="1.2"/>'
  };
  const icon = id => '<svg viewBox="0 0 28 28" aria-hidden="true" focusable="false">' + ICON[id] + "</svg>";
  const UP_ICON = '<svg viewBox="0 0 28 28" aria-hidden="true" focusable="false"><path d="M14 4l3 6.5 7 .8-5.2 4.8 1.5 7L14 19.5 7.7 23.1l1.5-7L4 11.3l7-.8Z" fill="var(--yellow)" stroke="var(--ink)" stroke-width="1.3" stroke-linejoin="round"/></svg>';

  /* ---------- Ecrã ---------- */
  function mount(c) {
    load();
    els = c; c.stats.classList.add("nt-stats");
    c.stats.innerHTML = Sala.ui.stat("Pastéis", "nt-p", "hl") + Sala.ui.stat("Por segundo", "nt-ps") + Sala.ui.stat("Por toque", "nt-pt") + Sala.ui.stat("Receitas", "nt-rec");
    const wrap = el("div", { class: "nt-oven" });
    const btn = el("button", { type: "button", class: "nt-pastel", id: "nt-tap", "aria-label": "Fazer um pastel de nata" }, pastel("ntp"));
    btn.addEventListener("pointerdown", e => { if (e.button > 0) return; e.preventDefault(); doTap(e); });
    /* Teclado (Enter ou Espaço com o pastel em foco): o browser manda um clique sem ponteiro. */
    btn.addEventListener("click", e => { if (e.detail === 0) doTap(); });
    wrap.append(btn, el("p", { class: "hint nt-hint" }, "Toca no pastel para enrolar massa."));
    const conv = el("div", { class: "nt-convent", id: "nt-convent", hidden: "" });
    c.board.append(wrap, conv);

    const segTab = Sala.ui.seg([{ id: "prod", label: "Produtores" }, { id: "up", label: "Melhorias" }], tab, id => { tab = id; lastSig = ""; draw(); }, "Lista");
    segTab.id = "nt-tabs";
    const segQty = Sala.ui.seg([{ id: "1", label: "×1" }, { id: "10", label: "×10" }, { id: "max", label: "Máx." }], String(qty), id => { qty = id === "max" ? "max" : +id; lastSig = ""; draw(); }, "Quantidade a comprar");
    segQty.id = "nt-qty"; segQty.classList.add("nt-qty");
    c.controls.append(segTab, segQty, el("div", { class: "nt-list", id: "nt-list" }));

    /* Ganho com a app fechada (com teto de 8 h). */
    const r = N.advance(S, now());
    if (r.made >= 1 && r.secs * 1000 >= AWAY) welcome(r);
    save(); lastSig = ""; draw();
    loop = setInterval(step, 200);
  }
  function unmount() { clearInterval(loop); loop = 0; save(); if (els) els.stats.classList.remove("nt-stats"); els = null; }

  /* Corre 5 vezes por segundo com o jogo à vista. Se o aparelho adormeceu ou a app esteve no fundo,
     o salto conta como tempo fora (com teto) e aparece o resumo. */
  function step() {
    if (!S || !els || document.hidden) return;
    const t = now(), dt = t - S.last;
    if (dt >= AWAY) { const r = N.advance(S, t); if (r.made >= 1 && !modal.isOpen) welcome(r); save(); }
    else N.advance(S, t, { live: true });
    if (t - lastSave > 10000) save();
    draw();
  }

  function welcome(r) {
    const h = Math.floor(r.secs / 3600), m = Math.floor(r.secs % 3600 / 60);
    const quanto = h ? h + (h === 1 ? " hora" : " horas") + (m ? " e " + m + " min" : "") : m + " min";
    modal.open({
      title: "Enquanto estiveste fora",
      className: "nt-away",
      body: '<div class="nt-away-art">' + pastel("ntw") + "</div><p>Em " + quanto + " fizeram-se <b>" + esc(pastéis(r.made)) + "</b> de nata.</p>" +
        (r.capped ? '<p class="hint">Os fornos só trabalham sozinhos até 8 horas. Volta mais vezes para não perderes fornadas.</p>' : ""),
      actions: [{ label: "Boa!", primary: true }]
    });
  }

  function doTap(e) {
    if (!S) return;
    const v = N.tap(S);
    if (motion()) {
      const b = document.getElementById("nt-tap");
      if (b) { b.classList.remove("hit"); void b.offsetWidth; b.classList.add("hit"); }
      const f = el("span", { class: "nt-float", "aria-hidden": "true" }, "+" + esc(rate(v)));
      const host = document.querySelector(".nt-oven");
      if (host) {
        const r = host.getBoundingClientRect(), x = e && e.clientX ? e.clientX - r.left : r.width / 2, y = e && e.clientY ? e.clientY - r.top : r.height / 3;
        f.style.left = x + "px"; f.style.top = y + "px"; host.appendChild(f); setTimeout(() => f.remove(), 900);
      }
    }
    draw();
  }

  /* Quantas unidades a compra atual leva: ×1, ×10 ou o máximo que dá (no mínimo 1, para mostrar o preço). */
  function howMany(i) { return qty === "max" ? Math.max(1, N.maxBuy(S, i)) : qty; }

  function buyProd(i) {
    const n = howMany(i);
    if (!N.buy(S, i, n)) { sound.error(); toast("Faltam " + pastéis(N.cost(S, i, n) - S.p) + "."); return; }
    sound.place(); vibrate(15); save(); lastSig = ""; draw();
  }
  function buyUp(id) {
    const u = N.UP.find(x => x.id === id);
    if (!N.buyUp(S, id)) { sound.error(); if (u) toast("Faltam " + pastéis(u.cost - S.p) + "."); return; }
    sound.place(); vibrate(15); save(); toast(u.name + ": " + u.desc); lastSig = ""; draw();
  }

  function draw() {
    if (!S || !els) return;
    const set = (id, t) => { const n = document.getElementById(id); if (n && n.textContent !== t) n.textContent = t; };
    set("nt-p", fmt(S.p)); set("nt-ps", rate(N.pps(S))); set("nt-pt", rate(N.perTap(S)));
    set("nt-rec", S.rec ? S.rec + " (+" + Math.round(S.rec * N.RECIPE_BONUS * 100) + "%)" : "0");
    const q = document.getElementById("nt-qty"); if (q) q.hidden = tab !== "prod";

    /* Convento: aparece quando já dá pelo menos uma receita. */
    const g = N.recipesGain(S), conv = document.getElementById("nt-convent");
    if (conv) {
      conv.hidden = g < 1;
      if (g >= 1) {
        const sig = "c" + g;
        if (conv.dataset.sig !== sig) {
          conv.dataset.sig = sig;
          conv.innerHTML = '<div><b>Fundar novo convento</b><span>Recomeças do zero com mais ' + g + (g === 1 ? " receita" : " receitas") + " (+" + Math.round(g * N.RECIPE_BONUS * 100) + "% para sempre).</span></div>";
          const b = el("button", { type: "button", class: "btn" }, "Fundar"); b.onclick = askFound; conv.appendChild(b);
        }
      }
    }

    /* Lista: só se refaz quando muda o que se vê; os botões só mudam de estado. */
    const list = document.getElementById("nt-list"); if (!list) return;
    if (tab === "prod") {
      const vis = N.PROD.map((_, i) => i).filter(i => N.prodVisible(S, i));
      const next = vis.length < N.PROD.length ? vis.length : -1;
      const sig = "p" + vis.join(",") + "|" + next + "|" + qty;
      if (sig !== lastSig) {
        lastSig = sig; list.innerHTML = "";
        vis.forEach(i => {
          const p = N.PROD[i];
          const row = el("button", { type: "button", class: "nt-row", "data-i": i });
          row.innerHTML = '<span class="nt-ic">' + icon(p.id) + '</span><span class="nt-tx"><b>' + esc(p.name) + ' <em data-own></em></b><span data-sub></span></span><span class="nt-cost" data-cost></span>';
          row.onclick = () => buyProd(i);
          list.appendChild(row);
        });
        if (next >= 0) list.appendChild(el("div", { class: "nt-row nt-locked", "aria-label": "Produtor por descobrir" }, '<span class="nt-ic">?</span><span class="nt-tx"><b>Por descobrir</b><span>Aparece quando tiveres feito ' + esc(fmt(N.PROD[next].cost * 0.5)) + " pastéis.</span></span>"));
      }
      list.querySelectorAll(".nt-row[data-i]").forEach(row => {
        const i = +row.dataset.i, p = N.PROD[i], n = howMany(i), c = N.cost(S, i, n);
        const own = row.querySelector("[data-own]"), sub = row.querySelector("[data-sub]"), cost = row.querySelector("[data-cost]");
        const ownT = S.own[i] ? "× " + S.own[i] : ""; if (own.textContent !== ownT) own.textContent = ownT;
        const subT = S.own[i] ? rate(N.ppsOf(S, i)) + " por segundo" : p.desc; if (sub.textContent !== subT) sub.textContent = subT;
        const costT = (n > 1 ? n + " por " : "") + fmt(c); if (cost.textContent !== costT) cost.textContent = costT;
        const ok = c <= S.p; row.classList.toggle("ok", ok); row.setAttribute("aria-label", "Comprar " + (n > 1 ? n + " " : "") + p.name + " por " + pastéis(c) + (ok ? "" : ", ainda não chega"));
      });
    } else {
      const ups = N.upsAvailable(S), at = N.nextUpAt(S), sig = "u" + ups.map(u => u.id).join(",") + "|" + at;
      if (sig !== lastSig) {
        lastSig = sig; list.innerHTML = "";
        if (!ups.length && at === null) list.appendChild(el("p", { class: "hint nt-empty" }, "Não há melhorias à vista. Aparecem mais quando tiveres mais produtores."));
        ups.forEach(u => {
          const row = el("button", { type: "button", class: "nt-row", "data-u": u.id });
          row.innerHTML = '<span class="nt-ic">' + (u.kind === "prod" ? icon(N.PROD[u.prod].id) : UP_ICON) + '</span><span class="nt-tx"><b>' + esc(u.name) + "</b><span>" + esc(u.desc) + '</span></span><span class="nt-cost">' + esc(fmt(u.cost)) + "</span>";
          row.onclick = () => buyUp(u.id);
          list.appendChild(row);
        });
        if (at !== null) list.appendChild(el("div", { class: "nt-row nt-locked", "aria-label": "Melhoria escondida" }, '<span class="nt-ic">?</span><span class="nt-tx"><b>Melhoria escondida</b><span>Aparece quando tiveres feito ' + esc(pastéis(at)) + ".</span></span>"));
      }
      list.querySelectorAll(".nt-row[data-u]").forEach(row => {
        const u = N.UP.find(x => x.id === row.dataset.u), ok = u.cost <= S.p;
        row.classList.toggle("ok", ok); row.setAttribute("aria-label", "Comprar " + u.name + " por " + pastéis(u.cost) + (ok ? "" : ", ainda não chega"));
      });
    }
    /* Pista de que há melhorias à espera, no separador. */
    const tb = document.querySelector("#nt-tabs button:last-child");
    if (tb) { const any = N.upsAvailable(S).some(u => u.cost <= S.p); tb.classList.toggle("nt-dot", any); }
  }

  function askFound() {
    const g = N.recipesGain(S); if (g < 1) return;
    const tot = S.rec + g;
    modal.open({
      title: "Fundar novo convento?",
      body: "<p>Recomeças com zero pastéis, sem produtores e sem melhorias. Em troca, as irmãs passam-te <b>" + g + (g === 1 ? " receita" : " receitas") + "</b> do convento.</p>" +
        "<p>Ficas com " + tot + " no total: <b>+" + Math.round(tot * N.RECIPE_BONUS * 100) + "%</b> a tudo o que fizeres, para sempre (toques incluídos).</p>" +
        '<p class="hint">Quanto mais pastéis fizeres antes de fundar, mais receitas ganhas.</p>',
      actions: [{ label: "Ainda não" }, { label: "Fundar", primary: true, onClick: () => {
        const got = N.found(S, now()); save(); lastSig = ""; draw();
        if (got) { if (Sala.fx && Sala.fx.confetti) Sala.fx.confetti(); toast("Convento novo! +" + got + (got === 1 ? " receita." : " receitas.")); }
      } }]
    });
  }

  /* Espaço sem nada em foco faz um pastel; com um botão em foco, o botão é que responde. */
  function onKey(e) {
    if (e.target && e.target.closest && e.target.closest("button")) return;
    if (e.key === " ") { e.preventDefault(); doTap(); }
  }

  function help() {
    return "<h4>Objetivo</h4><p>Fazer pastéis de nata, muitos. Começas a enrolar massa à mão e acabas com uma rede de pastelarias que chega à Lua.</p>" +
      "<h4>Como se joga</h4><ul>" +
      "<li>Toca no pastel para fazer pastéis (no computador, também com <kbd>Espaço</kbd>).</li>" +
      "<li>Com os pastéis compras <b>produtores</b>, que fazem pastéis sozinhos. Cada um que compras do mesmo tipo fica 15% mais caro.</li>" +
      "<li>As <b>melhorias</b> estão escondidas: cada uma só aparece depois de fazeres pastéis suficientes. Dobram a produção de um produtor, os toques ou tudo.</li></ul>" +
      "<h4>Com a app fechada</h4><p>Os fornos continuam a trabalhar enquanto não jogas, até <b>8 horas</b>. Quando voltas, vês quanto se fez. Se mexeres no relógio do aparelho para trás, não se ganha nada.</p>" +
      "<h4>Fundar novo convento</h4><p>Quando já fizeste pastéis suficientes, podes recomeçar do zero e ganhar <b>receitas do convento</b>: cada uma dá +" + Math.round(N.RECIPE_BONUS * 100) + "% a tudo, para sempre. Quanto mais pastéis fizeres antes, mais receitas.</p>" +
      "<h4>Sem ranking</h4><p>Este jogo não entra em rankings: é para ir jogando aos bocadinhos. Não há nada à venda, nem há de haver.</p>";
  }

  Sala.nataArt = pastel;

  Sala.registerGame({
    id: "nata", name: "Pastel de Nata", ready: true, noRank: true,
    desc: "Fazer pastéis de nata, primeiro à mão, depois às fornadas, até à Lua.",
    art: '<svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" fill="#B4742A"/><circle cx="18" cy="18" r="11" fill="#F3C25A"/><ellipse cx="15" cy="15" rx="3" ry="2" fill="#5B2E0E"/><ellipse cx="22" cy="20" rx="2.5" ry="1.8" fill="#5B2E0E"/></svg>',
    meta() {
      if (!S) load();
      const ps = N.pps(S), out = [];
      if (ps > 0) out.push({ text: rate(ps) + " por segundo", cls: "blue" });
      else if (S.p) out.push({ text: pastéis(S.p) });
      if (N.recipesGain(S) >= 1) out.push({ text: "Convento pronto a fundar" });
      return out;
    },
    help, mount, unmount, onKey, save
  });
})();
