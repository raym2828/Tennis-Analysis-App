
import { Player, PlayerStats, PointLog, MatchRecord, PlayerProfile } from '../types';

export const createEmptyStats = (): PlayerStats => ({
    winners: 0, aces: 0, unforcedErrors: 0, forcedErrors: 0, doubleFaults: 0,
    firstServesIn: 0, firstServesTotal: 0, secondServesWon: 0, secondServesTotal: 0, servesUnreturned: 0,
    returnPointsWon: 0, returnPointsTotal: 0, returnWinners: 0, returnUnforcedErrors: 0,
    netPointsApproached: 0, netPointsWon: 0,
    pointsWon: 0, pointsLost: 0,
});

export const recalculateStatsFromHistory = (pointHistory: PointLog[], allPlayers: Player[]): Record<string, PlayerStats> => {
    const playerStats: Record<string, PlayerStats> = {};
    allPlayers.forEach(p => {
        playerStats[p.profileId] = createEmptyStats();
    });

    if (!pointHistory || pointHistory.length === 0) return playerStats;

    const playerMap = new Map(allPlayers.map(p => [p.id, p]));

    for (const log of pointHistory) {
        const winningTeamId = log.pointWinnerId;
        const serverProfileId = playerMap.get(log.serverStats.playerId)?.profileId;
        if (!serverProfileId) continue;
        
        const serverTeamId = allPlayers.find(p => p.id === log.serverStats.playerId)!.id < 2 ? 1 : 2;
        const receivingTeamId = serverTeamId === 1 ? 2 : 1;
        
        // Update points won/lost
        allPlayers.forEach(p => {
            const playerTeamId = p.id < 2 ? 1 : 2;
            if (playerTeamId === winningTeamId) {
                playerStats[p.profileId].pointsWon++;
            } else {
                playerStats[p.profileId].pointsLost++;
            }
        });

        // Server Stats
        playerStats[serverProfileId].firstServesTotal++;
        if(log.serverStats.isAce) {
            playerStats[serverProfileId].aces++;
            playerStats[serverProfileId].winners++;
            playerStats[serverProfileId].firstServesIn++;
        }
        if(log.serverStats.isDoubleFault) {
            playerStats[serverProfileId].doubleFaults++;
            playerStats[serverProfileId].unforcedErrors++;
            playerStats[serverProfileId].secondServesTotal++;
        }

        // Rally Stats
        if (log.rallyStats) {
            const endingPlayerProfileId = playerMap.get(log.rallyStats.endingPlayerId)?.profileId;
            if (!endingPlayerProfileId) continue;

            const endingPlayerTeamId = log.rallyStats.endingPlayerId < 2 ? 1 : 2;
            
            // Serve In/Out
            if(log.serverStats.isFirstServeIn) {
                playerStats[serverProfileId].firstServesIn++;
            } else {
                playerStats[serverProfileId].secondServesTotal++;
                if (winningTeamId === serverTeamId) {
                    playerStats[serverProfileId].secondServesWon++;
                }
            }

            // Return stats
            const receiverTeamPlayers = allPlayers.filter(p => (p.id < 2 ? 1 : 2) === receivingTeamId);
            receiverTeamPlayers.forEach(p => playerStats[p.profileId].returnPointsTotal++);
            if (winningTeamId === receivingTeamId) {
                 receiverTeamPlayers.forEach(p => playerStats[p.profileId].returnPointsWon++);
            }


            // Outcome Stats
            switch(log.rallyStats.outcome) {
                case 'Winner':
                    playerStats[endingPlayerProfileId].winners++;
                    if(log.rallyStats.isReturnEvent) playerStats[endingPlayerProfileId].returnWinners++;
                    break;
                case 'Forced Error':
                    playerStats[endingPlayerProfileId].forcedErrors++;
                    if(log.rallyStats.isReturnEvent) playerStats[serverProfileId].servesUnreturned++;
                    break;
                case 'Unforced Error':
                    playerStats[endingPlayerProfileId].unforcedErrors++;
                    if(log.rallyStats.isReturnEvent) playerStats[endingPlayerProfileId].returnUnforcedErrors++;
                    break;
            }

            // Net Stats
            if(log.rallyStats.isAtNet) {
                playerStats[endingPlayerProfileId].netPointsApproached++;
                if (winningTeamId === endingPlayerTeamId) {
                    playerStats[endingPlayerProfileId].netPointsWon++;
                }
            }
        }
    }

    return playerStats;
};

// --- CSV Parsing Utilities ---

