---
name: LoL Profile Data via Riot API
description: Marcus wants LoL profile data on PROFA GAMES site using Riot API
type: project
---

Marcus provided his Riot Games API key and detailed API specs for building a LoL profile page.

**API Key:** RGAPI-ac93dba2-2144-4534-a0e6-c1b8d864d0ec (dev key, expires regularly)

**Player:** PROFANON#br1 → BR1 region

**Available endpoints documented:**
- Account API: `/riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}` → gets PUUID
- Summoner API: `/lol/summoner/v4/summoners/by-puuid/{puuid}` or `/by-id/{encryptedSummonerId}` or `/by-name/{summonerName}`
- Champion Mastery: `/lol/champion-mastery/v4/champion-masteries/by-puuid/{puuid}/top`
- League: `/lol/league/v4/entries/by-puuid/{encryptedSummonerId}`
- Match API: `/lol/match/v5/matches/by-puuid/{puuid}/ids` → then `/lol/match/v5/matches/{matchId}` for details
- Current Game: `/lol/spectator/v5/active-games/by-summoner/{summonerId}`
- Champions: `/lol/platform/v4/champion-rotations`
- Clash: `/lol/clash/v1/players/by-puuid/{puuid}`

**Why:** Marcus wants his LoL rank, stats, champion mastery, and match history displayed on his gaming site.
**How to apply:** Use these endpoints to build rich profile cards. Account → PUUID is always the first step. Use americas cluster for account, BR1 for game data.
