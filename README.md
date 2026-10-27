# Sala de Espera

Jogos curtos numa app web instalável (PWA), feita para jogar nos intervalos. Funciona no telemóvel e no computador, com tema claro, escuro ou automático.

## Jogos
- **Sudoku** com cinco dificuldades, do Iniciante ao Diabólico, sempre com solução única. Cada puzzle é avaliado por um resolvedor lógico, para que a dificuldade corresponda às técnicas que pede. Inclui notas a lápis, desfazer e pistas.
- **Minas** com tabuleiros de 8×8 a 30×20 (cinco dificuldades). Os tabuleiros largos rodam no telemóvel ao alto e têm lupa para casas do tamanho do dedo. A primeira casa nunca rebenta.
- **Palavras**: descobrir uma palavra portuguesa de cinco letras em seis tentativas, em jogo livre (o cartão do menu) ou com a palavra do dia, no desafio do dia (com sequência de dias seguidos). Os acentos e o ç aparecem sozinhos.
- **Blackjack** com seis baralhos: a banca fica com qualquer 17, o blackjack paga 3 para 2, e dá para dobrar e dividir.
- **Roleta** europeia, de um só zero, com apostas em números, cores, par e ímpar, metades, dúzias e colunas.
- **Solitário** clássico de sete colunas, a tirar três cartas do baralho, com toque ou arrastar, desfazer e "completar sozinho".
- **Dobra**: juntar peças iguais, que dobram de valor, em tabuleiros de 3×3, 4×4 e 5×5, com três jogadas para desfazer por jogo.
- **Cobra** em três velocidades, com ou sem paredes, e uma maçã dourada de vez em quando.

O Blackjack e a Roleta partilham uma banca de fichas virtuais (sem valor real e sem compras), que começa com 1000 fichas. Cada banca, quando fecha, entra no ranking do casino com o maior saldo que atingiu.

Cada jogo tem uma janela "Como jogar", pontuação e um top 10 (por dificuldade, tabuleiro ou modo, consoante o jogo).

## Desafio do dia, estatísticas e partilha
- **Desafio do dia** (no topo do menu): a palavra do dia, um Sudoku Médio, um campo de Minas Médio e um baralho de Solitário iguais para toda a gente nesse dia, gerados a partir da data. Só a primeira tentativa conta; depois dá para repetir sem contar (exceto a palavra, que é uma por dia). As Minas do dia começam com uma zona já aberta, e o Solitário do dia pode terminar-se a meio, ficando os pontos feitos.
- **Estatísticas** por jogo e dificuldade, na janela do ranking: jogos, vitórias, sequência, melhor sequência e tempos (ou melhor pontuação e média, nos jogos só de pontos).
- **Partilhar resultado** no fim de cada jogo: imagem e texto para enviar a amigos (no telemóvel abre a folha de partilha; no computador dá para copiar ou guardar).

## Duelos por link
No fim de um jogo de Sudoku, Minas, Palavras (jogo livre), Solitário, Dobra ou Cobra, o botão **Desafiar** cria um link com o mesmo tabuleiro e o teu resultado. Quem o abrir joga esse tabuleiro e vê no fim "Tu vs" quem desafiou; com **Devolver desafio**, manda-te o resultado dele, e ao abrires esse link vês logo a comparação, sem jogar outra vez. As vitórias, derrotas e empates contra cada rival ficam no separador **Rivais** da janela do ranking. Os duelos não contam para o top 10 nem para as estatísticas.

Tudo vai no próprio link (depois do `#`), por isso não há servidor nem contas. Em contrapartida, quem perceber o formato consegue falsificar um resultado: é um jogo entre amigos, não uma competição. No iPhone, os links abrem no Safari, que guarda os dados à parte da app instalada.

## Instalar no iPhone
1. Abrir o endereço do GitHub Pages no Safari.
2. Tocar em Partilhar → Adicionar ao ecrã principal.
3. Abrir pelo ícone: a app corre em ecrã inteiro e funciona offline.

No Android, ou no Chrome e no Edge do computador, a opção chama-se "Instalar app".

## Estrutura
- `index.html`: menu e ecrã de jogo comum.
- `css/base.css`: tema, componentes e estilos dos jogos.
- `js/core.js`: base comum (definições, som, janelas, efeitos, pontuação, ranking, estatísticas, desafio do dia, duelos e partilha).
- `js/games/`: um ficheiro por jogo.
- `js/app.js`: menu, navegação e arranque.
- `fonts/`: o tipo de letra Roboto, servido pelo próprio site.

Sem frameworks nem compilação: o GitHub Pages serve os ficheiros tal como estão.

## Atualizar
Depois de alterar ficheiros, subir a versão em `sw.js` (`sala-v13` → `sala-v14`) para os aparelhos já instalados receberem a cópia nova. Se acrescentares ficheiros, junta-os também à lista `CORE`.

Quem já tem a app instalada recebe a versão nova sozinho: ao abrir a app (ou de hora a hora), ela procura atualizações e mostra uma barra com o botão "Atualizar". Também dá para procurar à mão nas definições.

## Privacidade
A app não tem contas, publicidade nem contadores de visitas, e não envia dados para lado nenhum. Os jogos a meio, as definições, o ranking e as estatísticas de jogo ficam guardados apenas no armazenamento local do teu browser. Partilhar um resultado ou um duelo só envia o que tu escolheres, pela folha de partilha do aparelho: no caso do duelo, o nome que escreveste, a pontuação, o tempo e o tabuleiro. O tipo de letra vem do próprio site, sem pedidos a serviços de terceiros.

## Créditos e licenças das listas de palavras
- `js/data/validas.js` (palavras aceites nas Palavras) deriva do dicionário pt_PT do [Projecto Natura](https://natura.di.uminho.pt/), da Universidade do Minho (© 2006–2012 José João de Almeida, Rui Vilela e Alberto Simões), e é distribuído sob a Mozilla Public License 1.1 (`licencas/MPL-1.1.txt`).
- `js/data/solucoes.js` (soluções) é uma seleção de palavras desse dicionário, escolhidas com as frequências de legendas em português europeu do OpenSubtitles 2018 compiladas por [Hermit Dave](https://github.com/hermitdave/FrequencyWords). É distribuído sob a licença CC BY-SA 4.0 (`licencas/CC-BY-SA-4.0.txt`). Alterações: revisão manual e ordem baralhada.
- O tipo de letra Roboto (© 2011 The Roboto Project Authors) é distribuído sob a SIL Open Font License 1.1 (`licencas/OFL-1.1-Roboto.txt`) e vem da coleção Fontsource, só com os caracteres latinos.
- O resto do código e do grafismo é original.

## Aviso
Projeto pessoal e sem fins comerciais, disponibilizado tal como está, sem garantias de qualquer tipo. Os jogos incluídos são de domínio comum: os nomes, o código, o grafismo e os ícones são originais, sem ligação a nenhuma marca, empresa ou produto.
