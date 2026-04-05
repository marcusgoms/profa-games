(() => {
    'use strict';

    const btn = document.getElementById('mobile-menu-btn');
    const links = document.querySelector('.nav-links');
    if (!btn || !links) return;

    btn.addEventListener('click', () => {
        links.classList.toggle('open');
    });

    links.addEventListener('click', () => {
        links.classList.remove('open');
    });
})();
