# Zôada — Música. Sem Rótulos.

App social de streaming de música, estilo Progressive Web App (PWA).

**Stack:** Next.js 16 · Neon (Postgres) · Cloudflare R2 · JWT Auth · Prisma ORM

## Funcionalidades

- 🔐 Registro/Login com email/senha (JWT + bcrypt)
- 🎵 Player de música com controles completos
- 📱 Tela de player em formato 9:16 (vertical)
- ❤️ Curtidas por faixa (toggle via API)
- 💬 Comentários por faixa
- 📨 Chat entre usuários
- 🎨 Interface escura com gradiente laranja → rosa → roxo
- 📲 Instalável no celular (PWA)
- 🔊 Audio em segundo plano (Media Session API)
- 📡 Funcionamento offline básico (Service Worker)
- ☁️ Upload de arquivos para Cloudflare R2

## Arquitetura

```
Frontend (React/Next.js) → API Routes (/api/*) → Neon (Postgres) via Prisma
                                            → Cloudflare R2 via S3 SDK
                                            → JWT Auth via jose
```

| Camada | Tecnologia | Arquivo |
|--------|-----------|---------|
| Database | Neon Postgres | `prisma/schema.prisma` |
| ORM | Prisma | `src/lib/db.ts` |
| Auth | JWT (HS256) + bcrypt | `src/lib/auth.ts` |
| Storage | Cloudflare R2 (S3) | `src/lib/r2.ts` |
| Config | Environment vars | `src/lib/config.ts` |
| API Client | fetch wrapper | `src/lib/api.ts` |

## Configuração

### 1. Neon (Postgres)

