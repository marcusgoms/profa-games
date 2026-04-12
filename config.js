/**
 * PROFA GAMES - Configuration
 * 
 * Para atualizar as chaves de API:
 * 1. Abra https://lolesports.com
 * 2. Pressione F12 (Developer Tools)
 * 3. Vá para Network tab
 * 4. Procure por uma requisição "esports-api"
 * 5. Copie o header "x-api-key"
 * 6. Atualize a variável abaixo
 */

// ======================== FIREBASE ========================
// Crie um projeto gratuito em https://console.firebase.google.com/
// 1. Criar projeto > Ativar Realtime Database (modo teste)
// 2. Copiar config do projeto (Configurações > Geral > Seus apps > Web)
// 3. Colar os valores abaixo
window.PROFA_FIREBASE = {
    apiKey: "AIzaSyBS3bV_L0aqDjHcEIjNVKNur8Nh9xGE4rs",
    authDomain: "profa-games.firebaseapp.com",
    databaseURL: "https://profa-games-default-rtdb.firebaseio.com",
    projectId: "profa-games",
    storageBucket: "profa-games.firebasestorage.app",
    messagingSenderId: "957862939799",
    appId: "1:957862939799:web:fa2914ab076d5bf6c8add2"
};

window.PROFA_CONFIG = {
    // Riot Games API - obtenha em https://developer.riotgames.com/
    riotKey: localStorage.getItem('lol_key') || 'RGAPI-ad7ff338-c0d0-4304-ad5e-e0b02ff6fb75',

    // LoL Esports API - obtenha em https://lolesports.com (F12 > Network > esports-api > x-api-key)
    esportsKey: localStorage.getItem('esports_key') || '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z',
    
    // Função para atualizar as chaves
    updateKeys(riotKey, esportsKey) {
        if (riotKey) {
            localStorage.setItem('lol_key', riotKey);
            this.riotKey = riotKey;
        }
        if (esportsKey) {
            localStorage.setItem('esports_key', esportsKey);
            this.esportsKey = esportsKey;
        }
        console.log('✓ Chaves de API atualizadas!');
        window.location.reload();
    },
    
    // Limpar chaves armazenadas
    resetKeys() {
        localStorage.removeItem('lol_key');
        localStorage.removeItem('esports_key');
        console.log('✓ Chaves limpas!');
        window.location.reload();
    },
    
    // Abrir console para debug
    openConsole() {
        console.log('PROFA GAMES Configuration');
        console.log('========================');
        console.log('Para atualizar a chave Riot:', 'PROFA_CONFIG.updateKeys("sua-chave-riot", null)');
        console.log('Para atualizar a chave Esports:', 'PROFA_CONFIG.updateKeys(null, "sua-chave-esports")');
        console.log('Para atualizar ambas:', 'PROFA_CONFIG.updateKeys("chave-riot", "chave-esports")');
        console.log('Para limpar:', 'PROFA_CONFIG.resetKeys()');
        console.log('Chave Riot atual:', this.riotKey.substring(0, 10) + '***');
        console.log('Chave Esports atual:', this.esportsKey.substring(0, 10) + '***');
    }
};

console.log('✓ PROFA GAMES Config carregado. Digite PROFA_CONFIG.openConsole() para ver as opções.');
