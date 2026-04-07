    (async () => {
    'use strict';

    // ======================== CONFIG ========================
    const PLAYERS = [
        { name:'PROF',        tag:'ANON',  region:'BR1' },
        { name:'loadt',       tag:'9753',  region:'BR1' },
        { name:'Spring Boot', tag:'Getss', region:'BR1' },
        { name:'tume',        tag:'br1',   region:'BR1' },
        { name:'Bruvel',      tag:'BTC',   region:'BR1' },
        { name:'Matraca IV',  tag:'kash',  region:'BR1' },
        { name:'BOONSKT',     tag:'br1',   region:'BR1' },
        { name:'Nick',        tag:'LSD21', region:'BR1' },
        { name:'Malaric',     tag:'PR1',   region:'BR1', special:'noob' },
    ];
    const RIOT_KEY    = window.PROFA_CONFIG?.riotKey    || localStorage.getItem('lol_key')     || 'RGAPI-16e48557-eb13-41e8-9caa-6d30b83932bb';
    const ESPORTS_KEY = window.PROFA_CONFIG?.esportsKey || localStorage.getItem('esports_key') || '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z';
    const KEY_SAVED_AT = parseInt(localStorage.getItem('lol_key_ts') || '0');
    const KEY_TTL = 24 * 60 * 60 * 1000; // 24h
    const CBLOL_ID    = '98767991332355509';
    let DVER          = '14.24.1';

    // ======================== WEB WORKER ========================
    let statsWorker = null;
    const _workerCallbacks = {};
    try {
        statsWorker = new Worker('stats-worker.js');
        statsWorker.onmessage = function(e) {
            const { type, result } = e.data;
            if (_workerCallbacks[type]) {
                _workerCallbacks[type](result);
                delete _workerCallbacks[type];
            }
        };
        console.log('✓ Stats Worker iniciado');
    } catch(_) { console.warn('Web Worker não suportado — fallback para main thread'); }

    function workerRequest(type, data) {
        return new Promise(resolve => {
            if (!statsWorker) { resolve(null); return; }
            _workerCallbacks[type] = resolve;
            statsWorker.postMessage({ type, data });
            // Timeout fallback
            setTimeout(() => { if (_workerCallbacks[type]) { delete _workerCallbacks[type]; resolve(null); } }, 10000);
        });
    }

    // ======================== PWA INSTALL ========================
    let _deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        _deferredPrompt = e;
        // Show install prompt after 10s if not dismissed before
        if (!localStorage.getItem('pwa_dismissed')) {
            setTimeout(showPWAInstall, 10000);
        }
    });
    function showPWAInstall() {
        if (!_deferredPrompt || document.getElementById('pwa-install')) return;
        const el = document.createElement('div');
        el.id = 'pwa-install';
        el.className = 'pwa-install';
        el.innerHTML = `<span class="pwa-install-icon">📱</span>
            <div class="pwa-install-text">Instalar PROFA GAMES<small>Acesse direto da tela inicial</small></div>
            <button class="pwa-install-btn" onclick="installPWA()">Instalar</button>
            <button class="pwa-install-close" onclick="dismissPWA()">&times;</button>`;
        document.body.appendChild(el);
    }
    window.installPWA = function() {
        if (!_deferredPrompt) return;
        _deferredPrompt.prompt();
        _deferredPrompt.userChoice.then(r => {
            if (r.outcome === 'accepted') console.log('✓ PWA instalado');
            _deferredPrompt = null;
            const el = document.getElementById('pwa-install');
            if (el) el.remove();
        });
    };
    window.dismissPWA = function() {
        localStorage.setItem('pwa_dismissed', '1');
        const el = document.getElementById('pwa-install');
        if (el) el.remove();
    };

    // ======================== FIREBASE ========================
    let db = null;
    try {
        const fbCfg = window.PROFA_FIREBASE;
        if (fbCfg && fbCfg.apiKey && !fbCfg.apiKey.includes('placeholder')) {
            firebase.initializeApp(fbCfg);
            db = firebase.database();
            console.log('✓ Firebase conectado');
        } else {
            console.warn('Firebase não configurado — usando localStorage como fallback');
        }
    } catch(e) {
        console.warn('Firebase erro:', e.message, '— usando localStorage');
    }

    // ======================== AUTH / LOGIN (Firebase-synced) ========================
    const AUTH_KEY = 'profa_auth_user';
    const PINS_KEY = 'profa_pins';

    function getLoggedUser() {
        try { return JSON.parse(localStorage.getItem(AUTH_KEY)); } catch(_) { return null; }
    }
    function setLoggedUser(user) {
        if (user) {
            localStorage.setItem(AUTH_KEY, JSON.stringify(user));
            if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
        } else localStorage.removeItem(AUTH_KEY);
        updateNavUser();
        if (db) updatePresence(user);
    }

    function simpleHash(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) { h = ((h << 5) - h + str.charCodeAt(i)) | 0; }
        return String(h);
    }

    // PINs: Firebase first, localStorage fallback
    let _pinsCache = null;
    async function loadPinsFromFirebase() {
        if (!db) return;
        try {
            const snap = await db.ref('pins').once('value');
            const data = snap.val();
            if (data) {
                _pinsCache = data;
                localStorage.setItem(PINS_KEY, JSON.stringify(data));
            }
        } catch(_) {}
    }

    function getPins() {
        if (_pinsCache) return _pinsCache;
        try { return JSON.parse(localStorage.getItem(PINS_KEY)) || {}; } catch(_) { return {}; }
    }
    function setPin(playerIdx, pin) {
        const pins = getPins();
        pins[playerIdx] = simpleHash(pin);
        _pinsCache = pins;
        localStorage.setItem(PINS_KEY, JSON.stringify(pins));
        if (db) db.ref(`pins/${playerIdx}`).set(pins[playerIdx]).catch(() => {});
    }
    function checkPin(playerIdx, pin) {
        const pins = getPins();
        return pins[playerIdx] === simpleHash(pin);
    }
    function hasPin(playerIdx) {
        return !!getPins()[playerIdx];
    }

    function updateNavUser() {
        const el = $('nav-user');
        if (!el) return;
        const user = getLoggedUser();
        if (user) {
            el.innerHTML = `<div class="nav-user-info">
                <span class="nav-user-name">${PLAYERS[user.idx]?.name || 'User'}</span>
                <button class="nav-user-btn logout" onclick="doLogout()" title="Sair">Sair</button>
            </div>`;
        } else {
            el.innerHTML = `<button class="nav-user-btn login" onclick="showLoginModal()">Entrar</button>`;
        }
    }

    window.doLogout = function() {
        setLoggedUser(null);
    };

    window.showLoginModal = function() {
        // Remove existing modal
        const old = $('login-modal');
        if (old) old.remove();

        const modal = document.createElement('div');
        modal.id = 'login-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-box">
                <button class="modal-close" onclick="closeLoginModal()">&times;</button>
                <div class="modal-header">
                    <h2>Entrar no Squad</h2>
                    <p>Selecione seu jogador e digite seu PIN</p>
                </div>
                <div class="modal-body">
                    <div class="login-players" id="login-players">
                        ${PLAYERS.map((p,i) => `<button class="login-player-btn" data-idx="${i}" onclick="selectLoginPlayer(${i})">
                            <span class="login-player-name">${p.name}</span>
                            <span class="login-player-tag">#${p.tag}</span>
                        </button>`).join('')}
                    </div>
                    <div id="login-pin-section" style="display:none;">
                        <div class="login-selected" id="login-selected-name"></div>
                        <div id="login-pin-form">
                            <label id="login-pin-label">Digite seu PIN (4 d&iacute;gitos)</label>
                            <input type="password" id="login-pin" maxlength="4" pattern="[0-9]*" inputmode="numeric" placeholder="****" autocomplete="off">
                            <div id="login-error" class="login-error"></div>
                            <button class="login-submit" onclick="submitLogin()">Entrar</button>
                            <button class="login-back" onclick="backToPlayerSelect()">Voltar</button>
                        </div>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) closeLoginModal(); });
    };

    let selectedPlayerIdx = null;

    window.selectLoginPlayer = function(idx) {
        selectedPlayerIdx = idx;
        $('login-players').style.display = 'none';
        $('login-pin-section').style.display = 'block';
        $('login-selected-name').textContent = `${PLAYERS[idx].name} #${PLAYERS[idx].tag}`;
        $('login-error').textContent = '';
        const pinInput = $('login-pin');
        pinInput.value = '';
        if (!hasPin(idx)) {
            $('login-pin-label').textContent = 'Crie seu PIN (4 d\u00edgitos) — primeira vez';
        } else {
            $('login-pin-label').textContent = 'Digite seu PIN (4 d\u00edgitos)';
        }
        pinInput.onkeydown = e => { if (e.key === 'Enter') submitLogin(); };
        setTimeout(() => pinInput.focus(), 100);
    };

    window.backToPlayerSelect = function() {
        $('login-players').style.display = '';
        $('login-pin-section').style.display = 'none';
        selectedPlayerIdx = null;
    };

    window.submitLogin = function() {
        const pin = $('login-pin').value;
        if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
            $('login-error').textContent = 'PIN deve ter 4 d\u00edgitos num\u00e9ricos';
            return;
        }
        if (!hasPin(selectedPlayerIdx)) {
            // First time: create PIN
            setPin(selectedPlayerIdx, pin);
            setLoggedUser({ idx: selectedPlayerIdx, name: PLAYERS[selectedPlayerIdx].name });
            closeLoginModal();
            return;
        }
        if (checkPin(selectedPlayerIdx, pin)) {
            setLoggedUser({ idx: selectedPlayerIdx, name: PLAYERS[selectedPlayerIdx].name });
            closeLoginModal();
        } else {
            $('login-error').textContent = 'PIN incorreto!';
            $('login-pin').value = '';
        }
    };

    window.closeLoginModal = function() {
        const modal = $('login-modal');
        if (modal) modal.remove();
    };

    // ======================== PROFILE SETTINGS ========================
    window.switchProfTab = function(tab) {
        document.querySelectorAll('.prof-tab').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
        ['overview','champions','matches','config'].forEach(t => {
            const el = $('prof-tab-' + t);
            if (el) el.style.display = t === tab ? '' : 'none';
        });
    };

    window.pickIcon = function(idx, iconId) {
        setCustomIcon(idx, iconId);
        // Sync icon to Firebase
        if (db) db.ref(`userPrefs/${idx}/icon`).set(iconId).catch(() => {});
        // Update preview and main icon
        const preview = $('cfg-icon-preview');
        if (preview) preview.src = profImg(iconId);
        const main = $('prof-main-icon');
        if (main) main.src = profImg(iconId);
        document.querySelectorAll('.cfg-icon-opt').forEach(el => {
            el.classList.toggle('cfg-icon-sel', String(el.dataset.iid) === String(iconId));
        });
    };

    window.changePin = function(idx) {
        const msg = $('cfg-pin-msg');
        const oldP = $('cfg-old-pin')?.value || '';
        const newP = $('cfg-new-pin')?.value || '';
        const conf = $('cfg-confirm-pin')?.value || '';
        if (!msg) return;
        if (!/^\d{4}$/.test(oldP)) { msg.textContent = 'PIN atual deve ter 4 dígitos'; msg.className = 'cfg-msg cfg-msg-err'; return; }
        if (!checkPin(idx, oldP)) { msg.textContent = 'PIN atual incorreto!'; msg.className = 'cfg-msg cfg-msg-err'; return; }
        if (!/^\d{4}$/.test(newP)) { msg.textContent = 'Novo PIN deve ter 4 dígitos'; msg.className = 'cfg-msg cfg-msg-err'; return; }
        if (newP !== conf) { msg.textContent = 'PINs não conferem'; msg.className = 'cfg-msg cfg-msg-err'; return; }
        setPin(idx, newP);
        msg.textContent = 'PIN alterado com sucesso!';
        msg.className = 'cfg-msg cfg-msg-ok';
        $('cfg-old-pin').value = ''; $('cfg-new-pin').value = ''; $('cfg-confirm-pin').value = '';
    };

    // ======================== API KEY MODAL ========================
    window.showApiKeyModal = function() {
        const old = document.getElementById('apikey-modal');
        if (old) old.remove();
        const modal = document.createElement('div');
        modal.id = 'apikey-modal';
        modal.className = 'modal-overlay';
        const left = keyTimeLeft();
        const statusText = apiExpired ? '<span style="color:#ef5350;font-weight:700;">Expirada</span>'
            : left !== null ? `<span style="color:${left < 2*3600000 ? '#ffd740' : '#4caf50'};">${fmtKeyTime(left)}</span>`
            : '<span style="color:var(--dim);">Status desconhecido</span>';

        modal.innerHTML = `
            <div class="modal-box" style="max-width:500px;">
                <button class="modal-close" onclick="document.getElementById('apikey-modal').remove()">&times;</button>
                <div class="modal-header">
                    <h2>Riot API Key</h2>
                    <p>A chave expira a cada <b>24 horas</b>. Status atual: ${statusText}</p>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom:12px;">
                        <label style="font-size:.8em;color:var(--dim);font-weight:600;">Como obter a chave:</label>
                        <ol style="font-size:.75em;color:var(--dim);margin:6px 0 12px;padding-left:20px;line-height:1.7;">
                            <li>Acesse <a href="https://developer.riotgames.com/" target="_blank" style="color:var(--pri);">developer.riotgames.com</a></li>
                            <li>Faça login com sua conta Riot</li>
                            <li>Copie a <b>Development API Key</b> (regenere se expirada)</li>
                            <li>Cole abaixo e salve</li>
                        </ol>
                    </div>
                    <div style="margin-bottom:16px;">
                        <input id="apikey-riot" type="text" placeholder="RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value="${RIOT_KEY}" style="width:100%;padding:12px 14px;border-radius:8px;border:2px solid ${apiExpired?'#ef5350':'rgba(255,255,255,0.1)'};background:var(--surf);color:var(--txt);font-size:.85em;font-family:monospace;" spellcheck="false" autocomplete="off">
                        <p id="apikey-error" style="color:#ef5350;font-size:.75em;margin-top:6px;display:none;"></p>
                    </div>
                    <button id="apikey-save-btn" onclick="saveApiKey()" style="width:100%;padding:12px;border-radius:10px;border:none;background:linear-gradient(135deg,var(--pri),#0098b3);color:#fff;font-size:1em;font-weight:700;cursor:pointer;">Validar e Salvar</button>
                    <p style="font-size:.65em;color:var(--dim);margin-top:10px;text-align:center;">Mesmo com a chave expirada, dados em cache continuam sendo exibidos.</p>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
        // Auto-focus + select the input
        setTimeout(() => {
            const inp = document.getElementById('apikey-riot');
            if (inp) { inp.focus(); inp.select(); }
        }, 100);
        // Enter to save
        document.getElementById('apikey-riot')?.addEventListener('keydown', e => { if (e.key === 'Enter') saveApiKey(); });
    };

    window.saveApiKey = async function() {
        const key = document.getElementById('apikey-riot')?.value?.trim();
        const errEl = document.getElementById('apikey-error');
        const btn = document.getElementById('apikey-save-btn');
        if (!key) { if (errEl) { errEl.textContent = 'Cole a chave acima'; errEl.style.display = 'block'; } return; }
        if (!key.startsWith('RGAPI-')) { if (errEl) { errEl.textContent = 'A chave deve começar com RGAPI-'; errEl.style.display = 'block'; } return; }

        // Validate the key with a lightweight API call
        if (btn) { btn.textContent = 'Validando...'; btn.disabled = true; }
        try {
            const r = await fetch('https://br1.api.riotgames.com/lol/status/v4/platform-data', {
                headers: { 'X-Riot-Token': key }
            });
            if (r.status === 401 || r.status === 403) {
                if (errEl) { errEl.textContent = 'Chave inválida ou expirada. Gere uma nova em developer.riotgames.com'; errEl.style.display = 'block'; }
                if (btn) { btn.textContent = 'Validar e Salvar'; btn.disabled = false; }
                return;
            }
            if (!r.ok && r.status !== 429) {
                if (errEl) { errEl.textContent = `Erro ao validar (HTTP ${r.status}). Tente novamente.`; errEl.style.display = 'block'; }
                if (btn) { btn.textContent = 'Validar e Salvar'; btn.disabled = false; }
                return;
            }
        } catch(e) {
            // Network error — save anyway, user might be offline
        }

        localStorage.setItem('lol_key', key);
        localStorage.setItem('lol_key_ts', String(Date.now()));
        window.location.reload();
    };

    // ======================== UTILS ========================
    const $      = id => document.getElementById(id);
    const app    = $('appc');
    const plat   = r => ({BR1:'br1',NA1:'na1',EUW1:'euw1',EUN1:'eun1',KR:'kr',TR1:'tr1',LA1:'la1',LA2:'la2',OC1:'oc1'})[r]||'br1';
    const clust  = r => (['NA1','BR1','LA1','LA2','OC1'].includes(r))?'americas':(['EUW1','EUN1'].includes(r))?'europe':'asia';
    const fmtDur = s => s ? `${(s/60)|0}min` : '?';
    const fmtAgo = ts => { if(!ts) return ''; const d=(Date.now()-ts)/1000; return d<3600?`${(d/60)|0}min atrás`:d<86400?`${(d/3600)|0}h atrás`:`${(d/86400)|0}d atrás`; };
    const fmtGold= g => g>=1000?(g/1000).toFixed(1)+'K':String(g||0);
    const fmtTime= s => `${(s/60)|0}:${String((s%60)|0).padStart(2,'0')}`;
    const champImg= id => `https://ddragon.leagueoflegends.com/cdn/${DVER}/img/champion/${CMAP[id]||id||'Teemo'}.png`;
    const itemImg = id => id?`https://ddragon.leagueoflegends.com/cdn/${DVER}/img/item/${id}.png`:'';
    // Spell ID → name map (DDragon uses names not IDs)
    const SPELL_MAP = {1:'SummonerBoost',3:'SummonerExhaust',4:'SummonerFlash',6:'SummonerHaste',7:'SummonerHeal',11:'SummonerSmite',12:'SummonerTeleport',13:'SummonerMana',14:'SummonerDot',21:'SummonerBarrier',30:'SummonerPoroRecall',31:'SummonerPoroThrow',32:'SummonerSnowball',39:'SummonerSnowURFSnowball_Mark',54:'Summoner_UltBookPlaceholder',55:'Summoner_UltBookSmitePlaceholder',2201:'SummonerCherryHold',2202:'SummonerCherryFlash'};
    const spellImg= id => `https://ddragon.leagueoflegends.com/cdn/${DVER}/img/spell/${SPELL_MAP[id]||id||'SummonerFlash'}.png`;
    // Rune keystone map
    const KEYSTONE_MAP = {8005:'Press the Attack',8008:'Lethal Tempo',8021:'Fleet Footwork',8010:'Conqueror',8112:'Electrocute',8124:'Predator',8128:'Dark Harvest',9923:'Hail of Blades',8214:'Summon Aery',8229:'Arcane Comet',8230:'Phase Rush',8437:'Grasp',8439:'Aftershock',8465:'Guardian',8351:'Glacial Augment',8360:'Unsealed Spellbook',8369:'First Strike'};
    const RUNE_TREE_MAP = {8000:{name:'Precision',icon:'⚔️',color:'#c8aa6e'},8100:{name:'Domination',icon:'🔴',color:'#d44242'},8200:{name:'Sorcery',icon:'🔮',color:'#9b59b6'},8300:{name:'Inspiration',icon:'💡',color:'#49b4be'},8400:{name:'Resolve',icon:'🛡️',color:'#a1d811'}};
    const TIER_ORDER = ['IRON','BRONZE','SILVER','GOLD','PLATINUM','EMERALD','DIAMOND','MASTER','GRANDMASTER','CHALLENGER'];
    const TIER_ICONS = {IRON:'⬜',BRONZE:'🟫',SILVER:'⬜',GOLD:'🟡',PLATINUM:'🔵',EMERALD:'🟢',DIAMOND:'💎',MASTER:'🟣',GRANDMASTER:'🔴',CHALLENGER:'👑'};
    const profImg = id => `https://ddragon.leagueoflegends.com/cdn/${DVER}/img/profileicon/${id}.png`;
    function getCustomIcon(idx) { return localStorage.getItem('profa_custom_icon_'+idx); }
    function setCustomIcon(idx, iconId) { localStorage.setItem('profa_custom_icon_'+idx, iconId); }
    function playerIcon(idx, defaultIcon) { return getCustomIcon(idx) || defaultIcon || 5885; }
    const modeName= m => ({CLASSIC:"Summoner's Rift",ARAM:'ARAM',TUTORIAL:'Tutorial'})[m]||m||'Normal';
    const rankCls = t => t?`rank-${t.toLowerCase()}`:'';
    // Get best ranked entry: Solo Q first, Flex as fallback
    function getBestRanked(league) {
        const le = Array.isArray(league) ? league : [];
        return le.find(e => e.queueType === 'RANKED_SOLO_5x5') || le.find(e => e.queueType === 'RANKED_FLEX_SR') || null;
    }
    function isFlex(entry) { return entry?.queueType === 'RANKED_FLEX_SR'; }
    const drgEmoji= d => ({ocean:'🌊',infernal:'🔥',cloud:'💨',mountain:'⛰️',elder:'🐲',hextech:'⚡',chemtech:'☣️'})[d]||'🔥';
    const profFB  = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%2316213e%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2260%22 text-anchor=%22middle%22 fill=%22%238892b0%22 font-size=%2250%22>?</text></svg>`;
    const F       = `onerror="this.onerror=null;this.src='${profFB}'"`;

    let CMAP = {};

    // BigNumber string addition (event IDs exceed Number.MAX_SAFE_INTEGER)
    function bigAdd(numStr, n) {
        const s = String(numStr);
        const arr = s.split('').map(Number);
        let carry = n;
        for (let i = arr.length - 1; i >= 0 && carry > 0; i--) {
            const sum = arr[i] + carry;
            arr[i] = sum % 10;
            carry = (sum / 10) | 0;
        }
        return (carry > 0 ? String(carry) : '') + arr.join('');
    }

    // ======================== API ========================
    let apiExpired = false;

    function keyTimeLeft() {
        if (!KEY_SAVED_AT) return null;
        const left = KEY_TTL - (Date.now() - KEY_SAVED_AT);
        return left > 0 ? left : 0;
    }

    function fmtKeyTime(ms) {
        if (ms === null) return 'desconhecido';
        if (ms <= 0) return 'expirada';
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        return h > 0 ? `${h}h ${m}min restantes` : `${m}min restantes`;
    }

    function showApiBanner(msg) {
        let banner = document.getElementById('api-banner');
        const text = msg || 'API Key expirada — dados em cache sendo exibidos';
        if (banner) { banner.querySelector('.api-banner-text').textContent = text; return; }
        banner = document.createElement('div');
        banner.id = 'api-banner';
        banner.className = 'api-banner';
        banner.innerHTML = `<span class="api-banner-text">${text}</span><button onclick="showApiKeyModal()">Atualizar Chave</button>`;
        document.body.prepend(banner);
    }

    function hideApiBanner() {
        const b = document.getElementById('api-banner');
        if (b) b.remove();
    }

    // Show a small key status indicator in the nav
    function updateKeyStatus() {
        let el = document.getElementById('key-status');
        const left = keyTimeLeft();
        if (apiExpired || left === 0) {
            if (!el) {
                el = document.createElement('span');
                el.id = 'key-status';
                el.style.cssText = 'font-size:.65em;padding:2px 8px;border-radius:6px;cursor:pointer;margin-left:8px;white-space:nowrap;';
                document.querySelector('.nav-in')?.appendChild(el);
                el.onclick = () => showApiKeyModal();
            }
            el.style.background = '#ef5350';
            el.style.color = '#fff';
            el.textContent = 'Key expirada';
        } else if (left !== null && left < 2 * 3600000) {
            // Less than 2h left — warn
            if (!el) {
                el = document.createElement('span');
                el.id = 'key-status';
                el.style.cssText = 'font-size:.65em;padding:2px 8px;border-radius:6px;cursor:pointer;margin-left:8px;white-space:nowrap;';
                document.querySelector('.nav-in')?.appendChild(el);
                el.onclick = () => showApiKeyModal();
            }
            el.style.background = '#ffd740';
            el.style.color = '#000';
            el.textContent = fmtKeyTime(left);
        } else if (el) {
            el.remove();
        }
    }

    // Proactive key health check — lightweight call on load
    async function checkKeyHealth() {
        // If key timestamp says it's expired, don't even try
        const left = keyTimeLeft();
        if (left === 0 && KEY_SAVED_AT > 0) {
            apiExpired = true;
            showApiBanner('API Key expirada (24h) — usando dados em cache');
            updateKeyStatus();
            return;
        }
        try {
            const r = await fetch('https://br1.api.riotgames.com/lol/status/v4/platform-data', {
                headers: { 'X-Riot-Token': RIOT_KEY }
            });
            if (r.status === 401 || r.status === 403) {
                apiExpired = true;
                showApiBanner('API Key inválida ou expirada — usando dados em cache');
                updateKeyStatus();
            } else if (r.ok) {
                apiExpired = false;
                hideApiBanner();
                updateKeyStatus();
            }
        } catch(_) {
            // Network error — don't flag as expired
        }
    }

    // Simple fetch with retry on 429. Shows banner on auth errors.
    async function riot(url, retries=3) {
        const r = await fetch(url, { headers:{ 'X-Riot-Token': RIOT_KEY } });
        if (r.status === 429 && retries > 0) {
            const wait = Math.max((parseInt(r.headers.get('Retry-After') || '5') + 2) * 1000, 5000);
            await new Promise(res => setTimeout(res, wait));
            return riot(url, retries - 1);
        }
        if (r.status === 401 || r.status === 403) {
            apiExpired = true;
            showApiBanner();
            updateKeyStatus();
        }
        if (!r.ok) throw new Error(`Riot ${r.status}`);
        return r.json();
    }
    async function rots(u, fb=null) { try { return await riot(u); } catch(_) { return fb; } }

    async function esp(url) {
        const full = url.startsWith('http') ? url : `https://esports-api.lolesports.com/persisted/gw${url}`;
        const r = await fetch(full, { headers:{ 'x-api-key': ESPORTS_KEY } });
        if (!r.ok) throw new Error(`Esports ${r.status}`);
        return r.json();
    }
    async function esps(u, fb=null) { try { return await esp(u); } catch(_) { return fb; } }

    async function live(u, params) {
        const full = u.startsWith('http') ? u : `https://feed.lolesports.com/livestats/v1${u}`;
        const q = params ? '?'+new URLSearchParams(params) : '';
        const r = await fetch(full+q, { headers:{ 'x-api-key': ESPORTS_KEY } });
        if (!r.ok) return null;
        return r.json();
    }

    function isoRound10() {
        const d = new Date(); d.setMilliseconds(0);
        if (d.getSeconds()%10!==0) d.setSeconds(d.getSeconds()-(d.getSeconds()%10));
        d.setSeconds(d.getSeconds()-60);
        return d.toISOString();
    }

    // ======================== DATA LAYER (Firebase global + localStorage fallback) ========================
    // All player data is stored in Firebase so everyone shares the same cache.
    // Flow: Firebase → memory cache → localStorage (fallback if Firebase unavailable)
    // Only new matches are fetched from Riot API — existing ones are reused from Firebase.
    const cache = {};
    const CACHE_TTL = 5 * 60 * 1000; // 5 min — data fresher than this skips API entirely
    const MAX_MATCHES = 200; // Store up to 200 matches per player
    const FETCH_PAGE_SIZE = 100; // Riot API max per request

    function lsGet(key) { try { const d=JSON.parse(localStorage.getItem(key)); return d||null; } catch(_) { return null; } }
    function lsSet(key, data) { try { localStorage.setItem(key, JSON.stringify({...data, _ts:Date.now()})); } catch(_) {} }
    function isStale(d) { return !d?._ts || Date.now()-d._ts >= CACHE_TTL; }

    // Firebase player data helpers
    // Firebase drops empty arrays/null values, so we normalize on read
    function normPlayerData(d) {
        if (!d) return null;
        if (!d.account) return null;
        d.league = Array.isArray(d.league) ? d.league : [];
        d.mastery = Array.isArray(d.mastery) ? d.mastery : [];
        d.matches = Array.isArray(d.matches) ? d.matches : [];
        d.summoner = d.summoner || {};
        return d;
    }

    // ======================== THE OFFICE STYLE COMMENTARY ========================
    function generateOfficeComment(playerName, matches, account, league) {
        if (!matches || matches.length < 3) return null;
        const puuid = account?.puuid;
        if (!puuid) return null;

        // Analyze last 10 matches
        const recent = [...matches].sort((a,b) => (b.info?.gameCreation||0)-(a.info?.gameCreation||0)).slice(0, 10);
        let kills=0, deaths=0, assists=0, cs=0, vis=0, dmg=0, gold=0, wins=0, pentas=0, games=0;
        let maxDeaths=0, maxKills=0, zeroDeathGames=0, firstBloods=0;
        const champCount = {};
        for (const m of recent) {
            const p = m.info?.participants?.find(x => x.puuid === puuid);
            if (!p) continue;
            games++;
            kills += p.kills||0; deaths += p.deaths||0; assists += p.assists||0;
            cs += (p.totalMinionsKilled||0)+(p.neutralMinionsKilled||0);
            vis += p.visionScore||0; dmg += p.totalDamageDealtToChampions||0;
            gold += p.goldEarned||0;
            if (p.win) wins++;
            pentas += p.pentaKills||0;
            if ((p.deaths||0) > maxDeaths) maxDeaths = p.deaths||0;
            if ((p.kills||0) > maxKills) maxKills = p.kills||0;
            if ((p.deaths||0) === 0) zeroDeathGames++;
            if (p.firstBloodKill) firstBloods++;
            const cname = CMAP[p.championId] || 'Desconhecido';
            champCount[cname] = (champCount[cname]||0) + 1;
        }
        if (games < 3) return null;

        const avgK = kills/games, avgD = deaths/games, avgA = assists/games;
        const avgCS = cs/games, avgVis = vis/games, avgDmg = dmg/games;
        const kda = (kills+assists)/Math.max(deaths,1);
        const wr = (wins/games)*100;
        const topChamp = Object.entries(champCount).sort((a,b)=>b[1]-a[1])[0]?.[0] || '?';
        const topCount = Object.entries(champCount).sort((a,b)=>b[1]-a[1])[0]?.[1] || 0;
        const uniqueChamps = Object.keys(champCount).length;

        // Best rank (Solo Q or Flex fallback)
        const solo = getBestRanked(league);
        const tier = solo?.tier || '';

        // Build pool of applicable LoL-themed comments
        const pool = [];
        const n = playerName;

        // KDA-based
        if (kda >= 5) {
            pool.push({ icon:'⚔️', txt:`${n} com KDA de ${kda.toFixed(1)}. Isso é nível Faker em dia de final. O Rift inteiro treme quando esse jogador entra na partida.` });
            pool.push({ icon:'🔥', txt:`KDA de ${kda.toFixed(1)}. ${n} tá jogando como se tivesse 3 itens a mais que todo mundo. Os inimigos devem achar que é smurf.` });
        } else if (kda >= 3) {
            pool.push({ icon:'🎯', txt:`${n} com KDA de ${kda.toFixed(1)}. Sólido como torre tier 2 — não é o highlight do jogo, mas tá sempre de pé quando importa.` });
            pool.push({ icon:'⚔️', txt:`KDA de ${kda.toFixed(1)} coloca ${n} no patamar de "jogador que o jungler não precisa gankar". Auto-suficiente no Rift.` });
        } else if (kda < 1.5) {
            pool.push({ icon:'💀', txt:`KDA de ${kda.toFixed(1)}. ${n} tá dando mais gold pro inimigo que o Baron Nashor. Pelo menos o Baron luta de volta.` });
            pool.push({ icon:'🪦', txt:`${n} com KDA de ${kda.toFixed(1)}. Até o Karthus passivo causa mais impacto. E ele tá literalmente morto.` });
            pool.push({ icon:'😭', txt:`KDA de ${kda.toFixed(1)}. Os minions do ${n} têm mais KDA que ele. E eles nem aparecem no scoreboard.` });
        }

        // Death-based
        if (avgD >= 8) {
            pool.push({ icon:'💀', txt:`${n} morre ${avgD.toFixed(1)} vezes por jogo. A fonte cinza já mandou mensagem pedindo pra dar uma pausa. Cansou de ver essa cara.` });
            pool.push({ icon:'🪦', txt:`${avgD.toFixed(0)} mortes por partida. ${n} não tá jogando LoL, tá jogando simulador de tela cinza. E tá no master desse jogo.` });
            pool.push({ icon:'👻', txt:`${n} com ${avgD.toFixed(1)} mortes/jogo. A essa altura o respawn timer dele é praticamente o cooldown de uma ultimate.` });
        } else if (avgD >= 6) {
            pool.push({ icon:'💀', txt:`${n} com ${avgD.toFixed(1)} mortes/jogo. Não é inter, é "agressividade calculada". O cálculo só tá sempre errado.` });
        } else if (avgD <= 2 && zeroDeathGames >= 2) {
            pool.push({ icon:'🛡️', txt:`${n} tem ${zeroDeathGames} partidas com ZERO mortes. Esse jogador é feito de Zhonya — simplesmente não morre.` });
        }

        // Kills-based
        if (avgK >= 10) {
            pool.push({ icon:'🔥', txt:`${n} abate ${avgK.toFixed(1)} inimigos por jogo. Isso não é carry, é massacre. O time inimigo vê ${n} e já pensa em /ff.` });
            pool.push({ icon:'⚔️', txt:`${avgK.toFixed(1)} kills por partida. ${n} é o tipo de jogador que faz o ADC inimigo trocar de lane. E depois trocar de jogo.` });
        } else if (avgK <= 2) {
            pool.push({ icon:'😴', txt:`${n} com ${avgK.toFixed(1)} kills por jogo. Tá jogando LoL ou assistindo? Porque o dano é de espectador.` });
            pool.push({ icon:'🌿', txt:`${avgK.toFixed(1)} kills por partida. ${n} joga como se tivesse feito um pacto de não-agressão com o time inimigo. E tá cumprindo.` });
        }

        // Win rate
        if (wr >= 70) {
            pool.push({ icon:'👑', txt:`${wr.toFixed(0)}% de winrate. ${n} nasceu pra escalar elo. Esse é o tipo de jogador que carrega até no ARAM.` });
            pool.push({ icon:'🏆', txt:`${wr.toFixed(0)}% de WR. ${n} tá tão acima que até o matchmaking tá confuso tentando equilibrar as partidas.` });
        } else if (wr <= 30) {
            pool.push({ icon:'📉', txt:`${n} com ${wr.toFixed(0)}% de winrate. A fila de derrotas tá tão longa que dá pra usar de lane. Do nexus até o nexus inimigo.` });
            pool.push({ icon:'😭', txt:`${wr.toFixed(0)}% de WR. ${n} perde mais que minion no early game. E o minion pelo menos tenta.` });
            pool.push({ icon:'🪦', txt:`${wr.toFixed(0)}% de winrate. O botão de /ff já vem pré-selecionado quando ${n} entra na partida.` });
        } else if (wr >= 50 && wr < 55) {
            pool.push({ icon:'⚖️', txt:`${n} com ${wr.toFixed(0)}% de WR. Perfeitamente equilibrado, como toda coisa deveria ser. Thanos jogaria ranked assim.` });
        }

        // Vision
        if (avgVis <= 5) {
            pool.push({ icon:'🔦', txt:`${n} com score de visão ${avgVis.toFixed(0)}. O mapa tá mais escuro que a Sombra das Ilhas. Compra uma ward, pelo amor do Rift.` });
            pool.push({ icon:'👁️', txt:`Visão de ${n}: ${avgVis.toFixed(0)}. Nocturne ia ficar com inveja desse blackout. O fog of war é o melhor amigo de ${n}. Ou pior inimigo.` });
        } else if (avgVis >= 30) {
            pool.push({ icon:'👁️', txt:`Score de visão: ${avgVis.toFixed(0)}. ${n} warda mais que o mapa inteiro consegue mostrar. Se visão ganhasse jogo, esse era Challenger.` });
        }

        // CS
        if (avgCS <= 80) {
            pool.push({ icon:'🌾', txt:`${n} com ${avgCS.toFixed(0)} CS/jogo. Até o Bard ADC farma mais que isso. Os minions passam e ${n} só olha.` });
            pool.push({ icon:'💰', txt:`${avgCS.toFixed(0)} CS de média. ${n} tá mais pobre que support sem item de suporte. O ouro não vem sozinho, amigo.` });
        } else if (avgCS >= 200) {
            pool.push({ icon:'💰', txt:`${avgCS.toFixed(0)} CS por jogo. ${n} farma como se cada minion devesse dinheiro pra ele. Nasus ficaria orgulhoso dessa dedicação.` });
        }

        // Champion pool
        if (topCount >= 6 && games >= 8) {
            pool.push({ icon:'🎭', txt:`${n} jogou ${topChamp} em ${topCount} de ${games} partidas. Isso não é main, é relacionamento sério. Já podem casar no Rift.` });
            pool.push({ icon:'💍', txt:`${topCount} jogos de ${topChamp}. ${n} tem um one-trick tão forte que o campeão já devia pedir ordem de restrição. Ou um anel.` });
        } else if (uniqueChamps >= 8) {
            pool.push({ icon:'🎭', txt:`${n} rodou ${uniqueChamps} campeões diferentes. Champion pool mais largo que o rio do Rift. Respeito pela versatilidade. Ou indecisão.` });
        }

        // Pentas
        if (pentas > 0) {
            pool.push({ icon:'🏆', txt:`PENTAKILL! ${n} eliminou o time inteiro sozinho. Darius ia aplaudir de pé. Esse é o tipo de jogada que vira highlight pra sempre.` });
            pool.push({ icon:'💥', txt:`Pentakill confirmado. ${n} passou por cima de 5 jogadores como se fosse um Sion ultando. Lendário. Literalmente.` });
        }

        // Max deaths in a single game
        if (maxDeaths >= 12) {
            pool.push({ icon:'💀', txt:`${maxDeaths} mortes num jogo. ${n} alimentou tanto que o time inimigo podia ir full tank e ainda oneshot. Buffet completo no Rift.` });
            pool.push({ icon:'🪦', txt:`Recorde de ${maxDeaths} mortes. ${n} morreu mais vezes que um minion wave inteira. E o minion pelo menos tankou uma torre.` });
        }

        // First bloods
        if (firstBloods >= 3) {
            pool.push({ icon:'🗡️', txt:`${n} pegou first blood em ${firstBloods} de ${games} jogos. Taxa de ${((firstBloods/games)*100).toFixed(0)}%. Esse jogador entra na lane já com instinto assassino. Zed aprovaria.` });
        }

        // Damage
        if (avgDmg >= 25000) {
            pool.push({ icon:'💥', txt:`${(avgDmg/1000).toFixed(0)}K de dano por jogo. ${n} causa mais estrago que um Baron Nashor em teamfight. O time inimigo sente de longe.` });
        } else if (avgDmg <= 8000) {
            pool.push({ icon:'🌿', txt:`${(avgDmg/1000).toFixed(0)}K de dano médio. ${n} causa menos dano que uma ward expirada. E a ward nem ataca.` });
            pool.push({ icon:'😴', txt:`O dano de ${n} é ${(avgDmg/1000).toFixed(0)}K. Soraka com Warmog faz mais dano. E ela é healer.` });
        }

        // Rank
        if (tier === 'IRON') {
            pool.push({ icon:'⛏️', txt:`${n} tá no Iron. O elo mais profundo do Rift. Daqui só sobe... teoricamente. Na prática, o Iron é a casa de ${n}.` });
            pool.push({ icon:'🪨', txt:`Rank: Iron. ${n} tá no subsolo do ranked. Mas ó, todo Challenger já foi Iron um dia. Talvez. Provavelmente não.` });
        } else if (tier === 'CHALLENGER') {
            pool.push({ icon:'👑', txt:`${n} atingiu Challenger. Tá no topo do servidor junto com os pros. Esse é o tipo de jogador que faz stream e a galera assiste de verdade.` });
        } else if (tier === 'BRONZE') {
            pool.push({ icon:'🥉', txt:`${n} tá no Bronze. O elo onde todo mundo sabe jogar — segundo eles mesmos. Na prática, é fiesta 24/7 e ${n} é VIP.` });
        }

        // Generic fallbacks
        pool.push({ icon:'🎮', txt:`${n} tá grindando no Rift como se o LP pagasse conta. Não paga, mas a dedicação é real.` });
        pool.push({ icon:'⚔️', txt:`${n} segue firme no Summoner's Rift. Ganhando ou perdendo, o importante é que tá na fila. De novo. Sempre de novo.` });
        pool.push({ icon:'🏟️', txt:`As partidas de ${n} são como solo queue: imprevisíveis, emocionantes, e alguém sempre sai reclamando no chat.` });
        pool.push({ icon:'🗺️', txt:`${n} no Rift é como Teemo no mato — você nunca sabe o que esperar. Pode ser uma jogada genial ou um int épico.` });
        pool.push({ icon:'🎯', txt:`Se o Rift fosse um anime, ${n} seria aquele personagem que aparece todo episódio mas ninguém sabe se é protagonista ou figurante.` });

        // Pick 1 random based on a daily seed (changes once per day per player)
        const daySeed = Math.floor(Date.now() / 86400000) + (playerName.charCodeAt(0)||0);
        const chosen = pool[daySeed % pool.length];
        return chosen;
    }

    // Compress match data — keep only fields we actually use (saves ~90% Firebase space)
    function compressMatch(m, puuid) {
        if (!m?.info || !m?.metadata) return null;
        const me = m.info.participants?.find(p => p.puuid === puuid);
        // Keep all participants but only essential fields
        const participants = (m.info.participants || []).map(p => ({
            puuid: p.puuid, championId: p.championId, teamId: p.teamId,
            kills: p.kills, deaths: p.deaths, assists: p.assists, win: p.win,
            totalMinionsKilled: p.totalMinionsKilled, neutralMinionsKilled: p.neutralMinionsKilled,
            totalDamageDealtToChampions: p.totalDamageDealtToChampions,
            visionScore: p.visionScore, goldEarned: p.goldEarned,
            pentaKills: p.pentaKills, quadraKills: p.quadraKills, tripleKills: p.tripleKills,
            doubleKills: p.doubleKills, firstBloodKill: p.firstBloodKill || false,
            turretKills: p.turretKills, dragonKills: p.dragonKills, baronKills: p.baronKills,
        }));
        return {
            metadata: { matchId: m.metadata.matchId, participants: m.metadata.participants },
            info: {
                gameCreation: m.info.gameCreation, gameDuration: m.info.gameDuration,
                gameMode: m.info.gameMode, queueId: m.info.queueId,
                teams: (m.info.teams || []).map(t => ({ teamId: t.teamId, win: t.win })),
                participants,
            }
        };
    }

    // Fetch ALL match IDs with pagination (Riot API returns max 100 per request)
    async function fetchAllMatchIds(cl, puuid) {
        const allIds = [];
        for (let start = 0; start < MAX_MATCHES; start += FETCH_PAGE_SIZE) {
            const count = Math.min(FETCH_PAGE_SIZE, MAX_MATCHES - start);
            const ids = await rots(`https://${cl}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=${start}&count=${count}`, []);
            if (!ids || ids.length === 0) break;
            allIds.push(...ids);
            if (ids.length < count) break; // No more pages
            if (start + FETCH_PAGE_SIZE < MAX_MATCHES) {
                await new Promise(r => setTimeout(r, 1200));
            }
        }
        return allIds;
    }

    async function fbGetPlayer(i) {
        if (!db) return null;
        try {
            const snap = await db.ref(`players/${i}`).once('value');
            return normPlayerData(snap.val());
        } catch(_) { return null; }
    }

    async function fbSavePlayer(i, data) {
        if (!db) return;
        // Strip internal fields before saving to Firebase
        const toSave = { ...data };
        delete toSave._ts;
        delete toSave._full;
        delete toSave._matchIds;
        // Compress matches before saving (only keep essential fields)
        if (toSave.matches?.length) {
            const puuid = toSave.account?.puuid;
            toSave.matches = toSave.matches.map(m => {
                // Already compressed? Check if it has minimal fields
                if (m.info?.participants?.[0] && !m.info.participants[0].summonerName) return m;
                return compressMatch(m, puuid) || m;
            }).filter(Boolean);
        }
        // Merge with existing Firebase data — NEVER lose old matches
        try {
            const existing = await fbGetPlayer(i);
            if (existing?.matches?.length) {
                const existingIds = new Set(toSave.matches.map(m => m.metadata?.matchId).filter(Boolean));
                const oldMatches = existing.matches.filter(m => m.metadata?.matchId && !existingIds.has(m.metadata.matchId));
                toSave.matches = [...toSave.matches, ...oldMatches]
                    .sort((a, b) => (b.info?.gameCreation||0) - (a.info?.gameCreation||0));
            }
        } catch(_) {}
        toSave._updatedAt = Date.now();
        toSave._matchCount = toSave.matches?.length || 0;
        db.ref(`players/${i}`).set(toSave).catch(e => console.warn('Firebase save error:', e.message));
    }

    // Track background loading/refresh promises so we don't duplicate work
    const bgLoading = {};
    const bgRefresh = {};

    // Fetch core player data from Riot API (account, summoner, league, match IDs + 1 recent match)
    async function fetchPlayerFast(i) {
        const p = PLAYERS[i], cl = clust(p.region), pl = plat(p.region);
        const account = await riot(`https://${cl}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(p.name)}/${encodeURIComponent(p.tag)}`);
        const [summoner, league, matchIds] = await Promise.all([
            riot(`https://${pl}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${account.puuid}`),
            rots(`https://${pl}.api.riotgames.com/lol/league/v4/entries/by-puuid/${account.puuid}`, []),
            fetchAllMatchIds(cl, account.puuid),
        ]);
        const ids = matchIds || [];
        let recentMatch = null;
        if (ids.length) {
            const raw = await rots(`https://${cl}.api.riotgames.com/lol/match/v5/matches/${ids[0]}`, null);
            recentMatch = raw ? compressMatch(raw, account.puuid) : null;
        }
        return { account, summoner, league: league||[], mastery:[], matches: recentMatch?[recentMatch]:[], _matchIds: ids };
    }

    // FAST: returns cached data instantly (Firebase → localStorage), refreshes in background if stale.
    async function loadPlayerFast(i) {
        // Fresh memory cache — return immediately
        if (cache[i] && !isStale(cache[i])) return cache[i];

        // Try Firebase first (global cache shared by all users)
        const fbData = await fbGetPlayer(i);
        if (fbData) {
            fbData._ts = fbData._updatedAt || Date.now();
            cache[i] = fbData;
            lsSet(`profa_player_${i}`, fbData);
            // If stale, refresh in background
            if (isStale(fbData)) refreshPlayer(i);
            return cache[i];
        }

        // Fallback to localStorage
        const stored = normPlayerData(lsGet(`profa_player_${i}`));
        if (stored) {
            cache[i] = stored;
            if (isStale(stored)) refreshPlayer(i);
            return cache[i];
        }

        // Nothing cached anywhere — must fetch from API (queued to avoid rate limit)
        // Entire fetch runs inside the queue so nothing overlaps
        const work = _refreshQueue.then(async () => {
            await new Promise(r => setTimeout(r, 3000));
            const data = await fetchPlayerFast(i);
            data._ts = Date.now();
            cache[i] = data;
            lsSet(`profa_player_${i}`, data);
            fbSavePlayer(i, data);
        });
        _refreshQueue = work.catch(() => {});
        await work;
        return cache[i];
    }

    // Background refresh: fetches fresh data, merges with existing matches, saves to Firebase
    // All API work is serialized through _refreshQueue to avoid rate limit
    let _refreshQueue = Promise.resolve();
    function refreshPlayer(i) {
        if (bgRefresh[i]) return bgRefresh[i];
        // Chain entire work (delay + fetch) sequentially — queue holds until done
        const work = _refreshQueue.then(async () => {
            await new Promise(r => setTimeout(r, 3000));
            try {
                const fresh = await fetchPlayerFast(i);
                const prev = cache[i];
                fresh._ts = Date.now();
                if (prev?.matches?.length) {
                    const existingIds = new Set(prev.matches.map(m => m.metadata?.matchId).filter(Boolean));
                    const brandNew = fresh.matches.filter(m => !existingIds.has(m.metadata?.matchId));
                    fresh.matches = [...brandNew, ...prev.matches]
                        .sort((a, b) => (b.info?.gameCreation||0) - (a.info?.gameCreation||0));
                    if (prev.mastery?.length) fresh.mastery = prev.mastery;
                    fresh._full = prev._full || false;
                }
                if (prev) detectRankChanges(i, prev, fresh);
                cache[i] = fresh;
                lsSet(`profa_player_${i}`, fresh);
                fbSavePlayer(i, fresh);
                if (typeof onPlayerRefreshed === 'function') onPlayerRefreshed(i, fresh);
            } catch(_) {}
            delete bgRefresh[i];
        });
        // Queue must wait for this work to finish before starting next
        _refreshQueue = work.catch(() => {});
        bgRefresh[i] = work;
        return bgRefresh[i];
    }

    // BACKGROUND: loads ALL available matches + mastery. Only fetches matches not already in cache.
    // All API calls go through _refreshQueue to avoid rate limit collisions.
    function loadPlayerBackground(i) {
        if (bgLoading[i]) return bgLoading[i];
        if (cache[i]?._full && !isStale(cache[i])) return Promise.resolve(cache[i]);

        bgLoading[i] = (async () => {
            const base = cache[i] || await loadPlayerFast(i);
            if (base._full && !isStale(base)) return base;

            const p = PLAYERS[i], cl = clust(p.region), pl = plat(p.region);
            const puuid = base.account.puuid;
            const ids = base._matchIds || [];

            // Queue mastery fetch through the global queue
            const masteryWork = _refreshQueue.then(async () => {
                await new Promise(r => setTimeout(r, 1000));
                return rots(`https://${pl}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=5`, []);
            });
            _refreshQueue = masteryWork.catch(() => []);
            const mastery = await masteryWork.catch(() => []);

            // Only fetch matches we don't already have
            const alreadyLoaded = new Set(base.matches.map(m => m.metadata?.matchId).filter(Boolean));
            const toLoad = ids.filter(mid => !alreadyLoaded.has(mid));
            const newMatches = [];
            console.log(`[${p.name}] Buscando ${toLoad.length} partidas novas de ${ids.length} total...`);
            // Fetch in batches of 5, each batch queued through the global queue
            for (let b = 0; b < toLoad.length; b += 5) {
                const batch = toLoad.slice(b, b+5);
                const batchWork = _refreshQueue.then(async () => {
                    await new Promise(r => setTimeout(r, 1500));
                    await Promise.all(batch.map(mid =>
                        riot(`https://${cl}.api.riotgames.com/lol/match/v5/matches/${mid}`)
                            .then(d => { const c = compressMatch(d, puuid); if (c) newMatches.push(c); })
                            .catch(() => {})
                    ));
                });
                _refreshQueue = batchWork.catch(() => {});
                await batchWork.catch(() => {});
            }

            const allMatches = [...base.matches, ...newMatches]
                .filter((m, idx2, arr) => arr.findIndex(x => x.metadata?.matchId === m.metadata?.matchId) === idx2)
                .sort((a2, b2) => (b2.info?.gameCreation||0) - (a2.info?.gameCreation||0));

            console.log(`[${p.name}] Total: ${allMatches.length} partidas salvas`);
            cache[i] = { ...base, mastery: mastery||[], matches: allMatches, _full: true, _ts: Date.now() };
            lsSet(`profa_player_${i}`, cache[i]);
            fbSavePlayer(i, cache[i]);
            delete bgLoading[i];
            return cache[i];
        })();
        return bgLoading[i];
    }

    // FULL: returns complete data — waits for background if needed, or starts it
    async function loadPlayer(i) {
        if (cache[i]?._full && !isStale(cache[i])) return cache[i];
        // Try Firebase/localStorage for full cached data
        if (!cache[i]) {
            const fbData = await fbGetPlayer(i);
            if (fbData) { fbData._ts = fbData._updatedAt || Date.now(); cache[i] = fbData; lsSet(`profa_player_${i}`, fbData); }
        }
        if (!cache[i]) {
            const c = normPlayerData(lsGet(`profa_player_${i}`));
            if (c) cache[i] = c;
        }
        if (cache[i]?._full) {
            if (isStale(cache[i])) { refreshPlayer(i); loadPlayerBackground(i); }
            return cache[i];
        }
        return loadPlayerBackground(i);
    }

    // ======================== ROUTER ========================
    let liveTimer = null;
    let liveDetailTimer = null;
    function clearLive() {
        if (liveTimer)       { clearInterval(liveTimer);       liveTimer       = null; }
        if (liveDetailTimer) { clearInterval(liveDetailTimer); liveDetailTimer = null; }
        stopChat();
    }

    function nav(hash) {
        const h = hash.replace(/^#/, '');
        document.querySelectorAll('.nl a').forEach(a => a.classList.remove('on'));
        const ln = document.querySelector(`.nl a[data-p="${pn(h)}"]`);
        if (ln) ln.classList.add('on');
        // Page transition
        app.classList.remove('page-enter'); void app.offsetWidth; app.classList.add('page-enter');
        if (!h || h === 'team')               { clearLive(); renderTeam(); }
        else if (h.startsWith('live'))        { clearLive(); renderLivePage(h); }
        else if (h.startsWith('profile/'))    renderProfile(parseInt(h.split('/')[1]));
        else if (h.startsWith('compare'))     { clearLive(); renderCompare(h); }
        else if (h === 'cblol')               { clearLive(); renderCBLOL('upcoming'); }
        else if (h === 'dashboard')           { clearLive(); renderDashboard(); }
        else if (h === 'arena')               { clearLive(); renderArenaRPG(); }
        else if (h === 'chat')                { clearLive(); clearChatBadge(); renderChat(); }
        else if (h === 'teambuilder')         { clearLive(); renderTeamBuilder(); }
        else                                  { clearLive(); renderTeam(); }
    }
    function pn(h) {
        if (!h || h === 'team' || h.startsWith('profile/') || h.startsWith('compare')) return 'team';
        if (h === 'arena') return 'arena';
        if (h === 'chat') return 'chat';
        if (h === 'cblol') return 'cblol';
        if (h.startsWith('live')) return 'live';
        if (h === 'dashboard') return 'dashboard';
        if (h === 'teambuilder') return 'dashboard';
        return 'team';
    }

    window.addEventListener('hashchange', () => nav(location.hash));
    document.addEventListener('click', e => {
        const a = e.target.closest('a[href^="#"]');
        if (a) { e.preventDefault(); location.hash = a.getAttribute('href').slice(1); }
    });
    $('mmb').addEventListener('click', () => $('nav').classList.toggle('open'));
    $('nav').addEventListener('click', () => $('nav').classList.remove('open'));

    // ======================== 3D EFFECTS ========================
    // 3D Tilt on squad cards
    function init3DTilt() {
        document.querySelectorAll('.pc').forEach(card => {
            if (card._tilt3d) return;
            card._tilt3d = true;
            card.addEventListener('mousemove', e => {
                const r = card.getBoundingClientRect();
                const x = (e.clientX - r.left) / r.width - 0.5;
                const y = (e.clientY - r.top) / r.height - 0.5;
                card.style.transform = `perspective(600px) rotateY(${x*12}deg) rotateX(${-y*12}deg) scale(1.02)`;
                card.style.boxShadow = `${-x*20}px ${y*20}px 40px rgba(0,212,255,0.12)`;
                // Glare
                const glare = card.querySelector('.card-glare');
                if (glare) { glare.style.opacity = '1'; glare.style.background = `radial-gradient(circle at ${(x+0.5)*100}% ${(y+0.5)*100}%, rgba(255,255,255,0.12), transparent 60%)`; }
            });
            card.addEventListener('mouseleave', () => {
                card.style.transform = ''; card.style.boxShadow = '';
                const glare = card.querySelector('.card-glare');
                if (glare) glare.style.opacity = '0';
            });
            // Add glare overlay
            if (!card.querySelector('.card-glare')) {
                const g = document.createElement('div');
                g.className = 'card-glare';
                card.appendChild(g);
            }
        });
    }

    // Particle canvas background
    function initParticles(container) {
        if (!container || container.querySelector('.particle-canvas')) return;
        const canvas = document.createElement('canvas');
        canvas.className = 'particle-canvas';
        container.style.position = 'relative';
        container.insertBefore(canvas, container.firstChild);
        const ctx = canvas.getContext('2d');
        let w, h, particles = [], animId;

        function resize() {
            w = canvas.width = container.offsetWidth;
            h = canvas.height = container.offsetHeight;
        }
        resize();

        const count = Math.min(50, Math.floor(w * h / 8000));
        for (let i = 0; i < count; i++) {
            particles.push({
                x: Math.random() * w, y: Math.random() * h,
                vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
                r: Math.random() * 2 + 0.5,
                a: Math.random() * 0.4 + 0.1,
                color: Math.random() > 0.5 ? '0,212,255' : '233,69,96'
            });
        }

        function draw() {
            ctx.clearRect(0, 0, w, h);
            particles.forEach(p => {
                p.x += p.vx; p.y += p.vy;
                if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
                if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${p.color},${p.a})`;
                ctx.fill();
            });
            // Draw connections
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < 120) {
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(0,212,255,${0.06 * (1 - dist/120)})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }
            animId = requestAnimationFrame(draw);
        }
        draw();

        // Cleanup when container is removed
        const observer = new MutationObserver(() => {
            if (!document.contains(container)) { cancelAnimationFrame(animId); observer.disconnect(); }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        window.addEventListener('resize', resize, { passive: true });
    }

    // 3D floating rank badge
    function create3DRankBadge(tier, rank, lp) {
        if (!tier) return '';
        const tierColors3d = {CHALLENGER:'#f0c040',GRANDMASTER:'#ef5350',MASTER:'#b344e0',DIAMOND:'#4fc3f7',EMERALD:'#4caf50',PLATINUM:'#26c6da',GOLD:'#ffd740',SILVER:'#b0bec5',BRONZE:'#cd7f32',IRON:'#795548'};
        const color = tierColors3d[tier] || '#00d4ff';
        return `<div class="rank-badge-3d" style="--rank-color:${color}">
            <div class="rank-badge-inner">
                <div class="rank-badge-face rank-badge-front"><span class="rank-badge-tier">${tier}</span><span class="rank-badge-rank">${rank}</span><span class="rank-badge-lp">${lp} PDL</span></div>
                <div class="rank-badge-face rank-badge-back"><span class="rank-badge-emblem">${tier.charAt(0)}</span></div>
            </div>
        </div>`;
    }

    // ======================== TEAM ========================
    async function renderTeam() {
        app.innerHTML = `
        <div class="squad-hero">
            <div class="squad-hero-bg"></div>
            <div class="squad-hero-splash"></div>
            <div class="squad-hero-inner">
                <img src="https://ddragon.leagueoflegends.com/cdn/${DVER}/img/profileicon/4644.png" alt="" class="hero-emblem">
                <h1><span>FAMILY FRIENDS</span></h1>
                <p>BTC TO THE FUCKIN MOON</p>
            </div>
        </div>
        <div class="section-wrap">
            <div class="tg" id="squad-grid">
                ${PLAYERS.map((p,i) => `<div class="pc ${p.special==='noob'?'pc-noob':''}" data-i="${i}" onclick="location.hash='profile/${i}'">
                    <div class="skel-card"><div class="skel-avatar skel-pulse"></div><div class="skel-lines"><div class="skel-line skel-pulse" style="width:60%"></div><div class="skel-line skel-pulse" style="width:40%"></div><div class="skel-line skel-pulse" style="width:80%"></div></div></div>
                </div>`).join('')}
            </div>
        </div>
        <div class="section-wrap">
            <div class="squad-actions">
                <button class="squad-action-btn squad-live-btn" id="squad-live-btn" onclick="manualCheckLive()">🎮 Quem está em partida?</button>
                <button class="squad-action-btn" onclick="location.hash='compare'">Comparar Jogadores</button>
                <button class="squad-action-btn" onclick="location.hash='dashboard'">Dashboard</button>
            </div>
            <div class="soloq-ranking" id="soloq-ranking">
                <div class="soloq-header">
                    <h2>Ranking Solo Q</h2>
                    <p>Evolu&ccedil;&atilde;o di&aacute;ria de PDL do squad (s&eacute;ries temporais)</p>
                </div>
                <div class="soloq-chart" id="soloq-chart"><div class="ld"><div class="sp"></div></div></div>
            </div>
        </div>
        <div class="section-wrap">
            <div class="tl-section" id="squad-timeline-wrap">
                <div class="tl-header"><h2>Timeline do Squad FF</h2><p>Últimas partidas de todos os jogadores</p></div>
                <div id="squad-timeline"><p style="color:var(--dim);text-align:center;padding:1rem;">Carregando...</p></div>
            </div>
        </div>`;

        // Init 3D effects
        initParticles(document.querySelector('.squad-hero'));

        const rankData = [];
        let loaded = 0;

        // Renders a single player card given their data
        function renderCard(i, d) {
            const card = document.querySelector(`[data-i="${i}"]`);
            if (!card) return null;
            const p = PLAYERS[i];
            const s = d.summoner || {}, le = Array.isArray(d.league) ? d.league : [], mt = Array.isArray(d.matches) ? d.matches : [];
            const ic = playerIcon(i, s.profileIconId), lv = s.summonerLevel || '?';
            const solo = getBestRanked(le);
            const isFlexData = isFlex(solo);
            const wr = solo ? ((solo.wins/(solo.wins+solo.losses))*100)|0 : null;
            const recent = mt.length
                ? [...mt].sort((a,b) => (b.info?.gameCreation||0)-(a.info?.gameCreation||0))[0]
                : null;
            const ago = recent ? fmtAgo(recent.info?.gameCreation) : '';
            const rmp = recent?.info?.participants?.find(x => x.puuid === d.account?.puuid);
            const rChId = rmp?.championId;
            const rWin = rmp?.win;

            const isNoob = p.special === 'noob';
            const noobBadge = isNoob ? `<div class="noob-badge">AMON 🤡 O NOOB DO SQUAD</div>` : '';
            const noobTitle = isNoob ? `<span class="noob-crown">👑💀</span>` : '';
            const noobFooter = isNoob ? `<div class="noob-footer">
                <span class="noob-quote">"Eu juro que tava lagando"</span>
                <div class="noob-stats-fun">
                    <span>🏆 Rei dos 0/10</span>
                    <span>🎯 Farm? Nunca ouvi falar</span>
                </div>
            </div>` : '';

            // Dynamic card backgrounds
            const liveData = _liveAlerts[i];
            const isInGame = !!liveData;
            const liveChampId = liveData?.champId;
            const liveChampName = liveChampId ? (CMAP[liveChampId] || null) : null;
            // Win/loss streak detection
            let streakCount = 0, streakType = null;
            const sortedMt = [...mt].filter(m => m?.info?.participants).sort((a,b) => (b.info?.gameCreation||0)-(a.info?.gameCreation||0));
            for (const m of sortedMt) {
                const pp = m.info.participants.find(x => x.puuid === d.account?.puuid);
                if (!pp) break;
                if (streakType === null) { streakType = pp.win ? 'win' : 'loss'; streakCount = 1; }
                else if ((streakType === 'win' && pp.win) || (streakType === 'loss' && !pp.win)) streakCount++;
                else break;
            }
            // Apply dynamic classes
            card.classList.remove('pc-ingame', 'pc-winstreak', 'pc-lossstreak');
            card.style.removeProperty('--live-splash');
            if (isInGame) {
                card.classList.add('pc-ingame');
                if (liveChampName) {
                    card.style.setProperty('--live-splash', `url('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${liveChampName}_0.jpg')`);
                }
            }
            else if (streakType === 'win' && streakCount >= 3) card.classList.add('pc-winstreak');
            else if (streakType === 'loss' && streakCount >= 3) card.classList.add('pc-lossstreak');

            const streakBadgeHtml = (streakType === 'win' && streakCount >= 3) ? `<div class="pc-streak-badge">🔥 ${streakCount} vitórias seguidas</div>`
                : (streakType === 'loss' && streakCount >= 3) ? `<div class="pc-streak-badge">💀 ${streakCount} derrotas seguidas</div>`
                : isInGame && liveChampName ? `<div class="pc-live-champ">🎮 Jogando de <b>${liveChampName}</b></div>`
                : '';

            card.innerHTML = `
            <div class="pc-live-splash"></div>
            ${noobBadge}
            <div class="pch">
                <div class="pci ${isNoob?'pci-noob':''}">${isNoob?'<div class="noob-ring"></div>':''}
                    <img src="${profImg(ic)}" alt="" ${F}>
                </div>
                <div>
                    <div class="pcn">${noobTitle}${d.account?.gameName||p.name} <span class="t">#${d.account?.tagLine||p.tag}</span></div>
                    <div class="cl">Nível ${lv}${isNoob?' — AMON (Hardstuck)':''}</div>
                </div>
            </div>
            ${solo
                ? `<div class="pr"><span class="pt ${rankCls(solo.tier)}">${solo.tier} ${solo.rank}${isFlexData?' <small style="opacity:.6">(Flex)</small>':''}</span><span class="pl">${solo.leaguePoints} PDL</span><span class="pw">${wr}% WR</span></div>`
                : `<div class="pn">Sem ranked</div>`}
            ${rChId ? `<div class="lr">
                <img src="${champImg(rChId)}" style="width:22px;height:22px;border-radius:4px;flex-shrink:0;" onerror="this.style.display='none'">
                <span class="dot ${rWin?'g':'r'}"></span>
                <span>${CMAP[rChId]||'?'} &bull; ${ago}</span>
            </div>` : ago ? `<div class="lr"><span class="dot g"></span><span>${ago}</span></div>` : ''}
            ${streakBadgeHtml}
            ${(() => {
                const comment = generateOfficeComment(d.account?.gameName||p.name, mt, d.account, d.league);
                return comment ? `<div class="office-comment">
                    <div class="office-comment-char"><span class="office-comment-icon">${comment.icon}</span> Análise de Performance</div>
                    <div class="office-comment-txt">${comment.txt}</div>
                </div>` : '';
            })()}
            ${noobFooter}`;

            // Cache profile for offline PWA
            if (navigator.serviceWorker?.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'CACHE_PROFILE', idx: i, profile: d });
            }

            // Return rank data for chart
            if (solo) {
                const tierOrder = {CHALLENGER:9,GRANDMASTER:8,MASTER:7,DIAMOND:6,EMERALD:5,PLATINUM:4,GOLD:3,SILVER:2,BRONZE:1,IRON:0};
                const rankOrder = {I:3,II:2,III:1,IV:0};
                const totalLP = (tierOrder[solo.tier]||0)*400 + (rankOrder[solo.rank]||0)*100 + (solo.leaguePoints||0);
                return { name: d.account.gameName||p.name, tier: solo.tier, rank: solo.rank, lp: solo.leaguePoints||0, totalLP, wins: solo.wins||0, losses: solo.losses||0, idx: i, icon: playerIcon(i, s.profileIconId), flex: isFlexData };
            }
            return null;
        }

        // Callback for background refresh — updates card, ranking, and current page
        window.onPlayerRefreshed = function(i, d) {
            const rd = renderCard(i, d);
            // Update rankData for this player
            const existing = rankData.findIndex(r => r.idx === i);
            if (rd) { if (existing >= 0) rankData[existing] = rd; else rankData.push(rd); }
            else if (existing >= 0) rankData.splice(existing, 1);
            renderSoloQRanking(rankData, false);
            renderTimeline();

            // Re-render current page if it depends on player data
            const h = location.hash.replace(/^#/, '');
            if (h === 'dashboard')          renderDashboard();
            else if (h === 'arena')         renderArenaRPG();
            else if (h.startsWith('profile/' + i)) renderProfile(i);
        };

        // Load ALL players in parallel.
        // Each player updates its card + ranking chart as soon as it resolves.
        const failedPlayers = [];

        function tryLoadPlayer(i) {
            const card = document.querySelector(`[data-i="${i}"]`);
            if (!card) { loaded++; return; }

            loadPlayerFast(i).then(d => {
                const rd = renderCard(i, d);
                if (rd) {
                    const ex = rankData.findIndex(r => r.idx === i);
                    if (ex >= 0) rankData[ex] = rd; else rankData.push(rd);
                }
                // Remove from failed list if was there
                const fi = failedPlayers.indexOf(i);
                if (fi >= 0) failedPlayers.splice(fi, 1);
            }).catch(err => {
                const isAuth = err.message?.includes('403') || err.message?.includes('401');
                const isRate = err.message?.includes('429');
                card.innerHTML = `<div class="pch">
                    <div class="pci" style="display:flex;align-items:center;justify-content:center;background:var(--surf);font-size:1.5em;color:var(--dim);">?</div>
                    <div><div class="pcn">${PLAYERS[i].name} <span class="t">#${PLAYERS[i].tag}</span></div>
                    <div class="cl" style="color:#ef5350;">${isAuth?'API Key expirada':isRate?'Rate limit — aguarde':'Tentando novamente...'}</div></div>
                </div>
                ${isAuth?'<div style="margin-top:8px;"><button class="api-key-btn" onclick="showApiKeyModal()">Atualizar API Key</button></div>':''}`;
                // Mark for retry (unless auth error — no point retrying with bad key)
                if (!isAuth && !failedPlayers.includes(i)) failedPlayers.push(i);
            }).finally(() => {
                loaded++;
                init3DTilt();
                renderSoloQRanking(rankData, loaded < PLAYERS.length);
                renderTimeline();
                if (loaded === PLAYERS.length) {
                    _allPlayersLoaded = true;
                    PLAYERS.forEach((_, j) => setTimeout(() => loadPlayerBackground(j), j * 5000));
                    startRetryLoop();
                    // Sort squad cards by most recent match
                    sortSquadByLastMatch();
                    // Check in-game immediately after all players loaded
                    setTimeout(checkSquadInGame, 3000);
                    // Auto-refresh: cycle through all players every 3 min to keep data fresh
                    startAutoRefreshLoop();
                }
            });
        }

        // Retry failed players every 15s until all succeed or page changes
        let retryTimer = null;
        function startRetryLoop() {
            if (retryTimer) clearInterval(retryTimer);
            if (!failedPlayers.length) return;
            retryTimer = setInterval(() => {
                // Stop if we navigated away from team page
                if (!document.getElementById('squad-grid')) { clearInterval(retryTimer); retryTimer = null; return; }
                if (!failedPlayers.length) { clearInterval(retryTimer); retryTimer = null; return; }
                // Retry each failed player (staggered)
                const toRetry = [...failedPlayers];
                toRetry.forEach((idx, n) => {
                    setTimeout(() => {
                        // Clear stale cache so it tries again
                        delete cache[idx];
                        delete bgRefresh[idx];
                        delete bgLoading[idx];
                        tryLoadPlayer(idx);
                    }, n * 4000); // 4s apart
                });
            }, 20000);
        }

        // Sort squad grid by last match played (most recent first)
        function sortSquadByLastMatch() {
            const grid = document.getElementById('squad-grid');
            if (!grid) return;
            const cards = [...grid.children];
            cards.sort((a, b) => {
                const ai = parseInt(a.dataset.i), bi = parseInt(b.dataset.i);
                const ma = cache[ai]?.matches, mb = cache[bi]?.matches;
                const lastA = Array.isArray(ma) && ma.length ? (ma[0]?.info?.gameCreation || 0) : 0;
                const lastB = Array.isArray(mb) && mb.length ? (mb[0]?.info?.gameCreation || 0) : 0;
                return lastB - lastA;
            });
            cards.forEach(c => grid.appendChild(c));
        }

        // Auto-refresh: every 3 min, refresh all stale players to detect new matches
        let _autoRefreshTimer = null;
        function startAutoRefreshLoop() {
            if (_autoRefreshTimer) clearInterval(_autoRefreshTimer);
            _autoRefreshTimer = setInterval(() => {
                if (apiExpired) return;
                console.log('[AutoRefresh] Verificando dados desatualizados...');
                PLAYERS.forEach((_, i) => {
                    if (cache[i] && isStale(cache[i])) {
                        refreshPlayer(i);
                    }
                });
            }, 3 * 60 * 1000); // 3 min
        }

        PLAYERS.forEach((_, i) => tryLoadPlayer(i));
    }

    function renderSoloQRanking(data, stillLoading) {
        const el = $('soloq-chart');
        if (!el) return;
        if (!data.length && !stillLoading) { el.innerHTML = '<p style="color:var(--dim);text-align:center;padding:2rem;">Nenhum jogador posicionado na Solo Q</p>'; return; }
        if (!data.length && stillLoading) { return; } // wait for first player

        const sorted = [...data].sort((a,b) => b.totalLP - a.totalLP);
        const tierColors = {CHALLENGER:'#f0c040',GRANDMASTER:'#ef5350',MASTER:'#b344e0',DIAMOND:'#4fc3f7',EMERALD:'#4caf50',PLATINUM:'#26c6da',GOLD:'#ffd740',SILVER:'#b0bec5',BRONZE:'#cd7f32',IRON:'#795548'};
        const medals = ['🥇','🥈','🥉'];

        // Save snapshot for history tracking (Firebase + localStorage)
        const histKey = 'soloq_history';
        const today = new Date().toISOString().split('T')[0];
        let history = {};
        try { history = JSON.parse(localStorage.getItem(histKey)||'{}'); } catch(_) {}
        if (!history[today]) history[today] = {};
        sorted.forEach(d => { history[today][d.name] = d.totalLP; });
        localStorage.setItem(histKey, JSON.stringify(history));
        // Sync LP history to Firebase
        if (db) {
            const todayData = {};
            sorted.forEach(d => { todayData[d.name] = d.totalLP; });
            db.ref(`lpHistory/${today}`).set(todayData).catch(() => {});
        }

        const dates = Object.keys(history).sort();

        // Legend cards (compact)
        let legendHtml = '<div class="soloq-legend-grid">';
        sorted.forEach((d, i) => {
            const wr = ((d.wins/(d.wins+d.losses))*100).toFixed(0);
            const color = tierColors[d.tier] || 'var(--pri)';
            const medal = i < 3 ? medals[i] : `${i+1}º`;
            const isNoob = PLAYERS[d.idx]?.special === 'noob';
            legendHtml += `<div class="soloq-legend-card ${isNoob?'noob-legend':''}" onclick="location.hash='profile/${d.idx}'">
                <div class="soloq-lc-top">
                    <span class="soloq-lc-medal">${medal}</span>
                    <img src="${profImg(d.icon)}" alt="" class="soloq-lc-icon" ${F}>
                    <div>
                        <div class="soloq-lc-name">${d.name}${isNoob?' 🤡':''}</div>
                        <div class="soloq-lc-tier ${rankCls(d.tier)}">${d.tier} ${d.rank}${d.flex?' <small style="opacity:.55;font-weight:400;">(Flex)</small>':''}</div>
                    </div>
                </div>
                <div class="soloq-lc-stats">
                    <span style="color:${color};font-weight:900;">${d.lp} PDL</span>
                    <span style="color:var(--dim);font-size:.8em;">${wr}% WR</span>
                    <span style="color:var(--dim);font-size:.75em;">${d.wins}V ${d.losses}D</span>
                </div>
                <div class="soloq-lc-color" style="background:${color};"></div>
            </div>`;
        });
        legendHtml += '</div>';

        // Loading indicator
        const loadingHtml = stillLoading
            ? `<div class="soloq-loading"><div class="sp" style="width:18px;height:18px;border-width:2px;"></div><span>Carregando mais jogadores…</span></div>`
            : '';

        // Build chart
        let html = legendHtml + loadingHtml;
        html += `<div class="soloq-evo">
            <h3>Evolução de PDL (dia a dia)</h3>
            <div class="soloq-evo-chart" id="soloq-evo-chart"></div>
        </div>`;

        el.innerHTML = html;
        renderLPEvolution(dates, history, sorted);
    }

    function renderLPEvolution(dates, history, data) {
        const chartEl = $('soloq-evo-chart');
        if (!chartEl) return;

        const tierColors = {CHALLENGER:'#f0c040',GRANDMASTER:'#ef5350',MASTER:'#b344e0',DIAMOND:'#4fc3f7',EMERALD:'#4caf50',PLATINUM:'#26c6da',GOLD:'#ffd740',SILVER:'#b0bec5',BRONZE:'#cd7f32',IRON:'#795548'};
        const tierList = ['IRON','BRONZE','SILVER','GOLD','PLATINUM','EMERALD','DIAMOND','MASTER','GRANDMASTER','CHALLENGER'];
        const tierNames = {IRON:'Iron',BRONZE:'Bronze',SILVER:'Silver',GOLD:'Gold',PLATINUM:'Plat',EMERALD:'Emerald',DIAMOND:'Diamond',MASTER:'Master',GRANDMASTER:'GM',CHALLENGER:'Chall'};
        const tierBase = {IRON:0,BRONZE:400,SILVER:800,GOLD:1200,PLATINUM:1600,EMERALD:2000,DIAMOND:2400,MASTER:2800,GRANDMASTER:3200,CHALLENGER:3600};

        if (dates.length < 2) {
            chartEl.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--dim);">
                <p style="font-size:1.2em;margin-bottom:8px;">📊 Dados do dia registrados!</p>
                <p style="font-size:.85em;">Volte amanhã para ver a evolução no gráfico de linhas.</p>
                <p style="font-size:.75em;margin-top:8px;color:var(--pri);">Hoje: ${dates[0]}</p>
            </div>`;
            return;
        }

        // Fill missing days: if a player has no entry for a date, use their current totalLP
        data.forEach(d => {
            dates.forEach(dt => {
                if (history[dt] && history[dt][d.name] === undefined) {
                    history[dt][d.name] = d.totalLP;
                }
            });
        });

        const W = 800, H = 600, PADL = 70, PADR = 90, PADT = 25, PADB = 50;
        const cw = W - PADL - PADR, ch = H - PADT - PADB;

        // Collect all values for y-axis range
        let allVals = [];
        data.forEach(d => {
            dates.forEach(dt => { if (history[dt]?.[d.name] !== undefined) allVals.push(history[dt][d.name]); });
        });
        // Snap range to only the elo tiers where players actually are
        const rawMin = Math.min(...allVals), rawMax = Math.max(...allVals);
        let minTierIdx = Math.max(0, Math.floor(rawMin / 400));
        let maxTierIdx = Math.min(tierList.length - 1, Math.floor(rawMax / 400));
        // Ensure at least 1 tier gap for readability
        if (minTierIdx === maxTierIdx && minTierIdx > 0) minTierIdx--;
        const minY = minTierIdx * 400 - 50; // small padding below lowest elo
        const maxY = (maxTierIdx + 1) * 400 + 50; // small padding above highest elo
        const rangeY = maxY - minY || 400;

        const xStep = dates.length > 1 ? cw / (dates.length - 1) : cw;
        const scaleY = v => PADT + ch - ((v - minY) / rangeY) * ch;
        const scaleX = i => PADL + i * xStep;

        let svg = `<svg viewBox="0 0 ${W} ${H}" class="soloq-svg" xmlns="http://www.w3.org/2000/svg">`;

        // Defs for gradients
        svg += `<defs>`;
        data.forEach((d, idx) => {
            const color = tierColors[d.tier] || '#00d4ff';
            svg += `<linearGradient id="grad${idx}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="${color}" stop-opacity="0.3"/>
                <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
            </linearGradient>`;
        });
        svg += `</defs>`;

        // Elo tier boundary lines (horizontal lines at each elo boundary)
        for (let ti = minTierIdx; ti <= maxTierIdx + 1; ti++) {
            const boundary = ti * 400;
            if (boundary < minY || boundary > maxY) continue;
            const y = scaleY(boundary);
            const tierName = tierNames[tierList[ti]] || '';
            const tierColor = tierColors[tierList[ti]] || 'rgba(255,255,255,0.1)';
            // Elo boundary line
            svg += `<line x1="${PADL}" y1="${y}" x2="${W-PADR}" y2="${y}" stroke="${tierColor}" stroke-width="1" opacity="0.3" stroke-dasharray="4,4"/>`;
            // Elo label on Y axis
            if (tierName) {
                svg += `<text x="${PADL-8}" y="${y+4}" fill="${tierColor}" font-size="10" text-anchor="end" font-weight="700" font-family="system-ui">${tierName}</text>`;
            }
        }

        // Lighter sub-division lines within visible elos (every 100 = one rank)
        for (let val = Math.ceil(minY/100)*100; val <= maxY; val += 100) {
            if (val % 400 === 0) continue; // skip elo boundaries (already drawn)
            const y = scaleY(val);
            svg += `<line x1="${PADL}" y1="${y}" x2="${W-PADR}" y2="${y}" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>`;
        }

        // Vertical grid + date labels
        dates.forEach((dt, i) => {
            const x = scaleX(i);
            svg += `<line x1="${x}" y1="${PADT}" x2="${x}" y2="${H-PADB}" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>`;
            const parts = dt.split('-');
            const label = `${parts[2]}/${parts[1]}`;
            svg += `<text x="${x}" y="${H-12}" fill="#8892b0" font-size="10" text-anchor="middle" font-family="system-ui">${label}</text>`;
        });

        // Area fills + lines per player
        const endLabels = [];
        data.forEach((d, idx) => {
            const color = tierColors[d.tier] || '#00d4ff';
            let points = [];
            dates.forEach((dt, i) => {
                if (history[dt]?.[d.name] !== undefined) {
                    points.push({ x: scaleX(i), y: scaleY(history[dt][d.name]), val: history[dt][d.name] });
                }
            });

            if (points.length > 1) {
                // Area fill
                const areaPath = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)} ` +
                    points.slice(1).map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
                    ` L${points[points.length-1].x.toFixed(1)},${(H-PADB).toFixed(1)} L${points[0].x.toFixed(1)},${(H-PADB).toFixed(1)} Z`;
                svg += `<path d="${areaPath}" fill="url(#grad${idx})" opacity="0.4"/>`;

                // Line
                const isNoob = PLAYERS[d.idx]?.special === 'noob';
                const strokeW = isNoob ? '3.5' : '2.5';
                const linePath = points.map((p, i) => `${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
                svg += `<path d="${linePath}" fill="none" stroke="${color}" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>`;
            }

            // Dots
            points.forEach(p => {
                svg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="${color}" stroke="var(--bg)" stroke-width="2" opacity="0.95"/>`;
            });

            // End label
            if (points.length) {
                const last = points[points.length - 1];
                const isNoob = PLAYERS[d.idx]?.special === 'noob';
                const suffix = isNoob ? ' 🤡' : '';
                endLabels.push({ x: last.x, y: last.y, name: d.name + suffix, color });
            }
        });

        // Anti-overlap labels
        endLabels.sort((a, b) => a.y - b.y);
        for (let i = 1; i < endLabels.length; i++) {
            if (endLabels[i].y - endLabels[i-1].y < 14) {
                endLabels[i].y = endLabels[i-1].y + 14;
            }
        }
        endLabels.forEach(l => {
            l.y = Math.max(PADT + 8, Math.min(H - PADB - 4, l.y));
            svg += `<text x="${l.x + 8}" y="${l.y + 4}" fill="${l.color}" font-size="10" font-weight="700" font-family="system-ui">${l.name}</text>`;
        });

        // Axis lines
        svg += `<line x1="${PADL}" y1="${PADT}" x2="${PADL}" y2="${H-PADB}" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>`;
        svg += `<line x1="${PADL}" y1="${H-PADB}" x2="${W-PADR}" y2="${H-PADB}" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>`;

        svg += '</svg>';
        chartEl.innerHTML = svg;
    }

    // ======================== PROFILE ========================
    function renderProfile(idx) {
        const p = PLAYERS[idx];
        if (!p) { location.hash = 'team'; return; }
        app.innerHTML = `<div class="section-wrap-sm">
            <button class="bb" onclick="location.hash='team'">&larr; Voltar</button>
            <div class="pv">
                <div class="skel-profile-header skel-pulse"></div>
                <div class="skel-profile-stats">
                    <div class="skel-stat-box skel-pulse"></div>
                    <div class="skel-stat-box skel-pulse"></div>
                    <div class="skel-stat-box skel-pulse"></div>
                    <div class="skel-stat-box skel-pulse"></div>
                </div>
                <div class="skel-section-title skel-pulse"></div>
                <div class="skel-match skel-pulse"></div>
                <div class="skel-match skel-pulse"></div>
                <div class="skel-match skel-pulse"></div>
            </div>
        </div>`;

        loadPlayer(idx).then(d => {
            const a = d.account || {}, s = d.summoner || {};
            const le = Array.isArray(d.league) ? d.league : [];
            const ma = Array.isArray(d.mastery) ? d.mastery : [];
            const mt = Array.isArray(d.matches) ? d.matches : [];
            const ic = playerIcon(idx, s.profileIconId), lv = s.summonerLevel || '?';
            const solo = le.find(e => e.queueType === 'RANKED_SOLO_5x5');
            const flex = le.find(e => e.queueType === 'RANKED_FLEX_SR');
            // RPG class theme on profile
            const rpgData = calcRPGStats(mt, a.puuid, d.league);
            if (rpgData) {
                const pv = document.querySelector('.pv');
                if (pv) {
                    pv.style.setProperty('--profile-accent', rpgData.rpgClass.color);
                    pv.classList.add('rpg-themed');
                }
            }
            const puuid = a.puuid || '';

            // ==================== AGGREGATE STATS ====================
            let tv=0, td=0; le.forEach(e => { tv+=e.wins||0; td+=e.losses||0; });
            const tg=tv+td, wr2=tg>0?((tv/tg)*100).toFixed(1):'—';
            let tk=0,tkd=0,ta=0,tcs=0,tDmg=0,tGold=0,tVision=0,tDur=0;
            let tDoubleKills=0,tTripleKills=0,tQuadraKills=0,tPentaKills=0;
            let tFirstBlood=0,tTurretKills=0,tDragon=0,tBaron=0;
            let maxKills=0,maxDeaths=0,maxCS=0,maxDmg=0,maxGold=0;
            let bestKDAMatch=null, bestKDAVal=0;

            // Champion stats aggregation
            const champStats = {};
            // Role distribution
            const roleCounts = {};
            // Recent form (last 20)
            const sm = [...mt].sort((a2,b2) => (b2.info?.gameCreation||0)-(a2.info?.gameCreation||0));
            const recentForm = [];

            sm.forEach((m, mIdx) => {
                const mp = m.info?.participants?.find(x=>x.puuid===puuid) || {};
                const win = m.info?.teams?.find(t=>t.teamId===mp.teamId)?.win;
                const k=mp.kills||0, dd=mp.deaths||0, as2=mp.assists||0;
                const cs=(mp.totalMinionsKilled||0)+(mp.neutralMinionsKilled||0);
                const dmg=mp.totalDamageDealtToChampions||0;
                const gold=mp.goldEarned||0;
                const vis=mp.visionScore||0;
                const dur=m.info?.gameDuration||0;

                tk+=k; tkd+=dd; ta+=as2; tcs+=cs; tDmg+=dmg; tGold+=gold; tVision+=vis; tDur+=dur;
                tDoubleKills+=mp.doubleKills||0; tTripleKills+=mp.tripleKills||0;
                tQuadraKills+=mp.quadraKills||0; tPentaKills+=mp.pentaKills||0;
                if(mp.firstBloodKill) tFirstBlood++;
                tTurretKills+=mp.turretKills||0;
                tDragon+=mp.dragonKills||0; tBaron+=mp.baronKills||0;

                if(k>maxKills) maxKills=k;
                if(dd>maxDeaths) maxDeaths=dd;
                if(cs>maxCS) maxCS=cs;
                if(dmg>maxDmg) maxDmg=dmg;
                if(gold>maxGold) maxGold=gold;

                const mkda = (k+as2)/Math.max(dd,1);
                if(mkda>bestKDAVal && mt.length>1) { bestKDAVal=mkda; bestKDAMatch={k,d:dd,a:as2,champ:mp.championId,win}; }

                // Champion stats
                const cid = mp.championId;
                if(cid) {
                    if(!champStats[cid]) champStats[cid]={id:cid,games:0,wins:0,kills:0,deaths:0,assists:0,cs:0,dmg:0,gold:0};
                    const cs2 = champStats[cid];
                    cs2.games++; if(win) cs2.wins++; cs2.kills+=k; cs2.deaths+=dd; cs2.assists+=as2; cs2.cs+=cs; cs2.dmg+=dmg; cs2.gold+=gold;
                }

                // Role
                const role = mp.teamPosition || mp.individualPosition || 'UNKNOWN';
                if(role && role!=='UNKNOWN' && role!=='') roleCounts[role] = (roleCounts[role]||0)+1;

                // Recent form (last 20)
                if(mIdx < 20) recentForm.push(win ? 1 : 0);
            });

            const kda = mt.length ? ((tk+ta)/Math.max(tkd,1)).toFixed(2) : '—';
            const acs = mt.length ? (tcs/mt.length)|0 : 0;
            const avgDmg = mt.length ? (tDmg/mt.length)|0 : 0;
            const avgGold = mt.length ? (tGold/mt.length)|0 : 0;
            const avgVision = mt.length ? (tVision/mt.length).toFixed(1) : 0;
            const avgDur = mt.length ? (tDur/mt.length)|0 : 0;
            const avgKP = mt.length && tk+ta > 0 ? ((tk+ta)/Math.max(mt.length,1)).toFixed(1) : '0';

            // ==================== RECENT FORM BAR ====================
            let formHtml = '';
            if (recentForm.length >= 2) {
                const recentWins = recentForm.filter(x=>x).length;
                const recentWR = ((recentWins/recentForm.length)*100).toFixed(0);
                // Streak
                let streak = 0, streakType = recentForm[0] ? 'W' : 'L';
                for (const r of recentForm) { if((r&&streakType==='W')||(!r&&streakType==='L')) streak++; else break; }
                const streakTxt = streak >= 2 ? `${streak}${streakType}` : '';
                const streakCls = streakType==='W' ? 'streak-w' : 'streak-l';
                formHtml = `<div class="prof-form">
                    <div class="prof-form-header">
                        <span>Forma Recente (${recentForm.length} jogos)</span>
                        <span class="prof-form-wr">${recentWR}% WR${streakTxt ? ` <span class="${streakCls}">${streakTxt}</span>` : ''}</span>
                    </div>
                    <div class="prof-form-bar">${recentForm.map(w => `<div class="prof-form-dot ${w?'w':'l'}"></div>`).join('')}</div>
                </div>`;
            }

            // ==================== STATS GRID (EXPANDED) ====================
            const stats = `<div class="ps prof-stats-expanded">
                <div class="pst"><div class="sm">Nível</div><div class="sv">${lv}</div></div>
                <div class="pst"><div class="sm">Partidas</div><div class="sv">${tg}</div><div class="ss">${tv}V ${td}D</div></div>
                <div class="pst"><div class="sm">Win Rate</div><div class="sv ${tg>0&&(tv/tg)>=0.55?'sv-good':tg>0&&(tv/tg)<0.45?'sv-bad':''}">${wr2}%</div></div>
                <div class="pst"><div class="sm">KDA</div><div class="sv ${parseFloat(kda)>=3?'sv-good':parseFloat(kda)<2?'sv-bad':''}">${kda}</div><div class="ss">${tk}/${tkd}/${ta}</div></div>
                <div class="pst"><div class="sm">CS Médio</div><div class="sv">${acs}</div><div class="ss">Rec. ${maxCS}</div></div>
                <div class="pst"><div class="sm">Dano Médio</div><div class="sv">${fmtGold(avgDmg)}</div><div class="ss">Rec. ${fmtGold(maxDmg)}</div></div>
                <div class="pst"><div class="sm">Ouro Médio</div><div class="sv">${fmtGold(avgGold)}</div><div class="ss">Rec. ${fmtGold(maxGold)}</div></div>
                <div class="pst"><div class="sm">Visão Média</div><div class="sv">${avgVision}</div></div>
                <div class="pst"><div class="sm">Partida Média</div><div class="sv">${fmtDur(avgDur)}</div></div>
                <div class="pst"><div class="sm">Participação</div><div class="sv">${avgKP}</div><div class="ss">K+A / jogo</div></div>
            </div>`;

            // ==================== MULTI-KILLS & HIGHLIGHTS ====================
            let highlights = '';
            const hlItems = [];
            if(tPentaKills) hlItems.push(`<div class="hl-item hl-penta"><span class="hl-val">${tPentaKills}</span><span class="hl-label">Penta Kill${tPentaKills>1?'s':''}</span></div>`);
            if(tQuadraKills) hlItems.push(`<div class="hl-item hl-quadra"><span class="hl-val">${tQuadraKills}</span><span class="hl-label">Quadra Kill${tQuadraKills>1?'s':''}</span></div>`);
            if(tTripleKills) hlItems.push(`<div class="hl-item hl-triple"><span class="hl-val">${tTripleKills}</span><span class="hl-label">Triple Kill${tTripleKills>1?'s':''}</span></div>`);
            if(tDoubleKills) hlItems.push(`<div class="hl-item hl-double"><span class="hl-val">${tDoubleKills}</span><span class="hl-label">Double Kill${tDoubleKills>1?'s':''}</span></div>`);
            if(tFirstBlood) hlItems.push(`<div class="hl-item hl-fb"><span class="hl-val">${tFirstBlood}</span><span class="hl-label">First Blood${tFirstBlood>1?'s':''}</span></div>`);
            if(maxKills>=10) hlItems.push(`<div class="hl-item hl-record"><span class="hl-val">${maxKills}</span><span class="hl-label">Recorde Kills</span></div>`);
            if(bestKDAMatch && bestKDAVal>=5) hlItems.push(`<div class="hl-item hl-kda"><span class="hl-val">${bestKDAVal.toFixed(1)}</span><span class="hl-label">Melhor KDA</span></div>`);
            if(hlItems.length) {
                highlights = `<div class="sx"><h3>Destaques</h3><div class="hl-grid">${hlItems.join('')}</div></div>`;
            }

            // ==================== RANKED SECTION ====================
            let ranked = '';
            if (le.length) {
                const qn = {'RANKED_SOLO_5x5':'Solo/Duo','RANKED_FLEX_SR':'Flex 5v5'};
                ranked = '<div class="sx"><h3>Ranked</h3><div class="ranked-grid">';
                for (const e of le) {
                    const w2 = ((e.wins/(e.wins+e.losses))*100).toFixed(0);
                    const tierIcon = e.tier ? e.tier.charAt(0)+e.tier.slice(1).toLowerCase() : '?';
                    const totalGames = e.wins+e.losses;
                    const wrColor = parseInt(w2)>=55?'#4caf50':parseInt(w2)<45?'#ef5350':'var(--dim)';
                    ranked += `<div class="ranked-card">
                        <div class="ranked-queue">${qn[e.queueType]||e.queueType}</div>
                        <div class="ranked-main">
                            <div class="ranked-tier ${rankCls(e.tier)}">${e.tier} ${e.rank}</div>
                            <div class="ranked-lp">${e.leaguePoints} PDL</div>
                        </div>
                        <div class="ranked-bar-wrap">
                            <div class="ranked-bar" style="width:${Math.min(e.leaguePoints,100)}%"></div>
                        </div>
                        <div class="ranked-details">
                            <span>${e.wins}V ${e.losses}D</span>
                            <span style="color:${wrColor};font-weight:700;">${w2}% WR</span>
                            <span>${totalGames} jogos</span>
                        </div>
                        <div class="ranked-tags">
                            ${e.hotStreak?'<span class="ranked-tag hot">Hot Streak</span>':''}
                            ${e.veteran?'<span class="ranked-tag vet">Veterano</span>':''}
                            ${e.freshBlood?'<span class="ranked-tag fresh">Novato</span>':''}
                            ${e.inactive?'<span class="ranked-tag inactive">Inativo</span>':''}
                        </div>
                    </div>`;
                }
                ranked += '</div></div>';
            }

            // ==================== CHAMPION POOL ====================
            let champPool = '';
            const champArr = Object.values(champStats).sort((a2,b2) => b2.games-a2.games);
            if (champArr.length) {
                const topChamps = champArr.slice(0, 8);
                const maxGames = topChamps[0]?.games || 1;
                champPool = `<div class="sx"><h3>Pool de Campeões</h3><div class="champ-pool">`;
                for (const c of topChamps) {
                    const cwr = ((c.wins/c.games)*100).toFixed(0);
                    const ckda = ((c.kills+c.assists)/Math.max(c.deaths,1)).toFixed(1);
                    const cAvgDmg = fmtGold((c.dmg/c.games)|0);
                    const barW = ((c.games/maxGames)*100).toFixed(0);
                    const wrClr = parseInt(cwr)>=60?'#4caf50':parseInt(cwr)>=50?'var(--pri)':'#ef5350';
                    champPool += `<div class="champ-row">
                        <img src="${champImg(c.id)}" class="champ-row-img" onerror="this.style.opacity='0.3'" loading="lazy">
                        <div class="champ-row-info">
                            <div class="champ-row-name">${CMAP[c.id]||'?'}</div>
                            <div class="champ-row-bar-wrap"><div class="champ-row-bar" style="width:${barW}%;background:${wrClr};"></div></div>
                        </div>
                        <div class="champ-row-stats">
                            <span class="champ-row-games">${c.games} jogos</span>
                            <span class="champ-row-wr" style="color:${wrClr}">${cwr}%</span>
                            <span class="champ-row-kda">${ckda} KDA</span>
                        </div>
                    </div>`;
                }
                champPool += '</div></div>';
            }

            // ==================== ROLE DISTRIBUTION ====================
            let roleSection = '';
            const roleNames = {TOP:'Top',JUNGLE:'Jungle',MIDDLE:'Mid',BOTTOM:'ADC',UTILITY:'Suporte'};
            const roleColors = {TOP:'#e74c3c',JUNGLE:'#2ecc71',MIDDLE:'#3498db',BOTTOM:'#e67e22',UTILITY:'#9b59b6'};
            const roleIcons = {TOP:'⚔️',JUNGLE:'🌿',MIDDLE:'🎯',BOTTOM:'🏹',UTILITY:'🛡️'};
            const totalRoleGames = Object.values(roleCounts).reduce((s,v)=>s+v,0);
            if (totalRoleGames >= 3) {
                const roleArr = Object.entries(roleCounts).sort((a2,b2) => b2[1]-a2[1]);
                let roleItems = '';
                for (const [role, count] of roleArr) {
                    const pct = ((count/totalRoleGames)*100).toFixed(0);
                    roleItems += `<div class="role-item">
                        <div class="role-icon">${roleIcons[role]||'?'}</div>
                        <div class="role-info">
                            <div class="role-name">${roleNames[role]||role}</div>
                            <div class="role-bar-wrap"><div class="role-bar" style="width:${pct}%;background:${roleColors[role]||'var(--pri)'}"></div></div>
                        </div>
                        <div class="role-pct">${pct}%</div>
                        <div class="role-count">${count}</div>
                    </div>`;
                }
                roleSection = `<div class="sx"><h3>Distribuição de Roles</h3><div class="role-dist">${roleItems}</div></div>`;
            }

            // ==================== MASTERY ====================
            let mas = '';
            if (ma.length) {
                mas = '<div class="sx"><h3>Maestria</h3><div class="mg">';
                for (const m of ma) {
                    mas += `<div class="mi"><span class="ml">M${m.championLevel}</span><img src="${champImg(m.championId)}" alt="" onerror="this.style.opacity='0.3'"><div class="mn">${CMAP[m.championId]||'?'}</div><div class="mp">${(m.championPoints||0).toLocaleString()} pts</div></div>`;
                }
                mas += '</div></div>';
            }

            // ==================== MATCH HISTORY ====================
            let matchs = '';
            if (sm.length) {
                const champSet = new Set(), modeSet = new Set();
                sm.forEach(m => { const mp=m.info?.participants?.find(x=>x.puuid===puuid)||{}; if(mp.championId) champSet.add(mp.championId); if(m.info?.gameMode) modeSet.add(m.info.gameMode); });
                const filterBar = `<div class="match-filters">
                    <select id="filter-champ" onchange="filterMatches()"><option value="">Campeão</option>${[...champSet].map(c=>`<option value="${c}">${CMAP[c]||c}</option>`).join('')}</select>
                    <select id="filter-mode" onchange="filterMatches()"><option value="">Modo</option>${[...modeSet].map(m2=>`<option value="${m2}">${modeName(m2)}</option>`).join('')}</select>
                    <select id="filter-result" onchange="filterMatches()"><option value="">Resultado</option><option value="w">Vitória</option><option value="l">Derrota</option></select>
                </div>`;
                matchs = '<div class="sx"><h3>Partidas Recentes <span class="match-count">' + sm.length + '</span></h3>' + filterBar;
                for (const m of sm) {
                    const mp  = m.info?.participants?.find(x => x.puuid === puuid) || {};
                    const tw  = m.info.teams?.find(t => t.teamId === mp.teamId)?.win;
                    const dur = m.info.gameDuration, cre = m.info.gameCreation;
                    const k=mp.kills||0, dd=mp.deaths||0, as2=mp.assists||0;
                    const cs2=(mp.totalMinionsKilled||0)+(mp.neutralMinionsKilled||0);
                    const cn=CMAP[mp.championId]||`#${mp.championId}`, cl2=mp.champLevel||'';
                    const mkda = ((k+as2)/Math.max(dd,1)).toFixed(1);
                    const dmg2 = mp.totalDamageDealtToChampions||0;
                    const csPerMin = dur>0 ? (cs2/(dur/60)).toFixed(1) : '0';
                    let items='';
                    for(let j=0;j<=6;j++){if(mp['item'+j]) items+=`<img src="${itemImg(mp['item'+j])}" alt="" loading="lazy">`;}
                    let sums='';
                    if(mp.summoner1Id) sums+=`<img src="${spellImg(mp.summoner1Id)}" loading="lazy">`;
                    if(mp.summoner2Id) sums+=`<img src="${spellImg(mp.summoner2Id)}" loading="lazy">`;
                    const cls=tw?'w':'l', res=tw?'VITÓRIA':'DERROTA';
                    // Multi-kills badge
                    let badge = '';
                    if(mp.pentaKills) badge='<span class="mk-badge penta">PENTA</span>';
                    else if(mp.quadraKills) badge='<span class="mk-badge quadra">QUADRA</span>';
                    else if(mp.tripleKills) badge='<span class="mk-badge triple">TRIPLE</span>';
                    const t100=(m.info?.participants||[]).filter(x=>x.teamId===100);
                    const t200=(m.info?.participants||[]).filter(x=>x.teamId===200);
                    const row = o => `<div class="or ${o.teamId===100?'b':'r'}">${o.puuid===puuid?'<b style="color:var(--pri);min-width:10px;">▶</b>':'<span style="min-width:10px;"></span>'}<img src="${champImg(o.championId)}" loading="lazy" onerror="this.style.visibility='hidden'"><span class="on">${o.riotIdGameName||'???'}</span><span class="ok"><b>${o.kills||0}</b>/<span style="color:#ef5350;">${o.deaths||0}</span>/<span style="color:var(--pri);">${o.assists||0}</span></span></div>`;
                    const matchId = m.metadata?.matchId || '';
                    matchs += `<div class="mc ${cls}" data-champ="${mp.championId}" data-mode="${m.info.gameMode}" data-result="${cls}">
                        <div class="mh">
                            <span>${res}</span>${badge}
                            <span class="mhi">${fmtDur(dur)} &bull; ${modeName(m.info.gameMode)} &bull; ${fmtAgo(cre)}</span>
                        </div>
                        <div class="mb">
                            <div class="mch">
                                <div class="mch-img-wrap"><img src="${champImg(mp.championId)}" alt="${cn}" loading="lazy"><span class="mch-lvl">${cl2}</span></div>
                                <div>
                                    <div class="mcn">${cn}</div>
                                    <div class="kda"><b>${k}</b>/<span style="color:#ef5350;">${dd}</span>/<span style="color:var(--pri);">${as2}</span> <span class="kda-ratio ${parseFloat(mkda)>=3?'kda-good':parseFloat(mkda)<2?'kda-bad':''}">${mkda}</span></div>
                                    <div class="csm">${cs2} CS (${csPerMin}/min) &bull; ${fmtGold(dmg2)} dano &bull; Visão ${mp.visionScore||0}</div>
                                    <div class="match-sums">${sums}</div>
                                </div>
                            </div>
                            <div class="mii">${items}</div>
                        </div>
                        <details class="match-teams"><summary>Times</summary><div class="tsr">
                            <div><div class="th"><span class="td b"></span> AZUL ${mp.teamId===100?'(Seu time)':''}</div>${t100.map(row).join('')}</div>
                            <div><div class="th"><span class="td r"></span> VERMELHA ${mp.teamId===200?'(Seu time)':''}</div>${t200.map(row).join('')}</div>
                        </div></details>
                    </div>`;
                }
                matchs += '</div>';
            }

            // ==================== SETTINGS TAB ====================
            const user = getLoggedUser();
            const isOwner = user && user.idx === idx;
            let settingsTab = '';
            if (isOwner) {
                const iconIds = [5885,588,589,590,591,592,593,594,595,596,597,598,599,600,601,602,603,604,605,606,607,608,4951,4952,4953,4954,4955,4956,4957,4958,4959,4960,29,28,27,26,25,24,23,22,21,20,19,18,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1,0];
                let iconGrid = '<div class="cfg-icon-grid">';
                for (const iid of iconIds) {
                    const sel = String(ic) === String(iid) ? ' cfg-icon-sel' : '';
                    iconGrid += `<img src="${profImg(iid)}" class="cfg-icon-opt${sel}" data-iid="${iid}" onclick="pickIcon(${idx},${iid})" ${F}>`;
                }
                iconGrid += '</div>';
                const pinSection = `<div class="cfg-section">
                    <h4>Alterar PIN</h4>
                    <div class="cfg-pin-form">
                        <input type="password" id="cfg-old-pin" maxlength="4" pattern="[0-9]*" inputmode="numeric" placeholder="PIN atual" autocomplete="off">
                        <input type="password" id="cfg-new-pin" maxlength="4" pattern="[0-9]*" inputmode="numeric" placeholder="Novo PIN" autocomplete="off">
                        <input type="password" id="cfg-confirm-pin" maxlength="4" pattern="[0-9]*" inputmode="numeric" placeholder="Confirmar novo PIN" autocomplete="off">
                        <button class="cfg-btn" onclick="changePin(${idx})">Alterar PIN</button>
                        <div id="cfg-pin-msg" class="cfg-msg"></div>
                    </div>
                </div>`;
                let predsHtml = '<div class="cfg-section"><h4>Meus Palpites</h4>';
                const predKeys = [];
                for (let k2 = 0; k2 < localStorage.length; k2++) {
                    const key = localStorage.key(k2);
                    if (key && key.startsWith('pred_' + idx + '_')) predKeys.push(key);
                }
                if (predKeys.length) {
                    predsHtml += '<div class="cfg-preds">';
                    for (const key of predKeys) {
                        try {
                            const pred = JSON.parse(localStorage.getItem(key));
                            const date = pred.time ? new Date(pred.time).toLocaleDateString('pt-BR') : '?';
                            const score = pred.scoreA != null && pred.scoreB != null ? pred.scoreA + ' x ' + pred.scoreB : '';
                            predsHtml += '<div class="cfg-pred-item"><span class="cfg-pred-winner">' + (pred.winner||'?') + '</span>' + (score ? '<span class="cfg-pred-score">' + score + '</span>' : '') + '<span class="cfg-pred-date">' + date + '</span></div>';
                        } catch(_) {}
                    }
                    predsHtml += '</div>';
                } else {
                    predsHtml += '<p style="color:var(--dim);font-size:.85em;">Nenhum palpite registrado ainda.</p>';
                }
                predsHtml += '</div>';
                settingsTab = `<div class="cfg-section"><h4>Trocar Ícone</h4><div class="cfg-icon-current"><img src="${profImg(ic)}" class="cfg-icon-preview" id="cfg-icon-preview" ${F}><span>Ícone atual</span></div>${iconGrid}</div>${pinSection}${predsHtml}`;
            }

            // ==================== ASSEMBLE PROFILE ====================
            const hasCfg = isOwner;
            const tabList = [{k:'overview',l:'Visão Geral'},{k:'champions',l:'Campeões'},{k:'matches',l:'Partidas'}];
            if(hasCfg) tabList.push({k:'config',l:'Config'});

            const tabs = `<div class="prof-tabs">
                ${tabList.map((t,ti) => `<button class="prof-tab ${ti===0?'on':''}" data-tab="${t.k}" onclick="switchProfTab('${t.k}')">${t.l}</button>`).join('')}
            </div>`;

            const mainRank = solo || flex;
            const rb = mainRank
                ? `<span class="prg ${rankCls(mainRank.tier)}">${mainRank.tier} ${mainRank.rank} &mdash; ${mainRank.leaguePoints} PDL${!solo&&flex?' (Flex)':''}</span>`
                : `<span class="prg">Não posicionado</span>`;
            const flexBadge = (solo && flex)
                ? `<span class="prg prg-flex">${flex.tier} ${flex.rank} Flex</span>`
                : '';

            const liveAlert = _liveAlerts[idx];
            const liveChamp = liveAlert?.champId ? CMAP[liveAlert.champId] : '';
            const liveBanner = liveAlert ? `<div class="prof-live-banner"><span class="ldot"></span> EM PARTIDA AO VIVO${liveChamp ? ` — ${liveChamp}` : ''}</div>` : '';

            app.innerHTML = `<div class="section-wrap-sm">
                <div class="prof-topbar">
                    <button class="bb" onclick="location.hash='team'">&larr; Voltar</button>
                    <button class="prof-refresh-btn" id="prof-refresh-btn" onclick="checkNewMatches(${idx})">&#128260; Verificar partidas novas</button>
                </div>
                ${liveBanner}
                <div class="pv">
                    <div class="pb" style="--pb-splash:url('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${CMAP[champArr[0]?.id]||'Zed'}_0.jpg')"><div class="pbg"></div><div class="pbi">
                        <div class="pi"><img src="${profImg(ic)}" alt="" id="prof-main-icon" ${F}></div>
                        <div><div class="pn2">${a.gameName||p.name} <span class="t">#${a.tagLine||p.tag}</span></div>
                        <div class="prof-badges">${rb}${flexBadge}<span class="prg prg-region">${p.region}</span></div>
                        </div>
                        ${solo ? create3DRankBadge(solo.tier, solo.rank, solo.leaguePoints) : ''}
                    </div></div>
                    ${formHtml}
                    ${tabs}
                    <div id="prof-tab-overview">${stats}${highlights}${ranked}</div>
                    <div id="prof-tab-champions" style="display:none;">${champPool}${roleSection}${mas}</div>
                    <div id="prof-tab-matches" style="display:none;">${matchs}</div>
                    ${hasCfg ? '<div id="prof-tab-config" style="display:none;">' + settingsTab + '</div>' : ''}
                </div>
            </div>`;
            initParticles(document.querySelector('.pb'));
        }).catch(err => {
            app.innerHTML = `<div class="section-wrap-sm"><button class="bb" onclick="location.hash='team'">&larr; Voltar</button>
                <div class="err"><p style="font-size:2em;margin-bottom:12px;">&#10060;</p><p style="font-size:1.2em;margin-bottom:8px;">Erro ao carregar perfil</p><p>${err.message}</p>
                <button onclick="renderProfile(${idx})" style="margin-top:16px;padding:10px 22px;border-radius:8px;background:var(--pri);color:var(--bg);font-weight:600;border:none;cursor:pointer;">Tentar Novamente</button></div></div>`;
        });
    }

    // ======================== CBLOL ========================
    const cblolTabs = [
        {k:'upcoming',l:'Próximas',ic:'&#128197;'}, {k:'running',l:'Ao Vivo',ic:'&#128308;'}, {k:'closed',l:'Finalizadas',ic:'&#127942;'}, {k:'ranking',l:'Ranking',ic:'&#127941;'}
    ];

    function renderCBLOL(tab) {
        tab = tab || 'upcoming';
        app.innerHTML = `<div class="section-wrap-sm">
            <div class="cv">
                <div class="cblol-hero">
                    <div class="cblol-hero-bg"></div>
                    <div class="cblol-hero-content">
                        <div class="cblol-badge">CAMPEONATO BRASILEIRO</div>
                        <h1 class="cblol-title">CBLOL <span>2025</span></h1>
                        <p class="cblol-sub">Acompanhe partidas, fa&ccedil;a palpites e dispute com o squad</p>
                    </div>
                </div>
                <div class="cblol-tabs">${cblolTabs.map(t => `<button class="cblol-tab ${t.k===tab?'on':''}" data-t="${t.k}"><span class="cblol-tab-ic">${t.ic}</span>${t.l}</button>`).join('')}</div>
                <div id="cc">
                    <div class="skel-cblol-match skel-pulse"></div>
                    <div class="skel-cblol-match skel-pulse"></div>
                    <div class="skel-cblol-match skel-pulse"></div>
                </div>
            </div>
        </div>`;

        document.querySelectorAll('.cblol-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.cblol-tab').forEach(b => b.classList.remove('on'));
                btn.classList.add('on');
                const t = btn.dataset.t;
                if (t==='upcoming') { clearLive(); loadSchedule('upcoming'); }
                else if (t==='running') loadLive();
                else if (t==='closed') { clearLive(); loadSchedule('closed'); }
                else { clearLive(); loadRanking(); }
            });
        });

        if (tab==='running') loadLive();
        else if (tab==='closed') { clearLive(); loadSchedule('closed'); }
        else if (tab==='ranking') { clearLive(); loadRanking(); }
        else { clearLive(); loadSchedule('upcoming'); }
    }

    async function loadSchedule(type) {
        clearLive();
        const cc = $('cc');
        cc.innerHTML = '<div class="ld"><div class="sp"></div></div>';
        const isClosed = type === 'closed';
        try {
            let events=[], pageToken='', first=true;
            do {
                let u = `https://esports-api.lolesports.com/persisted/gw/getSchedule?hl=pt-BR&leagueId=${CBLOL_ID}`;
                if (pageToken) u += `&pageToken=${encodeURIComponent(pageToken)}`;
                const data = await esp(u);
                if (!data?.data?.schedule) break;
                events.push(...(data.data.schedule.events||[]));
                pageToken = data.data.schedule.pages?.older||'';
                first = false;
            } while (pageToken && (isClosed ? events.length<100 : false));

            events = events.filter(e => isClosed?(e.state==='completed'):(e.state==='unstarted'));
            // For upcoming: sort chronologically (nearest first), filter out TBD-only games
            if (!isClosed) {
                events = events.filter(e => {
                    const ts = e.match?.teams || [];
                    return ts.length >= 2 && !(ts[0].code === 'TBD' && ts[1].code === 'TBD');
                });
                events.sort((a,b) => new Date(a.startTime) - new Date(b.startTime));
            } else {
                // For closed: most recent first
                events.sort((a,b) => new Date(b.startTime) - new Date(a.startTime));
            }
            if (!events.length) { cc.innerHTML='<div class="err"><p>Nenhuma partida encontrada</p></div>'; return; }

            let html = '<div class="cblol-match-list">';
            for (const ev of events) {
                const m=ev.match||{}, ts=m.teams||[];
                if (ts.length<2) continue;
                const tA=ts[0], tB=ts[1];
                const cA=tA.code||tA.name||'A', cB=tB.code||tB.name||'B';
                const rA=tA.result||{}, rB=tB.result||{};
                const sA=rA.gameWins||0, sB=rB.gameWins||0;
                const wA=rA.outcome==='win', wB=rB.outcome==='win';
                const winner=wA?tA:wB?tB:null;
                const mid=ev.id||m.id||ev.slug||'';
                const dt=ev.startTime?new Date(ev.startTime):null;
                const bn=ev.blockName||'';
                const dateStr = dt ? dt.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'}) : '';
                const timeStr = dt ? dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '';

                if (isClosed) {
                    const ac={winnerCode:winner?(winner.code||winner.name):'',a:sA,b:sB};
                    html += `<div class="cblol-card ${wA||wB?'finished':''}">
                        <div class="cblol-card-header">
                            <span class="cblol-card-date">${dateStr} &bull; ${timeStr}</span>
                            <span class="cblol-card-block">${bn}</span>
                            <span class="cblol-card-badge done">Finalizada</span>
                        </div>
                        <div class="cblol-card-teams">
                            <div class="cblol-team ${wA?'winner':''}">
                                <img src="${tA.image||''}" alt="${cA}">
                                <span class="cblol-team-name">${cA}</span>
                                <span class="cblol-team-score ${wA?'w':''}">${sA}</span>
                            </div>
                            <div class="cblol-vs-divider"><span>VS</span></div>
                            <div class="cblol-team ${wB?'winner':''}">
                                <span class="cblol-team-score ${wB?'w':''}">${sB}</span>
                                <span class="cblol-team-name">${cB}</span>
                                <img src="${tB.image||''}" alt="${cB}">
                            </div>
                        </div>
                        ${predResult(mid,{code:cA},{code:cB},{winnerCode:winner?(winner.code||winner.name):'',a:sA,b:sB})}
                    </div>`;
                } else {
                    const bo=m.strategy?.count||1;
                    const maxW=Math.ceil(bo/2);
                    const sp=getPred(mid);
                    const locked = isPredictionLocked(ev.startTime);
                    html += `<div class="cblol-card upcoming">
                        <div class="cblol-card-header">
                            <span class="cblol-card-date">${dateStr} &bull; ${timeStr}</span>
                            <span class="cblol-card-block">${bn}</span>
                            <span class="cblol-card-badge next">MD${bo}</span>
                        </div>
                        <div class="cblol-card-teams">
                            <div class="cblol-team">
                                <img src="${tA.image||''}" alt="${cA}">
                                <span class="cblol-team-name">${cA}</span>
                            </div>
                            <div class="cblol-vs-divider"><span>VS</span></div>
                            <div class="cblol-team">
                                <span class="cblol-team-name">${cB}</span>
                                <img src="${tB.image||''}" alt="${cB}">
                            </div>
                        </div>
                        ${locked ? `<div class="cblol-pred-locked">
                            <span style="color:#ffd740;">🔒 Palpites encerrados</span>
                            ${sp ? `<div class="cblol-pred-saved">Seu palpite: <b>${sp.winner}</b>${sp.scoreA!=null?' &mdash; '+sp.scoreA+'x'+sp.scoreB:''}</div>` : '<span style="color:var(--dim);font-size:.8em;">Você não fez palpite</span>'}
                        </div>` : `<div class="cblol-pred-form">
                            <div class="cblol-pred-row">
                                <div class="cblol-pred-field">
                                    <label>Vencedor <span class="pts-tag">+10 pts</span></label>
                                    <select id="pw-${mid}"><option value="${cA}" ${sp?.winner===cA?'selected':''}>${cA}</option><option value="${cB}" ${sp?.winner===cB?'selected':''}>${cB}</option></select>
                                </div>
                                <div class="cblol-pred-field">
                                    <label>Placar ${bo>1?'(MD'+bo+')':''} <span class="pts-tag">+25 pts</span></label>
                                    <div class="cblol-score-input">
                                        <span class="score-label">${cA}</span>
                                        <select id="psa-${mid}">${Array.from({length:maxW+1},(_,i)=>`<option value="${i}" ${sp?.scoreA===i?'selected':''}>${i}</option>`).join('')}</select>
                                        <span class="score-sep">&times;</span>
                                        <select id="psb-${mid}">${Array.from({length:maxW+1},(_,i)=>`<option value="${i}" ${sp?.scoreB===i?'selected':''}>${i}</option>`).join('')}</select>
                                        <span class="score-label">${cB}</span>
                                    </div>
                                </div>
                                <button class="cblol-pred-btn" onclick="savePred('${mid}')">Salvar Palpite</button>
                            </div>
                            ${sp?`<div class="cblol-pred-saved">Palpite salvo: <b>${sp.winner}</b>${sp.scoreA!=null?' &mdash; '+sp.scoreA+'x'+sp.scoreB:''}</div>`:''}
                        </div>`}
                    </div>`;
                }
            }
            html += '</div>';
            cc.innerHTML = html || '<div class="err"><p>Nenhuma partida encontrada.</p></div>';
        } catch(e) {
            cc.innerHTML = `<div class="err"><p>Erro: ${e.message}</p><button onclick="loadSchedule('${type}')" style="margin-top:12px;padding:10px 22px;border-radius:8px;background:var(--pri);color:var(--bg);font-weight:600;border:none;cursor:pointer;">Tentar novamente</button></div>`;
        }
    }

    // ======================== PREDICTIONS (Firebase + localStorage fallback) ========================
    // Local cache of predictions loaded from Firebase
    const _predCache = {};

    function predLocalKey(mid, userIdx) {
        if (userIdx !== undefined && userIdx !== null) return `pred_${userIdx}_${mid}`;
        const user = getLoggedUser();
        return user ? `pred_${user.idx}_${mid}` : `pred_${mid}`;
    }

    function getPred(mid, userIdx) {
        // Check memory cache first (populated by Firebase listener)
        const ui = (userIdx !== undefined && userIdx !== null) ? userIdx : getLoggedUser()?.idx;
        if (ui !== undefined && _predCache[mid]?.[ui]) return _predCache[mid][ui];
        // Fallback to localStorage
        try { return JSON.parse(localStorage.getItem(predLocalKey(mid, userIdx))||'null'); } catch(_) { return null; }
    }

    function getPredForUser(mid, userIdx) {
        return getPred(mid, userIdx);
    }

    // Fetch all predictions for a match from Firebase (for ranking)
    async function getAllPredictions() {
        if (!db) {
            // Fallback: read from localStorage for all players
            const all = {};
            for (let i = 0; i < PLAYERS.length; i++) {
                for (let j = 0; j < localStorage.length; j++) {
                    const k = localStorage.key(j);
                    if (k && k.startsWith(`pred_${i}_`)) {
                        const mid = k.replace(`pred_${i}_`, '');
                        if (!all[mid]) all[mid] = {};
                        try { all[mid][i] = JSON.parse(localStorage.getItem(k)); } catch(_) {}
                    }
                }
            }
            return all;
        }
        try {
            const snap = await db.ref('predictions').once('value');
            const data = snap.val() || {};
            // data shape: { matchId: { userIdx: predObj } }
            // Merge into local cache
            for (const [mid, users] of Object.entries(data)) {
                _predCache[mid] = users;
            }
            return data;
        } catch(e) {
            console.warn('Firebase predictions read error:', e.message);
            return {};
        }
    }

    window.savePred = function(mid) {
        const user = getLoggedUser();
        if (!user) { showLoginModal(); return; }
        const w=$(`pw-${mid}`), sa=$(`psa-${mid}`), sb=$(`psb-${mid}`);
        if (!w) return;
        const pred = {winner:w.value, scoreA:sa?+sa.value:null, scoreB:sb?+sb.value:null, time:Date.now()};

        // Save to localStorage (always, as backup)
        localStorage.setItem(predLocalKey(mid), JSON.stringify(pred));

        // Save to Firebase
        if (db) {
            const safeMid = mid.replace(/[.#$/\[\]]/g, '_');
            db.ref(`predictions/${safeMid}/${user.idx}`).set(pred)
                .catch(e => console.warn('Firebase pred save error:', e.message));
        }

        // Update local cache
        if (!_predCache[mid]) _predCache[mid] = {};
        _predCache[mid][user.idx] = pred;

        const btn=document.querySelector(`[onclick="savePred('${mid}')"]`);
        if (btn) { btn.textContent='Salvo!'; setTimeout(()=>btn.textContent='Salvar Palpite',1500); }
    };

    function predResult(mid, tA, tB, ac) {
        const sp=getPred(mid); if (!sp) return '<div class="pr pd">Sem palpite</div>';
        const gw=sp.winner===ac.winnerCode;
        const gs=sp.scoreA!=null&&sp.scoreB!=null&&sp.scoreA===ac.a&&sp.scoreB===ac.b;
        if (gs) return `<div class="pr ex">✓ PERFEITO! +35 pts · ${sp.scoreA}—${sp.scoreB}</div>`;
        if (gw) return `<div class="pr ok">✓ Acertou o vencedor! (+10 pts)</div>`;
        return `<div class="pr no">✗ Errou! Palpite: ${sp.winner}</div>`;
    }

    // ======================== CBLOL LIVE (sub-aba) ========================
    async function loadLive() {
        const cc = $('cc');
        cc.innerHTML = '<div class="ld"><div class="sp"></div></div>';
        try {
            const data = await esp('https://esports-api.lolesports.com/persisted/gw/getLive?hl=pt-BR');
            const evs  = data?.data?.schedule?.events || [];
            if (!evs.length) {
                cc.innerHTML = '<div class="err"><p style="font-size:1.2em;margin-bottom:8px;">Nenhum jogo ao vivo</p><button onclick="loadLive()" style="margin-top:8px;padding:10px 22px;border-radius:8px;background:var(--pri);color:var(--bg);font-weight:600;border:none;cursor:pointer;">Verificar</button></div>';
                return;
            }
            evs.sort((a,b) => (a.league?.id===CBLOL_ID?0:1)-(b.league?.id===CBLOL_ID?0:1));
            let html = '';
            for (const ev of evs) {
                const m=ev.match||{}, ts=m.teams||[];
                if (ts.length<2) continue;
                const gid=ev.id||m.id||'';
                html += `<div class="lg" id="lg-${gid}" data-gid="${gid}" data-ts="${ev.startTime||''}">
                    <div class="lgh"><span class="ldot"></span> AO VIVO${ev.league?.name?' · '+ev.league.name:''}</div>
                    <div class="ldet" onclick="togLive('${gid}','${ev.startTime||''}')">
                        <div class="lgp"><div class="lgt"><img src="${ts[0].image||''}"><div class="ln">${ts[0].code}</div></div><div class="lvs">vs</div><div class="lgt"><img src="${ts[1].image||''}"><div class="ln">${ts[1].code}</div></div></div>
                        <div class="lrs"><span class="lrw">${ts[0].result?.gameWins||0}</span><span>&mdash;</span><span class="lrw">${ts[1].result?.gameWins||0}</span></div>
                        <div style="text-align:center;font-size:.7em;color:var(--dim);margin-top:4px;">▼ Ver detalhes</div>
                    </div>
                    <div id="lp-${gid}" class="ldp" style="display:none;"></div>
                </div>`;
            }
            cc.innerHTML = html;
            liveTimer = setInterval(refreshInline, 2000);
        } catch(e) {
            cc.innerHTML = `<div class="err"><p>Erro: ${e.message}</p><button onclick="loadLive()" style="margin-top:12px;padding:10px 22px;border-radius:8px;background:var(--pri);color:var(--bg);font-weight:600;border:none;cursor:pointer;">Tentar novamente</button></div>`;
        }
    }

    window.togLive = async (gid, ts) => {
        const p = $(`lp-${gid}`);
        if (!p) return;
        if (p.style.display !== 'none') { p.style.display='none'; return; }
        p.style.display = 'block';
        p.innerHTML = '<div class="ld"><div class="sp"></div></div>';
        await fetchInline(gid, ts, p);
        const label = document.querySelector(`[data-gid="${gid}"] .ldet div:last-child`);
        if (label) label.textContent = '▲ Recolher';
    };

    async function refreshInline() {
        document.querySelectorAll('.ldp[style*="block"]').forEach(p => {
            const lg = p.closest('.lg');
            if (lg) fetchInline(lg.dataset.gid, lg.dataset.ts, p);
        });
    }

    // Cache gwid per event to avoid repeated getEventDetails calls
    const gwidCache = {};
    async function fetchInline(gid, ts, p) {
        if (!p) p = $(`lp-${gid}`); if (!p) return;
        try {
            // Resolve correct game window ID (cached)
            if (!gwidCache[gid]) {
                gwidCache[gid] = bigAdd(gid, 1);
                try {
                    const evResp = await esp(`https://esports-api.lolesports.com/persisted/gw/getEventDetails?hl=pt-BR&id=${gid}`);
                    const evData = evResp?.data?.event;
                    const games = evData?.match?.games || [];
                    for (const g of games) {
                        if (g.state === 'inProgress') { gwidCache[gid] = bigAdd(gid, g.number); break; }
                    }
                    // Store team info for buildLiveFrame
                    gwidCache[gid+'_t1'] = evData?.match?.teams?.[0] || {};
                    gwidCache[gid+'_t2'] = evData?.match?.teams?.[1] || {};
                } catch(_) {}
            }
            const gwid = gwidCache[gid];
            const ct1 = gwidCache[gid+'_t1'] || {};
            const ct2 = gwidCache[gid+'_t2'] || {};
            const date = isoRound10();
            const [wd, dd] = await Promise.all([
                live(`/window/${gwid}`, { hl:'pt-BR', startingTime:date }),
                live(`/details/${gwid}`, { hl:'pt-BR', startingTime:date })
            ]);
            if (!wd) { p.innerHTML='<div class="err"><p>Dados indispon&iacute;veis</p></div>'; return; }
            const frW=wd.frames||[], frD=dd?.frames||[];
            if (!frW.length) { p.innerHTML='<div class="err"><p>Aguardando dados…</p></div>'; return; }
            const lf=frW[frW.length-1];
            const df=frD.length?frD[frD.length-1]:null;
            const gm=wd.gameMetadata||{};
            // Use the same full buildLiveFrame as the standalone page
            p.innerHTML = buildLiveFrame(lf, df, gm, ct1, ct2, gwid, frW);
        } catch(e) { p.innerHTML=`<div class="err"><p>Erro: ${e.message}</p></div>`; }
    }

    // inlineObjs and inlinePlayers removed — CBLOL sub-tab now uses buildLiveFrame

    // ======================== RANKING (Firebase-synced) ========================
    async function loadRanking() {
        const cc = $('cc');
        const sc = PLAYERS.map((p,i) => ({name:p.name,pts:0,ex:0,wn:0,wr:0,tot:0,idx:i}));

        // Load all predictions from Firebase (or localStorage fallback)
        const allPreds = await getAllPredictions();

        try {
            let evs=[], pageToken='';
            do {
                let u=`https://esports-api.lolesports.com/persisted/gw/getSchedule?hl=pt-BR&leagueId=${CBLOL_ID}`;
                if (pageToken) u+=`&pageToken=${encodeURIComponent(pageToken)}`;
                const data=await esps(u);
                if (!data?.data?.schedule) break;
                evs.push(...(data.data.schedule.events||[]).filter(e=>e.state==='completed'));
                pageToken=data.data.schedule.pages?.older||'';
            } while (pageToken && evs.length<200);

            for (const ev of evs) {
                const mid=ev.id||ev.match?.id||ev.slug||'';
                const safeMid = mid.replace(/[.#$/\[\]]/g, '_');
                const ts=ev.match?.teams||[]; if (ts.length<2) continue;
                const w=(ts[0].result?.outcome==='win')?ts[0]:(ts[1].result?.outcome==='win')?ts[1]:null;
                if (!w) continue;
                const wc=w.code||w.name;
                const sa=ts[0].result?.gameWins||0, sb=ts[1].result?.gameWins||0;
                // Check predictions from Firebase data or fallback
                const matchPreds = allPreds[safeMid] || allPreds[mid] || {};
                for (const s of sc) {
                    const sp = matchPreds[s.idx] || getPredForUser(mid, s.idx);
                    if (!sp) continue;
                    s.tot++;
                    const gw=sp.winner===wc, gs=sp.scoreA!=null&&sp.scoreB!=null&&sp.scoreA===sa&&sp.scoreB===sb;
                    if (gs) { s.pts+=35; s.ex++; }
                    else if (gw) { s.pts+=10; s.wn++; }
                    else s.wr++;
                }
            }
        } catch(_) {}

        const rk=[...sc].sort((a,b) => b.pts-a.pts||a.name.localeCompare(b.name));
        // Save ranking snapshot for history
        saveRankingSnapshot(rk);
        const podium = rk.slice(0,3);
        const rest = rk.slice(3);
        const syncStatus = db ? '<span style="color:#4caf50;">Online</span>' : '<span style="color:#ffd740;">Local</span>';
        cc.innerHTML = `
            <div class="rank-header">
                <h3>Ranking de Palpites</h3>
                <div class="rank-legend">
                    <span><span class="rank-dot exact"></span> Exato +35</span>
                    <span><span class="rank-dot win"></span> Vencedor +10</span>
                    <span style="font-size:.7em;opacity:.7;">${syncStatus}</span>
                </div>
            </div>
            ${podium.length ? `<div class="podium">
                ${podium.map((s,i) => {
                    const medals = ['gold','silver','bronze'];
                    const pos = ['1&ordm;','2&ordm;','3&ordm;'];
                    return `<div class="podium-card ${medals[i]}" onclick="location.hash='profile/${s.idx}'">
                        <div class="podium-pos">${pos[i]}</div>
                        <div class="podium-name">${s.name}</div>
                        <div class="podium-pts">${s.pts} <small>pts</small></div>
                        <div class="podium-stats">
                            <span title="Exatos" style="color:#4caf50;">${s.ex}P</span>
                            <span title="Vencedores" style="color:#ffd740;">${s.wn}V</span>
                            <span title="Erros" style="color:#ef5350;">${Math.max(0,s.wr)}E</span>
                        </div>
                    </div>`;
                }).join('')}
            </div>` : ''}
            ${rest.length ? `<div class="rank-rest">
                ${rest.map((s,i) => `<div class="rank-row" onclick="location.hash='profile/${s.idx}'">
                    <span class="rank-pos">${i+4}</span>
                    <span class="rank-name">${s.name}</span>
                    <span class="rank-stat" style="color:#4caf50;">${s.ex}P</span>
                    <span class="rank-stat" style="color:#ffd740;">${s.wn}V</span>
                    <span class="rank-stat" style="color:#ef5350;">${Math.max(0,s.wr)}E</span>
                    <span class="rank-pts">${s.pts} pts</span>
                </div>`).join('')}
            </div>` : ''}
            <p style="margin-top:16px;font-size:.75em;color:var(--dim);text-align:center;">Clique no jogador para ver o perfil</p>`;
    }

    // ======================== LIVE PAGE (standalone) ========================
    function renderLivePage(h) {
        const gameId = h.startsWith('live/') ? h.split('/')[1] : null;
        clearLive();
        if (liveDetailTimer) { clearInterval(liveDetailTimer); liveDetailTimer = null; }

        if (!gameId) {
            app.innerHTML = `<div class="section-wrap">
                <div class="live-page-hero">
                    <span class="ldot"></span>
                    <h1>Jogos <span>Ao Vivo</span></h1>
                    <p>Selecione um jogo para acompanhar em tempo real</p>
                </div>
                <div class="live-grid" id="live-grid"><div class="ld"><div class="sp"></div></div></div>
                <div id="live-today-wrap" style="display:none;">
                    <div class="live-today-title">JOGOS DO DIA</div>
                    <div class="live-today-grid" id="live-today-grid"></div>
                </div>
            </div>`;
            loadLiveCardList();
        } else {
            app.innerHTML = `<div class="section-wrap-sm">
                <button class="bb" onclick="location.hash='live'">&larr; Jogos ao vivo</button>
                <div id="live-detail"><div class="ld"><div class="sp"></div></div></div>
            </div>`;
            loadLiveGameDetail(gameId);
        }
    }

    async function loadLiveCardList() {
        try {
            const [liveData, scheduleData] = await Promise.all([
                esp('https://esports-api.lolesports.com/persisted/gw/getLive?hl=pt-BR'),
                esp('https://esports-api.lolesports.com/persisted/gw/getSchedule?hl=pt-BR')
            ]);
            const liveEvents = (liveData?.data?.schedule?.events||[]).filter(e => e.match);
            const today = new Date().toISOString().split('T')[0];
            const todayEvents = (scheduleData?.data?.schedule?.events||[]).filter(e => e.match && e.startTime?.startsWith(today));
            const grid = $('live-grid');

            if (liveEvents.length) {
                grid.innerHTML = `<div class="live-grid-inner">${liveEvents.map(g => {
                    const t1=g.match?.teams?.[0], t2=g.match?.teams?.[1];
                    return `<div class="live-game-card" onclick="location.hash='live/${g.id}'">
                        <div class="lgc-league"><span class="ldot"></span> ${g.league?.name||''}</div>
                        <div class="live-card-body">
                            <div class="live-card-team"><img src="${t1?.image||''}"><span>${t1?.code||t1?.name||'?'}</span></div>
                            <div class="live-card-vs">
                                <div class="live-score">${t1?.result?.gameWins||0} — ${t2?.result?.gameWins||0}</div>
                                <div style="font-size:.7em;color:var(--dim);margin-top:4px;">Ver detalhes</div>
                            </div>
                            <div class="live-card-team"><img src="${t2?.image||''}"><span>${t2?.code||t2?.name||'?'}</span></div>
                        </div>
                    </div>`;
                }).join('')}</div>`;
            } else {
                grid.innerHTML = `<div class="live-empty"><p style="color:var(--dim);text-align:center;padding:4rem 0;font-size:1.1em;">Nenhum jogo ao vivo no momento</p></div>`;
            }

            if (todayEvents.length) {
                const wrap = $('live-today-wrap');
                const tg   = $('live-today-grid');
                if (wrap) wrap.style.display = 'block';
                if (tg) tg.innerHTML = todayEvents.map(g => {
                    const t1=g.match?.teams?.[0], t2=g.match?.teams?.[1];
                    const dt=new Date(g.startTime);
                    return `<div class="live-game-card today">
                        <div class="lgc-league">${g.league?.name||''} · ${dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div>
                        <div class="live-card-body">
                            <div class="live-card-team"><img src="${t1?.image||''}"><span>${t1?.code||t1?.name||'?'}</span></div>
                            <div class="live-card-vs"><span style="font-size:1em;font-weight:700;color:var(--dim);">VS</span></div>
                            <div class="live-card-team"><img src="${t2?.image||''}"><span>${t2?.code||t2?.name||'?'}</span></div>
                        </div>
                    </div>`;
                }).join('');
            }
        } catch(e) {
            $('live-grid').innerHTML = `<div class="err"><p>Erro: ${e.message}</p><button onclick="loadLiveCardList()" style="margin-top:8px;padding:10px 22px;border-radius:8px;background:var(--pri);color:var(--bg);font-weight:600;border:none;cursor:pointer;">Tentar novamente</button></div>`;
        }
    }

    async function loadLiveGameDetail(gid) {
        try {
            const detailsResp = await esp(`https://esports-api.lolesports.com/persisted/gw/getEventDetails?hl=pt-BR&id=${gid}`);
            const eventData   = detailsResp?.data?.event;
            const games       = eventData?.match?.games || [];
            let gameWindowId  = bigAdd(gid, 1);
            let activeGameNum = 1;

            // Find in-progress game first, then latest completed
            for (const game of games) {
                if (game.state === 'inProgress') {
                    gameWindowId = bigAdd(gid, game.number);
                    activeGameNum = game.number;
                    break;
                }
            }
            if (activeGameNum === 1 && games.length) {
                // No in-progress: pick the latest completed or unstarted
                for (let i = games.length - 1; i >= 0; i--) {
                    if (games[i].state === 'completed') {
                        gameWindowId = bigAdd(gid, games[i].number);
                        activeGameNum = games[i].number;
                        break;
                    }
                }
            }

            const teams = eventData?.match?.teams || [];
            const t1 = teams[0]||{}, t2 = teams[1]||{};
            const ln = eventData?.league?.name||'', li = eventData?.league?.image||'';
            const wins1 = t1?.result?.gameWins||0, wins2 = t2?.result?.gameWins||0;
            const bo = eventData?.match?.strategy?.count || 1;

            // Game selector tabs for BO3/BO5
            let gameTabs = '';
            if (games.length > 1) {
                gameTabs = `<div class="game-tabs" id="game-tabs">${games.map(g => {
                    const active = g.number === activeGameNum;
                    const stateIcon = g.state === 'inProgress' ? '<span class="ldot" style="width:6px;height:6px;"></span> ' :
                                      g.state === 'completed' ? '' : '';
                    const stateClass = g.state === 'inProgress' ? 'live' : g.state === 'completed' ? 'done' : 'pending';
                    return `<button class="game-tab ${active?'on':''} ${stateClass}" data-gnum="${g.number}" onclick="switchGame('${gid}',${g.number})">${stateIcon}Jogo ${g.number}</button>`;
                }).join('')}</div>`;
            }

            $('live-detail').innerHTML = `
                <div class="live-detail-header">
                    <div class="live-detail-league">
                        ${li?`<img src="${li}" class="live-league-icon" alt="${ln}"> `:''}
                        <span>${ln}</span>
                        ${bo > 1 ? `<span class="live-bo-badge">MD${bo}</span>` : ''}
                    </div>
                    <div class="live-detail-matchup">
                        <div class="live-detail-team">
                            <img src="${t1.image||''}" alt="${t1.code||''}">
                            <span>${t1.code||t1.name||'?'}</span>
                        </div>
                        <div class="live-detail-vs">
                            <div class="live-detail-score">${wins1} — ${wins2}</div>
                            <span class="ldot"></span>
                        </div>
                        <div class="live-detail-team">
                            <img src="${t2.image||''}" alt="${t2.code||''}">
                            <span>${t2.code||t2.name||'?'}</span>
                        </div>
                    </div>
                </div>
                ${gameTabs}
                <div id="live-frame" class="live-frame"><div class="ld"><div class="sp"></div></div></div>`;

            // Expose game switching
            window.switchGame = (eid, num) => {
                gameWindowId = bigAdd(eid, num);
                document.querySelectorAll('.game-tab').forEach(b => b.classList.remove('on'));
                const active = document.querySelector(`.game-tab[data-gnum="${num}"]`);
                if (active) active.classList.add('on');
                $('live-frame').innerHTML = '<div class="ld"><div class="sp"></div></div>';
                fetchFrame();
            };

            const fetchFrame = async () => {
                try {
                    const date = isoRound10();
                    const [wd, dd] = await Promise.all([
                        live(`/window/${gameWindowId}`, {hl:'pt-BR',startingTime:date}),
                        live(`/details/${gameWindowId}`, {hl:'pt-BR',startingTime:date})
                    ]);
                    if (!wd) { $('live-frame').innerHTML='<div class="err"><p>Dados indispon&iacute;veis para este jogo</p></div>'; return; }
                    const frW = wd?.frames||[];
                    if (!frW.length) { $('live-frame').innerHTML='<div class="err"><p>Aguardando dados do jogo…</p></div>'; return; }
                    const lf = frW[frW.length-1];
                    const df = dd?.frames?.length ? dd.frames[dd.frames.length-1] : null;
                    const gm = wd.gameMetadata||{};
                    $('live-frame').innerHTML = buildLiveFrame(lf, df, gm, t1, t2, gameWindowId, frW);
                } catch(_) { /* retry silently */ }
            };
            await fetchFrame();
            if (liveDetailTimer) clearInterval(liveDetailTimer);
            liveDetailTimer = setInterval(fetchFrame, 2000);
        } catch(e) {
            $('live-detail').innerHTML = `<div class="err"><p>Erro ao carregar: ${e.message}</p>
                <button onclick="loadLiveGameDetail('${gid}')" style="margin-top:12px;padding:10px 22px;border-radius:8px;background:var(--pri);color:var(--bg);font-weight:600;border:none;cursor:pointer;">Tentar novamente</button></div>`;
        }
    }

    // Track earliest frame timestamp per game window id for elapsed time calculation
    const _gameStartTs = {};

    function buildLiveFrame(lf, df, gm, t1, t2, gwid, allFrames) {
        const bt = lf.blueTeam  || {participants:[],totalGold:0,totalKills:0,towers:0,barons:0,inhibitors:0,dragons:[]};
        const rt = lf.redTeam   || {participants:[],totalGold:0,totalKills:0,towers:0,barons:0,inhibitors:0,dragons:[]};
        const bMeta = gm.blueTeamMetadata || {};
        const rMeta = gm.redTeamMetadata  || {};
        const dParts = df?.participants || [];
        const gs = lf.gameState||'in_game';
        // gameTime not in API — calculate elapsed from earliest seen frame
        let gt = 0;
        if (gwid && allFrames?.length) {
            const firstTs = allFrames[0].rfc460Timestamp;
            if (firstTs) {
                const t = new Date(firstTs).getTime();
                if (!_gameStartTs[gwid] || t < _gameStartTs[gwid]) _gameStartTs[gwid] = t;
            }
            if (_gameStartTs[gwid] && lf.rfc460Timestamp) {
                gt = Math.max(0, Math.round((new Date(lf.rfc460Timestamp).getTime() - _gameStartTs[gwid]) / 1000));
            }
        }

        const goldTotal = (bt.totalGold||0) + (rt.totalGold||0);
        const gbPct = goldTotal ? Math.round((bt.totalGold / goldTotal) * 100) : 50;
        const goldDiff = (bt.totalGold||0) - (rt.totalGold||0);
        const goldDiffStr = goldDiff > 0 ? `+${fmtGold(goldDiff)} Azul` : goldDiff < 0 ? `+${fmtGold(-goldDiff)} Verm.` : 'Empate';

        // ---- team stats bar (objectives) ----
        function objRow(labelB, icon, labelR) {
            return `<div class="obj-row"><span class="obj-val ob">${labelB}</span><span class="obj-icon">${icon}</span><span class="obj-val or2">${labelR}</span></div>`;
        }

        // ---- dragons ----
        const bDrg = (bt.dragons||[]).map(d => `<span class="drg-icon" title="${d}">${drgEmoji(d)}</span>`).join('');
        const rDrg = (rt.dragons||[]).map(d => `<span class="drg-icon" title="${d}">${drgEmoji(d)}</span>`).join('');

        // ---- helper: extract player data ----
        function getPlayerData(p, side) {
            const mi     = side==='b' ? (p.participantId-1) : (p.participantId-6);
            const meta   = side==='b' ? bMeta : rMeta;
            const pmeta  = meta?.participantMetadata?.[mi] || {};
            const champId= pmeta.championId || '?';
            const sName  = pmeta.summonerName || '';
            const role   = pmeta.role || '';
            const di   = p.participantId - 1;
            const dp   = dParts[di] || {};
            const items= dp.items || [];
            const k=p.kills||0, d2=p.deaths||0, a=p.assists||0, cs=p.creepScore||0, lv=p.level||1;
            const curHp  = p.currentHealth||0, maxHp = p.maxHealth||1;
            const hp     = maxHp>0 ? Math.round((curHp/maxHp)*100) : 100;
            const hpClr  = hp>60?'#4caf50':hp>30?'#ff9800':'#ef5350';
            const gold   = p.totalGold||0;
            const trinkets = [3340, 3363, 3364, 3513, 2055];
            const mainItems = items.filter(id => id && !trinkets.includes(id));
            const trinket   = items.find(id => id && trinkets.includes(id));
            const slots = [...mainItems.slice(0,6)]; while (slots.length < 6) slots.push(0); slots.push(trinket || 0);
            return { champId, sName, role, k, d2, a, cs, lv, hp, hpClr, gold, slots, items };
        }

        // ---- matchup row (blue vs red side by side) ----
        function matchupRow(bp, rp, roleLabel) {
            const b = getPlayerData(bp, 'b');
            const r = getPlayerData(rp, 'r');
            const gd = b.gold - r.gold;
            const gdStr = gd > 0 ? `<span class="gpos">+${fmtGold(gd)}</span>` : gd < 0 ? `<span class="gneg">${fmtGold(gd)}</span>` : '-';
            const roleIcons = {top:'🗡️',jungle:'🌿',mid:'⚡',bottom:'🏹',support:'🛡️'};
            const roleIcon = roleIcons[roleLabel?.toLowerCase()] || '⚔️';
            const roleShort = {top:'TOP',jungle:'JNG',mid:'MID',bottom:'ADC',support:'SUP'}[roleLabel?.toLowerCase()] || roleLabel || '';

            function itemsHtml(slots) {
                return slots.map(id => id ? `<img src="${itemImg(id)}" alt="" loading="lazy" onerror="this.style.display='none'">` : `<span class="li-empty"></span>`).join('');
            }

            return `<div class="lmr-row">
                <div class="lmr-side lmr-blue">
                    <div class="lmr-champ">
                        <img src="${champImg(b.champId)}" class="lmr-champ-img lmr-img-blue" onerror="this.style.opacity='0.3'">
                        <div class="lmr-player-info">
                            <div class="lmr-name">${b.sName}</div>
                            <div class="lmr-champ-name">${b.champId} <span class="lmr-lv">Lv.${b.lv}</span></div>
                        </div>
                    </div>
                    <div class="lmr-stats">
                        <span class="lmr-kda"><span class="lmr-k">${b.k}</span>/<span class="lmr-d">${b.d2}</span>/<span class="lmr-a">${b.a}</span></span>
                        <span class="lmr-cs">${b.cs} CS</span>
                        <span class="lmr-gold">${fmtGold(b.gold)}</span>
                    </div>
                    <div class="lmr-hp"><div class="lmr-hp-fill" style="width:${b.hp}%;background:${b.hpClr};"></div></div>
                    <div class="lmr-items">${itemsHtml(b.slots)}</div>
                </div>
                <div class="lmr-role">
                    <span class="lmr-role-icon">${roleIcon}</span>
                    <span class="lmr-role-label">${roleShort}</span>
                    <span class="lmr-gold-diff">${gdStr}</span>
                </div>
                <div class="lmr-side lmr-red">
                    <div class="lmr-champ lmr-champ-right">
                        <div class="lmr-player-info lmr-info-right">
                            <div class="lmr-name">${r.sName}</div>
                            <div class="lmr-champ-name">${r.champId} <span class="lmr-lv">Lv.${r.lv}</span></div>
                        </div>
                        <img src="${champImg(r.champId)}" class="lmr-champ-img lmr-img-red" onerror="this.style.opacity='0.3'">
                    </div>
                    <div class="lmr-stats lmr-stats-right">
                        <span class="lmr-kda"><span class="lmr-k">${r.k}</span>/<span class="lmr-d">${r.d2}</span>/<span class="lmr-a">${r.a}</span></span>
                        <span class="lmr-cs">${r.cs} CS</span>
                        <span class="lmr-gold">${fmtGold(r.gold)}</span>
                    </div>
                    <div class="lmr-hp"><div class="lmr-hp-fill lmr-hp-red" style="width:${r.hp}%;background:${r.hpClr};"></div></div>
                    <div class="lmr-items lmr-items-right">${itemsHtml(r.slots)}</div>
                </div>
            </div>`;
        }

        const bParts = bt.participants || [];
        const rParts = rt.participants || [];
        // Build matchup rows (paired by position index = role)
        const roleLabels = ['top','jungle','mid','bottom','support'];
        let matchupHtml = '';
        for (let i = 0; i < 5; i++) {
            const bp = bParts[i] || {};
            const rp = rParts[i] || {};
            const bMi = (bp.participantId||1) - 1;
            const rMi = (rp.participantId||6) - 6;
            const role = bMeta?.participantMetadata?.[bMi]?.role || rMeta?.participantMetadata?.[rMi]?.role || roleLabels[i] || '';
            matchupHtml += matchupRow(bp, rp, role);
        }

        const bLabel = t1?.code||'Azul', rLabel = t2?.code||'Vermelho';

        return `
            <div class="live-status ${gs}">
                <span class="ldot"></span>
                ${gt>0 ? fmtTime(gt)+' &mdash; ' : ''}${gs==='in_game'?'AO VIVO':gs==='paused'?'⏸ PAUSADO':'FINALIZADO'}
            </div>

            <div class="live-obj-grid">
                ${objRow(bt.totalKills||0, '⚔️ Kills', rt.totalKills||0)}
                ${objRow(bt.towers||0, '🗼 Torres', rt.towers||0)}
                ${objRow(bt.barons||0, '👾 Bar&otilde;es', rt.barons||0)}
                ${objRow(bt.inhibitors||0, '⛩️ Inibs', rt.inhibitors||0)}
            </div>

            <div class="gold-section">
                <div class="gold-header">
                    <span style="color:var(--pri);font-weight:800;">${fmtGold(bt.totalGold||0)}</span>
                    <span class="gold-diff">${goldDiffStr}</span>
                    <span style="color:var(--acc);font-weight:800;">${fmtGold(rt.totalGold||0)}</span>
                </div>
                <div class="gadvbar">
                    <div class="gadv-b" style="width:${gbPct}%;"></div>
                    <div class="gadv-r" style="width:${100-gbPct}%;"></div>
                </div>
            </div>

            ${bDrg||rDrg ? `<div class="drg-bar">
                <div class="drg-b">${bDrg||'<span class="drg-none">-</span>'}</div>
                <div class="drg-label">Drag&otilde;es</div>
                <div class="drg-r">${rDrg||'<span class="drg-none">-</span>'}</div>
            </div>` : ''}

            <div class="lmr-header">
                <div class="lmr-team-label lmr-label-blue">${t1?.image ? `<img src="${t1.image}" class="lmr-team-logo">` : ''}${bLabel}</div>
                <div class="lmr-vs-label">MATCHUPS</div>
                <div class="lmr-team-label lmr-label-red">${rLabel}${t2?.image ? `<img src="${t2.image}" class="lmr-team-logo">` : ''}</div>
            </div>
            <div class="lmr-matchups">
                ${matchupHtml}
            </div>
        `;
    }

    // ======================== PROFA FM — RÁDIO GAMER (Firebase Storage) ========================
    const RADIO_STATION_META = [
        { name: 'RPG Chill', icon: '🏰', key: 'rpg_chill' },
        { name: 'Aventura', icon: '⚔️', key: 'aventura' },
        { name: 'Batalha', icon: '🔥', key: 'batalha' },
        { name: 'LoL / Arcane', icon: '🎮', key: 'lol_arcane' },
        { name: 'Lo-Fi Gaming', icon: '🎧', key: 'lofi_gaming' },
    ];

    let _radioStations = RADIO_STATION_META.map(s => ({ ...s, tracks: [] }));
    let _radioStation = parseInt(localStorage.getItem('profa_radio_station')||'0');
    let _radioTrack = parseInt(localStorage.getItem('profa_radio_track')||'0');
    let _radioShuffle = localStorage.getItem('profa_radio_shuffle') === '1';
    let musicPlaying = false;
    let _radioLoaded = false;
    let _radioUploading = false;
    const MUSIC_VOL = parseInt(localStorage.getItem('profa_radio_vol')||'50');

    // Firebase Storage ref
    const storage = firebase.storage();

    function currentStation() { return _radioStations[_radioStation] || _radioStations[0]; }
    function currentTrack() { return currentStation().tracks[_radioTrack] || currentStation().tracks[0]; }
    function allTracks() { return currentStation().tracks; }

    // HTML5 Audio player
    const audioPlayer = new Audio();
    audioPlayer.volume = MUSIC_VOL / 100;
    audioPlayer.addEventListener('ended', () => { musicNext(); });
    audioPlayer.addEventListener('play', () => { musicPlaying = true; updateMusicUI(); });
    audioPlayer.addEventListener('pause', () => { musicPlaying = false; updateMusicUI(); });
    audioPlayer.addEventListener('error', () => {
        console.warn('[Radio] Erro ao tocar track, pulando...');
        musicPlaying = false;
        const tracks = allTracks();
        if (tracks.length > 1) setTimeout(musicNext, 1000);
        else updateMusicUI();
    });

    // Load tracks from Firebase DB
    function loadRadioTracks() {
        const radioRef = db.ref('radio');
        radioRef.on('value', snap => {
            const data = snap.val() || {};
            console.log('[Radio] Firebase data:', Object.keys(data), JSON.stringify(data).substring(0, 200));
            _radioStations = RADIO_STATION_META.map(s => {
                const stationData = data[s.key] || {};
                const tracks = [];
                Object.keys(stationData).forEach(k => {
                    const t = stationData[k];
                    if (t && t.title && t.url) {
                        tracks.push({ id: k, title: t.title, url: t.url, fileName: t.fileName || '' });
                    }
                });
                tracks.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
                return { ...s, tracks };
            });
            _radioLoaded = true;
            // Ajustar index se track atual não existe mais
            if (_radioTrack >= allTracks().length) _radioTrack = 0;
            updateMusicUI();
        });
    }
    loadRadioTracks();

    // Create floating radio button
    const musicBtn = document.createElement('div');
    musicBtn.id = 'music-btn';
    musicBtn.className = 'radio-btn';
    musicBtn.innerHTML = `<div class="radio-btn-eq"><span></span><span></span><span></span></div><span class="radio-btn-text" id="music-title">PROFA FM</span>`;
    document.body.appendChild(musicBtn);

    // Radio panel
    const musicPanel = document.createElement('div');
    musicPanel.id = 'music-panel';
    musicPanel.className = 'radio-panel';
    musicPanel.style.display = 'none';
    function buildRadioPanel() {
        const st = currentStation();
        const tr = currentTrack();
        const hasTracks = st.tracks.length > 0;
        musicPanel.innerHTML = `
        <div class="radio-header">
            <div class="radio-brand"><span class="radio-logo">📻</span> PROFA FM</div>
            <button class="radio-close" onclick="toggleMusicPanel()">&#215;</button>
        </div>
        <div class="radio-dial">
            ${_radioStations.map((s, i) => `<button class="radio-station-btn ${i===_radioStation?'active':''}" onclick="switchStation(${i})" title="${s.name}"><span class="radio-st-icon">${s.icon}</span><span class="radio-st-name">${s.name}</span><span class="radio-st-count">${s.tracks.length}</span></button>`).join('')}
        </div>
        <div class="radio-now">
            <div class="radio-now-station">${st.icon} ${st.name}</div>
            <div class="radio-now-track" id="mp-now">${!hasTracks ? 'Sem músicas' : musicPlaying ? tr.title : 'Pausado'}</div>
            <div class="radio-now-eq ${musicPlaying?'playing':''}"><span></span><span></span><span></span><span></span><span></span></div>
        </div>
        <div class="radio-controls">
            <button class="radio-ctrl" onclick="musicPrev()" title="Anterior" ${!hasTracks?'disabled':''}>⏮</button>
            <button class="radio-ctrl radio-play" id="mp-play" onclick="musicToggle()" ${!hasTracks?'disabled':''}>${musicPlaying ? '⏸' : '▶'}</button>
            <button class="radio-ctrl" onclick="musicNext()" title="Próxima" ${!hasTracks?'disabled':''}>⏭</button>
            <button class="radio-ctrl radio-shuffle ${_radioShuffle?'active':''}" onclick="toggleShuffle()" title="Shuffle">🔀</button>
        </div>
        <div class="radio-vol">
            <span class="radio-vol-icon">🔊</span>
            <input type="range" id="mp-vol-slider" min="0" max="100" value="${Math.round(audioPlayer.volume*100)}" oninput="musicVol(this.value)">
            <span class="radio-vol-val" id="radio-vol-val">${Math.round(audioPlayer.volume*100)}</span>
        </div>
        <div class="radio-upload-section">
            <label class="radio-upload-btn" title="Enviar música (.mp3, .ogg, .wav)">
                <input type="file" accept="audio/*" multiple style="display:none" onchange="radioUpload(this.files)" ${_radioUploading?'disabled':''}>
                ${_radioUploading ? '⏳ Enviando...' : '📤 Enviar música'}
            </label>
            <span class="radio-upload-hint">Upload para "${st.name}"</span>
        </div>
        <div class="radio-tracklist" id="mp-list">
            ${!hasTracks ? '<div class="radio-empty">Nenhuma música nesta estação.<br>Use o botão acima para enviar arquivos de áudio.</div>' :
            st.tracks.map((t,i) => `<div class="radio-track ${i===_radioTrack?'on':''}" onclick="musicPlay(${i})"><span class="radio-track-num">${i+1}</span><span class="radio-track-title">${t.title}</span>${i===_radioTrack && musicPlaying?'<span class="radio-track-eq"><span></span><span></span><span></span></span>':''}
            <button class="radio-track-del" onclick="event.stopPropagation();radioDelete('${st.key}','${t.id}','${t.fileName}')" title="Remover">🗑</button></div>`).join('')}
        </div>`;
    }
    buildRadioPanel();
    document.body.appendChild(musicPanel);

    // Upload audio to Firebase Storage + save metadata to DB
    window.radioUpload = async function(files) {
        if (!files || files.length === 0) return;
        _radioUploading = true;
        updateMusicUI();
        const stKey = currentStation().key;
        let uploaded = 0;
        for (const file of files) {
            try {
                console.log('[Radio] Enviando:', file.name, '(' + (file.size/1024/1024).toFixed(1) + 'MB)');
                const safeName = Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                const storageRef = storage.ref('radio/' + stKey + '/' + safeName);
                const snapshot = await storageRef.put(file, { contentType: file.type });
                console.log('[Radio] Upload concluído, obtendo URL...');
                const url = await snapshot.ref.getDownloadURL();
                console.log('[Radio] URL obtida:', url);
                const title = file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
                await db.ref('radio/' + stKey).push({ title, url, fileName: safeName });
                console.log('[Radio] Salvo no DB!');
                uploaded++;
            } catch (e) {
                console.error('[Radio] Upload error:', e);
                if (e.code === 'storage/unauthorized' || e.code === 'storage/unauthenticated') {
                    alert('Erro de permissão no Firebase Storage!\n\nVá no Firebase Console > Storage > Rules e coloque:\n\nrules_version = \'2\';\nservice firebase.storage {\n  match /b/{bucket}/o {\n    match /{allPaths=**} {\n      allow read, write: if true;\n    }\n  }\n}');
                    break;
                } else {
                    alert('Erro ao enviar "' + file.name + '": ' + e.message);
                }
            }
        }
        _radioUploading = false;
        if (uploaded > 0) alert(uploaded + ' música(s) enviada(s) com sucesso!');
        updateMusicUI();
    };

    // Delete track
    window.radioDelete = async function(stKey, trackId, fileName) {
        if (!confirm('Remover esta música?')) return;
        try {
            await db.ref('radio/' + stKey + '/' + trackId).remove();
            if (fileName) {
                try { await storage.ref('radio/' + stKey + '/' + fileName).delete(); } catch(e) {}
            }
        } catch(e) {
            console.error('[Radio] Delete error:', e);
        }
    };

    function updateMusicUI() {
        const tr = currentTrack();
        const titleEl = document.getElementById('music-title');
        const btn = document.getElementById('music-btn');
        if (titleEl) titleEl.textContent = musicPlaying ? (tr?.title || 'PROFA FM') : 'PROFA FM';
        if (btn) btn.classList.toggle('playing', musicPlaying);
        buildRadioPanel();
    }

    window.toggleMusicPanel = function() {
        const p = document.getElementById('music-panel');
        p.style.display = p.style.display === 'none' ? 'flex' : 'none';
    };
    musicBtn.addEventListener('click', toggleMusicPanel);

    window.switchStation = function(idx) {
        _radioStation = idx;
        _radioTrack = 0;
        localStorage.setItem('profa_radio_station', String(idx));
        localStorage.setItem('profa_radio_track', '0');
        audioPlayer.pause();
        musicPlaying = false;
        updateMusicUI();
    };

    window.musicToggle = function() {
        const tracks = allTracks();
        if (!tracks.length) return;
        if (musicPlaying) {
            audioPlayer.pause();
        } else {
            const tr = currentTrack();
            if (tr && tr.url) {
                if (audioPlayer.src !== tr.url) audioPlayer.src = tr.url;
                audioPlayer.play().catch(e => console.warn('[Radio] Play blocked:', e));
            }
        }
    };
    window.musicPlay = function(i) {
        const tracks = allTracks();
        if (!tracks.length) return;
        _radioTrack = i % tracks.length;
        localStorage.setItem('profa_radio_track', String(_radioTrack));
        const tr = currentTrack();
        if (tr && tr.url) {
            audioPlayer.src = tr.url;
            audioPlayer.play().catch(e => console.warn('[Radio] Play blocked:', e));
        }
        updateMusicUI();
    };
    window.musicNext = function() {
        const tracks = allTracks();
        if (!tracks.length) return;
        if (_radioShuffle) {
            musicPlay(Math.floor(Math.random() * tracks.length));
        } else {
            musicPlay((_radioTrack + 1) % tracks.length);
        }
    };
    window.musicPrev = function() {
        const tracks = allTracks();
        if (!tracks.length) return;
        musicPlay((_radioTrack - 1 + tracks.length) % tracks.length);
    };
    window.musicVol = function(v) {
        const vol = parseInt(v);
        audioPlayer.volume = vol / 100;
        localStorage.setItem('profa_radio_vol', String(vol));
        const valEl = document.getElementById('radio-vol-val');
        if (valEl) valEl.textContent = vol;
    };
    window.toggleShuffle = function() {
        _radioShuffle = !_radioShuffle;
        localStorage.setItem('profa_radio_shuffle', _radioShuffle ? '1' : '0');
        updateMusicUI();
    };

    // ======================== THEME TOGGLE ========================
    function applyTheme(t) {
        document.documentElement.setAttribute('data-theme', t);
        localStorage.setItem('profa_theme', t);
        const btn = $('theme-toggle');
        if (btn) btn.innerHTML = t === 'light' ? '&#9728;' : '&#9789;';
        // Sync theme to Firebase for logged user
        const user = getLoggedUser();
        if (db && user) db.ref(`userPrefs/${user.idx}/theme`).set(t).catch(() => {});
    }
    $('theme-toggle').addEventListener('click', () => {
        const cur = localStorage.getItem('profa_theme') || 'dark';
        applyTheme(cur === 'dark' ? 'light' : 'dark');
    });

    // ======================== LIVE BADGE ========================
    let liveBadgeTimer = null;
    async function checkLiveBadge() {
        try {
            const data = await esps('https://esports-api.lolesports.com/persisted/gw/getLive?hl=pt-BR');
            const evs = data?.data?.schedule?.events || [];
            const badge = document.querySelector('.nl a[data-p="live"]');
            if (badge) {
                const existing = badge.querySelector('.live-badge-dot');
                if (evs.length > 0) {
                    if (!existing) badge.insertAdjacentHTML('beforeend', ' <span class="live-badge-dot"></span>');
                } else {
                    if (existing) existing.remove();
                }
            }
        } catch(_) {}
    }

    // ======================== COMPARE PLAYERS ========================
    function renderCompare(h) {
        const parts = h.split('/');
        const a = parts[1] !== undefined ? parseInt(parts[1]) : null;
        const b = parts[2] !== undefined ? parseInt(parts[2]) : null;

        let selectHtml = `<div class="section-wrap-sm">
            <button class="bb" onclick="location.hash='team'">&larr; Voltar</button>
            <div class="compare-hero"><h1>Comparar <span>Jogadores</span></h1><p>Selecione dois jogadores para comparar estatísticas</p></div>
            <div class="compare-select">
                <select id="cmp-a" onchange="updateCompare()">
                    <option value="">Jogador 1</option>
                    ${PLAYERS.map((p,i) => `<option value="${i}" ${i===a?'selected':''}>${p.name}</option>`).join('')}
                </select>
                <span class="compare-vs">VS</span>
                <select id="cmp-b" onchange="updateCompare()">
                    <option value="">Jogador 2</option>
                    ${PLAYERS.map((p,i) => `<option value="${i}" ${i===b?'selected':''}>${p.name}</option>`).join('')}
                </select>
            </div>
            <div id="compare-result"></div>
        </div>`;
        app.innerHTML = selectHtml;

        window.updateCompare = function() {
            const va = $('cmp-a').value, vb = $('cmp-b').value;
            if (va !== '' && vb !== '' && va !== vb) {
                location.hash = `compare/${va}/${vb}`;
            }
        };

        if (a !== null && b !== null && a !== b) loadCompare(a, b);
    }

    async function loadCompare(ai, bi) {
        const res = $('compare-result');
        if (!res) return;
        res.innerHTML = '<div class="ld"><div class="sp"></div></div>';
        try {
            const [da, ddb] = await Promise.all([loadPlayer(ai), loadPlayer(bi)]);
            const pa = PLAYERS[ai], pb = PLAYERS[bi];
            const leA = Array.isArray(da.league)?da.league:[], leB = Array.isArray(ddb.league)?ddb.league:[];
            const sa = getBestRanked(leA);
            const sb = getBestRanked(leB);

            function pStats(d) {
                const mt = Array.isArray(d.matches)?d.matches:[], ac = d.account||{};
                let k=0,dd=0,as=0,cs=0,g=0,dmg=0,vis=0,doubles=0,triples=0,quadras=0,pentas=0;
                mt.forEach(m => { const p2=m.info?.participants?.find(x=>x.puuid===ac.puuid)||{}; k+=p2.kills||0; dd+=p2.deaths||0; as+=p2.assists||0; cs+=(p2.totalMinionsKilled||0)+(p2.neutralMinionsKilled||0); g+=p2.goldEarned||0; dmg+=p2.totalDamageDealtToChampions||0; vis+=p2.visionScore||0; doubles+=p2.doubleKills||0; triples+=p2.tripleKills||0; quadras+=p2.quadraKills||0; pentas+=p2.pentaKills||0; });
                const n=mt.length||1;
                const wins = mt.filter(m => { const p2=m.info?.participants?.find(x=>x.puuid===ac.puuid); return p2?.win; }).length;
                return { kda:((k+as)/Math.max(dd,1)).toFixed(1), avgK:(k/n).toFixed(1), avgD:(dd/n).toFixed(1), avgA:(as/n).toFixed(1), avgCS:(cs/n)|0, avgGold:((g/n)/1000).toFixed(1), avgDmg:((dmg/n)/1000).toFixed(1), avgVis:(vis/n).toFixed(1), wr: mt.length?((wins/mt.length)*100).toFixed(0):'—', wins, losses:mt.length-wins, games:mt.length, multikills:doubles+triples+quadras+pentas, pentas };
            }

            // Head-to-head: games they played together
            const mtA = Array.isArray(da.matches)?da.matches:[], mtB = Array.isArray(ddb.matches)?ddb.matches:[];
            const puuidA = da.account?.puuid, puuidB = ddb.account?.puuid;
            let h2hWinsA=0, h2hWinsB=0;
            if (puuidA && puuidB) {
                const bIds = new Set(mtB.map(m=>m.metadata?.matchId).filter(Boolean));
                mtA.forEach(m => {
                    if (!bIds.has(m.metadata?.matchId)) return;
                    const pA2 = m.info?.participants?.find(x=>x.puuid===puuidA);
                    const pB2 = m.info?.participants?.find(x=>x.puuid===puuidB);
                    if (!pA2 || !pB2) return;
                    if (pA2.teamId !== pB2.teamId) { if (pA2.win) h2hWinsA++; else h2hWinsB++; }
                });
            }

            const stA = pStats(da), stB = pStats(ddb);
            const icA = playerIcon(ai, da.summoner?.profileIconId), icB = playerIcon(bi, ddb.summoner?.profileIconId);
            const tierOrder = {CHALLENGER:9,GRANDMASTER:8,MASTER:7,DIAMOND:6,EMERALD:5,PLATINUM:4,GOLD:3,SILVER:2,BRONZE:1,IRON:0};
            const rankOrder = {I:3,II:2,III:1,IV:0};
            const lpA = sa ? (tierOrder[sa.tier]||0)*400+(rankOrder[sa.rank]||0)*100+(sa.leaguePoints||0) : 0;
            const lpB = sb ? (tierOrder[sb.tier]||0)*400+(rankOrder[sb.rank]||0)*100+(sb.leaguePoints||0) : 0;

            function bar(label, va, vb, unit='', higher=true) {
                const na=parseFloat(va)||0, nb=parseFloat(vb)||0;
                const max=Math.max(na,nb,1), pca=((na/max)*100).toFixed(0), pcb=((nb/max)*100).toFixed(0);
                const wA = higher ? na>=nb : na<=nb, wB = higher ? nb>=na : nb<=na;
                return `<div class="cmp-row">
                    <div class="cmp-val ${wA?'cmp-win':''}">${va}${unit}</div>
                    <div class="cmp-bars"><div class="cmp-bar-wrap"><div class="cmp-bar cmp-bar-a" style="width:${pca}%"></div></div><div class="cmp-label">${label}</div><div class="cmp-bar-wrap"><div class="cmp-bar cmp-bar-b" style="width:${pcb}%"></div></div></div>
                    <div class="cmp-val ${wB?'cmp-win':''}">${vb}${unit}</div>
                </div>`;
            }

            function topChamps(d) {
                return (d.mastery||[]).slice(0,3).map(m => `<img src="${champImg(m.championId)}" title="${CMAP[m.championId]||'?'}" class="cmp-champ-icon">`).join('');
            }

            const h2hHtml = (h2hWinsA+h2hWinsB) > 0
                ? `<div class="cmp-h2h"><div class="cmp-h2h-title">Confronto Direto</div><div class="cmp-h2h-score"><span class="${h2hWinsA>=h2hWinsB?'cmp-win':''}">${h2hWinsA}</span> x <span class="${h2hWinsB>=h2hWinsA?'cmp-win':''}">${h2hWinsB}</span></div><div class="cmp-h2h-sub">${h2hWinsA+h2hWinsB} partidas em lados opostos</div></div>`
                : '';

            res.innerHTML = `
            <div class="cmp-header">
                <div class="cmp-player"><img src="${profImg(icA)}" class="cmp-avatar" ${F}><div class="cmp-name">${da.account?.gameName||pa.name}</div><div class="cmp-rank ${rankCls(sa?.tier)}">${sa?sa.tier+' '+sa.rank+' — '+sa.leaguePoints+' PDL':'Unranked'}</div><div class="cmp-champs">${topChamps(da)}</div></div>
                <div class="cmp-vs-big">VS</div>
                <div class="cmp-player"><img src="${profImg(icB)}" class="cmp-avatar" ${F}><div class="cmp-name">${ddb.account?.gameName||pb.name}</div><div class="cmp-rank ${rankCls(sb?.tier)}">${sb?sb.tier+' '+sb.rank+' — '+sb.leaguePoints+' PDL':'Unranked'}</div><div class="cmp-champs">${topChamps(ddb)}</div></div>
            </div>
            ${h2hHtml}
            <div class="cmp-stats">
                ${bar('Elo (PDL Total)', lpA, lpB)}
                ${bar('Win Rate', stA.wr, stB.wr, '%')}
                ${bar('KDA', stA.kda, stB.kda)}
                ${bar('Kills/jogo', stA.avgK, stB.avgK)}
                ${bar('Deaths/jogo', stA.avgD, stB.avgD, '', false)}
                ${bar('Assists/jogo', stA.avgA, stB.avgA)}
                ${bar('CS/jogo', stA.avgCS, stB.avgCS)}
                ${bar('Gold/jogo', stA.avgGold, stB.avgGold, 'K')}
                ${bar('Dano/jogo', stA.avgDmg, stB.avgDmg, 'K')}
                ${bar('Visão/jogo', stA.avgVis, stB.avgVis)}
                ${bar('Multi-kills', stA.multikills, stB.multikills)}
                ${bar('Partidas', stA.games, stB.games)}
            </div>`;
        } catch(e) { res.innerHTML = `<div class="err"><p>Erro: ${e.message}</p></div>`; }
    }

    // ======================== MATCH FILTER (Profile) ========================
    window.filterMatches = function() {
        const champF = $('filter-champ')?.value || '';
        const modeF = $('filter-mode')?.value || '';
        const resultF = $('filter-result')?.value || '';
        document.querySelectorAll('.mc[data-champ]').forEach(card => {
            const matchChamp = card.dataset.champ || '';
            const matchMode = card.dataset.mode || '';
            const matchResult = card.dataset.result || '';
            let show = true;
            if (champF && matchChamp !== champF) show = false;
            if (modeF && matchMode !== modeF) show = false;
            if (resultF && matchResult !== resultF) show = false;
            card.style.display = show ? '' : 'none';
        });
    };

    // ======================== SQUAD TIMELINE ========================
    function renderTimeline() {
        const el = $('squad-timeline');
        if (!el) return;
        // Collect all matches from all cached players
        const allMatches = [];
        PLAYERS.forEach((p, i) => {
            const d = cache[i];
            if (!d?.matches || !Array.isArray(d.matches)) return;
            d.matches.forEach(m => {
                const mp = m.info?.participants?.find(x => x.puuid === d.account?.puuid);
                if (!mp) return;
                allMatches.push({ player: d.account.gameName||p.name, playerIdx: i, icon: playerIcon(i, d.summoner?.profileIconId), champ: mp.championId, win: mp.win, kills: mp.kills||0, deaths: mp.deaths||0, assists: mp.assists||0, time: m.info.gameCreation, mode: m.info.gameMode, duration: m.info.gameDuration });
            });
        });
        allMatches.sort((a,b) => b.time - a.time);
        if (!allMatches.length) { el.innerHTML = '<p style="color:var(--dim);text-align:center;padding:1rem;">Carregando partidas...</p>'; return; }

        let html = '<div class="tl-list">';
        for (const m of allMatches.slice(0, 30)) {
            html += `<div class="tl-item ${m.win?'tl-win':'tl-loss'}" onclick="location.hash='profile/${m.playerIdx}'">
                <img src="${profImg(m.icon)}" class="tl-avatar" ${F}>
                <img src="${champImg(m.champ)}" class="tl-champ" onerror="this.style.opacity='0.3'">
                <div class="tl-info">
                    <div class="tl-name">${m.player}</div>
                    <div class="tl-detail">${CMAP[m.champ]||'?'} &bull; ${m.kills}/${m.deaths}/${m.assists} &bull; ${fmtDur(m.duration)}</div>
                </div>
                <div class="tl-right">
                    <span class="tl-result ${m.win?'g':'r'}">${m.win?'V':'D'}</span>
                    <span class="tl-ago">${fmtAgo(m.time)}</span>
                </div>
            </div>`;
        }
        html += '</div>';
        el.innerHTML = html;
    }

    // ======================== DASHBOARD ========================
    async function renderDashboard() {
        app.innerHTML = `<div class="section-wrap">
            <div class="dash-hero"><h1>Dashboard <span>do Squad</span></h1><p>Visão geral das estatísticas do grupo</p></div>
            <div class="dash-actions">
                <button class="dash-btn" onclick="location.hash='compare'">Comparar Jogadores</button>
                <button class="dash-btn" onclick="location.hash='teambuilder'">Montar Time</button>
            </div>
            <div id="dash-content">
                <div class="skel-dash-grid">
                    <div class="skel-dash-card skel-pulse"></div>
                    <div class="skel-dash-card skel-pulse"></div>
                    <div class="skel-dash-card skel-pulse"></div>
                    <div class="skel-dash-card skel-pulse"></div>
                </div>
                <div class="skel-dash-section skel-pulse"></div>
                <div class="skel-dash-section skel-pulse"></div>
            </div>
        </div>`;

        // Load all players
        const allData = [];
        await Promise.all(PLAYERS.map(async (p, i) => {
            try {
                const d = await loadPlayerFast(i);
                allData[i] = d;
            } catch(_) { allData[i] = null; }
        }));

        let totalGames=0, totalWins=0, totalKills=0, totalDeaths=0, totalAssists=0;
        const eloDistro = {};
        const champPop = {};
        const hourMap = new Array(24).fill(0);
        const playerStats = [];

        PLAYERS.forEach((p, i) => {
            const d = allData[i];
            if (!d) return;
            const solo = getBestRanked(d.league);
            if (solo) eloDistro[solo.tier] = (eloDistro[solo.tier]||0)+1;
            let pK=0,pD=0,pA=0,pW=0,pG=0;
            (d.matches||[]).forEach(m => {
                const mp = m.info?.participants?.find(x=>x.puuid===d.account?.puuid);
                if (!mp) return;
                pK+=mp.kills||0; pD+=mp.deaths||0; pA+=mp.assists||0; pG++;
                if (mp.win) { pW++; totalWins++; }
                totalKills+=mp.kills||0; totalDeaths+=mp.deaths||0; totalAssists+=mp.assists||0; totalGames++;
                const cid = mp.championId;
                champPop[cid] = (champPop[cid]||0)+1;
                if (m.info.gameCreation) {
                    const h = new Date(m.info.gameCreation).getHours();
                    hourMap[h]++;
                }
            });
            playerStats.push({ name:d.account?.gameName||p.name, idx:i, games:pG, wins:pW, kills:pK, deaths:pD, assists:pA, wr:pG?((pW/pG)*100).toFixed(0):0 });
        });

        const topChamps = Object.entries(champPop).sort((a,b)=>b[1]-a[1]).slice(0,5);
        const eloOrder = ['IRON','BRONZE','SILVER','GOLD','PLATINUM','EMERALD','DIAMOND','MASTER','GRANDMASTER','CHALLENGER'];
        const peakHour = hourMap.indexOf(Math.max(...hourMap));
        const sortedByWR = [...playerStats].filter(s=>s.games>0).sort((a,b)=>b.wr-a.wr);
        const sortedByGames = [...playerStats].sort((a,b)=>b.games-a.games);

        // Compute all advanced data
        const achievements = computeAchievements(allData);
        saveAchievements(achievements);
        const highlights = detectHighlights(allData);
        const interactions = analyzeSquadInteractions(allData);
        const shame = computeWallOfShame(allData);
        const weeklyStats = computeWeeklyRanking(allData);
        const weekSortedLP = [...weeklyStats].filter(s=>s.games>0).sort((a,b)=>b.lpChange-a.lpChange);
        const weekSortedGames = [...weeklyStats].filter(s=>s.games>0).sort((a,b)=>b.games-a.games);
        const weekSortedKDA = [...weeklyStats].filter(s=>s.games>0).sort((a,b)=>b.kda-a.kda);

        $('dash-content').innerHTML = `
        <div class="dash-grid">
            <div class="dash-card">
                <div class="dash-card-title">Partidas do Squad</div>
                <div class="dash-big">${totalGames}</div>
                <div class="dash-sub">${totalWins}V ${totalGames-totalWins}D &bull; ${totalGames?((totalWins/totalGames)*100).toFixed(0):0}% WR</div>
            </div>
            <div class="dash-card">
                <div class="dash-card-title">KDA Geral</div>
                <div class="dash-big">${totalDeaths?((totalKills+totalAssists)/totalDeaths).toFixed(1):'∞'}</div>
                <div class="dash-sub">${totalKills}K / ${totalDeaths}D / ${totalAssists}A</div>
            </div>
            <div class="dash-card">
                <div class="dash-card-title">Horário Pico</div>
                <div class="dash-big">${peakHour}h</div>
                <div class="dash-sub">${hourMap[peakHour]} partidas nesse horário</div>
            </div>
            <div class="dash-card">
                <div class="dash-card-title">Campeão Favorito</div>
                <div class="dash-big" style="display:flex;align-items:center;justify-content:center;gap:8px;"><img src="${champImg(topChamps[0]?.[0])}" style="width:32px;height:32px;border-radius:8px;">${CMAP[topChamps[0]?.[0]]||'?'}</div>
                <div class="dash-sub">${topChamps[0]?.[1]||0} partidas</div>
            </div>
        </div>

        <div class="dash-section">
            <h3>Distribuição de Elo</h3>
            <div class="dash-elo-bar">
                ${eloOrder.filter(t=>eloDistro[t]).map(t => {
                    const pct = ((eloDistro[t]/PLAYERS.length)*100).toFixed(0);
                    return `<div class="dash-elo-seg ${rankCls(t)}" style="flex:${eloDistro[t]}" title="${t}: ${eloDistro[t]}"><span>${t.slice(0,3)} (${eloDistro[t]})</span></div>`;
                }).join('')}
            </div>
        </div>

        <div class="dash-section">
            <h3>Top Campeões do Squad</h3>
            <div class="dash-champ-list">
                ${topChamps.map(([cid,cnt],i) => `<div class="dash-champ-item"><span class="dash-champ-pos">${i+1}</span><img src="${champImg(cid)}" class="dash-champ-img"><span class="dash-champ-name">${CMAP[cid]||'?'}</span><span class="dash-champ-cnt">${cnt} jogos</span></div>`).join('')}
            </div>
        </div>

        <div class="dash-section">
            <h3>Quem mais joga</h3>
            <div class="dash-rank-list">
                ${sortedByGames.map((s,i) => `<div class="dash-rank-item" onclick="location.hash='profile/${s.idx}'"><span class="dash-rank-pos">${i+1}</span><span class="dash-rank-name">${s.name}</span><span class="dash-rank-val">${s.games} jogos</span><span class="dash-rank-wr">${s.wr}% WR</span></div>`).join('')}
            </div>
        </div>

        <div class="dash-section">
            <h3>Melhor Win Rate</h3>
            <div class="dash-rank-list">
                ${sortedByWR.map((s,i) => `<div class="dash-rank-item" onclick="location.hash='profile/${s.idx}'"><span class="dash-rank-pos">${i+1}</span><span class="dash-rank-name">${s.name}</span><span class="dash-rank-val" style="color:#4caf50;">${s.wr}%</span><span class="dash-rank-wr">${s.wins}V ${s.losses}D</span></div>`).join('')}
            </div>
        </div>

        <div class="dash-section">
            <h3>Horário de Jogo</h3>
            <div class="dash-hour-chart">
                ${hourMap.map((cnt,h) => {const max=Math.max(...hourMap,1); return `<div class="dash-hour-bar" title="${h}h: ${cnt} jogos"><div class="dash-hour-fill" style="height:${(cnt/max)*100}%"></div><span>${h}</span></div>`;}).join('')}
            </div>
        </div>

        <div class="dash-section">
            <h3>Conquistas do Squad</h3>
            <div class="dash-badges">
                ${achievements.map(a => `<div class="dash-badge ${a.unlocked?'':'dash-badge-locked'}"><span class="dash-badge-icon">${a.icon}</span><div><div class="dash-badge-title">${a.title}</div><div class="dash-badge-desc">${a.desc}</div>${a.player?'<div class="dash-badge-player">'+a.player+'</div>':''}</div></div>`).join('')}
            </div>
        </div>

        ${highlights.length ? `<div class="dash-section">
            <h3>Highlights da Semana</h3>
            <div class="dash-highlights">${highlights.slice(0,8).map(h => `<div class="dash-hl-card" onclick="location.hash='profile/${h.idx}'">
                <span class="dash-hl-icon">${h.icon}</span>
                <div class="dash-hl-info">
                    <div class="dash-hl-player">${h.player} <small style="color:var(--dim)">(${h.champ})</small></div>
                    <div class="dash-hl-desc">${h.desc}</div>
                    <div class="dash-hl-score">${h.kills}/${h.deaths} &bull; ${fmtAgo(h.ts)}</div>
                </div>
            </div>`).join('')}</div>
        </div>` : ''}

        <div class="dash-section">
            <h3>Ranking Semanal</h3>
            <div class="dash-week-tabs">
                <span class="dash-week-tab on" onclick="showWeekTab('lp',this)">PDL Ganho</span>
                <span class="dash-week-tab" onclick="showWeekTab('games',this)">Mais Jogou</span>
                <span class="dash-week-tab" onclick="showWeekTab('kda',this)">Melhor KDA</span>
            </div>
            <div id="dash-week-lp" class="dash-rank-list">${weekSortedLP.map((s,i) => `<div class="dash-rank-item" onclick="location.hash='profile/${s.idx}'"><span class="dash-rank-pos">${['🥇','🥈','🥉'][i]||i+1+'º'}</span><span class="dash-rank-name">${s.name}</span><span class="dash-rank-val" style="color:${s.lpChange>0?'#4caf50':s.lpChange<0?'#ef5350':'var(--dim)'}">${s.lpChange>0?'+':''}${s.lpChange} PDL</span><span class="dash-rank-wr">${s.games} jogos</span></div>`).join('')||'<p style="color:var(--dim);text-align:center;font-size:.85em;">Sem dados</p>'}</div>
            <div id="dash-week-games" class="dash-rank-list" style="display:none">${weekSortedGames.map((s,i) => `<div class="dash-rank-item" onclick="location.hash='profile/${s.idx}'"><span class="dash-rank-pos">${['🥇','🥈','🥉'][i]||i+1+'º'}</span><span class="dash-rank-name">${s.name}</span><span class="dash-rank-val">${s.games} jogos</span><span class="dash-rank-wr">${s.wr}% WR</span></div>`).join('')||'<p style="color:var(--dim);text-align:center;font-size:.85em;">Sem dados</p>'}</div>
            <div id="dash-week-kda" class="dash-rank-list" style="display:none">${weekSortedKDA.map((s,i) => `<div class="dash-rank-item" onclick="location.hash='profile/${s.idx}'"><span class="dash-rank-pos">${['🥇','🥈','🥉'][i]||i+1+'º'}</span><span class="dash-rank-name">${s.name}</span><span class="dash-rank-val">${s.kda.toFixed(2)} KDA</span><span class="dash-rank-wr">${s.kills}/${s.deaths}/${s.assists}</span></div>`).join('')||'<p style="color:var(--dim);text-align:center;font-size:.85em;">Sem dados</p>'}</div>
        </div>

        ${shame.length ? `<div class="dash-section">
            <h3>Mural da Vergonha</h3>
            <p style="color:var(--dim);font-size:.8em;margin-bottom:12px;">A pior partida da semana de cada um</p>
            <div class="shame-grid">${shame.map(s => `<div class="shame-card" onclick="location.hash='profile/${s.idx}'">
                <img src="${champImg(s.champId)}" class="shame-champ-img">
                <div class="shame-info">
                    <div class="shame-name">${s.name}</div>
                    <div class="shame-score ${s.win?'':'shame-loss'}">${s.kills}/${s.deaths}/${s.assists} <small>(${s.champ})</small></div>
                    <div class="shame-cs">${s.cs} CS &bull; ${fmtAgo(s.ts)}</div>
                </div>
                <div class="shame-skull">💀</div>
                <div class="shame-reactions" id="shame-react-${s.idx}"></div>
            </div>`).join('')}</div>
        </div>` : ''}

        ${interactions.duos.length ? `<div class="dash-section">
            <h3>Duo Stats</h3>
            <p style="color:var(--dim);font-size:.8em;margin-bottom:12px;">Quando jogam juntos no mesmo time</p>
            <div class="dash-rank-list">${interactions.duos.slice(0,10).map((d,i) => {
                const n1=allData[d.p1]?.account?.gameName||PLAYERS[d.p1].name, n2=allData[d.p2]?.account?.gameName||PLAYERS[d.p2].name;
                const wr=d.games?(d.wins/d.games*100).toFixed(0):0;
                return `<div class="dash-rank-item"><span class="dash-rank-pos">${i+1}</span><span class="dash-rank-name">${n1} + ${n2}</span><span class="dash-rank-val" style="color:${wr>=55?'#4caf50':wr<=45?'#ef5350':'var(--dim)'}">${wr}% WR</span><span class="dash-rank-wr">${d.games} jogos</span></div>`;
            }).join('')}</div>
        </div>` : ''}

        ${interactions.rivals.length ? `<div class="dash-section">
            <h3>Rivalidades Internas</h3>
            <p style="color:var(--dim);font-size:.8em;margin-bottom:12px;">Quando se enfrentaram em times opostos</p>
            <div class="dash-rank-list">${interactions.rivals.slice(0,10).map((r,i) => {
                const n1=allData[r.p1]?.account?.gameName||PLAYERS[r.p1].name, n2=allData[r.p2]?.account?.gameName||PLAYERS[r.p2].name;
                return `<div class="dash-rank-item"><span class="dash-rank-pos">⚔️</span><span class="dash-rank-name">${n1} vs ${n2}</span><span class="dash-rank-val">${r.p1wins} — ${r.p2wins}</span><span class="dash-rank-wr">${r.games} jogos</span></div>`;
            }).join('')}</div>
        </div>` : ''}

        <div class="dash-section">
            <h3>Histórico de PDL</h3>
            <div id="dash-lp-chart"><p style="color:var(--dim);text-align:center;font-size:.85em;">Carregando...</p></div>
        </div>

        <div class="dash-section">
            <h3>Placar de Palpites CBLOL</h3>
            <div id="dash-preds"><p style="color:var(--dim);text-align:center;font-size:.85em;">Carregando palpites...</p></div>
        </div>

        <div class="dash-section">
            <h3>Feed de Atividade</h3>
            <div id="dash-feed"><div class="ld"><div class="sp"></div></div></div>
        </div>`;

        // LP history chart in dashboard
        try {
            const lpHist = JSON.parse(localStorage.getItem('soloq_history') || '{}');
            const lpDates = Object.keys(lpHist).sort();
            const lpEl = $('dash-lp-chart');
            if (lpEl && lpDates.length >= 2) {
                const names = [...new Set(lpDates.flatMap(dt => Object.keys(lpHist[dt]||{})))];
                const tierColors2 = {CHALLENGER:'#f0c040',GRANDMASTER:'#ef5350',MASTER:'#b344e0',DIAMOND:'#4fc3f7',EMERALD:'#4caf50',PLATINUM:'#26c6da',GOLD:'#ffd740',SILVER:'#b0bec5',BRONZE:'#cd7f32',IRON:'#795548'};
                let tableHtml = '<div class="dash-lp-table"><table><thead><tr><th>Jogador</th>';
                lpDates.forEach(dt => { const p2 = dt.split('-'); tableHtml += `<th>${p2[2]}/${p2[1]}</th>`; });
                tableHtml += '<th>Var.</th></tr></thead><tbody>';
                names.forEach(name => {
                    const vals = lpDates.map(dt => lpHist[dt]?.[name]);
                    const first = vals.find(v => v !== undefined), last = vals.filter(v => v !== undefined).pop();
                    const diff = (first !== undefined && last !== undefined) ? last - first : 0;
                    const ps2 = playerStats.find(s => s.name === name);
                    const solo2 = ps2 ? getBestRanked(allData[ps2.idx]?.league) : null;
                    const color = tierColors2[solo2?.tier] || 'var(--pri)';
                    tableHtml += `<tr><td style="color:${color};font-weight:700;">${name}</td>`;
                    vals.forEach(v => { tableHtml += `<td style="font-size:.8em;">${v!==undefined?totalLPtoElo(v):'—'}</td>`; });
                    tableHtml += `<td style="color:${diff>0?'#4caf50':diff<0?'#ef5350':'var(--dim)'};font-weight:700;">${diff>0?'+':''}${diff} PDL</td></tr>`;
                });
                tableHtml += '</tbody></table></div>';
                lpEl.innerHTML = tableHtml;
            } else if (lpEl) {
                lpEl.innerHTML = '<p style="color:var(--dim);text-align:center;font-size:.85em;">Dados de PDL registrados. Volte amanhã para ver a evolução.</p>';
            }
        } catch(_) {}

        // Load prediction scoreboard
        if (db) {
            db.ref('predictions').once('value').then(snap => {
                const predsEl = $('dash-preds');
                if (!predsEl) return;
                const allPreds = snap.val();
                if (!allPreds) { predsEl.innerHTML = '<p style="color:var(--dim);text-align:center;font-size:.85em;">Nenhum palpite registrado</p>'; return; }
                // Count points per player idx
                const scores = {};
                PLAYERS.forEach((_,i) => { scores[i] = { name: PLAYERS[i].name, pts: 0, total: 0, correct: 0, exact: 0 }; });
                Object.values(allPreds).forEach(match => {
                    Object.entries(match).forEach(([idx, pred]) => {
                        const i = parseInt(idx);
                        if (!scores[i]) return;
                        scores[i].total++;
                    });
                });
                const sorted2 = Object.values(scores).filter(s=>s.total>0).sort((x,y)=>y.pts-x.pts||y.total-x.total);
                if (!sorted2.length) { predsEl.innerHTML = '<p style="color:var(--dim);text-align:center;font-size:.85em;">Nenhum palpite registrado</p>'; return; }
                const medals2 = ['🥇','🥈','🥉'];
                predsEl.innerHTML = `<div class="dash-rank-list">${sorted2.map((s,i) => `<div class="dash-rank-item" onclick="location.hash='profile/${PLAYERS.findIndex(p=>p.name===s.name)}'"><span class="dash-rank-pos">${medals2[i]||i+1+'º'}</span><span class="dash-rank-name">${s.name}</span><span class="dash-rank-val">${s.total} palpites</span></div>`).join('')}</div>`;
            }).catch(() => {});
        }

        // Weekly tab switching
        window.showWeekTab = function(tab, el) {
            document.querySelectorAll('.dash-week-tab').forEach(t => t.classList.remove('on'));
            if (el) el.classList.add('on');
            ['lp','games','kda'].forEach(t => { const e=$(`dash-week-${t}`); if(e) e.style.display = t===tab ? '' : 'none'; });
        };

        // Shame reactions
        if (db) {
            shame.forEach(s => {
                const el = $(`shame-react-${s.idx}`);
                if (!el) return;
                const emojis = ['😂','💀','🤡','😭','🔥'];
                el.innerHTML = emojis.map(e => `<button class="shame-react-btn" onclick="reactShame(${s.idx},'${e}')" title="Reagir">${e}</button>`).join('') + '<span class="shame-react-counts" id="shame-counts-${s.idx}"></span>';
                // Load existing reactions
                db.ref(`shameReactions/${getWeekId()}/${s.idx}`).on('value', snap => {
                    const data = snap.val() || {};
                    const counts = {};
                    Object.values(data).forEach(r => { counts[r] = (counts[r]||0)+1; });
                    const ce = document.getElementById(`shame-counts-${s.idx}`);
                    if (ce) ce.innerHTML = Object.entries(counts).map(([e,c]) => `<span class="shame-count">${e}${c}</span>`).join('');
                });
            });
        }
        window.reactShame = function(playerIdx, emoji) {
            const user = getLoggedUser();
            if (!user || !db) return;
            db.ref(`shameReactions/${getWeekId()}/${playerIdx}/${user.idx}`).set(emoji).catch(()=>{});
        };

        // Load feed
        loadFeed(20).then(items => {
            const feedEl = $('dash-feed');
            if (!feedEl) return;
            if (!items.length) { feedEl.innerHTML = '<p style="color:var(--dim);text-align:center;">Nenhuma atividade recente</p>'; return; }
            feedEl.innerHTML = `<div class="feed-list">${items.map(item => `<div class="feed-item" ${item.idx !== undefined ? `onclick="location.hash='profile/${item.idx}'"` : ''}>
                <span class="feed-icon">${feedIcon(item.type)}</span>
                <div class="feed-content">
                    <div class="feed-msg">${escapeHtml(item.msg || '')}</div>
                    <div class="feed-time">${fmtAgo(item.ts)}</div>
                </div>
            </div>`).join('')}</div>`;
        });
    }

    // ======================== ACHIEVEMENTS (EXPANDED) ========================
    function computeAchievements(allData) {
        const badges = [];
        let bestStreak={name:'',count:0}, bestKDA={name:'',val:0}, mostPentas={name:'',count:0};
        let mostGames={name:'',count:0}, bestCS={name:'',val:0}, first10={name:'',count:0};
        let bestVision={name:'',val:0}, mostFirstBlood={name:'',count:0}, bestDPM={name:'',val:0};
        let mostTurrets={name:'',count:0}, mostDragon={name:'',count:0}, mostBaron={name:'',count:0};
        let leastDeaths={name:'',val:999}, mostQuadra={name:'',count:0}, mostTriple={name:'',count:0};
        let longestGame={name:'',val:0}, bestComeback={name:'',val:false};
        let mostAssists={name:'',val:0}, soloCarry={name:'',val:false};

        PLAYERS.forEach((p, i) => {
            const d = allData[i]; if (!d?.matches?.length) return;
            const name = d.account?.gameName || p.name;
            const puuid = d.account?.puuid;
            let streak=0, maxStreak=0, k=0, dd=0, a=0, pentas=0, cs=0, vis=0, fb=0, dmg=0, dur=0;
            let turrets=0, dragon=0, baron=0, quadra=0, triple=0, assists=0;
            const sorted = [...d.matches].sort((a2,b2)=>(a2.info?.gameCreation||0)-(b2.info?.gameCreation||0));
            sorted.forEach(m => {
                const mp = m.info?.participants?.find(x=>x.puuid===puuid); if(!mp) return;
                if (mp.win) { streak++; maxStreak=Math.max(maxStreak,streak); } else streak=0;
                k+=mp.kills||0; dd+=mp.deaths||0; a+=mp.assists||0;
                cs+=(mp.totalMinionsKilled||0)+(mp.neutralMinionsKilled||0);
                vis+=mp.visionScore||0; dmg+=mp.totalDamageDealtToChampions||0;
                dur+=m.info?.gameDuration||0;
                if(mp.pentaKills) pentas+=mp.pentaKills;
                if(mp.quadraKills) quadra+=mp.quadraKills;
                if(mp.tripleKills) triple+=mp.tripleKills;
                if(mp.firstBloodKill) fb++;
                turrets+=mp.turretKills||0; dragon+=mp.dragonKills||0; baron+=mp.baronKills||0;
                assists+=mp.assists||0;
                if((mp.kills||0)>=10 && (mp.deaths||0)===0) first10.count++;
                // Solo carry: 15+ kills and win
                if(mp.win && (mp.kills||0)>=15) soloCarry={name,val:true};
                // Longest game
                if(m.info?.gameDuration>longestGame.val) longestGame={name,val:m.info.gameDuration};
            });
            const n = d.matches.length;
            const kda = dd>0?(k+a)/dd:k+a;
            const avgCS = n>0?cs/n:0;
            const avgVis = n>0?vis/n:0;
            const avgDPM = n>0&&dur>0?(dmg/n)/((dur/n)/60):0;
            const avgDeaths = n>0?dd/n:999;
            if(maxStreak>bestStreak.count) bestStreak={name,count:maxStreak};
            if(kda>bestKDA.val) bestKDA={name,val:kda};
            if(pentas>mostPentas.count) mostPentas={name,count:pentas};
            if(n>mostGames.count) mostGames={name,count:n};
            if(avgCS>bestCS.val) bestCS={name,val:avgCS};
            if(avgVis>bestVision.val) bestVision={name,val:avgVis};
            if(fb>mostFirstBlood.count) mostFirstBlood={name,count:fb};
            if(avgDPM>bestDPM.val) bestDPM={name,val:avgDPM};
            if(turrets>mostTurrets.count) mostTurrets={name,count:turrets};
            if(dragon>mostDragon.count) mostDragon={name,count:dragon};
            if(baron>mostBaron.count) mostBaron={name,count:baron};
            if(avgDeaths<leastDeaths.val) leastDeaths={name,val:avgDeaths};
            if(quadra>mostQuadra.count) mostQuadra={name,count:quadra};
            if(triple>mostTriple.count) mostTriple={name,count:triple};
            if(assists>mostAssists.val) mostAssists={name,val:assists};
        });

        badges.push({icon:'🔥',title:'Maior Winstreak',desc:`${bestStreak.count} vitórias seguidas`,player:bestStreak.name,unlocked:bestStreak.count>=3});
        badges.push({icon:'⚔️',title:'Melhor KDA',desc:`${bestKDA.val.toFixed(1)} KDA`,player:bestKDA.name,unlocked:bestKDA.val>=3});
        badges.push({icon:'💀',title:'Pentakill!',desc:mostPentas.count>0?`${mostPentas.count} pentas`:'Ninguém fez penta',player:mostPentas.name,unlocked:mostPentas.count>0});
        badges.push({icon:'🎮',title:'Viciado',desc:`${mostGames.count} partidas`,player:mostGames.name,unlocked:mostGames.count>=10});
        badges.push({icon:'🌾',title:'Rei do Farm',desc:`${bestCS.val.toFixed(0)} CS médio`,player:bestCS.name,unlocked:bestCS.val>=150});
        badges.push({icon:'👑',title:'Perfeito 10/0',desc:first10.count>0?'10+ kills sem morrer':'Ninguém conseguiu',player:'',unlocked:first10.count>0});
        badges.push({icon:'👁️',title:'Oráculo',desc:`${bestVision.val.toFixed(1)} visão média`,player:bestVision.name,unlocked:bestVision.val>=25});
        badges.push({icon:'🗡️',title:'First Blood King',desc:`${mostFirstBlood.count} first bloods`,player:mostFirstBlood.name,unlocked:mostFirstBlood.count>=3});
        badges.push({icon:'💥',title:'DPS Monster',desc:`${bestDPM.val.toFixed(0)} DPM`,player:bestDPM.name,unlocked:bestDPM.val>=500});
        badges.push({icon:'🏰',title:'Demolidor',desc:`${mostTurrets.count} torres destruídas`,player:mostTurrets.name,unlocked:mostTurrets.count>=5});
        badges.push({icon:'🐉',title:'Dragão Slayer',desc:`${mostDragon.count} dragões`,player:mostDragon.name,unlocked:mostDragon.count>=3});
        badges.push({icon:'👿',title:'Baron Nashor',desc:`${mostBaron.count} barons`,player:mostBaron.name,unlocked:mostBaron.count>=1});
        badges.push({icon:'🛡️',title:'Imortal',desc:`${leastDeaths.val.toFixed(1)} mortes/jogo`,player:leastDeaths.name,unlocked:leastDeaths.val<3});
        badges.push({icon:'4️⃣',title:'Quadrakill',desc:`${mostQuadra.count} quadras`,player:mostQuadra.name,unlocked:mostQuadra.count>=1});
        badges.push({icon:'3️⃣',title:'Triple Kill',desc:`${mostTriple.count} triples`,player:mostTriple.name,unlocked:mostTriple.count>=3});
        badges.push({icon:'🤝',title:'Team Player',desc:`${mostAssists.val} assists totais`,player:mostAssists.name,unlocked:mostAssists.val>=50});
        badges.push({icon:'💪',title:'Solo Carry',desc:soloCarry.val?'15+ kills e vitória':'Ninguém conseguiu',player:soloCarry.name,unlocked:soloCarry.val});
        badges.push({icon:'⏰',title:'Maratonista',desc:longestGame.val?`${Math.floor(longestGame.val/60)}min mais longo`:'?',player:longestGame.name,unlocked:longestGame.val>=2400});
        const predKeys=[];for(let kk=0;kk<localStorage.length;kk++){const key=localStorage.key(kk);if(key?.startsWith('pred_'))predKeys.push(key);}
        badges.push({icon:'🎯',title:'Vidente',desc:`${predKeys.length} palpites`,player:'',unlocked:predKeys.length>=5});
        return badges;
    }

    // ======================== AUTO HIGHLIGHTS ========================
    function detectHighlights(allData) {
        const highlights = [];
        PLAYERS.forEach((p, i) => {
            const d = allData[i]; if (!d?.matches?.length) return;
            const name = d.account?.gameName || p.name;
            const puuid = d.account?.puuid;
            const weekMs = 7 * 24 * 60 * 60 * 1000;
            const cutoff = Date.now() - weekMs;
            d.matches.forEach(m => {
                if ((m.info?.gameCreation||0) < cutoff) return;
                const mp = m.info?.participants?.find(x => x.puuid === puuid); if (!mp) return;
                const champ = CMAP[mp.championId] || '?';
                if (mp.pentaKills > 0) highlights.push({ type:'pentakill', icon:'💀', player:name, idx:i, champ, desc:`PENTAKILL de ${champ}!`, kills:mp.kills, deaths:mp.deaths, ts:m.info.gameCreation });
                if (mp.kills >= 20) highlights.push({ type:'massacre', icon:'🗡️', player:name, idx:i, champ, desc:`${mp.kills} kills com ${champ}!`, kills:mp.kills, deaths:mp.deaths, ts:m.info.gameCreation });
                if (mp.deaths === 0 && mp.kills >= 5) highlights.push({ type:'perfect', icon:'👑', player:name, idx:i, champ, desc:`${mp.kills}/${mp.deaths}/${mp.assists} perfeito!`, kills:mp.kills, deaths:mp.deaths, ts:m.info.gameCreation });
                if (mp.visionScore >= 60) highlights.push({ type:'vision', icon:'👁️', player:name, idx:i, champ, desc:`${mp.visionScore} de visão!`, kills:mp.kills, deaths:mp.deaths, ts:m.info.gameCreation });
                const cs = (mp.totalMinionsKilled||0)+(mp.neutralMinionsKilled||0);
                const mins = (m.info?.gameDuration||1)/60;
                if (cs/mins >= 9) highlights.push({ type:'farm', icon:'🌾', player:name, idx:i, champ, desc:`${(cs/mins).toFixed(1)} CS/min!`, kills:mp.kills, deaths:mp.deaths, ts:m.info.gameCreation });
            });
        });
        return highlights.sort((a,b) => b.ts - a.ts).slice(0, 20);
    }

    // ======================== DUO STATS & RIVALRY ========================
    function analyzeSquadInteractions(allData) {
        const duos = {}, rivals = {};
        for (let i = 0; i < PLAYERS.length; i++) {
            for (let j = i + 1; j < PLAYERS.length; j++) {
                duos[`${i}-${j}`] = { p1: i, p2: j, games: 0, wins: 0, k1: 0, k2: 0, d1: 0, d2: 0 };
                rivals[`${i}-${j}`] = { p1: i, p2: j, games: 0, p1wins: 0, p2wins: 0 };
            }
        }
        const puuids = PLAYERS.map((_, i) => allData[i]?.account?.puuid).filter(Boolean);
        // Build match index
        const matchMap = {};
        PLAYERS.forEach((_, i) => {
            const d = allData[i]; if (!d?.matches) return;
            d.matches.forEach(m => {
                const mid = m.metadata?.matchId; if (!mid) return;
                if (!matchMap[mid]) matchMap[mid] = m;
            });
        });
        // Scan each match for squad member pairs
        Object.values(matchMap).forEach(m => {
            if (!m.info?.participants) return;
            const squad = [];
            m.info.participants.forEach(pp => {
                const idx = PLAYERS.findIndex((_, i) => allData[i]?.account?.puuid === pp.puuid);
                if (idx >= 0) squad.push({ idx, pp });
            });
            if (squad.length < 2) return;
            for (let a = 0; a < squad.length; a++) {
                for (let b = a + 1; b < squad.length; b++) {
                    const i = Math.min(squad[a].idx, squad[b].idx), j = Math.max(squad[a].idx, squad[b].idx);
                    const pa = squad[a].idx === i ? squad[a].pp : squad[b].pp;
                    const pb = squad[a].idx === i ? squad[b].pp : squad[a].pp;
                    const sameTeam = pa.teamId === pb.teamId;
                    if (sameTeam) {
                        const key = `${i}-${j}`;
                        duos[key].games++;
                        if (pa.win) duos[key].wins++;
                        duos[key].k1 += pa.kills || 0; duos[key].d1 += pa.deaths || 0;
                        duos[key].k2 += pb.kills || 0; duos[key].d2 += pb.deaths || 0;
                    } else {
                        const key = `${i}-${j}`;
                        rivals[key].games++;
                        if (pa.win) rivals[key].p1wins++; else rivals[key].p2wins++;
                    }
                }
            }
        });
        return {
            duos: Object.values(duos).filter(d => d.games > 0).sort((a, b) => b.games - a.games),
            rivals: Object.values(rivals).filter(r => r.games > 0).sort((a, b) => b.games - a.games)
        };
    }

    // ======================== WALL OF SHAME ========================
    function computeWallOfShame(allData) {
        const shame = [];
        const weekMs = 7*24*60*60*1000, cutoff = Date.now() - weekMs;
        PLAYERS.forEach((p, i) => {
            const d = allData[i]; if (!d?.matches?.length) return;
            const name = d.account?.gameName || p.name;
            const puuid = d.account?.puuid;
            let worst = null, worstScore = Infinity;
            d.matches.forEach(m => {
                if ((m.info?.gameCreation||0) < cutoff) return;
                const mp = m.info?.participants?.find(x => x.puuid === puuid); if (!mp) return;
                const k=mp.kills||0, dd=mp.deaths||0, a=mp.assists||0;
                const score = (k+a)/Math.max(dd,1) - (dd*0.5); // lower = worse
                if (score < worstScore) {
                    worstScore = score;
                    worst = { name, idx:i, kills:k, deaths:dd, assists:a, champ:CMAP[mp.championId]||'?', champId:mp.championId, win:mp.win, cs:(mp.totalMinionsKilled||0)+(mp.neutralMinionsKilled||0), ts:m.info.gameCreation };
                }
            });
            if (worst && worst.deaths >= 3) shame.push(worst);
        });
        return shame.sort((a,b) => (a.kills+a.assists)/Math.max(a.deaths,1) - (b.kills+b.assists)/Math.max(b.deaths,1));
    }

    // ======================== WEEKLY RANKING ========================
    function computeWeeklyRanking(allData) {
        const weekMs = 7*24*60*60*1000, cutoff = Date.now() - weekMs;
        const stats = [];
        PLAYERS.forEach((p, i) => {
            const d = allData[i]; if (!d) return;
            const name = d.account?.gameName || p.name;
            const puuid = d.account?.puuid;
            let games=0, wins=0, kills=0, deaths=0, assists=0, pentas=0;
            (d.matches||[]).forEach(m => {
                if ((m.info?.gameCreation||0) < cutoff) return;
                const mp = m.info?.participants?.find(x => x.puuid === puuid); if (!mp) return;
                games++; if(mp.win) wins++;
                kills+=mp.kills||0; deaths+=mp.deaths||0; assists+=mp.assists||0;
                pentas+=mp.pentaKills||0;
            });
            // LP change this week
            const solo = getBestRanked(d.league);
            const currentLP = solo ? calcTotalLP(solo.tier, solo.rank, solo.leaguePoints||0) : 0;
            const lpHist = JSON.parse(localStorage.getItem('soloq_history')||'{}');
            const weekDates = Object.keys(lpHist).sort();
            let weekStartLP = currentLP;
            for (const dt of weekDates) {
                const dtMs = new Date(dt).getTime();
                if (dtMs >= cutoff && lpHist[dt]?.[name] !== undefined) { weekStartLP = lpHist[dt][name]; break; }
            }
            const lpChange = currentLP - weekStartLP;
            const kda = deaths > 0 ? (kills+assists)/deaths : kills+assists;
            stats.push({ name, idx:i, games, wins, kills, deaths, assists, pentas, kda, lpChange, wr: games?(wins/games*100).toFixed(0):'0' });
        });
        return stats;
    }

    function calcTotalLP(tier, rank, lp) {
        const tiers = {IRON:0,BRONZE:400,SILVER:800,GOLD:1200,PLATINUM:1600,EMERALD:2000,DIAMOND:2400,MASTER:2800,GRANDMASTER:3200,CHALLENGER:3600};
        const ranks = {IV:0,III:100,II:200,I:300};
        return (tiers[tier]||0) + (ranks[rank]||0) + (lp||0);
    }
    // Reverse: totalLP → "Gold 1 45 PDL"
    function totalLPtoElo(val) {
        const tierList = ['IRON','BRONZE','SILVER','GOLD','PLATINUM','EMERALD','DIAMOND','MASTER','GRANDMASTER','CHALLENGER'];
        const tierNames = {IRON:'Iron',BRONZE:'Bronze',SILVER:'Silver',GOLD:'Gold',PLATINUM:'Plat',EMERALD:'Emerald',DIAMOND:'Diamond',MASTER:'Master',GRANDMASTER:'GM',CHALLENGER:'Chall'};
        const rankList = ['IV','III','II','I'];
        let tierIdx = Math.min(Math.floor(val / 400), tierList.length - 1);
        if (tierIdx < 0) tierIdx = 0;
        const tierName = tierList[tierIdx];
        const remaining = val - tierIdx * 400;
        let rankIdx = Math.min(Math.floor(remaining / 100), 3);
        if (rankIdx < 0) rankIdx = 0;
        const pdl = Math.max(0, remaining - rankIdx * 100);
        return `${tierNames[tierName]||tierName} ${rankList[rankIdx]} ${pdl} PDL`;
    }

    // ======================== RPG ARENA ========================
    const RPG_CLASSES = [
        { id:'warrior',  name:'Guerreiro',  icon:'⚔️', color:'#e53935', desc:'Força bruta e dano devastador', stat:'atk' },
        { id:'assassin', name:'Assassino',  icon:'🗡️', color:'#ab47bc', desc:'Precisão letal com KDA impecável', stat:'agi' },
        { id:'guardian', name:'Guardião',   icon:'🛡️', color:'#1e88e5', desc:'Bastião inabalável da equipe', stat:'def' },
        { id:'oracle',   name:'Oráculo',    icon:'👁️', color:'#00acc1', desc:'Visão absoluta do campo de batalha', stat:'int' },
        { id:'sovereign',name:'Soberano',   icon:'👑', color:'#fdd835', desc:'Riqueza e domínio dos recursos', stat:'for' },
        { id:'sage',     name:'Sábio',      icon:'✨', color:'#66bb6a', desc:'Mestre das vitórias consistentes', stat:'sab' },
    ];
    const RPG_RANKS = [
        { name:'Aprendiz',     min:0,   color:'#78909c', glow:'rgba(120,144,156,0.3)' },
        { name:'Soldado',      min:20,  color:'#66bb6a', glow:'rgba(102,187,106,0.3)' },
        { name:'Veterano',     min:35,  color:'#42a5f5', glow:'rgba(66,165,245,0.3)' },
        { name:'Elite',        min:50,  color:'#ab47bc', glow:'rgba(171,71,188,0.4)' },
        { name:'Campeão',      min:65,  color:'#ffa726', glow:'rgba(255,167,38,0.4)' },
        { name:'Lendário',     min:78,  color:'#ef5350', glow:'rgba(239,83,80,0.5)' },
        { name:'Mítico',       min:88,  color:'#e040fb', glow:'rgba(224,64,251,0.5)' },
        { name:'Divino',       min:95,  color:'#ffd740', glow:'rgba(255,215,64,0.6)' },
    ];

    function getRPGRank(power) {
        let r = RPG_RANKS[0];
        for (const rank of RPG_RANKS) { if (power >= rank.min) r = rank; }
        return r;
    }

    function calcRPGStats(matches, puuid, league) {
        const recent = [...matches]
            .filter(m => m?.info?.participants)
            .sort((a,b) => (b.info?.gameCreation||0)-(a.info?.gameCreation||0))
            .slice(0, 20);
        if (!recent.length) return null;
        let kills=0,deaths=0,assists=0,cs=0,dmg=0,gold=0,vision=0,dur=0,wins=0;
        let topChampId=null, champCounts={};
        recent.forEach(m => {
            const p = m.info.participants.find(x=>x.puuid===puuid);
            if (!p) return;
            kills+=p.kills||0; deaths+=p.deaths||0; assists+=p.assists||0;
            cs+=(p.totalMinionsKilled||0)+(p.neutralMinionsKilled||0);
            dmg+=p.totalDamageDealtToChampions||0; gold+=p.goldEarned||0;
            vision+=p.visionScore||0; dur+=m.info?.gameDuration||0;
            if(p.win) wins++;
            const cid=p.championId;
            if(cid){champCounts[cid]=(champCounts[cid]||0)+1;}
        });
        const n = recent.length;
        const avgMin = (dur/n)/60 || 1;
        // Find most played champion
        let maxC=0; for(const[cid,cnt]of Object.entries(champCounts)){if(cnt>maxC){maxC=cnt;topChampId=cid;}}

        const avgKDA = (kills+assists)/Math.max(deaths,1);
        const avgDPM = (dmg/n)/avgMin;
        const avgGPM = (gold/n)/avgMin;
        const avgVision = vision/n;
        const avgCS = cs/n;
        const winRate = (wins/n)*100;

        // Normalize stats to 0-100 scale (approximate benchmarks)
        const rawAtk = Math.min(100, (avgDPM / 800) * 100);       // DPM: 800+ = max
        const rawDef = Math.min(100, Math.max(0, (1 - (deaths/n)/8) * 100)); // Low deaths = high def
        const rawAgi = Math.min(100, (avgKDA / 6) * 100);         // KDA: 6+ = max
        const rawInt = Math.min(100, (avgVision / 40) * 100);     // Vision: 40+ = max
        const rawFr = Math.min(100, (avgGPM / 500) * 100);        // GPM: 500+ = max
        const rawSab = Math.min(100, winRate);                     // Win rate direct

        // Elo is 40% of the power formula — a higher elo player ALWAYS scores above a lower one
        // Performance stats are 60% — differentiate within the same elo bracket
        const ranked = getBestRanked(Array.isArray(league) ? league : []);
        let eloPercent = 0; // 0-100 scale representing ranked position
        if (ranked) {
            const tierVal = {IRON:0,BRONZE:1,SILVER:2,GOLD:3,PLATINUM:4,EMERALD:5,DIAMOND:6,MASTER:7,GRANDMASTER:8,CHALLENGER:9};
            const rankVal = {IV:0,III:1,II:2,I:3};
            const eloScore = (tierVal[ranked.tier]||0)*4 + (rankVal[ranked.rank]||0) + (ranked.leaguePoints||0)/100; // 0~40
            eloPercent = Math.min(100, (eloScore / 40) * 100);
        }
        const ELO_WEIGHT = 0.40;
        const PERF_WEIGHT = 0.60;
        const perfAvg = (rawAtk + rawDef + rawAgi + rawInt + rawFr + rawSab) / 6;
        const atk = Math.min(100, rawAtk * PERF_WEIGHT + eloPercent * ELO_WEIGHT);
        const def = Math.min(100, rawDef * PERF_WEIGHT + eloPercent * ELO_WEIGHT);
        const agi = Math.min(100, rawAgi * PERF_WEIGHT + eloPercent * ELO_WEIGHT);
        const int_stat = Math.min(100, rawInt * PERF_WEIGHT + eloPercent * ELO_WEIGHT);
        const fr = Math.min(100, rawFr * PERF_WEIGHT + eloPercent * ELO_WEIGHT);
        const sab = Math.min(100, rawSab * PERF_WEIGHT + eloPercent * ELO_WEIGHT);

        const power = ((atk + def + agi + int_stat + fr + sab) / 6);

        // Determine class by dominant stat
        const statMap = { atk, def, agi, int: int_stat, for: fr, sab };
        let dominant = 'atk', dominantVal = 0;
        for (const [k,v] of Object.entries(statMap)) {
            if (v > dominantVal) { dominantVal = v; dominant = k; }
        }
        const rpgClass = RPG_CLASSES.find(c => c.stat === dominant) || RPG_CLASSES[0];
        const rank = getRPGRank(power);

        // Virtudes e Defeitos baseados nos stats
        const virtues = [], flaws = [];
        const ra = Math.round(atk), rd = Math.round(def), rag = Math.round(agi), ri = Math.round(int_stat), rf = Math.round(fr), rs = Math.round(sab);
        if (ra >= 70) virtues.push({ icon:'⚔️', text:'Dano devastador' });
        else if (ra < 30) flaws.push({ icon:'⚔️', text:'Dano fraco' });
        if (rd >= 70) virtues.push({ icon:'🛡️', text:'Sobrevivente nato' });
        else if (rd < 30) flaws.push({ icon:'💀', text:'Morre demais' });
        if (rag >= 70) virtues.push({ icon:'🗡️', text:'Precisão letal' });
        else if (rag < 30) flaws.push({ icon:'🗡️', text:'KDA problemático' });
        if (ri >= 70) virtues.push({ icon:'👁️', text:'Visão impecável' });
        else if (ri < 30) flaws.push({ icon:'👁️', text:'Cego no mapa' });
        if (rf >= 70) virtues.push({ icon:'👑', text:'Rei do ouro' });
        else if (rf < 30) flaws.push({ icon:'👑', text:'Sempre sem gold' });
        if (rs >= 70) virtues.push({ icon:'✨', text:'Vencedor consistente' });
        else if (rs < 30) flaws.push({ icon:'✨', text:'Perde demais' });
        // Bonus traits
        if (ra >= 80 && rd < 40) virtues.push({ icon:'💥', text:'Canhão de vidro' });
        if (rd >= 80 && ra < 40) virtues.push({ icon:'🏰', text:'Muralha inabalável' });
        if (rag >= 80 && rs >= 60) virtues.push({ icon:'🎯', text:'Assassino cirúrgico' });
        if (ri >= 60 && rs >= 60) virtues.push({ icon:'🧠', text:'Mente estratégica' });
        if (rd < 25 && ra < 25) flaws.push({ icon:'🤡', text:'Perdido no jogo' });
        if (rs < 25 && rag < 30) flaws.push({ icon:'📉', text:'Fase terrível' });

        return {
            atk: ra, def: rd, agi: rag, int: ri, for: rf, sab: rs,
            power: Math.round(power), rpgClass, rank, topChampId,
            virtues: virtues.slice(0, 3), flaws: flaws.slice(0, 3),
            raw: { avgKDA: avgKDA.toFixed(2), avgDPM: avgDPM.toFixed(0), avgGPM: avgGPM.toFixed(0),
                   avgVision: avgVision.toFixed(1), avgCS: avgCS.toFixed(0), winRate: winRate.toFixed(0),
                   games: n, wins, deaths: (deaths/n).toFixed(1) }
        };
    }

    function rpgRadarSVG(stats, classColor) {
        const labels = [
            { key:'atk', label:'ATK', angle: -90 },
            { key:'agi', label:'AGI', angle: -30 },
            { key:'sab', label:'SAB', angle: 30 },
            { key:'def', label:'DEF', angle: 90 },
            { key:'int', label:'INT', angle: 150 },
            { key:'for', label:'FOR', angle: 210 },
        ];
        const cx=100, cy=100, R=75;
        const toRad = d => d * Math.PI / 180;

        // Grid rings
        let grid = '';
        for (let r = 0.25; r <= 1; r += 0.25) {
            const pts = labels.map(l => {
                const a = toRad(l.angle);
                return `${cx + R*r*Math.cos(a)},${cy + R*r*Math.sin(a)}`;
            }).join(' ');
            grid += `<polygon points="${pts}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;
        }
        // Axes
        let axes = '';
        labels.forEach(l => {
            const a = toRad(l.angle);
            axes += `<line x1="${cx}" y1="${cy}" x2="${cx+R*Math.cos(a)}" y2="${cy+R*Math.sin(a)}" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>`;
        });
        // Data polygon
        const dataPts = labels.map(l => {
            const v = (stats[l.key]||0)/100;
            const a = toRad(l.angle);
            return `${cx + R*v*Math.cos(a)},${cy + R*v*Math.sin(a)}`;
        }).join(' ');
        // Labels
        let lbls = '';
        labels.forEach(l => {
            const a = toRad(l.angle);
            const lx = cx + (R+18)*Math.cos(a);
            const ly = cy + (R+18)*Math.sin(a);
            lbls += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" fill="rgba(255,255,255,0.7)" font-size="10" font-weight="600">${l.label}</text>`;
            lbls += `<text x="${lx}" y="${ly+12}" text-anchor="middle" dominant-baseline="middle" fill="${classColor}" font-size="9" font-weight="700">${stats[l.key]}</text>`;
        });

        return `<svg viewBox="0 0 200 200" class="rpg-radar">
            ${grid}${axes}
            <polygon points="${dataPts}" fill="${classColor}22" stroke="${classColor}" stroke-width="2" class="rpg-radar-poly"/>
            ${lbls}
        </svg>`;
    }

    // Class-specific weapon/item SVGs for the 3D character
    const CLASS_WEAPONS = {
        warrior: `<svg viewBox="0 0 40 80" class="char-weapon char-weapon-sword"><path d="M18 5 L22 5 L23 50 L20 55 L17 50 Z" fill="#c0c0c0" stroke="#888" stroke-width="0.5"/><path d="M12 50 L28 50 L26 54 L14 54 Z" fill="#8d6e63"/><path d="M17 54 L23 54 L22 70 L18 70 Z" fill="#5d4037"/><path d="M19 8 L21 8 L21.5 45 L18.5 45 Z" fill="rgba(255,255,255,0.3)"/></svg>`,
        assassin: `<svg viewBox="0 0 40 80" class="char-weapon char-weapon-dagger"><path d="M19 10 L21 10 L22 45 L20 50 L18 45 Z" fill="#b0bec5" stroke="#78909c" stroke-width="0.5"/><path d="M16 45 L24 45 L22 48 L18 48 Z" fill="#6a1b9a"/><path d="M18 48 L22 48 L21 62 L19 62 Z" fill="#4a148c"/></svg>`,
        guardian: `<svg viewBox="0 0 60 70" class="char-weapon char-weapon-shield"><path d="M10 8 L50 8 L50 15 Q50 55 30 65 Q10 55 10 15 Z" fill="#1565c0" stroke="#0d47a1" stroke-width="1.5"/><path d="M15 13 L45 13 L45 18 Q45 50 30 58 Q15 50 15 18 Z" fill="#1976d2"/><path d="M25 20 L35 20 L35 40 L30 45 L25 40 Z" fill="#ffd740" opacity="0.8"/><circle cx="30" cy="30" r="5" fill="#ffd740" opacity="0.6"/></svg>`,
        oracle: `<svg viewBox="0 0 40 80" class="char-weapon char-weapon-staff"><line x1="20" y1="8" x2="20" y2="72" stroke="#5d4037" stroke-width="3" stroke-linecap="round"/><circle cx="20" cy="10" r="7" fill="none" stroke="#00acc1" stroke-width="1.5"/><circle cx="20" cy="10" r="3" fill="#00e5ff" class="char-orb"/></svg>`,
        sovereign: `<svg viewBox="0 0 50 50" class="char-weapon char-weapon-crown"><path d="M8 35 L14 15 L20 28 L25 10 L30 28 L36 15 L42 35 Z" fill="#fdd835" stroke="#f9a825" stroke-width="1"/><rect x="8" y="35" width="34" height="6" rx="2" fill="#f9a825"/><circle cx="14" cy="17" r="2" fill="#e53935"/><circle cx="25" cy="12" r="2.5" fill="#1e88e5"/><circle cx="36" cy="17" r="2" fill="#66bb6a"/></svg>`,
        sage: `<svg viewBox="0 0 50 60" class="char-weapon char-weapon-book"><rect x="8" y="10" width="34" height="42" rx="2" fill="#2e7d32" stroke="#1b5e20" stroke-width="1"/><rect x="10" y="12" width="30" height="38" rx="1" fill="#388e3c"/><line x1="25" y1="14" x2="25" y2="48" stroke="#1b5e20" stroke-width="1"/><path d="M14 20 L22 20 M14 25 L22 25 M14 30 L22 30" stroke="rgba(255,255,255,0.3)" stroke-width="0.8"/><circle cx="32" cy="30" r="5" fill="#ffd740" opacity="0.5"/></svg>`,
    };

    // Build a CSS 3D character body (humanoid figure) for the card
    function buildCharacterHTML(stats, ic, classId, rankColor) {
        const cc = stats.rpgClass.color;
        // Body proportions scaled by stats
        const bodyScale = 0.8 + (stats.power / 100) * 0.4; // 0.8 to 1.2
        const shoulderW = 28 + (stats.atk / 100) * 14; // wider shoulders for ATK
        const legH = 40 + (stats.agi / 100) * 10; // longer legs for AGI

        // Armor detail level based on rank
        const armorOpacity = 0.3 + (stats.power / 100) * 0.7;
        const weaponHTML = CLASS_WEAPONS[classId] || '';

        return `
        <div class="char-scene">
            <div class="char-body-wrap" style="--cc:${cc};--rc:${rankColor};--body-scale:${bodyScale}">
                <!-- Aura/glow behind character -->
                <div class="char-aura" style="background:radial-gradient(ellipse, ${cc}30 0%, transparent 70%)"></div>
                <!-- Floating particles around character -->
                <div class="char-particles">
                    <span style="--d:0;--x:-20px;--color:${cc}"></span>
                    <span style="--d:1s;--x:25px;--color:${cc}"></span>
                    <span style="--d:2s;--x:-10px;--color:${rankColor}"></span>
                    <span style="--d:0.5s;--x:15px;--color:${rankColor}"></span>
                </div>
                <!-- The 3D character -->
                <div class="char-figure">
                    <!-- Head -->
                    <div class="char-head">
                        <div class="char-face">
                            <img src="${profImg(ic)}" alt="" class="char-face-img">
                        </div>
                        <div class="char-helmet" style="border-color:${cc}"></div>
                        ${classId === 'sovereign' ? `<div class="char-crown-wrap">${CLASS_WEAPONS.sovereign}</div>` : ''}
                    </div>
                    <!-- Neck -->
                    <div class="char-neck" style="background:${cc}"></div>
                    <!-- Torso/Body -->
                    <div class="char-torso" style="--sw:${shoulderW}px">
                        <div class="char-chest" style="background:linear-gradient(180deg, ${cc}cc, ${cc}88)"></div>
                        <div class="char-armor-detail" style="opacity:${armorOpacity}">
                            <div class="char-armor-symbol">${stats.rpgClass.icon}</div>
                        </div>
                        <div class="char-belt" style="background:${cc}"></div>
                    </div>
                    <!-- Arms -->
                    <div class="char-arms">
                        <div class="char-arm char-arm-l" style="background:linear-gradient(180deg, ${cc}aa, ${cc}66)">
                            <div class="char-hand char-hand-l"></div>
                        </div>
                        <div class="char-arm char-arm-r" style="background:linear-gradient(180deg, ${cc}aa, ${cc}66)">
                            <div class="char-hand char-hand-r"></div>
                            ${classId !== 'sovereign' ? `<div class="char-held-item">${weaponHTML}</div>` : ''}
                        </div>
                    </div>
                    <!-- Legs -->
                    <div class="char-legs" style="--lh:${legH}px">
                        <div class="char-leg char-leg-l" style="background:linear-gradient(180deg, ${cc}66, ${cc}33)">
                            <div class="char-boot" style="background:${cc}"></div>
                        </div>
                        <div class="char-leg char-leg-r" style="background:linear-gradient(180deg, ${cc}66, ${cc}33)">
                            <div class="char-boot" style="background:${cc}"></div>
                        </div>
                    </div>
                </div>
                <!-- Ground shadow -->
                <div class="char-shadow"></div>
                <!-- Pedestal -->
                <div class="char-pedestal" style="border-color:${cc}40">
                    <div class="char-pedestal-glow" style="background:${cc}"></div>
                </div>
            </div>
        </div>`;
    }

    async function renderArenaRPG() {
        app.innerHTML = `
        <div class="rpg-hero">
            <div class="rpg-hero-bg"></div>
            <div class="rpg-hero-particles" id="rpg-particles"></div>
            <div class="rpg-hero-inner">
                <div class="rpg-title-icon">⚔️</div>
                <h1>Arena <span>RPG</span></h1>
                <p>Cada guerreiro forjado pelas últimas 20 batalhas — stats reais, ranks únicos</p>
                <div class="rpg-hero-actions">
                    <button class="rpg-action-btn" onclick="showBattle()">⚔️ Batalha 1v1</button>
                    <button class="rpg-action-btn" onclick="showTeamBattle()">👥 Times</button>
                    <button class="rpg-action-btn" onclick="showTournament()">🏆 Torneio</button>
                    <button class="rpg-action-btn" onclick="showRankingLadder()">📊 Ranking</button>
                    <button class="rpg-action-btn" onclick="showSquadPredictions()">🎯 Palpites</button>
                </div>
            </div>
        </div>
        <div class="rpg-legend">
            ${RPG_CLASSES.map(c => `<div class="rpg-legend-item"><span class="rpg-legend-icon" style="color:${c.color}">${c.icon}</span><span class="rpg-legend-name" style="color:${c.color}">${c.name}</span></div>`).join('')}
        </div>
        <div class="rpg-guide">
            <button class="rpg-guide-toggle" onclick="this.parentElement.classList.toggle('open')">Guia de Atributos <span class="rpg-guide-arrow">&#9660;</span></button>
            <div class="rpg-guide-content">
                <div class="rpg-guide-grid">
                    <div class="rpg-guide-item"><span class="rpg-guide-icon" style="color:#e53935">⚔️</span><div><b>ATK (Ataque)</b><p>Dano por minuto (DPM). Mede quanto dano o jogador causa aos campeões inimigos a cada minuto de jogo. Quanto mais alto, mais agressivo e impactante nas teamfights.</p></div></div>
                    <div class="rpg-guide-item"><span class="rpg-guide-icon" style="color:#1e88e5">🛡️</span><div><b>DEF (Defesa)</b><p>Sobrevivência baseada em mortes por jogo. Quanto menos morre, maior o DEF. Um jogador com DEF alto sabe se posicionar e evitar ser abatido.</p></div></div>
                    <div class="rpg-guide-item"><span class="rpg-guide-icon" style="color:#ab47bc">🗡️</span><div><b>AGI (Agilidade)</b><p>KDA (Kills+Assists/Deaths). Representa a eficiência geral em combate. Um jogador ágil participa de muitos abates e morre pouco.</p></div></div>
                    <div class="rpg-guide-item"><span class="rpg-guide-icon" style="color:#00acc1">👁️</span><div><b>INT (Inteligência)</b><p>Placar de visão médio. Mede o controle de visão do mapa — wards colocadas, wards destruídas, controle de objetivos. Visão ganha jogos.</p></div></div>
                    <div class="rpg-guide-item"><span class="rpg-guide-icon" style="color:#fdd835">👑</span><div><b>FOR (Fortuna)</b><p>Ouro por minuto (GPM). Mede a capacidade de gerar recursos — farm, abates, objetivos. Mais ouro = mais itens = mais poder.</p></div></div>
                    <div class="rpg-guide-item"><span class="rpg-guide-icon" style="color:#66bb6a">✨</span><div><b>SAB (Sabedoria)</b><p>Taxa de vitória (Win Rate). O stat mais importante — no final, o que importa é vencer. Um jogador sábio toma as decisões certas para fechar o jogo.</p></div></div>
                </div>
                <div class="rpg-guide-section">
                    <h4>Como funciona a Classe</h4>
                    <p>Cada jogador recebe a classe do seu atributo mais alto. Se seu ATK é o maior, você é <b style="color:#e53935">Guerreiro</b>. Se é o DEF, <b style="color:#1e88e5">Guardião</b>. E assim por diante.</p>
                </div>
                <div class="rpg-guide-section">
                    <h4>Virtudes e Defeitos</h4>
                    <p><span style="color:#4caf50">Virtudes</span> aparecem quando um stat está acima de 70 — o jogador é excepcional naquela área. <span style="color:#ef5350">Defeitos</span> aparecem quando está abaixo de 30 — um ponto fraco evidente. Combos especiais são detectados, como "Canhão de vidro" (ATK alto + DEF baixo).</p>
                </div>
                <div class="rpg-guide-section">
                    <h4>Ranks</h4>
                    <p>O Poder é a média dos 6 atributos. Ele define o rank: <span style="color:#78909c">Aprendiz</span> → <span style="color:#66bb6a">Soldado</span> → <span style="color:#42a5f5">Veterano</span> → <span style="color:#ab47bc">Elite</span> → <span style="color:#ffa726">Campeão</span> → <span style="color:#ef5350">Lendário</span> → <span style="color:#e040fb">Mítico</span> → <span style="color:#ffd740">Divino</span>.</p>
                </div>
            </div>
        </div>
        <div class="rpg-evo-section">
            <h3>Evolução de Poder</h3>
            <div id="rpg-evo-chart"><div class="ld"><div class="sp"></div></div></div>
        </div>
        <div class="rpg-grid" id="rpg-grid">
            ${PLAYERS.map((_,i) => `<div class="rpg-card rpg-card-loading rpg-card-enter" data-rpg="${i}" style="--enter-i:${i}">
                <div class="rpg-card-skel"><div class="skel-pulse" style="width:80px;height:80px;border-radius:50%;margin:0 auto 12px"></div><div class="skel-pulse" style="width:60%;height:16px;margin:0 auto 8px;border-radius:4px"></div><div class="skel-pulse" style="width:40%;height:12px;margin:0 auto;border-radius:4px"></div></div>
            </div>`).join('')}
        </div>`;

        initParticles(document.getElementById('rpg-particles'));

        const allRPGStats = [];
        const promises = PLAYERS.map(async (p, i) => {
            try {
                const d = await loadPlayer(i);
                const mt = Array.isArray(d.matches) ? d.matches : [];
                const puuid = d.account?.puuid;
                if (!puuid || !mt.length) { allRPGStats[i]=null; return renderRPGCardEmpty(i, p, d); }
                const stats = calcRPGStats(mt, puuid, d.league);
                if (!stats) { allRPGStats[i]=null; return renderRPGCardEmpty(i, p, d); }
                stats.idx = i;
                allRPGStats[i] = stats;
                renderRPGCard(i, p, d, stats);
            } catch(_) {
                allRPGStats[i]=null;
                renderRPGCardEmpty(i, p, null);
            }
        });
        await Promise.all(promises);

        // Sort cards by power (highest first)
        const grid = document.getElementById('rpg-grid');
        if (grid) {
            const cards = [...grid.children];
            cards.sort((a, b) => {
                const ai = parseInt(a.dataset.rpg), bi = parseInt(b.dataset.rpg);
                const pa = allRPGStats[ai]?.power || -1, pb = allRPGStats[bi]?.power || -1;
                return pb - pa;
            });
            cards.forEach((c, idx) => {
                c.style.setProperty('--enter-i', idx);
                grid.appendChild(c);
            });
        }

        // Save weekly RPG snapshot
        saveRPGSnapshot(allRPGStats.filter(Boolean));

        // Load and render evolution chart
        const evoChart = document.getElementById('rpg-evo-chart');
        if (evoChart) {
            const history = await loadRPGHistory();
            renderEvolutionChart(evoChart, history);
        }
    }

    function renderRPGCardEmpty(i, p, d) {
        const card = document.querySelector(`[data-rpg="${i}"]`);
        if (!card) return;
        card.classList.remove('rpg-card-loading');
        const ic = d ? playerIcon(i, d.summoner?.profileIconId) : 5885;
        card.innerHTML = `
            <div class="rpg-card-avatar"><img src="${profImg(ic)}" alt=""></div>
            <div class="rpg-card-name">${d?.account?.gameName || p.name}</div>
            <div class="rpg-card-empty">Sem dados suficientes para forjar guerreiro</div>`;
    }

    function renderRPGCard(i, p, d, stats) {
        const card = document.querySelector(`[data-rpg="${i}"]`);
        if (!card) return;
        card.classList.remove('rpg-card-loading');
        card.classList.add(`rpg-class-${stats.rpgClass.id}`);
        card.style.setProperty('--class-color', stats.rpgClass.color);
        card.style.setProperty('--rank-glow', stats.rank.glow);

        const ic = playerIcon(i, d.summoner?.profileIconId);
        const champName = stats.topChampId ? (CMAP[stats.topChampId] || null) : null;
        const splashUrl = champName ? `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champName}_0.jpg` : '';

        const statBars = [
            { key:'atk', label:'ATK', icon:'⚔️' },
            { key:'def', label:'DEF', icon:'🛡️' },
            { key:'agi', label:'AGI', icon:'🗡️' },
            { key:'int', label:'INT', icon:'👁️' },
            { key:'for', label:'FOR', icon:'👑' },
            { key:'sab', label:'SAB', icon:'✨' },
        ];

        card.innerHTML = `
            ${splashUrl ? `<div class="rpg-card-splash" style="background-image:url('${splashUrl}')"></div>` : ''}
            <div class="rpg-card-rank-badge" style="background:${stats.rank.color}">${stats.rank.name}</div>
            <div class="rpg-card-class-badge" style="background:${stats.rpgClass.color}">${stats.rpgClass.icon} ${stats.rpgClass.name}</div>

            <!-- 3D CHARACTER BODY -->
            ${buildCharacterHTML(stats, ic, stats.rpgClass.id, stats.rank.color)}

            <div class="rpg-card-name-plate">
                <div class="rpg-card-name">${d.account?.gameName || p.name}</div>
                <div class="rpg-card-title" style="color:${stats.rpgClass.color}">${stats.rpgClass.desc}</div>
            </div>

            <div class="rpg-card-power">
                <div class="rpg-power-label">PODER</div>
                <div class="rpg-power-value" style="color:${stats.rank.color}">${stats.power}</div>
                <div class="rpg-power-bar"><div class="rpg-power-fill" style="width:${stats.power}%;background:linear-gradient(90deg,${stats.rpgClass.color},${stats.rank.color})"></div></div>
            </div>

            <div class="rpg-card-body-lower">
                <div class="rpg-card-radar">${rpgRadarSVG(stats, stats.rpgClass.color)}</div>
                <div class="rpg-card-stats">
                    ${statBars.map(s => `<div class="rpg-stat-row">
                        <span class="rpg-stat-icon">${s.icon}</span>
                        <span class="rpg-stat-label">${s.label}</span>
                        <div class="rpg-stat-bar"><div class="rpg-stat-fill" style="width:${stats[s.key]}%;background:${stats.rpgClass.color}"></div></div>
                        <span class="rpg-stat-val">${stats[s.key]}</span>
                    </div>`).join('')}
                </div>
            </div>

            <div class="rpg-card-traits">
                ${stats.virtues.length ? `<div class="rpg-traits-col rpg-virtues"><div class="rpg-traits-title virtues-title">Virtudes</div>${stats.virtues.map(v => `<div class="rpg-trait rpg-virtue"><span>${v.icon}</span> ${v.text}</div>`).join('')}</div>` : ''}
                ${stats.flaws.length ? `<div class="rpg-traits-col rpg-flaws"><div class="rpg-traits-title flaws-title">Defeitos</div>${stats.flaws.map(f => `<div class="rpg-trait rpg-flaw"><span>${f.icon}</span> ${f.text}</div>`).join('')}</div>` : ''}
            </div>

            <div class="rpg-card-footer">
                <span>${stats.raw.games} batalhas &bull; ${stats.raw.wins}V ${stats.raw.games - stats.raw.wins}D</span>
                ${champName ? `<span>Main: ${champName}</span>` : ''}
            </div>`;

        // Animate stat bars
        setTimeout(() => {
            card.querySelectorAll('.rpg-stat-fill').forEach(el => {
                el.style.transition = 'width 1s cubic-bezier(0.4,0,0.2,1)';
            });
            const pf = card.querySelector('.rpg-power-fill');
            if (pf) pf.style.transition = 'width 1.2s cubic-bezier(0.4,0,0.2,1)';
        }, 50);

        // 3D tilt on whole card
        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;
            card.style.transform = `perspective(1000px) rotateY(${x*10}deg) rotateX(${-y*10}deg) scale3d(1.02,1.02,1.02)`;
            // Character reacts to mouse — slight lean
            const fig = card.querySelector('.char-figure');
            if (fig) fig.style.transform = `rotateY(${x*15}deg) translateX(${x*5}px)`;
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
            const fig = card.querySelector('.char-figure');
            if (fig) fig.style.transform = '';
        });
    }

    // ======================== BATTLE 1v1 ========================
    window.showBattle = function() {
        const modal = document.createElement('div');
        modal.id = 'battle-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `<div class="modal-box battle-box">
            <button class="modal-close" onclick="document.getElementById('battle-modal').remove()">&times;</button>
            <div class="modal-header"><h2>Batalha 1v1</h2><p>Escolha dois guerreiros para duelar!</p></div>
            <div class="battle-select">
                <select id="battle-p1" class="battle-sel">${PLAYERS.map((p,i)=>`<option value="${i}">${p.name}</option>`).join('')}</select>
                <span class="battle-vs-text">VS</span>
                <select id="battle-p2" class="battle-sel">${PLAYERS.map((p,i)=>`<option value="${i}" ${i===1?'selected':''}>${p.name}</option>`).join('')}</select>
            </div>
            <button class="battle-start-btn" onclick="startBattle()">LUTAR!</button>
            <div id="battle-arena"></div>
        </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
    };

    window.startBattle = async function() {
        const i1 = parseInt(document.getElementById('battle-p1').value);
        const i2 = parseInt(document.getElementById('battle-p2').value);
        if (i1 === i2) return;
        const arena = document.getElementById('battle-arena');
        arena.innerHTML = '<div class="ld"><div class="sp"></div></div>';
        const [d1, d2] = await Promise.all([loadPlayer(i1), loadPlayer(i2)]);
        const mt1=Array.isArray(d1.matches)?d1.matches:[], mt2=Array.isArray(d2.matches)?d2.matches:[];
        const s1 = calcRPGStats(mt1, d1.account?.puuid, d1.league);
        const s2 = calcRPGStats(mt2, d2.account?.puuid, d2.league);
        if (!s1 || !s2) { arena.innerHTML = '<p style="color:var(--dim);text-align:center;">Dados insuficientes</p>'; return; }

        // Compare stats
        const cats = ['atk','def','agi','int','for','sab'];
        let score1=0, score2=0;
        const results = cats.map(c => {
            const v1=s1[c], v2=s2[c];
            if(v1>v2) { score1++; return {cat:c,winner:1}; }
            else if(v2>v1) { score2++; return {cat:c,winner:2}; }
            return {cat:c,winner:0};
        });
        const winner = score1>score2 ? 1 : score2>score1 ? 2 : (s1.power>s2.power?1:s2.power>s1.power?2:0);
        const n1=d1.account?.gameName||PLAYERS[i1].name, n2=d2.account?.gameName||PLAYERS[i2].name;
        const ic1=playerIcon(i1,d1.summoner?.profileIconId), ic2=playerIcon(i2,d2.summoner?.profileIconId);

        // Save battle to Firebase
        if(db) db.ref('battles').push({p1:i1,p2:i2,winner:winner===1?i1:winner===2?i2:'draw',s1:score1,s2:score2,ts:Date.now()}).catch(()=>{});

        const catIcons = {atk:'⚔️',def:'🛡️',agi:'🗡️',int:'👁️',for:'👑',sab:'✨'};
        const catNames = {atk:'ATK',def:'DEF',agi:'AGI',int:'INT',for:'FOR',sab:'SAB'};

        arena.innerHTML = `
        <div class="battle-field">
            <div class="battle-fighter battle-f-left ${winner===1?'battle-winner':''}${winner===2?' battle-loser':''}">
                <div class="battle-fighter-avatar" style="border-color:${s1.rpgClass.color}"><img src="${profImg(ic1)}"></div>
                <div class="battle-fighter-name">${n1}</div>
                <div class="battle-fighter-class" style="color:${s1.rpgClass.color}">${s1.rpgClass.icon} ${s1.rpgClass.name}</div>
                <div class="battle-fighter-power">${s1.power}</div>
            </div>
            <div class="battle-center">
                <div class="battle-score">${score1} — ${score2}</div>
                <div class="battle-result" style="color:${winner===1?s1.rpgClass.color:winner===2?s2.rpgClass.color:'var(--dim)'}">${winner===1?n1+' VENCE!':winner===2?n2+' VENCE!':'EMPATE!'}</div>
            </div>
            <div class="battle-fighter battle-f-right ${winner===2?'battle-winner':''}${winner===1?' battle-loser':''}">
                <div class="battle-fighter-avatar" style="border-color:${s2.rpgClass.color}"><img src="${profImg(ic2)}"></div>
                <div class="battle-fighter-name">${n2}</div>
                <div class="battle-fighter-class" style="color:${s2.rpgClass.color}">${s2.rpgClass.icon} ${s2.rpgClass.name}</div>
                <div class="battle-fighter-power">${s2.power}</div>
            </div>
        </div>
        <div class="battle-breakdown">${results.map(r => `<div class="battle-row">
            <span class="battle-val ${r.winner===1?'battle-win':''}">${s1[r.cat]}</span>
            <span class="battle-cat">${catIcons[r.cat]} ${catNames[r.cat]}</span>
            <span class="battle-val ${r.winner===2?'battle-win':''}">${s2[r.cat]}</span>
        </div>`).join('')}</div>
        <button class="battle-again-btn" onclick="startBattle()">Lutar de novo!</button>`;

        // Battle animations
        setTimeout(() => {
            arena.querySelector('.battle-f-left')?.classList.add('battle-attack');
            setTimeout(() => arena.querySelector('.battle-f-right')?.classList.add('battle-attack'), 300);
            setTimeout(() => {
                arena.querySelector('.battle-f-left')?.classList.remove('battle-attack');
                arena.querySelector('.battle-f-right')?.classList.remove('battle-attack');
                if(winner===2) arena.querySelector('.battle-f-left')?.classList.add('battle-hit');
                if(winner===1) arena.querySelector('.battle-f-right')?.classList.add('battle-hit');
                playSFX('hit');
            }, 600);
            setTimeout(() => playSFX(winner?'victory':'navigate'), 1000);
        }, 200);
    };

    // ======================== TEAM BATTLE ========================
    window.showTeamBattle = function() {
        const modal = document.createElement('div');
        modal.id = 'team-battle-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `<div class="modal-box battle-box" style="max-width:700px;">
            <button class="modal-close" onclick="document.getElementById('team-battle-modal').remove()">&times;</button>
            <div class="modal-header"><h2>⚔️ Batalha em Equipe</h2><p>Divida o squad em dois times e descubra quem vence!</p></div>
            <div class="team-battle-mode">
                <button class="rpg-action-btn" onclick="randomTeamBattle()" style="margin:6px;">🎲 Times Aleatórios</button>
                <button class="rpg-action-btn" onclick="draftTeamBattle()" style="margin:6px;">📋 Escolher Times</button>
            </div>
            <div id="team-battle-arena"></div>
        </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
    };

    window.randomTeamBattle = async function() {
        const arena = document.getElementById('team-battle-arena');
        if (!arena) return;
        arena.innerHTML = '<div class="ld"><div class="sp"></div></div>';
        // Shuffle players and split
        const indices = PLAYERS.map((_,i) => i);
        for (let i = indices.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [indices[i],indices[j]]=[indices[j],indices[i]]; }
        const half = Math.ceil(indices.length / 2);
        const team1 = indices.slice(0, half);
        const team2 = indices.slice(half);
        await executeTeamBattle(arena, team1, team2);
    };

    window.draftTeamBattle = function() {
        const arena = document.getElementById('team-battle-arena');
        if (!arena) return;
        arena.innerHTML = `
        <div class="team-draft">
            <div class="team-draft-col">
                <h3 style="color:#4fc3f7;">Time Azul</h3>
                <div id="draft-team1" class="draft-pool"></div>
            </div>
            <div class="team-draft-col">
                <h3 style="color:#ef5350;">Time Vermelho</h3>
                <div id="draft-team2" class="draft-pool"></div>
            </div>
        </div>
        <div class="draft-available">
            <p style="color:var(--dim);font-size:.85em;margin-bottom:8px;">Clique para adicionar ao time (alterna entre Azul/Vermelho)</p>
            <div id="draft-players">${PLAYERS.map((p,i) => `<button class="draft-player-btn" data-idx="${i}" onclick="toggleDraftPlayer(${i})">${p.name}</button>`).join('')}</div>
        </div>
        <button class="battle-start-btn" onclick="startDraftBattle()" style="margin-top:12px;">BATALHAR!</button>`;
    };

    const _draftState = { team1: new Set(), team2: new Set() };
    window.toggleDraftPlayer = function(idx) {
        const btn = document.querySelector(`.draft-player-btn[data-idx="${idx}"]`);
        if (_draftState.team1.has(idx)) {
            _draftState.team1.delete(idx);
            _draftState.team2.add(idx);
            btn.className = 'draft-player-btn draft-red';
        } else if (_draftState.team2.has(idx)) {
            _draftState.team2.delete(idx);
            btn.className = 'draft-player-btn';
        } else {
            _draftState.team1.add(idx);
            btn.className = 'draft-player-btn draft-blue';
        }
        // Update visual pools
        const t1El = document.getElementById('draft-team1');
        const t2El = document.getElementById('draft-team2');
        if (t1El) t1El.innerHTML = [..._draftState.team1].map(i => `<span class="draft-tag draft-blue">${PLAYERS[i].name}</span>`).join('') || '<span style="color:var(--dim);font-size:.8em;">Nenhum</span>';
        if (t2El) t2El.innerHTML = [..._draftState.team2].map(i => `<span class="draft-tag draft-red">${PLAYERS[i].name}</span>`).join('') || '<span style="color:var(--dim);font-size:.8em;">Nenhum</span>';
    };

    window.startDraftBattle = async function() {
        if (_draftState.team1.size < 1 || _draftState.team2.size < 1) return;
        const arena = document.getElementById('team-battle-arena');
        if (!arena) return;
        arena.innerHTML = '<div class="ld"><div class="sp"></div></div>';
        await executeTeamBattle(arena, [..._draftState.team1], [..._draftState.team2]);
        _draftState.team1.clear();
        _draftState.team2.clear();
    };

    async function executeTeamBattle(arena, team1, team2) {
        const allData = await Promise.all(PLAYERS.map((_,i) => loadPlayer(i).catch(()=>null)));
        const getStats = (idx) => {
            const d = allData[idx];
            if (!d) return null;
            const mt = Array.isArray(d.matches)?d.matches:[];
            return calcRPGStats(mt, d.account?.puuid, d.league);
        };

        const stats1 = team1.map(i => ({ idx: i, stats: getStats(i) })).filter(x => x.stats);
        const stats2 = team2.map(i => ({ idx: i, stats: getStats(i) })).filter(x => x.stats);
        if (!stats1.length || !stats2.length) { arena.innerHTML = '<p style="color:var(--dim);text-align:center;">Dados insuficientes</p>'; return; }

        // Team power = average power of members
        const teamPower1 = stats1.reduce((s,x) => s + x.stats.power, 0) / stats1.length;
        const teamPower2 = stats2.reduce((s,x) => s + x.stats.power, 0) / stats2.length;

        // Compare each stat category as team averages
        const cats = ['atk','def','agi','int','for','sab'];
        const catIcons = {atk:'⚔️',def:'🛡️',agi:'🗡️',int:'👁️',for:'👑',sab:'✨'};
        const catNames = {atk:'ATK',def:'DEF',agi:'AGI',int:'INT',for:'FOR',sab:'SAB'};
        let score1=0, score2=0;
        const results = cats.map(c => {
            const avg1 = stats1.reduce((s,x) => s + x.stats[c], 0) / stats1.length;
            const avg2 = stats2.reduce((s,x) => s + x.stats[c], 0) / stats2.length;
            if (avg1 > avg2) { score1++; return {cat:c,winner:1,v1:avg1.toFixed(0),v2:avg2.toFixed(0)}; }
            else if (avg2 > avg1) { score2++; return {cat:c,winner:2,v1:avg1.toFixed(0),v2:avg2.toFixed(0)}; }
            return {cat:c,winner:0,v1:avg1.toFixed(0),v2:avg2.toFixed(0)};
        });
        const winner = score1>score2 ? 1 : score2>score1 ? 2 : (teamPower1>teamPower2?1:teamPower2>teamPower1?2:0);

        // Save to Firebase
        if(db) db.ref('teamBattles').push({team1:team1,team2:team2,winner,s1:score1,s2:score2,ts:Date.now()}).catch(()=>{});

        const renderTeamSide = (members, color, isWinner) => `
            <div class="tb-team-side ${isWinner?'battle-winner':''}">
                <div class="tb-team-members">${members.map(m => {
                    const d = allData[m.idx];
                    const ic = playerIcon(m.idx, d?.summoner?.profileIconId);
                    return `<div class="tb-team-member">
                        <img src="${profImg(ic)}" class="tb-member-icon" style="border-color:${m.stats.rpgClass.color}">
                        <span class="tb-member-name">${d?.account?.gameName||PLAYERS[m.idx].name}</span>
                        <span class="tb-member-power" style="color:${m.stats.rank.color}">${m.stats.power}</span>
                    </div>`;
                }).join('')}</div>
                <div class="tb-team-power" style="color:${color}">${(members.reduce((s,m)=>s+m.stats.power,0)/members.length).toFixed(0)}</div>
            </div>`;

        arena.innerHTML = `
        <div class="team-battle-field">
            ${renderTeamSide(stats1, '#4fc3f7', winner===1)}
            <div class="battle-center">
                <div class="battle-score">${score1} — ${score2}</div>
                <div class="battle-result" style="color:${winner===1?'#4fc3f7':winner===2?'#ef5350':'var(--dim)'}">${winner===1?'TIME AZUL VENCE!':winner===2?'TIME VERMELHO VENCE!':'EMPATE!'}</div>
            </div>
            ${renderTeamSide(stats2, '#ef5350', winner===2)}
        </div>
        <div class="battle-breakdown">${results.map(r => `<div class="battle-row">
            <span class="battle-val ${r.winner===1?'battle-win':''}">${r.v1}</span>
            <span class="battle-cat">${catIcons[r.cat]} ${catNames[r.cat]}</span>
            <span class="battle-val ${r.winner===2?'battle-win':''}">${r.v2}</span>
        </div>`).join('')}</div>
        <button class="battle-again-btn" onclick="randomTeamBattle()">🎲 Sortear de novo!</button>`;
        playSFX(winner ? 'victory' : 'navigate');
    }

    // ======================== TOURNAMENT (BRACKET) ========================
    window.showTournament = function() {
        const modal = document.createElement('div');
        modal.id = 'tournament-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `<div class="modal-box battle-box" style="max-width:800px;">
            <button class="modal-close" onclick="document.getElementById('tournament-modal').remove()">&times;</button>
            <div class="modal-header"><h2>🏆 Torneio</h2><p>Bracket automático com todos os guerreiros!</p></div>
            <div id="tournament-arena"><div class="ld"><div class="sp"></div></div></div>
        </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
        runTournament();
    };

    async function runTournament() {
        const arena = document.getElementById('tournament-arena');
        if (!arena) return;
        const allData = await Promise.all(PLAYERS.map((_,i) => loadPlayer(i).catch(()=>null)));
        // Build participants with stats
        let participants = [];
        PLAYERS.forEach((p, i) => {
            const d = allData[i];
            if (!d) return;
            const mt = Array.isArray(d.matches)?d.matches:[];
            const stats = calcRPGStats(mt, d.account?.puuid, d.league);
            if (stats) participants.push({ idx: i, name: d.account?.gameName||p.name, stats, icon: playerIcon(i, d.summoner?.profileIconId) });
        });
        if (participants.length < 2) { arena.innerHTML = '<p style="color:var(--dim);text-align:center;">Jogadores insuficientes</p>'; return; }

        // Shuffle participants
        for (let i = participants.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [participants[i],participants[j]]=[participants[j],participants[i]]; }

        // Run bracket rounds
        const rounds = [];
        let current = [...participants];
        while (current.length > 1) {
            const round = [];
            for (let i = 0; i < current.length; i += 2) {
                if (i + 1 < current.length) {
                    const p1 = current[i], p2 = current[i+1];
                    const cats = ['atk','def','agi','int','for','sab'];
                    let s1=0, s2=0;
                    cats.forEach(c => { if(p1.stats[c]>p2.stats[c]) s1++; else if(p2.stats[c]>p1.stats[c]) s2++; });
                    const winner = s1>s2 ? p1 : s2>s1 ? p2 : (p1.stats.power>=p2.stats.power?p1:p2);
                    round.push({ p1, p2, winner, s1, s2 });
                } else {
                    // Bye - auto-advance
                    round.push({ p1: current[i], p2: null, winner: current[i], s1: 0, s2: 0 });
                }
            }
            rounds.push(round);
            current = round.map(r => r.winner);
        }

        const champion = current[0];

        // Save to Firebase
        if(db) db.ref('tournaments').push({champion:champion.idx,participants:participants.map(p=>p.idx),ts:Date.now()}).catch(()=>{});

        // Render bracket
        let bracketHTML = '<div class="tournament-bracket">';
        rounds.forEach((round, ri) => {
            bracketHTML += `<div class="tournament-round"><div class="tournament-round-title">${ri === rounds.length-1 ? 'Final' : ri === rounds.length-2 ? 'Semifinal' : 'Rodada '+(ri+1)}</div>`;
            round.forEach(match => {
                const p1Win = match.winner === match.p1;
                const p2Win = match.p2 && match.winner === match.p2;
                bracketHTML += `<div class="tournament-match">
                    <div class="tournament-player ${p1Win?'tournament-winner':''}" style="border-color:${match.p1.stats.rpgClass.color}">
                        <img src="${profImg(match.p1.icon)}" class="tournament-icon">
                        <span>${match.p1.name}</span>
                        <span class="tournament-pwr">${match.p1.stats.power}</span>
                    </div>
                    ${match.p2 ? `<div class="tournament-vs">${match.s1}-${match.s2}</div>
                    <div class="tournament-player ${p2Win?'tournament-winner':''}" style="border-color:${match.p2.stats.rpgClass.color}">
                        <img src="${profImg(match.p2.icon)}" class="tournament-icon">
                        <span>${match.p2.name}</span>
                        <span class="tournament-pwr">${match.p2.stats.power}</span>
                    </div>` : '<div class="tournament-vs">BYE</div>'}
                </div>`;
            });
            bracketHTML += '</div>';
        });
        bracketHTML += '</div>';

        arena.innerHTML = `
        <div class="tournament-champion">
            <div class="tournament-crown">🏆</div>
            <img src="${profImg(champion.icon)}" class="tournament-champ-icon" style="border-color:${champion.stats.rpgClass.color}">
            <div class="tournament-champ-name" style="color:${champion.stats.rank.color}">${champion.name}</div>
            <div class="tournament-champ-class" style="color:${champion.stats.rpgClass.color}">${champion.stats.rpgClass.icon} ${champion.stats.rpgClass.name} — Poder ${champion.stats.power}</div>
        </div>
        ${bracketHTML}
        <button class="battle-again-btn" onclick="runTournament()">🔄 Novo Torneio</button>`;
        playSFX('victory');
    }

    // ======================== RANKING LADDER ========================
    window.showRankingLadder = function() {
        const modal = document.createElement('div');
        modal.id = 'ladder-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `<div class="modal-box" style="max-width:550px;">
            <button class="modal-close" onclick="document.getElementById('ladder-modal').remove()">&times;</button>
            <div class="modal-header"><h2>📊 Ranking Arena</h2><p>Classificação geral por Poder (com bônus de elo)</p></div>
            <div id="ladder-body"><div class="ld"><div class="sp"></div></div></div>
        </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
        loadRankingLadder();
    };

    async function loadRankingLadder() {
        const body = document.getElementById('ladder-body');
        if (!body) return;
        const allData = await Promise.all(PLAYERS.map((_,i) => loadPlayer(i).catch(()=>null)));
        const entries = [];
        PLAYERS.forEach((p, i) => {
            const d = allData[i];
            if (!d) return;
            const mt = Array.isArray(d.matches)?d.matches:[];
            const stats = calcRPGStats(mt, d.account?.puuid, d.league);
            if (stats) {
                const ranked = getBestRanked(Array.isArray(d.league)?d.league:[]);
                entries.push({ idx: i, name: d.account?.gameName||p.name, stats, icon: playerIcon(i, d.summoner?.profileIconId), ranked });
            }
        });
        entries.sort((a,b) => b.stats.power - a.stats.power);

        const medals = ['🥇','🥈','🥉'];
        body.innerHTML = `<div class="ladder-list">${entries.map((e, pos) => {
            const tierStr = e.ranked ? `${e.ranked.tier} ${e.ranked.rank}` : 'Unranked';
            return `<div class="ladder-row ${pos<3?'ladder-top':''}">
                <span class="ladder-pos">${pos<3?medals[pos]:(pos+1)+'º'}</span>
                <img src="${profImg(e.icon)}" class="ladder-icon" style="border-color:${e.stats.rpgClass.color}">
                <div class="ladder-info">
                    <span class="ladder-name">${e.name}</span>
                    <span class="ladder-class" style="color:${e.stats.rpgClass.color}">${e.stats.rpgClass.icon} ${e.stats.rpgClass.name}</span>
                </div>
                <div class="ladder-elo" style="font-size:.75em;color:var(--dim);">${tierStr}</div>
                <div class="ladder-power">
                    <span class="ladder-rank-badge" style="color:${e.stats.rank.color}">${e.stats.rank.name}</span>
                    <span class="ladder-power-val" style="color:${e.stats.rank.color}">${e.stats.power}</span>
                </div>
            </div>`;
        }).join('')}</div>`;
    }

    // ======================== TEMPORAL EVOLUTION ========================
    async function saveRPGSnapshot(allStats) {
        if (!db) return;
        const week = getWeekId();
        const data = {};
        allStats.forEach(s => { if(s) data[s.idx] = { power:s.power, atk:s.atk, def:s.def, agi:s.agi, int:s.int, for:s.for, sab:s.sab }; });
        db.ref(`rpgHistory/${week}`).set(data).catch(() => {});
    }

    async function loadRPGHistory() {
        if (!db) return {};
        try {
            const snap = await db.ref('rpgHistory').orderByKey().limitToLast(8).once('value');
            return snap.val() || {};
        } catch(_) { return {}; }
    }

    function renderEvolutionChart(container, history) {
        const weeks = Object.keys(history).sort();
        if (weeks.length < 2) { container.innerHTML = '<p style="color:var(--dim);text-align:center;font-size:.85em;">Evolução será exibida após 2 semanas</p>'; return; }
        const W = 320, H = 160, pad = 30;
        const pw = (W - pad*2) / (weeks.length - 1);
        let lines = '';
        const playerLines = {};
        PLAYERS.forEach((p, i) => {
            const pts = weeks.map((w,wi) => {
                const val = history[w]?.[i]?.power;
                return val !== undefined ? { x: pad + wi * pw, y: H - pad - (val / 100) * (H - pad*2) } : null;
            }).filter(Boolean);
            if (pts.length < 2) return;
            const rpgStats = calcRPGStats(cache[i]?.matches||[], cache[i]?.account?.puuid, cache[i]?.league);
            const color = rpgStats?.rpgClass?.color || 'var(--pri)';
            const pathD = pts.map((pt,k) => `${k===0?'M':'L'}${pt.x},${pt.y}`).join(' ');
            lines += `<path d="${pathD}" fill="none" stroke="${color}" stroke-width="2" opacity="0.8"/>`;
            pts.forEach(pt => { lines += `<circle cx="${pt.x}" cy="${pt.y}" r="3" fill="${color}"/>`; });
            const last = pts[pts.length-1];
            lines += `<text x="${last.x+5}" y="${last.y+3}" fill="${color}" font-size="8" font-weight="600">${p.name}</text>`;
        });
        // Grid
        let grid = '';
        for(let v=0;v<=100;v+=25) {
            const y = H-pad-(v/100)*(H-pad*2);
            grid += `<line x1="${pad}" y1="${y}" x2="${W-pad}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;
            grid += `<text x="${pad-5}" y="${y+3}" fill="rgba(255,255,255,0.3)" font-size="7" text-anchor="end">${v}</text>`;
        }
        weeks.forEach((w,wi) => {
            grid += `<text x="${pad+wi*pw}" y="${H-8}" fill="rgba(255,255,255,0.3)" font-size="7" text-anchor="middle">${w.split('-W')[1]}</text>`;
        });
        container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="evo-chart">${grid}${lines}</svg>`;
    }

    // ======================== INVENTORY (most bought items) ========================
    function computePlayerInventory(matches, puuid) {
        const itemCounts = {};
        matches.forEach(m => {
            const mp = m.info?.participants?.find(x => x.puuid === puuid); if (!mp) return;
            for(let s=0;s<=6;s++) {
                const itemId = mp[`item${s}`];
                if(itemId && itemId !== 0) itemCounts[itemId] = (itemCounts[itemId]||0)+1;
            }
        });
        return Object.entries(itemCounts).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([id,cnt])=>({id,cnt}));
    }

    // ======================== SQUAD PREDICTIONS ========================
    window.showSquadPredictions = function() {
        const modal = document.createElement('div');
        modal.id = 'squad-pred-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `<div class="modal-box" style="max-width:500px;">
            <button class="modal-close" onclick="document.getElementById('squad-pred-modal').remove()">&times;</button>
            <div class="modal-header"><h2>Palpites do Squad</h2><p>Aposte em quem vai performar melhor!</p></div>
            <div class="modal-body" id="squad-pred-body"><div class="ld"><div class="sp"></div></div></div>
        </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
        loadSquadPredictions();
    };

    async function loadSquadPredictions() {
        const body = document.getElementById('squad-pred-body');
        if (!body) return;
        const user = getLoggedUser();
        // Default predictions
        const defaultQs = [
            { id: 'weekly_lp', question: 'Quem vai ganhar mais PDL essa semana?', options: PLAYERS.map(p=>p.name) },
            { id: 'weekly_penta', question: 'Quem vai fazer o próximo pentakill?', options: PLAYERS.map(p=>p.name) },
            { id: 'weekly_feed', question: 'Quem vai ter mais mortes essa semana?', options: PLAYERS.map(p=>p.name) },
        ];
        let preds = defaultQs;
        // Load votes from Firebase
        const votes = {};
        if (db) {
            try {
                const snap = await db.ref(`squadPredictions/${getWeekId()}`).once('value');
                const data = snap.val() || {};
                Object.assign(votes, data);
            } catch(_) {}
        }
        body.innerHTML = preds.map(pred => {
            const myVote = votes[pred.id]?.votes?.[user?.idx];
            const allVotes = votes[pred.id]?.votes || {};
            const voteCounts = {};
            Object.values(allVotes).forEach(v => { voteCounts[v] = (voteCounts[v]||0)+1; });
            const totalVotes = Object.values(voteCounts).reduce((a,b)=>a+b,0);
            return `<div class="squad-pred-card">
                <div class="squad-pred-q">${pred.question}</div>
                <div class="squad-pred-opts">${pred.options.map(opt => {
                    const cnt = voteCounts[opt]||0;
                    const pct = totalVotes>0?(cnt/totalVotes*100).toFixed(0):0;
                    const isMyVote = myVote === opt;
                    return `<button class="squad-pred-opt ${isMyVote?'voted':''}" onclick="voteSquadPred('${pred.id}','${opt}')" ${!user?'disabled':''}>
                        <span class="squad-pred-opt-name">${opt}</span>
                        <div class="squad-pred-bar" style="width:${pct}%;background:${isMyVote?'var(--pri)':'rgba(255,255,255,0.1)'}"></div>
                        <span class="squad-pred-pct">${cnt>0?pct+'%':''}</span>
                    </button>`;
                }).join('')}</div>
            </div>`;
        }).join('') + (user ? '' : '<p style="color:var(--dim);text-align:center;font-size:.85em;margin-top:12px;">Faça login para votar</p>');
    }

    window.voteSquadPred = function(predId, option) {
        const user = getLoggedUser();
        if (!user || !db) return;
        db.ref(`squadPredictions/${getWeekId()}/${predId}/votes/${user.idx}`).set(option).then(() => {
            loadSquadPredictions();
        }).catch(() => {});
    };

    // ======================== SFX SYSTEM (Web Audio) ========================
    let _audioCtx = null;
    const _sfxEnabled = localStorage.getItem('profa_sfx') !== '0';
    function getAudioCtx() {
        if (!_audioCtx) { try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(_) {} }
        return _audioCtx;
    }
    function playSFX(type) {
        if (!_sfxEnabled) return;
        const ctx = getAudioCtx(); if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        gain.gain.value = 0.08;
        const t = ctx.currentTime;
        if (type === 'navigate') {
            osc.frequency.setValueAtTime(600, t);
            osc.frequency.exponentialRampToValueAtTime(900, t+0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, t+0.15);
            osc.start(t); osc.stop(t+0.15);
        } else if (type === 'hit') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, t);
            osc.frequency.exponentialRampToValueAtTime(80, t+0.2);
            gain.gain.setValueAtTime(0.12, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t+0.25);
            osc.start(t); osc.stop(t+0.25);
        } else if (type === 'victory') {
            osc.frequency.setValueAtTime(523, t);
            osc.frequency.setValueAtTime(659, t+0.12);
            osc.frequency.setValueAtTime(784, t+0.24);
            gain.gain.exponentialRampToValueAtTime(0.001, t+0.5);
            osc.start(t); osc.stop(t+0.5);
        } else if (type === 'unlock') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, t);
            osc.frequency.setValueAtTime(660, t+0.1);
            osc.frequency.setValueAtTime(880, t+0.2);
            gain.gain.exponentialRampToValueAtTime(0.001, t+0.4);
            osc.start(t); osc.stop(t+0.4);
        }
    }

    // SFX on navigation
    document.addEventListener('click', e => {
        if (e.target.closest('.nl a, .nav-in a')) playSFX('navigate');
    });

    // ======================== TEAM BUILDER ========================
    function renderTeamBuilder() {
        const roles = ['TOP','JNG','MID','ADC','SUP'];
        app.innerHTML = `<div class="section-wrap-sm">
            <button class="bb" onclick="location.hash='dashboard'">&larr; Dashboard</button>
            <div class="tb-hero"><h1>Montar <span>Time</span></h1><p>Monte a composição do squad para Clash ou Flex</p></div>
            <div class="tb-slots" id="tb-slots">
                ${roles.map(r => `<div class="tb-slot" data-role="${r}">
                    <div class="tb-role">${r}</div>
                    <select class="tb-select" data-role="${r}" onchange="updateTeamBuilder()">
                        <option value="">Selecionar</option>
                        ${PLAYERS.map((p,i) => `<option value="${i}">${p.name}</option>`).join('')}
                    </select>
                    <div class="tb-player-info" id="tb-info-${r}"></div>
                </div>`).join('')}
            </div>
            <div id="tb-summary"></div>
        </div>`;

        window.updateTeamBuilder = async function() {
            const selected = {};
            document.querySelectorAll('.tb-select').forEach(sel => {
                if (sel.value) selected[sel.dataset.role] = parseInt(sel.value);
            });

            // Show player info per slot
            for (const role of roles) {
                const el = $(`tb-info-${role}`);
                const idx = selected[role];
                if (idx === undefined) { el.innerHTML = ''; continue; }
                const d = cache[idx] || await loadPlayerFast(idx).catch(()=>null);
                if (!d) { el.innerHTML = '<span style="color:var(--dim);font-size:.8em;">Indisponível</span>'; continue; }
                const solo = getBestRanked(d.league);
                const ic = playerIcon(idx, d.summoner?.profileIconId);
                el.innerHTML = `<img src="${profImg(ic)}" class="tb-icon" ${F}><span class="${rankCls(solo?.tier)}" style="font-weight:700;font-size:.85em;">${solo?solo.tier+' '+solo.rank+(isFlex(solo)?' <small style="opacity:.5">(F)</small>':''):'Unranked'}</span>`;
            }

            // Summary
            const sum = $('tb-summary');
            const filled = Object.keys(selected).length;
            if (filled < 2) { sum.innerHTML = ''; return; }

            let totalLP = 0, count = 0;
            for (const [r, idx] of Object.entries(selected)) {
                const d = cache[idx];
                const solo = getBestRanked(d?.league);
                if (solo) {
                    const tierOrder = {CHALLENGER:9,GRANDMASTER:8,MASTER:7,DIAMOND:6,EMERALD:5,PLATINUM:4,GOLD:3,SILVER:2,BRONZE:1,IRON:0};
                    const rankOrder = {I:3,II:2,III:1,IV:0};
                    totalLP += (tierOrder[solo.tier]||0)*400+(rankOrder[solo.rank]||0)*100+(solo.leaguePoints||0);
                    count++;
                }
            }
            const avgLP = count ? (totalLP/count)|0 : 0;
            const tiers = ['IRON','BRONZE','SILVER','GOLD','PLATINUM','EMERALD','DIAMOND','MASTER','GRANDMASTER','CHALLENGER'];
            const avgTier = tiers[Math.min((avgLP/400)|0, 9)] || 'IRON';

            sum.innerHTML = `<div class="tb-summary-box">
                <h3>Resumo do Time</h3>
                <div class="tb-summary-stats">
                    <div><span class="tb-stat-label">Jogadores</span><span class="tb-stat-val">${filled}/5</span></div>
                    <div><span class="tb-stat-label">Elo Médio</span><span class="tb-stat-val ${rankCls(avgTier)}">${avgTier}</span></div>
                    <div><span class="tb-stat-label">PDL Médio</span><span class="tb-stat-val">${avgLP}</span></div>
                </div>
            </div>`;
        };
    }

    function escapeHtml(t) { const d=document.createElement('div'); d.textContent=t; return d.innerHTML; }

    // ======================== CHAT (Firebase real-time) ========================
    let _chatRef = null;
    let _chatMessages = [];
    let _chatReplyTo = null;
    let _chatRecording = false;
    let _chatMediaRec = null;
    let _chatTypingTimer = null;
    let _chatEmojiOpen = false;

    const CHAT_EMOJIS = ['😂','😍','🔥','👍','👎','😢','😡','🎮','💀','🏆','❤️','😎','🤣','👏','💪','🙄','😱','🤔','✅','❌','🎯','⚡','🗡️','🛡️','🌿','🏹'];
    const CHAT_REACTIONS = ['❤️','😂','👍','🔥','😢','😡'];

    function renderChat() {
        const user = getLoggedUser();
        const online = Object.values(_onlineUsers).filter(u => u.online);
        app.innerHTML = `<div class="chat-fullpage">
            <div class="chat-topbar">
                <div class="chat-topbar-info">
                    <h2>Chat do Squad</h2>
                    <div class="chat-topbar-status">
                        <span class="online-dot"></span>
                        ${online.length ? online.map(u=>u.name).join(', ') : 'Ninguém online'}
                    </div>
                </div>
                <div class="chat-topbar-actions">
                    <button class="chat-action-btn" onclick="chatSearch()" title="Buscar">🔍</button>
                </div>
            </div>
            <div class="chat-search-bar" id="chat-search-bar" style="display:none;">
                <input type="text" id="chat-search-input" placeholder="Buscar mensagens..." oninput="filterChatMessages(this.value)">
                <button onclick="closeChatSearch()">✕</button>
            </div>
            <div id="chat-typing" class="chat-typing" style="display:none;"></div>
            <div class="chat-box" id="chat-box"><div class="ld"><div class="sp"></div></div></div>
            ${user ? `
            <div class="chat-reply-bar" id="chat-reply-bar" style="display:none;">
                <div class="chat-reply-preview" id="chat-reply-preview"></div>
                <button class="chat-reply-close" onclick="cancelReply()">✕</button>
            </div>
            <div class="chat-input-area">
                <div class="chat-input-row">
                    <button class="chat-btn-emoji" onclick="toggleEmojiPicker()" title="Emoji">😊</button>
                    <input type="text" id="chat-input" placeholder="Mensagem..." maxlength="500" autocomplete="off">
                    <label class="chat-btn-attach" title="Enviar imagem">
                        <input type="file" accept="image/*" style="display:none" onchange="chatSendImage(this.files)">📎</label>
                    <button class="chat-btn-mic" id="chat-mic-btn" onmousedown="chatStartRecord()" onmouseup="chatStopRecord()" ontouchstart="chatStartRecord()" ontouchend="chatStopRecord()" title="Áudio">🎙️</button>
                    <button class="chat-send" onclick="sendChat()">➤</button>
                </div>
                <div class="chat-emoji-picker" id="chat-emoji-picker" style="display:none;">
                    ${CHAT_EMOJIS.map(e => `<button class="chat-emoji-btn" onclick="insertEmoji('${e}')">${e}</button>`).join('')}
                </div>
            </div>
            ` : '<div class="chat-login-prompt"><p>Faça login para participar</p><button class="cfg-btn" onclick="showLoginModal()">Entrar</button></div>'}
        </div>`;

        stopChat();
        _chatMessages = [];
        _chatReplyTo = null;

        if (db) {
            _chatRef = db.ref('chat').orderByChild('ts').limitToLast(200);
            _chatRef.on('value', snap => {
                _chatMessages = [];
                snap.forEach(child => {
                    const val = child.val();
                    if (val) _chatMessages.push({ _key: child.key, ...val, ts: val.ts || Date.now() });
                });
                _chatMessages.sort((a, b) => (a.ts || 0) - (b.ts || 0));
                renderChatMessages();
            }, err => {
                const box = $('chat-box');
                if (box) box.innerHTML = `<p class="chat-empty" style="color:#ef5350;">Erro: ${err.message.includes('PERMISSION_DENIED')?'Regras do Firebase expiraram':'Erro de conexão'}</p>`;
            });

            // Typing indicator
            const chatInput = $('chat-input');
            if (chatInput) {
                chatInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } });
                chatInput.addEventListener('input', () => {
                    const user = getLoggedUser();
                    if (!user) return;
                    db.ref('chatTyping/' + user.idx).set({ name: PLAYERS[user.idx]?.name, ts: firebase.database.ServerValue.TIMESTAMP });
                    clearTimeout(_chatTypingTimer);
                    _chatTypingTimer = setTimeout(() => db.ref('chatTyping/' + user.idx).remove(), 2000);
                });
                chatInput.focus();
            }

            // Listen for typing
            db.ref('chatTyping').on('value', snap => {
                const data = snap.val() || {};
                const user = getLoggedUser();
                const typers = Object.entries(data)
                    .filter(([k, v]) => v.ts && Date.now() - v.ts < 3000 && (!user || parseInt(k) !== user.idx))
                    .map(([_, v]) => v.name);
                const el = $('chat-typing');
                if (el) {
                    if (typers.length) {
                        el.style.display = 'flex';
                        el.innerHTML = `<span class="chat-typing-dots"><span></span><span></span><span></span></span> ${typers.join(', ')} ${typers.length > 1 ? 'estão' : 'está'} digitando...`;
                    } else {
                        el.style.display = 'none';
                    }
                }
            });
        } else {
            const box = $('chat-box');
            if (box) box.innerHTML = '<p class="chat-empty">Configure o Firebase para usar o chat.</p>';
        }
    }

    function stopChat() {
        if (_chatRef) { _chatRef.off(); _chatRef = null; }
        if (db) { try { db.ref('chatTyping').off(); } catch(_) {} }
    }

    function renderChatMessages(filter) {
        const box = $('chat-box');
        if (!box) { stopChat(); return; }
        let msgs = _chatMessages;
        if (filter) {
            const f = filter.toLowerCase();
            msgs = msgs.filter(m => (m.text||'').toLowerCase().includes(f) || (m.name||'').toLowerCase().includes(f));
        }
        if (!msgs.length) {
            box.innerHTML = `<p class="chat-empty">${filter ? 'Nenhum resultado' : 'Nenhuma mensagem ainda. Seja o primeiro!'}</p>`;
            return;
        }
        const user = getLoggedUser();
        const wasAtBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 40;
        let lastDate = '';
        let html = '';

        msgs.forEach(m => {
            // Date separator
            const d = new Date(m.ts);
            const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
            if (dateStr !== lastDate) {
                html += `<div class="chat-date-sep"><span>${dateStr}</span></div>`;
                lastDate = dateStr;
            }
            const isMe = user?.idx === m.idx;
            const icon = playerIcon(m.idx, null);
            const isDeleted = m.deleted;
            const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            // Reply quote
            let replyHtml = '';
            if (m.replyTo) {
                const orig = _chatMessages.find(x => x._key === m.replyTo);
                if (orig) {
                    replyHtml = `<div class="chat-reply-quote" onclick="scrollToMsg('${m.replyTo}')">
                        <span class="chat-reply-name">${escapeHtml(orig.name||'')}</span>
                        <span class="chat-reply-text">${escapeHtml((orig.text||'').substring(0, 60))}${(orig.text||'').length > 60 ? '...' : ''}</span>
                    </div>`;
                }
            }

            // Reactions
            const reactions = m.reactions || {};
            const reactionCounts = {};
            Object.values(reactions).forEach(r => { reactionCounts[r] = (reactionCounts[r]||0) + 1; });
            const reactionsHtml = Object.keys(reactionCounts).length ? `<div class="chat-reactions">${Object.entries(reactionCounts).map(([emoji, count]) => {
                const myReaction = user && reactions[user.idx] === emoji;
                return `<button class="chat-reaction ${myReaction?'my':''}" onclick="chatReact('${m._key}','${emoji}')">${emoji}${count > 1 ? `<span>${count}</span>` : ''}</button>`;
            }).join('')}</div>` : '';

            // Image
            let mediaHtml = '';
            if (m.imageUrl) {
                mediaHtml = `<div class="chat-media"><img src="${m.imageUrl}" alt="imagem" onclick="window.open(this.src)" loading="lazy"></div>`;
            }
            // Audio
            if (m.audioUrl) {
                mediaHtml = `<div class="chat-media"><audio controls src="${m.audioUrl}" preload="none" style="width:100%;max-width:250px;height:32px;"></audio></div>`;
            }

            // Context actions
            const actions = `<div class="chat-msg-actions">
                <button onclick="chatSetReply('${m._key}')" title="Responder">↩</button>
                <button onclick="showReactPicker('${m._key}')" title="Reagir">😊</button>
                ${isMe && !isDeleted ? `<button onclick="chatDeleteMsg('${m._key}')" title="Apagar">🗑</button>` : ''}
            </div>`;

            if (isDeleted) {
                html += `<div class="chat-msg ${isMe ? 'chat-me' : ''}" id="msg-${m._key}">
                    <img src="${profImg(icon)}" class="chat-avatar" onerror="this.style.display='none'">
                    <div class="chat-bubble chat-deleted"><span class="chat-deleted-icon">🚫</span> Mensagem apagada<span class="chat-msg-time">${timeStr}</span></div>
                </div>`;
            } else {
                html += `<div class="chat-msg ${isMe ? 'chat-me' : ''}" id="msg-${m._key}">
                    <img src="${profImg(icon)}" class="chat-avatar" onerror="this.style.display='none'">
                    <div class="chat-bubble">
                        ${replyHtml}
                        <div class="chat-msg-head">
                            <span class="chat-msg-name" onclick="location.hash='profile/${m.idx}'">${escapeHtml(m.name || '???')}</span>
                            <span class="chat-msg-time">${timeStr}</span>
                        </div>
                        ${mediaHtml}
                        ${m.text ? `<div class="chat-msg-text">${formatChatText(m.text)}</div>` : ''}
                        ${reactionsHtml}
                        ${actions}
                    </div>
                </div>`;
            }
        });

        box.innerHTML = html;
        if (wasAtBottom || !filter) box.scrollTop = box.scrollHeight;
    }

    // Format chat text: links, bold, italic
    function formatChatText(text) {
        let s = escapeHtml(text);
        s = s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" class="chat-link">$1</a>');
        s = s.replace(/\*(.+?)\*/g, '<b>$1</b>');
        s = s.replace(/_(.+?)_/g, '<i>$1</i>');
        return s;
    }

    // Reply
    window.chatSetReply = function(key) {
        const m = _chatMessages.find(x => x._key === key);
        if (!m) return;
        _chatReplyTo = key;
        const bar = $('chat-reply-bar');
        const preview = $('chat-reply-preview');
        if (bar) bar.style.display = 'flex';
        if (preview) preview.innerHTML = `<b>${escapeHtml(m.name||'')}</b>: ${escapeHtml((m.text||'').substring(0, 80))}`;
        $('chat-input')?.focus();
    };
    window.cancelReply = function() {
        _chatReplyTo = null;
        const bar = $('chat-reply-bar');
        if (bar) bar.style.display = 'none';
    };

    // Scroll to message
    window.scrollToMsg = function(key) {
        const el = document.getElementById('msg-' + key);
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('chat-highlight'); setTimeout(() => el.classList.remove('chat-highlight'), 1500); }
    };

    // Reactions
    window.showReactPicker = function(key) {
        // Remove existing picker
        document.querySelectorAll('.chat-react-picker').forEach(e => e.remove());
        const msgEl = document.getElementById('msg-' + key);
        if (!msgEl) return;
        const picker = document.createElement('div');
        picker.className = 'chat-react-picker';
        picker.innerHTML = CHAT_REACTIONS.map(e => `<button onclick="chatReact('${key}','${e}')">${e}</button>`).join('');
        msgEl.querySelector('.chat-bubble').appendChild(picker);
        setTimeout(() => { document.addEventListener('click', function rem() { picker.remove(); document.removeEventListener('click', rem); }); }, 10);
    };
    window.chatReact = function(key, emoji) {
        const user = getLoggedUser();
        if (!user || !db) return;
        const ref = db.ref('chat/' + key + '/reactions/' + user.idx);
        ref.once('value').then(snap => {
            if (snap.val() === emoji) ref.remove(); // toggle off
            else ref.set(emoji);
        });
        document.querySelectorAll('.chat-react-picker').forEach(e => e.remove());
    };

    // Delete message
    window.chatDeleteMsg = function(key) {
        const user = getLoggedUser();
        if (!user || !db) return;
        db.ref('chat/' + key).update({ deleted: true, text: null, imageUrl: null, audioUrl: null });
    };

    // Send message
    window.sendChat = function() {
        const user = getLoggedUser();
        if (!user || !db) return;
        const input = $('chat-input');
        if (!input || !input.value.trim()) return;
        const text = input.value.trim();
        input.value = '';
        const msg = {
            idx: user.idx,
            name: PLAYERS[user.idx]?.name || '???',
            text: text,
            ts: firebase.database.ServerValue.TIMESTAMP
        };
        if (_chatReplyTo) { msg.replyTo = _chatReplyTo; }
        cancelReply();
        db.ref('chat').push(msg).then(() => {
            input.focus();
            db.ref('chatTyping/' + user.idx).remove();
        }).catch(e => {
            input.value = text;
            showToast('❌', 'Erro ao enviar: ' + e.message);
        });
    };

    // Send image
    window.chatSendImage = async function(files) {
        if (!files?.length) return;
        const user = getLoggedUser();
        if (!user || !db) return;
        const file = files[0];
        if (file.size > 5 * 1024 * 1024) { showToast('❌', 'Imagem muito grande (máx 5MB)'); return; }
        showToast('📤', 'Enviando imagem...');
        try {
            const safeName = Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const ref = storage.ref('chat_images/' + safeName);
            await ref.put(file, { contentType: file.type });
            const url = await ref.getDownloadURL();
            const msg = {
                idx: user.idx, name: PLAYERS[user.idx]?.name || '???',
                imageUrl: url, text: '', ts: firebase.database.ServerValue.TIMESTAMP
            };
            if (_chatReplyTo) { msg.replyTo = _chatReplyTo; cancelReply(); }
            await db.ref('chat').push(msg);
        } catch(e) { showToast('❌', 'Erro: ' + e.message); }
    };

    // Voice recording
    window.chatStartRecord = function() {
        const user = getLoggedUser();
        if (!user || !db || _chatRecording) return;
        navigator.mediaDevices?.getUserMedia({ audio: true }).then(stream => {
            _chatRecording = true;
            const btn = $('chat-mic-btn');
            if (btn) btn.classList.add('recording');
            const chunks = [];
            _chatMediaRec = new MediaRecorder(stream);
            _chatMediaRec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
            _chatMediaRec.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                if (btn) btn.classList.remove('recording');
                _chatRecording = false;
                if (!chunks.length) return;
                const blob = new Blob(chunks, { type: 'audio/webm' });
                if (blob.size < 1000) return; // too short
                showToast('🎙️', 'Enviando áudio...');
                try {
                    const safeName = Date.now() + '_audio.webm';
                    const ref = storage.ref('chat_audio/' + safeName);
                    await ref.put(blob, { contentType: 'audio/webm' });
                    const url = await ref.getDownloadURL();
                    await db.ref('chat').push({
                        idx: user.idx, name: PLAYERS[user.idx]?.name || '???',
                        audioUrl: url, text: '', ts: firebase.database.ServerValue.TIMESTAMP
                    });
                } catch(e) { showToast('❌', 'Erro: ' + e.message); }
            };
            _chatMediaRec.start();
        }).catch(() => showToast('❌', 'Sem permissão para microfone'));
    };
    window.chatStopRecord = function() {
        if (_chatMediaRec && _chatRecording) {
            _chatMediaRec.stop();
        }
    };

    // Emoji picker
    window.toggleEmojiPicker = function() {
        const picker = $('chat-emoji-picker');
        if (picker) { _chatEmojiOpen = !_chatEmojiOpen; picker.style.display = _chatEmojiOpen ? 'flex' : 'none'; }
    };
    window.insertEmoji = function(emoji) {
        const input = $('chat-input');
        if (input) { input.value += emoji; input.focus(); }
    };

    // Search
    window.chatSearch = function() {
        const bar = $('chat-search-bar');
        if (bar) { bar.style.display = bar.style.display === 'none' ? 'flex' : 'none'; if (bar.style.display === 'flex') $('chat-search-input')?.focus(); }
    };
    window.closeChatSearch = function() {
        const bar = $('chat-search-bar');
        if (bar) bar.style.display = 'none';
        const input = $('chat-search-input');
        if (input) input.value = '';
        renderChatMessages();
    };
    window.filterChatMessages = function(val) { renderChatMessages(val); };

    // ======================== CHAT BACKGROUND NOTIFICATIONS ========================
    let _chatBgRef = null;
    let _chatLastTs = Date.now();
    function startChatBgListener() {
        if (_chatBgRef || !db) return;
        _chatBgRef = db.ref('chat').orderByChild('ts').startAt(Date.now());
        _chatBgRef.on('child_added', snap => {
            const msg = snap.val();
            if (!msg || !msg.text || !msg.ts) return;
            // Don't notify for own messages
            const user = getLoggedUser();
            if (user && msg.idx === user.idx) return;
            // Don't notify if on chat page
            const currentPage = (location.hash || '#').replace(/^#/, '');
            if (currentPage === 'chat') return;
            // Respect prefs
            if (!getNotifPrefs().chat) return;
            const name = msg.name || '???';
            const text = msg.text.length > 50 ? msg.text.substring(0, 50) + '...' : msg.text;
            showToast('💬', `<b>${name}:</b> ${escapeHtml(text)}`, () => location.hash = 'chat', 4000);
            sendNotification('Chat — ' + name, msg.text, null, 'chat');
            // Update chat nav badge
            const chatLink = document.querySelector('.nl a[data-p="chat"]');
            if (chatLink && !chatLink.querySelector('.chat-notif-dot')) {
                chatLink.insertAdjacentHTML('beforeend', ' <span class="chat-notif-dot"></span>');
            }
        });
    }
    startChatBgListener();

    // Clear chat badge when navigating to chat
    function clearChatBadge() {
        const dot = document.querySelector('.chat-notif-dot');
        if (dot) dot.remove();
    }

    // ======================== PRESENCE (quem está online) ========================
    let _onlineUsers = {};
    function updatePresence(user) {
        if (!db) return;
        if (user) {
            const ref = db.ref(`presence/${user.idx}`);
            ref.set({ name: PLAYERS[user.idx]?.name || 'User', ts: Date.now(), online: true });
            ref.onDisconnect().set({ name: PLAYERS[user.idx]?.name || 'User', ts: Date.now(), online: false });
        }
    }
    function listenPresence() {
        if (!db) return;
        db.ref('presence').on('value', snap => {
            _onlineUsers = snap.val() || {};
            renderOnlineBadge();
        });
    }
    function renderOnlineBadge() {
        let el = document.getElementById('online-badge');
        const count = Object.values(_onlineUsers).filter(u => u.online).length;
        if (!count) { if (el) el.remove(); return; }
        if (!el) {
            el = document.createElement('span');
            el.id = 'online-badge';
            el.className = 'online-badge';
            el.title = 'Jogadores online agora';
            el.onclick = () => showOnlineModal();
            document.querySelector('.nav-in')?.appendChild(el);
        }
        el.innerHTML = `<span class="online-dot"></span>${count} online`;
    }
    window.showOnlineModal = function() {
        const old = document.getElementById('online-modal');
        if (old) old.remove();
        const modal = document.createElement('div');
        modal.id = 'online-modal';
        modal.className = 'modal-overlay';
        const users = Object.entries(_onlineUsers).map(([idx, u]) => ({
            idx: parseInt(idx), name: u.name, online: u.online, ts: u.ts
        })).sort((a, b) => b.online - a.online || b.ts - a.ts);
        modal.innerHTML = `<div class="modal-box" style="max-width:360px;">
            <button class="modal-close" onclick="document.getElementById('online-modal').remove()">&times;</button>
            <div class="modal-header"><h2>Squad Online</h2></div>
            <div class="modal-body">
                ${users.map(u => `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                    <span class="online-dot" style="background:${u.online ? '#4caf50' : '#666'};"></span>
                    <span style="font-weight:600;">${u.name}</span>
                    <span style="margin-left:auto;font-size:.75em;color:var(--dim);">${u.online ? 'agora' : fmtAgo(u.ts)}</span>
                </div>`).join('')}
            </div>
        </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    };

    // ======================== FEED DE ATIVIDADE ========================
    function postFeedEvent(event) {
        if (!db) return;
        const entry = { ...event, ts: Date.now() };
        db.ref('feed').push(entry).catch(() => {});
        // Keep only last 100 events
        db.ref('feed').orderByChild('ts').limitToFirst(1).once('value', snap => {
            const count = snap.numChildren();
            // Cleanup happens naturally as we limitToLast when reading
        });
    }

    async function loadFeed(limit = 20) {
        if (!db) return [];
        try {
            const snap = await db.ref('feed').orderByChild('ts').limitToLast(limit).once('value');
            const items = [];
            snap.forEach(child => items.push(child.val()));
            return items.sort((a, b) => b.ts - a.ts);
        } catch(_) { return []; }
    }

    function feedIcon(type) {
        const icons = { rank_up: '📈', rank_down: '📉', prediction_exact: '🎯', prediction_win: '✅', achievement: '🏆', match_win: '⭐', pentakill: '💀' };
        return icons[type] || '📌';
    }

    // ======================== NOTIFICATION SYSTEM ========================
    // Notification preferences (stored in localStorage)
    const NOTIF_DEFAULTS = { live: true, rank: true, chat: true, cblol: true, pentakill: true };
    function getNotifPrefs() {
        try { return { ...NOTIF_DEFAULTS, ...JSON.parse(localStorage.getItem('profa_notif_prefs') || '{}') }; } catch(_) { return { ...NOTIF_DEFAULTS }; }
    }
    function setNotifPref(key, val) {
        const prefs = getNotifPrefs();
        prefs[key] = val;
        localStorage.setItem('profa_notif_prefs', JSON.stringify(prefs));
    }

    // Toast notification bar — single bar at bottom, replaces stacked alerts
    const _toastQueue = [];
    let _toastActive = false;
    let _toastBar = null;

    function initToastBar() {
        if (_toastBar) return;
        _toastBar = document.createElement('div');
        _toastBar.id = 'notif-bar';
        _toastBar.className = 'notif-bar';
        _toastBar.style.display = 'none';
        _toastBar.innerHTML = `<div class="notif-bar-content"><span class="notif-bar-icon"></span><span class="notif-bar-text"></span></div><button class="notif-bar-close">&times;</button>`;
        _toastBar.querySelector('.notif-bar-close').onclick = () => dismissToast();
        document.body.appendChild(_toastBar);
    }
    initToastBar();

    function showToast(icon, text, onClick, duration) {
        _toastQueue.push({ icon, text, onClick, duration: duration || 5000 });
        if (!_toastActive) processToastQueue();
    }

    function processToastQueue() {
        if (!_toastQueue.length) { _toastActive = false; return; }
        _toastActive = true;
        const t = _toastQueue.shift();
        const bar = _toastBar;
        bar.querySelector('.notif-bar-icon').textContent = t.icon || '';
        bar.querySelector('.notif-bar-text').innerHTML = t.text;
        bar.onclick = (e) => { if (!e.target.classList.contains('notif-bar-close')) { if (t.onClick) t.onClick(); dismissToast(); } };
        bar.style.display = 'flex';
        bar.classList.remove('notif-bar-hide');
        bar.classList.add('notif-bar-show');
        clearTimeout(window._toastTimer);
        window._toastTimer = setTimeout(() => dismissToast(), t.duration);
    }

    function dismissToast() {
        if (!_toastBar) return;
        _toastBar.classList.remove('notif-bar-show');
        _toastBar.classList.add('notif-bar-hide');
        setTimeout(() => {
            if (_toastBar) _toastBar.style.display = 'none';
            processToastQueue();
        }, 300);
    }

    // Browser notifications (respects prefs)
    function sendNotification(title, body, icon, category) {
        const prefs = getNotifPrefs();
        if (category && !prefs[category]) return;
        if (!('Notification' in window)) return;
        if (Notification.permission === 'granted') {
            new Notification(title, { body, icon: icon || 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/profileicon/4644.png' });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission();
        }
    }

    // Notification settings panel (toggled from nav)
    window.toggleNotifSettings = function() {
        let panel = document.getElementById('notif-settings-panel');
        if (panel) { panel.remove(); return; }
        const prefs = getNotifPrefs();
        panel = document.createElement('div');
        panel.id = 'notif-settings-panel';
        panel.className = 'notif-settings-panel';
        const items = [
            { key: 'live', icon: '🎮', label: 'Partidas ao vivo do squad' },
            { key: 'rank', icon: '📊', label: 'Mudanças de rank / PDL' },
            { key: 'chat', icon: '💬', label: 'Mensagens no chat' },
            { key: 'cblol', icon: '🏆', label: 'CBLOL e campeonatos' },
            { key: 'pentakill', icon: '💀', label: 'Pentakills' },
        ];
        panel.innerHTML = `
            <div class="notif-settings-header">
                <span>Notificações</span>
                <button class="notif-settings-close" onclick="toggleNotifSettings()">&times;</button>
            </div>
            ${items.map(i => `<label class="notif-setting-item">
                <span class="notif-setting-label">${i.icon} ${i.label}</span>
                <input type="checkbox" ${prefs[i.key] ? 'checked' : ''} onchange="setNotifPref('${i.key}', this.checked)">
                <span class="notif-toggle"></span>
            </label>`).join('')}
            <div class="notif-settings-footer">
                <button class="notif-perm-btn" onclick="Notification.requestPermission().then(()=>toggleNotifSettings())">
                    ${Notification?.permission === 'granted' ? '✅ Notificações do navegador ativas' : '🔔 Ativar notificações do navegador'}
                </button>
            </div>`;
        document.body.appendChild(panel);
    };

    function detectRankChanges(playerIdx, oldData, newData) {
        if (!oldData?.league || !newData?.league) return;
        const oldSolo = (Array.isArray(oldData.league)?oldData.league:[]).find(e => e.queueType === 'RANKED_SOLO_5x5');
        const newSolo = (Array.isArray(newData.league)?newData.league:[]).find(e => e.queueType === 'RANKED_SOLO_5x5');
        if (!oldSolo || !newSolo) return;
        const tierOrder = { IRON: 0, BRONZE: 1, SILVER: 2, GOLD: 3, PLATINUM: 4, EMERALD: 5, DIAMOND: 6, MASTER: 7, GRANDMASTER: 8, CHALLENGER: 9 };
        const oldVal = (tierOrder[oldSolo.tier] || 0) * 4 + ({ I: 3, II: 2, III: 1, IV: 0 }[oldSolo.rank] || 0);
        const newVal = (tierOrder[newSolo.tier] || 0) * 4 + ({ I: 3, II: 2, III: 1, IV: 0 }[newSolo.rank] || 0);
        const name = PLAYERS[playerIdx]?.name || '?';
        if (newVal > oldVal) {
            const msg = `${name} subiu para ${newSolo.tier} ${newSolo.rank}!`;
            postFeedEvent({ type: 'rank_up', player: name, idx: playerIdx, msg });
            sendNotification('Rank Up!', msg, null, 'rank');
            if (getNotifPrefs().rank) showToast('📈', msg, () => location.hash = `profile/${playerIdx}`);
            playSFX('victory');
        } else if (newVal < oldVal) {
            const msg = `${name} caiu para ${newSolo.tier} ${newSolo.rank}`;
            postFeedEvent({ type: 'rank_down', player: name, idx: playerIdx, msg });
            sendNotification('Rank Down', msg, null, 'rank');
            if (getNotifPrefs().rank) showToast('📉', msg, () => location.hash = `profile/${playerIdx}`);
        }
        // LP milestone notifications
        const newLP = newSolo.leaguePoints || 0;
        const oldLP = oldSolo.leaguePoints || 0;
        if (newLP >= 100 && oldLP < 100) {
            sendNotification('PDL Milestone!', `${name} chegou a ${newLP} PDL em ${newSolo.tier} ${newSolo.rank}!`, null, 'rank');
            postFeedEvent({ type: 'lp_milestone', player: name, idx: playerIdx, msg: `${name} atingiu ${newLP} PDL!` });
        }
        // Detect pentakill from new matches
        const oldMatches = new Set((Array.isArray(oldData.matches)?oldData.matches:[]).map(m=>m.metadata?.matchId).filter(Boolean));
        const newMatches = (Array.isArray(newData.matches)?newData.matches:[]).filter(m => m.metadata?.matchId && !oldMatches.has(m.metadata.matchId));
        newMatches.forEach(m => {
            const mp = m.info?.participants?.find(x => x.puuid === newData.account?.puuid);
            if (mp?.pentaKills > 0) {
                const champName = CMAP[mp.championId] || '?';
                sendNotification('PENTAKILL!', `${name} fez PENTAKILL de ${champName}!`, null, 'pentakill');
                if (getNotifPrefs().pentakill) showToast('💀', `<b>${name}</b> fez PENTAKILL de <b>${champName}</b>!`, () => location.hash = `profile/${playerIdx}`);
                postFeedEvent({ type:'pentakill', player:name, idx:playerIdx, msg:`${name} fez PENTAKILL de ${champName}!` });
                playSFX('unlock');
            }
        });
    }

    // ======================== NOTIFICAÇÃO DE PARTIDA AO VIVO ========================
    let _liveAlerts = {};
    let _allPlayersLoaded = false;
    let _liveCheckRunning = false;
    async function checkSquadInGame() {
        // Avoid overlapping checks
        if (_liveCheckRunning) return;
        // Need at least some players cached to check
        const hasSomePlayers = PLAYERS.some((_, i) => cache[i]?.account?.puuid);
        if (apiExpired || !hasSomePlayers) return;
        _liveCheckRunning = true;
        try {
            console.log('[Live] Verificando jogadores em partida...');
            let found = 0;
            for (let i = 0; i < PLAYERS.length; i++) {
                const d = cache[i];
                if (!d?.account?.puuid) { console.log(`[Live] ${PLAYERS[i].name} — sem puuid, pulando`); continue; }
                const p = PLAYERS[i], pl = plat(p.region);
                try {
                    console.log(`[Live] Checando ${p.name}...`);
                    const resp = await fetch(`https://${pl}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${d.account.puuid}`, {
                        headers: { 'X-Riot-Token': RIOT_KEY }
                    });
                    console.log(`[Live] ${p.name} — status ${resp.status}`);
                    if (resp.status === 429) {
                        console.warn(`[Live] Rate limited em ${p.name}, aguardando 5s...`);
                        await new Promise(r => setTimeout(r, 5000));
                        // Retry this player once
                        const resp2 = await fetch(`https://${pl}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${d.account.puuid}`, {
                            headers: { 'X-Riot-Token': RIOT_KEY }
                        });
                        console.log(`[Live] ${p.name} retry — status ${resp2.status}`);
                        if (!resp2.ok) continue;
                        const gameData2 = await resp2.json().catch(() => null);
                        if (gameData2) {
                            let liveChampId = null;
                            const me = gameData2.participants?.find(x => x.puuid === d.account.puuid);
                            if (me) liveChampId = me.championId;
                            _liveAlerts[i] = { champId: liveChampId, gameData: gameData2 };
                            found++;
                            updateCardLive(i);
                            const pName = d.account.gameName || p.name;
                            const champName = CMAP[liveChampId] || '';
                            if (!_liveAlerts[i]?._notified) {
                                if (getNotifPrefs().live) showToast('🎮', `<b>${pName}</b> está jogando${champName ? ` de <b>${champName}</b>` : ''} agora!`);
                                _liveAlerts[i]._notified = true;
                            }
                        }
                        continue;
                    }
                    if (resp.status === 403 || resp.status === 401) { console.warn('[Live] API key inválida'); break; }
                    if (resp.ok) {
                        const gameData = await resp.json().catch(() => null);
                        let liveChampId = null;
                        if (gameData?.participants) {
                            const me = gameData.participants.find(x => x.puuid === d.account.puuid);
                            if (me) liveChampId = me.championId;
                        }
                        const wasAlerted = !!_liveAlerts[i];
                        _liveAlerts[i] = { champId: liveChampId, gameData };
                        found++;
                        console.log(`[Live] ${p.name} está em jogo! Campeão: ${CMAP[liveChampId] || liveChampId || '?'}`);
                        if (!wasAlerted) {
                            const pName = d.account.gameName || p.name;
                            const champName = CMAP[liveChampId] || '';
                            const idx = i;
                            if (getNotifPrefs().live) showToast('🎮', `<b>${pName}</b> está jogando${champName ? ` de <b>${champName}</b>` : ''} agora!`, );
                            postFeedEvent({ type: 'in_game', player: p.name, idx: i, msg: `${pName} está em partida agora!${champName ? ` (${champName})` : ''}` });
                            sendNotification('Em Jogo!', `${pName} está jogando de ${champName || 'campeão'}!`, null, 'live');
                        }
                        updateCardLive(i);
                    } else {
                        // 404 = not in game
                        if (_liveAlerts[i]) {
                            console.log(`[Live] ${p.name} saiu da partida — buscando resultado...`);
                            delete _liveAlerts[i];
                            updateCardLive(i);
                            setTimeout(() => refreshPlayer(i), 15000);
                        }
                    }
                } catch(e) { console.warn(`[Live] Erro ao checar ${p.name}:`, e.message); }
                await new Promise(r => setTimeout(r, 1500));
            }
            console.log(`[Live] Check completo. ${found} jogador(es) em partida.`);
        } finally {
            _liveCheckRunning = false;
        }
    }

    // showInGameAlert removed — now uses unified toast bar

    // Update a single card's live state — applies classes + splash directly
    function updateCardLive(i) {
        const card = document.querySelector(`[data-i="${i}"]`);
        if (!card) return;

        const liveData = _liveAlerts[i];
        const isInGame = !!liveData;
        const liveChampId = liveData?.champId;
        const liveChampName = liveChampId ? (CMAP[liveChampId] || null) : null;

        // Toggle classes
        card.classList.toggle('pc-ingame', isInGame);
        card.style.removeProperty('--live-splash');

        if (isInGame && liveChampName) {
            card.style.setProperty('--live-splash', `url('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${liveChampName}_0.jpg')`);
        }

        // Ensure splash div exists
        if (isInGame && !card.querySelector('.pc-live-splash')) {
            const splashDiv = document.createElement('div');
            splashDiv.className = 'pc-live-splash';
            card.insertBefore(splashDiv, card.firstChild);
        }

        // Add/remove champion badge
        let champBadge = card.querySelector('.pc-live-champ');
        if (isInGame && liveChampName) {
            if (!champBadge) {
                champBadge = document.createElement('div');
                champBadge.className = 'pc-live-champ';
                // Insert before noob-footer or at end
                const noobFooter = card.querySelector('.noob-footer');
                if (noobFooter) card.insertBefore(champBadge, noobFooter);
                else card.appendChild(champBadge);
            }
            champBadge.innerHTML = `🎮 Jogando de <b>${liveChampName}</b>`;
        } else if (champBadge) {
            champBadge.remove();
        }

        // Live players float to top of squad grid
        const grid = document.getElementById('squad-grid');
        if (grid && isInGame) {
            grid.insertBefore(card, grid.firstChild);
        }
    }

    // ======================== LIVE CHECK (card badges only) ========================
    window.manualCheckLive = async function() {
        const btn = document.getElementById('squad-live-btn');
        if (btn) { btn.disabled = true; btn.innerHTML = '&#8987; Verificando...'; }
        await checkSquadInGame();
        const liveCount = Object.keys(_liveAlerts).length;
        if (liveCount === 0) {
            showToast('😴', 'Ninguém do squad está em partida agora.');
        }
        if (btn) { btn.disabled = false; btn.innerHTML = '🎮 Quem está em partida?'; }
    };

    // Guess lane roles based on champion + spell (heuristic)
    function guessRole(p) {
        const smite = p.spell1Id === 11 || p.spell2Id === 11;
        if (smite) return 'JNG';
        // Known support champions by ID (rough list)
        const supChamps = new Set([12,37,40,43,44,89,111,117,201,223,235,267,350,412,432,497,518,555,876,887,950]);
        const adcChamps = new Set([15,18,21,22,29,42,51,67,81,96,110,119,133,145,147,202,221,222,234,236,360,498,523,528,895,901]);
        if (supChamps.has(p.championId)) return 'SUP';
        if (adcChamps.has(p.championId)) return 'ADC';
        return null; // Unknown, will be assigned later
    }

    function assignRoles(team) {
        const roles = ['TOP', 'JNG', 'MID', 'ADC', 'SUP'];
        const assigned = new Array(5).fill(null);
        const used = new Set();
        // First pass: assign confident guesses
        team.forEach((p, i) => {
            const g = guessRole(p);
            if (g && !used.has(g)) { assigned[i] = g; used.add(g); }
        });
        // Second pass: fill remaining
        team.forEach((p, i) => {
            if (!assigned[i]) {
                const remaining = roles.filter(r => !used.has(r));
                if (remaining.length) { assigned[i] = remaining[0]; used.add(remaining[0]); }
                else assigned[i] = 'MID';
            }
        });
        return assigned;
    }

    function fmtGameTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }



    // Quick-check for new matches (fetches last 2 match IDs and compares)
    window.checkNewMatches = async function(playerIdx) {
        const btn = document.getElementById('prof-refresh-btn');
        if (btn) { btn.disabled = true; btn.innerHTML = '&#8987; Verificando...'; }
        try {
            const d = cache[playerIdx];
            if (!d?.account?.puuid) throw new Error('Dados não disponíveis');
            const p = PLAYERS[playerIdx], cl = clust(p.region), pl = plat(p.region);
            const puuid = d.account.puuid;

            // Fetch only last 2 match IDs
            const ids = await riot(`https://${cl}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=2`);
            if (!ids?.length) { showToast('📋', 'Nenhuma partida encontrada.'); return; }
            const oldIds = new Set((d.matches||[]).map(m => m.metadata?.matchId).filter(Boolean));
            const newIds = ids.filter(id => !oldIds.has(id));
            if (!newIds.length) {
                showToast('✅', `<b>${d.account.gameName||p.name}</b> — Nenhuma partida nova.`);
                if (btn) { btn.disabled = false; btn.innerHTML = '&#128260; Verificar partidas novas'; }
                return;
            }
            // Fetch new matches
            if (btn) btn.innerHTML = `&#8987; Baixando ${newIds.length} partida${newIds.length>1?'s':''}...`;
            const newMatches = [];
            for (const id of newIds) {
                await new Promise(r => setTimeout(r, 1200));
                const raw = await rots(`https://${cl}.api.riotgames.com/lol/match/v5/matches/${id}`, null);
                if (raw) { const c = compressMatch(raw, puuid); if (c) newMatches.push(c); }
            }
            // Also refresh ranked data
            if (btn) btn.innerHTML = '&#8987; Atualizando rank...';
            const freshLeague = await rots(`https://${pl}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`, []);
            const prev = cache[playerIdx];
            const oldLeague = prev.league;
            if (freshLeague && freshLeague.length) prev.league = freshLeague;

            if (newMatches.length) {
                const existingIds2 = new Set((prev.matches||[]).map(m => m.metadata?.matchId).filter(Boolean));
                const brandNew = newMatches.filter(m => !existingIds2.has(m.metadata?.matchId));
                if (brandNew.length) {
                    prev.matches = [...brandNew, ...(prev.matches||[])].sort((a,b) => (b.info?.gameCreation||0)-(a.info?.gameCreation||0));
                    prev._ts = Date.now();
                    cache[playerIdx] = prev;
                    lsSet(`profa_player_${playerIdx}`, prev);
                    fbSavePlayer(playerIdx, prev);
                    if (oldLeague) detectRankChanges(playerIdx, { league: oldLeague }, { league: prev.league, account: prev.account, matches: prev.matches });
                    showToast('🆕', `<b>${brandNew.length}</b> partida${brandNew.length>1?'s':''}  nova${brandNew.length>1?'s':''} de <b>${d.account.gameName||p.name}</b>!`);
                    renderProfile(playerIdx);
                    return;
                }
            }
            // No new matches but rank may have changed
            prev._ts = Date.now();
            cache[playerIdx] = prev;
            lsSet(`profa_player_${playerIdx}`, prev);
            fbSavePlayer(playerIdx, prev);
            if (oldLeague) detectRankChanges(playerIdx, { league: oldLeague }, { league: prev.league, account: prev.account, matches: prev.matches });
            showToast('✅', `<b>${d.account.gameName||p.name}</b> — Nenhuma partida nova. Rank atualizado.`);
        } catch(e) {
            console.warn('[CheckNew]', e);
            showToast('⚠️', 'Erro ao verificar: ' + (e.message||'tente novamente'));
        }
        if (btn) { btn.disabled = false; btn.innerHTML = '&#128260; Verificar partidas novas'; }
    };


    // ======================== PALPITES COM PRAZO ========================
    function isPredictionLocked(startTime) {
        if (!startTime) return false;
        return Date.now() >= new Date(startTime).getTime();
    }

    // ======================== RANKING HISTORY (por semana) ========================
    async function saveRankingSnapshot(rankings) {
        if (!db) return;
        const week = getWeekId();
        const data = {};
        rankings.forEach(r => { data[r.name] = { pts: r.pts, ex: r.ex, wn: r.wn, wr: r.wr }; });
        db.ref(`rankingHistory/${week}`).set(data).catch(() => {});
    }

    function getWeekId() {
        const d = new Date();
        const start = new Date(d.getFullYear(), 0, 1);
        const week = Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
        return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
    }

    async function loadRankingHistory() {
        if (!db) return {};
        try {
            const snap = await db.ref('rankingHistory').orderByKey().limitToLast(8).once('value');
            return snap.val() || {};
        } catch(_) { return {}; }
    }

    // ======================== CONQUISTAS ONLINE ========================
    async function saveAchievements(achievements) {
        if (!db) return;
        const data = {};
        achievements.forEach((a, i) => { if (a.unlocked) data[i] = { title: a.title, player: a.player || '', icon: a.icon }; });
        db.ref('achievements').set(data).catch(() => {});
    }

    // ======================== REAÇÕES NOS PALPITES ========================
    window.reactPred = function(matchId, emoji) {
        const user = getLoggedUser();
        if (!user || !db) return;
        const safeMid = matchId.replace(/[.#$/\[\]]/g, '_');
        db.ref(`predReactions/${safeMid}/${user.idx}`).set({ emoji, name: PLAYERS[user.idx]?.name || '?', ts: Date.now() }).catch(() => {});
        // Update UI
        const btn = document.querySelector(`[data-react-mid="${matchId}"][data-react-emoji="${emoji}"]`);
        if (btn) btn.classList.add('reacted');
    };

    async function getPredReactions(matchId) {
        if (!db) return {};
        const safeMid = matchId.replace(/[.#$/\[\]]/g, '_');
        try {
            const snap = await db.ref(`predReactions/${safeMid}`).once('value');
            return snap.val() || {};
        } catch(_) { return {}; }
    }

    // ======================== LOAD USER PREFS FROM FIREBASE ========================
    async function loadUserPrefs() {
        if (!db) return;
        const user = getLoggedUser();
        if (!user) return;
        try {
            const snap = await db.ref(`userPrefs/${user.idx}`).once('value');
            const prefs = snap.val();
            if (!prefs) return;
            // Sync theme
            if (prefs.theme && prefs.theme !== localStorage.getItem('profa_theme')) {
                applyTheme(prefs.theme);
            }
            // Sync icon
            if (prefs.icon) {
                setCustomIcon(user.idx, prefs.icon);
            }
        } catch(_) {}
        // Load icons for all players
        try {
            const snap = await db.ref('userPrefs').once('value');
            const all = snap.val() || {};
            for (const [idx, prefs] of Object.entries(all)) {
                if (prefs.icon) setCustomIcon(parseInt(idx), prefs.icon);
            }
        } catch(_) {}
    }

    // ======================== INIT ========================
    // Theme
    applyTheme(localStorage.getItem('profa_theme') || 'dark');
    // Auto-detect latest DDragon version, then load champion data
    fetch('https://ddragon.leagueoflegends.com/api/versions.json')
        .then(r => r.json())
        .then(versions => { if (versions?.[0]) DVER = versions[0]; })
        .catch(() => {})
        .finally(() => {
            fetch(`https://ddragon.leagueoflegends.com/cdn/${DVER}/data/en_US/champion.json`)
                .then(r => r.json())
                .then(d => { for (const [k,v] of Object.entries(d.data)) CMAP[v.key] = k; })
                .catch(() => {});
        });
    updateNavUser();
    nav(location.hash || '#team');
    // Check API key health on load (non-blocking)
    checkKeyHealth();
    updateKeyStatus();
    setInterval(updateKeyStatus, 60000);
    // Live badge check every 60s
    checkLiveBadge();
    liveBadgeTimer = setInterval(checkLiveBadge, 60000);
    // Firebase-powered features (non-blocking)
    loadPinsFromFirebase();
    loadUserPrefs();
    listenPresence();
    // Set presence for logged user
    const initUser = getLoggedUser();
    if (initUser) updatePresence(initUser);
    // Check squad in game — first check 10s after load, then every 90s
    setTimeout(checkSquadInGame, 10000);
    setInterval(checkSquadInGame, 90000);
    // Load LP history from Firebase into localStorage
    if (db) {
        db.ref('lpHistory').once('value').then(snap => {
            const fbHistory = snap.val();
            if (fbHistory) {
                const local = JSON.parse(localStorage.getItem('soloq_history') || '{}');
                const merged = { ...fbHistory, ...local };
                localStorage.setItem('soloq_history', JSON.stringify(merged));
            }
        }).catch(() => {});
    }
    // PWA Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').then(reg => {
            // Check for updates
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        newWorker.postMessage({ type: 'SKIP_WAITING' });
                    }
                });
            });
        }).catch(() => {});
    }

    })();