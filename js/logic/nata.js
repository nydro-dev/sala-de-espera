/* Sala de Espera — Pastel de Nata (jogo idle): regras sem ecrã.
   Começa-se a enrolar massa à mão e acaba-se com uma rede de pastelarias que chega à Lua.
   Tudo aqui é puro (sem relógio, ecrã nem armazenamento): quem chama passa o "agora" em milissegundos.
   Não entra no ranking online (mexer no relógio do aparelho daria batota fácil). */
(function (G) {
  "use strict";
  const L = G.SalaLogica || (G.SalaLogica = {});

  const GROWTH = 1.15;                 /* cada unidade do mesmo produtor custa mais 15% */
  const OFFLINE_MAX = 8 * 3600 * 1000; /* teto do ganho com a app fechada: 8 horas (escolha do Rui Pedro, 10/11/2026) */
  const RECIPE_BONUS = 0.1;            /* cada receita do convento dá +10% à produção, para sempre */
  const RECIPE_UNIT = 3e7;             /* receitas = raiz cúbica (pastéis feitos nesta fundação / 30 milhões) */

  /* Produtores: custo inicial e pastéis por segundo de cada unidade. Valores afinados com scripts/simular-nata.js
     (10/11/2026): com 3 visitas de 2 minutos por dia, um produtor novo a cada 1 a 2 dias, a Lua por volta do 7.º dia
     e 10 receitas do convento por volta do 14.º. */
  const PROD = [
    { id: "avo",     name: "Avó Rosa",               desc: "Enrola massa como ninguém, sem pressa.", cost: 15,    pps: 0.1 },
    { id: "forno",   name: "Forno a lenha",          desc: "Quatrocentos graus e crosta estaladiça.", cost: 330,   pps: 0.45 },
    { id: "bairro",  name: "Pastelaria de bairro",   desc: "Bica e nata ao balcão, desde as sete.",   cost: 7300,  pps: 2 },
    { id: "fabrica", name: "Fábrica",                desc: "Tapetes rolantes de massa folhada.",       cost: 4e5,   pps: 10 },
    { id: "franq",   name: "Franchising",            desc: "Uma pastelaria em cada centro comercial.", cost: 1.2e7, pps: 46 },
    { id: "macau",   name: "Contentores para Macau", desc: "A nata volta a dar a volta ao mundo.",    cost: 1.6e8, pps: 200 },
    { id: "lua",     name: "Filial na Lua",          desc: "Sem gravidade, a massa sobe sozinha.",     cost: 1.5e9, pps: 950 }
  ];

  /* Melhorias. Por produtor: três que dobram a produção desse produtor (ao ter 1, 10 e 25).
     Gerais: clique e produção total. "need" diz quando aparecem. */
  const PUP = [
    ["Rolo da avó", "Avental de linho", "Netas a ajudar"],
    ["Lenha de azinho", "Pá de forneiro", "Segundo forno"],
    ["Montra de vidro", "Fornada das sete", "Esplanada"],
    ["Turno da noite", "Tapete mais rápido", "Massa congelada à prova de bala"],
    ["Toldo às riscas", "Loja no aeroporto", "Livro de estilo"],
    ["Navio frigorífico", "Porto de Sines", "Rota da seda doce"],
    ["Fato pressurizado", "Forno solar", "Base em Copérnico"]
  ];
  const UP = [];
  PROD.forEach((p, i) => [1, 10, 25].forEach((n, k) => UP.push({
    id: p.id + k, name: PUP[i][k], kind: "prod", prod: i, need: n,
    cost: p.cost * [10, 50, 500][k], desc: p.name + ": produção a dobrar."
  })));
  UP.push(
    { id: "canela",  name: "Canela de Ceilão",               kind: "click", need: { tot: 500 },   cost: 500,   desc: "Cada toque vale também 1% dos pastéis por segundo." },
    { id: "acucar",  name: "Açúcar em pó",                   kind: "click2", need: { tot: 5000 }, cost: 5000,  desc: "Toques a dobrar." },
    { id: "folhada", name: "Massa folhada de três voltas",   kind: "all", mult: 1.5, need: { tot: 2e5 }, cost: 2e5, desc: "Toda a produção +50%." },
    { id: "segredo", name: "A receita secreta do convento",  kind: "all", mult: 2, need: { tot: 2e7 }, cost: 2e7, desc: "Toda a produção a dobrar." }
  );

  function fresh(now) {
    return { v: 1, p: 0, tot: 0, all: 0, own: PROD.map(() => 0), up: [], rec: 0, taps: 0, last: now || 0, founded: 0 };
  }
  /* Repara um estado lido do aparelho (campos em falta, números estragados). */
  function fix(S, now) {
    const f = fresh(now);
    if (!S || typeof S !== "object") return f;
    const num = (x, d) => (typeof x === "number" && isFinite(x) && x >= 0 ? x : d);
    const out = { v: 1, p: num(S.p, 0), tot: num(S.tot, 0), all: num(S.all, 0), rec: Math.floor(num(S.rec, 0)), taps: num(S.taps, 0),
      last: num(S.last, now || 0), founded: Math.floor(num(S.founded, 0)),
      own: PROD.map((_, i) => Math.floor(num(S.own && S.own[i], 0))),
      up: Array.isArray(S.up) ? S.up.filter(id => UP.some(u => u.id === id)) : [] };
    return out;
  }

  const has = (S, id) => S.up.indexOf(id) >= 0;
  const recipeMult = S => 1 + RECIPE_BONUS * S.rec;
  function allMult(S) { let m = recipeMult(S); UP.forEach(u => { if (u.kind === "all" && has(S, u.id)) m *= u.mult; }); return m; }
  function prodMult(S, i) { let m = 1; UP.forEach(u => { if (u.kind === "prod" && u.prod === i && has(S, u.id)) m *= 2; }); return m; }
  /* Pastéis por segundo de um produtor (todas as unidades) e do total. */
  const ppsOf = (S, i) => S.own[i] * PROD[i].pps * prodMult(S, i) * allMult(S);
  const pps = S => PROD.reduce((t, _, i) => t + ppsOf(S, i), 0);
  /* Pastéis por toque. */
  function perTap(S) {
    let v = 1 * recipeMult(S);
    if (has(S, "acucar")) v *= 2;
    if (has(S, "canela")) v += pps(S) * 0.01;
    return v;
  }
  /* Custo da próxima unidade (ou das próximas n). */
  function cost(S, i, n) {
    n = n || 1; const c0 = PROD[i].cost * Math.pow(GROWTH, S.own[i]);
    return Math.ceil(n === 1 ? c0 : c0 * (Math.pow(GROWTH, n) - 1) / (GROWTH - 1));
  }
  /* Quantas unidades se podem comprar já (máx. 1000). */
  function maxBuy(S, i) { let n = 0; while (n < 1000 && cost(S, i, n + 1) <= S.p) n++; return n; }

  /* Um produtor aparece quando já se viu metade do custo inicial dele, ou se já se tem algum. */
  const prodVisible = (S, i) => S.own[i] > 0 || S.tot >= PROD[i].cost * 0.5 || (i === 0);
  /* Melhorias escondidas até se fazerem pastéis suficientes nesta fundação (metade do preço; pedido do
     Rui Pedro a 10/11/2026). Depois de aparecer, não volta a esconder-se. As dos produtores pedem também
     ter unidades desse produtor. */
  const upReveal = u => u.cost * 0.5;
  const upReady = (S, u) => u.kind === "prod" ? S.own[u.prod] >= u.need : true;
  function upVisible(S, u) {
    if (has(S, u.id)) return false;
    return upReady(S, u) && S.tot >= upReveal(u);
  }
  const upsAvailable = S => UP.filter(u => upVisible(S, u)).sort((a, b) => a.cost - b.cost);
  /* Pastéis feitos a partir dos quais aparece a próxima melhoria escondida (ou null). */
  function nextUpAt(S) {
    let best = null;
    UP.forEach(u => { if (!has(S, u.id) && upReady(S, u) && S.tot < upReveal(u) && (best === null || upReveal(u) < best)) best = upReveal(u); });
    return best;
  }

  function gain(S, n) { if (n > 0) { S.p += n; S.tot += n; S.all += n; } }
  function tap(S) { const v = perTap(S); gain(S, v); S.taps++; return v; }
  function buy(S, i, n) {
    n = n || 1; const c = cost(S, i, n);
    if (c > S.p) return false; S.p -= c; S.own[i] += n; return true;
  }
  function buyUp(S, id) {
    const u = UP.find(x => x.id === id); if (!u || !upVisible(S, u) || u.cost > S.p) return false;
    S.p -= u.cost; S.up.push(id); return true;
  }

  /* Avança o tempo até "now". Ao abrir a app, o tempo fora tem teto de 8 h; se o relógio andou
     para trás, não se ganha nada e o relógio passa a contar a partir daí. Devolve o que se ganhou. */
  function advance(S, now, opts) {
    let dt = now - S.last;
    if (!(dt > 0)) { S.last = now; return { made: 0, secs: 0, capped: false }; }
    const capped = dt > OFFLINE_MAX; if (capped) dt = OFFLINE_MAX;
    const made = pps(S) * dt / 1000;
    gain(S, made); S.last = now;
    return { made, secs: dt / 1000, capped: capped && !(opts && opts.live) };
  }

  /* Prestígio: "Fundar novo convento". Receitas totais que se teriam com os pastéis feitos nesta fundação. */
  const recipesFor = tot => Math.floor(Math.cbrt(tot / RECIPE_UNIT));
  const recipesGain = S => recipesFor(S.tot);
  function found(S, now) {
    const g = recipesGain(S); if (g < 1) return 0;
    const keep = { rec: S.rec + g, all: S.all, taps: S.taps, founded: S.founded + 1 };
    Object.assign(S, fresh(now), keep);
    return g;
  }

  /* Números grandes à portuguesa (escala longa): mil, milhões, mil milhões, biliões... */
  const NAMES = [[1e24, "quatriliões", "quatrilião"], [1e21, "mil triliões"], [1e18, "triliões", "trilião"], [1e15, "mil biliões"],
    [1e12, "biliões", "bilião"], [1e9, "mil milhões"], [1e6, "milhões", "milhão"]];
  function fmt(n) {
    n = Math.floor(n);
    if (n < 1e6) return n.toLocaleString("pt-PT").replace(/ | /g, " ");
    for (const [v, pl, sg] of NAMES) if (n >= v) {
      const x = n / v, s = (x < 10 ? Math.floor(x * 100) / 100 : x < 100 ? Math.floor(x * 10) / 10 : Math.floor(x)).toLocaleString("pt-PT");
      return s + " " + (sg && x < 2 ? sg : pl);
    }
    return String(n);
  }
  /* Taxas com uma casa decimal quando pequenas. */
  const fmtRate = n => n < 10 ? (Math.round(n * 10) / 10).toLocaleString("pt-PT") : fmt(n);

  L.nata = { PROD, UP, GROWTH, OFFLINE_MAX, RECIPE_BONUS, fresh, fix, pps, ppsOf, perTap, cost, maxBuy, prodVisible, upVisible,
    upsAvailable, nextUpAt, tap, buy, buyUp, advance, gain, recipesFor, recipesGain, found, fmt, fmtRate, has };
})(typeof globalThis !== "undefined" ? globalThis : self);
