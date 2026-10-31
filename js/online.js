/* Sala de Espera — ranking online (Fase 8).
   Uma camada por cima da app, desligada até o jogador a ligar nas Definições: conta com alcunha e código
   de recuperação (sem email), envio dos resultados no fim de cada jogo (o servidor repete as jogadas e
   calcula os pontos) e um separador "Online" na janela do ranking. Tudo o resto continua a funcionar
   sem rede e sem conta. Pedidos só ao próprio site (/api/...), sem cookies. */
(function () {
  "use strict";
  const { el, esc, toast, modal, store, fmtNum, fmtTime, copyText, daily, settings } = Sala;
  /* Só no endereço da app (o servidor vive lá) e em testes locais. */
  const ATIVO = location.hostname === "saladeespera.pages.dev" || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  /* Jogos e modos com ranking online (o mesmo que server/lib/validar.js aceita). */
  const MODOS = {
    sudoku: ["beginner", "easy", "medium", "hard", "evil", "dia"],
    minas: ["beginner", "easy", "medium", "hard", "extreme", "dia"],
    soli: ["d3", "dia"],
    dobra: ["s3", "s4", "s5"],
    palavras: ["dia"]
  };
  const FILA_MAX = 30, FILA_DIAS = 3;
  const conta = () => store.get("online", null);           /* { codigo, alcunha } */
  const ligado = () => ATIVO && !!conta();

  /* ---------- Pedidos ---------- */
  async function api(method, path, body, codigo) {
    const headers = {};
    if (body) headers["Content-Type"] = "application/json";
    if (codigo) headers.Authorization = "Bearer " + codigo;
    try {
      const r = await fetch("/api/" + path, { method, headers, body: body ? JSON.stringify(body) : undefined, credentials: "omit", cache: "no-store" });
      let data = null; try { data = await r.json(); } catch (e) {}
      return { ok: r.ok, status: r.status, data: data || {} };
    } catch (e) { return { ok: false, status: 0, data: {} }; } /* sem rede */
  }

  /* ---------- Envio dos resultados (com fila, para quando não há rede) ---------- */
  function submit(o) {
    if (!ligado() || !o || !o.online || !MODOS[o.game]) return;
    const modo = o.daily ? "dia" : o.diff;
    if (!MODOS[o.game].includes(modo)) return;
    const item = Object.assign({ jogo: o.game, modo, tempo: Math.max(0, Math.round(o.time || 0)) }, o.daily ? { dia: o.daily } : {}, o.online, { em: Date.now() });
    const fila = store.get("online:fila", []);
    fila.push(item); while (fila.length > FILA_MAX) fila.shift();
    store.set("online:fila", fila);
    flush(true);
  }
  let busy = false;
  async function flush(show) {
    if (busy || !ligado()) return;
    busy = true;
    try {
      let fila = store.get("online:fila", []).filter(x => Date.now() - (x.em || 0) < FILA_DIAS * 864e5);
      while (fila.length) {
        const item = fila[0], { em, ...body } = item;
        const r = await api("POST", "resultado", body, conta().codigo);
        if (r.status === 0 || r.status === 429 || r.status >= 500) break; /* tenta mais tarde */
        fila.shift(); store.set("online:fila", fila);
        if (!show || fila.length) continue;
        if (r.ok) toast(r.data.pos ? "Ranking online: " + r.data.pos + ".º de " + fmtNum(r.data.total) + (r.data.pontos ? " · " + fmtNum(r.data.pontos) + " pts" : "") : "Resultado enviado para o ranking online.", 3200);
        else if (r.status === 401) { toast("A conta do ranking online já não existe. Liga outra vez nas Definições.", 4000); store.del("online"); }
        else if (r.data.erro) toast("Ranking online: " + r.data.erro, 4000);
      }
      store.set("online:fila", fila);
    } finally { busy = false; }
  }
  addEventListener("online", () => flush(false));
  if (ATIVO) setTimeout(() => flush(false), 3000);

  /* ---------- Janelas da conta ---------- */
  const PRIV = '<a href="privacidade.html" target="_blank" rel="noopener">política de privacidade</a>';
  function showJoin() {
    const box = el("div", { class: "duel-in-box ol-box" });
    box.innerHTML = "<p>Compara os teus resultados com os de toda a gente: desafio do dia e melhores pontuações de cada jogo.</p>" +
      "<p class=\"bk-note\">Só precisas de uma alcunha. Não há email nem palavra-passe: recebes um código de recuperação, que é a tua chave. O servidor guarda a alcunha e os resultados, e mais nada (ver a " + PRIV + ").</p>";
    const lab = el("label", { for: "ol-nick", class: "lbl" }, "Alcunha");
    const inp = el("input", { id: "ol-nick", class: "input", maxlength: "16", autocomplete: "nickname", placeholder: "Por exemplo: Rui", value: settings.name || "" });
    const age = el("label", { class: "check" }, '<input type="checkbox" id="ol-age"> Tenho 13 anos ou mais');
    const err = el("p", { class: "msg bad", role: "alert" });
    box.append(lab, inp, age, err);
    const create = async () => {
      const a = inp.value.trim();
      if (!a) { err.textContent = "Escolhe uma alcunha."; inp.focus(); return false; }
      if (!box.querySelector("#ol-age").checked) { err.textContent = "O ranking online é para quem tem 13 anos ou mais."; return false; }
      err.textContent = "A criar a conta…";
      const r = await api("POST", "conta", { alcunha: a, idade: true });
      if (!r.ok) { err.textContent = r.status ? (r.data.erro || "Não foi possível criar a conta.") : "Sem ligação à internet. Tenta outra vez quando tiveres rede."; return false; }
      store.set("online", { codigo: r.data.codigo, alcunha: r.data.alcunha });
      modal.close(true); showCode(true); return false;
    };
    inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); create(); } });
    modal.open({ title: "Ranking online", body: box, actions: [{ label: "Já tenho conta", onClick: () => { setTimeout(showRecover, 0); } }, { label: "Criar conta", primary: true, close: false, onClick: create }] });
  }
  function showCode(first) {
    const c = conta(); if (!c) return;
    const box = el("div", { class: "duel-in-box ol-box" });
    box.innerHTML = (first ? "<p>Conta criada. Bem-vindo ao ranking, <b>" + esc(c.alcunha) + "</b>!</p>" : "") +
      "<p>O teu código de recuperação:</p>" + '<div class="duel-code" id="ol-code">' + esc(c.codigo) + "</div>" +
      "<p class=\"bk-note\">Guarda-o num sítio seguro (num gestor de palavras-passe, por exemplo). Serve para entrares noutro aparelho e é a única forma de recuperar a conta: sem email, ninguém o pode reenviar. Também vai no código de <b>Levar o progresso</b>. Não o mostres a ninguém.</p>";
    modal.open({ title: "Código de recuperação", body: box, actions: [{ label: "Copiar código", close: false, onClick: () => { copyText(c.codigo, "Código copiado. Guarda-o bem."); } }, { label: first ? "Já guardei" : "Fechar", primary: true }] });
  }
  function showRecover() {
    const box = el("div", { class: "duel-in-box ol-box" });
    box.appendChild(el("p", { class: "hint" }, "Escreve ou cola o código de recuperação da tua conta (16 letras e números)."));
    const lab = el("label", { for: "ol-rec", class: "lbl" }, "Código de recuperação");
    const inp = el("input", { id: "ol-rec", class: "input duel-code-in", type: "text", autocomplete: "off", autocapitalize: "characters", autocorrect: "off", spellcheck: "false", placeholder: "XXXX-XXXX-XXXX-XXXX" });
    const err = el("p", { class: "msg bad", role: "alert" });
    box.append(lab, inp, err);
    const go = async () => {
      const v = inp.value.toUpperCase().replace(/[^0-9A-Z]/g, "");
      if (v.length !== 16) { err.textContent = "O código tem 16 letras e números."; inp.focus(); return false; }
      const codigo = v.match(/.{4}/g).join("-");
      err.textContent = "A procurar a conta…";
      const r = await api("GET", "conta", null, codigo);
      if (!r.ok) { err.textContent = r.status === 401 ? "Não há nenhuma conta com esse código." : r.status ? "Não foi possível entrar." : "Sem ligação à internet."; return false; }
      store.set("online", { codigo, alcunha: r.data.alcunha });
      modal.close(true); toast("Bem-vindo de volta, " + r.data.alcunha + "."); flush(false); return false;
    };
    inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); go(); } });
    modal.open({ title: "Entrar com o código", body: box, actions: [{ label: "Cancelar" }, { label: "Entrar", primary: true, close: false, onClick: go }] });
  }
  function showRename() {
    const c = conta(); if (!c) return;
    const box = el("div", { class: "duel-in-box ol-box" });
    const lab = el("label", { for: "ol-nick2", class: "lbl" }, "Nova alcunha");
    const inp = el("input", { id: "ol-nick2", class: "input", maxlength: "16", autocomplete: "nickname", value: c.alcunha });
    const err = el("p", { class: "msg bad", role: "alert" });
    box.append(lab, inp, err);
    const go = async () => {
      const r = await api("PATCH", "conta", { alcunha: inp.value.trim() }, c.codigo);
      if (!r.ok) { err.textContent = r.data.erro || (r.status ? "Não foi possível mudar." : "Sem ligação à internet."); return false; }
      store.set("online", { codigo: c.codigo, alcunha: r.data.alcunha });
      modal.close(true); toast("Agora és " + r.data.alcunha + " no ranking online."); return false;
    };
    modal.open({ title: "Mudar alcunha", body: box, actions: [{ label: "Cancelar" }, { label: "Guardar", primary: true, close: false, onClick: go }] });
  }
  function askOff() {
    modal.open({
      title: "Desligar neste aparelho?",
      body: "<p>Os resultados deixam de ser enviados daqui. A conta e o ranking ficam como estão: para voltar, usa o código de recuperação.</p>",
      actions: [{ label: "Ver o código", onClick: () => { setTimeout(() => showCode(false), 0); } }, { label: "Desligar", primary: true, onClick: () => { store.del("online"); store.del("online:fila"); toast("Ranking online desligado neste aparelho."); } }]
    });
  }
  function askDelete() {
    const c = conta(); if (!c) return;
    modal.open({
      title: "Apagar a conta?",
      body: "<p>A alcunha <b>" + esc(c.alcunha) + "</b> e todos os resultados online são apagados do servidor, para sempre. Os recordes e as estatísticas deste aparelho ficam.</p>",
      actions: [{ label: "Cancelar" }, { label: "Apagar tudo", primary: true, close: false, onClick: async () => {
        const r = await api("DELETE", "conta", null, c.codigo);
        if (!r.ok && r.status !== 401) { toast(r.status ? "Não foi possível apagar. Tenta outra vez." : "Sem ligação à internet. Tenta outra vez quando tiveres rede."); return false; }
        store.del("online"); store.del("online:fila"); modal.close(true); toast("Conta apagada. Os dados online já não existem."); return false;
      } }]
    });
  }

  /* ---------- Definições ---------- */
  function settingsField() {
    const c = conta();
    const f = el("div", { class: "field col" }, '<span class="lbl">Ranking online<small>' +
      (!ATIVO ? "Disponível na app em saladeespera.pages.dev." : c ? "Ligado como <b>" + esc(c.alcunha) + "</b>. Os jogos acabados vão para o ranking online." : "Desligado. Liga para comparar resultados com toda a gente (só uma alcunha, sem email).") + "</small></span>");
    if (!ATIVO) return f;
    const row = el("div", { class: "bk-row" });
    const b = (label, fn, ghost) => { const x = el("button", { class: "btn" + (ghost ? " ghost" : ""), type: "button" }, label); x.onclick = () => { modal.close(true); setTimeout(fn, 0); }; row.appendChild(x); };
    if (!c) { b("Ligar", showJoin); b("Já tenho conta", showRecover, true); }
    else { b("Código de recuperação", () => showCode(false)); b("Mudar alcunha", showRename); b("Desligar", askOff, true); b("Apagar conta", askDelete, true); }
    f.appendChild(row);
    return f;
  }

  /* ---------- Separador "Online" da janela do ranking ---------- */
  const supports = id => !!MODOS[id];
  const modes = id => MODOS[id] || [];
  async function drawRanking(box, g, d) {
    if (!ATIVO) { box.innerHTML = '<p class="empty">O ranking online está na app em <b>saladeespera.pages.dev</b>.</p>'; return; }
    const isDay = d === "dia", dia = isDay ? daily.today() : null;
    box.innerHTML = '<p class="empty">A carregar…</p>';
    const c = conta();
    const r = await api("GET", "ranking?jogo=" + encodeURIComponent(g.id) + "&modo=" + encodeURIComponent(d) + (dia ? "&dia=" + dia : ""), null, c && c.codigo);
    if (!box.isConnected) return;
    if (!r.ok) { box.innerHTML = '<p class="empty">' + (r.status ? "O ranking online não respondeu. Tenta daqui a pouco." : "Sem ligação à internet.<br>O ranking local continua no separador Ranking.") + "</p>"; return; }
    const { lista, eu, total } = r.data;
    let html = "";
    if (!lista.length) html = '<p class="empty">' + (isDay ? "Ainda ninguém fez o desafio de hoje." : "Ainda não há resultados online aqui.") + (c ? "<br>O primeiro pode ser o teu." : "") + "</p>";
    else html = '<table class="rank"><thead><tr><th>#</th><th>Alcunha</th><th>Tempo</th><th class="pts">Pontos</th></tr></thead><tbody>' +
      lista.map(e => '<tr' + (e.eu ? ' class="me"' : "") + '><td class="pos">' + e.pos + "</td><td>" + esc(e.alcunha) + "</td><td>" + fmtTime(e.tempo) + '</td><td class="pts">' + fmtNum(e.pontos) + "</td></tr>").join("") + "</tbody></table>";
    const notes = [];
    if (eu && eu.pos && !lista.some(e => e.eu)) notes.push("O teu lugar: <b>" + eu.pos + ".º</b> · " + fmtNum(eu.pontos) + " pts em " + fmtTime(eu.tempo));
    if (eu && eu.perdeu) notes.push(isDay ? "Hoje não correu bem: a tentativa que conta não chegou ao fim." : "");
    if (total) notes.push(fmtNum(total) + (total === 1 ? " jogador" : " jogadores") + (isDay ? " no desafio de " + esc(daily.label(dia)) : ", o melhor resultado de cada um"));
    if (g.id === "palavras") notes.push("Online contam só os pontos da tentativa, sem o bónus de sequência.");
    html += notes.filter(Boolean).map(n => '<p class="hint st-note">' + n + "</p>").join("");
    box.innerHTML = html;
    if (!c) {
      const p = el("p", { class: "hint st-note" }, "Para entrares no ranking, liga o online: ");
      const a = el("button", { class: "btn", type: "button" }, "Ligar o ranking online");
      a.onclick = () => { modal.close(true); setTimeout(showJoin, 0); };
      box.append(p, a);
    }
  }

  Sala.online = { ATIVO, ligado, conta, submit, flush, settingsField, supports, modes, drawRanking, showJoin, showRecover, showCode };
})();