const parseCSVLine = (line: string): string[] => {
    const result = [];
    let start = 0;
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
            inQuotes = !inQuotes;
        } else if (line[i] === ',' && !inQuotes) {
            let field = line.substring(start, i);
            if (field.startsWith('"') && field.endsWith('"')) {
                field = field.slice(1, -1).replace(/""/g, '"');
            }
            result.push(field);
            start = i + 1;
        }
    }
    let field = line.substring(start);
    if (field.startsWith('"') && field.endsWith('"')) {
        field = field.slice(1, -1).replace(/""/g, '"');
    }
    result.push(field);
    return result;
};

export const parseMatchCSV = async (text: string, existingProfiles: PlayerProfile[], createProfile: (name: string) => PlayerProfile): Promise<MatchRecord> => {
    const lines = text.split('\n').filter(l => l.trim() !== '');
    const headers = parseCSVLine(lines[0]);
    const rows = lines.slice(1).map(parseCSVLine);

    // 1. Identify Players and Assign Teams
    const team1PlayersSet = new Set<string>();
    const team2PlayersSet = new Set<string>();
    
    // We need to scan rows to deduce team membership based on outcomes
    rows.forEach(row => {
        const pointWinner = row[3]; // "Team 1" or "Team 2"
        const server = row[4];
        const serveOutcome = row[5];
        const pointOutcome = row[6];
        const playerResponsible = row[7];

        if (pointWinner === 'Team 1') {
            if (serveOutcome === 'Ace') team1PlayersSet.add(server);
            if (pointOutcome === 'Winner') team1PlayersSet.add(playerResponsible);
            if (pointOutcome === 'Unforced Error' || pointOutcome === 'Forced Error') team2PlayersSet.add(playerResponsible);
        } else if (pointWinner === 'Team 2') {
            if (serveOutcome === 'Ace') team2PlayersSet.add(server);
            if (pointOutcome === 'Winner') team2PlayersSet.add(playerResponsible);
            if (pointOutcome === 'Unforced Error' || pointOutcome === 'Forced Error') team1PlayersSet.add(playerResponsible);
        }
    });

    // Fallback: if we missed someone (e.g. they never hit a winner/error), try to infer from Double Faults
    rows.forEach(row => {
         const pointWinner = row[3];
         const server = row[4];
         const serveOutcome = row[5];
         if (serveOutcome === 'Double Fault') {
             // If Team 1 won the point on a DF, Team 2 served.
             if (pointWinner === 'Team 1') team2PlayersSet.add(server);
             else team1PlayersSet.add(server);
         }
    });
    
    // Resolve Names to Profiles
    const resolvePlayer = (name: string): PlayerProfile => {
        const existing = existingProfiles.find(p => p.name.toLowerCase() === name.toLowerCase());
        if (existing) return existing;
        return createProfile(name);
    };

    const t1Names = Array.from(team1PlayersSet);
    const t2Names = Array.from(team2PlayersSet);

    // Ensure we have at least placeholders if parsing failed to find 2 players
    while(t1Names.length < 2) t1Names.push(`Unknown T1-${t1Names.length+1}`);
    while(t2Names.length < 2) t2Names.push(`Unknown T2-${t2Names.length+1}`);

    const t1Profiles = t1Names.slice(0, 2).map(resolvePlayer);
    const t2Profiles = t2Names.slice(0, 2).map(resolvePlayer);

    const team1Players: [Player, Player] = [
        { id: 0, name: t1Profiles[0].name, profileId: t1Profiles[0].id },
        { id: 1, name: t1Profiles[1].name, profileId: t1Profiles[1].id }
    ];
    const team2Players: [Player, Player] = [
        { id: 2, name: t2Profiles[0].name, profileId: t2Profiles[0].id },
        { id: 3, name: t2Profiles[1].name, profileId: t2Profiles[1].id }
    ];

    const allPlayers = [...team1Players, ...team2Players];
    const nameToIdMap = new Map<string, number>();
    allPlayers.forEach(p => nameToIdMap.set(p.name, p.id));

    // 2. Reconstruct Point History
    const pointHistory: PointLog[] = rows.map((row, index) => {
        const serverName = row[4];
        const playerRespName = row[7];
        const timestamp = row[10] ? parseFloat(row[10]) : undefined;
        const score = row[2];
        const set = parseInt(row[1]) - 1;
        
        // Reconstruct Stats Objects
        const serverId = nameToIdMap.get(serverName) ?? 0;
        const serveOutcome = row[5];
        const pointOutcome = row[6];

        const serverStats = {
            playerId: serverId,
            isAce: serveOutcome === 'Ace',
            isDoubleFault: serveOutcome === 'Double Fault',
            isFirstServeIn: serveOutcome === 'Ace' || serveOutcome === '1st Serve In',
        };

        let rallyStats = null;
        if (serveOutcome !== 'Ace' && serveOutcome !== 'Double Fault') {
            rallyStats = {
                endingPlayerId: nameToIdMap.get(playerRespName) ?? 0,
                outcome: pointOutcome as 'Winner' | 'Forced Error' | 'Unforced Error',
                isAtNet: row[8] === 'Yes',
                isReturnEvent: row[9] === 'Yes',
            };
        }
        
        const pointWinnerId = row[3] === 'Team 1' ? 1 : 2;
        let description = '';
        if (serverStats.isAce) description = `Ace by ${serverName}`;
        else if (serverStats.isDoubleFault) description = `Double Fault by ${serverName}`;
        else if (rallyStats) {
             if (rallyStats.outcome === 'Winner') description = `${rallyStats.isReturnEvent ? 'Return ' : ''}Winner by ${playerRespName}`;
             else description = `${rallyStats.isReturnEvent && rallyStats.outcome === 'Unforced Error' ? 'Return ' : ''}${rallyStats.outcome} by ${playerRespName}`;
        }

        return {
            id: index,
            score,
            set,
            description,
            timestamp,
            pointWinnerId,
            serverStats,
            rallyStats
        };
    });

    // 3. Reconstruct Game Score (Inference)
    const team1Games = [0];
    const team2Games = [0];
    let currentSet = 0;

    const rowsWithWinner = rows.map((r, i) => ({
        set: parseInt(r[1]) - 1,
        score: r[2],
        winner: r[3] === 'Team 1' ? 1 : 2
    }));

    for (let i = 0; i < rowsWithWinner.length; i++) {
        const current = rowsWithWinner[i];
        const prev = i > 0 ? rowsWithWinner[i-1] : null;
        
        // Check for set change
        if (prev && current.set > prev.set) {
            // The winner of the last point of the previous set won that game/set
            if (prev.winner === 1) team1Games[prev.set]++;
            else team2Games[prev.set]++;
            
            // Initialize new set
            team1Games.push(0);
            team2Games.push(0);
            currentSet++;
        } 
        // Check for game change within the same set
        else if (prev && current.set === prev.set && current.score === '0-0') {
            // A game finished on the previous point
            if (prev.winner === 1) team1Games[currentSet]++;
            else team2Games[currentSet]++;
        }
    }

    // Handle the very last point
    if (rowsWithWinner.length > 0) {
        const last = rowsWithWinner[rowsWithWinner.length - 1];
        // If the match is imported, it's likely finished, so the last point probably won a game.
        // However, without an explicit 'Game Over' marker, we assume the last action concluded a game 
        // IF the user exported a finished match. If it was mid-game, this might be off by 1.
        // Heuristic: If the last score isn't 'Game Point' logic, we can't be sure, but let's assume 
        // for a "Match Record" it is complete.
        
        // To be safe, we only increment if the logic dictates (e.g. was Game Point).
        // Since we lack that detailed state, we will optimistically increment if it looks like a win.
        // But for safety in this "Viewer" mode, let's just rely on the accumulation above + 1 potential pending.
        
        // Actually, the loop above only adds a game when it sees the *next* point start at 0-0.
        // So we must account for the final game completion.
        if (last.winner === 1) team1Games[currentSet]++;
        else team2Games[currentSet]++;
    }
    
    const stats = recalculateStatsFromHistory(pointHistory, allPlayers);
    const playerStats: Record<string, PlayerStats> = stats;

    // Determine overall winner based on sets
    let t1Sets = 0;
    let t2Sets = 0;
    team1Games.forEach((g1, i) => {
        const g2 = team2Games[i];
        if (g1 > g2 && g1 >= 6) t1Sets++;
        if (g2 > g1 && g2 >= 6) t2Sets++;
    });
    
    const winner = t1Sets > t2Sets ? 1 : (t2Sets > t1Sets ? 2 : undefined);

    return {
        id: `imported-${Date.now()}`,
        date: new Date().toLocaleDateString(),
        team1: { players: team1Players, score: team1Games },
        team2: { players: team2Players, score: team2Games },
        winner: winner, 
        playerStats,
        pointHistory,
        videoFileName: undefined,
        lastGameState: undefined // Cannot resume imported match
    };
};
