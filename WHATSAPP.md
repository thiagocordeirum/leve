# Leve no WhatsApp

> **Ainda não está em uso.** A conta de desenvolvedor da Meta exige uma conta do Facebook ativa. O canal em uso é o Telegram ([TELEGRAM.md](TELEGRAM.md)), grátis e com as mesmas funções. A função `whatsapp` fica publicada e pronta para quando der.

O Leve tem um número no WhatsApp. Você manda mensagem, áudio ou foto para ele, e ele lança os gastos e responde.

- **Texto ou áudio:** *"almoço 32 no VR e uber 18 ontem"*. A IA ouve o áudio de verdade, sem depender do ditado do iPhone.
- **Foto:** comprovante de Pix, cupom ou print do extrato. Funciona como o "Print da tela" do atalho.
- **Perguntas:** *"quanto ainda posso gastar?"*, *"quanto gastei com comida este mês?"*, *"quanto tem no VR?"*.
- **Correções:** *"apaga o último"*, *"na verdade foi 35"*. Só valem para gastos lançados pelo WhatsApp nos últimos 7 dias.

Os números da resposta (limite da semana, somas) são calculados pelo código, com as mesmas regras do app. A IA só entende o pedido e escreve a frase.

## O que você precisa

- Uma conta no Facebook, para entrar no painel da Meta.
- **Um número para o Leve.** Para começar, a Meta dá um **número de teste** grátis, que conversa com até 5 números cadastrados. É o bastante para você e mais uma pessoa. Para uso definitivo, o certo é um número próprio (chip pré-pago ou número virtual) que **não esteja no app do WhatsApp**.
- Uns 30 minutos.

Custo: a Meta cobra por mensagem enviada pela empresa. Confira a tabela atual em [Preços da WhatsApp Business Platform](https://developers.facebook.com/docs/whatsapp/pricing).

## Passo 1: banco

No Supabase, abra **SQL Editor → New query**, cole o conteúdo de [supabase/schema.sql](supabase/schema.sql) e clique em **Run**. Isso cria as tabelas `whatsapp` e `mensagens_vistas` e não mexe nos seus dados.

## Passo 2: app na Meta

Os nomes dos menus podem mudar um pouco; o painel da Meta costuma abrir em inglês.

1. Entre em [developers.facebook.com/apps](https://developers.facebook.com/apps) e clique em **Create App**.
2. Dê um nome (ex.: *Leve*), escolha o caso de uso **Connect with customers through WhatsApp**, escolha ou crie um portfólio de negócios e conclua.
3. No app, abra **WhatsApp → API Setup**. Se pedir, clique em **Create a WhatsApp Business account**. A Meta cria o número de teste.
4. Anote o **Phone number ID** (um número longo, abaixo do campo **From**) e o número de teste que aparece em **From**.
5. No campo **To**, adicione o seu WhatsApp e o de quem mais for usar. Cada pessoa recebe um código no WhatsApp para confirmar.

## Passo 3: as três chaves da Meta

1. **App Secret:** no app, **App settings → Basic → App secret → Show**.
2. **Token permanente:** em [business.facebook.com/settings](https://business.facebook.com/settings), abra **Users → System users → Add**, crie um usuário **Admin**. Em **Assign assets**, dê **Full control** sobre o app e sobre a conta do WhatsApp. Clique em **Generate token**, escolha o app, validade **Never** e marque `whatsapp_business_messaging` e `whatsapp_business_management`. Copie o token: ele aparece uma vez.
   - O token do botão **Generate access token** da tela API Setup vence rápido (cerca de um dia). Serve só para um teste.
3. **Token de verificação:** invente uma senha longa (ex.: 30 letras e números). Ela só serve para a Meta provar que o endereço é seu.

## Passo 4: segredos no Supabase

No Supabase, abra **Edge Functions → Secrets** e crie:

| Nome | Valor |
|---|---|
| `WHATSAPP_TOKEN` | o token permanente |
| `WHATSAPP_APP_SECRET` | o App Secret |
| `WHATSAPP_PHONE_ID` | o Phone number ID |
| `WHATSAPP_VERIFY_TOKEN` | a senha que você inventou |

> Essas chaves ficam só no Supabase. Não mande por mensagem nem coloque no código.

## Passo 5: ligar a Meta à função

1. No app da Meta, abra **WhatsApp → Configuration**.
2. Em **Webhook**, clique em **Edit** e preencha:
   - **Callback URL:** `https://SEU-PROJETO.supabase.co/functions/v1/whatsapp`
   - **Verify token:** a mesma senha do `WHATSAPP_VERIFY_TOKEN`
3. Clique em **Verify and save**. Se der erro, confira se o segredo no Supabase está igual.
4. Em **Webhook fields**, ative **messages** (Subscribe).

## Passo 6: mostrar o WhatsApp no app

Em [config.js](config.js), preencha `whatsapp` com o número do Leve, só dígitos, com 55 e DDD (ex.: `"5511912345678"`; no número de teste, use o que aparece em **From**). Publique. O grupo **WhatsApp** passa a aparecer em Ajustes.

## Passo 7: conectar o seu WhatsApp

1. No Leve, toque no avatar e vá em **WhatsApp → Conectar**.
2. Toque em **Abrir o WhatsApp** e envie a mensagem que já vem escrita. O código vale 15 minutos e só funciona uma vez.
3. O Leve responde com as boas-vindas. Cada pessoa conecta o próprio WhatsApp pela própria conta.

Para desligar, toque em **Desconectar** no mesmo lugar. O Leve para de responder a esse número.

## Segurança

- A função só aceita pedidos **assinados pela Meta** (com o App Secret). Sem assinatura válida, nada é lido.
- Só o número que mandou o código criado no app fala com a conta. O app não consegue gravar um número direto no banco.
- Números não conectados não recebem resposta.
- Pelo WhatsApp dá para lançar gastos, consultar, e corrigir ou apagar **só** o que foi lançado por lá nos últimos 7 dias. O plano, os custos fixos e os outros gastos só mudam pelo app. Na caixinha, a única escrita é registrar um resgate que apareça numa foto de extrato, como no atalho.
- As mensagens passam pelos servidores da Meta e pela IA do Google (plano grátis do Gemini). As últimas 8 falas ficam guardadas na tabela `whatsapp`, para o Leve entender "apaga isso" ou "na verdade foi 35".

## Se der erro

- **"Verify and save" falha:** o `WHATSAPP_VERIFY_TOKEN` está diferente, ou a função não foi publicada com o Verify JWT desligado.
- **Você manda mensagem e nada volta:** veja **Edge Functions → whatsapp → Logs**.
  - `Assinatura inválida` (401): o `WHATSAPP_APP_SECRET` está errado.
  - `número não conectado`: faça o passo 7.
  - `whatsapp envio 401`: o token venceu; gere o permanente.
  - `whatsapp envio 400` com "recipient not in allowed list": no número de teste, cadastre o seu número em **To** (passo 2). Em números do Brasil, o cadastro pode pedir o número sem o 9 depois do DDD.
- **"O limite grátis da IA acabou por hoje":** o Gemini grátis tem cota diária. Volta no dia seguinte.

Quem mexe no código publica pelo terminal:

```
npx supabase functions deploy whatsapp --remote=SEU-PROJETO --no-verify-jwt --use-api --yes
```
