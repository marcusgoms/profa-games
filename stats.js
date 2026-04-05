(() => {
    'use strict';
    // Display stats on index page
    const snakeEl = document.getElementById('stat-snake');
    const pongEl = document.getElementById('stat-pong');
    const gamesEl = document.getElementById('stat-games');
    if (!snakeEl || !pongEl || !gamesEl) return;

    snakeEl.textContent = localStorage.getItem('pf_snake') || '0';
    pongEl.textContent = localStorage.getItem('pf_pong') || '0';
    gamesEl.textContent = localStorage.getItem('pf_games') || '0';
})();
