/* Sala de Espera — ilustrações grandes dos cartões do menu (uma por jogo).
   Desenho 160×110. Os puzzles e a arcada usam as variáveis do tema; o casino tem fundo
   sempre escuro, por isso usa cores fixas. */
(function () {
  "use strict";
  const F = 'font-family="Roboto,system-ui,sans-serif" text-anchor="middle"';
  const svg = body => '<svg viewBox="0 0 160 110" aria-hidden="true" focusable="false">' + body + "</svg>";
  const txt = (x, y, s, size, fill, w) => '<text x="' + x + '" y="' + y + '" font-size="' + size + '" font-weight="' + (w || 900) + '" fill="' + fill + '" ' + F + ">" + s + "</text>";
  /* Naipes desenhados (não dependem da fonte), centrados em 0,0, com cerca de 10 de altura. */
  const HEART = "M0 4.2C-3.4 1.4-5.6-.4-5.6-2.6A2.8 2.8 0 0 1 0-3.6 2.8 2.8 0 0 1 5.6-2.6C5.6-.4 3.4 1.4 0 4.2Z";
  const SPADE = "M0-4.6C-3.4-1.8-5.6 0-5.6 2.1A2.7 2.7 0 0 0-.7 3.6L-1.7 5.6H1.7L.7 3.6A2.7 2.7 0 0 0 5.6 2.1C5.6 0 3.4-1.8 0-4.6Z";
  const suit = (d, x, y, s, fill) => '<path d="' + d + '" fill="' + fill + '" transform="translate(' + x + " " + y + ") scale(" + s + ')"/>';

  /* Carta virada para cima: canto com o valor e naipe grande ao centro. */
  function card(x, y, w, h, rank, red, rot, face) {
    const ink = red ? (face ? "#C0262D" : "var(--bad)") : (face ? "#14213D" : "var(--ink)");
    const bg = face ? "#FFFFFF" : "var(--surface)";
    const line = face ? "#14213D" : "var(--ink)";
    return '<g transform="rotate(' + (rot || 0) + " " + (x + w / 2) + " " + (y + h / 2) + ')">' +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="6" fill="' + bg + '" stroke="' + line + '" stroke-width="1.6"/>' +
      txt(x + 10, y + 16, rank, 13, ink) + suit(red ? HEART : SPADE, x + 10, y + 26, .85, ink) +
      suit(red ? HEART : SPADE, x + w / 2 + 2, y + h / 2 + 8, 2.2, ink) + "</g>";
  }

  /* ---------- Puzzles ---------- */
  function sudoku() {
    let s = '<g transform="rotate(-6 82 56)">';
    s += '<rect x="35" y="8" width="96" height="96" rx="9" fill="var(--surface)" stroke="var(--ink)" stroke-width="3.2"/>';
    s += '<path d="M67 9v94M99 9v94M36 40h94M36 72h94" stroke="var(--ink)" stroke-width="1.4" opacity=".3"/>';
    s += '<rect x="67" y="40" width="32" height="32" fill="var(--blue)"/>';
    s += txt(51, 31, "5", 20, "var(--ink)", 700) + txt(83, 63, "7", 20, "var(--on-blue)", 700) + txt(115, 95, "8", 20, "var(--blue-ink)", 700);
    s += txt(51, 95, "9", 20, "var(--ink)", 700) + txt(115, 31, "1", 20, "var(--blue-ink)", 700);
    /* notas a lápis numa casa */
    s += txt(106, 51, "2", 8, "var(--muted)", 500) + txt(115, 51, "4", 8, "var(--muted)", 500) + txt(124, 51, "6", 8, "var(--muted)", 500) + txt(106, 66, "9", 8, "var(--muted)", 500);
    s += "</g>";
    /* lápis amarelo encostado */
    s += '<g transform="rotate(38 26 70)"><rect x="18" y="40" width="12" height="44" rx="2" fill="var(--yellow)" stroke="var(--ink)" stroke-width="1.6"/><path d="M18 84l6 11 6-11z" fill="var(--surface)" stroke="var(--ink)" stroke-width="1.6" stroke-linejoin="round"/><path d="M22.2 91.5l1.8 3.5 1.8-3.5z" fill="var(--ink)"/><rect x="18" y="40" width="12" height="7" rx="2" fill="var(--blue)" stroke="var(--ink)" stroke-width="1.6"/></g>';
    return svg(s);
  }

  function minas() {
    /* 5×3 casas: T tapada, F bandeira, número aberta, "" aberta vazia */
    const B = [["T", "T", "T", "F", "T"], ["1", "2", "T", "T", "T"], ["", "1", "2", "3", "T"]];
    const NC = { 1: "var(--n1)", 2: "var(--n2)", 3: "var(--n3)" };
    const cs = 26, gap = 3, x0 = 9, y0 = 13;
    let s = '<rect x="' + (x0 - 4) + '" y="' + (y0 - 4) + '" width="' + (5 * cs + 4 * gap + 8) + '" height="' + (3 * cs + 2 * gap + 8) + '" rx="9" fill="#14213D"/>';
    B.forEach((row, r) => row.forEach((v, c) => {
      const x = x0 + c * (cs + gap), y = y0 + r * (cs + gap);
      const closed = v === "T" || v === "F";
      s += '<rect x="' + x + '" y="' + y + '" width="' + cs + '" height="' + cs + '" rx="4" fill="' + (closed ? "var(--cover-hi)" : "var(--open)") + '"/>';
      if (closed) s += '<rect x="' + x + '" y="' + (y + cs - 3) + '" width="' + cs + '" height="3" rx="1.5" fill="var(--ink)" opacity=".18"/>';
      if (v === "F") s += '<path d="M' + (x + 9) + " " + (y + 6) + "v15" + '" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round"/><path d="M' + (x + 10) + " " + (y + 6) + "h9l-2.6 3.6 2.6 3.6h-9z" + '" fill="var(--yellow)" stroke="var(--ink)" stroke-width="1.1" stroke-linejoin="round"/>';
      else if (NC[v]) s += txt(x + cs / 2, y + 19, v, 16, NC[v]);
    }));
    /* casa escolhida, à espera do toque */
    const cx = x0 + 2 * (cs + gap), cy = y0 + (cs + gap);
    s += '<rect x="' + (cx - 1) + '" y="' + (cy - 1) + '" width="' + (cs + 2) + '" height="' + (cs + 2) + '" rx="5" fill="none" stroke="var(--blue)" stroke-width="3"/>';
    return svg(s);
  }

  function palavras() {
    const rows = [
      [["T", "c"], ["E", "a"], ["M", "p"], ["P", "a"], ["O", "c"]],
      [["T", "c"], ["O", "t"], ["", "e"], ["", "e"], ["", "e"]],
      [["", "f"], ["", "f"], ["", "f"], ["", "f"], ["", "f"]]
    ];
    const cs = 26, gap = 4, x0 = 80 - (5 * cs + 4 * gap) / 2, y0 = 9;
    let s = "";
    rows.forEach((row, r) => row.forEach(([ch, k], c) => {
      const x = x0 + c * (cs + gap), y = y0 + r * (cs + gap + 4);
      const fill = { c: "var(--blue)", p: "var(--yellow)", a: "var(--cover)", t: "var(--surface)", e: "var(--surface)", f: "var(--surface)" }[k];
      const stroke = k === "t" ? 'stroke="var(--ink)" stroke-width="2"' : k === "e" ? 'stroke="var(--line-strong)" stroke-width="1.2"' : k === "f" ? 'stroke="var(--line)" stroke-width="1.2" opacity=".7"' : "";
      s += '<rect x="' + x + '" y="' + y + '" width="' + cs + '" height="' + cs + '" rx="4" fill="' + fill + '" ' + stroke + "/>";
      if (ch) s += txt(x + cs / 2, y + 19, ch, 16, k === "c" ? "var(--on-blue)" : k === "p" ? "var(--on-accent)" : "var(--ink)");
    }));
    /* cursor a piscar na casa seguinte */
    s += '<rect x="' + (x0 + 2 * (cs + gap) + 8) + '" y="' + (y0 + cs + gap + 4 + 21) + '" width="10" height="2.4" rx="1" fill="var(--blue-ink)"/>';
    return svg(s);
  }

  function solitario() {
    let s = "";
    /* baralho por virar, à esquerda */
    for (let i = 2; i >= 0; i--) {
      const x = 10 + i * 3, y = 16 + i * 3;
      s += '<rect x="' + x + '" y="' + y + '" width="44" height="62" rx="6" fill="var(--blue)" stroke="var(--ink)" stroke-width="1.6"/>';
      if (!i) s += '<rect x="' + (x + 5) + '" y="' + (y + 5) + '" width="34" height="52" rx="3" fill="none" stroke="var(--on-blue)" stroke-width="1.2" opacity=".55"/><path d="M' + (x + 22) + " " + (y + 20) + "l8 11-8 11-8-11z" + '" fill="var(--yellow)" stroke="var(--on-accent)" stroke-width="1.1"/>';
    }
    /* coluna em cascata: K, Q vermelha, J */
    s += card(70, 4, 50, 70, "K", false, 0);
    s += card(82, 22, 50, 70, "Q", true, 0);
    s += card(94, 40, 50, 66, "J", false, 0);
    return svg(s);
  }

  /* ---------- Arcada ---------- */
  function dobra() {
    const cs = 28, gap = 4, x0 = 33, y0 = 7;
    const T = [["2", "", "4"], ["8", "×2", ""], ["", "16", "2"]];
    const BG = { "": "#2A3654", 2: "#EEF3FB", 4: "#B7CCEE", 8: "#1E4FA3", 16: "#163D82", "×2": "#E0A526" };
    let s = '<rect x="' + (x0 - 6) + '" y="' + (y0 - 6) + '" width="' + (3 * cs + 2 * gap + 12) + '" height="' + (3 * cs + 2 * gap + 12) + '" rx="10" fill="#14213D"/>';
    T.forEach((row, r) => row.forEach((v, c) => {
      const x = x0 + c * (cs + gap), y = y0 + r * (cs + gap);
      s += '<rect x="' + x + '" y="' + y + '" width="' + cs + '" height="' + cs + '" rx="5" fill="' + BG[v] + '"/>';
      if (v) s += txt(x + cs / 2, y + (v.length > 2 ? 18 : 20), v, v.length > 3 ? 9.5 : v.length > 1 ? 13 : 16, v === "16" ? "#FFFFFF" : "#14213D");
    }));
    /* rasto do "2" a deslizar para a direita */
    s += '<path d="M8 23h16M12 31h12M16 15h8" stroke="var(--ink)" stroke-width="2.4" stroke-linecap="round" opacity=".55"/>';
    s += '<path d="M136 63h16M136 71h12M136 55h8" stroke="var(--ink)" stroke-width="2.4" stroke-linecap="round" opacity=".25"/>';
    return svg(s);
  }

  function cobra() {
    let s = '<path d="M8 22h144M8 44h144M8 66h144M8 88h144M30 6v98M52 6v98M74 6v98M96 6v98M118 6v98M140 6v98" stroke="var(--ink)" stroke-width="1" opacity=".1"/>';
    s += '<path d="M18 92H62V56H106V24H128" fill="none" stroke="#1E4FA3" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>';
    s += '<path d="M18 92H62V56H106V24H128" fill="none" stroke="var(--blue)" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>';
    /* cabeça com olhos a olhar para a maçã */
    s += '<circle cx="130" cy="24" r="10" fill="#1E4FA3"/><circle cx="133" cy="19.5" r="3.2" fill="#fff"/><circle cx="133" cy="28.5" r="3.2" fill="#fff"/><circle cx="134.4" cy="19.5" r="1.6" fill="#14213D"/><circle cx="134.4" cy="28.5" r="1.6" fill="#14213D"/>';
    s += '<circle cx="148" cy="24" r="6.5" fill="#C0262D"/><path d="M148 17.5c1-3 3-4 5-4" stroke="#1D7A3E" stroke-width="2" fill="none" stroke-linecap="round"/>';
    /* maçã dourada com anel de contagem */
    s += '<circle cx="128" cy="80" r="13" fill="none" stroke="var(--ink)" stroke-width="2" stroke-dasharray="40 82" opacity=".5" transform="rotate(-90 128 80)"/><circle cx="128" cy="80" r="7" fill="var(--yellow)" stroke="var(--ink)" stroke-width="1.4"/>';
    return svg(s);
  }

  /* ---------- Casino (fundo sempre escuro) ---------- */
  function blackjack() {
    let s = '<ellipse cx="80" cy="128" rx="110" ry="46" fill="none" stroke="#E0A526" stroke-width="1.4" opacity=".35"/>';
    s += card(36, 10, 52, 74, "A", false, -10, true);
    s += card(70, 14, 52, 74, "K", true, 8, true);
    /* fichas */
    const chip = (x, y, c) => '<ellipse cx="' + x + '" cy="' + (y + 3) + '" rx="15" ry="6" fill="#000" opacity=".35"/><ellipse cx="' + x + '" cy="' + y + '" rx="15" ry="6" fill="' + c + '"/><ellipse cx="' + x + '" cy="' + y + '" rx="15" ry="6" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="4 4" opacity=".8"/>';
    s += chip(136, 100, "#1E4FA3") + chip(136, 93, "#E0A526") + chip(136, 86, "#1E4FA3") + chip(136, 79, "#E0A526");
    s += chip(22, 100, "#E0A526") + chip(22, 93, "#1E4FA3");
    return svg(s);
  }

  function roleta() {
    const cx = 104, cy = 56, R1 = 45, R2 = 30, N = 37;
    let s = '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R1 + 6) + '" fill="#E0A526"/><circle cx="' + cx + '" cy="' + cy + '" r="' + (R1 + 2) + '" fill="#1D2740"/>';
    const pt = (r, a) => (cx + r * Math.cos(a)).toFixed(2) + " " + (cy + r * Math.sin(a)).toFixed(2);
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * 2 * Math.PI - Math.PI / 2 + .2, a1 = ((i + 1) / N) * 2 * Math.PI - Math.PI / 2 + .2;
      const fill = i === 0 ? "#1D7A3E" : i % 2 ? "#C0262D" : "#14213D";
      s += '<path d="M' + pt(R1, a0) + "A" + R1 + " " + R1 + " 0 0 1 " + pt(R1, a1) + "L" + pt(R2, a1) + "A" + R2 + " " + R2 + " 0 0 0 " + pt(R2, a0) + 'Z" fill="' + fill + '" stroke="#E0A526" stroke-width=".5" stroke-opacity=".5"/>';
    }
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R2 + '" fill="#1E4FA3"/><circle cx="' + cx + '" cy="' + cy + '" r="' + (R2 - 8) + '" fill="#163D82"/>';
    s += '<path d="M' + (cx - 15) + " " + cy + "h30M" + cx + " " + (cy - 15) + 'v30" stroke="#E0A526" stroke-width="3" stroke-linecap="round"/><circle cx="' + cx + '" cy="' + cy + '" r="6" fill="#E0A526"/>';
    /* bola na pista */
    const ba = -2.4;
    s += '<circle cx="' + (cx + (R1 - 5) * Math.cos(ba)).toFixed(1) + '" cy="' + (cy + (R1 - 5) * Math.sin(ba)).toFixed(1) + '" r="4.6" fill="#FFFFFF" stroke="#14213D" stroke-width=".8"/>';
    /* ficha solta */
    s += '<circle cx="24" cy="86" r="14" fill="#E0A526"/><circle cx="24" cy="86" r="14" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="5 5.99"/><circle cx="24" cy="86" r="8" fill="none" stroke="#14213D" stroke-width="1.2"/>';
    return svg(s);
  }

  Sala.menuArt = { sudoku, minas, palavras, soli: solitario, dobra, cobra, blackjack, roleta };
})();
