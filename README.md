# Sala de Espera

Jogos curtos numa app web instalável (PWA), feita para jogar nos intervalos. Funciona no telemóvel e no computador, com tema claro, escuro ou automático.

## Jogos
- **Sudoku** com cinco dificuldades, do Iniciante ao Diabólico, sempre com solução única. Cada puzzle é avaliado por um resolvedor lógico, para que a dificuldade corresponda às técnicas que pede. Inclui notas a lápis, desfazer e pistas.
- **Minas** com tabuleiros de 8×8 a 30×20 (cinco dificuldades). Os tabuleiros largos rodam no telemóvel ao alto e têm lupa para casas do tamanho do dedo. A primeira casa nunca rebenta.
- **Palavras**: descobrir uma palavra portuguesa de 4 a 7 letras em seis tentativas, em jogo livre (o cartão do menu, com o tamanho à escolha) ou com a palavra do dia, no desafio do dia (com sequência de dias seguidos; 4 letras à terça, 5 à segunda, quarta e sexta, 6 à quinta e ao sábado, 7 ao domingo). Os acentos e o ç aparecem sozinhos.
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

A mensagem do duelo leva o link e um **código curto** (por exemplo, `SUD-3HYF-VT75-BYN1-Rui`): três letras do jogo, os dados do duelo e o nome de quem desafia. Na app instalada, o botão **Duelo recebido**, no menu, aceita o código escrito à mão ou colado (sem distinguir maiúsculas, com ou sem hífenes) ou o link inteiro. Isto existe porque no iPhone os links abrem sempre no Safari, que guarda os dados à parte da app instalada; quando um link de duelo abre no browser, a app pergunta primeiro se a tens instalada e dá o código para levar para lá. O código usa o alfabeto Crockford base32 (sem I, L, O e U) e termina em dois caracteres de verificação, que apanham qualquer erro num só carácter; um código mal escrito é recusado em vez de abrir outro tabuleiro.

Tudo vai no próprio link ou código (no link, depois do `#`), por isso os duelos não precisam de servidor nem de conta. Em contrapartida, quem perceber o formato consegue falsificar um resultado: é um jogo entre amigos, não uma competição.

## Ranking online (opcional)
Vem desligado. Nas definições, **Ranking online → Ligar** pede uma alcunha e a confirmação de 13 anos ou mais, e dá um **código de recuperação** (16 letras e números) que é a chave da conta: serve para entrar noutro aparelho ("Já tenho conta") e não há email para o recuperar. A partir daí, cada jogo acabado segue para o servidor (se não houver rede, espera numa fila), e a janela do ranking ganha o separador **Online**, com o top 20 de cada jogo e dificuldade e do desafio do dia. **Apagar conta** apaga a alcunha e os resultados do servidor.

Entram o Sudoku, as Minas, o Solitário e a Dobra (cada dificuldade e o desafio do dia) e a palavra do dia. O servidor não confia nos pontos do aparelho: repete as jogadas no mesmo tabuleiro, com o mesmo código da app (`js/logic/`), e calcula-os ele próprio; o desafio do dia conta uma vez por conta e o mesmo tabuleiro também. O tempo vem do aparelho e só se recusam tempos impossíveis. Fora ficam a Cobra e o casino (pontos que o servidor não consegue confirmar) e o jogo livre das Palavras (a palavra é escolhida no aparelho). Na palavra do dia, online contam só os pontos da tentativa, sem o bónus de sequência. Nada disto impede quem escreva um programa para resolver os tabuleiros.

## Endereço
A app está em **https://saladeespera.pages.dev/**. O endereço antigo, no GitHub Pages, continua no ar só para encaminhar: mostra "Mudámo-nos", leva o progresso de quem lá jogava (dentro do próprio link, depois do `#`) e reencaminha os links de duelo antigos.

## Levar o progresso
Nas definições, **Exportar** dá um código (ou um ficheiro) com tudo o que a app guardou: recordes, estatísticas, rivais, desafios do dia e jogos a meio. Noutro aparelho, ou na app instalada, **Importar** e colar o código. Importar substitui o que esse aparelho tinha, mas fica uma cópia para **Desfazer importação**. O código leva uma verificação: cortado ou alterado, é recusado. Não há nuvem: o código passa de mão em mão.

## Instalar no iPhone
1. Abrir https://saladeespera.pages.dev/ no Safari.
2. Tocar em Partilhar → Adicionar ao ecrã principal.
3. Abrir pelo ícone: a app corre em ecrã inteiro e funciona offline.

No Android, ou no Chrome e no Edge do computador, a opção chama-se "Instalar app".

