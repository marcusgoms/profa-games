/**
 * PROFA GAMES — Test Runner (Node.js)
 * Testa funções puras, arquivos estáticos, consistência e integridade do projeto
 */
'use strict';
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
let passed = 0, failed = 0, total = 0;
const failures = [];
let currentGroup = '';

function group(name) { currentGroup = name; console.log(`\n\x1b[36m━━━ ${name} ━━━\x1b[0m`); }

function test(name, fn) {
    total++;
    try {
        fn();
        passed++;
        console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    } catch (err) {
        failed++;
        console.log(`  \x1b[31m✗\x1b[0m ${name} — \x1b[31m${err.message}\x1b[0m`);
        failures.push({ group: currentGroup, name, err: err.message });
    }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function assertEqual(a, b, msg) { if (a !== b) throw new Error(msg || `Esperado ${JSON.stringify(b)}, recebeu ${JSON.stringify(a)}`); }
function assertIncludes(str, sub, msg) { if (!String(str).includes(sub)) throw new Error(msg || `Não contém "${sub}"`); }
function assertNotIncludes(str, sub, msg) { if (String(str).includes(sub)) throw new Error(msg || `Não deveria conter "${sub}"`); }
function assertFileExists(name) { assert(fs.existsSync(path.join(DIR, name)), `Arquivo ${name} não encontrado`); }
function readFile(name) { return fs.readFileSync(path.join(DIR, name), 'utf-8'); }

// ==================== RECREATE UTILITY FUNCTIONS (from app.js) ====================
const DVER = '14.24.1';
const SPELL_MAP = {1:'SummonerBoost',3:'SummonerExhaust',4:'SummonerFlash',6:'SummonerHaste',7:'SummonerHeal',11:'SummonerSmite',12:'SummonerTeleport',13:'SummonerMana',14:'SummonerDot',21:'SummonerBarrier',30:'SummonerPoroRecall',31:'SummonerPoroThrow',32:'SummonerSnowball',39:'SummonerSnowURFSnowball_Mark',54:'Summoner_UltBookPlaceholder',55:'Summoner_UltBookSmitePlaceholder',2201:'SummonerCherryHold',2202:'SummonerCherryFlash'};
let CMAP = { 1: 'Annie', 222: 'Jinx', 238: 'Zed', 17: 'Teemo' };
const PLAYERS = [
    { name:'PROF', tag:'ANON', region:'BR1' },
    { name:'loadt', tag:'9753', region:'BR1' },
    { name:'Spring Boot', tag:'Getss', region:'BR1' },
    { name:'tume', tag:'br1', region:'BR1' },
    { name:'Bruvel', tag:'BTC', region:'BR1' },
    { name:'Matraca IV', tag:'kash', region:'BR1' },
    { name:'BOONSKT', tag:'br1', region:'BR1' },
    { name:'Nick', tag:'LSD21', region:'BR1' },
    { name:'Malaric', tag:'PR1', region:'BR1', special:'noob' },
];

const plat = r => ({BR1:'br1',NA1:'na1',EUW1:'euw1',EUN1:'eun1',KR:'kr',TR1:'tr1',LA1:'la1',LA2:'la2',OC1:'oc1'})[r]||'br1';
const clust = r => (['NA1','BR1','LA1','LA2','OC1'].includes(r))?'americas':(['EUW1','EUN1'].includes(r))?'europe':'asia';
const fmtDur = s => s ? `${(s/60)|0}min` : '?';
const fmtGold = g => g>=1000?(g/1000).toFixed(1)+'K':String(g||0);
const fmtTime = s => `${(s/60)|0}:${String((s%60)|0).padStart(2,'0')}`;
const champImg = id => `https://ddragon.leagueoflegends.com/cdn/${DVER}/img/champion/${CMAP[id]||id||'Teemo'}.png`;
const itemImg = id => id?`https://ddragon.leagueoflegends.com/cdn/${DVER}/img/item/${id}.png`:'';
const spellImg = id => `https://ddragon.leagueoflegends.com/cdn/${DVER}/img/spell/${SPELL_MAP[id]||id||'SummonerFlash'}.png`;
const profImg = id => `https://ddragon.leagueoflegends.com/cdn/${DVER}/img/profileicon/${id}.png`;
const modeName = m => ({CLASSIC:"Summoner's Rift",ARAM:'ARAM',TUTORIAL:'Tutorial'})[m]||m||'Normal';
const rankCls = t => t?`rank-${t.toLowerCase()}`:'';
const drgEmoji = d => ({ocean:'🌊',infernal:'🔥',cloud:'💨',mountain:'⛰️',elder:'🐲',hextech:'⚡',chemtech:'☣️'})[d]||'🔥';
const pn = h => {
    if (!h || h === 'team' || h.startsWith('profile/') || h.startsWith('compare')) return 'team';
    if (h === 'chat') return 'chat';
    if (h === 'cblol') return 'cblol';
    if (h.startsWith('live')) return 'live';
    if (h === 'dashboard') return 'dashboard';
    if (h === 'teambuilder') return 'dashboard';
    return 'team';
};

function fmtAgo(ts) {
    if (!ts) return '';
    const d = (Date.now() - ts) / 1000;
    return d < 3600 ? `${(d/60)|0}min atrás` : d < 86400 ? `${(d/3600)|0}h atrás` : `${(d/86400)|0}d atrás`;
}

function fmtKeyTime(ms) {
    if (ms === null) return 'desconhecido';
    if (ms <= 0) return 'expirada';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}min restantes` : `${m}min restantes`;
}

function simpleHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = ((h << 5) - h + str.charCodeAt(i)) | 0; }
    return String(h);
}

function normPlayerData(d) {
    if (!d) return null;
    if (!d.account) return null;
    d.league = Array.isArray(d.league) ? d.league : [];
    d.mastery = Array.isArray(d.mastery) ? d.mastery : [];
    d.matches = Array.isArray(d.matches) ? d.matches : [];
    d.summoner = d.summoner || {};
    return d;
}

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

// ==================== START TESTS ====================
console.log('\x1b[1m\x1b[35m╔══════════════════════════════════════════╗\x1b[0m');
console.log('\x1b[1m\x1b[35m║   PROFA GAMES — Suite de Testes Completa ║\x1b[0m');
console.log('\x1b[1m\x1b[35m╚══════════════════════════════════════════╝\x1b[0m');
const startTime = Date.now();

// ====== 1. ARQUIVOS DO PROJETO ======
group('1. Arquivos do Projeto');
test('index.html existe', () => assertFileExists('index.html'));
test('app.js existe', () => assertFileExists('app.js'));
test('style.css existe', () => assertFileExists('style.css'));
test('config.js existe', () => assertFileExists('config.js'));
test('sw.js existe', () => assertFileExists('sw.js'));
test('manifest.json existe', () => assertFileExists('manifest.json'));
test('stats-worker.js existe', () => assertFileExists('stats-worker.js'));
test('tests.html existe', () => assertFileExists('tests.html'));

// ====== 2. JOGADORES ======
group('2. Configuração dos Jogadores');
test('9 jogadores no squad', () => assertEqual(PLAYERS.length, 9));
test('Todos têm name, tag, region', () => {
    PLAYERS.forEach((p, i) => { assert(p.name, `${i} sem name`); assert(p.tag, `${i} sem tag`); assert(p.region, `${i} sem region`); });
});
test('Todos são BR1', () => PLAYERS.forEach((p, i) => assertEqual(p.region, 'BR1', `Jogador ${i}`)));
test('BOONSKT é index 6', () => assertEqual(PLAYERS[6].name, 'BOONSKT'));
test('Malaric é noob (special)', () => assertEqual(PLAYERS[8].special, 'noob'));
test('PROF é index 0', () => assertEqual(PLAYERS[0].name, 'PROF'));
test('Nenhum name duplicado', () => {
    const names = PLAYERS.map(p => p.name);
    assertEqual(names.length, new Set(names).size, 'Names duplicados');
});

// ====== 3. MAPEAMENTO DE REGIÃO ======
group('3. Mapeamento de Região (plat/clust)');
test('plat BR1 → br1', () => assertEqual(plat('BR1'), 'br1'));
test('plat NA1 → na1', () => assertEqual(plat('NA1'), 'na1'));
test('plat EUW1 → euw1', () => assertEqual(plat('EUW1'), 'euw1'));
test('plat EUN1 → eun1', () => assertEqual(plat('EUN1'), 'eun1'));
test('plat KR → kr', () => assertEqual(plat('KR'), 'kr'));
test('plat TR1 → tr1', () => assertEqual(plat('TR1'), 'tr1'));
test('plat LA1 → la1', () => assertEqual(plat('LA1'), 'la1'));
test('plat LA2 → la2', () => assertEqual(plat('LA2'), 'la2'));
test('plat OC1 → oc1', () => assertEqual(plat('OC1'), 'oc1'));
test('plat desconhecido → br1 fallback', () => assertEqual(plat('MARS'), 'br1'));
test('clust BR1 → americas', () => assertEqual(clust('BR1'), 'americas'));
test('clust NA1 → americas', () => assertEqual(clust('NA1'), 'americas'));
test('clust LA1 → americas', () => assertEqual(clust('LA1'), 'americas'));
test('clust LA2 → americas', () => assertEqual(clust('LA2'), 'americas'));
test('clust OC1 → americas', () => assertEqual(clust('OC1'), 'americas'));
test('clust EUW1 → europe', () => assertEqual(clust('EUW1'), 'europe'));
test('clust EUN1 → europe', () => assertEqual(clust('EUN1'), 'europe'));
test('clust KR → asia', () => assertEqual(clust('KR'), 'asia'));

// ====== 4. FORMATAÇÃO ======
group('4. Funções de Formatação');
test('fmtDur 300s → 5min', () => assertEqual(fmtDur(300), '5min'));
test('fmtDur 0 → ?', () => assertEqual(fmtDur(0), '?'));
test('fmtDur null → ?', () => assertEqual(fmtDur(null), '?'));
test('fmtDur 90s → 1min', () => assertEqual(fmtDur(90), '1min'));
test('fmtDur 3600s → 60min', () => assertEqual(fmtDur(3600), '60min'));
test('fmtGold 1000 → 1.0K', () => assertEqual(fmtGold(1000), '1.0K'));
test('fmtGold 15200 → 15.2K', () => assertEqual(fmtGold(15200), '15.2K'));
test('fmtGold 500 → 500', () => assertEqual(fmtGold(500), '500'));
test('fmtGold 0 → 0', () => assertEqual(fmtGold(0), '0'));
test('fmtGold null → 0', () => assertEqual(fmtGold(null), '0'));
test('fmtGold 999 → 999', () => assertEqual(fmtGold(999), '999'));
test('fmtTime 90s → 1:30', () => assertEqual(fmtTime(90), '1:30'));
test('fmtTime 0 → 0:00', () => assertEqual(fmtTime(0), '0:00'));
test('fmtTime 3661 → 61:01', () => assertEqual(fmtTime(3661), '61:01'));
test('fmtTime 5 → 0:05', () => assertEqual(fmtTime(5), '0:05'));
test('fmtTime 59 → 0:59', () => assertEqual(fmtTime(59), '0:59'));
test('fmtAgo null → ""', () => assertEqual(fmtAgo(null), ''));
test('fmtAgo 0 → "" (0 é falsy)', () => assertEqual(fmtAgo(0), ''));
test('fmtAgo 2min → contém "min atrás"', () => assertIncludes(fmtAgo(Date.now() - 120000), 'min atrás'));
test('fmtAgo 2h → contém "h atrás"', () => assertIncludes(fmtAgo(Date.now() - 7200000), 'h atrás'));
test('fmtAgo 2d → contém "d atrás"', () => assertIncludes(fmtAgo(Date.now() - 172800000), 'd atrás'));
test('fmtKeyTime null → desconhecido', () => assertEqual(fmtKeyTime(null), 'desconhecido'));
test('fmtKeyTime 0 → expirada', () => assertEqual(fmtKeyTime(0), 'expirada'));
test('fmtKeyTime -100 → expirada', () => assertEqual(fmtKeyTime(-100), 'expirada'));
test('fmtKeyTime 1h → 1h 0min restantes', () => assertEqual(fmtKeyTime(3600000), '1h 0min restantes'));
test('fmtKeyTime 1.5h → 1h 30min restantes', () => assertEqual(fmtKeyTime(5400000), '1h 30min restantes'));
test('fmtKeyTime 5min → 5min restantes', () => assertEqual(fmtKeyTime(300000), '5min restantes'));

// ====== 5. URLS DE IMAGEM ======
group('5. Construtores de URL de Imagem');
test('champImg com CMAP → nome correto', () => assertIncludes(champImg(222), '/Jinx.png'));
test('champImg com CMAP → tem versão DDragon', () => assertIncludes(champImg(222), DVER));
test('champImg sem CMAP → usa ID', () => assertIncludes(champImg(999), '/999.png'));
test('champImg null → Teemo fallback', () => assertIncludes(champImg(null), '/Teemo.png'));
test('champImg undefined → Teemo fallback', () => assertIncludes(champImg(undefined), '/Teemo.png'));
test('itemImg válido → URL completa', () => {
    const url = itemImg(3006);
    assertIncludes(url, '/3006.png');
    assertIncludes(url, DVER);
});
test('itemImg 0 → string vazia', () => assertEqual(itemImg(0), ''));
test('itemImg null → string vazia', () => assertEqual(itemImg(null), ''));
test('spellImg Flash → SummonerFlash', () => assertIncludes(spellImg(4), '/SummonerFlash.png'));
test('spellImg Ignite → SummonerDot', () => assertIncludes(spellImg(14), '/SummonerDot.png'));
test('spellImg Smite → SummonerSmite', () => assertIncludes(spellImg(11), '/SummonerSmite.png'));
test('spellImg Heal → SummonerHeal', () => assertIncludes(spellImg(7), '/SummonerHeal.png'));
test('spellImg Teleport → SummonerTeleport', () => assertIncludes(spellImg(12), '/SummonerTeleport.png'));
test('spellImg null → SummonerFlash fallback', () => assertIncludes(spellImg(null), '/SummonerFlash.png'));
test('profImg 4644 → URL completa', () => {
    const url = profImg(4644);
    assertIncludes(url, '/4644.png');
    assertIncludes(url, 'profileicon');
});

// ====== 6. SPELL MAP ======
group('6. Mapa de Summoner Spells');
test('Flash (4)', () => assertEqual(SPELL_MAP[4], 'SummonerFlash'));
test('Ignite (14)', () => assertEqual(SPELL_MAP[14], 'SummonerDot'));
test('Heal (7)', () => assertEqual(SPELL_MAP[7], 'SummonerHeal'));
test('Teleport (12)', () => assertEqual(SPELL_MAP[12], 'SummonerTeleport'));
test('Smite (11)', () => assertEqual(SPELL_MAP[11], 'SummonerSmite'));
test('Exhaust (3)', () => assertEqual(SPELL_MAP[3], 'SummonerExhaust'));
test('Barrier (21)', () => assertEqual(SPELL_MAP[21], 'SummonerBarrier'));
test('Ghost (6)', () => assertEqual(SPELL_MAP[6], 'SummonerHaste'));
test('Cleanse (1)', () => assertEqual(SPELL_MAP[1], 'SummonerBoost'));
test('Clarity (13)', () => assertEqual(SPELL_MAP[13], 'SummonerMana'));
test('Snowball (32)', () => assertEqual(SPELL_MAP[32], 'SummonerSnowball'));

// ====== 7. RANK/MODE/DRAGON ======
group('7. Helpers de Rank, Modo e Dragon');
test('rankCls DIAMOND', () => assertEqual(rankCls('DIAMOND'), 'rank-diamond'));
test('rankCls GOLD', () => assertEqual(rankCls('GOLD'), 'rank-gold'));
test('rankCls CHALLENGER', () => assertEqual(rankCls('CHALLENGER'), 'rank-challenger'));
test('rankCls IRON', () => assertEqual(rankCls('IRON'), 'rank-iron'));
test('rankCls EMERALD', () => assertEqual(rankCls('EMERALD'), 'rank-emerald'));
test('rankCls MASTER', () => assertEqual(rankCls('MASTER'), 'rank-master'));
test('rankCls vazio → ""', () => assertEqual(rankCls(''), ''));
test('rankCls null → ""', () => assertEqual(rankCls(null), ''));
test('modeName CLASSIC → SR', () => assertEqual(modeName('CLASSIC'), "Summoner's Rift"));
test('modeName ARAM', () => assertEqual(modeName('ARAM'), 'ARAM'));
test('modeName TUTORIAL', () => assertEqual(modeName('TUTORIAL'), 'Tutorial'));
test('modeName null → Normal', () => assertEqual(modeName(null), 'Normal'));
test('modeName desconhecido → passthrough', () => assertEqual(modeName('URF'), 'URF'));
test('drgEmoji ocean → 🌊', () => assertEqual(drgEmoji('ocean'), '🌊'));
test('drgEmoji infernal → 🔥', () => assertEqual(drgEmoji('infernal'), '🔥'));
test('drgEmoji cloud → 💨', () => assertEqual(drgEmoji('cloud'), '💨'));
test('drgEmoji mountain → ⛰️', () => assertEqual(drgEmoji('mountain'), '⛰️'));
test('drgEmoji elder → 🐲', () => assertEqual(drgEmoji('elder'), '🐲'));
test('drgEmoji hextech → ⚡', () => assertEqual(drgEmoji('hextech'), '⚡'));
test('drgEmoji chemtech → ☣️', () => assertEqual(drgEmoji('chemtech'), '☣️'));
test('drgEmoji desconhecido → 🔥', () => assertEqual(drgEmoji('void'), '🔥'));

// ====== 8. ROUTER ======
group('8. Router (pn)');
test('team → team', () => assertEqual(pn('team'), 'team'));
test('vazio → team', () => assertEqual(pn(''), 'team'));
test('null → team', () => assertEqual(pn(null), 'team'));
test('profile/3 → team', () => assertEqual(pn('profile/3'), 'team'));
test('profile/0 → team', () => assertEqual(pn('profile/0'), 'team'));
test('compare → team', () => assertEqual(pn('compare'), 'team'));
test('compare/1/2 → team', () => assertEqual(pn('compare/1/2'), 'team'));
test('chat → chat', () => assertEqual(pn('chat'), 'chat'));
test('cblol → cblol', () => assertEqual(pn('cblol'), 'cblol'));
test('live → live', () => assertEqual(pn('live'), 'live'));
test('live/123 → live', () => assertEqual(pn('live/123'), 'live'));
test('dashboard → dashboard', () => assertEqual(pn('dashboard'), 'dashboard'));
test('teambuilder → dashboard', () => assertEqual(pn('teambuilder'), 'dashboard'));
test('desconhecido → team', () => assertEqual(pn('blablabla'), 'team'));

// ====== 9. HASH ======
group('9. Hash (simpleHash)');
test('retorna string', () => assertEqual(typeof simpleHash('test'), 'string'));
test('determinístico', () => assertEqual(simpleHash('1234'), simpleHash('1234')));
test('inputs diferentes → hashes diferentes', () => assert(simpleHash('1234') !== simpleHash('5678')));
test('string vazia → "0"', () => assertEqual(simpleHash(''), '0'));
test('PIN 4 dígitos funciona', () => {
    const h = simpleHash('9999');
    assert(h.length > 0); assert(!isNaN(Number(h)));
});
test('strings longas não explodem', () => {
    const h = simpleHash('a'.repeat(10000));
    assertEqual(typeof h, 'string');
});

// ====== 10. NORMALIZAÇÃO ======
group('10. Normalização de Dados (normPlayerData)');
test('null → null', () => assertEqual(normPlayerData(null), null));
test('undefined → null', () => assertEqual(normPlayerData(undefined), null));
test('sem account → null', () => assertEqual(normPlayerData({}), null));
test('com outras props sem account → null', () => assertEqual(normPlayerData({ league: [], name: 'x' }), null));
test('league undefined → []', () => {
    const d = normPlayerData({ account: { puuid: 'x' } });
    assert(Array.isArray(d.league)); assertEqual(d.league.length, 0);
});
test('mastery undefined → []', () => {
    const d = normPlayerData({ account: { puuid: 'x' } });
    assert(Array.isArray(d.mastery));
});
test('matches undefined → []', () => {
    const d = normPlayerData({ account: { puuid: 'x' } });
    assert(Array.isArray(d.matches));
});
test('Firebase object (não-array) → normaliza', () => {
    const d = normPlayerData({ account: { puuid: 'x' }, league: { 0: 'a' }, mastery: 'broken', matches: null });
    assert(Array.isArray(d.league)); assert(Array.isArray(d.mastery)); assert(Array.isArray(d.matches));
});
test('dados válidos preservados', () => {
    const d = normPlayerData({ account: { puuid: 'abc' }, league: [{ tier: 'GOLD' }], mastery: [{ id: 1 }], matches: [{ id: 'm1' }] });
    assertEqual(d.league.length, 1); assertEqual(d.mastery.length, 1); assertEqual(d.matches.length, 1);
});
test('summoner undefined → {}', () => {
    const d = normPlayerData({ account: { puuid: 'x' } });
    assertEqual(typeof d.summoner, 'object'); assert(d.summoner !== null);
});
test('account preservado', () => {
    const d = normPlayerData({ account: { puuid: 'test123' } });
    assertEqual(d.account.puuid, 'test123');
});

// ====== 11. BIGADD ======
group('11. BigNumber (bigAdd)');
test('100 + 1 = 101', () => assertEqual(bigAdd('100', 1), '101'));
test('999 + 1 = 1000', () => assertEqual(bigAdd('999', 1), '1000'));
test('0 + 5 = 5', () => assertEqual(bigAdd('0', 5), '5'));
test('9999 + 1 = 10000', () => assertEqual(bigAdd('9999', 1), '10000'));
test('event ID grande + 1', () => assertEqual(bigAdd('110947830934563400', 1), '110947830934563401'));
test('123456789 + 0 = 123456789', () => assertEqual(bigAdd('123456789', 0), '123456789'));

// ====== 12. MANIFEST.JSON ======
group('12. PWA Manifest');
test('manifest.json é JSON válido', () => {
    const m = JSON.parse(readFile('manifest.json'));
    assert(typeof m === 'object');
});
test('tem name e short_name', () => {
    const m = JSON.parse(readFile('manifest.json'));
    assert(m.name); assert(m.short_name);
});
test('display é standalone', () => {
    const m = JSON.parse(readFile('manifest.json'));
    assertEqual(m.display, 'standalone');
});
test('tem theme_color #00d4ff', () => {
    const m = JSON.parse(readFile('manifest.json'));
    assertEqual(m.theme_color, '#00d4ff');
});
test('tem background_color #0d0d1a', () => {
    const m = JSON.parse(readFile('manifest.json'));
    assertEqual(m.background_color, '#0d0d1a');
});
test('tem pelo menos 1 icon', () => {
    const m = JSON.parse(readFile('manifest.json'));
    assert(m.icons && m.icons.length >= 1);
});
test('tem shortcuts', () => {
    const m = JSON.parse(readFile('manifest.json'));
    assert(m.shortcuts && m.shortcuts.length >= 3, `Apenas ${m.shortcuts?.length} shortcuts`);
});
test('tem categorias', () => {
    const m = JSON.parse(readFile('manifest.json'));
    assert(m.categories && m.categories.includes('games'));
});
test('lang é pt-BR', () => {
    const m = JSON.parse(readFile('manifest.json'));
    assertEqual(m.lang, 'pt-BR');
});
test('start_url é /', () => {
    const m = JSON.parse(readFile('manifest.json'));
    assertEqual(m.start_url, '/');
});

// ====== 13. SERVICE WORKER ======
group('13. Service Worker (sw.js)');
const swContent = readFile('sw.js');
test('cache name é profa-v7', () => assertIncludes(swContent, "profa-v7"));
test('tem PROFILE_CACHE', () => assertIncludes(swContent, 'PROFILE_CACHE'));
test('tem DDRAGON_CACHE', () => assertIncludes(swContent, 'DDRAGON_CACHE'));
test('lista static assets corretos', () => {
    assertIncludes(swContent, '/index.html');
    assertIncludes(swContent, '/style.css');
    assertIncludes(swContent, '/app.js');
    assertIncludes(swContent, '/config.js');
    assertIncludes(swContent, '/stats-worker.js');
    assertIncludes(swContent, '/manifest.json');
});
test('ignora Riot Games API', () => assertIncludes(swContent, 'api.riotgames.com'));
test('ignora Firebase', () => assertIncludes(swContent, 'firebaseio.com'));
test('ignora LoL Esports', () => assertIncludes(swContent, 'lolesports.com'));
test('ignora YouTube', () => assertIncludes(swContent, 'youtube.com'));
test('ignora googleapis', () => assertIncludes(swContent, 'googleapis.com'));
test('cache DDragon separado', () => assertIncludes(swContent, 'ddragon.leagueoflegends.com'));
test('escuta CACHE_PROFILE message', () => assertIncludes(swContent, 'CACHE_PROFILE'));
test('escuta SKIP_WAITING message', () => assertIncludes(swContent, 'SKIP_WAITING'));
test('tem skipWaiting', () => assertIncludes(swContent, 'self.skipWaiting()'));
test('tem clients.claim', () => assertIncludes(swContent, 'self.clients.claim()'));

// ====== 14. WEB WORKER ======
group('14. Stats Worker (stats-worker.js)');
const workerContent = readFile('stats-worker.js');
test('tem handler championStats', () => assertIncludes(workerContent, "'championStats'"));
test('tem handler squadAggregates', () => assertIncludes(workerContent, "'squadAggregates'"));
test('tem handler winStreak', () => assertIncludes(workerContent, "'winStreak'"));
test('tem handler matchAggregation', () => assertIncludes(workerContent, "'matchAggregation'"));
test('tem self.onmessage', () => assertIncludes(workerContent, 'self.onmessage'));
test('retorna via self.postMessage', () => assertIncludes(workerContent, 'self.postMessage'));
test('calcChampionStats existe', () => assertIncludes(workerContent, 'function calcChampionStats'));
test('calcSquadAggregates existe', () => assertIncludes(workerContent, 'function calcSquadAggregates'));
test('calcWinStreaks existe', () => assertIncludes(workerContent, 'function calcWinStreaks'));
test('aggregateMatches existe', () => assertIncludes(workerContent, 'function aggregateMatches'));

// ====== 15. INDEX.HTML ======
group('15. HTML (index.html)');
const htmlContent = readFile('index.html');
test('tem DOCTYPE', () => assert(htmlContent.startsWith('<!DOCTYPE html')));
test('lang é pt-BR', () => assertIncludes(htmlContent, 'lang="pt-BR"'));
test('tem charset UTF-8', () => assertIncludes(htmlContent, 'charset="UTF-8"'));
test('tem viewport meta', () => assertIncludes(htmlContent, 'name="viewport"'));
test('tem theme-color meta', () => assertIncludes(htmlContent, 'name="theme-color"'));
test('tem apple-mobile-web-app-capable', () => assertIncludes(htmlContent, 'apple-mobile-web-app-capable'));
test('tem apple-mobile-web-app-status-bar-style', () => assertIncludes(htmlContent, 'apple-mobile-web-app-status-bar-style'));
test('tem apple-touch-icon', () => assertIncludes(htmlContent, 'apple-touch-icon'));
test('tem description meta', () => assertIncludes(htmlContent, 'name="description"'));
test('tem manifest link', () => assertIncludes(htmlContent, 'href="manifest.json"'));
test('tem favicon', () => assertIncludes(htmlContent, 'rel="icon"'));
test('carrega Firebase App', () => assertIncludes(htmlContent, 'firebase-app-compat.js'));
test('carrega Firebase Database', () => assertIncludes(htmlContent, 'firebase-database-compat.js'));
test('carrega config.js', () => assertIncludes(htmlContent, 'src="config.js"'));
test('carrega style.css', () => assertIncludes(htmlContent, 'href="style.css"'));
test('carrega app.js', () => assertIncludes(htmlContent, 'src="app.js"'));
test('tem nav com 5 pages', () => {
    assertIncludes(htmlContent, 'data-p="team"');
    assertIncludes(htmlContent, 'data-p="dashboard"');
    assertIncludes(htmlContent, 'data-p="cblol"');
    assertIncludes(htmlContent, 'data-p="live"');
    assertIncludes(htmlContent, 'data-p="chat"');
});
test('logo é link para #team', () => assertIncludes(htmlContent, 'href="#team" class="logo"'));
test('tem div #appc', () => assertIncludes(htmlContent, 'id="appc"'));
test('tem footer', () => assertIncludes(htmlContent, '<footer'));
test('tem theme toggle', () => assertIncludes(htmlContent, 'id="theme-toggle"'));
test('tem nav-user', () => assertIncludes(htmlContent, 'id="nav-user"'));
test('tem mobile menu button', () => assertIncludes(htmlContent, 'id="mmb"'));

// ====== 16. STYLE.CSS ======
group('16. CSS (style.css)');
const cssContent = readFile('style.css');
test('tem variáveis CSS root', () => assertIncludes(cssContent, ':root'));
test('tem --bg, --card, --pri, --txt', () => {
    assertIncludes(cssContent, '--bg:');
    assertIncludes(cssContent, '--card:');
    assertIncludes(cssContent, '--pri:');
    assertIncludes(cssContent, '--txt:');
});
test('tem tema light', () => assertIncludes(cssContent, '[data-theme="light"]'));
test('tem classes de card (.pc)', () => assertIncludes(cssContent, '.pc {'));
test('tem classes de profile (.pb, .pbi)', () => {
    assertIncludes(cssContent, '.pb {');
    assertIncludes(cssContent, '.pbi {');
});
test('tem skeleton pulse animation', () => {
    assertIncludes(cssContent, 'skel-pulse');
    assertIncludes(cssContent, '@keyframes skelPulse');
});
test('tem skeleton profile', () => assertIncludes(cssContent, 'skel-profile-header'));
test('tem skeleton dashboard', () => assertIncludes(cssContent, 'skel-dash-grid'));
test('tem skeleton CBLOL', () => assertIncludes(cssContent, 'skel-cblol-match'));
test('tem dynamic card in-game com splash', () => {
    assertIncludes(cssContent, 'pc-ingame');
    assertIncludes(cssContent, '@keyframes inGamePulse');
    assertIncludes(cssContent, 'pc-live-splash');
    assertIncludes(cssContent, '--live-splash');
    assertIncludes(cssContent, 'pc-live-champ');
});
test('tem dynamic card win streak', () => {
    assertIncludes(cssContent, 'pc-winstreak');
    assertIncludes(cssContent, '@keyframes winStreakGlow');
});
test('tem dynamic card loss streak', () => {
    assertIncludes(cssContent, 'pc-lossstreak');
    assertIncludes(cssContent, '@keyframes lossStreakGlow');
});
test('tem PWA install prompt', () => assertIncludes(cssContent, 'pwa-install'));
test('tem 3D effects', () => {
    assertIncludes(cssContent, 'card-glare');
    assertIncludes(cssContent, 'particle-canvas');
    assertIncludes(cssContent, 'rank-badge-3d');
});
test('tem rank colors (iron→challenger)', () => {
    assertIncludes(cssContent, 'rank-iron');
    assertIncludes(cssContent, 'rank-challenger');
    assertIncludes(cssContent, 'rank-diamond');
    assertIncludes(cssContent, 'rank-gold');
});
test('tem noob card styles', () => assertIncludes(cssContent, 'pc-noob'));
test('tem responsive mobile', () => assertIncludes(cssContent, '@media(max-width:760px)'));
test('tem responsive tablet', () => assertIncludes(cssContent, '@media(max-width:900px)'));
test('tem responsive small phones', () => assertIncludes(cssContent, '@media(max-width:400px)'));
test('desabilita 3D no mobile', () => {
    assertIncludes(cssContent, '.particle-canvas { display: none; }');
    assertIncludes(cssContent, '.rank-badge-3d { display: none; }');
});
test('tem chat styles', () => assertIncludes(cssContent, '.chat-box'));
test('tem CBLOL styles', () => assertIncludes(cssContent, '.cblol-hero'));
test('tem live page styles', () => assertIncludes(cssContent, '.live-game-card'));
test('tem music player styles', () => assertIncludes(cssContent, '.music-btn'));

// ====== 17. APP.JS INTEGRIDADE ======
group('17. app.js — Integridade e Features');
const appContent = readFile('app.js');
test('começa com IIFE', () => assert(appContent.trimStart().startsWith('(async () =>')));
test('termina com })();', () => assertIncludes(appContent.trim().slice(-10), '})()'));
test('tem PLAYERS array', () => assertIncludes(appContent, 'const PLAYERS'));
test('tem normPlayerData', () => assertIncludes(appContent, 'function normPlayerData'));
test('tem _refreshQueue (rate limit)', () => assertIncludes(appContent, '_refreshQueue'));
test('queue serializa trabalho corretamente', () => assertIncludes(appContent, '_refreshQueue = work.catch'));
test('tem ServerValue.TIMESTAMP no chat', () => assertIncludes(appContent, 'ServerValue.TIMESTAMP'));
test('tem escapeHtml', () => assertIncludes(appContent, 'function escapeHtml'));
test('tem detectRankChanges', () => assertIncludes(appContent, 'function detectRankChanges'));
test('tem sendNotification', () => assertIncludes(appContent, 'function sendNotification'));
test('tem checkSquadInGame', () => assertIncludes(appContent, 'function checkSquadInGame'));
test('tem renderTeam', () => assertIncludes(appContent, 'function renderTeam'));
test('tem renderProfile', () => assertIncludes(appContent, 'function renderProfile'));
test('tem renderCBLOL', () => assertIncludes(appContent, 'function renderCBLOL'));
test('tem renderDashboard', () => assertIncludes(appContent, 'function renderDashboard'));
test('tem renderChat', () => assertIncludes(appContent, 'function renderChat'));
test('tem renderCompare', () => assertIncludes(appContent, 'function renderCompare'));
test('tem renderLivePage', () => assertIncludes(appContent, 'function renderLivePage'));
test('tem Web Worker init', () => assertIncludes(appContent, "new Worker('stats-worker.js')"));
test('tem PWA install prompt', () => assertIncludes(appContent, 'beforeinstallprompt'));
test('tem dynamic card classes', () => {
    assertIncludes(appContent, 'pc-ingame');
    assertIncludes(appContent, 'pc-winstreak');
    assertIncludes(appContent, 'pc-lossstreak');
});
test('in-game card usa splash do campeão ao vivo', () => {
    assertIncludes(appContent, '--live-splash');
    assertIncludes(appContent, 'liveChampName');
    assertIncludes(appContent, 'pc-live-splash');
    assertIncludes(appContent, 'champion/splash');
});
test('checkSquadInGame salva champId', () => {
    assertIncludes(appContent, 'champId: liveChampId');
    assertIncludes(appContent, 'me.championId');
});
test('tem streak badge HTML', () => assertIncludes(appContent, 'pc-streak-badge'));
test('tem skeleton no profile', () => assertIncludes(appContent, 'skel-profile-header'));
test('tem skeleton no dashboard', () => assertIncludes(appContent, 'skel-dash-grid'));
test('tem skeleton no CBLOL', () => assertIncludes(appContent, 'skel-cblol-match'));
test('tem auto-detect DDragon version', () => assertIncludes(appContent, 'versions.json'));
test('tem SPELL_MAP', () => assertIncludes(appContent, 'const SPELL_MAP'));
test('tema light/dark toggle', () => assertIncludes(appContent, 'applyTheme'));
test('tem init3DTilt', () => assertIncludes(appContent, 'function init3DTilt'));
test('tem initParticles', () => assertIncludes(appContent, 'function initParticles'));
test('tem create3DRankBadge', () => assertIncludes(appContent, 'function create3DRankBadge'));
test('registra Service Worker', () => assertIncludes(appContent, "serviceWorker.register"));
test('tem cache de perfil para SW', () => assertIncludes(appContent, 'CACHE_PROFILE'));
test('tem music player', () => assertIncludes(appContent, 'musicToggle'));
test('tem Firebase presence', () => assertIncludes(appContent, 'function updatePresence'));
test('tem LP history sync', () => assertIncludes(appContent, 'lpHistory'));

// ====== 18. CONFIG.JS ======
group('18. config.js — Integridade');
const configContent = readFile('config.js');
test('tem PROFA_FIREBASE', () => assertIncludes(configContent, 'window.PROFA_FIREBASE'));
test('tem PROFA_CONFIG', () => assertIncludes(configContent, 'window.PROFA_CONFIG'));
test('tem apiKey do Firebase', () => assertIncludes(configContent, 'apiKey:'));
test('tem databaseURL', () => assertIncludes(configContent, 'databaseURL:'));
test('tem riotKey', () => assertIncludes(configContent, 'riotKey:'));
test('tem esportsKey', () => assertIncludes(configContent, 'esportsKey:'));
test('tem updateKeys function', () => assertIncludes(configContent, 'updateKeys('));
test('tem resetKeys function', () => assertIncludes(configContent, 'resetKeys()'));
test('usa localStorage para persistir keys', () => assertIncludes(configContent, 'localStorage'));

// ==================== RESULTS ====================
const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

console.log('\n\x1b[1m\x1b[35m══════════════════════════════════════════\x1b[0m');
if (failed === 0) {
    console.log(`\x1b[1m\x1b[32m ✅ TODOS OS TESTES PASSARAM: ${passed}/${total}\x1b[0m`);
} else {
    console.log(`\x1b[1m\x1b[31m ❌ ${failed} FALHA(S) de ${total} testes\x1b[0m`);
    console.log(`\x1b[32m ✅ ${passed} passaram\x1b[0m`);
    console.log('\n\x1b[31m Falhas:\x1b[0m');
    failures.forEach(f => console.log(`   \x1b[31m✗\x1b[0m [${f.group}] ${f.name}: ${f.err}`));
}
console.log(`\x1b[2m Tempo: ${elapsed}s\x1b[0m`);
console.log('\x1b[1m\x1b[35m══════════════════════════════════════════\x1b[0m\n');

process.exit(failed > 0 ? 1 : 0);
