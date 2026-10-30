/* Sala de Espera — mudança de endereço (Fase 7).
   O endereço antigo (GitHub Pages) continua no ar, sem custos, só para encaminhar:
   - links de duelo (#/d/… e #/duelo/…) seguem logo para o endereço novo, com o # intacto;
   - o resto mostra "Mudámo-nos", com um botão que leva o progresso deste browser no # do link
     (o # nunca vai ao servidor) e o código para quem tem a app instalada no iPhone.
   O armazenamento pertence ao endereço: sem isto, quem mudasse começava do zero. */
(function () {
  "use strict";
  const { el, esc, toast, copyText } = Sala;
  const NEW = Sala.SITE; /* endereço novo, definido no core.js */
  const OLD_HOSTS = ["nydro-dev.github.io"];
  const isOld = OLD_HOSTS.includes(location.hostname) || /[?&]mudanca=1\b/.test(location.search); /* ?mudanca=1 só para testar */
  const STAY = "sde-ficar"; /* "Continuar aqui por agora", só nesta sessão */
  const stays = () => { try { return sessionStorage.getItem(STAY) === "1"; } catch (e) { return false; } };

  /* Duelos: seguem já, antes de a app desenhar o que quer que seja. */
  if (isOld && /^#\/(?:d|duelo)\//.test(location.hash)) { location.replace(NEW + location.hash); Sala.moving = { active: () => true, show() {} }; return; }

  let shown = null;
  function show() {
    if (shown) return;
    ["v-menu", "v-game"].forEach(id => { const n = document.getElementById(id); if (n) n.hidden = true; });
    const has = Sala.backup && Sala.backup.hasData();
    const logo = document.querySelector(".brand-mark");
    const v = el("main", { class: "view mv", id: "v-mudanca" });
    v.innerHTML =
      '<div class="mv-card">' + (logo ? logo.outerHTML : "") +
      "<h1>Mudámo-nos!</h1>" +
      '<p class="mv-lead">A Sala de Espera tem casa nova: <a href="' + esc(NEW) + '"><b>' + esc(NEW.replace(/^https:\/\//, "").replace(/\/$/, "")) + "</b></a>. Os jogos são os mesmos, com cara nova.</p>" +
      (has ? '<p>Os teus recordes, estatísticas, rivais e jogos a meio estão guardados neste endereço. O botão leva-os contigo.</p>' : "<p>Este browser ainda não tem progresso guardado aqui, por isso é só seguir.</p>") +
      '<div class="mv-acts"><button class="btn primary block" type="button" data-go>' + (has ? "Levar o meu progresso e ir" : "Ir para o endereço novo") + "</button></div>" +
      (has ? '<details class="mv-ios"><summary>Tenho a app instalada no iPhone</summary>' +
        "<p>No iPhone, a app instalada e o Safari guardam os dados à parte. Para levar o progresso da app:</p>" +
        "<ol><li>Toca em <b>Copiar código</b>, aqui em baixo.</li><li>Abre o endereço novo no Safari e instala-o (Partilhar → Adicionar ao ecrã principal).</li>" +
        "<li>Na app nova: Definições → <b>Importar</b> → cola o código.</li><li>Quando estiver tudo lá, podes apagar a app antiga.</li></ol>" +
        '<button class="btn block" type="button" data-copy>Copiar código</button></details>' : "") +
      '<button class="btn ghost mv-stay" type="button" data-stay>Continuar aqui por agora</button>' +
      "</div>";
    document.getElementById("app").appendChild(v);
    v.querySelector("[data-go]").onclick = async () => {
      if (!has) { location.href = NEW; return; }
      try { const code = await Sala.backup.encode(); location.href = NEW + "#/importar/" + code; }
      catch (e) { toast("Não foi possível preparar o progresso. Usa o código, em baixo."); }
    };
    const bc = v.querySelector("[data-copy]");
    if (bc) bc.onclick = async () => { const code = await Sala.backup.encode(); copyText(code, "Código copiado. Na app nova: Definições → Importar."); };
    v.querySelector("[data-stay]").onclick = () => { try { sessionStorage.setItem(STAY, "1"); } catch (e) {} v.remove(); shown = null; dispatchEvent(new HashChangeEvent("hashchange")); };
    shown = v; document.title = "Mudámo-nos · Sala de Espera";
  }

  Sala.moving = { active: () => isOld && !stays(), show, isOld };
})();
