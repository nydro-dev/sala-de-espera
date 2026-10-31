/* Sala de Espera — lógica sem ecrã, partilhada entre a app e o servidor (Fase 8).
   Os ficheiros de js/logic/ correm no browser (como scripts normais, antes do core.js) e nas funções
   do servidor (importados pelo functions/_lib/validar.js), para que o servidor possa repetir as jogadas
   com exatamente as mesmas regras e os mesmos tabuleiros. Não podem tocar no ecrã, no armazenamento,
   no relógio nem em Math.random (exceto onde se diz). Tudo fica em SalaLogica. */
(function (G) {
  "use strict";
  const L = G.SalaLogica || (G.SalaLogica = {});

  /* Gerador com semente: a mesma frase dá sempre a mesma sequência, em qualquer aparelho. */
  L.rng = function rng(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
    let a = h >>> 0;
    return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  };
  /* Baralhar (Fisher–Yates). Sem gerador usa Math.random: só para coisas que não precisam de se repetir. */
  L.shuffle = (a, rnd) => { rnd = rnd || Math.random; for (let i = a.length - 1; i > 0; i--) { const j = rnd() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  /* Semente do desafio do dia de um jogo numa data (AAAA-MM-DD). */
  L.diario = (jogo, ds) => L.rng("sala-de-espera:" + jogo + ":" + ds);
  /* Sementes curtas: 16 bits em base 36 com 4 caracteres. */
  L.SEED_MAX = 65536;
  L.seedNum = s => typeof s === "string" && /^[0-9a-z]{4}$/.test(s) && parseInt(s, 36) < L.SEED_MAX ? parseInt(s, 36) : -1;
  L.seedStr = n => n.toString(36).padStart(4, "0");
})(typeof globalThis !== "undefined" ? globalThis : self);
