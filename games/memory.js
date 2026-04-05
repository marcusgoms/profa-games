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

    function startGame() {
        board.innerHTML = '';
        pairs = 0; moves = 0; flipped = []; locked = false;
        movesEl.textContent = '0';
        pairsEl.textContent = '0';
        statusEl.className = 'game-status';
        statusEl.innerHTML = `<span style="margin:0 12px">Jogadas: <strong id="mem-moves">0</strong></span><span style="margin:0 12px">Pares: <strong id="mem-pairs">0</strong>/8</span>`;

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

        if (flipped.length === 2) {
            moves++;
            document.getElementById('mem-moves').textContent = moves;
            locked = true;

            const [a, b] = flipped;
            if (a.dataset.emoji === b.dataset.emoji) {
                a.classList.add('matched');
                b.classList.add('matched');
                pairs++;
                document.getElementById('mem-pairs').textContent = pairs;
                flipped = [];
                locked = false;

                if (pairs === EMOJIS.length) {
                    statusEl.className = 'game-status win';
                    statusEl.textContent = `Parabéns! Você encontrou todos os ${EMOJIS.length} pares em ${moves} jogadas!`;
                }
            } else {
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
