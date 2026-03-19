FROM node:20-alpine

LABEL maintainer="Etudiant Génie Logiciel"
LABEL description="PEMS-BAY Backend — Node.js + Express + MongoDB"

WORKDIR /app

# Copier package.json en premier (cache Docker)
COPY package.json .
RUN npm install

# Copier le reste du code
COPY server.js .

EXPOSE 5000

CMD ["node", "server.js"]
