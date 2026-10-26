# Sala de Espera

Jogos curtos numa app web instalável (PWA), feita para jogar nos intervalos. Funciona no telemóvel e no computador, com tema claro, escuro ou automático.

## Jogos
- **Sudoku** com três dificuldades, sempre com solução única. Inclui notas a lápis, desfazer e pistas.
- **Minas** com tabuleiros de 9×9, 16×16 e 30×16 (que roda para 16×30 no telemóvel ao alto). A primeira casa nunca rebenta.
- **Blackjack** com seis baralhos: a banca fica com qualquer 17, o blackjack paga 3 para 2, e dá para dobrar e dividir.
- **Roleta** europeia, de um só zero, com apostas em números, cores, par e ímpar, metades, dúzias e colunas.
- Em preparação: 2048, Palavras, Solitário e Cobra.

O Blackjack e a Roleta partilham uma banca de fichas virtuais (sem valor real e sem compras), que começa com 1000 fichas. Cada banca, quando fecha, entra no ranking do casino com o maior saldo que atingiu.

Cada jogo tem uma janela "Como jogar", pontuação e um top 10 (por dificuldade no Sudoku e nas Minas).

## Instalar no iPhone
1. Abrir o endereço do GitHub Pages no Safari.
2. Tocar em Partilhar → Adicionar ao ecrã principal.
3. Abrir pelo ícone: a app corre em ecrã inteiro e funciona offline.

No Android, ou no Chrome e no Edge do computador, a opção chama-se "Instalar app".

## Estrutura
- `index.html`: menu e ecrã de jogo comum.
- `css/base.css`: tema, componentes e estilos dos jogos.
- `js/core.js`: base comum (definições, som, janelas, efeitos, pontuação e ranking).
- `js/games/`: um ficheiro por jogo.
- `js/app.js`: menu, navegação e arranque.

Sem frameworks nem compilação: o GitHub Pages serve os ficheiros tal como estão.

## Atualizar
Depois de alterar ficheiros, subir a versão em `sw.js` (`sala-v5` → `sala-v6`) para os aparelhos já instalados receberem a cópia nova. Se acrescentares ficheiros, junta-os também à lista `CORE`.

## Privacidade
A app não tem contas, publicidade nem estatísticas, e não envia dados para lado nenhum. Os jogos a meio, as definições e o ranking ficam guardados apenas no armazenamento local do teu browser. O tipo de letra é carregado do Google Fonts na primeira utilização.

## Aviso
Projeto pessoal e sem fins comerciais, disponibilizado tal como está, sem garantias de qualquer tipo. Os jogos incluídos são de domínio comum: o código, o grafismo e os ícones são originais, sem ligação a nenhuma marca ou produto, incluindo o Minesweeper da Microsoft.
