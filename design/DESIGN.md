# Leve — sistema de design

> Seu dinheiro, com mais respiro. Calmo, não frio. Simples, não vazio.

Kit portátil do sistema de design criado no Figma (nov/2026) e usado no app Leve. Para usar em outro projeto, copie a pasta `design/` inteira e inclua:

```html
<link rel="stylesheet" href="design/leve.css">
```

Abra `exemplo.html` para ver todos os componentes nos temas claro e escuro.

## Conteúdo da pasta

| Arquivo | O que é |
|---|---|
| `leve.css` | Tokens (cores, tipografia, espaços, cantos) nos temas claro e escuro, mais os componentes com prefixo `lv-` |
| `fonts/` | Inter 400, 500 e 600 em woff2 (@fontsource/inter 5.1.0). Não depende do Google Fonts. |
| `simbolo.svg` | O símbolo do Leve, a "dobra" do "l". **É a marca do app Leve:** num produto diferente, troque por um símbolo próprio. |
| `exemplo.html` | Página de referência com todos os componentes |

## Princípios

1. **Ameixa para agir, pastéis para organizar.** Botões, aba ativa e barras usam ameixa. Lavanda, sálvia e pêssego agrupam e dão estado.
2. **Cor nunca substitui texto.** Toda barra tem o valor e a meta escritos. Todo ícone tem rótulo.
3. **Valores sempre visíveis**, em números grandes e com peso médio, nunca em negrito pesado.
4. **Menos ruído:** cartões brancos sem sombra, só um contorno fino. Nada de gradientes, elementos girados, sombras duras ou decorações animadas.
5. **Sem culpa:** textos diretos e gentis ("Você ainda pode gastar", "O limite está perto"), nunca alarmistas.

## Paleta

| Nome | Hex | Uso |
|---|---|---|
| Ameixa | `#59416D` | Ação: botões, aba ativa, barras, links |
| Lavanda | `#EAE2F3` | Destaque principal (cartão da semana), chip e aba ativos |
| Sálvia | `#DFEBDD` | Positivo, dinheiro guardado, "dentro do limite" |
| Pêssego | `#F8E8DD` | Atenção, limite perto ou estourado |
| Marfim | `#F8F7F3` | Fundo da página |
| Tinta | `#292332` | Texto principal e botão escuro |

No código, use os **papéis**, não a paleta direto. Assim o tema escuro funciona sozinho:

| Token | Claro | Escuro |
|---|---|---|
| `--fundo` | marfim | `#17141C` |
| `--superficie` / `--superficie-2` | `#FFF` / `#F2F0EC` | `#211D28` / `#2B2633` |
| `--texto` / `--suave` | tinta / `#77707F` | `#F2EFF5` / `#A39CAE` |
| `--linha` | `#ECE9E4` | `#322C3A` |
| `--acao` / `--acao-texto` | ameixa / branco | `#C3ABDD` / `#221C2A` |
| `--lavanda`, `--salvia`, `--pessego` | pastéis | versões escuras apagadas |
| `--lavanda-texto`, `--salvia-texto`, `--pessego-texto` | texto legível sobre cada pastel | idem |
| `--positivo`, `--alerta`, `--aviso` | `#4F7D56`, `#B4574B`, `#B98545` | versões claras |
| `--cat-1` … `--cat-8` | cores de categoria (tons de pastel) | versões claras |

O tema escuro segue o aparelho. Para forçar um tema, use `<html data-theme="light">` ou `data-theme="dark"`. Para escolher pelo app sem piscar, aplique o atributo num script pequeno no `<head>`, como faz o `tema.js` do Leve.

## Tipografia

Uma fonte só: **Inter**. Use quase sempre 400 e 500; o 600 fica só para detalhes.

