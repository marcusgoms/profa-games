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

window.PROFA_CONFIG = {
    // Riot Games API - obtenha em https://developer.riotgames.com/
    riotKey: localStorage.getItem('lol_key') || 'RGAPI-16e48557-eb13-41e8-9caa-6d30b83932bb',
    
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
