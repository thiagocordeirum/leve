# Leve no Telegram

O Leve tem um bot no Telegram. Você manda mensagem, áudio ou foto para ele, e ele lança os gastos e responde. É grátis: o Telegram não cobra nada e não precisa de número extra.

- **Texto ou áudio:** *"almoço 32 no VR e uber 18 ontem"*. A IA ouve o áudio de verdade.
- **Foto ou PDF:** comprovante de Pix, cupom, boleto ou print do extrato.
- **Perguntas:** *"quanto ainda posso gastar?"*, *"quanto gastei com comida este mês?"*, *"quanto tem no VR?"*.
- **Correções:** *"apaga o último"*, *"na verdade foi 35"*. Só valem para gastos lançados pelo Telegram nos últimos 7 dias.
- **Avisos automáticos** (veja abaixo): resumo da noite, semana nova, dia do salário e alerta de limite.

Os números das respostas (limite da semana, somas) são calculados pelo código, com as mesmas regras do app. A IA só entende o pedido e escreve a frase.

## Configurar (uma vez, uns 5 minutos)

### 1. Banco
No Supabase, abra **SQL Editor → New query**, cole o conteúdo de [supabase/schema.sql](supabase/schema.sql) e clique em **Run**. Isso cria as tabelas `telegram`, `mensagens_vistas` e `avisos_enviados`, liga o agendamento dos avisos (de hora em hora) e não mexe nos seus dados. Se você já rodou antes, rode de novo: é seguro.

### 2. Criar o bot
1. No Telegram, procure **@BotFather** (o oficial, com o selo azul) e toque em **Iniciar**.
2. Mande `/newbot`.
3. Ele pede um **nome**: mande `Leve`.
4. Ele pede um **username**, que precisa terminar em `bot` e ser único no Telegram. Por exemplo: `leve_exemplo_bot`. Se já existir, tente outro.
5. Ele responde com o **token**, uma linha parecida com `1234567890:AAH...`. Copie. É a senha do bot: não mande para ninguém.

### 3. Guardar o token no Supabase
No Supabase, abra **Edge Functions → Secrets** (ou **Project Settings → Edge Functions**) e adicione:

| Name | Value |
|---|---|
| `TELEGRAM_TOKEN` | o token do BotFather |

Clique em **Save**.

### 4. Conectar o seu Telegram
1. No Leve, toque no avatar. Em Ajustes aparece o grupo **Telegram**. Se não aparecer, feche e abra o app de novo.
2. Toque em **Conectar** e depois em **Abrir o Telegram**.
3. No Telegram, toque em **Iniciar**. O Leve responde com "Pronto, …".

Cada pessoa cadastrada faz o mesmo passo 4 pelo próprio Leve. O mesmo bot atende todas as contas, cada uma com os próprios dados.

Para desligar, toque em **Desconectar** no mesmo lugar.

## Avisos automáticos

O bot manda sozinho, de graça:

| Aviso | Quando | O que diz |
|---|---|---|
| **Resumo da noite** | todo dia, 21h | quanto você gastou hoje e quanto ainda dá para gastar na semana, por dia |
| **Semana nova** | primeiro dia da semana, 8h | o limite da semana que começa, como foi a anterior, VR e mobilidade |
| **Dia do salário** | começo do mês do plano, 9h | fatura do cartão a pagar, quanto guardar, o livre do mês e como fechou o mês anterior |
| **Alerta de limite** | logo depois de um gasto | quando a semana passa de 80% do limite, chega ao limite ou passa dele, e quando o livre do mês acaba; uma vez cada |

- O primeiro dia da semana segue o app: **Ajustes → A semana começa** (domingo ou segunda).
- Mande **/avisos** para o bot: aparecem botões para ligar e desligar cada aviso. Vale só para você.
- O alerta sai na hora quando o gasto é lançado pelo bot, pelo app ou pelo atalho do iPhone. Gastos que entram por importação ou backup são conferidos na rodada seguinte, em até 1 hora.
- Os avisos param se você desconectar o Telegram no app.

## Como funciona por dentro

- A função `telegram` (Supabase) recebe as mensagens do bot. O Telegram manda junto um segredo que só quem tem o token do bot sabe calcular; sem ele, nada é lido.
- Na primeira vez que o app pergunta pelo bot, a função registra o próprio endereço no Telegram. Ninguém precisa configurar o webhook à mão.
- O código de conectar vale 15 minutos e uma vez só. O app não consegue gravar a conversa direto no banco: quem grava é a função, depois de receber o código pelo Telegram.
- Conversas que não foram conectadas recebem só a explicação de como conectar, sem IA.
- As mensagens passam pelo Telegram e pela IA do Google (plano grátis do Gemini). As últimas 8 falas ficam na tabela `telegram`, para o Leve entender "apaga isso" ou "na verdade foi 35".
- Avisos: o banco (pg_cron) chama a função de hora em hora, e ela manda o que estiver na hora. Cada aviso fica registrado em `avisos_enviados` e não sai duas vezes, mesmo que a função seja chamada mais vezes.
- Não há como lançar pelo bot gastos de outra pessoa, nem mudar o plano ou os custos fixos. Na caixinha, só entra um resgate que apareça numa foto de extrato, como no atalho.

## Se der erro

- **O grupo Telegram não aparece em Ajustes:** o `TELEGRAM_TOKEN` não está salvo ou foi copiado pela metade. Confira em **Edge Functions → Secrets** e abra o app de novo depois de 5 minutos.
- **O bot não responde:** veja **Edge Functions → telegram → Logs**.
- **"O limite grátis da IA acabou por hoje":** o Gemini grátis tem cota diária. Volta no dia seguinte.
- **Trocou o token (revoke no BotFather):** atualize o `TELEGRAM_TOKEN` no Supabase e abra Ajustes no app; a função registra de novo.

Quem mexe no código publica pelo terminal:

```
npx supabase functions deploy telegram --remote=SEU-PROJETO --no-verify-jwt --use-api --yes
```
