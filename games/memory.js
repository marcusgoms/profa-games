(() => {
    'use strict';
    const EMOJIS = ['🍎','🍋','🍇','🍉','🌸','🐶','🐱','⭐'];

    const board = document.getElementById('mem-board');
    const movesEl = document.getElementById('mem-moves');
    const pairsEl = document.getElementById('mem-pairs');
    const resetBtn = document.getElementById('mem-reset');
    const statusEl = document.getElementById('mem-status');

    if (!board) return;
    if (!movesEl) return;

    let pairs = 0, moves = 0, flipped = [], locked = false, flipTimer = null;
    let best = parseInt(localStorage.getItem('pf_memory') || '0', 10);

    let audioCtx = null;
    function tone(freq, dur, type = 'triangle', vol = 0.08) {
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.type = type; o.frequency.value = freq;
            g.gain.value = vol;
            g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
            o.connect(g); g.connect(audioCtx.destination);
            o.start(); o.stop(audioCtx.currentTime + dur);
        } catch(_) {}
    }

    function startGame() {
        board.innerHTML = '';
        pairs = 0; moves = 0; flipped = []; locked = false;
        movesEl.textContent = '0';
        pairsEl.textContent = '0';
        statusEl.className = 'game-status';

        const cards = [...EMOJIS, ...EMOJIS];
        for (let i = cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cards[i], cards[j]] = [cards[j], cards[i]];
        }

        cards.forEach((emoji, i) => {
            const card = document.createElement('div');
            card.classList.add('mem-card');
            card.dataset.emoji = emoji;
            card.dataset.index = i;
            board.appendChild(card);
        });
    }

    board.addEventListener('click', e => {
        const card = e.target.closest('.mem-card');
        if (!card || locked || card.classList.contains('flipped') || card.classList.contains('matched')) return;

        card.classList.add('flipped');
        card.textContent = card.dataset.emoji;
        flipped.push(card);
        tone(660, 0.08, 'sine', 0.1);

        if (flipped.length === 2) {
            moves++;
            document.getElementById('mem-moves').textContent = moves;
            locked = true;

            const [a, b] = flipped;
            if (a.dataset.emoji === b.dataset.emoji) {
                tone(880, 0.15, 'sine', 0.12);
                a.classList.add('matched');
                b.classList.add('matched');
                pairs++;
                document.getElementById('mem-pairs').textContent = pairs;
                flipped = [];
                locked = false;

                if (pairs === EMOJIS.length) {
                    if (!best || moves < best) {
                        best = moves;
                        localStorage.setItem('pf_memory', best);
                    }
                    const gamesPlayed = parseInt(localStorage.getItem('pf_games') || '0', 10) + 1;
                    localStorage.setItem('pf_games', gamesPlayed);
                    statusEl.className = 'game-status win';
                    statusEl.textContent = `Parabéns! Todos os pares em ${moves} jogadas! Recorde: ${best}`;
                    tone(523, 0.15, 'sine', 0.12);
                    setTimeout(() => tone(659, 0.15, 'sine', 0.12), 150);
                    setTimeout(() => tone(784, 0.3, 'sine', 0.12), 300);
                }
            } else {
                tone(200, 0.15, 'sawtooth', 0.06);
                flipTimer = setTimeout(() => {
                    a.classList.remove('flipped');
                    b.classList.remove('flipped');
                    a.textContent = '';
                    b.textContent = '';
                    flipped = [];
                    locked = false;
                }, 800);
            }
        }
    });

    resetBtn.addEventListener('click', startGame);
    startGame();
})();
