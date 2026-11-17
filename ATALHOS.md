# Atalhos do iPhone

São dois atalhos do app **Atalhos**, que falam direto com o Leve sem precisar abrir o app:

- **Conferir caixinha:** com a tela da caixinha aberta no Nubank, tira um print, a IA lê o Total bruto (e o líquido, se aparecer) e registra um "Conferir saldo". O print não vai para a galeria: ele só existe enquanto o atalho roda.
- **Lançar gasto:** abre um menu do iPhone com três opções: **Falar** (você dita, a IA entende), **Digitar** (valor, descrição e como pagou; a IA escolhe a categoria) ou **Print da tela** (a IA lê os gastos da tela aberta, como o extrato).

Os dois mostram o resultado numa notificação.

## Antes de montar (uma vez só)

1. **Banco:** no Supabase, abra **SQL Editor → New query**, cole o conteúdo de [supabase/schema.sql](supabase/schema.sql) e clique em **Run**. Isso cria a tabela `atalhos` e não mexe nos seus dados.
2. **Função:** a função `atalho` já está publicada no Supabase, com o **Verify JWT desligado** (o atalho não manda login). Quem mexe no código publica pelo terminal (`npx supabase functions deploy atalho --remote=SEU-PROJETO --no-verify-jwt --use-api`).
3. **Chave:** no Leve, toque no avatar e vá em **Atalhos do iPhone → Criar**. Copie a **chave** e o **endereço**, que aparecem só nessa hora. Se perder, toque em **Trocar**: a chave antiga para de valer e você atualiza os atalhos.

> A chave só lança gastos e confere o saldo da caixinha. Ela não lê seus dados. Se o celular for perdido, toque em **Desativar chave** no app.

Nos passos abaixo, onde estiver **CHAVE**, cole a chave copiada. Onde estiver **ENDEREÇO**, cole o endereço (termina em `/functions/v1/atalho`). Se o seu atalho ainda usa `/functions/v1/ler-gasto`, troque: o endereço antigo funciona só durante a transição.

---

## Atalho 1: Conferir caixinha

No app **Atalhos**, toque em **+** e dê o nome **Conferir caixinha**. Adicione as ações nesta ordem:

1. **Aguardar**: 1 segundo. Dá tempo de a Central de Controle fechar antes do print.
2. **Tirar Captura de Tela**.
3. **Converter Imagem**: converter *Captura de Tela* para **JPEG**.
4. **Redimensionar Imagem**: *Imagem Convertida*, largura **1200**, altura automática.
5. **Codificar com Base64**: *Imagem Redimensionada*. Toque na setinha e escolha **Quebras de Linha: Nenhuma**.
6. **Obter Conteúdo do URL**:
   - URL: **ENDEREÇO**
   - Toque na setinha: **Método: POST**, **Corpo da Solicitação: JSON**, e adicione três campos de **Texto**:
     - `chave` → **CHAVE**
     - `acao` → `caixinha`
     - `imagem` → a variável *Texto Codificado em Base64*
7. **Mostrar Notificação**: *Conteúdo do URL*.

**Como disparar**
- **Central de Controle** (iOS 18 ou mais novo): abra a Central, toque em **+** no canto, depois em **Adicionar um Controle** → **Atalhos** → **Atalho** e escolha *Conferir caixinha*. Abra a caixinha no Nubank, puxe a Central e toque no controle.
- **Toque Traseiro**, o mais confiável porque não cobre a tela: **Ajustes → Acessibilidade → Toque → Toque Traseiro → Toque Duplo → Conferir caixinha**. Com a caixinha aberta no Nubank, dê duas batidas atrás do iPhone.

Se a notificação disser que não achou o saldo, o print pegou a Central por cima. Aumente a espera do passo 1 para 2 segundos ou use o Toque Traseiro.

**O que a função confere:**
- Recusa prints que não sejam da tela de uma caixinha.
- Recusa valores muito longe do saldo que o app conhece, abaixo de 60% ou acima de 160%.
- O registro aparece em Caixinha → Movimentos com a nota "Pelo atalho" e pode ser apagado como qualquer outro.

---

## Atalho 2: Lançar gasto

Novo atalho, com o nome **Lançar gasto**.

1. **Escolher do Menu**: pergunta *"Lançar gasto"*, com três opções: **Falar**, **Digitar** e **Print da tela**.

**Dentro de "Falar"** (o jeito mais rápido):

