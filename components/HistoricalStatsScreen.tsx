
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { MatchRecord, PlayerStats, PointLog } from '../types';
import Card from './common/Card';
import MomentumChart from './MomentumChart';
import PointBreakdownChart from './PointBreakdownChart';
import IndividualStatChart from './IndividualStatChart';
import PerformanceDonutChart, { PerformanceData } from './PerformanceDonutChart';
import { recalculateStatsFromHistory, createEmptyStats } from '../utils/analytics';

interface HistoricalStatsScreenProps {
  match: MatchRecord;
  onBack: () => void;
}

type FilterMode = 'player' | 'context';
type ActionFilterType = 'all' | 'serve_deuce' | 'serve_ad' | 'return' | 'winner' | 'error' | 'net';
type ContextFilterType = 'all' | 'break_point' | 'game_point' | 'deuce' | 'tiebreak';

const HistoricalStatsScreen: React.FC<HistoricalStatsScreenProps> = ({ match, onBack }) => {
  const [setFilter, setSetFilter] = useState<'all' | number>('all');
  const [performanceFilter, setPerformanceFilter] = useState<'all' | 'serves' | 'returns'>('all');
  const [performancePlayerFilter, setPerformancePlayerFilter] = useState<string>('all');
  
  // Video State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  
  // New Smart Playlist Filters
  const [filterMode, setFilterMode] = useState<FilterMode>('player');
  
  // Player Mode State
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('all');
  const [selectedAction, setSelectedAction] = useState<ActionFilterType>('all');

  // Context Mode State
  const [selectedContext, setSelectedContext] = useState<ContextFilterType>('all');

  // Cleanup video url
  useEffect(() => {
      return () => {
          if (videoUrl) URL.revokeObjectURL(videoUrl);
      }
  }, [videoUrl]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
          setVideoUrl(URL.createObjectURL(file));
      }
  };

  const jumpToTime = (time: number) => {
      if (videoRef.current) {
          // Jump 5 seconds before the recorded time to show context
          videoRef.current.currentTime = Math.max(0, time - 5);
          videoRef.current.play();
      }
  };
  
  const skip = (seconds: number) => {
      if (videoRef.current) {
          videoRef.current.currentTime += seconds;
      }
  };
  
  const { filteredHistory, filteredStats } = useMemo(() => {
    const filteredHistory = setFilter === 'all' 
      ? match.pointHistory 
      : match.pointHistory.filter(p => p.set === setFilter);
    
    const allPlayers = [...match.team1.players, ...match.team2.players];
    const filteredStats = recalculateStatsFromHistory(filteredHistory, allPlayers);
    
    return { filteredHistory, filteredStats };
  }, [match, setFilter]);

  // --- Logic Helpers for Filters ---

  const getServeSide = (score: string, isTieBreak: boolean): 'Deuce' | 'Ad' => {
      if (score === 'Deuce') return 'Deuce';
      if (score === 'Ad-In' || score === 'Ad-Out') return 'Ad';
      
      // Parse score string "15-30" or "6-5"
      const parts = score.split('-');
      if (parts.length !== 2) return 'Deuce'; // Fallback

      // Standard Point Map
      const pointMap: Record<string, number> = { '0': 0, '15': 1, '30': 2, '40': 3 };
      
      let p1 = 0, p2 = 0;

      if (isTieBreak) {
          p1 = parseInt(parts[0]);
          p2 = parseInt(parts[1]);
      } else {
          p1 = pointMap[parts[0]] ?? 0;
          p2 = pointMap[parts[1]] ?? 0;
      }
      
      return (p1 + p2) % 2 === 0 ? 'Deuce' : 'Ad';
  };

  const getPointContext = (score: string, isServerTeam1: boolean): ContextFilterType | null => {
      // Tiebreaks are handled by checking the score format usually, but here we rely on score string content
      // Note: This is a heuristic. Ideally GameState would be saved per point.
      
      if (score.includes('Ad')) {
           if (score === 'Ad-In') return 'game_point';
           if (score === 'Ad-Out') return 'break_point';
      }

      if (score === 'Deuce') return 'deuce';

      const parts = score.split('-');
      if (parts.length !== 2) return null;
      
      // Check for tiebreak integers (usually > 4 or not standard tennis scores)
      const isStandard = ['0','15','30','40'].includes(parts[0]) && ['0','15','30','40'].includes(parts[1]);
      if (!isStandard) return 'tiebreak';

      const serverScore = isServerTeam1 ? parts[0] : parts[1];
      const receiverScore = isServerTeam1 ? parts[1] : parts[0];

      // Game Point: Server has 40, receiver < 40
      if (serverScore === '40' && receiverScore !== '40') return 'game_point';
      
      // Break Point: Receiver has 40, server < 40
      if (receiverScore === '40' && serverScore !== '40') return 'break_point';

      return null;
  };

  const playlistPoints = useMemo(() => {
      const allPlayers = [...match.team1.players, ...match.team2.players];
      const playerMap = new Map(allPlayers.map(p => [p.id, p]));

      return match.pointHistory.filter(log => {
          // 1. Global Set Filter
          if (setFilter !== 'all' && log.set !== setFilter) return false;

          const server = playerMap.get(log.serverStats.playerId);
          const serverTeam1 = server ? server.id < 2 : true;
          
          // --- MODE 1: PLAYER FOCUS ---
          if (filterMode === 'player') {
              // A. Player Filter
              if (selectedPlayerId !== 'all') {
                  const targetProfileId = selectedPlayerId;
                  
                  // Who is "involved"?
                  // 1. Server
                  const isServer = server?.profileId === targetProfileId;
                  // 2. Rally Ender
                  const isRallyEnder = log.rallyStats && playerMap.get(log.rallyStats.endingPlayerId)?.profileId === targetProfileId;
                  
                  if (!isServer && !isRallyEnder) return false;
                  
                  // If action specific, ensure the player performed that action
                  if (selectedAction.startsWith('serve') && !isServer) return false;
                  if (selectedAction === 'return' && isServer) return false; // Server can't return
                  if (selectedAction === 'winner' && (!isRallyEnder || log.rallyStats?.outcome !== 'Winner')) {
                      // Exception: Ace is a winner by server
                      if (selectedAction === 'winner' && isServer && log.serverStats.isAce) {
                          // allow
                      } else {
                          return false; 
                      }
                  } 
                  if (selectedAction === 'error' && (!isRallyEnder || !['Unforced Error', 'Forced Error'].includes(log.rallyStats?.outcome || ''))) {
                      // Exception: DF is error by server
                       if (selectedAction === 'error' && isServer && log.serverStats.isDoubleFault) {
                          // allow
                       } else {
                           return false;
                       }
                  }
              }

              // B. Action Filter
              if (selectedAction !== 'all') {
                  const side = getServeSide(log.score, false); // Assuming no tiebreak for basic parsing unless evident
                  
                  switch (selectedAction) {
                      case 'serve_deuce':
                          if (side !== 'Deuce') return false;
                          break;
                      case 'serve_ad':
                          if (side !== 'Ad') return false;
                          break;
                      case 'return':
                          if (!log.rallyStats?.isReturnEvent) return false;
                          break;
                      case 'winner':
                          const isAce = log.serverStats.isAce;
                          const isWinner = log.rallyStats?.outcome === 'Winner';
                          if (!isAce && !isWinner) return false;
                          break;
                      case 'error':
                          const isDF = log.serverStats.isDoubleFault;
                          const isErr = ['Unforced Error', 'Forced Error'].includes(log.rallyStats?.outcome || '');
                          if (!isDF && !isErr) return false;
                          break;
                      case 'net':
                          if (!log.rallyStats?.isAtNet) return false;
                          break;
                  }
              }
          }
          
          // --- MODE 2: CONTEXT FOCUS ---
          if (filterMode === 'context') {
              if (selectedContext !== 'all') {
                  const context = getPointContext(log.score, serverTeam1);
                  if (context !== selectedContext) return false;
              }
          }
          
          return true;
      });
  }, [match, setFilter, filterMode, selectedPlayerId, selectedAction, selectedContext]);


  const filteredMatch = useMemo(() => ({
      ...match,
      pointHistory: filteredHistory,
      playerStats: filteredStats
  }), [match, filteredHistory, filteredStats]);


  const getStatPercent = (val: number, total: number) => {
    if (total === 0) return '0%';
    return `${Math.round((val / total) * 100)}%`;
  }

  // Helper to sum stats for a team
  const calculateTeamStats = (teamPlayers: typeof match.team1.players): PlayerStats => {
    const totalStats = createEmptyStats();
    for (const player of teamPlayers) {
        const playerStats = filteredStats[player.profileId];
        if (playerStats) {
            Object.keys(totalStats).forEach(key => {
                totalStats[key as keyof PlayerStats] += playerStats[key as keyof PlayerStats];
            });
        }
    }
    return totalStats;
  };

  const team1Stats = calculateTeamStats(match.team1.players);
  const team2Stats = calculateTeamStats(match.team2.players);

  const performanceData: PerformanceData[] = useMemo(() => {
    if (performancePlayerFilter !== 'all') {
         // Single Player Data
         const allPlayers = [...match.team1.players, ...match.team2.players];
         const player = allPlayers.find(p => p.profileId === performancePlayerFilter);
         
         if (!player) return [];
         
         const stats = filteredStats[performancePlayerFilter];
         if (!stats) return [{ name: player.name, winners: 0, errors: 0 }];

         let winners = 0;
         let errors = 0;

         if (performanceFilter === 'serves') {
             winners = stats.aces;
             errors = stats.doubleFaults;
         } else if (performanceFilter === 'returns') {
             winners = stats.returnWinners;
             errors = stats.returnUnforcedErrors;
         } else {
             winners = stats.winners + stats.aces;
             errors = stats.unforcedErrors + stats.doubleFaults;
         }
         return [{ name: player.name, winners, errors }];

    } else {
        // Team Comparison Data
        const t1 = team1Stats;
        const t2 = team2Stats;
        const t1Data = { winners: 0, errors: 0 };
        const t2Data = { winners: 0, errors: 0 };

        if (performanceFilter === 'serves') {
            t1Data.winners = t1.aces; t1Data.errors = t1.doubleFaults;
            t2Data.winners = t2.aces; t2Data.errors = t2.doubleFaults;
        } else if (performanceFilter === 'returns') {
            t1Data.winners = t1.returnWinners; t1Data.errors = t1.returnUnforcedErrors;
            t2Data.winners = t2.returnWinners; t2Data.errors = t2.returnUnforcedErrors;
        } else {
            t1Data.winners = t1.winners + t1.aces; t1Data.errors = t1.unforcedErrors + t1.doubleFaults;
            t2Data.winners = t2.winners + t2.aces; t2Data.errors = t2.unforcedErrors + t2.doubleFaults;
        }

        return [
            { name: `Team 1`, winners: t1Data.winners, errors: t1Data.errors },
            { name: `Team 2`, winners: t2Data.winners, errors: t2Data.errors },
        ];
    }
  }, [performanceFilter, performancePlayerFilter, team1Stats, team2Stats, filteredStats, match]);

  const handleExportCSV = () => {
    const allPlayers = [...match.team1.players, ...match.team2.players];
    const playerMap = new Map(allPlayers.map(p => [p.id, p.name]));

    const headers = [
        'PointNumber', 'SetNumber', 'ScoreAtPointStart', 'PointWinner(Team)', 'Server', 
        'ServeOutcome', 'PointOutcome', 'PlayerResponsible', 'FinishedAtNet', 'WasOnReturnOfServe', 'VideoTimestamp'
    ];

    const rows = match.pointHistory.map((log, index) => {
        const serverName = playerMap.get(log.serverStats.playerId) || 'Unknown';
        let serveOutcome = '';
        if (log.serverStats.isAce) serveOutcome = 'Ace';
        else if (log.serverStats.isDoubleFault) serveOutcome = 'Double Fault';
        else if (log.serverStats.isFirstServeIn) serveOutcome = '1st Serve In';
        else serveOutcome = '2nd Serve In';

        let playerResponsibleName = '';
        if (log.rallyStats) {
            playerResponsibleName = playerMap.get(log.rallyStats.endingPlayerId) || 'Unknown';
        } else {
            playerResponsibleName = serverName; // For Ace/DF
        }

        // To handle potential commas in data, we wrap each field in quotes.
        const escapeCSV = (field: any) => `"${String(field).replace(/"/g, '""')}"`;

        const rowData = [
            index + 1,
            log.set + 1,
            log.score,
            `Team ${log.pointWinnerId}`,
            serverName,
            serveOutcome,
            log.rallyStats?.outcome || '',
            playerResponsibleName,
            log.rallyStats ? (log.rallyStats.isAtNet ? 'Yes' : 'No') : '',
            log.rallyStats ? (log.rallyStats.isReturnEvent ? 'Yes' : 'No') : '',
            log.timestamp || ''
        ].map(escapeCSV);
        return rowData.join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.href) {
        URL.revokeObjectURL(link.href);
    }
    const url = URL.createObjectURL(blob);
    link.href = url;
    const team1Names = match.team1.players.map(p => p.name.split(' ')[0]).join('-');
    const team2Names = match.team2.players.map(p => p.name.split(' ')[0]).join('-');
    link.setAttribute('download', `match_${match.date}_${team1Names}_vs_${team2Names}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderStatRow = (name: string, stats: PlayerStats, isTeamRow = false) => (
    <tr key={name} className={`border-b border-court-lines last:border-b-0 ${isTeamRow ? 'bg-court-bg font-bold text-tennis-ball' : ''}`}>
      <td className="py-3 px-2 text-left">{name}</td>
      <td className="py-3 px-2 font-mono">{stats.winners}</td>
      <td className="py-3 px-2 font-mono">{stats.aces}</td>
      <td className="py-3 px-2 font-mono">{stats.unforcedErrors}</td>
      <td className="py-3 px-2 font-mono">{stats.doubleFaults}</td>
      <td className="py-3 px-2 font-mono" title="1st Serve %">{getStatPercent(stats.firstServesIn, stats.firstServesTotal)}</td>
      <td className="py-3 px-2 font-mono" title="2nd Serve Win %">{getStatPercent(stats.secondServesWon, stats.secondServesTotal)}</td>
      <td className="py-3 px-2 font-mono" title="Return Winners">{stats.returnWinners}</td>
      <td className="py-3 px-2 font-mono" title="Return Unforced Errors">{stats.returnUnforcedErrors}</td>
      <td className="py-3 px-2 font-mono" title="Serves Unreturned">{stats.servesUnreturned}</td>
      <td className="py-3 px-2 font-mono" title="Net Points Won %">{getStatPercent(stats.netPointsWon, stats.netPointsApproached)}</td>
    </tr>
  );
  
  const numSets = match.team1.score.length;

  const renderVideoSection = () => (
      <Card className="flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-court-lines pb-2">
              <h3 className="text-xl font-bold text-tennis-ball">Smart Video Review</h3>
              {videoUrl && <span className="text-xs text-secondary-text">Points Found: {playlistPoints.length}</span>}
          </div>
          
          {!videoUrl ? (
            <div className="text-center p-6 border-2 border-dashed border-court-lines rounded-lg bg-court-bg">
                <p className="mb-2 text-primary-text">Load the match video file to review plays.</p>
                {match.videoFileName && (
                     <p className="text-sm text-secondary-text mb-4">
                         Recorded with: <span className="font-mono text-tennis-ball">{match.videoFileName}</span>
                     </p>
                )}
                <label className="bg-tennis-ball hover:bg-opacity-80 text-court-bg font-bold py-2 px-6 rounded cursor-pointer inline-block transition-colors">
                    Load Video File
                    <input type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
                </label>
            </div>
          ) : (
              <div className="flex flex-col gap-4">
                   <div className="relative w-full bg-black rounded-lg overflow-hidden">
                       <video ref={videoRef} src={videoUrl} controls className="w-full max-h-[50vh]" />
                   </div>
                   
                   {/* Playback Controls */}
                   <div className="flex justify-center gap-4 mb-2">
                        <button onClick={() => skip(-5)} className="bg-court-lines hover:bg-tennis-ball hover:text-court-bg text-primary-text px-3 py-1 rounded text-sm font-bold transition-colors">-5s</button>
                        <button onClick={() => skip(5)} className="bg-court-lines hover:bg-tennis-ball hover:text-court-bg text-primary-text px-3 py-1 rounded text-sm font-bold transition-colors">+5s</button>
                   </div>

                   {/* SMART PLAYLIST FILTERS */}
                   <div className="bg-court-bg-light border border-court-lines rounded-lg p-3">
                        <div className="flex mb-3 border-b border-court-lines">
                            <button 
                                onClick={() => setFilterMode('player')}
                                className={`flex-1 py-2 font-bold text-sm ${filterMode === 'player' ? 'text-tennis-ball border-b-2 border-tennis-ball' : 'text-secondary-text'}`}
                            >
                                Player Focus
                            </button>
                            <button 
                                onClick={() => setFilterMode('context')}
                                className={`flex-1 py-2 font-bold text-sm ${filterMode === 'context' ? 'text-tennis-ball border-b-2 border-tennis-ball' : 'text-secondary-text'}`}
                            >
                                Match Context
                            </button>
                        </div>

                        {filterMode === 'player' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-secondary-text mb-1 uppercase">Player</label>
                                    <select 
                                            value={selectedPlayerId} 
                                            onChange={(e) => setSelectedPlayerId(e.target.value)}
                                            className="w-full bg-court-bg border border-court-lines text-primary-text rounded p-2 text-sm"
                                        >
                                            <option value="all">Any Player</option>
                                            {[...match.team1.players, ...match.team2.players].map(p => (
                                                <option key={p.profileId} value={p.profileId}>{p.name}</option>
                                            ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-secondary-text mb-1 uppercase">Action</label>
                                    <select 
                                            value={selectedAction} 
                                            onChange={(e) => setSelectedAction(e.target.value as ActionFilterType)}
                                            className="w-full bg-court-bg border border-court-lines text-primary-text rounded p-2 text-sm"
                                        >
                                            <option value="all">All Actions</option>
                                            <option value="serve_deuce">Serves (Deuce Side)</option>
                                            <option value="serve_ad">Serves (Ad Side)</option>
                                            <option value="return">Returns</option>
                                            <option value="winner">Winners / Aces</option>
                                            <option value="error">Errors / DFs</option>
                                            <option value="net">Net Points</option>
                                    </select>
                                </div>
                            </div>
                        ) : (
                            <div className="w-full">
                                <label className="block text-xs font-bold text-secondary-text mb-1 uppercase">Situation</label>
                                <div className="flex flex-wrap gap-2">
                                    <button onClick={() => setSelectedContext('all')} className={`px-3 py-1 rounded text-sm font-semibold border ${selectedContext === 'all' ? 'bg-tennis-ball text-court-bg border-tennis-ball' : 'bg-court-bg border-court-lines'}`}>All Points</button>
                                    <button onClick={() => setSelectedContext('break_point')} className={`px-3 py-1 rounded text-sm font-semibold border ${selectedContext === 'break_point' ? 'bg-red-500 text-white border-red-500' : 'bg-court-bg border-court-lines'}`}>Break Points</button>
                                    <button onClick={() => setSelectedContext('game_point')} className={`px-3 py-1 rounded text-sm font-semibold border ${selectedContext === 'game_point' ? 'bg-green-600 text-white border-green-600' : 'bg-court-bg border-court-lines'}`}>Game Points</button>
                                    <button onClick={() => setSelectedContext('deuce')} className={`px-3 py-1 rounded text-sm font-semibold border ${selectedContext === 'deuce' ? 'bg-yellow-500 text-court-bg border-yellow-500' : 'bg-court-bg border-court-lines'}`}>Deuce</button>
                                    <button onClick={() => setSelectedContext('tiebreak')} className={`px-3 py-1 rounded text-sm font-semibold border ${selectedContext === 'tiebreak' ? 'bg-blue-500 text-white border-blue-500' : 'bg-court-bg border-court-lines'}`}>Tiebreaks</button>
                                </div>
                            </div>
                        )}
                   </div>

                   <div className="max-h-80 overflow-y-auto bg-court-bg rounded-md border border-court-lines">
                       {playlistPoints.length === 0 ? (
                           <p className="p-8 text-center text-secondary-text italic">No points match the current filters.</p>
                       ) : (
                           <ul className="divide-y divide-court-lines">
                               {playlistPoints.map((log) => {
                                   const side = getServeSide(log.score, log.score.includes('-') && !log.score.includes('Ad') && parseInt(log.score.split('-')[0]) > 4); // Loose check for display
                                   return (
                                   <li key={log.id} className="p-3 flex justify-between items-center hover:bg-court-bg-light transition-colors group">
                                       <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-mono font-bold text-tennis-ball">{log.score}</span>
                                                <span className="text-xs text-secondary-text bg-court-lines px-1 rounded">{side} Side</span>
                                                <span className="text-xs text-secondary-text">Set {log.set + 1}</span>
                                            </div>
                                            <div className="text-sm text-primary-text">{log.description}</div>
                                       </div>
                                       
                                       {log.timestamp !== undefined ? (
                                            <button 
                                                onClick={() => jumpToTime(log.timestamp!)}
                                                className="flex items-center gap-2 bg-court-lines group-hover:bg-tennis-ball text-primary-text group-hover:text-court-bg px-3 py-2 rounded font-bold text-xs transition-colors"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                                </svg>
                                                {Math.floor(log.timestamp / 60)}:{(Math.floor(log.timestamp % 60)).toString().padStart(2, '0')}
                                            </button>
                                       ) : (
                                            <span className="text-xs text-secondary-text italic">No Time</span>
                                       )}
                                   </li>
                               )})}
                           </ul>
                       )}
                   </div>
              </div>
          )}
      </Card>
  );

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
          <h2 className="text-xl font-bold text-tennis-ball">Match Stats ({match.date})</h2>
           <div className="flex items-center gap-2">
              <button onClick={handleExportCSV} className="bg-green-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-green-700">
                Export to CSV
              </button>
              <button onClick={onBack} className="bg-court-lines text-primary-text font-semibold py-2 px-4 rounded-md hover:bg-opacity-80">
                Back to Home
              </button>
           </div>
        </div>
        <p className="text-center text-lg mb-4">
          {match.team1.players.map(p => p.name).join(' / ')} vs {match.team2.players.map(p => p.name).join(' / ')}
        </p>

        {/* Set Filter */}
        <div className="flex justify-center flex-wrap gap-2 mb-4">
            <button onClick={() => setSetFilter('all')} className={`py-1 px-3 rounded-md text-sm font-semibold ${setFilter === 'all' ? 'bg-tennis-ball text-court-bg' : 'bg-court-lines'}`}>All Sets</button>
            {[...Array(numSets)].map((_, i) => (
                <button key={i} onClick={() => setSetFilter(i)} className={`py-1 px-3 rounded-md text-sm font-semibold ${setFilter === i ? 'bg-tennis-ball text-court-bg' : 'bg-court-lines'}`}>Set {i + 1}</button>
            ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center whitespace-nowrap">
            <thead className="border-b-2 border-court-lines">
              <tr>
                <th className="py-2 px-2 font-semibold text-left">Player / Team</th>
                <th className="py-2 px-2 font-semibold text-green-400" title="Winners">W</th>
                <th className="py-2 px-2 font-semibold text-green-400" title="Aces">A</th>
                <th className="py-2 px-2 font-semibold text-red-400" title="Unforced Errors">UE</th>
                <th className="py-2 px-2 font-semibold text-red-400" title="Double Faults">DF</th>
                <th className="py-2 px-2 font-semibold text-blue-400" title="1st Serve %">FS%</th>
                <th className="py-2 px-2 font-semibold text-blue-400" title="2nd Serve Win %">SSW%</th>
                <th className="py-2 px-2 font-semibold text-yellow-400" title="Return Winners">RW</th>
                <th className="py-2 px-2 font-semibold text-orange-400" title="Return Unforced Errors">RUE</th>
                <th className="py-2 px-2 font-semibold text-teal-400" title="Serves Unreturned">SU</th>
                <th className="py-2 px-2 font-semibold text-purple-400" title="Net Points Won %">NPW%</th>
              </tr>
            </thead>
            <tbody>
              {renderStatRow(match.team1.players[0].name, filteredStats[match.team1.players[0].profileId])}
              {renderStatRow(match.team1.players[1].name, filteredStats[match.team1.players[1].profileId])}
              {renderStatRow('Team 1 Total', team1Stats, true)}
              <tr className="border-b-2 border-tennis-ball"><td colSpan={11}></td></tr>
              {renderStatRow(match.team2.players[0].name, filteredStats[match.team2.players[0].profileId])}
              {renderStatRow(match.team2.players[1].name, filteredStats[match.team2.players[1].profileId])}
              {renderStatRow('Team 2 Total', team2Stats, true)}
            </tbody>
          </table>
        </div>
      </Card>
      
      {/* Video Review Section */}
      {renderVideoSection()}
      
      {filteredMatch.pointHistory && filteredMatch.pointHistory.length > 1 && (
        <div className="grid md:grid-cols-2 gap-6">
            <Card>
                <h3 className="text-xl font-bold text-center mb-4 text-tennis-ball">Match Momentum</h3>
                <MomentumChart match={filteredMatch} />
            </Card>
            <Card>
                 <h3 className="text-xl font-bold text-center mb-4 text-tennis-ball">Point Breakdown</h3>
                 <PointBreakdownChart match={filteredMatch} team1Stats={team1Stats} team2Stats={team2Stats} />
            </Card>
        </div>
      )}

      {filteredMatch.pointHistory && filteredMatch.pointHistory.length > 0 && (
          <>
            <Card>
                <h3 className="text-xl font-bold text-center mb-4 text-tennis-ball">Individual Performance</h3>
                <IndividualStatChart match={filteredMatch} />
            </Card>
            <Card>
                <h3 className="text-xl font-bold text-center mb-4 text-tennis-ball">Performance Breakdown</h3>
                <div className="flex flex-col gap-4">
                    <div className="flex justify-center flex-wrap gap-2">
                        <select 
                                value={performancePlayerFilter} 
                                onChange={(e) => setPerformancePlayerFilter(e.target.value)}
                                className="bg-court-bg border border-court-lines text-primary-text rounded p-2 text-sm font-semibold"
                        >
                            <option value="all">Team Comparison</option>
                            {[...match.team1.players, ...match.team2.players].map(p => (
                                <option key={p.profileId} value={p.profileId}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex justify-center flex-wrap gap-2">
                        <button onClick={() => setPerformanceFilter('all')} className={`py-1 px-3 rounded-md text-sm font-semibold ${performanceFilter === 'all' ? 'bg-tennis-ball text-court-bg' : 'bg-court-lines'}`}>All</button>
                        <button onClick={() => setPerformanceFilter('serves')} className={`py-1 px-3 rounded-md text-sm font-semibold ${performanceFilter === 'serves' ? 'bg-tennis-ball text-court-bg' : 'bg-court-lines'}`}>Serves</button>
                        <button onClick={() => setPerformanceFilter('returns')} className={`py-1 px-3 rounded-md text-sm font-semibold ${performanceFilter === 'returns' ? 'bg-tennis-ball text-court-bg' : 'bg-court-lines'}`}>Returns</button>
                    </div>
                </div>

                <PerformanceDonutChart 
                    data={performanceData}
                    filterType={performanceFilter}
                />
            </Card>
          </>
      )}
    </div>
  );
};

export default HistoricalStatsScreen;
