(() => {
    'use strict';

    const canvas = document.getElementById('snake-canvas');
    const statusEl = document.getElementById('snake-status');
    const controlsEl = document.getElementById('snake-controls');
    const resetBtn = document.getElementById('snake-reset');

    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const CELL = 16;
    const COLS = W / CELL, ROWS = H / CELL;

    let snake, dir, nextDir, food, score, gameOver, running, snakeTimer;

    function isMobile() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    function spawnFood() {
        while (true) {
            const f = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
            if (!snake.some(s => s.x === f.x && s.y === f.y)) return f;
        }
    }

    function startGame() {
        if (snakeTimer) clearTimeout(snakeTimer);
        snakeTimer = null;
        snake = [{ x: 10, y: 10 }];
        dir = { x: 1, y: 0 };
        nextDir = { x: 1, y: 0 };
        food = spawnFood();
        score = 0;
        gameOver = false;
        running = true;
        statusEl.textContent = 'Pontuação: 0';
        controlsEl.classList.toggle('hidden', !isMobile());
        gameLoop();
    }

    function draw() {
        ctx.fillStyle = '#0a0a15';
        ctx.fillRect(0, 0, W, H);
        snake.forEach((s, i) => {
            ctx.fillStyle = i === 0 ? '#66bb6a' : '#43a047';
            ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
        });
        ctx.fillStyle = '#ef5350';
        ctx.fillRect(food.x * CELL + 1, food.y * CELL + 1, CELL - 2, CELL - 2);
    }

    function update() {
        if (gameOver) return;
        dir = { ...nextDir };
        const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
        if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS ||
            snake.some(s => s.x === head.x && s.y === head.y)) {
            gameOver = true;
            running = false;
            statusEl.textContent = `Game Over! Pontuação: ${score}`;
            return;
        }
        snake.unshift(head);
        if (head.x === food.x && head.y === food.y) {
            score++;
            statusEl.textContent = `Pontuação: ${score}`;
            food = spawnFood();
        } else {
            snake.pop();
        }
    }

    function gameLoop() {
        if (gameOver || !running) return;
        update();
        draw();
        snakeTimer = setTimeout(gameLoop, Math.max(60, 140 - score * 3));
    }

    function setDir(dx, dy) {
        if (dir.x === -dx && dir.y === -dy) return;
        if (dir.x === dx && dir.y === dy) return;
        nextDir = { x: dx, y: dy };
    }

    function keyHandler(e) {
        switch (e.key) {
            case 'ArrowUp': case 'w': e.preventDefault(); setDir(0, -1); break;
            case 'ArrowDown': case 's': e.preventDefault(); setDir(0, 1); break;
            case 'ArrowLeft': case 'a': e.preventDefault(); setDir(-1, 0); break;
            case 'ArrowRight': case 'd': e.preventDefault(); setDir(1, 0); break;
        }
    }

    document.addEventListener('keydown', keyHandler);

    document.getElementById('ctrl-up').addEventListener('click', () => setDir(0, -1));
    document.getElementById('ctrl-down').addEventListener('click', () => setDir(0, 1));
    document.getElementById('ctrl-left').addEventListener('click', () => setDir(-1, 0));
    document.getElementById('ctrl-right').addEventListener('click', () => setDir(1, 0));

    resetBtn.addEventListener('click', startGame);

    startGame();

    draw();
})();
