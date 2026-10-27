# Sala de Espera

Jogos curtos numa app web instalável (PWA), feita para jogar nos intervalos. Funciona no telemóvel e no computador, com tema claro, escuro ou automático.

## Jogos
- **Sudoku** com cinco dificuldades, do Iniciante ao Diabólico, sempre com solução única. Cada puzzle é avaliado por um resolvedor lógico, para que a dificuldade corresponda às técnicas que pede. Inclui notas a lápis, desfazer e pistas.
- **Minas** com tabuleiros de 8×8 a 30×20 (cinco dificuldades). Os tabuleiros largos rodam no telemóvel ao alto e têm lupa para casas do tamanho do dedo. A primeira casa nunca rebenta.
- **2048** em tabuleiros de 3×3, 4×4 e 5×5, com três jogadas para desfazer por jogo.
- **Palavras**: descobrir uma palavra portuguesa de cinco letras em seis tentativas, com palavra do dia (e sequência de dias seguidos) ou jogo livre. Os acentos e o ç aparecem sozinhos.
- **Blackjack** com seis baralhos: a banca fica com qualquer 17, o blackjack paga 3 para 2, e dá para dobrar e dividir.
- **Roleta** europeia, de um só zero, com apostas em números, cores, par e ímpar, metades, dúzias e colunas.
- **Solitário** clássico de sete colunas, a tirar três cartas do baralho, com toque ou arrastar, desfazer e "completar sozinho".
- **Cobra** em três velocidades, com ou sem paredes, e uma maçã dourada de vez em quando.

O Blackjack e a Roleta partilham uma banca de fichas virtuais (sem valor real e sem compras), que começa com 1000 fichas. Cada banca, quando fecha, entra no ranking do casino com o maior saldo que atingiu.

Cada jogo tem uma janela "Como jogar", pontuação e um top 10 (por dificuldade, tabuleiro ou modo, consoante o jogo).

## Desafio do dia, estatísticas e partilha
- **Desafio do dia** (no topo do menu): um Sudoku Médio, um campo de Minas Médio e um baralho de Solitário iguais para toda a gente nesse dia, gerados a partir da data. Só a primeira tentativa conta; depois dá para repetir sem contar. As Minas do dia começam com uma zona já aberta, e o Solitário do dia pode terminar-se a meio, ficando os pontos feitos.
- **Estatísticas** por jogo e dificuldade, na janela do ranking: jogos, vitórias, sequência, melhor sequência e tempos (ou melhor pontuação e média, nos jogos só de pontos).
- **Partilhar resultado** no fim de cada jogo: imagem e texto para enviar a amigos (no telemóvel abre a folha de partilha; no computador dá para copiar ou guardar).

## Instalar no iPhone
1. Abrir o endereço do GitHub Pages no Safari.
2. Tocar em Partilhar → Adicionar ao ecrã principal.
3. Abrir pelo ícone: a app corre em ecrã inteiro e funciona offline.

No Android, ou no Chrome e no Edge do computador, a opção chama-se "Instalar app".

## Estrutura
- `index.html`: menu e ecrã de jogo comum.
- `css/base.css`: tema, componentes e estilos dos jogos.
- `js/core.js`: base comum (definições, som, janelas, efeitos, pontuação, ranking, estatísticas, desafio do dia e partilha).
- `js/games/`: um ficheiro por jogo.
- `js/app.js`: menu, navegação e arranque.

Sem frameworks nem compilação: o GitHub Pages serve os ficheiros tal como estão.

## Atualizar
Depois de alterar ficheiros, subir a versão em `sw.js` (`sala-v10` → `sala-v11`) para os aparelhos já instalados receberem a cópia nova. Se acrescentares ficheiros, junta-os também à lista `CORE`.

Quem já tem a app instalada recebe a versão nova sozinho: ao abrir a app (ou de hora a hora), ela procura atualizações e mostra uma barra com o botão "Atualizar". Também dá para procurar à mão nas definições.

## Privacidade
A app não tem contas, publicidade nem contadores de visitas, e não envia dados para lado nenhum. Os jogos a meio, as definições, o ranking e as estatísticas de jogo ficam guardados apenas no armazenamento local do teu browser. Partilhar um resultado só envia o que tu escolheres, pela folha de partilha do aparelho. O tipo de letra é carregado do Google Fonts na primeira utilização.

## Créditos e licenças das listas de palavras
- `js/data/validas.js` (palavras aceites nas Palavras) deriva do dicionário pt_PT do [Projecto Natura](https://natura.di.uminho.pt/), da Universidade do Minho (© 2006–2012 José João de Almeida, Rui Vilela e Alberto Simões), e é distribuído sob a Mozilla Public License 1.1 (`licencas/MPL-1.1.txt`).
- `js/data/solucoes.js` (soluções) é uma seleção de palavras desse dicionário, escolhidas com as frequências de legendas em português europeu do OpenSubtitles 2018 compiladas por [Hermit Dave](https://github.com/hermitdave/FrequencyWords). É distribuído sob a licença CC BY-SA 4.0 (`licencas/CC-BY-SA-4.0.txt`). Alterações: revisão manual e ordem baralhada.
- O resto do código e do grafismo é original.

## Aviso
Projeto pessoal e sem fins comerciais, disponibilizado tal como está, sem garantias de qualquer tipo. Os jogos incluídos são de domínio comum: o código, o grafismo e os ícones são originais, sem ligação a nenhuma marca ou produto, incluindo o Minesweeper e o Solitaire da Microsoft.
