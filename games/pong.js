(() => {
    'use strict';

    const canvas = document.getElementById('pong-canvas');
    const statusEl = document.getElementById('pong-status');
    const resetBtn = document.getElementById('pong-reset');

    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const PADDLE_W = 12, PADDLE_H = 60, BALL_R = 6;
    const WIN_SCORE = 7, AI_SPEED = 3.5;

    let player, ai, ball, pongFrame, running;

    function resetBall() {
        return {
            x: W / 2, y: H / 2,
            vx: (Math.random() > 0.5 ? 1 : -1) * 4,
            vy: (Math.random() - 0.5) * 4,
        };
    }

    function startGame() {
        if (pongFrame) cancelAnimationFrame(pongFrame);
        pongFrame = null;
        player = { x: 12, y: H / 2 - PADDLE_H / 2, score: 0 };
        ai = { x: W - 12 - PADDLE_W, y: H / 2 - PADDLE_H / 2, score: 0 };
        ball = resetBall();
        running = true;
        statusEl.textContent = 'Arraste o mouse ou toque para mover a raquete';
        gameLoop();
    }

    function update() {
        ball.x += ball.vx;
        ball.y += ball.vy;

        if (ball.y - BALL_R <= 0) { ball.y = BALL_R; ball.vy *= -1; }
        if (ball.y + BALL_R >= H) { ball.y = H - BALL_R; ball.vy *= -1; }

        const aiCenter = ai.y + PADDLE_H / 2;
        if (aiCenter < ball.y - 10) ai.y += AI_SPEED;
        else if (aiCenter > ball.y + 10) ai.y -= AI_SPEED;
        ai.y = Math.max(0, Math.min(H - PADDLE_H, ai.y));

        if (ball.x - BALL_R <= player.x + PADDLE_W &&
            ball.y >= player.y && ball.y <= player.y + PADDLE_H && ball.vx < 0) {
            ball.vx *= -1.05;
            ball.vy = ((ball.y - (player.y + PADDLE_H / 2)) / (PADDLE_H / 2)) * 5;
        }
        if (ball.x + BALL_R >= ai.x &&
            ball.y >= ai.y && ball.y <= ai.y + PADDLE_H && ball.vx > 0) {
            ball.vx *= -1.05;
            ball.vy = ((ball.y - (ai.y + PADDLE_H / 2)) / (PADDLE_H / 2)) * 5;
        }

        if (Math.abs(ball.vx) > 12) ball.vx = Math.sign(ball.vx) * 12;
        if (Math.abs(ball.vy) > 12) ball.vy = Math.sign(ball.vy) * 12;

        if (ball.x < 0) { ai.score++; ball = resetBall(); }
        if (ball.x > W) { player.score++; ball = resetBall(); }

        statusEl.textContent = `Você ${player.score} x ${ai.score} IA`;

        if (player.score >= WIN_SCORE) {
            statusEl.textContent = 'Você venceu!';
            running = false;
        }
        if (ai.score >= WIN_SCORE) {
            statusEl.textContent = 'A IA venceu!';
            running = false;
        }
    }

    function draw() {
        ctx.fillStyle = '#0a0a15';
        ctx.fillRect(0, 0, W, H);
        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#64b5f6';
        ctx.fillRect(player.x, player.y, PADDLE_W, PADDLE_H);
        ctx.fillStyle = '#ef5350';
        ctx.fillRect(ai.x, ai.y, PADDLE_W, PADDLE_H);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
        ctx.fill();
    }

    function gameLoop() {
        if (!running) return;
        update();
        draw();
        pongFrame = requestAnimationFrame(gameLoop);
    }

    canvas.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        const y = (e.clientY - rect.top) * (H / rect.height);
        player.y = Math.max(0, Math.min(H - PADDLE_H, y - PADDLE_H / 2));
    });

    canvas.addEventListener('touchmove', e => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const y = (touch.clientY - rect.top) * (H / rect.height);
        player.y = Math.max(0, Math.min(H - PADDLE_H, y - PADDLE_H / 2));
    }, { passive: false });

    resetBtn.addEventListener('click', startGame);

    startGame();
})();
