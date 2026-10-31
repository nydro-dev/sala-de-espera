/* Sala de Espera — Palavras sem ecrã: calendário da palavra do dia, pontos e verificação das tentativas (Fase 8).
   As listas de palavras chegam de fora (no browser, de js/data/; no servidor, importadas pelo validar.js).
   Corre no browser (js/games/palavras.js) e no servidor (functions/_lib/validar.js). */
(function (G) {
  "use strict";
  const L = G.SalaLogica;
  const TRIES = 6, LENS = [4, 5, 6, 7];
  const POINTS = [1000, 800, 600, 400, 250, 150];   /* por número de tentativas, igual em todos os tamanhos */
  const EPOCH = Date.UTC(2026, 9, 26);              /* palavra n.º 1: 26/10/2026 */
  /* A partir desta data, o tamanho da palavra do dia depende do dia da semana (antes, sempre 5). */
  const SIZES_FROM = "2026-10-28";
  const WEEK = [7, 5, 4, 5, 6, 5, 6];               /* domingo, segunda, terça, quarta, quinta, sexta, sábado */

  const key = w => w.normalize("NFD").replace(/[̀-ͯ]/g, "");  /* "ação" → "acao" */
  const words = s => (s || "").split(" ").filter(Boolean);
  const dayNumber = ds => { const [y, m, d] = ds.split("-").map(Number); return Math.floor((Date.UTC(y, m - 1, d) - EPOCH) / 864e5) + 1; };
  const dateOf = n => new Date(EPOCH + (n - 1) * 864e5).toISOString().slice(0, 10);
  const dailyLen = ds => ds < SIZES_FROM ? 5 : WEEK[new Date(EPOCH + (dayNumber(ds) - 1) * 864e5).getUTCDay()];
  /* Cada tamanho tem a sua fila: a palavra é a n.ª da lista desse tamanho, contando só os dias desse tamanho.
     Nas de 5 letras, os dias antes de SIZES_FROM contam todos, por isso a fila continua sem repetir. */
  function dailyWord(ds, SOLS) {
    const Ln = dailyLen(ds), n = dayNumber(ds); let k = 0;
    for (let i = 1; i <= n; i++) if (dailyLen(dateOf(i)) === Ln) k++;
    const list = SOLS[Ln];
    return list[((k - 1) % list.length + list.length) % list.length];
  }

  /* Para o servidor: soluções por tamanho e uma verificação rápida de "esta palavra existe" (sem acentos),
     feita com uma procura numa cadeia em vez de um Map com dezenas de milhares de entradas. */
  function listas(src) {
    const SOLS = {}, all = {};
    for (const n of LENS) {
      SOLS[n] = words(src.sol[n]);
      all[n] = " " + key(words(src.val[n]).concat(SOLS[n]).join(" ")) + " ";
    }
    return { SOLS, existe: k => typeof k === "string" && !!all[k.length] && /^[a-z]+$/.test(k) && all[k.length].includes(" " + k + " ") };
  }
  /* Confirma as tentativas da palavra do dia ds. Devolve { ok, won, tries, word } ou { erro }. */
  function repetir(o) {
    const { ds, guesses, lst } = o;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ds || "") || dayNumber(ds) < 1) return { erro: "dia" };
    const word = dailyWord(ds, lst.SOLS), wk = key(word);
    if (!Array.isArray(guesses) || !guesses.length || guesses.length > TRIES) return { erro: "tentativas" };
    const seen = new Set();
    for (let i = 0; i < guesses.length; i++) {
      const g = guesses[i]; if (typeof g !== "string" || g.length > 12) return { erro: "tentativas" };
      const k = key(g.toLowerCase());
      if (k.length !== wk.length || !lst.existe(k) || seen.has(k)) return { erro: "palavra" };
      seen.add(k);
      if (k === wk && i !== guesses.length - 1) return { erro: "tentativas" };
    }
    const won = key(guesses[guesses.length - 1].toLowerCase()) === wk;
    if (!won && guesses.length !== TRIES) return { erro: "por acabar" };
    return { ok: true, won, tries: guesses.length, word };
  }

  L.palavras = { TRIES, LENS, POINTS, EPOCH, SIZES_FROM, WEEK, key, words, dayNumber, dateOf, dailyLen, dailyWord, listas, repetir };
})(typeof globalThis !== "undefined" ? globalThis : self);
