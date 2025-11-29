
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { MatchRecord, PlayerStats, PointLog } from '../types';
import Card from './common/Card';
import MomentumChart from './MomentumChart';
import PointBreakdownChart from './PointBreakdownChart';
import IndividualStatChart from './IndividualStatChart';
import PerformanceDonutChart, { PerformanceData } from './PerformanceDonutChart';
import ServeReturnAnalysis from './ServeReturnAnalysis';
import { recalculateStatsFromHistory, createEmptyStats, getServeSideFromScore } from '../utils/analytics';

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

  const allPlayers = useMemo(() => [...match.team1.players, ...match.team2.players], [match]);
  const playerMap = useMemo(() => new Map(allPlayers.map(p => [p.id, p])), [allPlayers]);

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

  const formatTime = (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return `${m}:${s.toString().padStart(2, '0')}`;
  };
  
  const { filteredHistory, filteredStats } = useMemo(() => {
    const filteredHistory = setFilter === 'all' 
      ? match.pointHistory 
      : match.pointHistory.filter(p => p.set === setFilter);
    
    const filteredStats = recalculateStatsFromHistory(filteredHistory, allPlayers);
    
    return { filteredHistory, filteredStats };
  }, [match, setFilter, allPlayers]);

  // --- Logic Helpers for Filters ---

  const getPointContext = (score: string, isServerTeam1: boolean): ContextFilterType | null => {
      if (score.includes('Ad')) {
           if (score === 'Ad-In') return 'game_point';
           if (score === 'Ad-Out') return 'break_point';
      }

      if (score === 'Deuce') return 'deuce';

      const parts = score.split('-');
      if (parts.length !== 2) return null;
      
      const isStandard = ['0','15','30','40'].includes(parts[0]) && ['0','15','30','40'].includes(parts[1]);
      
      if (!isStandard) return 'tiebreak';

      const serverScore = isServerTeam1 ? parts[0] : parts[1];
      const receiverScore = isServerTeam1 ? parts[1] : parts[0];

      if (serverScore === '40' && receiverScore !== '40') return 'game_point';
      if (receiverScore === '40' && serverScore !== '40') return 'break_point';

      return null;
  };

  const playlistPoints = useMemo(() => {
      return match.pointHistory.filter(log => {
          if (setFilter !== 'all' && log.set !== setFilter) return false;

          const server = playerMap.get(log.serverStats.playerId);
          const serverTeam1 = server ? server.id < 2 : true;
          
          if (filterMode === 'player') {
              if (selectedPlayerId !== 'all') {
                  const targetProfileId = selectedPlayerId;
                  const isServer = server?.profileId === targetProfileId;
                  const isRallyEnder = log.rallyStats && playerMap.get(log.rallyStats.endingPlayerId)?.profileId === targetProfileId;
                  
                  if (!isServer && !isRallyEnder) return false;
                  
                  if (selectedAction.startsWith('serve') && !isServer) return false;
                  if (selectedAction === 'return' && isServer) return false;
                  if (selectedAction === 'winner' && (!isRallyEnder || log.rallyStats?.outcome !== 'Winner')) {
                      if (selectedAction === 'winner' && isServer && log.serverStats.isAce) { } else { return false; }
                  } 
                  if (selectedAction === 'error' && (!isRallyEnder || !['Unforced Error', 'Forced Error'].includes(log.rallyStats?.outcome || ''))) {
                       if (selectedAction === 'error' && isServer && log.serverStats.isDoubleFault) { } else { return false; }
                  }
              }

              if (selectedAction !== 'all') {
                  const side = getServeSideFromScore(log.score, false);
                  switch (selectedAction) {
                      case 'serve_deuce': if (side !== 'Deuce') return false; break;
                      case 'serve_ad': if (side !== 'Ad') return false; break;
                      case 'return': if (!log.rallyStats?.isReturnEvent) return false; break;
                      case 'winner': if (!log.serverStats.isAce && log.rallyStats?.outcome !== 'Winner') return false; break;
                      case 'error': if (!log.serverStats.isDoubleFault && !['Unforced Error', 'Forced Error'].includes(log.rallyStats?.outcome || '')) return false; break;
                      case 'net': if (!log.rallyStats?.isAtNet) return false; break;
                  }
              }
          }
          
          if (filterMode === 'context') {
              if (selectedContext !== 'all') {
                  const context = getPointContext(log.score, serverTeam1);
                  if (context !== selectedContext) return false;
              }
          }
          
          return true;
      });
  }, [match, setFilter, filterMode, selectedPlayerId, selectedAction, selectedContext, playerMap]);


  const filteredMatch = useMemo(() => ({
      ...match,
      pointHistory: filteredHistory,
      playerStats: filteredStats
  }), [match, filteredHistory, filteredStats]);


  const getStatPercent = (val: number, total: number) => {
    if (total === 0) return '0%';
    return `${Math.round((val / total) * 100)}%`;
  }

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
  const totalPointsPlayed = team1Stats.pointsWon + team2Stats.pointsWon;

  const handleExportCSV = () => {
    const headers = [
        'PointNumber', 'SetNumber', 'ScoreAtPointStart', 'PointWinner(Team)', 'Server', 
        'ServeOutcome', 'PointOutcome', 'PlayerResponsible', 'FinishedAtNet', 'WasOnReturnOfServe', 'VideoTimestamp'
    ];
    const rows = match.pointHistory.map((log, index) => {
        const serverName = playerMap.get(log.serverStats.playerId)?.name || 'Unknown';
        let serveOutcome = '';
        if (log.serverStats.isAce) serveOutcome = 'Ace';
        else if (log.serverStats.isDoubleFault) serveOutcome = 'Double Fault';
        else if (log.serverStats.isFirstServeIn) serveOutcome = '1st Serve In';
        else serveOutcome = '2nd Serve In';
        let playerResponsibleName = log.rallyStats ? (playerMap.get(log.rallyStats.endingPlayerId)?.name || 'Unknown') : serverName;
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
    if (link.href) URL.revokeObjectURL(link.href);
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
      <td className="py-2 px-2 text-left text-sm md:text-base">{name}</td>
      <td className="py-2 px-2 font-mono text-sm md:text-base">{stats.winners}</td>
      <td className="py-2 px-2 font-mono text-sm md:text-base">{stats.aces}</td>
      <td className="py-2 px-2 font-mono text-sm md:text-base">{stats.unforcedErrors}</td>
      <td className="py-2 px-2 font-mono text-sm md:text-base">{stats.doubleFaults}</td>
      <td className="py-2 px-2 font-mono text-sm md:text-base" title="1st Serve %">{getStatPercent(stats.firstServesIn, stats.firstServesTotal)}</td>
      <td className="py-2 px-2 font-mono text-sm md:text-base" title="2nd Serve Win %">{getStatPercent(stats.secondServesWon, stats.secondServesTotal)}</td>
      <td className="py-2 px-2 font-mono text-sm md:text-base" title="Return Winners">{stats.returnWinners}</td>
      <td className="py-2 px-2 font-mono text-sm md:text-base" title="Return Unforced Errors">{stats.returnUnforcedErrors}</td>
      <td className="py-2 px-2 font-mono text-sm md:text-base" title="Serves Unreturned">{stats.servesUnreturned}</td>
      <td className="py-2 px-2 font-mono text-sm md:text-base" title="Net Points Won %">{getStatPercent(stats.netPointsWon, stats.netPointsApproached)}</td>
    </tr>
  );
  
  const numSets = match.team1.score.length;

  const renderVideoSection = () => (
      <Card className="flex flex-col gap-2 h-full p-4">
          <div className="flex justify-between items-center border-b border-court-lines pb-2 flex-shrink-0">
              <h3 className="text-xl font-bold text-tennis-ball">Smart Video Review</h3>
              {videoUrl && <span className="text-xs text-secondary-text">Points Found: {playlistPoints.length}</span>}
          </div>
          
          {!videoUrl ? (
            <div className="flex-grow flex flex-col items-center justify-center p-12 border-2 border-dashed border-court-lines rounded-lg bg-court-bg">
                <p className="mb-2 text-primary-text text-lg">Load the match video file to review plays.</p>
                {match.videoFileName && (
                     <p className="text-sm text-secondary-text mb-4">
                         Recorded with: <span className="font-mono text-tennis-ball">{match.videoFileName}</span>
                     </p>
                )}
                <label className="bg-tennis-ball hover:bg-opacity-80 text-court-bg font-bold py-3 px-8 rounded cursor-pointer inline-block transition-colors shadow-lg">
                    Select Video File
                    <input type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
                </label>
            </div>
          ) : (
              <div className="flex flex-col gap-2 w-full h-full min-h-0">
                   <div className="relative w-full flex-grow bg-black rounded-lg overflow-hidden shadow-2xl min-h-0">
                       <video ref={videoRef} src={videoUrl} controls className="w-full h-full object-contain" />
                   </div>
                   
                   <div className="flex justify-center gap-4 flex-shrink-0">
                        <button onClick={() => skip(-5)} className="bg-court-lines hover:bg-tennis-ball hover:text-court-bg text-primary-text px-3 py-1 rounded font-bold transition-colors text-sm">-5s</button>
                        <button onClick={() => skip(5)} className="bg-court-lines hover:bg-tennis-ball hover:text-court-bg text-primary-text px-3 py-1 rounded font-bold transition-colors text-sm">+5s</button>
                   </div>
              </div>
          )}
      </Card>
  );

  const renderPlaylistSection = () => (
      <Card className="h-full flex flex-col max-h-full">
           <h3 className="text-xl font-bold text-tennis-ball mb-4 flex-shrink-0">Smart Playlist</h3>
           <div className="bg-court-bg-light border border-court-lines rounded-lg p-3 mb-4 flex-shrink-0">
                <div className="flex mb-3 border-b border-court-lines">
                    <button onClick={() => setFilterMode('player')} className={`flex-1 py-2 font-bold text-sm ${filterMode === 'player' ? 'text-tennis-ball border-b-2 border-tennis-ball' : 'text-secondary-text'}`}>Player Focus</button>
                    <button onClick={() => setFilterMode('context')} className={`flex-1 py-2 font-bold text-sm ${filterMode === 'context' ? 'text-tennis-ball border-b-2 border-tennis-ball' : 'text-secondary-text'}`}>Match Context</button>
                </div>
                {filterMode === 'player' ? (
                    <div className="grid grid-cols-1 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-secondary-text mb-1 uppercase">Player</label>
                            <select value={selectedPlayerId} onChange={(e) => setSelectedPlayerId(e.target.value)} className="w-full bg-court-bg border border-court-lines text-primary-text rounded p-2 text-sm">
                                <option value="all">Any Player</option>
                                {[...match.team1.players, ...match.team2.players].map(p => <option key={p.profileId} value={p.profileId}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-secondary-text mb-1 uppercase">Action</label>
                            <select value={selectedAction} onChange={(e) => setSelectedAction(e.target.value as ActionFilterType)} className="w-full bg-court-bg border border-court-lines text-primary-text rounded p-2 text-sm">
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
                            {['all', 'break_point', 'game_point', 'deuce', 'tiebreak'].map(ctx => (
                                <button key={ctx} onClick={() => setSelectedContext(ctx as ContextFilterType)} className={`px-2 py-1 rounded text-xs font-semibold border ${selectedContext === ctx ? 'bg-tennis-ball text-court-bg border-tennis-ball' : 'bg-court-lines'}`}>
                                    {ctx.replace('_', ' ').toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
           </div>

           <div className="flex-grow overflow-y-auto bg-court-bg rounded-md border border-court-lines min-h-0">
               {playlistPoints.length === 0 ? (
                   <p className="p-8 text-center text-secondary-text italic">No points match the current filters.</p>
               ) : (
                   <ul className="divide-y divide-court-lines">
                       {playlistPoints.map((log) => {
                           const side = getServeSideFromScore(log.score, log.score.includes('-') && !log.score.includes('Ad') && parseInt(log.score.split('-')[0]) > 4);
                           const serverName = playerMap.get(log.serverStats.playerId)?.name || 'Unknown';
                           
                           return (
                           <li key={log.id} className="p-3 flex justify-between items-center hover:bg-court-bg-light transition-colors group">
                               <div className="flex-1 min-w-0 pr-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-secondary-text font-mono text-xs">#{log.id + 1}</span>
                                        <span className="font-mono font-bold text-tennis-ball">{log.score}</span>
                                        <span className="text-xs text-secondary-text bg-court-lines px-1 rounded">{side}</span>
                                        {log.rallyStats?.isAtNet && <span className="text-xs bg-purple-600 text-white px-1 rounded">NET</span>}
                                    </div>
                                    <div className="text-xs text-secondary-text mb-0.5">Svr: {serverName}</div>
                                    <div className="text-sm text-primary-text truncate" title={log.description}>{log.description}</div>
                               </div>
                               {log.timestamp !== undefined && (
                                    <button onClick={() => jumpToTime(log.timestamp!)} className="flex flex-col items-center justify-center bg-court-lines group-hover:bg-tennis-ball text-primary-text group-hover:text-court-bg px-2 py-1 rounded min-w-[50px] transition-colors">
                                        <span className="font-bold text-xs">PLAY</span>
                                        <span className="text-[10px] font-mono">{formatTime(log.timestamp)}</span>
                                    </button>
                               )}
                           </li>
                       )})}
                   </ul>
               )}
           </div>
      </Card>
  );

  return (
    <div className="space-y-6 pb-12 relative">
       {/* Sticky Header with Controls */}
      <div className="sticky top-0 z-20 bg-court-bg pb-4 pt-2 border-b border-court-lines shadow-md">
         <div className="flex flex-wrap justify-between items-center gap-4 px-2">
            <h2 className="text-xl font-bold text-tennis-ball">Match Stats ({match.date})</h2>
            
            <div className="flex items-center gap-2 bg-court-bg-light p-1 rounded-lg border border-court-lines">
                <button onClick={() => setSetFilter('all')} className={`py-1 px-3 rounded-md text-xs font-semibold ${setFilter === 'all' ? 'bg-tennis-ball text-court-bg' : 'bg-court-lines'}`}>All Sets</button>
                {[...Array(numSets)].map((_, i) => (
                    <button key={i} onClick={() => setSetFilter(i)} className={`py-1 px-3 rounded-md text-xs font-semibold ${setFilter === i ? 'bg-tennis-ball text-court-bg' : 'bg-court-lines'}`}>Set {i + 1}</button>
                ))}
            </div>

            <div className="flex items-center gap-2">
                <button onClick={handleExportCSV} className="bg-green-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-green-700 text-sm">Export CSV</button>
                <button onClick={onBack} className="bg-court-lines text-primary-text font-semibold py-2 px-4 rounded-md hover:bg-opacity-80 text-sm">Back</button>
            </div>
         </div>
      </div>

      {/* 1. Header & Summary */}
      <Card>
        {/* Compact Total Points Summary */}
        <div className="flex flex-col gap-2 mb-6">
             <div className="flex justify-between text-sm font-bold px-1">
                 <span className="text-tennis-ball">{match.team1.players.map(p => p.name).join('/')} ({getStatPercent(team1Stats.pointsWon, totalPointsPlayed)})</span>
                 <span className="text-white">{match.team2.players.map(p => p.name).join('/')} ({getStatPercent(team2Stats.pointsWon, totalPointsPlayed)})</span>
             </div>
             <div className="w-full h-3 bg-court-bg rounded-full overflow-hidden flex">
                  <div style={{ width: getStatPercent(team1Stats.pointsWon, totalPointsPlayed) }} className="h-full bg-tennis-ball transition-all duration-500"></div>
                  <div className="flex-grow h-full bg-court-lines"></div>
             </div>
        </div>
      </Card>

      {/* 2. Main Video & Playlist Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
           {/* Left Column: Stats Table + Video */}
          <div className="xl:col-span-8 flex flex-col gap-6">
              
              {/* Stats Table - Width constrained to column */}
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-center whitespace-nowrap">
                        <thead className="border-b-2 border-court-lines">
                        <tr>
                            <th className="py-2 px-2 font-semibold text-left text-sm">Player / Team</th>
                            <th className="py-2 px-2 font-semibold text-green-400 text-sm" title="Winners">W</th>
                            <th className="py-2 px-2 font-semibold text-green-400 text-sm" title="Aces">A</th>
                            <th className="py-2 px-2 font-semibold text-red-400 text-sm" title="Unforced Errors">UE</th>
                            <th className="py-2 px-2 font-semibold text-red-400 text-sm" title="Double Faults">DF</th>
                            <th className="py-2 px-2 font-semibold text-blue-400 text-sm" title="1st Serve %">FS%</th>
                            <th className="py-2 px-2 font-semibold text-blue-400 text-sm" title="2nd Serve Win %">SSW%</th>
                            <th className="py-2 px-2 font-semibold text-yellow-400 text-sm" title="Return Winners">RW</th>
                            <th className="py-2 px-2 font-semibold text-orange-400 text-sm" title="Return Unforced Errors">RUE</th>
                            <th className="py-2 px-2 font-semibold text-teal-400 text-sm" title="Serves Unreturned">SU</th>
                            <th className="py-2 px-2 font-semibold text-purple-400 text-sm" title="Net Points Won %">NPW%</th>
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

              {/* Video Player - INCREASED HEIGHT */}
              <div className="h-[900px]">
                 {renderVideoSection()}
              </div>
          </div>

          {/* Right Column: Playlist - Height matched to Left column approximation + offset */}
          <div className="xl:col-span-4 h-[900px] xl:h-[1350px]">
             {renderPlaylistSection()}
          </div>
      </div>

      {/* 4. Detailed Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
              <h3 className="text-xl font-bold text-center mb-4 text-tennis-ball">Individual Performance</h3>
              <IndividualStatChart match={filteredMatch} />
          </Card>
          <ServeReturnAnalysis match={filteredMatch} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredMatch.pointHistory.length > 1 && (
                <>
                    <Card>
                        <h3 className="text-xl font-bold text-center mb-4 text-tennis-ball">Match Momentum</h3>
                        <MomentumChart match={filteredMatch} />
                    </Card>
                    <Card>
                        <h3 className="text-xl font-bold text-center mb-4 text-tennis-ball">Point Breakdown</h3>
                        <PointBreakdownChart match={filteredMatch} team1Stats={team1Stats} team2Stats={team2Stats} />
                    </Card>
                </>
           )}
      </div>

    </div>
  );
};

export default HistoricalStatsScreen;
