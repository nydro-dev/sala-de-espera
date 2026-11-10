/* Simulador do Pastel de Nata: joga sozinho durante N dias com um perfil de jogador e diz
   em que dia chega cada produtor, quantos pastéis por segundo tem e quantas receitas do convento
   teria ao fundar. Uso: node scripts/simular-nata.js [dias] */
require("../js/logic/base.js");
require("../js/logic/nata.js");
const N = globalThis.SalaLogica.nata;

const PERFIS = {
  /* 3 visitas por dia (8h, 13h, 21h) de 2 minutos, ~3 toques por segundo: o alvo dos "5 minutos por dia" */
  alvo: { sessoes: [[8, 120], [13, 120], [21, 120]], toques: 3 },
  /* uma visita de 2 minutos por dia, de manhã */
  pouco: { sessoes: [[9, 120]], toques: 3 },
  /* viciado: 6 visitas de 5 minutos */
  muito: { sessoes: [[8, 300], [10, 300], [13, 300], [16, 300], [19, 300], [22, 300]], toques: 5 }
};

/* Compra gananciosa: o que paga mais depressa (custo / ganho em pastéis por segundo). */
function compras(S) {
  for (let guard = 0; guard < 200; guard++) {
    const base = N.pps(S) + N.perTap(S) * 0.5; let best = null;
    N.PROD.forEach((p, i) => {
      if (!N.prodVisible(S, i)) return;
      const c = N.cost(S, i); S.own[i]++; const d = N.pps(S) + N.perTap(S) * 0.5 - base; S.own[i]--;
      if (d > 0) { const r = c / d; if (!best || r < best.r) best = { r, c, f: () => N.buy(S, i) }; }
    });
    N.upsAvailable(S).forEach(u => {
      S.up.push(u.id); const d = N.pps(S) + N.perTap(S) * 0.5 - base; S.up.pop();
      if (d > 0) { const r = u.cost / d; if (!best || r < best.r) best = { r, c: u.cost, f: () => N.buyUp(S, u.id) }; }
    });
    if (!best || best.c > S.p) return;
    best.f();
  }
}

function simular(perfil, dias, fundarEm) {
  const H = 3600e3, D = 24 * H;
  let S = N.fresh(0); const chegou = {}, linhas = []; let fundou = [];
  for (let d = 0; d < dias; d++) {
    for (const [h, dur] of perfil.sessoes) {
      const t0 = d * D + h * H;
      N.advance(S, t0); compras(S);
      for (let s = 0; s < dur; s++) {
        for (let k = 0; k < perfil.toques; k++) N.tap(S);
        N.advance(S, t0 + (s + 1) * 1000, { live: true });
        if (s % 5 === 4) compras(S);
      }
      N.PROD.forEach((p, i) => { if (S.own[i] && !chegou[p.name]) chegou[p.name] = d + 1; });
      if (fundarEm && N.recipesGain(S) >= fundarEm) { fundou.push({ dia: d + 1, ganhou: N.found(S, t0 + dur * 1000) }); }
    }
    linhas.push({ dia: d + 1, pps: N.pps(S), tot: S.tot, rec: N.recipesGain(S), prod: S.own.join("/"), ups: S.up.length });
  }
  return { chegou, linhas, fundou, S };
}

const dias = +process.argv[2] || 21;
for (const [nome, p] of Object.entries(PERFIS)) {
  const r = simular(p, dias);
  console.log("\n== Perfil " + nome + " ==");
  console.log("Primeiro de cada produtor (dia):", JSON.stringify(r.chegou));
  r.linhas.filter(l => [1, 2, 3, 5, 7, 10, 14, 21, 30].includes(l.dia)).forEach(l =>
    console.log("dia " + String(l.dia).padStart(2) + ": " + N.fmtRate(l.pps).padStart(14) + " p/s · feitos " + N.fmt(l.tot).padStart(16) + " · receitas ao fundar " + l.rec + " · produtores " + l.prod + " · melhorias " + l.ups));
}
/* Com prestígio: o perfil alvo funda quando tiver pelo menos 10 receitas. */
const rf = simular(PERFIS.alvo, 45, 10);
console.log("\n== Alvo com prestígio (funda com >=10 receitas), 45 dias ==");
console.log("Fundações:", JSON.stringify(rf.fundou));
console.log("Fim: " + N.fmtRate(N.pps(rf.S)) + " p/s, receitas " + rf.S.rec + ", produtores " + rf.S.own.join("/"));