2. **Ditar Texto**: idioma **Português (Brasil)**, **Parar de Ouvir: Após Pausa**.
3. **Obter Conteúdo do URL**: **ENDEREÇO**, POST, JSON com `chave` → **CHAVE**, `acao` → `falar` e `texto` → *Texto Ditado*.
4. **Mostrar Notificação**: *Conteúdo do URL*.

Fale o valor e o que foi, do jeito que vier: *"almoço 32 no vale-refeição"*, *"uber 18 e padaria 12 ontem"*, *"mercado cento e vinte no crédito"*. A IA entende o valor, a categoria, a fonte (vale-refeição, crédito, mobilidade, senão conta) e o dia. Vários gastos numa frase viram vários lançamentos. Com o atalho no **Botão de Ação** ou chamando a Siri ("E aí, Siri, Lançar gasto"), dá para lançar sem tocar na tela.

**Dentro de "Digitar":**

2. **Solicitar Entrada**: tipo **Número**, pergunta *"Quanto?"*.
3. **Solicitar Entrada**: tipo **Texto**, pergunta *"Com o quê?"* (ex.: *almoço*, *uber*, *farmácia*). A IA escolhe a categoria por essa descrição.
4. **Lista**: `Conta`, `Crédito`, `Vale-refeição`, `Mobilidade`. (Os nomes antigos `Cartão` e `VR` continuam funcionando.)
5. **Escolher da Lista**: *Lista*, pergunta *"Pagou com"*.
6. **Obter Conteúdo do URL**: URL **ENDEREÇO**, **Método: POST**, **Corpo: JSON**, com os campos:
   - `chave` (Texto) → **CHAVE**
   - `acao` (Texto) → `gasto`
   - `valor` (Número) → *Entrada Fornecida* do passo 2
   - `descricao` (Texto) → *Entrada Fornecida* do passo 3
   - `fonte` (Texto) → *Item Escolhido*
7. **Mostrar Notificação**: *Conteúdo do URL*.

> Para escolher a variável certa entre duas *Entrada Fornecida*, toque nela e use **Selecionar Variável**: o atalho destaca a ação de onde ela vem.

**Dentro de "Print da tela"** (igual ao atalho da caixinha):

2. **Aguardar**: 1 segundo. É o tempo de o menu fechar antes do print.
3. **Tirar Captura de Tela**.
4. **Converter Imagem**: para **JPEG**.
5. **Redimensionar Imagem**: largura **1200**.
6. **Codificar com Base64**, com **Quebras de Linha: Nenhuma**.
7. **Obter Conteúdo do URL**: **ENDEREÇO**, POST, JSON com `chave` → **CHAVE**, `acao` → `print` e `imagem` → *Texto Codificado em Base64*.
8. **Mostrar Notificação**: *Conteúdo do URL*.

**Como usar o Print:** abra no app do banco ou do vale-refeição a tela da compra, do comprovante de Pix ou do extrato. Depois rode o atalho e escolha **Print da tela**.

- A IA lê os gastos da tela e eles entram direto no app, com a data que aparece em cada um.
- Gastos com a mesma data e o mesmo valor de um que já está no app são pulados. Por isso dá para tirar print do extrato inteiro sem duplicar.
- Entradas, reembolsos, estornos e pagamento de fatura ficam de fora.
- **Resgate da caixinha seguido de um gasto** (ex.: "Dinheiro resgatado R$ 50" e logo depois um Pix de R$ 50): o resgate entra na caixinha e o gasto entra como **pago com a caixinha**, fora do limite da semana. Se o gasto for maior que o resgate, ele é dividido: a parte coberta pelo resgate vai como caixinha e o resto como conta.
- A notificação lista o que entrou. Corrija no app se a categoria ou a forma de pagamento (Conta, Crédito, Vale-refeição, Mobilidade) vier errada.

O gasto digitado entra com a data de hoje.

**Para abrir rápido:** coloque o *Lançar gasto* na Central de Controle (como no atalho 1), na Tela de Início ou no **Botão de Ação**, se o iPhone tiver.

---

## Se der erro

A notificação diz o que fazer. Os casos mais comuns:

- **"Chave do atalho ausente ou inválida"** ou **"não vale mais"**: crie ou troque a chave no app e cole a nova nos dois atalhos.
- **Erro 401 ou "Invalid JWT"**: a opção **Verify JWT** da função `atalho` está ligada. Desligue em **Edge Functions → atalho → Details**.
- **"A função não tem acesso ao banco"**: a função não achou a chave de serviço do Supabase. Me avise.
- Para outros erros, veja **Edge Functions → atalho → Logs**.
