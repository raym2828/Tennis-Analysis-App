
import React, { useState, useCallback, useEffect } from 'react';
import { useGameLogic } from './hooks/useGameLogic';
import { usePersistence } from './hooks/usePersistence';
import SetupScreen from './components/SetupScreen';
import MatchScreen from './components/MatchScreen';
import HomeScreen from './components/HomeScreen';
import HistoricalStatsScreen from './components/HistoricalStatsScreen';
import { GameState, MatchRecord, PlayerStats } from './types';

const App: React.FC = () => {
  const [view, setView] = useState<'home' | 'setup' | 'match' | 'history'>('home');
  const [selectedMatch, setSelectedMatch] = useState<MatchRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const { state, dispatch } = useGameLogic();
  const persistence = usePersistence();

  const logDebug = (message: string) => {
    setDebugLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  useEffect(() => {
    if (state.isMatchStarted && view !== 'match') {
      logDebug('Match started, switching to match view.');
      setView('match');
    }
  }, [state.isMatchStarted, view]);

  const createMatchRecord = (currentState: GameState, videoFileName?: string | null): MatchRecord => {
    const playerStats: Record<string, PlayerStats> = {};
    [...currentState.team1.players, ...currentState.team2.players].forEach(p => {
        playerStats[p.profileId] = currentState.stats[p.id];
    });

    return {
        id: new Date().toISOString() + Math.random(),
        date: new Date().toLocaleDateString(),
        team1: { players: currentState.team1.players, score: currentState.team1.games },
        team2: { players: currentState.team2.players, score: currentState.team2.games },
        winner: currentState.winner,
        playerStats: playerStats,
        pointHistory: currentState.pointHistory,
        videoFileName: videoFileName || undefined,
        lastGameState: currentState // Save state for resuming
    };
  };

  const handleMatchEnd = (finalState: GameState, videoFileName?: string | null) => {
    logDebug('Match ended. Attempting to save final record.');
    setError(null);
    try {
      const matchRecord = createMatchRecord(finalState, videoFileName);
      persistence.addMatch(matchRecord);
      persistence.updateProfilesOnMatchEnd(matchRecord);
      dispatch({ type: 'RESET_STATE' });
      setView('home');
      setDebugLog([]);
      logDebug('Match record saved successfully.');
    } catch (e) {
      const errorMessage = 'Failed to save completed match.';
      console.error(errorMessage, e);
      setError(errorMessage);
      logDebug(`ERROR: ${errorMessage}`);
    }
  };
  
  const handleSaveInProgress = (videoFileName?: string | null) => {
    logDebug('Save & Exit clicked. Saving in-progress match...');
    setError(null);
    try {
      const matchRecord = createMatchRecord(state, videoFileName);
      persistence.addMatch(matchRecord);
      dispatch({ type: 'RESET_STATE' });
      setView('home');
      setDebugLog([]);
      logDebug('In-progress match saved successfully.');
    } catch (e) {
      const errorMessage = 'Failed to save match.';
      console.error(errorMessage, e);
      setError(errorMessage);
      logDebug(`ERROR: ${errorMessage}`);
    }
  };
  
  const handleAbandon = () => {
    logDebug('Abandon Match clicked. Resetting state...');
    setError(null);
    try {
      dispatch({ type: 'RESET_STATE' });
      setView('home');
      setDebugLog([]);
      logDebug('Match abandoned and state reset.');
    } catch (e) {
      const errorMessage = 'Failed to abandon match.';
      console.error(errorMessage, e);
      setError(errorMessage);
      logDebug(`ERROR: ${errorMessage}`);
    }
  };

  const handleViewMatchHistory = useCallback((match: MatchRecord) => {
      setSelectedMatch(match);
      setView('history');
  }, []);

  const handleResumeMatch = useCallback((match: MatchRecord) => {
      if (match.lastGameState) {
          dispatch({ type: 'RESUME_MATCH', payload: { state: match.lastGameState } });
          setView('match');
      }
  }, [dispatch]);

  const renderContent = () => {
    switch(view) {
      case 'setup':
        return <SetupScreen dispatch={dispatch} profiles={persistence.profiles} addProfile={persistence.addProfile} />;
      case 'match':
        if (!state.isMatchStarted || !state.team1.players[0].name) {
          setView('setup');
          return null;
        }
        return <MatchScreen 
            state={state as GameState & {isMatchStarted: true}} 
            dispatch={dispatch} 
            onMatchEnd={handleMatchEnd}
            onSaveAndExit={handleSaveInProgress}
            onAbandon={handleAbandon}
            error={error}
            debugLog={debugLog}
        />;
      case 'history':
        if (!selectedMatch) {
            setView('home');
            return null;
        }
        return <HistoricalStatsScreen match={selectedMatch} onBack={() => setView('home')} />;
      case 'home':
      default:
        return <HomeScreen 
          setView={setView} 
          profiles={persistence.profiles} 
          matchHistory={persistence.matchHistory}
          onViewMatch={handleViewMatchHistory}
          onResumeMatch={handleResumeMatch}
          addMatch={persistence.addMatch}
          addProfile={persistence.addProfile}
        />;
    }
  }

  return (
    <div className="min-h-screen bg-court-bg font-sans p-4 flex flex-col">
      <header className="w-full text-center mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-tennis-ball cursor-pointer" onClick={() => {
          if (view !== 'match') setView('home')
        }}>
          Doubles Score & Stat Tracker
        </h1>
        <p className="text-secondary-text mt-1">Advanced stats, player profiles, and match history.</p>
      </header>
      
      <main className="w-full flex-grow px-2 lg:px-6">
        {error && (
            <div className="bg-red-500 text-white p-3 rounded-md mb-4 text-center font-semibold">
                Error: {error}
            </div>
        )}
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
