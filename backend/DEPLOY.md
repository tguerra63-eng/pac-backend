# 🚀 GUIA DE DEPLOY — PRODUTOR AO COMPRADOR
# Backend Node.js + PostgreSQL na Railway (gratuito para começar)

## ═══════════════════════════════════════════════════════════
## PASSO 1 — CRIAR CONTA NA RAILWAY
## ═══════════════════════════════════════════════════════════

1. Acesse: https://railway.app
2. Clique em "Login" → "Login with GitHub"
3. Se não tiver GitHub, crie em github.com (é gratuito)
4. Autorize a Railway

## ═══════════════════════════════════════════════════════════
## PASSO 2 — CRIAR PROJETO COM BANCO DE DADOS
## ═══════════════════════════════════════════════════════════

1. No painel da Railway, clique em "+ New Project"
2. Clique em "Provision PostgreSQL"
3. O banco de dados é criado automaticamente
4. Clique no banco → aba "Connect" → copie a DATABASE_URL
   (parece com: postgresql://postgres:xxx@xxx.railway.app:5432/railway)

## ═══════════════════════════════════════════════════════════
## PASSO 3 — SUBIR O CÓDIGO DO BACKEND
## ═══════════════════════════════════════════════════════════

No mesmo projeto Railway:
1. Clique em "+ New" → "GitHub Repo"
2. Se ainda não conectou o GitHub, conecte
3. Crie um repositório no GitHub com os arquivos desta pasta /backend
4. Selecione o repositório

## ═══════════════════════════════════════════════════════════
## PASSO 4 — CONFIGURAR VARIÁVEIS DE AMBIENTE
## ═══════════════════════════════════════════════════════════

No serviço Node.js da Railway:
1. Clique na aba "Variables"
2. Adicione cada variável:

DATABASE_URL          → (cole a URL do banco que copiou no Passo 2)
JWT_SECRET            → (gere aqui: https://generate-secret.vercel.app/64)
JWT_EXPIRES_IN        → 7d
PORT                  → 3333
NODE_ENV              → production
ADMIN_EMAIL           → talles_guerra@hotmail.com
ADMIN_PASSWORD_PLAIN  → (sua senha — só para o seed, depois apague)
ZAPI_INSTANCE_ID      → (do z-api.io)
ZAPI_TOKEN            → (do z-api.io)
ZAPI_CLIENT_TOKEN     → (do z-api.io)

## ═══════════════════════════════════════════════════════════
## PASSO 5 — RODAR AS MIGRAÇÕES E SEED
## ═══════════════════════════════════════════════════════════

Na Railway, clique no serviço Node.js → aba "Settings" → "Deploy"
Em "Custom Start Command", coloque:
  npx prisma migrate deploy && npx prisma generate && node src/prisma/seed.js && node src/server.js

Isso vai:
✅ Criar todas as tabelas no banco
✅ Criar seu usuário admin com senha criptografada
✅ Iniciar o servidor

## ═══════════════════════════════════════════════════════════
## PASSO 6 — PEGAR A URL DO SERVIDOR
## ═══════════════════════════════════════════════════════════

1. Na Railway, clique no serviço → aba "Settings" → "Networking"
2. Clique em "Generate Domain"
3. Você terá uma URL tipo: https://seu-app.railway.app
4. Teste acessando: https://seu-app.railway.app/health
   Deve retornar: {"status":"ok"}

## ═══════════════════════════════════════════════════════════
## PASSO 7 — CONECTAR O FRONTEND AO BACKEND
## ═══════════════════════════════════════════════════════════

No arquivo index.html do frontend, adicione no topo do <script>:
  const API_URL = 'https://seu-app.railway.app/api'

Substitua as funções de login, cadastro, etc. para fazer fetch() real.

## ═══════════════════════════════════════════════════════════
## CONFIGURAR Z-API (WHATSAPP)
## ═══════════════════════════════════════════════════════════

1. Acesse: https://z-api.io
2. Crie conta e uma nova instância
3. Escaneie o QR Code com seu WhatsApp
4. Copie Instance ID, Token e Client-Token
5. Cole nas variáveis da Railway

## ═══════════════════════════════════════════════════════════
## SEGURANÇA — COISAS IMPORTANTES
## ═══════════════════════════════════════════════════════════

✅ A senha é salva com bcrypt (hash irreversível) — nunca em texto puro
✅ JWT expira em 7 dias — usuário precisa logar novamente
✅ Admin só acessa rotas /api/admin com token válido
✅ Cada usuário só vê seus próprios pedidos
✅ Após rodar o seed, APAGUE a variável ADMIN_PASSWORD_PLAIN

## ═══════════════════════════════════════════════════════════
## ROTAS DISPONÍVEIS
## ═══════════════════════════════════════════════════════════

POST  /api/auth/register          → Cadastrar usuário
POST  /api/auth/login             → Fazer login
POST  /api/auth/verify-whatsapp   → Verificar código WhatsApp
GET   /api/auth/me                → Dados do usuário logado

GET   /api/products               → Listar produtos (público)
GET   /api/products/:id           → Ver produto
POST  /api/products               → Criar produto (produtor)
PUT   /api/products/:id           → Editar produto

GET   /api/orders                 → Meus pedidos
POST  /api/orders                 → Criar pedido (comprador)
GET   /api/orders/:id             → Ver pedido
POST  /api/orders/:id/accept      → Aceitar pedido (produtor)
POST  /api/orders/:id/refuse      → Recusar pedido (produtor)
POST  /api/orders/:id/deliver     → Marcar como entregue

# ADMIN (requer login admin)
GET   /api/admin/dashboard        → Painel geral
GET   /api/admin/users            → Todos os usuários
PUT   /api/admin/users/:id        → Editar usuário
POST  /api/admin/users/:id/validate-kyc → Validar KYC
GET   /api/admin/products         → Todos os produtos
GET   /api/admin/orders           → Todos os pedidos
GET   /api/admin/orders/:id/messages → Ver mensagens do pedido
GET   /api/admin/financial        → Financeiro completo
GET   /api/admin/reviews          → Todas as avaliações
POST  /api/admin/notify           → Enviar notificação manual