1. Acesse [https://console.neon.tech](https://console.neon.tech)
2. Crie um projeto e copie a **Connection string**
3. Formato: `postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require`

### 2. Cloudflare R2

1. Acesse [https://dash.cloudflare.com](https://dash.cloudflare.com) → R2
2. Crie um bucket (ex: `zoada-storage`)
3. Vá em **Manage R2 API Tokens** → Create API Token
4. Copie: Account ID, Access Key ID, Secret Access Key
5. (Opcional) Configure um **Public URL** (r2.dev ou custom domain)

### 3. JWT Secret

Gere uma chave secreta forte:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Arquivo .env

```bash
cp .env.example .env
```

Preencha o `.env` com suas próprias credenciais (Neon, R2 e JWT) — veja `.env.example` para a lista completa de variáveis necessárias e onde obter cada uma.

> ⚠️ **Nunca** faça commit do arquivo `.env` (com valores reais) nem cole credenciais reais em `.env.example`, README ou qualquer outro arquivo versionado. Se algum segredo real for exposto acidentalmente (banco, storage, JWT), revogue e gere um novo imediatamente.

### 5. Push do schema para o Neon

```bash
# Gerar Prisma Client
npx prisma generate

# Push schema para o banco
npx prisma db push
```

Isso cria automaticamente todas as tabelas do app a partir de `prisma/schema.prisma`.

## Desenvolvimento

```bash
npm install
cp .env.example .env   # Preencha suas credenciais
npm run dev            # http://localhost:3000
```

O app funciona com **dados demo** quando o Neon não está configurado.

## API Routes

| Método | Rota | Autenticação | Descrição |
|--------|------|:---:|----------|
| POST | `/api/auth/register` | ❌ | Criar conta |
| POST | `/api/auth/login` | ❌ | Login (retorna JWT) |
| GET | `/api/tracks` | ❌ | Listar faixas |
| POST | `/api/tracks` | ✅ | Criar faixa |
| GET | `/api/artists` | ❌ | Listar artistas |
| POST | `/api/artists` | ✅ | Criar artista |
| GET | `/api/likes` | ❌ | Listar curtidas |
| POST | `/api/likes` | ✅ | Curtir/Descurtir (toggle) |
| DELETE | `/api/likes` | ✅ | Remover curtida |
| GET | `/api/comments` | ❌ | Listar comentários |
| POST | `/api/comments` | ✅ | Criar comentário |
| GET | `/api/messages` | ✅ | Listar conversas/mensagens |
| POST | `/api/messages` | ✅ | Enviar mensagem |
| POST | `/api/storage/upload` | ✅ | Upload para R2 |
| GET | `/api/storage/presign` | ✅ | URL assinada R2 |
| DELETE | `/api/storage/delete` | ✅ | Deletar do R2 |
| POST | `/api/reports` | ✅ (usuário) | Denunciar postagem/comentário/faixa/perfil |
| GET | `/api/reports` | 🔐 (moderador) | Listar denúncias — painel de moderação |
| PATCH | `/api/reports` | 🔐 (moderador) | Atualizar status/nota de uma denúncia |
| GET | `/api/moderacao/mensagens` | ✅ (usuário) / 🔐 (moderador) | Ler a conversa (usuário: a própria; moderador: `?usuario_id=` ou lista de threads) |
| POST | `/api/moderacao/mensagens` | ✅ (usuário) / 🔐 (moderador) | Enviar mensagem no canal de suporte com a moderação |
| GET | `/api/radio-padrao` | ❌ | Estado atual da Rádio Zôada (playlist, pausada, faixa atual) |
| GET | `/api/moderacao/radio` | 🔐 (moderador) | Estado atual da Rádio Zôada, para o painel de moderação |
| PATCH | `/api/moderacao/radio` | 🔐 (moderador) | Controlar a Rádio Zôada: `set_info`, `set_tracks`, `pause`, `resume`, `advance` |

## Painel de moderação (denúncias)

Canal de denúncia + painel de moderação, para responder ao ponto do Marco
Civil (pós-decisão do STF de jun/2025): qualquer usuário logado pode
denunciar uma postagem, comentário, faixa ou perfil pelo próprio app (botão
🚩), e essas denúncias caem num painel **separado do app**, em HTML puro
(sem build, sem dependências), pensado pra quem modera acessar rápido de
qualquer lugar.

- **Onde:** `/moderacao` (arquivo real: `public/moderacao/index.html`).
- **Como autenticar:** defina `MODERATION_SECRET` no `.env` (veja
  `.env.example`) e cole o mesmo valor no campo "Chave de moderação" do
  painel — ele fica salvo só no `localStorage` do seu navegador.
- **O que dá pra fazer:** ver denúncias por status (pendente / em análise /
  resolvida / rejeitada), ver um retrato do conteúdo denunciado (mesmo que
  o autor já tenha apagado o original) e mudar o status com uma nota
  interna.
- **O que este painel básico ainda NÃO faz:** remover o conteúdo
  automaticamente ao marcar "Resolvida" — hoje isso ainda é manual (apagar
  pelo `/api/posts`, `/api/tracks` etc., ou direto no banco). É a
  estrutura inicial pedida; dá pra evoluir depois para remoção automática
  e notificação às autoridades nos casos de exploração infantil, exigidos
  pela ECA Digital.

### Canal de mensagens com a moderação

Além das denúncias (sobre um conteúdo específico), existe um canal de
mensagens tipo "fale conosco" entre cada usuário e a equipe de moderação —
uma thread única por usuário, para dúvidas, contestar uma denúncia, pedir
ajuda com a conta, etc.

- **Lado do usuário:** painel "Fale com a Moderação", dentro do Perfil no
  app (`SupportChatPanel`).
- **Lado da moderação:** aba "💬 Mensagens" no mesmo painel externo
  (`/moderacao`), autenticada com a mesma `MODERATION_SECRET` — lista as
  conversas com badge de não lidas e permite responder.
- **API:** `/api/moderacao/mensagens` (ver tabela acima).

### Controle total da Rádio Zôada

A "Rádio Zôada" é a estação padrão/sempre disponível do app (a primeira
opção no dial da tela de Rádio). A moderação tem controle total sobre ela
pelo mesmo painel externo:

- **Lado da moderação:** aba "📻 Rádio Zôada" em `/moderacao`, autenticada
  com a mesma `MODERATION_SECRET`. Dá pra: montar/reordenar a playlist a
  partir de todo o catálogo de faixas, pausar/retomar a transmissão pra
  todo mundo, pular pra próxima faixa, e editar o nome/capa da estação.
- **Lado do app:** todo mundo que abrir a Rádio Zôada ouve a playlist
  curada, sincronizada (quem entra no meio de uma faixa já ouve a partir
  do ponto certo) e some do ar se a moderação pausar. Sem nenhuma playlist
  configurada, a estação volta ao comportamento padrão (shuffle de todo o
  catálogo).
- **API:** `/api/radio-padrao` (leitura pública) e `/api/moderacao/radio`
  (controle, ver tabela acima).

## Instalar no celular

### Android (Chrome)
1. Abra o app → menu (⋮) → "Adicionar à tela inicial"

### iPhone (Safari)
1. Abra o app → compartilhar (↑) → "Adicionar à Tela de Início"

## Estrutura de Arquivos

```
├── .env.example              # Template de variáveis de ambiente
├── prisma/
│   └── schema.prisma         # Schema Prisma (fonte de verdade)
├── public/
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service Worker
│   ├── zoada-logo.png         # Logo
│   ├── zoada-neon-schema.sql  # SQL de referência
│   └── zoada-schema.sql       # SQL antigo (Supabase, legado)
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx            # SPA principal
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── register/route.ts  # Registro + JWT
│   │       │   └── login/route.ts     # Login + JWT
│   │       ├── tracks/route.ts
│   │       ├── artists/route.ts
│   │       ├── likes/route.ts
│   │       ├── comments/route.ts
│   │       ├── messages/route.ts
│   │       └── storage/
│   │           ├── upload/route.ts     # R2 upload
│   │           └── delete/route.ts     # R2 delete
│   ├── components/zoada/      # 11 componentes de UI
│   ├── lib/
│   │   ├── config.ts           # Neon + R2 + JWT config
│   │   ├── db.ts               # Prisma client
│   │   ├── auth.ts             # JWT create/verify (server)
│   │   ├── r2.ts               # R2 S3 client (server)
│   │   ├── api.ts              # API helpers (client)
│   │   ├── supabase.ts         # Re-export (legacy)
│   │   ├── demo-data.ts        # Dados demo
│   │   └── utils.ts
│   ├── store/
│   │   └── useAppStore.ts     # Zustand (state + auth persistence)
│   └── types/
│       └── index.ts
└── README.md
```

## Migração do Supabase para Neon + R2

### O que mudou

| Antes (Supabase) | Depois (Neon + R2) |
|---|---|
| `supabase.auth.signInWithPassword()` | JWT via `jose` + bcrypt |
| `supabase.from('tabela').select()` | Prisma ORM (`db.faixa.findMany()`) |
| `supabase.storage.from('bucket')` | Cloudflare R2 via `@aws-sdk/client-s3` |
| RLS (Row Level Security) | Validação manual em API routes |
| Supabase Realtime | WebSocket mini-service (futuro) |
| Variáveis no código | Variáveis de ambiente (.env) |

### Rotas de API novas

- `/api/auth/register` — Novo endpoint de registro
- `/api/storage/upload` — Upload para R2
- `/api/storage/delete` — Delete do R2
- `/api/storage/presign` — URL assinada para arquivos privados
- `/api/artists` — CRUD de artistas

### Autenticação

- Tokens JWT com expiração configurável
- Store com persistência no localStorage
- Header `Authorization: Bearer <token>` em todas as requests
- Helper `apiFetch()` para requests autenticadas automaticamente
