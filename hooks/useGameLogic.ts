
import { useReducer } from 'react';
import { GameState, Action, PlayerStats, RallyAttributionPayload, Player, PointLog } from '../types';

const initialPlayerStats: PlayerStats = {
  winners: 0, aces: 0, unforcedErrors: 0, forcedErrors: 0, doubleFaults: 0,
  firstServesIn: 0, firstServesTotal: 0, secondServesWon: 0, secondServesTotal: 0, servesUnreturned: 0,
  returnPointsWon: 0, returnPointsTotal: 0, returnWinners: 0, returnUnforcedErrors: 0,
  netPointsApproached: 0, netPointsWon: 0,
  pointsWon: 0, pointsLost: 0,
};

const getInitialState = (): GameState => ({
  team1: { players: [{id: 0, name: '', profileId: ''}, {id: 1, name: '', profileId: ''}], games: [0], points: 0, isServing: true },
  team2: { players: [{id: 2, name: '', profileId: ''}, {id: 3, name: '', profileId: ''}], games: [0], points: 0, isServing: false },
  currentSet: 0,
  serverIndex: 0,
  serveOrder: [],
  serveOrderIndex: 0,
  receiverIndex: 2,
  isTieBreak: false,
  matchOver: false,
  stats: {
    0: { ...initialPlayerStats },
    1: { ...initialPlayerStats },
    2: { ...initialPlayerStats },
    3: { ...initialPlayerStats },
  },
  history: [],
  pointHistory: [],
  isMatchStarted: false,
  pointState: 'scoring',
  isFirstServeFaulted: false,
  currentPointTimestamp: undefined,
});

const getPointScoreString = (state: GameState) => {
    const team1Points = state.team1.points;
    const team2Points = state.team2.points;
    
    if (state.isTieBreak) {
        return `${team1Points}-${team2Points}`;
    }
    if (team1Points >= 3 && team1Points === team2Points) {
        return 'Deuce';
    } 
    if (team1Points > 3 || team2Points > 3) {
        const winningTeamIs1 = team1Points > team2Points;
        const servingTeamIs1 = state.team1.isServing;
        if (winningTeamIs1 === servingTeamIs1) return 'Ad-In';
        else return 'Ad-Out';
    }
    const map = ['0', '15', '30', '40'];
    return `${map[team1Points] || 'Ad'}-${map[team2Points] || 'Ad'}`;
};


