# Zôada — Música. Sem Rótulos.

App social de streaming de música, estilo Progressive Web App (PWA).

## Funcionalidades

- 🔐 Login com email/senha (Supabase Auth)
- 🎵 Player de música com controles completos
- 📱 Tela de player em formato 9:16 (vertical)
- ❤️ Curtidas por faixa
- 💬 Comentários por faixa
- 📨 Chat entre usuários em tempo real
- 🎨 Interface escura com gradiente laranja → rosa → roxo
- 📲 Instalável no celular (PWA)
- 🔊 Audio em segundo plano (Media Session API)
- 📡 Funcionamento offline básico (Service Worker)

## Telas

1. **Login** — Email/senha com logo Zôada
2. **Explorar** — Grade de capas de álbuns/artistas
3. **Player** — Capa 9:16, controles, progresso, curtir, comentar
4. **Perfil** — Nome, foto, lista de curtidas
5. **Chat** — Mensagens em tempo real entre usuários

## Configuração do Supabase

### 1. Criar projeto no Supabase

1. Acesse [https://supabase.com](https://supabase.com) e crie uma conta
2. Crie um novo projeto
3. Anote a **Project URL** e a **anon public key**

### 2. Executar o schema SQL

1. No painel do Supabase, vá em **SQL Editor**
2. Clique em **New query**
3. Cole o conteúdo do arquivo `public/zoada-schema.sql`
4. Clique em **Run** para executar

Isso criará as tabelas: `usuarios`, `artistas`, `faixas`, `curtidas`, `comentarios`, `mensagens`.

### 3. Configurar o app

Edite o arquivo `src/lib/supabase.ts` e preencha:

```typescript
export const SUPABASE_CONFIG = {
  URL: 'https://SEU-PROJETO.supabase.co',
  ANON_KEY: 'sua-chave-anon-public-aqui',
};
```

### 4. Habilitar Realtime (chat em tempo real)

1. No Supabase, vá em **Database → Replication**
2. Certifique-se de que `supabase_realtime` está habilitado
3. Vá em **Database → Publications** e adicione a tabela `mensagens` à publicação `supabase_realtime`

## Desenvolvimento

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev

# Abrir no navegador
# Acesse http://localhost:3000
```

## Deploy no GitHub Pages / Vercel

### GitHub Pages
1. Faça push do projeto para um repositório GitHub
2. Vá em **Settings → Pages**
3. Selecione a branch `main` e pasta `/`
4. O site será publicado em `https://SEU-USER.github.io/REPO-NAME/`

### Vercel (recomendado)
1. Conecte o repositório no [Vercel](https://vercel.com)
2. O deploy é automático a cada push

## Instalar no celular

### Android (Chrome)
1. Abra o app no navegador
2. Toque no menu (⋮) → "Adicionar à tela inicial"
3. Confirme a instalação

### iPhone (Safari)
1. Abra o app no Safari
2. Toque no ícone de compartilhar (↑)
3. Toque em "Adicionar à Tela de Início"
4. Toque em "Adicionar"

## Estrutura de Arquivos

```
├── public/
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service Worker
│   ├── zoada-logo.png         # Logo do app
│   └── zoada-schema.sql       # Schema SQL para Supabase
├── src/
│   ├── app/
│   │   ├── globals.css         # Estilos globais e tema
│   │   ├── layout.tsx         # Layout com metadata PWA
│   │   ├── page.tsx            # SPA principal
│   │   └── api/
│   │       ├── auth/login/     # API de login
│   │       ├── tracks/         # API de faixas
│   │       ├── likes/         # API de curtidas
│   │       ├── comments/      # API de comentários
│   │       └── messages/       # API de mensagens
│   ├── components/zoada/
│   │   ├── LoginScreen.tsx
│   │   ├── MainScreen.tsx
│   │   ├── PlayerScreen.tsx
│   │   ├── ProfileScreen.tsx
│   │   ├── ChatScreen.tsx
│   │   ├── BottomNav.tsx
│   │   ├── MiniPlayer.tsx
│   │   ├── CoverArt.tsx
│   │   ├── Equalizer.tsx
│   │   └── GradientButton.tsx
│   ├── lib/
│   │   ├── supabase.ts        # Configuração do Supabase
│   │   ├── demo-data.ts       # Dados de demonstração
│   │   ├── db.ts              # Prisma DB
│   │   └── utils.ts           # Utilidades
│   ├── store/
│   │   └── useAppStore.ts     # Zustand store
│   └── types/
│       └── index.ts           # Tipos TypeScript
├── prisma/
│   └── schema.prisma
├── package.json
└── README.md
```

## Tecnologias

- **Frontend**: Next.js 16, React 19, TypeScript 5, Tailwind CSS 4
- **Estado**: Zustand
- **UI**: shadcn/ui, Lucide Icons
- **Backend**: Supabase (Auth, Database, Storage, Realtime)
- **PWA**: Service Worker, Manifest, Media Session API
