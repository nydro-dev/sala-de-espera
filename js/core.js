/* Sala de Espera — base comum: armazenamento, definições, tema, som, vibração,
   janelas, avisos, efeitos, pontuação e ranking local. Sem dependências. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const el = (tag, attrs, html) => {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === "class") n.className = attrs[k];
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) n.setAttribute(k, attrs[k] === true ? "" : attrs[k]);
    }
    if (html != null) n.innerHTML = html;
    return n;
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtTime = s => { s = Math.max(0, s | 0); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = String(s % 60).padStart(2, "0"); return h ? h + ":" + String(m).padStart(2, "0") + ":" + x : m + ":" + x; };
  const fmtNum = n => Math.round(n).toLocaleString("pt-PT");
  const { shuffle, rng } = SalaLogica; /* js/logic/base.js: o mesmo código corre no servidor */
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const SITE = "https://saladeespera.pages.dev/"; /* endereço novo desde a Fase 7; o antigo encaminha (js/mudanca.js) */

  /* ---------- Armazenamento local (tudo protegido) ---------- */
  const PFX = "sde:";
  const store = {
    get(k, d) { try { const v = localStorage.getItem(PFX + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(PFX + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(PFX + k); } catch (e) {} },
    raw(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  };

  /* ---------- Definições ---------- */
  const DEFAULTS = { theme: "auto", anim: "auto", sound: true, vibrate: true, name: "" };
  const settings = Object.assign({}, DEFAULTS, store.get("settings", {}));
  function setSetting(k, v) {
    settings[k] = v; store.set("settings", settings);
    if (k === "theme") applyTheme();
    if (k === "anim") applyMotion();
    /* As pontuações guardadas antes de haver nome passam a usar o nome escolhido. */
    if (k === "name" && v) { const all = store.get("rank", {}); let ch = false; for (const key in all) for (const e of all[key]) if (e.name === "Eu") { e.name = v; ch = true; } if (ch) store.set("rank", all); }
  }

  /* ---------- Tema ---------- */
  const darkMQ = matchMedia("(prefers-color-scheme: dark)");
  function applyTheme() {
    const root = document.documentElement;
    if (settings.theme === "light" || settings.theme === "dark") root.dataset.theme = settings.theme;
    else delete root.dataset.theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(root).getPropertyValue("--bg").trim() || "#F5F7FB";
  }
  darkMQ.addEventListener ? darkMQ.addEventListener("change", applyTheme) : darkMQ.addListener(applyTheme);
  applyTheme();

  /* Animações: "auto" segue o sistema (Reduzir movimento), "always" liga sempre, "reduced" desliga. */
  const motionMQ = matchMedia("(prefers-reduced-motion: reduce)");
  const motion = () => settings.anim === "always" ? true : settings.anim === "reduced" ? false : !motionMQ.matches;
  function applyMotion() { document.documentElement.classList.toggle("anim", motion()); }
  motionMQ.addEventListener ? motionMQ.addEventListener("change", applyMotion) : motionMQ.addListener(applyMotion);
  applyMotion();

  /* ---------- Som (sintetizado, sem ficheiros) ---------- */
  let ac = null;
  function audio() {
    if (!settings.sound) return null;
    try {
      if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ac = new C(); }
      if (ac.state === "suspended") ac.resume();
      return ac;
    } catch (e) { return null; }
  }
  function tone(freq, start, dur, type, vol, slide) {
    const a = audio(); if (!a) return;
    const t = a.currentTime + start, o = a.createOscillator(), g = a.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol) {
    const a = audio(); if (!a) return;
    const n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.2);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    f.type = "lowpass"; f.frequency.value = 900; g.gain.value = vol || 0.5;
    s.buffer = buf; s.connect(f).connect(g).connect(a.destination); s.start();
  }
  const sound = {
    tap() { tone(660, 0, .05, "triangle", .05); },
    place() { tone(520, 0, .09, "sine", .09, 700); },
    note() { tone(880, 0, .05, "sine", .04); },
    error() { tone(180, 0, .18, "sawtooth", .06, 120); },
    flag() { tone(980, 0, .06, "square", .03); },
    open() { tone(420, 0, .07, "sine", .06, 560); },
    line() { [523, 659, 784].forEach((f, i) => tone(f, i * .07, .16, "triangle", .07)); },
    win() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * .1, .22, "triangle", .08)); },
    boom() { noise(.6, .55); tone(110, 0, .45, "sine", .2, 40); }
  };
  /* O Safari do iPhone não tem navigator.vibrate. Em troca, o interruptor nativo (input type="checkbox" switch)
     dá um toque háptico ao mudar: um rótulo escondido, clicado por código, faz um toque curto. Truque sem garantias. */
  const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  function iosTick() {
    try {
      const lb = document.createElement("label"), inp = document.createElement("input");
      lb.setAttribute("aria-hidden", "true"); lb.style.display = "none";
      inp.type = "checkbox"; inp.setAttribute("switch", ""); inp.tabIndex = -1;
      lb.appendChild(inp); document.head.appendChild(lb); lb.click(); lb.remove();
    } catch (e) {}
  }
  function vibrate(p) {
    if (!settings.vibrate) return;
    if (navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} return; }
    if (!IOS) return;
    /* Um padrão vira um toque por cada vibração (máximo três), espaçados como no padrão. */
    if (!Array.isArray(p)) return iosTick();
    let at = 0;
    for (let k = 0; k < p.length && k < 6; k += 2) { k ? setTimeout(iosTick, at) : iosTick(); at += (p[k] || 0) + (p[k + 1] || 0); }
  }

  /* ---------- Avisos ---------- */
  let toastT = 0;
  function toast(text, ms) {
    const t = $("toast"); t.textContent = text; t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), ms || 2200);
  }

  /* ---------- Janela modal ---------- */
  const dlg = $("modal");
  let onCloseCb = null;
  const modal = {
    get isOpen() { return dlg.hasAttribute("open"); },
    open({ title, body, actions, onClose, className }) {
      if (modal.isOpen) modal.close(true);
      $("modal-title").textContent = title || "";
      const b = $("modal-body"); b.className = "modal-body " + (className || ""); b.innerHTML = "";
      if (typeof body === "string") b.innerHTML = body; else if (body) b.appendChild(body);
      const f = $("modal-foot"); f.innerHTML = "";
      (actions || []).forEach(a => {
        const btn = el("button", { class: "btn" + (a.primary ? " primary" : "") }, esc(a.label));
        btn.onclick = () => { if (a.onClick && a.onClick() === false) return; if (a.close !== false) modal.close(); };
        f.appendChild(btn);
      });
      onCloseCb = onClose || null;
      try { dlg.showModal(); } catch (e) { dlg.setAttribute("open", ""); }
      const first = f.querySelector(".btn.primary") || b.querySelector("input,button") || dlg.querySelector("[data-close]");
      if (first && !("ontouchstart" in window)) first.focus();
    },
    close(silent) {
      if (!modal.isOpen) return;
      try { dlg.close(); } catch (e) { dlg.removeAttribute("open"); }
      const cb = onCloseCb; onCloseCb = null;
      if (cb && !silent) cb();
    }
  };
  dlg.addEventListener("click", e => {
    if (e.target.closest("[data-close]")) modal.close();
    else if (e.target === dlg) modal.close(); /* clique fora do cartão */
  });
  dlg.addEventListener("cancel", e => { e.preventDefault(); modal.close(); });

  /* ---------- Efeitos (confetes e explosão) ---------- */
  const cv = $("fx"), cx = cv.getContext("2d");
  let parts = [], raf = 0;
  function fxSize() { const r = devicePixelRatio || 1; cv.width = innerWidth * r; cv.height = innerHeight * r; cx.setTransform(r, 0, 0, r, 0, 0); }
  function fxLoop() {
    cx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter(p => p.life > 0);
    for (const p of parts) {
      p.life -= 1; p.vy += p.g; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      cx.save(); cx.globalAlpha = Math.min(1, p.life / 30); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.fillStyle = p.c;
      if (p.round) { cx.beginPath(); cx.arc(0, 0, p.s / 2, 0, 6.29); cx.fill(); } else cx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      cx.restore();
    }
    raf = parts.length ? requestAnimationFrame(fxLoop) : (cx.clearRect(0, 0, innerWidth, innerHeight), 0);
  }
  function fxStart() { if (!raf) { fxSize(); raf = requestAnimationFrame(fxLoop); } }
  const fx = {
    confetti() {
      if (!motion()) return;
      const cols = ["#1E4FA3", "#E0A526", "#A9B4C8", "#FFFFFF", "#1E4FA3", "#E0A526"];
      for (let i = 0; i < 160; i++) {
        const left = i % 2 === 0;
        parts.push({ x: left ? -10 : innerWidth + 10, y: innerHeight * (.55 + Math.random() * .3), vx: (left ? 1 : -1) * (4 + Math.random() * 8), vy: -(9 + Math.random() * 9), g: .28, vr: (Math.random() - .5) * .4, rot: Math.random() * 6, s: 7 + Math.random() * 7, c: cols[i % cols.length], life: 130 + Math.random() * 60 });
      }
      fxStart();
    },
    burst(x, y) {
      if (!motion()) return;
      const cols = ["#E0A526", "#FF7B2E", "#E8352E", "#14213D", "#A9B4C8"];
      for (let i = 0; i < 70; i++) {
        const a = Math.random() * 6.283, v = 2 + Math.random() * 9;
        parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, g: .22, vr: (Math.random() - .5) * .5, rot: 0, s: 3 + Math.random() * 6, c: cols[i % cols.length], life: 50 + Math.random() * 40, round: Math.random() < .6 });
      }
      fxStart();
    }
  };
  addEventListener("resize", () => { if (raf) fxSize(); });

  /* ---------- Ranking local: top 10 por jogo e dificuldade ---------- */
  const TOP = 10;
  const ranking = {
    all() { return store.get("rank", {}); },
    list(game, diff) { return (ranking.all()[game + ":" + diff] || []).slice(); },
    best(game, diff) { const l = ranking.list(game, diff); return l.length ? l[0] : null; },
    /* Devolve a posição (1–10) ou 0 se não entrou. */
    add(game, diff, entry) {
      const all = ranking.all(), key = game + ":" + diff, l = all[key] || [];
      entry.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      entry.date = new Date().toISOString();
      l.push(entry);
      l.sort((a, b) => b.score - a.score || a.time - b.time);
      all[key] = l.slice(0, TOP);
      store.set("rank", all);
      const pos = all[key].findIndex(e => e.id === entry.id);
      return { pos: pos + 1, id: entry.id };
    },
    rename(id, name) {
      const all = ranking.all();
      for (const k in all) for (const e of all[k]) if (e.id === id) e.name = name;
      store.set("rank", all);
    }
  };

  /* ---------- Desafio do dia: o mesmo jogo para toda a gente, a partir da data ---------- */
  const ymd = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const today = () => ymd(new Date());
  const daily = {
    today,
    GAMES: ["palavras", "sudoku", "minas", "soli"],
    label: ds => ds.split("-").reverse().join("/"),
    long(ds) { const [y, m, d] = (ds || today()).split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" }); },
    rng: (game, ds) => rng("sala-de-espera:" + game + ":" + (ds || today())),
    /* Resultado da tentativa que conta (só a primeira de cada dia). */
    result(game, ds) { const r = store.get("daily", {})[game]; return r && r.date === (ds || today()) ? r : null; },
    save(game, r) { const all = store.get("daily", {}); all[game] = r; store.set("daily", all); }
  };

  /* ---------- Estatísticas por jogo e dificuldade ("*" junta todas) ---------- */
  const stats = {
    all() { return store.get("stats", {}); },
    get(game, diff) { return (stats.all()[game] || {})[diff] || null; },
    blank: () => ({ played: 0, won: 0, streak: 0, best: 0, tSum: 0, tN: 0, tBest: 0, sSum: 0, sBest: 0, tAll: 0 }),
    /* r: { won: true | false | undefined (jogos só de pontos), time, score } */
    record(game, diff, r) {
      const g = gameById(game); if (g && g.rankAs) game = g.rankAs;
      const all = stats.all(), gs = all[game] || (all[game] = {});
      for (const k of diff === "*" ? ["*"] : [diff, "*"]) {
        const b = gs[k] = Object.assign(stats.blank(), gs[k]);
        b.played++; b.tAll += r.time || 0;
        if (r.score != null) { b.sSum += r.score; b.sBest = Math.max(b.sBest, r.score); }
        if (r.won === true) {
          b.won++; b.streak++; b.best = Math.max(b.best, b.streak);
          if (r.time) { b.tSum += r.time; b.tN++; b.tBest = b.tBest ? Math.min(b.tBest, r.time) : r.time; }
        } else if (r.won === false) b.streak = 0;
      }
      store.set("stats", all);
    },
    /* Junta números de antes de haver estatísticas (as Palavras já guardavam os seus). */
    seed(game, diff, b) { const all = stats.all(), gs = all[game] || (all[game] = {}); gs[diff] = Object.assign(stats.blank(), b); store.set("stats", all); }
  };

  /* ---------- Registo de jogos ---------- */
  const games = [];
  function registerGame(g) { games.push(g); }
  const gameById = id => games.find(g => g.id === id);

  /* ---------- Componentes do ecrã de jogo ---------- */
  const ui = {
    stat(label, id, cls) { return '<div class="stat' + (cls ? " " + cls : "") + '"><small>' + esc(label) + '</small><b id="' + id + '">—</b></div>'; },
    seg(items, current, onPick, label) {
      const s = el("div", { class: "seg", role: "group", "aria-label": label || "" });
      items.forEach(it => {
        const b = el("button", { type: "button", "aria-pressed": String(it.id === current) }, esc(it.label));
        b.onclick = () => { s.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); onPick(it.id); };
        s.appendChild(b);
      });
      return s;
    },
    ICON: {
      undo: '<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
      erase: '<svg viewBox="0 0 24 24"><path d="M20 20H9L4 15a2 2 0 0 1 0-2.8l9-9a2 2 0 0 1 2.8 0l4.2 4.2a2 2 0 0 1 0 2.8L12 18"/><path d="M8 11l6 6"/></svg>',
      pencil: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
      bulb: '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/></svg>',
      plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
      flag: '<svg viewBox="0 0 24 24"><path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/></svg>',
      pick: '<svg viewBox="0 0 24 24"><path d="M6 3l13 7.5-5.8 1.6L10.5 18z"/><path d="M13.4 12.3L18 17"/></svg>',
      share: '<svg viewBox="0 0 24 24"><path d="M12 15V3"/><path d="M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>',
      cal: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
      back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>'
    }
  };

  /* Logótipo azulejo (viewBox 100×100), para desenhar em canvas com Path2D. */
  const LOGO = [["#1E4FA3","M22.0 0H78.0A22.0 22.0 0 0 1 100 22.0V78.0A22.0 22.0 0 0 1 78.0 100H22.0A22.0 22.0 0 0 1 0 78.0V22.0A22.0 22.0 0 0 1 22.0 0Z"],["#F5F7FB","M29.0 14H71.0A15.0 15.0 0 0 0 86 29.0V71.0A15.0 15.0 0 0 0 71.0 86H29.0A15.0 15.0 0 0 0 14 71.0V29.0A15.0 15.0 0 0 0 29.0 14Z"],["#1E4FA3","M41.5 38.5A8.5 8.5 0 1 0 58.5 38.5A8.5 8.5 0 1 0 41.5 38.5Z"],["#1E4FA3","M53.0 50.0A8.5 8.5 0 1 0 70.0 50.0A8.5 8.5 0 1 0 53.0 50.0Z"],["#1E4FA3","M41.5 61.5A8.5 8.5 0 1 0 58.5 61.5A8.5 8.5 0 1 0 41.5 61.5Z"],["#1E4FA3","M30.0 50.0A8.5 8.5 0 1 0 47.0 50.0A8.5 8.5 0 1 0 30.0 50.0Z"],["#E0A526","M43.5 50.0A6.5 6.5 0 1 0 56.5 50.0A6.5 6.5 0 1 0 43.5 50.0Z"],["#1E4FA3","M33.0 28.8l4.2 4.2 -4.2 4.2 -4.2 -4.2z"],["#1E4FA3","M67.0 28.8l4.2 4.2 -4.2 4.2 -4.2 -4.2z"],["#1E4FA3","M33.0 62.8l4.2 4.2 -4.2 4.2 -4.2 -4.2z"],["#1E4FA3","M67.0 62.8l4.2 4.2 -4.2 4.2 -4.2 -4.2z"]];
  /* ---------- Partilhar: texto e imagem nas cores da casa ---------- */
  /* d: { title, sub, big, unit, lines: [texto], grid: [[0 | 1 | 2]], text } */
  async function shareImage(d) {
    try { if (document.fonts) await Promise.race([Promise.all([document.fonts.load("900 100px Roboto"), document.fonts.load("500 40px Roboto")]), new Promise(r => setTimeout(r, 900))]); } catch (e) {}
    const W = 1080, H = 1080, c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d"), F = (w, s) => w + " " + s + 'px Roboto, "Segoe UI", system-ui, sans-serif';
    const rr = (px, py, w, h, r) => { x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); };
    const fit = (txt, w, size, max) => { x.font = F(w, size); while (size > 24 && x.measureText(txt).width > max) { size -= 4; x.font = F(w, size); } return size; };
    x.fillStyle = "#14213D"; x.fillRect(0, 0, W, H);
    x.fillStyle = "#E0A526"; x.fillRect(0, 0, W, 14);
    /* Marca: logótipo azulejo */
    const M = 80;
    x.save(); x.translate(M, 64); x.scale(1.24, 1.24);
    try { LOGO.forEach(([f, d]) => { x.fillStyle = f; x.fill(new Path2D(d)); }); } catch (e) {}
    x.restore();
    x.textBaseline = "alphabetic"; x.fillStyle = "#EEF2F8"; x.font = F(900, 44); x.fillText("Sala de Espera", 222, 118);
    x.fillStyle = "#A9B4C8"; x.font = F(400, 28); x.fillText("Jogos curtos para os intervalos", 222, 160);
    /* Jogo e etiqueta */
    let y = 320;
    x.fillStyle = "#EEF2F8"; fit(d.title, 900, 92, W - 2 * M); x.fillText(d.title, M, y);
    if (d.sub) {
      x.font = F(700, 34); const tw = x.measureText(d.sub).width;
      x.fillStyle = "#E0A526"; rr(M, y + 32, tw + 44, 60, 30); x.fill();
      x.fillStyle = "#14213D"; x.fillText(d.sub, M + 22, y + 74);
    }
    y += d.grid ? 230 : 330;
    /* Pontuação grande */
    const bs = d.grid ? 150 : 210;
    x.fillStyle = "#E0A526"; const bsz = fit(d.big, 900, bs, (d.grid ? 520 : W - 2 * M) - 160); x.fillText(d.big, M, y);
    if (d.unit) { const bw = x.measureText(d.big).width; x.fillStyle = "#A9B4C8"; x.font = F(700, Math.round(bsz * .27)); x.fillText(d.unit, M + bw + 18, y); }
    y += 72;
    x.fillStyle = "#EEF2F8";
    const lw = d.grid ? 500 : W - 2 * M;
    (d.lines || []).slice(0, 4).forEach(l => { fit(l, 500, 40, lw); x.fillText(l, M, y); y += 56; });
    if (d.grid) {
      const n = d.grid[0] ? d.grid[0].length : 5, g2 = 10, cs = Math.min(62, Math.floor((350 - (n - 1) * g2) / n)) /* 7 letras cabem na mesma largura */, gx = W - M - n * cs - (n - 1) * g2;
      let gy = 430;
      const col = ["#3A4766", "#E0A526", "#3D6FD1"];
      d.grid.forEach(row => { row.forEach((v, k) => { x.fillStyle = col[v] || col[0]; rr(gx + k * (cs + g2), gy, cs, cs, 10); x.fill(); }); gy += cs + g2; });
    }
    x.fillStyle = "#2A3654"; x.fillRect(M, H - 110, W - 2 * M, 2);
    x.fillStyle = "#8DB3F2"; x.font = F(500, 32); x.fillText(SITE.replace(/^https:\/\//, "").replace(/\/$/, ""), M, H - 58);
    return new Promise(res => { try { c.toBlob(b => res(b), "image/png"); } catch (e) { res(null); } });
  }
  async function copyText(t, done) {
    try { await navigator.clipboard.writeText(t); toast(done || "Texto copiado. Já o podes colar numa mensagem."); }
    catch (e) { toast("Não consegui copiar automaticamente."); }
  }
  /* No telemóvel abre logo a folha de partilha do sistema; no PC mostra a imagem com opções. */
  async function share(d, blobP) {
    const blob = await (blobP || shareImage(d));
    const file = blob && typeof File === "function" ? new File([blob], "sala-de-espera.png", { type: "image/png" }) : null;
    const canFiles = file && navigator.canShare && (() => { try { return navigator.canShare({ files: [file] }); } catch (e) { return false; } })();
    if (canFiles && matchMedia("(pointer: coarse)").matches) {
      try { await navigator.share({ files: [file], text: d.text }); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    const box = el("div", { class: "share-prev" });
    let url = null;
    if (blob) { url = URL.createObjectURL(blob); box.appendChild(el("img", { src: url, alt: "Imagem do resultado" })); }
    box.appendChild(el("pre", { class: "share-text" }, esc(d.text)));
    const acts = [];
    if (canFiles) acts.push({ label: "Partilhar…", primary: true, close: false, onClick: () => { navigator.share({ files: [file], text: d.text }).catch(() => {}); } });
    else if (navigator.share) acts.push({ label: "Partilhar texto", close: false, onClick: () => { navigator.share({ text: d.text }).catch(() => {}); } });
    if (blob && window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) acts.push({ label: "Copiar imagem", close: false, onClick: () => { navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]).then(() => toast("Imagem copiada.")).catch(() => toast("Não consegui copiar a imagem.")); } });
    if (blob) acts.push({ label: "Guardar imagem", close: false, onClick: () => { const a = el("a", { href: url, download: "sala-de-espera.png" }); document.body.appendChild(a); a.click(); a.remove(); } });
    acts.push({ label: "Copiar texto", primary: !canFiles, close: false, onClick: () => { copyText(d.text); } });
    modal.open({ title: "Partilhar resultado", body: box, className: "share", actions: acts, onClose: () => { if (url) setTimeout(() => URL.revokeObjectURL(url), 1000); } });
  }

  /* ---------- Duelo por link ----------
     O link leva tudo o que é preciso para jogar o mesmo tabuleiro: dificuldade, semente (ou o próprio
     tabuleiro), nome e resultado de quem desafia. Fica depois do "#", por isso nunca chega ao servidor.
     Resultado: { s: pontos, t: segundos, p: progresso (desempate), w: 1 ganhou | 0 não }. */
  const sgn = v => v > 0 ? 1 : v < 0 ? -1 : 0;
  const hash36 = s => Math.floor(rng(s)() * 4294967296).toString(36).padStart(7, "0");
  const b64u = bytes => { let s = ""; bytes.forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
  const unb64u = str => { str = str.replace(/-/g, "+").replace(/_/g, "/"); while (str.length % 4) str += "="; const bin = atob(str); return Uint8Array.from(bin, c => c.charCodeAt(0)); };
  /* Baralha os bytes para o link não se ler à primeira (não é segurança: quem souber, consegue falsificá-lo). */
  const mask = bytes => { const r = rng("sala-de-espera:duelo"); return bytes.map(b => b ^ (r() * 256 | 0)); };
  /* Nomes comparados sem acentos nem maiúsculas: "João" escrito à mão como "JOAO" é o mesmo rival. */
  const plainName = n => String(n || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const nameKey = n => plainName(n).trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-PT");

  /* ---------- Código de duelo (Fase 6.1) ----------
     Versão curta do link, para escrever ou colar na app instalada (no iPhone os links abrem
     sempre no Safari, que guarda os dados à parte). Forma: PREFIXO-DADOS-NOME, por exemplo
     SUD-K7F3-QX9M-2TAB-Rui. Os dados vão em binário, campo a campo, com o desenho que cada
     jogo declara em `code` ({ pre, bits, pack(x), unpack(v), ctx(x) }), escritos no alfabeto
     Crockford base32 (sem I, L, O e U). No fim vão dois caracteres de verificação: o primeiro
     (Luhn mod 32) apanha qualquer erro num só carácter; o segundo mistura tudo, incluindo o
     nome e o que o jogo disser (nas Palavras, a própria palavra, para que um código não abra
     outra palavra se a lista mudar). */
  const CROCK = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const CROCK_IN = (() => { const m = {}; for (let i = 0; i < 32; i++) m[CROCK[i]] = i; m.I = m.L = 1; m.O = 0; return m; })();
  /* Sementes curtas: 16 bits em base 36 com 4 caracteres (65 536 tabuleiros por dificuldade). */
  const SEED_MAX = 65536;
  const seedNum = s => typeof s === "string" && /^[0-9a-z]{4}$/.test(s) && parseInt(s, 36) < SEED_MAX ? parseInt(s, 36) : -1;
  const seedStr = n => n.toString(36).padStart(4, "0");
  const luhn32 = vals => { let f = 2, sum = 0; for (let i = vals.length - 1; i >= 0; i--) { let a = f * vals[i]; f = f === 2 ? 1 : 2; sum += Math.floor(a / 32) + a % 32; } return (32 - sum % 32) % 32; };
  const codeName = n => plainName(n).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const codeMix = (game, vals, name, ctx) => Math.floor(rng("sala-de-espera:codigo|" + game + "|" + vals.join(".") + "|" + codeName(name) + "|" + (ctx || ""))() * 32);
  const codeMask = (game, n) => { const r = rng("sala-de-espera:codigo:" + game); return [...Array(n)].map(() => r() * 32 | 0); };
  const code = {
    CROCK, seedNum, seedStr,
    /* Quantos caracteres de dados (sem verificação) leva um formato de código. */
    size: C => Math.ceil(C.bits.reduce((a, b) => a + b, 0) / 5),
    /* Um jogo pode ter mais de um formato: o principal (code) e outros com prefixo próprio (codes),
       como as Palavras com 4, 6 e 7 letras. Os outros baralham com o prefixo junto ao jogo. */
    specs: g => g && g.code ? [g.code].concat(g.codes || []) : [],
    specKey: (g, C) => C === g.code ? g.id : g.id + ":" + C.pre,
    /* x = { d, b, s, t, p, w }; devolve null se não couber (semente antiga, pontuação enorme…). */
    encode(game, x, name) {
      const g = gameById(game); if (!g || !String(name || "").trim()) return null;
      let C = null, v = null;
      for (const S of code.specs(g)) {
        let w; try { w = S.pack(x); } catch (e) { w = null; }
        if (w && w.length === S.bits.length && w.every((n, i) => Number.isInteger(n) && n >= 0 && n < 2 ** S.bits[i])) { C = S; v = w; break; }
      }
      if (!C) return null;
      const ck = code.specKey(g, C);
      let big = 0n; C.bits.forEach((b, i) => { big = (big << BigInt(b)) | BigInt(v[i]); });
      const n = code.size(C), total = C.bits.reduce((a, b) => a + b, 0);
      big <<= BigInt(n * 5 - total);
      const vals = [], mask = codeMask(ck, n);
      for (let i = n - 1; i >= 0; i--) { vals[i] = Number(big & 31n); big >>= 5n; }
      const data = vals.map((c, i) => c ^ mask[i]);
      const nm = String(name).trim().slice(0, 16);
      const all = data.concat(luhn32(data), codeMix(ck, data, nm, C.ctx ? C.ctx(x) : ""));
      const s = all.map(c => CROCK[c]).join("");
      return C.pre + "-" + s.match(/.{1,4}/g).join("-") + "-" + nm;
    },
    /* Lê um código escrito à mão ou colado (aceita também o link inteiro).
       Devolve { D } (o mesmo formato do link) ou { err } com uma frase para mostrar. */
    decode(text) {
      let t = String(text || "").trim();
      const lk = t.match(/#\/(?:d|duelo)\/(.+)$/);
      if (lk) {
        const h = lk[1];
        const long = h.match(/^(\w+)\/([A-Za-z0-9_-]+)/);
        if (long && /^#\/duelo\//.test(lk[0])) {
          const g = gameById(long[1]), D = g && g.duel ? duel.decode(long[1], long[2]) : null;
          return D && !(g.duelOk && !g.duelOk(D)) ? { D } : { err: "Este link está incompleto ou foi alterado. Pede a quem o mandou que o envie outra vez." };
        }
        try { t = decodeURIComponent(h.replace(/\+/g, " ")); } catch (e) { t = h.replace(/\+/g, " "); }
      }
      /* Lê o prefixo e os dados, ignorando hífenes e espaços; o resto é o nome. */
      let i = 0, chars = "";
      const take = n => { while (i < t.length && chars.length < n) { const c = t[i].toUpperCase(); i++; if (c === "-" || c === " " || c === "." || c === "‑") continue; chars += c; } };
      take(3);
      const pre = chars.toUpperCase();
      let g = null, C = null;
      for (const x of games) { const S = code.specs(x).find(y => y.pre === pre); if (S) { g = x; C = S; break; } }
      if (!g) return { err: chars.length < 3 ? "Escreve o código todo, começando pelas três letras do jogo (por exemplo, SUD)." : "As três primeiras letras (" + pre + ") não correspondem a nenhum jogo." };
      const n = code.size(C), ck = code.specKey(g, C);
      chars = ""; take(n + 2);
      if (chars.length < n + 2) return { err: "Faltam caracteres ao código." };
      const vals = [];
      for (const c of chars) { if (!(c in CROCK_IN)) return { err: "O código tem um carácter que não existe (" + c + ")." }; vals.push(CROCK_IN[c]); }
      const name = t.slice(i).replace(/^[\s\-‑]+/, "").trim().slice(0, 16);
      if (!name) return { err: "Falta o nome de quem desafia, no fim do código." };
      const data = vals.slice(0, n);
      if (luhn32(data) !== vals[n]) return { err: "O código tem um erro. Confirma letra a letra." };
      const mask = codeMask(ck, n);
      let big = 0n; data.forEach((c, k) => { big = (big << 5n) | BigInt(c ^ mask[k]); });
      const total = C.bits.reduce((a, b) => a + b, 0);
      big >>= BigInt(n * 5 - total);
      const v = [];
      for (let k = C.bits.length - 1; k >= 0; k--) { v[k] = Number(big & ((1n << BigInt(C.bits[k])) - 1n)); big >>= BigInt(C.bits[k]); }
      let x; try { x = C.unpack(v); } catch (e) { x = null; }
      if (!x || codeMix(ck, data, name, C.ctx ? C.ctx(x) : "") !== vals[n + 1]) return { err: "O código tem um erro (confirma também o nome no fim)." };
      const D = { g: g.id, d: x.d, b: x.b, n: name, s: x.s, t: x.t, p: x.p || 0, w: x.w ? 1 : 0, bid: duel.boardId(g.id, x.d, x.b) };
      if (g.duelOk && !g.duelOk(D)) return { err: "Este código não dá um tabuleiro válido." };
      return { D };
    },
    url: c => SITE + "#/d/" + encodeURIComponent(c).replace(/%20/g, "+").replace(/%2D/gi, "-")
  };

  const duel = {
    newSeed: () => seedStr(Math.random() * SEED_MAX | 0),
    boardId: (game, d, b) => hash36("board|" + game + "|" + d + "|" + b),
    encode(game, x) {
      const json = JSON.stringify([1, x.d, x.b, String(x.n).slice(0, 16), Math.round(x.s) || 0, Math.round(x.t) || 0, Math.round(x.p) || 0, x.w ? 1 : 0]);
      return hash36(game + "|" + json).slice(0, 4) + b64u(mask(new TextEncoder().encode(json)));
    },
    decode(game, code) {
      try {
        const chk = code.slice(0, 4), json = new TextDecoder().decode(mask(unb64u(code.slice(4))));
        if (hash36(game + "|" + json).slice(0, 4) !== chk) return null;
        const a = JSON.parse(json), num = v => typeof v === "number" && isFinite(v) && v >= 0 && v < 1e8;
        if (!Array.isArray(a) || a[0] !== 1 || typeof a[1] !== "string" || typeof a[2] !== "string" || typeof a[3] !== "string" || !a[3].trim() || a[2].length > 400 || ![a[4], a[5], a[6]].every(num)) return null;
        return { g: game, d: a[1], b: a[2], n: a[3].trim().slice(0, 16), s: a[4], t: a[5], p: a[6], w: a[7] ? 1 : 0, bid: duel.boardId(game, a[1], a[2]) };
      } catch (e) { return null; }
    },
    url: (game, x) => SITE + "#/duelo/" + game + "/" + duel.encode(game, x),
    data() {
      const all = Object.assign({ mine: {}, seen: {}, rivals: {}, recent: [] }, store.get("duelos", {}));
      /* Fase 6.1: os rivais passam a juntar-se sem acentos ("João" = "Joao"); funde os que já existiam. */
      if (all.nk !== 2) {
        const rv = {};
        Object.values(all.rivals).forEach(x => {
          const k = nameKey(x.name), y = rv[k];
          if (!y) rv[k] = Object.assign({}, x);
          else { y.w += x.w; y.l += x.l; y.e += x.e; if ((x.last || 0) > (y.last || 0)) { y.last = x.last; y.name = x.name; } }
        });
        const seen = {};
        Object.keys(all.seen).forEach(k => { const i = k.indexOf("|"); seen[k.slice(0, i) + "|" + nameKey(k.slice(i + 1))] = all.seen[k]; });
        all.rivals = rv; all.seen = seen; all.nk = 2;
        store.set("duelos", all);
      }
      return all;
    },
    mine: bid => duel.data().mine[bid] || null,
    /* Quem ganhou: mais pontos; depois mais progresso; depois menos tempo (nos jogos em que o tempo conta). */
    cmp(game, a, b) {
      const g = gameById(game) || {};
      if (a.s !== b.s) return sgn(a.s - b.s);
      if ((a.p || 0) !== (b.p || 0)) return sgn((a.p || 0) - (b.p || 0));
      if (g.duelTime && a.s > 0 && a.t !== b.t) return sgn(b.t - a.t);
      return 0;
    },
    /* Regista o resultado contra este rival (cada tabuleiro conta uma vez por rival). */
    record(D, me) {
      const all = duel.data(), k = D.bid + "|" + nameKey(D.n);
      if (all.seen[k] != null) return { r: all.seen[k].r, fresh: false };
      const r = duel.cmp(D.g, me, D);
      all.seen[k] = { r, at: Date.now() };
      const rv = all.rivals[nameKey(D.n)] || (all.rivals[nameKey(D.n)] = { name: D.n, w: 0, l: 0, e: 0 });
      rv.name = D.n; rv.last = Date.now(); r > 0 ? rv.w++ : r < 0 ? rv.l++ : rv.e++;
      all.recent.unshift({ g: D.g, d: D.d, n: D.n, r, me: me.s, opp: D.s, at: Date.now() });
      all.recent = all.recent.slice(0, 30);
      /* Não deixa a lista crescer sem fim. */
      const ks = Object.keys(all.seen); if (ks.length > 400) ks.sort((a, b) => all.seen[a].at - all.seen[b].at).slice(0, ks.length - 400).forEach(x => delete all.seen[x]);
      store.set("duelos", all);
      return { r, fresh: true };
    },
    saveMine(bid, me) {
      const all = duel.data(); all.mine[bid] = Object.assign({}, me, { at: Date.now() });
      const ks = Object.keys(all.mine); if (ks.length > 200) ks.sort((a, b) => all.mine[a].at - all.mine[b].at).slice(0, ks.length - 200).forEach(x => delete all.mine[x]);
      store.set("duelos", all);
    },
    label(game, d) { const g = gameById(game) || {}; return g.duelLabel ? g.duelLabel(d) : ((g.diffs || []).find(x => x.id === d) || { label: d }).label; },
    line(game, r) {
      const g = gameById(game) || {};
      if (g.duelText) return g.duelText(r);
      return r.w ? fmtTime(r.t) : (g.dailyLost || "Sem vitória") + (r.t ? " · " + fmtTime(r.t) : "");
    },
    /* Etiqueta mostrada no jogo durante o duelo. */
    tag(D) { return el("div", { class: "mode-tag duel-tag" }, SWORDS + "Duelo com " + esc(D.n) + " · " + esc(duel.label(D.g, D.d)) + "<span>Para bater: " + fmtNum(D.s) + " pts</span>"); },
    /* Pede o nome (se ainda não houver) e depois partilha o link. */
    withName(then) {
      if (settings.name) return then(settings.name);
      const box = el("div", { class: "field col" }, '<label for="duel-name">O teu nome no duelo</label>');
      const inp = el("input", { id: "duel-name", class: "input", maxlength: "16", autocomplete: "nickname", placeholder: "Por exemplo: Rui" });
      box.appendChild(inp);
      box.appendChild(el("p", { class: "hint" }, "Aparece a quem receber o link, junto do teu resultado."));
      modal.open({ title: "Quem desafia?", body: box, actions: [{ label: "Cancelar" }, { label: "Criar link", primary: true, onClick: () => {
        const n = inp.value.trim().slice(0, 16); if (!n) { inp.focus(); toast("Escreve um nome."); return false; }
        setSetting("name", n); modal.close(true); then(n); return false;
      } }] });
    },
    /* Desafiar a partir de um jogo acabado: x = { d, b, s, t, p, w } */
    challenge(game, x) {
      const g = gameById(game) || {};
      duel.withName(n => {
        const bid = duel.boardId(game, x.d, x.b), me = { s: x.s, t: x.t, p: x.p || 0, w: x.w ? 1 : 0 };
        duel.saveMine(bid, me);
        const c = code.encode(game, x, n), link = c ? code.url(c) : duel.url(game, Object.assign({}, x, { n }));
        const text = "Desafio-te para um duelo de " + g.name + " (" + duel.label(game, x.d) + ") na Sala de Espera. Fiz " + fmtNum(x.s) + " pts (" + duel.line(game, me) + "). Consegues melhor?";
        sendLink("Desafiar", text, link, c, "Manda isto a quem quiseres desafiar. Quem abrir o link, ou escrever o código na app, joga o mesmo tabuleiro.");
      });
    },
    /* Devolver: manda o meu resultado no mesmo tabuleiro a quem me desafiou. */
    giveBack(D, me) {
      const g = gameById(D.g) || {};
      duel.withName(n => {
        const r = duel.cmp(D.g, me, D);
        const x = { d: D.d, b: D.b, s: me.s, t: me.t, p: me.p, w: me.w };
        const c = code.encode(D.g, x, n), link = c ? code.url(c) : duel.url(D.g, Object.assign({ n }, x));
        const text = "Joguei o teu duelo de " + g.name + " (" + duel.label(D.g, D.d) + "): fiz " + fmtNum(me.s) + " pts e tu " + fmtNum(D.s) + ". " + (r > 0 ? "Ganhei eu." : r < 0 ? "Ganhaste tu." : "Empate.") + " Vê o resultado aqui:";
        sendLink("Devolver desafio", text, link, c, "Quem te desafiou vê a comparação ao abrir o link (ou ao escrever o código na app), sem ter de jogar outra vez.");
      });
    }
  };
  const SWORDS = '<svg viewBox="0 0 24 24"><path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6M16 16l4 4M19 21l2-2"/><path d="M14.5 6.5L18 3h3v3l-3.5 3.5"/><path d="M5 14l4 4M7 17l-3 3M3 19l2 2"/></svg>';
  /* No telemóvel abre logo a folha de partilha; no PC mostra o link e o código com Copiar.
     A mensagem leva o link e, quando há, o código para quem tem a app instalada. */
  const codeLine = c => "Na app instalada: Duelo recebido e escreve " + c;
  function sendLink(title, text, link, c, hint) {
    const full = text + "\n" + link + (c ? "\n" + codeLine(c) : "");
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      navigator.share({ text: full }).catch(e => { if (!e || e.name !== "AbortError") showLink(); });
      return;
    }
    showLink();
    function showLink() {
      const box = el("div", { class: "share-prev" });
      box.appendChild(el("p", { class: "hint" }, esc(hint)));
      if (c) box.appendChild(el("div", { class: "duel-code", "aria-label": "Código do duelo" }, esc(c)));
      const inp = el("input", { class: "input duel-link", readonly: true, value: link, "aria-label": "Link do duelo" });
      inp.addEventListener("focus", () => inp.select());
      box.appendChild(inp);
      box.appendChild(el("pre", { class: "share-text" }, esc(full)));
      const acts = [];
      if (navigator.share) acts.push({ label: "Partilhar…", close: false, onClick: () => { navigator.share({ text: full }).catch(() => {}); } });
      if (c) acts.push({ label: "Copiar código", close: false, onClick: () => { copyText(c, "Código copiado."); } });
      acts.push({ label: "Copiar link", close: false, onClick: () => { navigator.clipboard.writeText(link).then(() => toast("Link copiado."), () => { inp.focus(); toast("Seleciona o link e copia-o."); }); } });
      acts.push({ label: "Copiar mensagem", primary: true, close: false, onClick: () => { copyText(full); } });
      modal.open({ title, body: box, className: "share", actions: acts });
    }
  }
  /* Bloco "Tu vs Nome" */
  function duelVs(D, me, r) {
    const side = (who, x, cls) => '<div class="dv ' + cls + '"><small>' + esc(who) + '</small><b>' + fmtNum(x.s) + '<i>pts</i></b><span>' + esc(duel.line(D.g, x)) + "</span></div>";
    return '<div class="duel-vs">' + side("Tu", me, "me" + (r > 0 ? " win" : "")) + '<div class="dv-x" aria-hidden="true">vs</div>' + side(D.n, D, "opp" + (r < 0 ? " win" : "")) + "</div>" +
      '<div class="badge' + (r < 0 ? " muted" : "") + '">' + (r > 0 ? "Ganhaste o duelo" : r < 0 ? "Ganhou " + esc(D.n) : "Empate") + "</div>";
  }
  /* Abrir um link de duelo. Devolve true se o jogo deve começar (senão mostra a comparação ou um erro). */
  function openDuel(game, code) {
    const g = gameById(game);
    const D = g && g.duel ? duel.decode(game, code) : null;
    if (!D || (g.duelOk && !g.duelOk(D))) {
      modal.open({ title: "Link de duelo inválido", body: "<p>Este link está incompleto ou foi alterado. Pede a quem o mandou que o envie outra vez.</p>", actions: [{ label: "Fechar", primary: true }] });
      return null;
    }
    return startDuel(D);
  }
  /* Começar um duelo já lido (de um link ou de um código). */
  function startDuel(D) {
    const game = D.g, g = gameById(game);
    const mine = duel.mine(D.bid);
    if (!mine) return D;
    /* Já joguei este tabuleiro (ou fui eu que desafiei): mostra logo a comparação. */
    /* (o código curto guarda o tempo até 4,5 h, e na Dobra e na Cobra nem o guarda, porque aí não conta) */
    const sameT = !g.duelTime || Math.min(mine.t || 0, 16383) === Math.min(D.t || 0, 16383);
    if (nameKey(D.n) === nameKey(settings.name) && mine.s === D.s && (mine.p || 0) === (D.p || 0) && sameT) {
      modal.open({ title: "Este desafio é teu", body: "<p>É o link que criaste. Manda-o a quem quiseres desafiar: quem o abrir joga o mesmo tabuleiro.</p>", actions: [{ label: "Fechar", primary: true }] });
      return null;
    }
    const { r, fresh } = duel.record(D, mine);
    const box = el("div", { class: "result" });
    box.innerHTML = '<p class="duel-head">' + esc(g.name) + " · " + esc(duel.label(game, D.d)) + "</p>" + duelVs(D, mine, r) +
      '<p class="hint">' + (fresh ? "Resultado guardado nos Rivais." : "Este duelo já estava nos Rivais.") + "</p>";
    modal.open({ title: "Duelo com " + D.n, body: box, actions: [{ label: "Ver rivais", onClick: () => { setTimeout(() => showRanking(null, null, null, "rivals"), 0); } }, { label: "Jogar " + g.name, primary: true, onClick: () => { Sala.go && Sala.go(game); } }] });
    if (fresh && r > 0) { sound.win(); fx.confetti(); }
    return null;
  }
  /* Fim de um jogo de duelo: não entra no ranking nem nas estatísticas, só nos Rivais. */
  function finishDuel(o) {
    const D = o.duel, g = gameById(D.g) || {};
    const me = { s: Math.round(o.score) || 0, t: o.time || 0, p: o.progress || 0, w: o.won === false ? 0 : 1 };
    duel.saveMine(D.bid, me);
    const { r } = duel.record(D, me);
    const box = el("div", { class: "result" });
    box.innerHTML = '<p class="duel-head">' + esc(g.name) + " · " + esc(duel.label(D.g, D.d)) + "</p>" + duelVs(D, me, r) +
      '<div class="breakdown">' + (o.breakdown || []).map(x => '<div><span>' + esc(x[0]) + '</span><span>' + esc(x[1]) + '</span></div>').join("") + "</div>";
    modal.open({
      title: r > 0 ? "Ganhaste o duelo" : r < 0 ? "Duelo perdido" : "Empate",
      body: box,
      actions: [
        { label: "Rivais", onClick: () => { setTimeout(() => showRanking(null, null, null, "rivals"), 0); } },
        { label: "Devolver desafio", primary: true, close: false, onClick: () => { duel.giveBack(D, me); } }
      ]
    });
    if (r > 0) { sound.win(); vibrate([30, 60, 30, 60, 80]); fx.confetti(); } else { sound.line(); vibrate(30); }
    return { pos: 0, id: null };
  }

  /* ---------- Duelo recebido e página de passagem (Fase 6.1) ---------- */
  /* A correr como app instalada (ecrã próprio, sem barra do browser)? */
  const standalone = () => { try { return matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: fullscreen)").matches || navigator.standalone === true; } catch (e) { return false; } };
  /* Hash a abrir para um duelo: o código curto, se der; senão o próprio link. */
  const duelHash = (D, raw) => { const c = code.encode(D.g, D, D.n); return c ? "#/d/" + code.url(c).split("#/d/")[1] : raw; };
  /* Janela "Duelo recebido": campo para escrever ou colar o código (ou o link inteiro). open(hash) abre o duelo. */
  function duelInbox(open) {
    const box = el("div", { class: "duel-in-box" });
    box.appendChild(el("p", { class: "hint" }, "Escreve ou cola o código que te mandaram, com o nome no fim. Também aceita o link inteiro."));
    const lab = el("label", { for: "duel-code-in", class: "lbl" }, "Código do duelo");
    const inp = el("input", { id: "duel-code-in", class: "input duel-code-in", type: "text", autocomplete: "off", autocapitalize: "characters", autocorrect: "off", spellcheck: "false", enterkeyhint: "go", placeholder: "SUD-K7F3-QX9M-2TAB-Rui", "aria-describedby": "duel-code-msg" });
    const err = el("p", { id: "duel-code-msg", class: "msg bad", role: "alert" });
    box.append(lab, inp, err);
    const go = () => {
      const v = inp.value.trim();
      if (!v) { err.textContent = "Escreve o código primeiro."; inp.focus(); return false; }
      const r = code.decode(v);
      if (r.err) { err.textContent = r.err; inp.focus(); vibrate(30); return false; }
      const raw = (v.match(/#\/(?:d|duelo)\/.+$/) || [""])[0];
      modal.close(true); open(duelHash(r.D, raw)); return false;
    };
    inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); go(); } });
    inp.addEventListener("input", () => { err.textContent = ""; });
    const acts = [];
    if (navigator.clipboard && navigator.clipboard.readText) acts.push({ label: "Colar", close: false, onClick: () => { navigator.clipboard.readText().then(t => { inp.value = t.trim(); err.textContent = ""; inp.focus(); }).catch(() => { inp.focus(); toast("Cola o código no campo."); }); } });
    acts.push({ label: "Abrir duelo", primary: true, close: false, onClick: go });
    modal.open({ title: "Duelo recebido", body: box, className: "duel-in", actions: acts });
    setTimeout(() => { try { inp.focus(); } catch (e) {} }, 60);
  }
  /* Página de passagem: o link abriu no browser e não na app instalada (no iPhone é sempre assim,
     e o browser guarda os jogos à parte). Dá o código para levar para a app, ou deixa jogar aqui. */
  function duelPass(D, here) {
    const c = code.encode(D.g, D, D.n), g = gameById(D.g) || {};
    const box = el("div", { class: "duel-pass" });
    box.appendChild(el("p", { class: "duel-head" }, esc(g.name || D.g) + " · " + esc(duel.label(D.g, D.d)) + " · desafio de " + esc(D.n)));
    box.appendChild(el("p", {}, "Os links abrem no browser, que guarda os jogos e os Rivais à parte da app. Para este duelo ficar na app, copia o " + (c ? "código" : "link") + ", abre a Sala de Espera instalada e toca em <b>Duelo recebido</b>."));
    if (c) box.appendChild(el("div", { class: "duel-code", "aria-label": "Código do duelo" }, esc(c)));
    const chk = el("label", { class: "check" }, '<input type="checkbox" id="duel-pass-off"> <span>Não voltar a perguntar neste browser</span>');
    box.appendChild(chk);
    const off = () => { if (box.querySelector("#duel-pass-off").checked) store.set("duelPass:off", true); };
    modal.open({
      title: "Tens a Sala de Espera instalada?", body: box, className: "duel-pass-m", onClose: off,
      actions: [
        { label: "Jogar aqui", onClick: () => { off(); setTimeout(here, 0); } },
        { label: c ? "Copiar o código" : "Copiar o link", primary: true, close: false, onClick: () => { off(); copyText(c || location.href, (c ? "Código" : "Link") + " copiado. Abre a app e toca em Duelo recebido."); } }
      ]
    });
  }
  const needPass = () => !standalone() && !store.get("duelPass:off", false);

  /* ---------- Fim de jogo: pontuação, ranking e janela de resultado ---------- */
  function finish(o) {
    /* o: { game, diff, diffLabel, title, score, time, breakdown:[[rótulo, valor]], extra, onNew,
            won (false = jogo perdido ou terminado), daily (data do desafio), practice (repetição que não conta),
            share: { text, lines, grid },
            duel (jogo de duelo, com progress para o desempate), challenge: { d, b, p } (dá para desafiar com este tabuleiro) } */
    if (o.duel) return finishDuel(o);
    const g = gameById(o.game) || {}, won = o.won !== false, unit = o.unit || "pts";
    const counts = !o.practice;
    const res = counts && o.score > 0 ? ranking.add(o.game, o.daily ? "dia" : o.diff, { name: settings.name || "Eu", score: o.score, time: o.time, extra: Object.assign({}, o.extra || {}, o.daily ? { day: o.daily } : {}) }) : { pos: 0, id: null };
    if (counts && !o.noStats) stats.record(o.game, o.daily ? "dia" : o.diff, { won: g.statsKind === "score" ? undefined : won, time: o.time, score: o.score });
    if (o.daily && counts) daily.save(o.game, { date: o.daily, won, score: o.score, time: o.time, extra: o.extra || null });
    /* Ranking online (js/online.js, Fase 8): só se o jogador o ligou; o servidor repete as jogadas (o.online). */
    if (counts && o.online && Sala.online) Sala.online.submit(o);
    const box = el("div", { class: "result" });
    let html = '<div class="big">' + fmtNum(o.score) + '<small>' + esc(unit) + '</small></div>';
    if (o.practice) html += '<div class="badge muted">Repetição · não conta</div>';
    else if (o.daily) html += '<div class="badge">Desafio do dia · ' + esc(daily.label(o.daily)) + (res.pos === 1 ? " · o teu melhor" : "") + '</div>';
    else if (res.pos === 1) html += '<div class="badge">Novo recorde · ' + esc(o.diffLabel) + '</div>';
    else if (res.pos) html += '<div class="badge">' + res.pos + '.º lugar · ' + esc(o.diffLabel) + '</div>';
    html += '<div class="breakdown">' + (o.breakdown || []).map(r => '<div><span>' + esc(r[0]) + '</span><span>' + esc(r[1]) + '</span></div>').join("") +
      '<div class="total"><span>Total</span><span>' + fmtNum(o.score) + ' ' + esc(unit) + '</span></div></div>';
    box.innerHTML = html;
    let nameInput = null;
    if (res.pos && !settings.name) {
      const f = el("div", { class: "field col" }, '<label for="res-name">O teu nome no ranking</label>');
      nameInput = el("input", { id: "res-name", class: "input", maxlength: "16", autocomplete: "nickname", placeholder: "Por exemplo: Rui" });
      f.appendChild(nameInput); box.appendChild(f);
    }
    const saveName = () => {
      if (!nameInput) return;
      const n = nameInput.value.trim().slice(0, 16);
      if (n) { setSetting("name", n); ranking.rename(res.id, n); }
      nameInput = null;
    };
    /* Partilhar (a imagem começa a ser feita já, para o botão responder logo) */
    const sd = shareData(o, g, won);
    const card = shareImage(sd);
    const bShare = el("button", { class: "btn block share-btn", type: "button" }, ui.ICON.share + "Partilhar resultado");
    bShare.onclick = () => { saveName(); share(sd, card); };
    if (o.challenge && g.duel && !o.daily) {
      /* Desafiar alguém para o mesmo tabuleiro */
      const bDuel = el("button", { class: "btn block share-btn", type: "button" }, SWORDS + "Desafiar");
      bDuel.onclick = () => { saveName(); duel.challenge(o.game, { d: o.challenge.d, b: o.challenge.b, s: o.score, t: o.time, p: o.challenge.p || 0, w: won }); };
      const pair = el("div", { class: "res-btns" }); pair.append(bShare, bDuel); box.appendChild(pair);
    } else box.appendChild(bShare);
    modal.open({
      title: o.title || "Ganhaste",
      body: box,
      onClose: saveName,
      actions: [
        { label: o.daily ? "Estatísticas" : "Ver ranking", onClick: () => { saveName(); setTimeout(() => showRanking(o.game, o.daily ? "dia" : o.diff, res.id, o.daily ? "stats" : "rank"), 0); } },
        { label: o.newLabel || "Novo jogo", primary: true, onClick: () => { saveName(); o.onNew && o.onNew(); } }
      ]
    });
    if (won) {
      if (res.pos === 1) { sound.win(); vibrate([30, 60, 30, 60, 80]); } else { sound.win(); vibrate([30, 60, 60]); }
      fx.confetti();
    } else { sound.line(); vibrate(30); }
    return res;
  }
  /* Texto e linhas da partilha, com o que cada jogo quiser acrescentar. */
  function shareData(o, g, won) {
    const s = o.share || {}, name = g.name || o.game, unit = o.unit || "pts";
    const title = s.title || (o.daily ? name + " do dia" : name);
    const sub = s.sub || (o.daily ? "Desafio de " + daily.label(o.daily) : o.diffLabel);
    const lines = s.lines || [(won ? "" : (s.lost || "Sem vitória") + " · ") + "Tempo " + fmtTime(o.time)];
    const head = "Sala de Espera · " + title + (o.daily ? " " + daily.label(o.daily) : " (" + o.diffLabel + ")");
    const text = s.text || (head + "\n" + fmtNum(o.score) + " " + unit + " · " + lines.join(" · ") + "\n" + SITE);
    return { title, sub, big: fmtNum(o.score), unit, lines, grid: s.grid || null, text };
  }

  /* ---------- Janela de ranking e estatísticas ---------- */
  function showRanking(gameId, diff, highlightId, view) {
    /* Jogos que partilham ranking (o casino) aparecem uma só vez, com o nome do grupo. */
    const ready = games.filter(x => (x.ready && !x.rankAs) || x.rankable);
    const asked = gameById(gameId);
    if (asked && asked.rankAs) gameId = asked.rankAs;
    let g = gameById(gameId) || ready[0];
    let mode = view === "stats" ? "stats" : "rank";
    const DIA = { id: "dia", label: "Do dia" }, ALL = { id: "*", label: "Todas" };
    const OL = Sala.online, olOk = x => !!(OL && OL.supports(x.id));
    /* No separador Online, só os modos que o servidor sabe confirmar (js/online.js). */
    const olDiffs = () => { const m = OL ? OL.modes(g.id) : []; return g.diffs.filter(x => m.includes(x.id)).concat(m.includes("dia") && !g.diffs.some(x => x.id === "dia") ? [DIA] : []); };
    const diffsOf = () => mode === "online" ? olDiffs() : (mode === "stats" && g.diffs.length > 1 ? [ALL] : []).concat(g.diffs, g.daily && !g.diffs.some(x => x.id === "dia") ? [DIA] : []);
    /* Jogos com modos (a Cobra: com ou sem paredes) guardam o ranking em "dificuldade + sufixo do modo". */
    const split = k => {
      if (!g.rankModes || k === "dia" || k === "*") return [k, g.rankModes ? g.rankModes[0].id : null];
      const m = g.rankModes.find(x => x.suffix && k.endsWith(x.suffix)) || g.rankModes.find(x => !x.suffix) || g.rankModes[0];
      return [m.suffix ? k.slice(0, -m.suffix.length) : k, m.id];
    };
    let [d, mo] = split(diff || (g && g.lastDiff && g.lastDiff()) || g.diffs[0].id);
    const key = () => g.rankModes && d !== "dia" && d !== "*" ? d + (g.rankModes.find(x => x.id === mo) || g.rankModes[0]).suffix : d;
    if (view === "rivals") mode = "rivals";
    const box = el("div");
    if (view === "online" && OL) mode = "online";
    const tabs = ui.seg([{ id: "rank", label: "Ranking" }].concat(OL ? [{ id: "online", label: "Online" }] : [], [{ id: "stats", label: "Estatísticas" }, { id: "rivals", label: "Rivais" }]), mode, id => {
      mode = id;
      if (mode === "online" && !gameId && !olOk(g)) { g = ready.find(olOk) || g; mo = g.rankModes ? g.rankModes[0].id : null; }
      if (mode !== "rivals" && !diffsOf().some(x => x.id === d)) d = (diffsOf()[0] || g.diffs[0]).id;
      draw();
    }, "Ver");
    tabs.classList.add("tabs");
    const filters = el("div", { class: "rank-filters" });
    const table = el("div");
    const draw = () => {
      filters.innerHTML = "";
      if (mode === "rivals") { drawRivals(); return; }
      if (!gameId) { const sg = ui.seg(ready.filter(x => mode !== "online" || olOk(x)).map(x => ({ id: x.id, label: x.name })), g.id, id => { g = gameById(id); if (!diffsOf().some(x => x.id === d)) d = g.diffs[0].id; mo = g.rankModes ? g.rankModes[0].id : null; draw(); }, "Jogo"); sg.classList.add("wrap"); filters.appendChild(sg); }
      const ds = diffsOf();
      if (ds.length > 1) { const sd = ui.seg(ds, d, id => { d = id; draw(); }, "Dificuldade"); if (ds.length > 3) sd.classList.add("wrap"); filters.appendChild(sd); }
      if (g.rankModes && d !== "dia" && d !== "*" && mode !== "online") filters.appendChild(ui.seg(g.rankModes, mo, id => { mo = id; drawTable(); }, "Modo"));
      drawTable();
    };
    const drawTable = () => mode === "stats" ? drawStats() : mode === "rivals" ? drawRivals() : mode === "online" ? drawOnline() : drawRank();
    const drawOnline = () => {
      if (!olOk(g)) { table.innerHTML = '<p class="empty">' + esc(g.name) + " ainda não tem ranking online: o servidor só aceita jogos cujos pontos consegue confirmar.</p>"; return; }
      OL.drawRanking(table, g, d);
    };
    /* Rivais: vitórias, derrotas e empates por nome, e os últimos duelos (de todos os jogos). */
    const drawRivals = () => {
      const all = duel.data(), list = Object.values(all.rivals).sort((a, b) => (b.w + b.l + b.e) - (a.w + a.l + a.e) || (b.last || 0) - (a.last || 0));
      if (!list.length) { table.innerHTML = '<p class="empty">Ainda não tens rivais.<br>No fim de um jogo, toca em <b>Desafiar</b> e manda o link a alguém.</p>'; return; }
      const res = r => r > 0 ? '<span class="dr win">Ganhaste</span>' : r < 0 ? '<span class="dr">Perdeste</span>' : '<span class="dr">Empate</span>';
      table.innerHTML = '<table class="rank rivals"><thead><tr><th>Rival</th><th class="pts">V</th><th class="pts">D</th><th class="pts">E</th></tr></thead><tbody>' +
        list.slice(0, 20).map(x => "<tr><td>" + esc(x.name) + '</td><td class="pts">' + x.w + '</td><td class="pts">' + x.l + '</td><td class="pts">' + x.e + "</td></tr>").join("") + "</tbody></table>" +
        '<h4 class="duel-recent-h">Últimos duelos</h4><ul class="duel-recent">' + all.recent.slice(0, 10).map(x => {
          const gg = gameById(x.g);
          return "<li><span><b>" + esc(gg ? gg.name : x.g) + "</b> com " + esc(x.n) + "<small>" + fmtNum(x.me) + " vs " + fmtNum(x.opp) + " pts · " + esc(daily.label(ymd(new Date(x.at)))) + "</small></span>" + res(x.r) + "</li>";
        }).join("") + "</ul>" + '<p class="hint st-note">Os duelos não contam para o ranking nem para as estatísticas.</p>';
    };
    const drawRank = () => {
      const l = ranking.list(g.id, key()), isDay = d === "dia";
      if (!l.length) { table.innerHTML = '<p class="empty">' + (isDay ? "Ainda não fizeste nenhum desafio do dia.<br>O de hoje está à espera no menu." : (g.emptyText || "Ainda não há pontuações nesta dificuldade.<br>A primeira é tua.")) + "</p>"; return; }
      table.innerHTML = '<table class="rank"><thead><tr><th>#</th><th>' + (isDay ? "Dia" : "Nome") + '</th><th>Tempo</th><th class="pts">' + esc(g.unitLabel || "Pontos") + '</th></tr></thead><tbody>' +
        l.map((e, i) => '<tr' + (e.id === highlightId ? ' class="me"' : "") + '><td class="pos">' + (i + 1) + '</td><td>' + esc(isDay ? daily.label((e.extra && e.extra.day) || e.date.slice(0, 10)) : e.name) + '</td><td>' + fmtTime(e.time) + '</td><td class="pts">' + fmtNum(e.score) + '</td></tr>').join("") +
        '</tbody></table>';
    };
    const drawStats = () => {
      const b = stats.get(g.id, key());
      if (!b || !b.played) { table.innerHTML = '<p class="empty">Ainda não há jogos registados aqui.<br>As estatísticas contam a partir desta versão.</p>'; return; }
      const unit = " " + (g.unitLabel ? g.unitLabel.toLowerCase() : "pts");
      const cells = g.statsKind === "score"
        ? [["Jogos", fmtNum(b.played)], ["Melhor", fmtNum(b.sBest) + unit], ["Média", fmtNum(b.sSum / b.played) + unit], ["Tempo de jogo", fmtTime(b.tAll)]]
        : [["Jogos", fmtNum(b.played)], ["Vitórias", fmtNum(b.won) + " · " + Math.round(100 * b.won / b.played) + " %"],
           ["Sequência", fmtNum(b.streak)], ["Melhor sequência", fmtNum(b.best)],
           ["Tempo médio", b.tN ? fmtTime(b.tSum / b.tN) : "—"], ["Melhor tempo", b.tBest ? fmtTime(b.tBest) : "—"]];
      table.innerHTML = '<div class="st-grid">' + cells.map(c => '<div class="stat"><small>' + esc(c[0]) + "</small><b>" + esc(c[1]) + "</b></div>").join("") + "</div>" +
        (g.statsKind === "score" ? "" : '<p class="hint st-note">A sequência são vitórias seguidas; desistir de um jogo começado também a quebra.</p>');
    };
    box.append(tabs, filters, table);
    draw();
    modal.open({ title: gameId ? g.name : "Ranking e estatísticas", body: box });
  }

  /* ---------- Janela de ajuda ---------- */
  function showHelp(gameId) {
    const g = gameById(gameId); if (!g) return;
    let html = g.help();
    /* Nota comum a todos os jogos com duelo: o código para a app instalada (Fase 6.1). */
    if (g.code) { const i = html.indexOf("<h4>Duelo</h4>"), j = i < 0 ? -1 : html.indexOf("</p>", i); if (j > 0) html = html.slice(0, j + 4) + "<p>A mensagem do duelo leva também um código curto (por exemplo, <b>" + g.code.pre + "-…-Nome</b>). Se tiveres a app instalada, toca em <b>Duelo recebido</b>, no menu, e escreve ou cola o código: no iPhone os links abrem sempre no Safari, que guarda os jogos à parte da app.</p>" + html.slice(j + 4); }
    modal.open({ title: "Como jogar · " + g.name, body: html, className: "help", actions: [{ label: "Percebido", primary: true }] });
  }

  /* ---------- Janela de definições ---------- */
  function showSettings() {
    const box = el("div");
    const fTheme = el("div", { class: "field col" }, '<span class="lbl">Tema</span>');
    fTheme.appendChild(ui.seg([{ id: "auto", label: "Automático" }, { id: "light", label: "Claro" }, { id: "dark", label: "Escuro" }], settings.theme, v => setSetting("theme", v), "Tema"));
    box.appendChild(fTheme);
    const fAnim = el("div", { class: "field col" }, '<span class="lbl">Animações<small>"Automáticas" segue a opção de reduzir movimento do sistema.</small></span>');
    fAnim.appendChild(ui.seg([{ id: "auto", label: "Automáticas" }, { id: "always", label: "Sempre" }, { id: "reduced", label: "Reduzidas" }], settings.anim, v => setSetting("anim", v), "Animações"));
    box.appendChild(fAnim);
    const sw = (key, label, small) => {
      const f = el("div", { class: "field" }, '<div><span class="lbl" id="lbl-' + key + '">' + label + '</span>' + (small ? "<small>" + small + "</small>" : "") + "</div>");
      const b = el("button", { class: "switch", role: "switch", "aria-checked": String(!!settings[key]), "aria-labelledby": "lbl-" + key });
      b.onclick = () => { const v = !settings[key]; setSetting(key, v); b.setAttribute("aria-checked", String(v)); if (key === "sound" && v) sound.place(); if (key === "vibrate" && v) vibrate(30); };
      f.appendChild(b); box.appendChild(f);
    };
    sw("sound", "Sons");
    sw("vibrate", "Vibração", "No iPhone é só um toque leve e pode não funcionar em todos os modelos.");
    const fName = el("div", { class: "field col" }, '<label for="set-name">Nome no ranking</label>');
    const inp = el("input", { id: "set-name", class: "input", maxlength: "16", autocomplete: "nickname", placeholder: "Por exemplo: Rui", value: settings.name });
    inp.addEventListener("change", () => setSetting("name", inp.value.trim().slice(0, 16)));
    fName.appendChild(inp); box.appendChild(fName);
    /* Levar o progresso (js/backup.js) */
    if (Sala.backup) box.appendChild(Sala.backup.settingsField());
    /* Ranking online (js/online.js, Fase 8) */
    if (Sala.online) box.appendChild(Sala.online.settingsField());
    /* Versão e atualizações (preenchido pelo app.js) */
    const U = Sala.updates;
    if (U && U.supported) {
      const fUpd = el("div", { class: "field" }, '<div><span class="lbl">Versão</span><small id="set-ver">…</small></div>');
      const bUpd = el("button", { class: "btn", type: "button" }, "Procurar atualizações");
      bUpd.onclick = async () => {
        bUpd.disabled = true; bUpd.textContent = "A procurar…";
        const r = await U.check();
        bUpd.disabled = false; bUpd.textContent = "Procurar atualizações";
        if (r === "latest") toast("Já tens a versão mais recente.");
        else if (r === "offline") toast("Sem ligação à internet. Tenta mais tarde.");
        else if (r === "new") modal.close(); /* a barra "Atualizar" já está à vista */
        else toast("Este browser não deixa procurar atualizações.");
      };
      fUpd.appendChild(bUpd); box.appendChild(fUpd);
      U.version().then(v => { const n = document.getElementById("set-ver"); if (n) n.textContent = v ? "Versão " + String(v).replace(/^sala-v/, "") : "Sem modo offline nesta página"; });
    }
    modal.open({ title: "Definições", body: box, onClose: () => setSetting("name", inp.value.trim().slice(0, 16)), actions: [{ label: "Fechar", primary: true }] });
  }

  window.Sala = { duel, openDuel, startDuel, duelCode: code, duelInbox, duelPass, needPass, standalone, $, el, esc, fmtTime, fmtNum, shuffle, clamp, rng, SITE, store, settings, setSetting, motion, sound, vibrate, toast, modal, fx, ranking, daily, stats, share, shareImage, copyText, registerGame, games, gameById, ui, finish, showRanking, showHelp, showSettings };
})();
