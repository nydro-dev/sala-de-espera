/* As listas de palavras (js/data/) escrevem em window, como no browser. No servidor, window é o próprio
   globalThis. Tem de ser importado antes delas. */
globalThis.window = globalThis;
