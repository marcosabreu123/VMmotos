# ERP Base — sistema de gestão adaptável por nicho

Base universal para implantar um sistema de gestão em qualquer comércio:
estoque por lote, vendas, clientes, compras, despesas, relatórios de lucro,
cotação de frete e assistente de IA por texto e voz.

Nasceu de um sistema em produção numa perfumaria e foi generalizado: tudo que
era específico daquele ramo virou configuração.

> **Este projeto é um molde.** Para atender um cliente, copie a pasta inteira,
> edite `src/config/nicho.ts` e crie um banco novo. Um cliente nunca compartilha
> banco com outro.

## Adaptando para um novo segmento

Quase toda a personalização acontece em **um arquivo**: `src/config/nicho.ts`.

Há quatro exemplos completos em `src/config/nichos-exemplo.ts` (perfumaria,
autopeças, farmácia e pet shop). O caminho mais rápido é copiar o mais parecido
e ajustar.

O que se define ali:

| Bloco | O que controla |
|---|---|
| `negocio` | Nome exibido, ramo (usado no prompt da IA) e logo |
| `termos` | Vocabulário: "Produto" vs "Peça" vs "Medicamento"; "Marca" vs "Fabricante" vs "Laboratório" |
| `atributos` | Os três campos livres do produto: uma medida numérica e dois atributos de texto |
| `estoque` | Se existe pool de demonstração (testador/mostruário), se controla validade, se vende fracionado |
| `perfisDeCompra` | Segmentos do relatório de clientes ("quem compra o quê") |
| `categorias*Iniciais` | O que o seed cria num banco vazio |

Desligar um atributo (`ativo: false`) o remove dos formulários, filtros e
relatórios — não é preciso mexer em tela nenhuma.

### Os três atributos do produto

Além de nome, marca, categoria, SKU e preços, o produto tem três campos
genéricos:

- **`medida`** (número) — "Tamanho (ml)" numa perfumaria, "Dosagem (mg)" numa
  farmácia, "Peso (kg)" num pet shop.
- **`atributoA`** (texto) — "Família olfativa", "Princípio ativo", "Aplicação"...
- **`atributoB`** (texto) — "Público", "Tarja", "Posição"...

Cada um pode ser texto livre ou lista fechada de opções. É o suficiente para a
maioria dos comércios sem tocar no banco.

### Quando o nicho precisa de mais que configuração

Se um segmento exigir um campo estruturalmente novo (número de série por
unidade, validade por item, tabela de compatibilidade), aí sim entra migração no
schema. A configuração cobre o caso comum; o resto continua desenvolvimento
normal.

## Como rodar

Pré-requisito: Node.js 20+.

Copie `.env.example` para `.env` e preencha as credenciais do Postgres deste
cliente (Supabase ou qualquer outro). Depois:

```bash
npm install
```

```bash
npx prisma migrate deploy
```

```bash
npm run db:seed
```

```bash
npm run dev
```

Abra http://localhost:3000 e entre com o e-mail/senha definidos no `.env`.
Troque a senha em **Usuários** no primeiro acesso.

## O que já vem pronto

- **Estoque por lote** com custo real (frete rateado na entrada), validade,
  inventário, ajustes e perdas, e um segundo pool opcional (demonstração).
- **Vendas** com desconto e acréscimo por item e no total, pagamento parcial
  com controle de débito do cliente, cancelamento e devolução parcial.
- **Compras**: pedido ao fornecedor e recebimento com lote e rateio de frete.
- **Despesas** com categorias, recorrência e vencimento.
- **Relatórios**: lucro por período com custo real, ranking e segmentação de
  clientes, curva de produtos.
- **Cotação de frete** (Melhor Envio) — apenas cotação, nunca compra de etiqueta.
- **Assistente de IA** por texto e voz, que registra venda, cliente, fornecedor,
  pedido de compra, entrada de estoque, despesa, ajuste e devolução.
- **Permissões** por papel (Dono, Gerente, Vendedor, Estoque, Consulta) e
  auditoria de tudo que muda.

### Sobre o assistente de IA

Nenhuma ação da IA grava direto: ela monta uma **prévia**, e só um "confirma"
explícito do usuário executa. Essa decisão é tomada no servidor por regra fixa,
nunca pelo modelo — que sequer recebe uma ferramenta de "executar".

Requer `OPENAI_API_KEY` no `.env`. Sem a chave o restante do sistema funciona
normalmente e só o assistente fica indisponível.

A busca de produtos e clientes entende várias palavras e tolera erro de
digitação ("yara lataffa" encontra "Yara" da "Lattafa"), o que é o que faz o
comando por voz funcionar na prática.

## Estrutura

```
src/config/nicho.ts          <- PONTO ÚNICO de personalização
src/config/nichos-exemplo.ts <- 4 segmentos prontos para copiar
src/lib/                     <- regras de negócio (vendas, estoque, lucro...)
src/lib/assistente/          <- IA: ferramentas, prévia/confirmação, execução
src/app/                     <- telas e rotas
prisma/schema.prisma         <- modelo de dados
```

## Checklist para um cliente novo

1. Copiar a pasta e renomear.
2. Editar `src/config/nicho.ts` (ou colar um exemplo de `nichos-exemplo.ts`).
3. Trocar `public/logo.svg` pela marca do cliente e apontar `negocio.logoPath`.
4. Ajustar as cores em `src/app/globals.css`, se a identidade pedir.
5. Criar um banco Postgres novo e preencher o `.env`.
6. `npx prisma migrate deploy` e `npm run db:seed`.
7. Publicar (Vercel ou equivalente) com as variáveis de ambiente configuradas.
