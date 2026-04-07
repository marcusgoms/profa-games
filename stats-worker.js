/**
 * PROFA GAMES — Web Worker para processamento pesado de estatísticas
 * Move cálculos intensivos para fora da thread principal
 */
'use strict';

self.onmessage = function(e) {
    const { type, data } = e.data;

    switch (type) {
        case 'championStats':
            self.postMessage({ type: 'championStats', result: calcChampionStats(data) });
            break;
        case 'squadAggregates':
            self.postMessage({ type: 'squadAggregates', result: calcSquadAggregates(data) });
            break;
        case 'winStreak':
            self.postMessage({ type: 'winStreak', result: calcWinStreaks(data) });
            break;
        case 'matchAggregation':
            self.postMessage({ type: 'matchAggregation', result: aggregateMatches(data) });
            break;
    }
};

// Calcula estatísticas detalhadas por campeão para um jogador
function calcChampionStats({ matches, puuid, CMAP }) {
    const champStats = {};
    if (!matches || !puuid) return [];

    matches.forEach(m => {
        if (!m?.info?.participants) return;
        const p = m.info.participants.find(x => x.puuid === puuid);
        if (!p) return;
        const cid = p.championId;
        if (!champStats[cid]) {
            champStats[cid] = { id: cid, name: CMAP[cid] || cid, games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, cs: 0, damage: 0, gold: 0, vision: 0, duration: 0, doubles: 0, triples: 0, quadras: 0, pentas: 0 };
        }
        const s = champStats[cid];
        s.games++;
        if (p.win) s.wins++;
        s.kills += p.kills || 0;
        s.deaths += p.deaths || 0;
        s.assists += p.assists || 0;
        s.cs += (p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0);
        s.damage += p.totalDamageDealtToChampions || 0;
        s.gold += p.goldEarned || 0;
        s.vision += p.visionScore || 0;
        s.duration += (m.info.gameDuration || 0);
        s.doubles += p.doubleKills || 0;
        s.triples += p.tripleKills || 0;
        s.quadras += p.quadraKills || 0;
        s.pentas += p.pentaKills || 0;
    });

    return Object.values(champStats)
        .map(s => ({
            ...s,
            wr: s.games ? ((s.wins / s.games) * 100).toFixed(0) : 0,
            avgKills: s.games ? (s.kills / s.games).toFixed(1) : 0,
            avgDeaths: s.games ? (s.deaths / s.games).toFixed(1) : 0,
            avgAssists: s.games ? (s.assists / s.games).toFixed(1) : 0,
            avgCS: s.games ? (s.cs / s.games).toFixed(0) : 0,
            avgDamage: s.games ? Math.round(s.damage / s.games) : 0,
            kda: s.deaths ? ((s.kills + s.assists) / s.deaths).toFixed(2) : 'Perfect',
        }))
        .sort((a, b) => b.games - a.games);
}

// Calcula agregados do squad inteiro (para Dashboard)
function calcSquadAggregates({ players }) {
    let totalGames = 0, totalWins = 0, totalKills = 0, totalDeaths = 0, totalAssists = 0;
    let totalPentas = 0, totalQuadras = 0, totalTriples = 0;
    const champPickCount = {};
    const hourDist = new Array(24).fill(0);
    const roleDist = {};
    const recentMatches = [];

    players.forEach((pd, idx) => {
        if (!pd?.matches) return;
        const puuid = pd.account?.puuid;
        if (!puuid) return;

        pd.matches.forEach(m => {
            if (!m?.info?.participants) return;
            const p = m.info.participants.find(x => x.puuid === puuid);
            if (!p) return;

            totalGames++;
            if (p.win) totalWins++;
            totalKills += p.kills || 0;
            totalDeaths += p.deaths || 0;
            totalAssists += p.assists || 0;
            totalPentas += p.pentaKills || 0;
            totalQuadras += p.quadraKills || 0;
            totalTriples += p.tripleKills || 0;

            const cid = p.championId;
            champPickCount[cid] = (champPickCount[cid] || 0) + 1;

            // Hour distribution
            const hour = new Date(m.info.gameCreation || 0).getHours();
            hourDist[hour]++;

            // Role
            const role = p.teamPosition || p.individualPosition || 'FILL';
            roleDist[role] = (roleDist[role] || 0) + 1;

            recentMatches.push({
                idx,
                matchId: m.metadata?.matchId,
                win: p.win,
                champion: cid,
                kills: p.kills || 0,
                deaths: p.deaths || 0,
                assists: p.assists || 0,
                time: m.info.gameCreation || 0
            });
        });
    });

    const topChamps = Object.entries(champPickCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id, count]) => ({ id: parseInt(id), count }));

    return {
        totalGames, totalWins, totalKills, totalDeaths, totalAssists,
        totalPentas, totalQuadras, totalTriples,
        wr: totalGames ? ((totalWins / totalGames) * 100).toFixed(0) : 0,
        avgKDA: totalDeaths ? ((totalKills + totalAssists) / totalDeaths).toFixed(2) : '∞',
        topChamps,
        hourDist,
        roleDist,
        recentMatches: recentMatches.sort((a, b) => b.time - a.time).slice(0, 50)
    };
}

