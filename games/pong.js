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
    let best = parseInt(localStorage.getItem('pf_pong') || '0', 10);

    let audioCtx = null;
    function tone(freq, dur, type = 'square', vol = 0.08) {
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
        statusEl.textContent = `Você 0 x 0 IA | Recorde: ${best}`;
        gameLoop();
    }

    function update() {
        ball.x += ball.vx;
        ball.y += ball.vy;

        if (ball.y - BALL_R <= 0) { ball.y = BALL_R; ball.vy *= -1; tone(400, 0.05, 'sine', 0.06); }
        if (ball.y + BALL_R >= H) { ball.y = H - BALL_R; ball.vy *= -1; tone(400, 0.05, 'sine', 0.06); }

        const aiCenter = ai.y + PADDLE_H / 2;
        if (aiCenter < ball.y - 10) ai.y += AI_SPEED;
        else if (aiCenter > ball.y + 10) ai.y -= AI_SPEED;
        ai.y = Math.max(0, Math.min(H - PADDLE_H, ai.y));

        if (ball.x - BALL_R <= player.x + PADDLE_W &&
            ball.y >= player.y && ball.y <= player.y + PADDLE_H && ball.vx < 0) {
            ball.vx *= -1.05; tone(350, 0.08, 'square', 0.05);
        }
        if (ball.x + BALL_R >= ai.x &&
            ball.y >= ai.y && ball.y <= ai.y + PADDLE_H && ball.vx > 0) {
            ball.vx *= -1.05; tone(350, 0.08, 'square', 0.05);
        }

        if (Math.abs(ball.vx) > 12) ball.vx = Math.sign(ball.vx) * 12;
        if (Math.abs(ball.vy) > 12) ball.vy = Math.sign(ball.vy) * 12;

        if (ball.x < 0) { ai.score++; ball = resetBall(); tone(200, 0.3, 'sawtooth', 0.1); }
        if (ball.x > W) { player.score++; ball = resetBall(); tone(600, 0.15, 'sine', 0.08); }

        statusEl.textContent = `Você ${player.score} x ${ai.score} IA | Recorde: ${best}`;

        if (player.score >= WIN_SCORE) {
            if (player.score > best) {
                best = player.score;
                localStorage.setItem('pf_pong', best);
            }
            const gamesPlayed = parseInt(localStorage.getItem('pf_games') || '0', 10) + 1;
            localStorage.setItem('pf_games', gamesPlayed);
            statusEl.textContent = `Você venceu! | Recorde: ${best}`;
            running = false;
            tone(800, 0.3, 'sine', 0.1);
        }
        if (ai.score >= WIN_SCORE) {
            const gamesPlayed = parseInt(localStorage.getItem('pf_games') || '0', 10) + 1;
            localStorage.setItem('pf_games', gamesPlayed);
            statusEl.textContent = `A IA venceu! | Recorde: ${best}`;
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
