(() => {
    'use strict';

    const board = document.getElementById('tt-board');
    const statusEl = document.getElementById('tt-status');
    const currentEl = document.getElementById('tt-current');
    const resetBtn = document.getElementById('tt-reset');
    const modePvp = document.getElementById('tt-2p');
    const modeAi = document.getElementById('tt-ai');
    const diffRow = document.getElementById('tt-diff');
    const diffEasy = document.getElementById('tt-easy');
    const diffHard = document.getElementById('tt-hard');

    if (!board) return;
    if (!statusEl) return;

    const cells = [];
    for (let i = 0; i < 9; i++) {
        const c = document.createElement('div');
        c.classList.add('tt-cell');
        board.appendChild(c);
        cells.push(c);
    }

    const WINNING = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

    let state = Array(9).fill('');
    let player = 'X';
    let active = true;
    let gameMode = 'ai';
    let aiDiff = 'hard';
    let score = { X: 0, O: 0, draw: 0 };
    let aiTimer = null;

    function render() {
        cells.forEach((c, i) => {
            c.textContent = state[i];
            c.className = 'tt-cell' + (state[i] ? ` ${state[i]}` : '');
        });
    }
    function updateStatus() {
        if (!active) return;
        currentEl.textContent = player;
        statusEl.textContent = `Vez do jogador ${player}`;
        statusEl.className = 'game-status';
    }
    function flashWin(combo) { combo.forEach(i => cells[i].classList.add('win')); }
    function endGame(msg, cls) {
        active = false;
        statusEl.textContent = msg;
        statusEl.className = `game-status ${cls}`;
        if (cls === 'draw') cells.forEach(c => c.classList.add('draw'));
    }
    function check() {
        for (const[a,b,c] of WINNING) {
            if (state[a] && state[a] === state[b] && state[a] === state[c])
                return { winner: state[a], combo: [a,b,c] };
        }
        if (!state.includes('')) return { winner: 'draw' };
        return null;
    }
    function showResult(r) {
        active = false;
        if (r.combo) {
            flashWin(r.combo);
            score[r.winner]++;
            endGame(`Jogador ${r.winner} venceu!`, 'win');
        } else {
            score.draw++;
            endGame('Empate!', 'draw');
        }
        document.getElementById('tt-sx').textContent = score.X;
        document.getElementById('tt-sd').textContent = score.draw;
        document.getElementById('tt-so').textContent = score.O;
    }

    function minimax(bd, p) {
        for(const [a,bb,c] of WINNING) {
            if (bd[a] && bd[a] === bd[bb] && bd[a] === bd[c]) return bd[a] === 'O' ? 10 : -10;
        }
        if (!bd.includes('')) return 0;
        if (p === 'O') {
            let best = -Infinity;
            for (let i = 0; i < 9; i++) { if (bd[i] === '') { bd[i] = 'O'; best = Math.max(best, minimax(bd,'X')); bd[i] = ''; } }
            return best;
        } else {
            let best = Infinity;
            for (let i = 0; i < 9; i++) { if (bd[i] === '') { bd[i] = 'X'; best = Math.min(best, minimax(bd,'O')); bd[i] = ''; } }
            return best;
        }
    }
    function getAIMove() {
        if (aiDiff === 'easy') {
            const avail = state.map((v,i) => v === '' ? i : null).filter(v => v !== null);
            return avail[Math.floor(Math.random() * avail.length)];
        }
        let best = -Infinity, bestMove = -1;
        for (let i = 0; i < 9; i++) {
            if (state[i] === '') {
                state[i] = 'O';
                const s = minimax(state, 'X');
                state[i] = '';
                if (s > best) { best = s; bestMove = i; }
            }
        }
        return bestMove;
    }

    function makeMove(idx) {
        state[idx] = player;
        render();
        const r = check();
        if (r) { showResult(r); return; }
        player = player === 'X' ? 'O' : 'X';
        updateStatus();
        if (gameMode === 'ai' && player === 'O' && active) {
            aiTimer = setTimeout(() => {
                const move = getAIMove();
                makeMove(move);
            }, 300);
        }
    }

    board.addEventListener('click', e => {
        const cell = e.target.closest('.tt-cell');
        if (!cell) return;
        const idx = cells.indexOf(cell);
        if (state[idx] !== '' || !active) return;
        makeMove(idx);
    });

    resetBtn.addEventListener('click', () => {
        if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
        state.fill(''); player = 'X'; active = true;
        render(); updateStatus();
    });

    function resetGame() {
        if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
        state.fill(''); player = 'X'; active = true;
        render(); updateStatus();
    }

    modePvp.addEventListener('click', () => {
        gameMode = 'pvp';
        modePvp.classList.add('active');
        modeAi.classList.remove('active');
        diffRow.classList.add('hidden');
        resetGame();
    });
    modeAi.addEventListener('click', () => {
        gameMode = 'ai';
        modeAi.classList.add('active');
        modePvp.classList.remove('active');
        diffRow.classList.remove('hidden');
        resetGame();
    });
    diffEasy.addEventListener('click', () => {
        aiDiff = 'easy';
        diffEasy.classList.add('active');
        diffHard.classList.remove('active');
        resetGame();
    });
    diffHard.addEventListener('click', () => {
        aiDiff = 'hard';
        diffHard.classList.add('active');
        diffEasy.classList.remove('active');
        resetGame();
    });

    render();
    updateStatus();
})();