// Helper function to apply the point outcome to the score
const applyPoint = (state: GameState, winningTeamId: number, pointLogTemplate: PointLog): GameState => {
    const newState = { ...state };
    
    const winningTeam = winningTeamId === 1 ? newState.team1 : newState.team2;
    const losingTeam = winningTeamId === 1 ? newState.team2 : newState.team1;

    winningTeam.points += 1;
    
    // --- DETERMINE SCORE STRING FOR LOG ---
    // We calculate the score string based on the incremented points BEFORE game reset logic.
    let logScore = '';
    
    // Check for game/tiebreak win just for string generation purposes first
    let isGameWinningPoint = false;
    
    if (newState.isTieBreak) {
        const targetPoints = newState.currentSet === 2 ? 10 : 7;
        isGameWinningPoint = winningTeam.points >= targetPoints && winningTeam.points - losingTeam.points >= 2;
        // For tiebreaks, usually we show the points even on the winning point (e.g. 7-5)
        logScore = `${newState.team1.points}-${newState.team2.points}`;
        if (isGameWinningPoint) logScore += " (Set)";
    } else {
        const pointsToWin = 4;
        isGameWinningPoint = winningTeam.points >= pointsToWin && winningTeam.points - losingTeam.points >= 2;
        
        if (isGameWinningPoint) {
            logScore = "Game";
        } else {
            logScore = getPointScoreString(newState);
        }
    }

    pointLogTemplate.score = logScore;
    pointLogTemplate.id = newState.pointHistory.length;
    newState.pointHistory.push(pointLogTemplate);


    // --- GAME/SET LOGIC ---

    if (newState.isTieBreak) {
        // --- TIEBREAK LOGIC ---
        const targetPoints = newState.currentSet === 2 ? 10 : 7;
        const tiebreakWon = winningTeam.points >= targetPoints && winningTeam.points - losingTeam.points >= 2;
        
        if (tiebreakWon) {
            winningTeam.games[newState.currentSet]++;
            newState.matchOver = true;
            newState.winner = winningTeamId;
        } else {
            // Tiebreak server rotation: 1st point, then every 2 points
            const totalPointsPlayed = winningTeam.points + losingTeam.points;
            if (totalPointsPlayed === 1 || (totalPointsPlayed > 1 && (totalPointsPlayed - 1) % 2 === 0)) {
                newState.serveOrderIndex = (newState.serveOrderIndex + 1) % 4;
                newState.serverIndex = newState.serveOrder[newState.serveOrderIndex];
                newState.team1.isServing = newState.serverIndex < 2;
                newState.team2.isServing = newState.serverIndex >= 2;
            }
        }
    } else {
        // --- REGULAR GAME LOGIC ---
        const pointsToWin = 4;
        const gameWon = winningTeam.points >= pointsToWin && winningTeam.points - losingTeam.points >= 2;

        if (gameWon) {
            winningTeam.games[newState.currentSet]++;
            winningTeam.points = 0;
            losingTeam.points = 0;
            
            const gamesInSet = winningTeam.games[newState.currentSet];
            const setWon = gamesInSet >= 6 && gamesInSet - losingTeam.games[newState.currentSet] >= 2;

            if (setWon) {
                const team1SetsWon = newState.team1.games.filter((g, i) => g > newState.team2.games[i]).length;
                const team2SetsWon = newState.team2.games.filter((g, i) => g > newState.team1.games[i]).length;
                
                if ((winningTeamId === 1 && team1SetsWon === 2) || (winningTeamId === 2 && team2SetsWon === 2)) {
                    newState.matchOver = true;
                    newState.winner = winningTeamId;
                } else if (team1SetsWon === 1 && team2SetsWon === 1) {
                    // Final set super tiebreaker
                    newState.currentSet++;
                    newState.team1.games.push(0);
                    newState.team2.games.push(0);
                    newState.isTieBreak = true;
                    newState.pointState = 'selectingServer'; // Must select server for tiebreak
                } else {
                    // Start next set
                     newState.currentSet++;
                     newState.team1.games.push(0);
                     newState.team2.games.push(0);
                     newState.pointState = 'selectingServer'; // New set, select server
                }
            } else {
                 const totalGamesInSet = gamesInSet + losingTeam.games[newState.currentSet];
                 // After game 1 of any set, prompt for the second server.
                if (totalGamesInSet === 1) {
                    newState.pointState = 'selectingSecondServer';
                } else {
                    // Otherwise, rotate server normally based on the pre-defined serve order
                    newState.serveOrderIndex = (newState.serveOrderIndex + 1) % 4;
                    newState.serverIndex = newState.serveOrder[newState.serveOrderIndex];
                }
                
                newState.team1.isServing = newState.serverIndex < 2;
                newState.team2.isServing = newState.serverIndex >= 2;
            }
        }
    }

    winningTeam.players.forEach(p => newState.stats[p.id].pointsWon++);
    losingTeam.players.forEach(p => newState.stats[p.id].pointsLost++);
    
    // Only reset point state if we are not moving to a selection state
    if (newState.pointState !== 'selectingServer' && newState.pointState !== 'selectingSecondServer') {
        newState.pointState = 'scoring';
    }
    newState.isFirstServeFaulted = false;
    newState.pointEndReason = undefined;
    newState.currentPointTimestamp = undefined; // Reset timestamp

    return newState;
}