| Papel | Tamanho | Peso | Classe |
|---|---|---|---|
| Display (valor principal) | 38 | 500, espaçamento −3% | `.lv-display` |
| Título da tela | 28 | 500, −2% | `.lv-titulo` |
| Seção | 18 | 500 | `.lv-secao` |
| Corpo e ação | 14–15 | 400 / 500 | — |
| Apoio | 12 | 400, cor `--suave` | `.lv-apoio` |
| Rótulo ("SUA SEMANA") | 11, maiúsculas, +6% | 500 | `.lv-rotulo` |

Números com `font-variant-numeric: tabular-nums` (`.lv-num`).

## Ritmo

- **Espaços (base 4):** 4 · 8 · 12 · 16 · 24 · 32 (`--e-1` … `--e-6`). Margem lateral de 16 px no celular.
- **Cantos:** 12 para campos e ícones (`--r-p`), 20 para cartões (`--r-m`), 28 para o cartão de destaque e os painéis (`--r-g`). Botões ficam com 14, chips e controles segmentados são pílulas.
- **Toque mínimo:** 44 px (`--toque`). Botões principais têm 52 de altura.
- Campos com `font-size: 16px`, senão o iOS dá zoom ao tocar.
- Respeite as safe areas do iPhone (`env(safe-area-inset-*)`).

## Componentes

| Componente | Classes | Notas |
|---|---|---|
| Botão principal | `.lv-btn` | Ameixa. No máximo um por tela/área. |
| Botão escuro / secundário / neutro | `.lv-btn--escuro`, `.lv-btn--sec`, `.lv-btn--neutro` | O secundário é branco com contorno e ícone ameixa |
| Botão só ícone | `.lv-btn.lv-btn--sec.lv-btn--icone` | Sempre com `aria-label` |
| Botão redondo (+) | `.lv-btn-redondo` | Adicionar dentro de uma lista |
| Chip | `.lv-chip`, `--lavanda`, `--salvia`, `--pessego` | Filtros e estados ("Este mês", "Dentro do limite") |
| Cartão | `.lv-card`, `--lavanda`, `--salvia`, `--pessego`, `--destaque` | Branco com contorno, ou pastel sem contorno |
| Barra de progresso | `.lv-barra > b` | Largura via `style="width:42%"`; valor e meta escritos ao lado |
| Barra empilhada | `.lv-pilha > b` | Uma cor de categoria por parte |
| Ícone tingido | `.lv-ico` com `style="--c:var(--cat-2)"` | Quadrado pastel com o ícone na cor |
| Lista | `.lv-lista > .lv-item` | Ícone, título + apoio e valor à direita; divisórias finas |
| Segmentado | `.lv-seg > button[aria-pressed]` | Pílula; opção ativa em lavanda |
| Campo | `.lv-campo > label + input` | — |
| Abas simples | `.lv-abas > .lv-aba[aria-current="page"]` | Barra presa ao rodapé, até 4 itens; a ativa num fundo lavanda |
| Abas flutuantes | `.lv-flutuante > .lv-pilula` (+ `.lv-fab`) | Pílula solta do rodapé com 4 abas e a ação principal no meio. Detalhes abaixo. |
| Painel | `.lv-painel` | Sobe de baixo, cantos 28 e "alça" no topo |

## Barra de abas flutuante

Pílula solta do rodapé, com quatro abas e um botão redondo de ação no meio. Foi testada como app da Tela de Início no iPhone, nos temas claro e escuro.

```
            ┌──────┐
 ╭──────────┤  +   ├──────────╮   ← botão redondo: sobe 30 px acima da pílula
 │ ⌂     ◎  └──────┘  ≡     🔔 │   ← pílula: 4 abas + vão central de 72 px
 ╰─────────────────────────────╯
        10 px + área segura do iPhone
```

