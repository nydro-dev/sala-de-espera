/* Sala de Espera — levar o progresso para outro aparelho ou endereço (Fase 7).
   Tudo o que a app guarda com o prefixo "sde:" vai num código de texto (ou num ficheiro):
   SDE1.<z|j>.<verificação>.<dados em base64url>, com z = comprimido (deflate) e j = sem compressão.
   Não há nuvem nem servidor: o código passa de mão em mão (copiar e colar, ficheiro ou o # de um link,
   que nunca chega ao servidor). Importar substitui o que este aparelho tem, mas guarda antes uma cópia
   ("sde-bak", fora do prefixo, para não ir nas exportações) e deixa desfazer. */
(function () {
  "use strict";
  const { el, esc, toast, modal, copyText } = Sala;
  const PFX = "sde:", BAK = "sde-bak", MAX = 4e6;

  /* ---------- base64url e verificação ---------- */
  const b64 = u8 => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
  const unb64 = s => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; const t = atob(s), u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u; };
  /* FNV-1a de 32 bits: apanha códigos cortados ou alterados (não é segurança, é integridade). */
  const fnv = u8 => { let h = 0x811c9dc5; for (let i = 0; i < u8.length; i++) { h ^= u8[i]; h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); };
  const canZip = typeof CompressionStream === "function" && typeof DecompressionStream === "function";
  async function pipe(u8, Stream) {
    const s = new Blob([u8]).stream().pipeThrough(new Stream("deflate-raw"));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }

  /* ---------- Ler e escrever o armazenamento ---------- */
  function snapshot() {
    const d = {};
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PFX)) d[k] = localStorage.getItem(k); } } catch (e) {}
    return d;
  }
  function restore(d) {
    try {
      Object.keys(snapshot()).forEach(k => localStorage.removeItem(k));
      for (const k in d) if (k.startsWith(PFX) && typeof d[k] === "string") localStorage.setItem(k, d[k]);
      return true;
    } catch (e) { return false; }
  }

  async function encode() {
    const json = JSON.stringify({ v: 1, t: Date.now(), d: snapshot() });
    const raw = new TextEncoder().encode(json);
    let kind = "j", data = raw;
    if (canZip) { try { data = await pipe(raw, CompressionStream); kind = "z"; } catch (e) { data = raw; kind = "j"; } }
    return "SDE1." + kind + "." + fnv(raw) + "." + b64(data);
  }

  /* Devolve { data } ou { err } com uma frase para mostrar a quem importa. */
  async function decode(text) {
    let s = String(text || "").trim();
    const m = s.match(/SDE1\.([zj])\.([0-9a-z]+)\.([A-Za-z0-9_-]+)/); /* aceita o link inteiro ou o código no meio de uma mensagem */
    if (!m) return { err: "Isto não parece um código de progresso da Sala de Espera. Deve começar por SDE1." };
    if (m[3].length > MAX) return { err: "O código é demasiado grande." };
    try {
      let u = unb64(m[3]);
      if (m[1] === "z") {
        if (!canZip) return { err: "Este browser é antigo demais para abrir códigos comprimidos. Atualiza-o e tenta outra vez." };
        u = await pipe(u, DecompressionStream);
      }
      if (fnv(u) !== m[2]) return { err: "O código está incompleto ou foi alterado. Copia-o outra vez, do princípio ao fim." };
      const o = JSON.parse(new TextDecoder().decode(u));
      if (!o || o.v !== 1 || typeof o.d !== "object") return { err: "Este código é de uma versão que esta app não conhece. Atualiza a app e tenta outra vez." };
      return { data: o };
    } catch (e) { return { err: "O código está incompleto ou foi alterado. Copia-o outra vez, do princípio ao fim." }; }
  }

  /* Resumo para mostrar antes de importar: recordes, rivais, jogos a meio e desafios do dia. */
  function summary(d) {
    const J = k => { try { return JSON.parse(d[PFX + k] || "null"); } catch (e) { return null; } };
    let rec = 0; const rank = J("rank") || {}; for (const k in rank) if (Array.isArray(rank[k])) rec += rank[k].length;
    const du = J("duelos") || {}, riv = du.rivals ? Object.keys(du.rivals).length : 0;
    const daily = J("daily") || {}, days = Object.keys(daily).length;
    const st = J("stats") || {}; let played = 0;
    for (const g in st) { const all = st[g] && st[g]["*"]; if (all && all.played) played += all.played; else if (all && all.games) played += all.games; }
    const parts = [];
    parts.push(rec + (rec === 1 ? " recorde" : " recordes"));
    if (played) parts.push(played + (played === 1 ? " jogo nas estatísticas" : " jogos nas estatísticas"));
    parts.push(riv + (riv === 1 ? " rival" : " rivais"));
    if (days) parts.push(days + (days === 1 ? " dia de desafios" : " dias de desafios"));
    return { keys: Object.keys(d).length, text: parts.join(", ") };
  }
  const hasData = () => Object.keys(snapshot()).some(k => k !== PFX + "settings");

  /* Substitui o progresso deste aparelho, guardando antes uma cópia para desfazer. */
  function apply(o) {
    try { localStorage.setItem(BAK, JSON.stringify({ t: Date.now(), d: snapshot() })); } catch (e) { /* sem espaço para a cópia: importa na mesma */ }
    if (!restore(o.d)) { toast("Não foi possível guardar o progresso neste aparelho."); return false; }
    Sala.importing = true; /* nada em memória volta a escrever por cima */
    history.replaceState(null, "", location.pathname + location.search + "#imp-ok");
    location.reload();
    return true;
  }

  /* ---------- Janelas ---------- */
  function dateTag() { const d = new Date(), p = n => String(n).padStart(2, "0"); return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); }

  async function showExport() {
    const code = await encode();
    const s = summary(snapshot());
    const box = el("div", { class: "bk" });
    box.innerHTML = "<p>Este código leva tudo o que a app guardou neste aparelho: " + esc(s.text) + ", jogos a meio e definições. Abre a Sala de Espera no outro aparelho, vai às Definições, toca em <b>Importar</b> e cola-o.</p>" +
      '<textarea class="input bk-code" readonly rows="4" aria-label="Código de progresso"></textarea>' +
      '<p class="bk-note">São ' + code.length.toLocaleString("pt-PT") + " caracteres: não dá para escrever à mão, mas copia-se e cola-se numa mensagem para ti próprio, ou guarda-se como ficheiro.</p>";
    const ta = box.querySelector("textarea"); ta.value = code;
    ta.addEventListener("focus", () => ta.select());
    modal.open({ title: "Exportar progresso", body: box, actions: [
      { label: "Guardar ficheiro", close: false, onClick: () => {
        const a = el("a", { href: URL.createObjectURL(new Blob([code + "\n"], { type: "text/plain" })), download: "sala-de-espera-progresso-" + dateTag() + ".txt" });
        document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        return false;
      } },
      { label: "Copiar código", primary: true, close: false, onClick: () => { copyText(code, "Código copiado. Cola-o no outro aparelho, em Definições → Importar."); return false; } }
    ] });
  }

  /* text: código já conhecido (vindo de um link de mudança); from: frase sobre a origem. */
  async function showImport(text, from) {
    const box = el("div", { class: "bk" });
    box.innerHTML = (from ? "<p>" + esc(from) + "</p>" : "<p>Cola aqui o código que exportaste no outro aparelho, ou abre o ficheiro que guardaste.</p>") +
      '<textarea class="input bk-code" rows="4" placeholder="SDE1.…" aria-label="Código de progresso" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea>' +
      '<div class="bk-row"><button class="btn" type="button" data-paste>Colar</button><label class="btn bk-file">Abrir ficheiro<input type="file" accept=".txt,text/plain" hidden></label></div>' +
      '<p class="bk-sum" aria-live="polite"></p><p class="bk-err" role="alert"></p>' +
      (hasData() ? '<p class="bk-note">Atenção: o que este aparelho já tem é substituído. Fica uma cópia para poderes desfazer, nas Definições.</p>' : "");
    const ta = box.querySelector("textarea"), sum = box.querySelector(".bk-sum"), err = box.querySelector(".bk-err");
    let ok = null;
    const check = async () => {
      ok = null; err.textContent = ""; sum.textContent = "";
      if (!ta.value.trim()) return;
      const r = await decode(ta.value);
      if (r.err) { err.textContent = r.err; return; }
      ok = r.data; const s = summary(ok.d);
      sum.textContent = "Código válido, de " + new Date(ok.t).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" }) + ": " + s.text + ".";
    };
    ta.addEventListener("input", check);
    box.querySelector("[data-paste]").onclick = async () => { try { ta.value = await navigator.clipboard.readText(); check(); } catch (e) { toast("Este browser não deixa colar daqui. Toca no campo e cola."); ta.focus(); } };
    box.querySelector("input[type=file]").onchange = async e => { const f = e.target.files && e.target.files[0]; if (f) { ta.value = (await f.text()).slice(0, MAX + 100); check(); } };
    if (text) { ta.value = text; await check(); }
    /* Vindo de um link de mudança, o código já está certo: escondem-se o campo e os botões (voltam se houver erro). */
    if (from && ok) { ta.hidden = true; box.querySelector(".bk-row").hidden = true; }
    modal.open({ title: "Importar progresso", body: box, actions: [
      { label: "Cancelar" },
      { label: "Importar", primary: true, close: false, onClick: () => {
        if (!ok) { check().then(() => { if (!ok && !err.textContent) err.textContent = "Cola primeiro o código."; else if (ok) apply(ok); }); return false; }
        apply(ok); return false;
      } }
    ] });
  }

  function backupInfo() { try { const b = JSON.parse(localStorage.getItem(BAK) || "null"); return b && b.d ? b : null; } catch (e) { return null; } }
  function undoImport() {
    const b = backupInfo(); if (!b) return;
    modal.open({ title: "Desfazer a importação?", body: "<p>Volta o progresso que este aparelho tinha antes de importar (" + esc(summary(b.d).text) + "). O que foi importado perde-se.</p>", actions: [
      { label: "Cancelar" },
      { label: "Desfazer", primary: true, onClick: () => { restore(b.d); try { localStorage.removeItem(BAK); } catch (e) {} Sala.importing = true; location.reload(); } }
    ] });
  }

  /* Campo nas Definições (chamado pelo showSettings). */
  function settingsField() {
    const f = el("div", { class: "field col" }, '<span class="lbl">Levar o progresso<small>Para outro aparelho ou para a app instalada: recordes, estatísticas, rivais e jogos a meio. Sem conta e sem nuvem.</small></span>');
    const row = el("div", { class: "bk-row" });
    const bE = el("button", { class: "btn", type: "button" }, "Exportar"), bI = el("button", { class: "btn", type: "button" }, "Importar");
    bE.onclick = () => showExport(); bI.onclick = () => showImport();
    row.append(bE, bI);
    if (backupInfo()) { const bU = el("button", { class: "btn ghost", type: "button" }, "Desfazer importação"); bU.onclick = undoImport; row.appendChild(bU); }
    f.appendChild(row);
    return f;
  }

  /* Depois de importar, a página recarrega com #imp-ok: confirmar e limpar o endereço. */
  function afterLoad() {
    if (location.hash !== "#imp-ok") return;
    history.replaceState(null, "", location.pathname + location.search);
    setTimeout(() => toast("Progresso importado. Bem-vindo de volta!"), 400);
  }

  Sala.backup = { encode, decode, summary, snapshot, showExport, showImport, settingsField, afterLoad, hasData };
})();
