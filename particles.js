(() => {
    'use strict';

    const canvas = document.getElementById('particles');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let W, H, particles = [];

    function resize() {
        const rect = canvas.parentElement.getBoundingClientRect();
        W = canvas.width = rect.width;
        H = canvas.height = rect.height;
    }

    class Particle {
        constructor() {
            this.reset();
        }
        reset() {
            this.x = Math.random() * W;
            this.y = Math.random() * H;
            this.r = Math.random() * 2 + 0.5;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;
            this.alpha = Math.random() * 0.5 + 0.1;
            this.color = Math.random() > 0.5 ? '0,212,255' : '233,69,96';
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset();
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${this.color},${this.alpha})`;
            ctx.fill();
        }
    }

    function init() {
        resize();
        const count = Math.min(80, Math.floor((W * H) / 12000));
        particles = Array.from({ length: count }, () => new Particle());
    }

    function drawLines() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 100) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(0,212,255,${0.06 * (1 - dist / 100)})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
    }

    function loop() {
        ctx.clearRect(0, 0, W, H);
        particles.forEach(p => { p.update(); p.draw(); });
        drawLines();
        frame = requestAnimationFrame(loop);
    }

    let frame = null;
    init();
    loop();

    window.addEventListener('resize', () => {
        if (frame) cancelAnimationFrame(frame);
        frame = null;
        init();
        loop();
    });
})();
