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
  const shuffle = (a, rnd) => { rnd = rnd || Math.random; for (let i = a.length - 1; i > 0; i--) { const j = rnd() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  /* Gerador com semente: a mesma frase dá sempre a mesma sequência, em qualquer aparelho. */
  function rng(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
    let a = h >>> 0;
    return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const SITE = "https://nydro-dev.github.io/sala-de-espera/";

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
    if (meta) meta.content = getComputedStyle(root).getPropertyValue("--bg").trim() || "#F2F2F3";
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
  function vibrate(p) { if (!settings.vibrate || !navigator.vibrate) return; try { navigator.vibrate(p); } catch (e) {} }

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
      const cols = ["#09B5FF", "#FFC301", "#B8B8B8", "#FFFFFF", "#09B5FF", "#FFC301"];
      for (let i = 0; i < 160; i++) {
        const left = i % 2 === 0;
        parts.push({ x: left ? -10 : innerWidth + 10, y: innerHeight * (.55 + Math.random() * .3), vx: (left ? 1 : -1) * (4 + Math.random() * 8), vy: -(9 + Math.random() * 9), g: .28, vr: (Math.random() - .5) * .4, rot: Math.random() * 6, s: 7 + Math.random() * 7, c: cols[i % cols.length], life: 130 + Math.random() * 60 });
      }
      fxStart();
    },
    burst(x, y) {
      if (!motion()) return;
      const cols = ["#FFC301", "#FF7B2E", "#E8352E", "#1A181D", "#B8B8B8"];
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
  const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const daily = {
    today,
    GAMES: ["sudoku", "minas", "soli"],
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

  /* ---------- Partilhar: texto e imagem nas cores da casa ---------- */
  /* d: { title, sub, big, unit, lines: [texto], grid: [[0 | 1 | 2]], text } */
  async function shareImage(d) {
    try { if (document.fonts) await Promise.race([Promise.all([document.fonts.load("900 100px Roboto"), document.fonts.load("500 40px Roboto")]), new Promise(r => setTimeout(r, 900))]); } catch (e) {}
    const W = 1080, H = 1080, c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d"), F = (w, s) => w + " " + s + 'px Roboto, "Segoe UI", system-ui, sans-serif';
    const rr = (px, py, w, h, r) => { x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); };
    const fit = (txt, w, size, max) => { x.font = F(w, size); while (size > 24 && x.measureText(txt).width > max) { size -= 4; x.font = F(w, size); } return size; };
    x.fillStyle = "#1A181D"; x.fillRect(0, 0, W, H);
    x.fillStyle = "#09B5FF"; x.fillRect(0, 0, W, 14);
    /* Marca: grelha de 3×3 com a casa do meio azul e uma bola amarela */
    const M = 80, sq = 26, gp = 7;
    x.fillStyle = "#2C2931"; rr(M, 64, sq * 3 + gp * 2 + 28, sq * 3 + gp * 2 + 28, 20); x.fill();
    for (let k = 0; k < 9; k++) {
      const px = M + 14 + (k % 3) * (sq + gp), py = 78 + ((k / 3) | 0) * (sq + gp);
      x.fillStyle = k === 4 ? "#09B5FF" : "#4A4552"; rr(px, py, sq, sq, 6); x.fill();
      if (k === 8) { x.fillStyle = "#FFC301"; x.beginPath(); x.arc(px + sq / 2, py + sq / 2, 9, 0, 6.29); x.fill(); }
    }
    x.textBaseline = "alphabetic"; x.fillStyle = "#F1F1F2"; x.font = F(900, 44); x.fillText("Sala de Espera", 222, 118);
    x.fillStyle = "#B8B8B8"; x.font = F(400, 28); x.fillText("Jogos curtos para os intervalos", 222, 160);
    /* Jogo e etiqueta */
    let y = 320;
    x.fillStyle = "#F1F1F2"; fit(d.title, 900, 92, W - 2 * M); x.fillText(d.title, M, y);
    if (d.sub) {
      x.font = F(700, 34); const tw = x.measureText(d.sub).width;
      x.fillStyle = "#FFC301"; rr(M, y + 32, tw + 44, 60, 30); x.fill();
      x.fillStyle = "#1A181D"; x.fillText(d.sub, M + 22, y + 74);
    }
    y += d.grid ? 230 : 330;
    /* Pontuação grande */
    const bs = d.grid ? 150 : 210;
    x.fillStyle = "#FFC301"; const bsz = fit(d.big, 900, bs, (d.grid ? 520 : W - 2 * M) - 160); x.fillText(d.big, M, y);
    if (d.unit) { const bw = x.measureText(d.big).width; x.fillStyle = "#B8B8B8"; x.font = F(700, Math.round(bsz * .27)); x.fillText(d.unit, M + bw + 18, y); }
    y += 72;
    x.fillStyle = "#F1F1F2";
    const lw = d.grid ? 500 : W - 2 * M;
    (d.lines || []).slice(0, 4).forEach(l => { fit(l, 500, 40, lw); x.fillText(l, M, y); y += 56; });
    if (d.grid) {
      const n = d.grid[0] ? d.grid[0].length : 5, cs = 62, g2 = 10, gx = W - M - n * cs - (n - 1) * g2;
      let gy = 430;
      const col = ["#4A4552", "#FFC301", "#09B5FF"];
      d.grid.forEach(row => { row.forEach((v, k) => { x.fillStyle = col[v] || col[0]; rr(gx + k * (cs + g2), gy, cs, cs, 10); x.fill(); }); gy += cs + g2; });
    }
    x.fillStyle = "#3A3640"; x.fillRect(M, H - 110, W - 2 * M, 2);
    x.fillStyle = "#4DCBFF"; x.font = F(500, 32); x.fillText(SITE.replace(/^https:\/\//, "").replace(/\/$/, ""), M, H - 58);
    return new Promise(res => { try { c.toBlob(b => res(b), "image/png"); } catch (e) { res(null); } });
  }
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); toast("Texto copiado. Já o podes colar numa mensagem."); }
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

  /* ---------- Fim de jogo: pontuação, ranking e janela de resultado ---------- */
  function finish(o) {
    /* o: { game, diff, diffLabel, title, score, time, breakdown:[[rótulo, valor]], extra, onNew,
            won (false = jogo perdido ou terminado), daily (data do desafio), practice (repetição que não conta),
            share: { text, lines, grid } } */
    const g = gameById(o.game) || {}, won = o.won !== false, unit = o.unit || "pts";
    const counts = !o.practice;
    const res = counts && o.score > 0 ? ranking.add(o.game, o.daily ? "dia" : o.diff, { name: settings.name || "Eu", score: o.score, time: o.time, extra: Object.assign({}, o.extra || {}, o.daily ? { day: o.daily } : {}) }) : { pos: 0, id: null };
    if (counts && !o.noStats) stats.record(o.game, o.daily ? "dia" : o.diff, { won: g.statsKind === "score" ? undefined : won, time: o.time, score: o.score });
    if (o.daily && counts) daily.save(o.game, { date: o.daily, won, score: o.score, time: o.time, extra: o.extra || null });
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
    box.appendChild(bShare);
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
    const diffsOf = () => (mode === "stats" && g.diffs.length > 1 ? [ALL] : []).concat(g.diffs, g.daily ? [DIA] : []);
    /* Jogos com modos (a Cobra: com ou sem paredes) guardam o ranking em "dificuldade + sufixo do modo". */
    const split = k => {
      if (!g.rankModes || k === "dia" || k === "*") return [k, g.rankModes ? g.rankModes[0].id : null];
      const m = g.rankModes.find(x => x.suffix && k.endsWith(x.suffix)) || g.rankModes.find(x => !x.suffix) || g.rankModes[0];
      return [m.suffix ? k.slice(0, -m.suffix.length) : k, m.id];
    };
    let [d, mo] = split(diff || (g && g.lastDiff && g.lastDiff()) || g.diffs[0].id);
    const key = () => g.rankModes && d !== "dia" && d !== "*" ? d + (g.rankModes.find(x => x.id === mo) || g.rankModes[0]).suffix : d;
    const box = el("div");
    const tabs = ui.seg([{ id: "rank", label: "Ranking" }, { id: "stats", label: "Estatísticas" }], mode, id => { mode = id; if (!diffsOf().some(x => x.id === d)) d = g.diffs[0].id; draw(); }, "Ver");
    tabs.classList.add("tabs");
    const filters = el("div", { class: "rank-filters" });
    const table = el("div");
    const draw = () => {
      filters.innerHTML = "";
      if (!gameId) { const sg = ui.seg(ready.map(x => ({ id: x.id, label: x.name })), g.id, id => { g = gameById(id); if (!diffsOf().some(x => x.id === d)) d = g.diffs[0].id; mo = g.rankModes ? g.rankModes[0].id : null; draw(); }, "Jogo"); sg.classList.add("wrap"); filters.appendChild(sg); }
      const ds = diffsOf();
      if (ds.length > 1) { const sd = ui.seg(ds, d, id => { d = id; draw(); }, "Dificuldade"); if (ds.length > 3) sd.classList.add("wrap"); filters.appendChild(sd); }
      if (g.rankModes && d !== "dia" && d !== "*") filters.appendChild(ui.seg(g.rankModes, mo, id => { mo = id; drawTable(); }, "Modo"));
      drawTable();
    };
    const drawTable = () => mode === "stats" ? drawStats() : drawRank();
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
    modal.open({ title: "Como jogar · " + g.name, body: g.help(), className: "help", actions: [{ label: "Percebido", primary: true }] });
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
    sw("vibrate", "Vibração", "Só funciona em Android.");
    const fName = el("div", { class: "field col" }, '<label for="set-name">Nome no ranking</label>');
    const inp = el("input", { id: "set-name", class: "input", maxlength: "16", autocomplete: "nickname", placeholder: "Por exemplo: Rui", value: settings.name });
    inp.addEventListener("change", () => setSetting("name", inp.value.trim().slice(0, 16)));
    fName.appendChild(inp); box.appendChild(fName);
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

  window.Sala = { $, el, esc, fmtTime, fmtNum, shuffle, clamp, rng, SITE, store, settings, setSetting, motion, sound, vibrate, toast, modal, fx, ranking, daily, stats, share, shareImage, copyText, registerGame, games, gameById, ui, finish, showRanking, showHelp, showSettings };
})();
