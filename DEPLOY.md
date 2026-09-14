# Publicar na Vercel — VM Moto Peças

O sistema hoje roda só na máquina de desenvolvimento. Para o dono usar do
celular dele, precisa estar publicado.

## Variáveis de ambiente

O arquivo `.env` **não vai para o git** (nem deve). Os valores precisam ser
cadastrados na Vercel, em **Project Settings → Environment Variables**, para os
três ambientes (Production, Preview, Development).

Copie de `C:\Users\Windows\Desktop\VMmotos\.env`:

| Variável | De onde vem |
|---|---|
| `DATABASE_URL` | Supabase → Connect → ORM → Prisma (pooler, porta 6543) |
| `DIRECT_URL` | o mesmo, porta 5432 — o Prisma exige para migrations |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → chave publicável |
| `NEXT_PUBLIC_SUPABASE_BUCKET` | `pecas` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → chave secreta |
| `SESSION_SECRET` | já gerado no `.env`; **não reaproveite de outro projeto** |
| `SEED_ADMIN_*` e `SEED_OWNER_*` | só se for rodar o seed de novo |
| `OPENAI_API_KEY` | painel da OpenAI |
| `OPENAI_ASSISTANT_MODEL` | `gpt-5-mini` |
| `ASSISTENTE_TIMEZONE` | `America/Sao_Paulo` |
| `ASSISTENTE_HABILITADO` | `true` |
| `ASSISTENTE_LIMITE_DIARIO` | `200` |

> Sem `SESSION_SECRET` ninguém consegue entrar: é o que assina o cookie de
> sessão. Sem `DATABASE_URL`/`DIRECT_URL` o app sobe e quebra em toda tela.

## Build

O `package.json` tem `vercel-build`, que a Vercel usa automaticamente:

```
prisma migrate deploy && next build
```

As migrations pendentes rodam antes de compilar — assim o deploy nunca sobe
com o banco atrasado em relação ao código. O `postinstall` já roda
`prisma generate`.

## Caminho recomendado: ligar o repositório

Em vez de publicar por linha de comando, ligue o repositório do GitHub à
Vercel. Cada `git push` para `main` vira um deploy, sem ninguém ter que
lembrar de publicar.

1. vercel.com → **Add New → Project**
2. **Import Git Repository** → `marcosabreu123/VMmotos`
3. Framework: **Next.js** (detectado sozinho)
4. **Environment Variables**: cole as da tabela acima **antes** do primeiro
   deploy — sem elas o build até passa, mas o site quebra ao abrir
5. **Deploy**

## Depois do primeiro deploy

- [ ] Abrir a URL e entrar com a conta do dono
- [ ] Trocar as duas senhas em **Usuários** (hoje são fracas)
- [ ] Conferir se o sininho de alertas carrega (prova que o banco respondeu)
- [ ] Fazer uma venda de teste e **cancelar** em seguida
- [ ] Abrir no celular: é onde o dono vai usar

## Domínio próprio

Opcional, em **Project Settings → Domains**. Sem isso a URL fica
`vmmotos-*.vercel.app`, que funciona igual.

## Região das funções — não mexer sem motivo

O `vercel.json` fixa as funções em `gru1` (São Paulo). Isso não é preferência
estética: o banco está em `sa-east-1`, também São Paulo.

Sem essa configuração, a Vercel roda as funções em `iad1` (Washington), e cada
consulta ao banco atravessa São Paulo → Virgínia → São Paulo. Foi o que
aconteceu: o cabeçalho `x-vercel-id` mostrava `gru1::iad1` e cada tela levava
~2 segundos, com 6 a 8 consultas pagando ~130ms de viagem cada.

Se um dia o banco mudar de região, mude esta também — as duas andam juntas.