| Parte | Medida | Token / valor |
|---|---|---|
| Margens laterais | 16 px | — |
| Distância do rodapé | 10 px + `env(safe-area-inset-bottom)` | — |
| Pílula | até 480 px, centralizada; respiro 8; cantos 24 | `--superficie`, contorno `--linha` |
| Sombra da pílula | `0 8px 24px` a 12% | só para destacar do conteúdo que passa por baixo |
| Colunas | `1fr 1fr 72px 1fr 1fr` | vão central para o botão |
| Aba | 52 de altura, cantos 16, ícone 22 (traço 1,8), rótulo 11/500 | inativa `--suave`; ativa `--lavanda` / `--lavanda-texto` |
| Botão central | círculo de 58, `margin-top:-30px`, ícone 26 (traço 2,2) | `--acao` / `--acao-texto`; anel `0 0 0 5px var(--fundo)` |
| Ao tocar no botão | escala 0,94 | `--ease` |
| Altura ocupada | 78 px + área segura | `--abas-h` |

```html
<nav class="lv-flutuante" aria-label="Seções">
  <div class="lv-pilula">
    <a href="#/" aria-current="page"><svg class="i" …/>Início</a>
    <a href="#/perto"><svg class="i" …/>Perto</a>
    <a href="#/buscar" class="lv-fab" aria-label="Buscar"><svg class="i" …/></a>
    <a href="#/linhas"><svg class="i" …/>Linhas</a>
    <a href="#/alertas"><svg class="i" …/>Alertas</a>
  </div>
</nav>
```

**Comportamento**
- **Sempre duas abas de cada lado** do botão central.
- **Aba ativa:** marque com `aria-current="page"`, ou com a classe `on`, a aba da tela aberta. Telas que não pertencem a nenhuma aba (detalhes, busca) deixam todas inativas ou mantêm a aba de origem.
- **Botão central:** é a ação principal do app (Buscar num app, Lançar gasto no Leve). Não tem estado ativo e sempre tem `aria-label`.
- **Rótulos:** sempre visíveis nas quatro abas.
- **Movimento:** só a troca de cor da aba (0,2 s) e a escala do botão ao tocar.

**Integração (o que faz funcionar no iPhone)**
- **Reserve espaço no fim do conteúdo**, senão o último item fica atrás da barra: `main { padding-bottom: calc(var(--abas-h) + env(safe-area-inset-bottom) + 32px); }`
- **Elementos fixos acima da barra** (avisos, painéis sobre mapas, botões flutuantes) usam a mesma conta: `bottom: calc(var(--abas-h) + env(safe-area-inset-bottom) + 16px);`
- **A página rola normalmente.** Não trave o `body` com `position: fixed` nem `overflow: hidden`.
- **Meta viewport sem `maximum-scale` nem `user-scalable=no`:** use `width=device-width,initial-scale=1,viewport-fit=cover`. Com essas opções, o app da Tela de Início calculou errado a altura da tela e a barra "subiu" depois de fechar o teclado. Para tirar o zoom de toque duplo, use `html, * { touch-action: manipulation; }`.
- **Barra de status translúcida** (`black-translucent`): ponha uma faixa fixa atrás do relógio, para o conteúdo não aparecer por baixo dele ao rolar: `body::before { content:""; position:fixed; inset:0 0 auto; height:env(safe-area-inset-top); background:var(--fundo); z-index:25; }`. Nesse modo o iPhone escreve o relógio sempre em branco, então no tema claro pinte a faixa de escuro (`--tinta`).
- **Telas que não rolam** (um mapa em tela cheia, por exemplo) precisam ser um pouco mais altas que a tela, senão o iPhone deixa uma faixa vazia embaixo: `min-height: calc(100vh + env(safe-area-inset-top) + 1px);`
- **Campos com `font-size: 16px`**, senão o iPhone dá zoom ao tocar.

Ícones: traço de 1,8 px, pontas e cantos redondos, `viewBox="0 0 24 24"` e `stroke="currentColor"`.

## Movimento

Discreto: números contam até o valor, barras crescem em cerca de 1 s com `--ease`, telas entram deslizando 24 px. Nada fica em loop. Respeite `prefers-reduced-motion`, que o `leve.css` já trata.

## Texto

Português do Brasil, curto e direto. Mensagens de erro dizem o que fazer. Tom gentil, sem culpa: "Que tal priorizar o essencial?" em vez de "Você gastou demais!".
