(() => {
    'use strict';

    // Mobile menu
    const btn = document.getElementById('mobile-menu-btn');
    const links = document.querySelector('.nav-links');
    if (btn && links) {
        btn.addEventListener('click', () => links.classList.toggle('open'));
        links.addEventListener('click', () => links.classList.remove('open'));
    }

    // Back to top
    const backBtn = document.getElementById('back-top');
    if (backBtn) {
        window.addEventListener('scroll', () => {
            backBtn.classList.toggle('show', window.scrollY > 400);
        });
        backBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Sound effects via Web Audio API
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    let audioCtx = null;

    function playTone(freq, duration, type = 'square', vol = 0.1) {
        try {
            if (!audioCtx) audioCtx = new AudioCtx();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            gain.gain.value = vol;
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + duration);
        } catch (_) { /* Audio not available */ }
    }

    // Attach sounds to game elements
    document.addEventListener('click', (e) => {
        // Board/cell hit sounds
        if (e.target.closest('.tt-cell')) playTone(440, 0.1, 'sine', 0.15);
        if (e.target.closest('.mem-card') && !e.target.closest('.matched')) playTone(660, 0.08, 'triangle', 0.1);
    });
})();