## Estrutura
- `index.html`: menu e ecrã de jogo comum.
- `css/base.css`: tema, componentes e estilos dos jogos.
- `js/core.js`: base comum (definições, som, janelas, efeitos, pontuação, ranking, estatísticas, desafio do dia, duelos e partilha).
- `js/logic/`: a parte dos jogos sem ecrã (geradores, regras, pontos e repetição das jogadas), usada pela app e pelo servidor.
- `js/games/`: um ficheiro por jogo.
- `js/online.js`: ranking online (conta, envio dos resultados e separador Online).
- `js/backup.js`: exportar e importar o progresso.
- `js/mudanca.js`: ecrã "Mudámo-nos" no endereço antigo.
- `js/app.js`: menu, navegação, contagem de visitas e arranque.
- `privacidade.html`: política de privacidade.
- `fonts/`: o tipo de letra Roboto, servido pelo próprio site.
- `functions/api/visita.js` e `server/visitas.sql`: contador de visitas (Cloudflare Pages Functions + D1).
- `functions/api/conta.js`, `resultado.js` e `ranking.js`, `server/lib/` e `server/online.sql`: servidor do ranking online.
- `scripts/publicar.sh` e `wrangler.toml`: publicação na Cloudflare.

Sem frameworks nem compilação: o alojamento serve os ficheiros tal como estão.

## Atualizar
Depois de alterar ficheiros, subir a versão em `sw.js` (`sala-v19` → `sala-v20`) para os aparelhos já instalados receberem a cópia nova. Se acrescentares ficheiros, junta-os também à lista `CORE` e a `scripts/publicar.sh`. Para publicar: `scripts/publicar.sh`, com `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` no ambiente. As tabelas do servidor criam-se uma vez com `npx wrangler d1 execute sala-de-espera --remote --file server/online.sql`; para testar tudo localmente, `npx wrangler pages dev .publicar` (depois de copiar a app para `.publicar/`, como faz o script) com a base local criada pelos mesmos ficheiros `.sql` e `--local`. O GitHub Pages recebe a mesma versão a cada envio para `main` (é o que mantém o "Mudámo-nos" atualizado).

Quem já tem a app instalada recebe a versão nova sozinho: ao abrir a app (ou de hora a hora), ela procura atualizações e mostra uma barra com o botão "Atualizar". Também dá para procurar à mão nas definições.

## Privacidade
Sem cookies, sem publicidade e sem pedidos a serviços de terceiros (o tipo de letra e o ranking vêm do próprio site). Os jogos a meio, as definições, o ranking local e as estatísticas ficam no armazenamento local do browser. Partilhar um resultado, um duelo ou um código de progresso só envia o que tu escolheres. Sem o ranking online ligado, o único pedido próprio é uma contagem de visitas, no máximo uma por dia e por aparelho, que o servidor guarda apenas como total diário, sem IP nem identificadores. Com o ranking online ligado, o servidor guarda a alcunha, um resumo do código de recuperação e os resultados (nada de email, IP ou aparelho), com prazos de apagamento. Os pormenores estão em [privacidade.html](privacidade.html).

## Créditos e licenças das listas de palavras
- `js/data/validas.js`, `validas-4.js`, `validas-6.js` e `validas-7.js` (palavras aceites nas Palavras) derivam do dicionário pt_PT do [Projecto Natura](https://natura.di.uminho.pt/), da Universidade do Minho (© 2006–2012 José João de Almeida, Rui Vilela e Alberto Simões), e são distribuídos sob a Mozilla Public License 1.1 (`licencas/MPL-1.1.txt`).
- `js/data/solucoes.js`, `solucoes-4.js`, `solucoes-6.js` e `solucoes-7.js` (soluções) são uma seleção de palavras desse dicionário, escolhidas com as frequências de legendas em português europeu do OpenSubtitles 2018 compiladas por [Hermit Dave](https://github.com/hermitdave/FrequencyWords). São distribuídos sob a licença CC BY-SA 4.0 (`licencas/CC-BY-SA-4.0.txt`). Alterações: revisão manual e ordem baralhada.
- O tipo de letra Roboto (© 2011 The Roboto Project Authors) é distribuído sob a SIL Open Font License 1.1 (`licencas/OFL-1.1-Roboto.txt`) e vem da coleção Fontsource, só com os caracteres latinos.
- O resto do código e do grafismo (incluindo o logótipo azulejo e o verso das cartas) é original.

## Aviso
Projeto pessoal e sem fins comerciais, disponibilizado tal como está, sem garantias de qualquer tipo. Os jogos incluídos são de domínio comum: os nomes, o código, o grafismo e os ícones são originais, sem ligação a nenhuma marca, empresa ou produto.
