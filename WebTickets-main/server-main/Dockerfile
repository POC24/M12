# ── Imagem base ──────────────────────────────────────────────
# Node.js 18 em Alpine (versão leve ~50MB)
FROM node:18-alpine

# ── Pasta de trabalho dentro do container ────────────────────
WORKDIR /app

# ── Instalar dependências (com cache otimizada) ───────────────
# Copiamos só o package.json primeiro.
# Se o teu código mudar mas as dependências não, o Docker
# reutiliza esta camada e não volta a correr npm install.
COPY package*.json ./

RUN npm install --omit=dev

# ── Copiar o código da aplicação ─────────────────────────────
# O .dockerignore garante que não entra: data/, .env, node_modules/
COPY . .

# ── Criar a pasta de montagem da base de dados ───────────────
# Esta pasta será o ponto onde ligamos o diretório da VM.
# Precisa de existir antes de o container arrancar.
RUN mkdir -p /app/data

# ── Porta da aplicação ────────────────────────────────────────
EXPOSE 3000

# ── Comando de arranque ───────────────────────────────────────
CMD ["node", "app.js"]
