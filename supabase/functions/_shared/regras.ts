// Regras de leitura de gastos (categorias, fontes, textos para a IA e limpeza das respostas).
import { lerJSON } from "./gemini.ts";

export const CATS = ["transporte", "comida", "lazer", "compras", "assinatura", "familia", "saude", "outros"];
export const FONTES = ["conta", "cartao", "vr", "mob"];

export const REGRAS_CATEGORIA = `transporte (Uber, 99, combustível, estacionamento, pedágio, ônibus, metrô), comida (mercado, restaurante, lanche, delivery, iFood, padaria, café), lazer (bar, festa, cinema, show, ingresso, jogos, viagem), compras (lojas, roupas, eletrônicos, casa, marketplaces), assinatura (streaming, apps, mensalidades, planos), familia (presentes, despesas com família), saude (farmácia, médico, exames, academia), outros (o resto, inclusive Pix para pessoas sem motivo claro)`;

export const ESQUEMA_FOTO = {
  type: "object",
  properties: {
    gastos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          valor: { type: "number" },
          data: { type: "string" },
          descricao: { type: "string" },
          categoria: { type: "string", enum: CATS },
          fonte: { type: "string", enum: FONTES },
        },
        required: ["valor", "data", "descricao", "categoria", "fonte"],
      },
    },
  },
  required: ["gastos"],
};

export const ESQUEMA_CATS = {
  type: "object",
  properties: {
    categorias: {
      type: "array",
      items: {
        type: "object",
        properties: { i: { type: "integer" }, categoria: { type: "string", enum: CATS } },
        required: ["i", "categoria"],
      },
    },
  },
  required: ["categorias"],
};

export function instrucoesFoto(hoje) {
  return `Você lê imagens enviadas por uma pessoa que controla os próprios gastos no Brasil.
A imagem pode ser: cupom fiscal ou nota; comprovante de Pix ou transferência; tela ou notificação de compra no cartão; ou uma lista com vários lançamentos (fatura, extrato).
Extraia apenas os GASTOS, ou seja, dinheiro que saiu.

Regras:
- Cupom ou nota: um único gasto com o TOTAL pago, não os itens.
- Comprovante de Pix ou transferência ENVIADA: um gasto. Pix ou transferência RECEBIDA não é gasto.
- Lista: um gasto por compra. Ignore pagamento de fatura, estornos, reembolsos, créditos, rendimentos, juros, IOF e saldos.
- valor: número em reais, positivo (ex.: 32.9).
- data: AAAA-MM-DD. Se a imagem não mostrar o ano, use o ano de ${hoje.slice(0, 4)}. Se não mostrar data nenhuma, use ${hoje}.
- descricao: curta, com o nome do estabelecimento ou da pessoa (até 40 caracteres), sem CPF, CNPJ, agência ou conta.
- categoria: ${REGRAS_CATEGORIA}.
- fonte: "cartao" para compra no cartão de crédito; "vr" para vale-refeição ou alimentação (Alelo, Pluxee/Sodexo, VR, Ticket, Flash, Caju); "mob" para vale-transporte ou mobilidade; "conta" para débito, Pix, boleto ou dinheiro.
- Se não houver nenhum gasto legível, devolva uma lista vazia.

Responda só com o JSON no formato {"gastos":[{"valor":..,"data":"..","descricao":"..","categoria":"..","fonte":".."}]}.`;
}

// Frase dita (ditado do iPhone) ou escrita: "almoço 32 no VR e uber 18 ontem". Pode vir com erro de transcrição.
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
export function instrucoesFrase(hoje, frase) {
  const dia = DIAS[new Date(hoje + "T12:00:00Z").getUTCDay()];
  return `Uma pessoa no Brasil descreveu, numa frase falada ou escrita, gastos que acabou de fazer. A frase pode ter erros de transcrição de voz.
Hoje é ${hoje} (${dia}).

Extraia cada gasto mencionado:
- valor: número em reais, positivo. Entenda valores por extenso ("trinta e dois e noventa" = 32.9, "vinte conto" = 20, "dois mil" = 2000).
- data: AAAA-MM-DD. Sem menção de dia, use ${hoje}. Entenda "ontem", "anteontem" e dias da semana (o mais recente que já passou ou é hoje).
- descricao: curta, com o que foi ou onde foi (até 40 caracteres), com a primeira letra maiúscula.
- categoria: ${REGRAS_CATEGORIA}.
- fonte: "cartao" se falar em cartão ou crédito; "vr" se falar em VR, vale-refeição, vale-alimentação, Alelo, Pluxee, Sodexo, Ticket, Flash ou Caju; "mob" se falar em vale-transporte, VT ou mobilidade; senão "conta" (Pix, débito, dinheiro).
- Se a frase não tiver nenhum gasto com valor, devolva uma lista vazia. Não invente valores.

Frase: ${JSON.stringify(String(frase).slice(0, 500))}

Responda só com o JSON no formato {"gastos":[{"valor":..,"data":"..","descricao":"..","categoria":"..","fonte":".."}]}.`;
}

export function instrucoesCats(itens) {
  return `Você organiza os gastos de uma pessoa no Brasil. Cada item abaixo é uma linha da fatura do cartão ou do extrato da conta, com o texto que o banco mostra (às vezes abreviado, com prefixos de adquirente como "DL*", "PAG*", "MP*", "EC *", "IFD*" ou cidade no fim) e o valor em reais.
Escolha a categoria de cada um: ${REGRAS_CATEGORIA}.
Use o nome do estabelecimento para decidir. Se não reconhecer, pense no tipo de negócio pelo nome; só use "outros" se não houver pista nenhuma.

Itens (JSON):
${JSON.stringify(itens)}

Responda só com o JSON no formato {"categorias":[{"i":0,"categoria":".."}]}, com um elemento para cada item, usando o mesmo "i".`;
}

export function limparGastos(texto, hoje) {
  const j = lerJSON(texto);
  const lista = Array.isArray(j) ? j : Array.isArray(j?.gastos) ? j.gastos : [];
  return lista.map((g) => {
    const valor = Math.round(Math.abs(Number(String(g?.valor).replace(",", "."))) * 100) / 100;
    const data = /^\d{4}-\d{2}-\d{2}$/.test(String(g?.data)) ? String(g.data) : hoje;
    return {
      valor,
      data,
      descricao: String(g?.descricao ?? "").replace(/\s+/g, " ").trim().slice(0, 80),
      categoria: CATS.includes(g?.categoria) ? g.categoria : "outros",
      fonte: FONTES.includes(g?.fonte) ? g.fonte : "conta",
    };
  }).filter((g) => g.valor > 0 && g.valor < 1e7).slice(0, 60);
}

export function limparCats(texto, validos) {
  const j = lerJSON(texto);
  const lista = Array.isArray(j) ? j : Array.isArray(j?.categorias) ? j.categorias : [];
  const vistos = new Set();
  return lista.filter((c) => validos.has(c?.i) && CATS.includes(c?.categoria) && !vistos.has(c.i) && vistos.add(c.i))
    .map((c) => ({ i: c.i, categoria: c.categoria }));
}
