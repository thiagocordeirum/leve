# Leve

Controle de gastos pessoal que responde a uma pergunta: quanto ainda dá para gastar nesta semana? O app guarda a meta do mês, desconta os gastos fixos e distribui o que sobra pelas semanas. Os gastos entram pelo app ou por mensagem no Telegram, em texto, áudio ou foto de comprovante.

> Este repositório é uma cópia pública do projeto, sem dados pessoais. Para rodar, use o seu próprio projeto no Supabase (veja [Como rodar](#como-rodar)).

## O que ele faz

**No app (web app instalável no celular)**
- Mostra o limite da semana, que se reajusta: gastar menos aumenta as próximas semanas, gastar mais as reduz.
- Planeja o mês a partir do salário, da meta de poupança e dos gastos fixos no cartão e no débito.
- Acompanha caixinha (com rendimento simulado pelo CDI), vale-refeição e vale-mobilidade em saldos separados.
- Importa fatura e extrato em CSV, e a IA sugere a categoria de cada item.
- Transforma a foto de um comprovante em lançamento e gera um resumo do mês ou da semana com IA.

**No Telegram**
- Lança gastos a partir de texto ("almoço 32 no VR e uber 18 ontem"), áudio, foto ou PDF de comprovante.
- Responde a perguntas como "quanto ainda posso gastar?" e "quanto gastei com comida este mês?".
- Aceita correções ("apaga o último", "na verdade foi 35").
- Manda avisos sozinho: resumo da noite, semana nova, dia do salário e alerta de limite perto.

## Como a IA é usada

O LLM entende o pedido e escreve a resposta, mas não faz contas. Cada mensagem vira um pedido ao modelo com saída estruturada (JSON com esquema), que devolve uma ação (`lancar`, `situacao`, `consultar`, `apagar`, `corrigir`, `conversa`) e os campos dela. O código executa a ação e calcula limites e somas com as mesmas regras do app.

Antes de enviar a resposta, o bot confere se os valores em reais que o modelo escreveu batem com os calculados. Se o modelo inventar um número, a frase dele é descartada e vai o resumo gerado pelo código.

## Arquitetura

```
index.html, app.js, styles.css   app web estático, sem build, publicado na Vercel
config.js                        URL e chave pública do Supabase
supabase/schema.sql              tabelas, regras de acesso (RLS), validações e agendamento dos avisos
supabase/functions/
  telegram/                      webhook do bot do Telegram
  whatsapp/                      mesmo bot para o WhatsApp (pronto, ainda não em uso)
  ia/                            foto vira gasto, categorias e resumo com IA para o app
  atalho/                        endpoint para os Atalhos do iPhone
  _shared/                       regras do orçamento, chamada ao modelo, conversa, avisos
testes/                          testes de paridade e dos bots com banco, IA e Telegram simulados
design/                          sistema de design do app (tokens, componentes, exemplo)
```

- **Front-end:** HTML, CSS e JavaScript puros, sem framework e sem build. Fontes e bibliotecas são servidas pelo próprio site.
- **Back-end:** Supabase (Postgres, Auth e Edge Functions em TypeScript/Deno).
- **IA:** API do Gemini com saída em JSON validada por esquema, entrada de áudio e imagem.

## Testes

```bash
node testes/paridade.mjs
```

Compara, em milhares de combinações de configuração e datas, o cálculo do orçamento no app (`app.js`) com a cópia usada pelas funções (`orcamento.ts`), para garantir que o bot e o app nunca mostrem números diferentes.

```bash
npx esbuild supabase/functions/telegram/index.ts --bundle --platform=neutral --format=esm --outfile=/tmp/fn-telegram.mjs
node testes/telegram.mjs /tmp/fn-telegram.mjs
```

Roda a função do Telegram de ponta a ponta com banco, modelo e API do Telegram simulados: conexão da conta, lançamentos, correções, perguntas, avisos agendados e o descarte de números inventados pelo modelo. O teste do WhatsApp funciona do mesmo jeito.

## Segurança

| Proteção | Como |
|---|---|
| Cada pessoa só vê o que é seu | RLS no Postgres: toda leitura e escrita é filtrada pelo usuário logado |
| Ninguém de fora entra | Cadastro público desligado; usuários são criados à mão no painel |
| Sem senha para vazar | Login por código de uso único enviado por e-mail |
| Chaves secretas fora do front | O app se recusa a abrir se encontrar uma chave `secret` ou `service_role` |
| Webhook autenticado | O Telegram envia um segredo derivado do token, conferido a cada chamada |
| Dados inválidos são barrados | Validações no banco para valores, categorias, datas e tamanho dos textos |
| Scripts de fora bloqueados | `Content-Security-Policy` só permite código do próprio site e conexões com o Supabase |
| Celular desbloqueado | Trava opcional com Face ID (WebAuthn) |

## Como rodar

1. Crie um projeto no [Supabase](https://supabase.com) e rode `supabase/schema.sql` no SQL Editor.
2. Em **Authentication**, deixe o login por e-mail ligado, desligue o cadastro público e troque o modelo do e-mail "Magic Link" para mostrar o código (`{{ .Token }}`).
3. Crie os usuários em **Authentication → Users**, com **Auto Confirm User** marcado.
4. Cole a Project URL e a chave **publishable** (ou **anon**) em `config.js`. Nunca use a chave secret.
5. Publique a pasta na Vercel (preset **Other**, sem build) e coloque o endereço em **Authentication → URL Configuration → Site URL**.
6. Para o bot, siga [TELEGRAM.md](TELEGRAM.md). Para os Atalhos do iPhone, [ATALHOS.md](ATALHOS.md).

Os backups que o app gera (`leve-backup-*.json`) têm dados financeiros e estão no `.gitignore`.