const gameReducer = (state: GameState, action: Action): GameState => {
  const deepCloneState = (): GameState => JSON.parse(JSON.stringify(state));

  const saveToHistory = (currentState: GameState): GameState[] => {
      // FIX: To prevent RangeError, only store the state without its own history.
      const stateToSave = { ...currentState, history: [] };
      return [...currentState.history, JSON.parse(JSON.stringify(stateToSave))];
  }


  switch (action.type) {
    case 'START_MATCH': {
      const { team1, team2 } = action.payload;
      return {
        ...getInitialState(),
        isMatchStarted: true,
        pointState: 'selectingServer',
        team1: { ...getInitialState().team1, players: team1 },
        team2: { ...getInitialState().team2, players: team2 },
      };
    }
    
    case 'SET_FIRST_SERVER': {
        const { serverId } = action.payload;
        
        // If it's a tiebreak set (e.g. Super Tiebreak), we need to select the full order immediately
        // because we don't have a "Change ends/server after Game 1" pause.
        const isTieBreakStart = state.isTieBreak;

        return {
            ...state,
            serveOrder: [serverId], // Temporarily store just the first server
            serverIndex: serverId,
            serveOrderIndex: 0,
            team1: { ...state.team1, isServing: serverId < 2 },
            team2: { ...state.team2, isServing: serverId >= 2 },
            // If tiebreak, go to selecting second server immediately. Else score normally (Game 1).
            pointState: isTieBreakStart ? 'selectingSecondServer' : 'scoring'
        }
    }

    case 'CONFIRM_SECOND_SERVER': {
        const secondServerId = action.payload.serverId;
        const firstServerId = state.serveOrder[0];

        const firstServerIsTeam1 = firstServerId < 2;
        const firstServerPartnerId = firstServerIsTeam1 ? (firstServerId === 0 ? 1 : 0) : (firstServerId === 2 ? 3 : 2);
        
        const secondServerIsTeam1 = secondServerId < 2;
        const secondServerPartnerId = secondServerIsTeam1 ? (secondServerId === 0 ? 1 : 0) : (secondServerId === 2 ? 3 : 2);

        const serveOrder = [
            firstServerId,
            secondServerId,
            firstServerPartnerId,
            secondServerPartnerId,
        ];
        
        // If Tiebreak, we start at index 0 (First Server starts the tiebreak).
        // If Regular Set, we are confirming for Game 2, so we start at index 1 (Second Server starts Game 2).
        const nextIndex = state.isTieBreak ? 0 : 1; 
        const nextServerId = serveOrder[nextIndex];
        
        return {
            ...state,
            serveOrder,
            serveOrderIndex: nextIndex, 
            serverIndex: nextServerId, 
            team1: { ...state.team1, isServing: nextServerId < 2 },
            team2: { ...state.team2, isServing: nextServerId >= 2 },
            pointState: 'scoring'
        }
    }

    case 'FIRST_SERVE_FAULT': {
        return { ...state, isFirstServeFaulted: true };
    }

    case 'QUICK_ATTRIBUTE_POINT': {
        const newState = deepCloneState();
        newState.history = saveToHistory(state);
        const { reason, timestamp } = action.payload;
        const server = [...newState.team1.players, ...newState.team2.players].find(p => p.id === newState.serverIndex)!;
        const serverTeamId = server.id < 2 ? 1 : 2;

        newState.stats[server.id].firstServesTotal++;

        const pointLog: PointLog = {
            id: 0, // Set in applyPoint
            score: '', // Set in applyPoint
            description: '',
            set: newState.currentSet,
            pointWinnerId: 1, // Placeholder
            timestamp: timestamp,
            serverStats: {
                playerId: server.id,
                isFirstServeIn: reason === 'Ace',
                isAce: reason === 'Ace',
                isDoubleFault: reason === 'Double Fault',
            },
            rallyStats: null,
        }

        if (reason === 'Ace') {
            newState.stats[server.id].firstServesIn++;
            newState.stats[server.id].aces++;
            newState.stats[server.id].winners++;
            pointLog.pointWinnerId = serverTeamId;
            pointLog.description = `Ace by ${server.name}`;
            return applyPoint(newState, serverTeamId, pointLog);
        } else { // Double Fault
            newState.stats[server.id].secondServesTotal++;
            newState.stats[server.id].doubleFaults++;
            newState.stats[server.id].unforcedErrors++;
            const receiverTeamId = server.id < 2 ? 2 : 1;
            pointLog.pointWinnerId = receiverTeamId;
            pointLog.description = `Double Fault by ${server.name}`;
            return applyPoint(newState, receiverTeamId, pointLog);
        }
    }
    
    case 'AWARD_RALLY_START': {
        return {
            ...state,
            pointState: 'attributingRally',
            pointEndReason: action.payload.reason,
            currentPointTimestamp: action.payload.timestamp
        }
    }

    case 'ATTRIBUTE_RALLY': {
        const newState = deepCloneState();
        newState.history = saveToHistory(state);
        
        const { pointEndingPlayer, wasAtNet, isReturnEvent } = action.payload;
        const { pointEndReason, currentPointTimestamp } = newState;
        
        const server = [...newState.team1.players, ...newState.team2.players].find(p => p.id === newState.serverIndex)!;
        const receiver = [...newState.team1.players, ...newState.team2.players].find(p => p.id === newState.receiverIndex)!;
        
        // --- Update Stats ---
        // 1. Serve Stats
        newState.stats[server.id].firstServesTotal++;
        if (newState.isFirstServeFaulted) {
            newState.stats[server.id].secondServesTotal++;
        } else {
            newState.stats[server.id].firstServesIn++;
        }

        // 2. Returner Stats
        newState.stats[receiver.id].returnPointsTotal++;

        // 3. Point Ending Player Stats
        let pointDescription = '';
        if (pointEndReason === 'Winner') {
            newState.stats[pointEndingPlayer.id].winners++;
            if (isReturnEvent) newState.stats[pointEndingPlayer.id].returnWinners++;
            pointDescription = isReturnEvent ? `Return Winner by ${pointEndingPlayer.name}` : `Winner by ${pointEndingPlayer.name}`;
        } else if (pointEndReason === 'Unforced Error') {
            newState.stats[pointEndingPlayer.id].unforcedErrors++;
            if (isReturnEvent) newState.stats[pointEndingPlayer.id].returnUnforcedErrors++;
            pointDescription = isReturnEvent ? `Return Unforced Error by ${pointEndingPlayer.name}` : `Unforced Error by ${pointEndingPlayer.name}`;
        } else { // Forced Error
            newState.stats[pointEndingPlayer.id].forcedErrors++;
            if (isReturnEvent) newState.stats[server.id].servesUnreturned++;
            pointDescription = isReturnEvent ? `Unreturned Serve (forced by ${server.name})` : `Forced Error by ${pointEndingPlayer.name}`;
        }

        if (wasAtNet) {
            newState.stats[pointEndingPlayer.id].netPointsApproached++;
            pointDescription += ' (at net)';
        }

        // 4. Determine winner and update conditional stats
        const endingPlayerTeamId = pointEndingPlayer.id < 2 ? 1 : 2;
        const winningTeamId = pointEndReason === 'Winner' ? endingPlayerTeamId : (endingPlayerTeamId === 1 ? 2 : 1);

        if (winningTeamId === (receiver.id < 2 ? 1 : 2)) {
            newState.stats[receiver.id].returnPointsWon++;
        }
        if (winningTeamId === (server.id < 2 ? 1 : 2) && newState.isFirstServeFaulted) {
            newState.stats[server.id].secondServesWon++;
        }
        if (wasAtNet && winningTeamId === endingPlayerTeamId) {
            newState.stats[pointEndingPlayer.id].netPointsWon++;
        }

        const pointLog: PointLog = {
            id: 0, // Set in applyPoint
            score: '', // Set in applyPoint
            description: pointDescription,
            set: newState.currentSet,
            pointWinnerId: winningTeamId,
            timestamp: currentPointTimestamp,
            serverStats: {
                playerId: server.id,
                isFirstServeIn: !newState.isFirstServeFaulted,
                isAce: false,
                isDoubleFault: false,
            },
            rallyStats: {
                endingPlayerId: pointEndingPlayer.id,
                outcome: pointEndReason!,
                isAtNet: wasAtNet,
                isReturnEvent: isReturnEvent,
            },
        };

        return applyPoint(newState, winningTeamId, pointLog);
    }

    case 'CANCEL_POINT': {
        return { 
            ...state, 
            pointState: 'scoring', 
            pointEndReason: undefined,
            currentPointTimestamp: undefined
        }
    }
    
    case 'UNDO_LAST_POINT': {
      if (state.history.length === 0) return state;
      // Reconstruct the previous state with its history intact
      const previousState = state.history[state.history.length - 1];
      const previousHistory = state.history.slice(0, -1);
      return { ...previousState, history: previousHistory };
    }
    
    case 'RESET_STATE': {
      return getInitialState();
    }

    case 'RESUME_MATCH': {
        return action.payload.state;
    }
    
    default:
      return state;
  }
};


export const useGameLogic = () => {
  const [state, dispatch] = useReducer(gameReducer, getInitialState());
  return { state, dispatch };
};