// Calcula win streaks para todos os jogadores (para Dynamic Card)
function calcWinStreaks({ players }) {
    const streaks = {};

    players.forEach((pd, idx) => {
        if (!pd?.matches || !pd.account?.puuid) {
            streaks[idx] = { current: 0, type: null };
            return;
        }

        const puuid = pd.account.puuid;
        const sorted = [...pd.matches]
            .filter(m => m?.info?.participants)
            .sort((a, b) => (b.info?.gameCreation || 0) - (a.info?.gameCreation || 0));

        let streak = 0;
        let type = null;

        for (const m of sorted) {
            const p = m.info.participants.find(x => x.puuid === puuid);
            if (!p) break;

            if (type === null) {
                type = p.win ? 'win' : 'loss';
                streak = 1;
            } else if ((type === 'win' && p.win) || (type === 'loss' && !p.win)) {
                streak++;
            } else {
                break;
            }
        }

        streaks[idx] = { current: streak, type };
    });

    return streaks;
}

// Agrega dados de partidas para um jogador (role dist, form, highlights)
function aggregateMatches({ matches, puuid, CMAP }) {
    if (!matches || !puuid) return null;

    const roles = {};
    const form = [];
    let totalKills = 0, totalDeaths = 0, totalAssists = 0, totalCS = 0, totalDamage = 0, totalVision = 0;
    let pentas = 0, quadras = 0, triples = 0, doubles = 0, firstBloods = 0;
    let bestKDA = { val: 0, match: null };
    let longestStreak = 0, currentStreak = 0;

    const sorted = [...matches]
        .filter(m => m?.info?.participants)
        .sort((a, b) => (b.info?.gameCreation || 0) - (a.info?.gameCreation || 0));

    sorted.forEach(m => {
        const p = m.info.participants.find(x => x.puuid === puuid);
        if (!p) return;

        // Form (last 20)
        if (form.length < 20) form.push(p.win ? 'W' : 'L');

        // Streak
        if (p.win) { currentStreak++; longestStreak = Math.max(longestStreak, currentStreak); }
        else currentStreak = 0;

        // Stats
        totalKills += p.kills || 0;
        totalDeaths += p.deaths || 0;
        totalAssists += p.assists || 0;
        totalCS += (p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0);
        totalDamage += p.totalDamageDealtToChampions || 0;
        totalVision += p.visionScore || 0;
        pentas += p.pentaKills || 0;
        quadras += p.quadraKills || 0;
        triples += p.tripleKills || 0;
        doubles += p.doubleKills || 0;
        if (p.firstBloodKill) firstBloods++;

        // Best KDA
        const kda = p.deaths ? (p.kills + p.assists) / p.deaths : (p.kills + p.assists);
        if (kda > bestKDA.val) bestKDA = { val: kda, match: m.metadata?.matchId, champ: p.championId };

        // Role
        const role = p.teamPosition || p.individualPosition || 'FILL';
        roles[role] = (roles[role] || 0) + 1;
    });

    const games = sorted.length;
    return {
        games,
        form,
        roles,
        avgKills: games ? (totalKills / games).toFixed(1) : 0,
        avgDeaths: games ? (totalDeaths / games).toFixed(1) : 0,
        avgAssists: games ? (totalAssists / games).toFixed(1) : 0,
        avgCS: games ? (totalCS / games).toFixed(0) : 0,
        avgDamage: games ? Math.round(totalDamage / games) : 0,
        avgVision: games ? (totalVision / games).toFixed(1) : 0,
        highlights: { pentas, quadras, triples, doubles, firstBloods, bestKDA, longestStreak }
    };
}
