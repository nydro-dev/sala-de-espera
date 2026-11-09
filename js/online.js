/* Sala de Espera — ranking online (Fase 8; contas com alcunha e palavra-passe desde a Fase 8.1).
   Uma camada por cima da app, desligada até o jogador a ligar nas Definições: conta com alcunha única e
   palavra-passe (sem email; o gestor de palavras-passe do aparelho guarda-a), código de reserva para quem a
   esquecer, envio dos resultados no fim de cada jogo (o servidor repete as jogadas e calcula os pontos) e um
   separador "Online" na janela do ranking. Tudo o resto continua a funcionar sem rede e sem conta.
   Pedidos só ao próprio site (/api/...), sem cookies. */
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
  const FILA_MAX = 30, FILA_DIAS = 3, DIAS_ATRAS = 89;

  /* ---------- Estado neste aparelho ----------
     sde:online = { alcunha, sessao }: sessao null = a sessão terminou (a alcunha fica, para voltar a entrar).
     Contas da Fase 8 ({ codigo }) deixaram de existir no servidor: ficam marcadas como antigas. */
  function conta() {
    const c = store.get("online", null);
    if (c && c.codigo && !c.sessao) { const n = { alcunha: c.alcunha, sessao: null, antiga: true }; store.set("online", n); store.del("online:fila"); return n; }
    return c;
  }
  const sessao = () => { const c = conta(); return c && c.sessao || null; };
  const ligado = () => ATIVO && !!sessao();
  const guardar = (alcunha, s) => store.set("online", { alcunha, sessao: s });
  function sessaoTerminou() {
    const c = conta(); if (!c || !c.sessao) return;
    store.set("online", { alcunha: c.alcunha, sessao: null });
    toast("A sessão do ranking online terminou. Entra outra vez nas Definições: os resultados ficam à espera.", 5000);
  }

  /* ---------- Pedidos ---------- */
  async function api(method, path, body, auth) {
    const headers = {};
    if (body) headers["Content-Type"] = "application/json";
    if (auth) headers.Authorization = "Bearer " + auth;
    try {
      const r = await fetch("/api/" + path, { method, headers, body: body ? JSON.stringify(body) : undefined, credentials: "omit", cache: "no-store" });
      let data = null; try { data = await r.json(); } catch (e) {}
      return { ok: r.ok, status: r.status, data: data || {} };
    } catch (e) { return { ok: false, status: 0, data: {} }; } /* sem rede */
  }
  const SEM_REDE = "Sem ligação à internet. Tenta outra vez quando tiveres rede.";
  const erroDe = (r, fallback) => r.status ? (r.data.erro || fallback) : SEM_REDE;

  /* ---------- Envio dos resultados (com fila, para quando não há rede ou a sessão terminou) ---------- */
  const fila = () => store.get("online:fila", []).filter(x => Date.now() - (x.em || 0) < FILA_DIAS * 864e5);
  function submit(o) {
    const c = conta();
    if (!ATIVO || !c || c.antiga || !o || !o.online || !MODOS[o.game]) return;
    const modo = o.daily ? "dia" : o.diff;
    if (!MODOS[o.game].includes(modo)) return;
    const item = Object.assign({ jogo: o.game, modo, tempo: Math.max(0, Math.round(o.time || 0)) }, o.daily ? { dia: o.daily } : {}, o.online, { em: Date.now() });
    const f = fila();
    f.push(item); while (f.length > FILA_MAX) f.shift();
    store.set("online:fila", f);
    if (ligado()) flush(true);
    else toast("Resultado guardado para o ranking online: entra na conta nas Definições para o enviar.", 4500);
  }
  let busy = false;
  async function flush(show) {
    if (busy || !ligado()) return;
    busy = true;
    try {
      let f = fila();
      while (f.length) {
        const item = f[0], { em, ...body } = item;
        const r = await api("POST", "resultado", body, sessao());
        if (r.status === 0 || r.status === 429 || r.status >= 500) {
          if (show) toast(r.status ? "O ranking online não respondeu. O resultado fica guardado e segue mais tarde." : "Sem rede: o resultado fica guardado e segue quando houver ligação.", 4500);
          break; /* tenta mais tarde */
        }
        if (r.status === 401) { sessaoTerminou(); break; } /* a fila fica para quando voltar a entrar */
        f.shift(); store.set("online:fila", f);
        if (r.ok) {
          store.del("online:erro");
          if (show && !f.length) toast(r.data.pos ? "Ranking online: " + r.data.pos + ".º de " + fmtNum(r.data.total) + (r.data.pontos ? " · " + fmtNum(r.data.pontos) + " pts" : "") : "Resultado enviado para o ranking online.", 3500);
        } else {
          /* Recusado (409 repetido, 422 não confirmado): não volta a tentar, mas fica escrito no separador Online. */
          const msg = r.data.erro || "O servidor recusou o resultado.";
          store.set("online:erro", { msg, t: Date.now(), jogo: body.jogo });
          if (show) toast("Ranking online: " + msg, 6000);
        }
      }
      store.set("online:fila", f);
    } finally { busy = false; }
  }
  addEventListener("online", () => flush(false));
  if (ATIVO) setTimeout(() => flush(false), 3000);

  /* ---------- Formulários ----------
     Um <form> a sério, com autocomplete="username" e new-password/current-password, para o Porta-chaves do
     iCloud e o Chrome sugerirem uma palavra-passe forte, a guardarem e a preencherem nos outros aparelhos. */
  const PRIV = '<a href="privacidade.html" target="_blank" rel="noopener">política de privacidade</a>';
  function form(intro) {
    const f = el("form", { class: "duel-in-box ol-box", novalidate: true, autocomplete: "on" });
    if (intro) f.appendChild(el("div", { class: "ol-intro" }, intro));
    f.appendChild(el("button", { type: "submit", hidden: true, tabindex: "-1", "aria-hidden": "true" }));
    return f;
  }
  function campo(f, { id, label, type = "text", ac, value, hint, max }) {
    f.appendChild(el("label", { for: id, class: "lbl" }, label));
    const inp = el("input", { id, name: id, class: "input", type, autocomplete: ac, maxlength: max || (type === "password" ? "128" : "16"), autocapitalize: type === "password" || ac === "username" ? "none" : "sentences", autocorrect: "off", spellcheck: "false", value: value || "" });
    f.appendChild(inp);
    if (hint) f.appendChild(el("p", { class: "hint ol-hint" }, hint));
    return inp;
  }
  function verSenha(f, inputs) {
    const lab = el("label", { class: "check" }, '<input type="checkbox"> Mostrar a palavra-passe');
    lab.querySelector("input").onchange = e => inputs.forEach(i => { i.type = e.target.checked ? "text" : "password"; });
    f.appendChild(lab);
  }
  const erroBox = f => { const e = el("p", { class: "msg bad", role: "alert" }); f.appendChild(e); return e; };
  /* Liga o envio do formulário ao botão principal da janela; enquanto trabalha, não deixa enviar duas vezes. */
  function aoEnviar(f, err, fn) {
    let a = false;
    const go = async () => { if (a) return false; a = true; try { await fn(); } catch (e) { err.textContent = "Algo correu mal. Tenta outra vez."; } finally { a = false; } return false; };
    f.addEventListener("submit", e => { e.preventDefault(); go(); });
    return () => { if (f.requestSubmit) f.requestSubmit(); else go(); return false; };
  }
  const depois = fn => () => { setTimeout(fn, 0); };

  /* Criar conta */
  function showJoin() {
    const f = form("<p>Compara os teus resultados com os de toda a gente: desafio do dia e melhores pontuações de cada jogo.</p>" +
      '<p class="bk-note">Escolhe uma alcunha (só tua) e uma palavra-passe. Sem email: o servidor guarda a alcunha, um resumo da palavra-passe e os resultados, e mais nada (ver a ' + PRIV + ").</p>");
    const c = conta();
    const nick = campo(f, { id: "ol-nick", label: "Alcunha", ac: "username", value: (c && c.alcunha) || settings.name || "", hint: "Aparece no ranking. Não pode ser igual à de outra pessoa." });
    const pw = campo(f, { id: "ol-pw", label: "Palavra-passe", type: "password", ac: "new-password", hint: "Pelo menos 8 caracteres. Deixa o telemóvel ou o browser sugerir uma forte e guardá-la." });
    verSenha(f, [pw]);
    const age = el("label", { class: "check" }, '<input type="checkbox" id="ol-age"> Tenho 13 anos ou mais');
    f.appendChild(age);
    const err = erroBox(f);
    const enviar = aoEnviar(f, err, async () => {
      const a = nick.value.trim();
      if (!a) { err.textContent = "Escolhe uma alcunha."; nick.focus(); return; }
      if (pw.value.length < 8) { err.textContent = "A palavra-passe tem de ter pelo menos 8 caracteres."; pw.focus(); return; }
      if (!f.querySelector("#ol-age").checked) { err.textContent = "O ranking online é para quem tem 13 anos ou mais."; return; }
      err.textContent = "A criar a conta…";
      const r = await api("POST", "conta", { alcunha: a, senha: pw.value, idade: true });
      if (!r.ok) { err.textContent = erroDe(r, "Não foi possível criar a conta."); return; }
      guardar(r.data.alcunha, r.data.sessao); store.del("online:erro");
      modal.close(true); showReserva(r.data.reserva, "criada"); flush(false);
    });
    modal.open({ title: "Criar conta", body: f, actions: [{ label: "Já tenho conta", onClick: depois(showLogin) }, { label: "Criar conta", primary: true, close: false, onClick: enviar }] });
  }

  /* Entrar */
  function showLogin() {
    const c = conta();
    const f = form(c && c.antiga
      ? '<p>O ranking online mudou: agora entra-se com <b>alcunha e palavra-passe</b>. As contas antigas, com código de recuperação, deixaram de existir. Cria uma conta nova (podes usar a mesma alcunha, se estiver livre).</p>'
      : "<p>Entra com a tua alcunha e a palavra-passe. Se o aparelho a guardou, preenche-se sozinha.</p>");
    const nick = campo(f, { id: "ol-user", label: "Alcunha", ac: "username", value: c && !c.antiga ? c.alcunha : "" });
    const pw = campo(f, { id: "ol-pass", label: "Palavra-passe", type: "password", ac: "current-password" });
    verSenha(f, [pw]);
    const esq = el("button", { type: "button", class: "btn ghost ol-link" }, "Esqueci a palavra-passe");
    esq.onclick = () => { modal.close(true); setTimeout(() => showRecover(nick.value.trim()), 0); };
    f.appendChild(esq);
    const err = erroBox(f);
    const enviar = aoEnviar(f, err, async () => {
      if (!nick.value.trim() || !pw.value) { err.textContent = "Escreve a alcunha e a palavra-passe."; return; }
      err.textContent = "A entrar…";
      const r = await api("POST", "sessao", { alcunha: nick.value.trim(), senha: pw.value });
      if (!r.ok) { err.textContent = erroDe(r, "Não foi possível entrar."); return; }
      const antes = conta();
      /* Outra conta neste aparelho: os resultados à espera eram da anterior e não seguem com esta. */
      if (antes && antes.alcunha && antes.alcunha.toLowerCase() !== r.data.alcunha.toLowerCase()) store.del("online:fila");
      guardar(r.data.alcunha, r.data.sessao); store.del("online:erro");
      modal.close(true); toast("Bem-vindo de volta, " + r.data.alcunha + "."); flush(true);
    });
    modal.open({ title: "Entrar no ranking online", body: f, actions: [{ label: "Criar conta", onClick: depois(showJoin) }, { label: "Entrar", primary: true, close: false, onClick: enviar }] });
  }

  /* Esqueci a palavra-passe: alcunha + código de reserva + palavra-passe nova */
  function showRecover(alc) {
    const f = form("<p>Usa o <b>código de reserva</b> que recebeste ao criar a conta (16 letras e números). Ao usá-lo, a sessão termina em todos os aparelhos e recebes um código novo.</p>");
    const nick = campo(f, { id: "ol-ruser", label: "Alcunha", ac: "username", value: alc || "" });
    const cod = campo(f, { id: "ol-rcode", label: "Código de reserva", ac: "off", max: "24" });
    cod.classList.add("duel-code-in"); cod.setAttribute("autocapitalize", "characters"); cod.placeholder = "XXXX-XXXX-XXXX-XXXX";
    const pw = campo(f, { id: "ol-rpw", label: "Palavra-passe nova", type: "password", ac: "new-password", hint: "Pelo menos 8 caracteres." });
    verSenha(f, [pw]);
    const err = erroBox(f);
    const enviar = aoEnviar(f, err, async () => {
      const v = cod.value.toUpperCase().replace(/[^0-9A-Z]/g, "");
      if (!nick.value.trim()) { err.textContent = "Escreve a alcunha."; nick.focus(); return; }
      if (v.length !== 16) { err.textContent = "O código de reserva tem 16 letras e números."; cod.focus(); return; }
      if (pw.value.length < 8) { err.textContent = "A palavra-passe tem de ter pelo menos 8 caracteres."; pw.focus(); return; }
      err.textContent = "A confirmar…";
      const r = await api("POST", "recuperar", { alcunha: nick.value.trim(), reserva: v, nova: pw.value });
      if (!r.ok) { err.textContent = erroDe(r, "Não foi possível recuperar a conta."); return; }
      guardar(r.data.alcunha, r.data.sessao); store.del("online:erro");
      modal.close(true); showReserva(r.data.reserva, "recuperada"); flush(false);
    });
    modal.open({ title: "Esqueci a palavra-passe", body: f, actions: [{ label: "Cancelar" }, { label: "Mudar palavra-passe", primary: true, close: false, onClick: enviar }] });
  }

  /* Mostra o código de reserva (só aparece esta vez) */
  function showReserva(codigo, porque) {
    const c = conta();
    const box = el("div", { class: "duel-in-box ol-box" });
    box.innerHTML = (porque === "criada" ? "<p>Conta criada. Bem-vindo ao ranking, <b>" + esc(c ? c.alcunha : "") + "</b>!</p>" : porque === "recuperada" ? "<p>Palavra-passe mudada. Entraste outra vez, e a sessão terminou nos outros aparelhos.</p>" : "") +
      "<p>O teu código de reserva:</p>" + '<div class="duel-code" id="ol-code">' + esc(codigo) + "</div>" +
      '<p class="bk-note">Só serve se esqueceres a palavra-passe, e <b>só aparece agora</b>. Guarda-o no gestor de palavras-passe (numa nota da conta) ou noutro sítio seguro. Sem ele e sem a palavra-passe, a conta não se recupera. ' + (porque === "recuperada" ? "O código que usaste já não vale." : "") + "</p>";
    modal.open({ title: "Código de reserva", body: box, actions: [{ label: "Copiar código", close: false, onClick: () => { copyText(codigo, "Código copiado. Guarda-o bem."); } }, { label: "Já guardei", primary: true }] });
  }
  /* Gerar um código de reserva novo (pede a palavra-passe) */
  function showNovaReserva() {
    const c = conta(); if (!c || !c.sessao) return;
    const f = form("<p>Gera um código de reserva novo. O anterior deixa de valer.</p>");
    f.appendChild(el("input", { type: "text", name: "username", autocomplete: "username", value: c.alcunha, hidden: true }));
    const pw = campo(f, { id: "ol-npw", label: "Palavra-passe", type: "password", ac: "current-password" });
    const err = erroBox(f);
    const enviar = aoEnviar(f, err, async () => {
      if (!pw.value) { err.textContent = "Escreve a palavra-passe."; pw.focus(); return; }
      const r = await api("POST", "reserva", { senha: pw.value }, c.sessao);
      if (r.status === 401 && !(r.data.erro || "").startsWith("Palavra")) { modal.close(true); sessaoTerminou(); return; }
      if (!r.ok) { err.textContent = erroDe(r, "Não foi possível gerar o código."); return; }
      modal.close(true); showReserva(r.data.reserva, "nova");
    });
    modal.open({ title: "Código de reserva", body: f, actions: [{ label: "Cancelar" }, { label: "Gerar código novo", primary: true, close: false, onClick: enviar }] });
  }

  /* Mudar a palavra-passe */
  function showSenha() {
    const c = conta(); if (!c || !c.sessao) return;
    const f = form("<p>As sessões nos outros aparelhos terminam; neste continuas dentro.</p>");
    f.appendChild(el("input", { type: "text", name: "username", autocomplete: "username", value: c.alcunha, hidden: true }));
    const atual = campo(f, { id: "ol-cur", label: "Palavra-passe atual", type: "password", ac: "current-password" });
    const nova = campo(f, { id: "ol-new", label: "Palavra-passe nova", type: "password", ac: "new-password", hint: "Pelo menos 8 caracteres." });
    verSenha(f, [atual, nova]);
    const err = erroBox(f);
    const enviar = aoEnviar(f, err, async () => {
      if (!atual.value) { err.textContent = "Escreve a palavra-passe atual."; atual.focus(); return; }
      if (nova.value.length < 8) { err.textContent = "A palavra-passe nova tem de ter pelo menos 8 caracteres."; nova.focus(); return; }
      const r = await api("POST", "senha", { atual: atual.value, nova: nova.value }, c.sessao);
      if (r.status === 401 && !(r.data.erro || "").startsWith("Palavra")) { modal.close(true); sessaoTerminou(); return; }
      if (!r.ok) { err.textContent = erroDe(r, "Não foi possível mudar a palavra-passe."); return; }
      modal.close(true); toast("Palavra-passe mudada. Os outros aparelhos vão pedir para entrar outra vez.", 4000);
    });
    modal.open({ title: "Mudar a palavra-passe", body: f, actions: [{ label: "Cancelar" }, { label: "Mudar", primary: true, close: false, onClick: enviar }] });
  }

  /* Mudar a alcunha */
  function showRename() {
    const c = conta(); if (!c || !c.sessao) return;
    const f = form("<p>A alcunha nova também é o nome com que entras. Atualiza-a no gestor de palavras-passe, se ele não o fizer sozinho.</p>");
    const inp = campo(f, { id: "ol-nick2", label: "Nova alcunha", ac: "username", value: c.alcunha });
    const err = erroBox(f);
    const enviar = aoEnviar(f, err, async () => {
      const r = await api("PATCH", "conta", { alcunha: inp.value.trim() }, c.sessao);
      if (r.status === 401) { modal.close(true); sessaoTerminou(); return; }
      if (!r.ok) { err.textContent = erroDe(r, "Não foi possível mudar."); return; }
      guardar(r.data.alcunha, c.sessao);
      modal.close(true); toast("Agora és " + r.data.alcunha + " no ranking online.");
    });
    modal.open({ title: "Mudar alcunha", body: f, actions: [{ label: "Cancelar" }, { label: "Guardar", primary: true, close: false, onClick: enviar }] });
  }

  /* Terminar sessão: só aqui ou em todos os aparelhos */
  function askLogout() {
    const c = conta(); if (!c) return;
    const sair = async todas => {
      if (c.sessao) {
        const r = await api("DELETE", "sessao" + (todas ? "?todas=1" : ""), null, c.sessao);
        if (!r.ok && r.status !== 401) { toast(erroDe(r, "Não foi possível terminar a sessão. Tenta outra vez.")); return false; }
      }
      store.set("online", { alcunha: c.alcunha, sessao: null }); store.del("online:fila"); store.del("online:erro");
      modal.close(true); toast(todas ? "Sessão terminada em todos os aparelhos." : "Sessão terminada neste aparelho."); return false;
    };
    modal.open({
      title: "Terminar sessão?",
      body: "<p>Os resultados deixam de ser enviados daqui. A conta e o ranking ficam como estão: para voltar, entra com a alcunha e a palavra-passe.</p>" +
        '<p class="bk-note">Se perdeste um aparelho ou desconfias de alguém, termina em todos.</p>',
      actions: [{ label: "Em todos os aparelhos", close: false, onClick: () => sair(true) }, { label: "Só neste", primary: true, close: false, onClick: () => sair(false) }]
    });
  }
  /* Esquecer a conta neste aparelho (sessão já terminada ou conta antiga) */
  function forget() { store.del("online"); store.del("online:fila"); store.del("online:erro"); toast("Ranking online desligado neste aparelho."); }

  /* Apagar a conta (pede a palavra-passe) */
  function askDelete() {
    const c = conta(); if (!c || !c.sessao) return;
    const f = form("<p>A alcunha <b>" + esc(c.alcunha) + "</b> e todos os resultados online são apagados do servidor, para sempre, e a sessão termina em todos os aparelhos. Os recordes e as estatísticas deste aparelho ficam.</p>");
    f.appendChild(el("input", { type: "text", name: "username", autocomplete: "username", value: c.alcunha, hidden: true }));
    const pw = campo(f, { id: "ol-dpw", label: "Palavra-passe, para confirmar", type: "password", ac: "current-password" });
    const err = erroBox(f);
    const enviar = aoEnviar(f, err, async () => {
      if (!pw.value) { err.textContent = "Escreve a palavra-passe."; pw.focus(); return; }
      const r = await api("DELETE", "conta", { senha: pw.value }, c.sessao);
      if (r.status === 401 && !(r.data.erro || "").startsWith("Palavra")) { modal.close(true); sessaoTerminou(); return; }
      if (!r.ok) { err.textContent = erroDe(r, "Não foi possível apagar. Tenta outra vez."); return; }
      forget(); modal.close(true); toast("Conta apagada. Os dados online já não existem.");
    });
    modal.open({ title: "Apagar a conta?", body: f, actions: [{ label: "Cancelar" }, { label: "Apagar tudo", primary: true, close: false, onClick: enviar }] });
  }

  /* ---------- Estado em texto (Definições e separador Online) ---------- */
  function estado() {
    const c = conta(), f = fila().length, e = store.get("online:erro", null);
    if (!c) return { tipo: "fora", html: "Desligado. Liga para comparar resultados com toda a gente (alcunha e palavra-passe, sem email)." };
    if (c.antiga) return { tipo: "antiga", html: "O ranking online mudou: agora entra-se com alcunha e palavra-passe. A conta antiga (<b>" + esc(c.alcunha || "") + "</b>) deixou de existir; cria uma nova." };
    const espera = f ? " " + (f === 1 ? "1 resultado à espera" : f + " resultados à espera") + " de envio." : "";
    if (!c.sessao) return { tipo: "fora-sessao", html: "A sessão de <b>" + esc(c.alcunha) + "</b> terminou. Entra outra vez para continuar a enviar resultados." + espera };
    const erro = e && Date.now() - e.t < 7 * 864e5 ? ' <span class="ol-bad">Último resultado recusado: ' + esc(e.msg) + "</span>" : "";
    return { tipo: "dentro", html: "Ligado como <b>" + esc(c.alcunha) + "</b>. Os jogos acabados vão para o ranking online." + espera + erro };
  }

  /* ---------- Definições ---------- */
  function settingsField() {
    const s = estado();
    const f = el("div", { class: "field col" }, '<span class="lbl">Ranking online<small>' + (!ATIVO ? "Disponível na app em saladeespera.pages.dev." : s.html) + "</small></span>");
    if (!ATIVO) return f;
    const row = el("div", { class: "bk-row" });
    const b = (label, fn, ghost) => { const x = el("button", { class: "btn" + (ghost ? " ghost" : ""), type: "button" }, label); x.onclick = () => { modal.close(true); setTimeout(fn, 0); }; row.appendChild(x); };
    if (s.tipo === "fora") { b("Entrar", showLogin); b("Criar conta", showJoin, true); }
    else if (s.tipo === "antiga") { b("Criar conta", showJoin); b("Entrar", showLogin, true); b("Desligar", forget, true); }
    else if (s.tipo === "fora-sessao") { b("Entrar", showLogin); b("Desligar neste aparelho", forget, true); }
    else { b("Mudar alcunha", showRename); b("Mudar palavra-passe", showSenha); b("Código de reserva", showNovaReserva, true); b("Terminar sessão", askLogout, true); b("Apagar conta", askDelete, true); }
    f.appendChild(row);
    return f;
  }

  /* ---------- Separador "Online" da janela do ranking ---------- */
  const supports = id => !!MODOS[id];
  const modes = id => MODOS[id] || [];
  const somaDias = (ds, n) => { const [y, m, d] = ds.split("-").map(Number); const x = new Date(y, m - 1, d + n), p = v => String(v).padStart(2, "0"); return x.getFullYear() + "-" + p(x.getMonth() + 1) + "-" + p(x.getDate()); };
  let diaVisto = null; /* dia escolhido nas setas do "Do dia" (null = hoje) */
  async function drawRanking(box, g, d, manter) {
    if (!ATIVO) { box.innerHTML = '<p class="empty">O ranking online está na app em <b>saladeespera.pages.dev</b>.</p>'; return; }
    const isDay = d === "dia", hoje = daily.today();
    if (!isDay) diaVisto = null;
    else if (!manter || !diaVisto || diaVisto > hoje || diaVisto < somaDias(hoje, -DIAS_ATRAS)) diaVisto = hoje;
    const dia = isDay ? diaVisto : null;
    box.innerHTML = "";
    /* Quem está ligado (ou porque não está) */
    const s = estado(), top = el("div", { class: "ol-state" + (s.tipo === "dentro" ? "" : " off") }, '<p class="hint">' + s.html + "</p>");
    if (s.tipo !== "dentro") {
      const a = el("button", { class: "btn", type: "button" }, s.tipo === "fora-sessao" ? "Entrar" : s.tipo === "antiga" ? "Criar conta" : "Ligar o ranking online");
      a.onclick = () => { modal.close(true); setTimeout(s.tipo === "antiga" ? showJoin : s.tipo === "fora" ? showJoin : showLogin, 0); };
      top.appendChild(a);
    }
    box.appendChild(top);
    /* Setas para ver os dias anteriores do desafio do dia */
    if (isDay) {
      const nav = el("div", { class: "ol-days" });
      const prev = el("button", { class: "btn ghost", type: "button", "aria-label": "Dia anterior" }, "‹"), next = el("button", { class: "btn ghost", type: "button", "aria-label": "Dia seguinte" }, "›");
      const lbl = el("span", {}, dia === hoje ? "Hoje · " + esc(daily.label(dia)) : esc(daily.long(dia)));
      prev.disabled = dia <= somaDias(hoje, -DIAS_ATRAS); next.disabled = dia >= hoje;
      prev.onclick = () => { diaVisto = somaDias(dia, -1); drawRanking(box, g, d, true); };
      next.onclick = () => { diaVisto = somaDias(dia, 1); drawRanking(box, g, d, true); };
      nav.append(prev, lbl, next); box.appendChild(nav);
    }
    const out = el("div", {}, '<p class="empty">A carregar…</p>'); box.appendChild(out);
    const r = await api("GET", "ranking?jogo=" + encodeURIComponent(g.id) + "&modo=" + encodeURIComponent(d) + (dia ? "&dia=" + dia : ""), null, sessao());
    if (!out.isConnected || (isDay && dia !== diaVisto)) return;
    if (!r.ok) { out.innerHTML = '<p class="empty">' + (r.status ? "O ranking online não respondeu. Tenta daqui a pouco." : "Sem ligação à internet.<br>O ranking local continua no separador Ranking.") + "</p>"; return; }
    const { lista, eu, total } = r.data;
    let html = "";
    if (!lista.length) html = '<p class="empty">' + (isDay ? (dia === hoje ? "Ainda ninguém fez o desafio de hoje." : "Ninguém fez o desafio deste dia.") : "Ainda não há resultados online aqui.") + (ligado() && (!isDay || dia === hoje) ? "<br>O primeiro pode ser o teu." : "") + (isDay && dia === hoje ? "<br>Usa a seta ‹ para ver os dias anteriores." : "") + "</p>";
    else html = '<table class="rank"><thead><tr><th>#</th><th>Alcunha</th><th>Tempo</th><th class="pts">Pontos</th></tr></thead><tbody>' +
      lista.map(e => '<tr' + (e.eu ? ' class="me"' : "") + '><td class="pos">' + e.pos + "</td><td>" + esc(e.alcunha) + "</td><td>" + fmtTime(e.tempo) + '</td><td class="pts">' + fmtNum(e.pontos) + "</td></tr>").join("") + "</tbody></table>";
    const notes = [];
    if (eu && eu.pos && !lista.some(e => e.eu)) notes.push("O teu lugar: <b>" + eu.pos + ".º</b> · " + fmtNum(eu.pontos) + " pts em " + fmtTime(eu.tempo));
    if (eu && eu.perdeu) notes.push(isDay ? "Neste dia não correu bem: a tentativa que conta não chegou ao fim." : "");
    if (total) notes.push(fmtNum(total) + (total === 1 ? " jogador" : " jogadores") + (isDay ? " no desafio de " + esc(daily.label(dia)) : ", o melhor resultado de cada um"));
    if (g.id === "palavras") notes.push("Online contam só os pontos da tentativa, sem o bónus de sequência.");
    html += notes.filter(Boolean).map(n => '<p class="hint st-note">' + n + "</p>").join("");
    out.innerHTML = html;
  }

  Sala.online = { ATIVO, ligado, conta, submit, flush, settingsField, supports, modes, drawRanking, showJoin, showLogin, showRecover };
})();
