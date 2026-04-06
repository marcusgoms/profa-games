# 🎮 PROFA GAMES - Guia de Configuração

## ✅ Status do Projeto

- ✓ Website estático (index.html, about.html, jogos) - **PRONTO**
- ✓ Projeto React (Live LoL Esports) - **COMPILADO COM SUCESSO**
- ✓ Configuração de chaves de API - **IMPLEMENTADA**

---

## 📋 O que foi corrigido

### 1. **Configuração de Variáveis de Ambiente (React)**
- Arquivo `.env` criado na pasta `live-lol-esports-main/`
- `.env.example` com instruções de como obter as chaves
- API key atualizada para ler de variáveis de ambiente

### 2. **Sistema de Configuração (Website Estático)**
- Criado arquivo `config.js` com suporte a:
  - Atualizar chaves de API via console
  - Salvar chaves no localStorage
  - Reset de chaves quando necessário

### 3. **Build do Projeto React**
- ✓ Dependências instaladas e atualizadas
- ✓ Build otimizado criado em `live-lol-esports-main/build/`
- ✓ Sem erros de compilação

---

## 🔧 Como Atualizar as Chaves de API

### **Para o Website (index.html)**

Abra o console do navegador (F12) e execute:

```javascript
// Ver status das chaves
PROFA_CONFIG.openConsole()

// Atualizar chave Esports (LoL Esports)
PROFA_CONFIG.updateKeys(null, "SUA_CHAVE_AQUI")

// Atualizar chave Riot
PROFA_CONFIG.updateKeys("SUA_CHAVE_AQUI", null)

// Atualizar ambas
PROFA_CONFIG.updateKeys("NOVA_CHAVE_RIOT", "NOVA_CHAVE_ESPORTS")

// Limpar todas as chaves salvas
PROFA_CONFIG.resetKeys()
```

### **Para o Projeto React**

Edite o arquivo `live-lol-esports-main/.env`:

```env
REACT_APP_LOLESPORTS_API_KEY=sua_chave_de_api_aqui
```

---

## 📡 Onde Obter as Chaves

### **LoL Esports API**
1. Acesse: https://lolesports.com
2. Pressione **F12** (Developer Tools)
3. Vá para a aba **Network**
4. Procure por uma requisição com "esports-api" no nome
5. Clique nela
6. Vá para **Headers**
7. Procure pelo header `x-api-key`
8. Copie o valor completo

### **Riot Games API**
1. Acesse: https://developer.riotgames.com/
2. Faça login ou crie uma conta
3. Vá para **API Keys**
4. Crie uma nova chave ou use a existente
5. Copie e salve em um local seguro

---

## 🚀 Como Rodar o Projeto

### **Website Estático**
Simplesmente abra `index.html` em um navegador web.

### **Projeto React (Desenvolvimento)**

```bash
cd live-lol-esports-main
npm start
```

O servidor iniciará em `http://localhost:3000`

### **Projeto React (Build para Produção)**

```bash
cd live-lol-esports-main
npm run build
```

O build será criado na pasta `build/`

---

## 📝 Estrutura do Projeto

```
claw-code-main/
├── index.html              # Home com integração LoL Esports
├── about.html              # Página sobre
├── style.css               # Estilos globais
├── config.js               # ✨ Novo: Gerenciador de chaves de API
├── games/
│   ├── snake.js           # Jogo da cobrinha
│   ├── pong.js            # Jogo do pong
│   ├── memory.js          # Jogo da memória
│   └── tictactoe.js       # Jogo da velha (com IA)
├── live-lol-esports-main/
│   ├── .env               # ✨ Novo: Variáveis de ambiente
│   ├── .env.example       # ✨ Novo: Exemplo de .env
│   ├── src/
│   │   ├── App.tsx
│   │   ├── utils/
│   │   │   └── LoLEsportsAPI.ts    # ✨ Atualizado: lê de env
│   │   ├── components/
│   │   └── ...
│   ├── package.json
│   ├── build/             # ✨ Novo: Build compilado
│   └── node_modules/
└── memory/
    └── project_lol_riot_api.md
```

---

## ⚠️ Notas Importantes

1. **Chaves de API são sensíveis**: Nunca compartilhe suas chaves em repositórios públicos
2. **localStorage**: As chaves do website são salvas no localStorage do navegador
3. **CORS**: Se tiver erros CORS, a API pode estar bloqueando requisições do navegador
4. **Rate Limiting**: Ambas as APIs têm limite de requisições

---

## 🐛 Troubleshooting

### Erro: "Esports 400: Invalid request parameters"
- Verifique se a chave de API está correta
- Tente obter uma nova chave em lolesports.com

### Erro: "CORS error"
- Pode ser bloqueio da API
- Teste em um servidor diferente

### Erro ao compilar React
- Delete a pasta `node_modules/` e `.package-lock.json`
- Execute `npm install` novamente

---

## 📞 Suporte

Para mais informações, abra o console e execute:
```javascript
PROFA_CONFIG.openConsole()
```

---

**Última atualização**: Abril 2026
**Status**: ✅ Tudo funcionando!
