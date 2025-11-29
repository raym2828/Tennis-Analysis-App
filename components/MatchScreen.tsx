
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { GameState, Action } from '../types';
import Scoreboard from './Scoreboard';
import StatSummary from './StatSummary';
import Card from './common/Card';
import StatInput from './StatInput';
import ServerSelection from './ServerSelection';

interface MatchScreenProps {
  state: GameState & {isMatchStarted: true};
  dispatch: React.Dispatch<Action>;
  onMatchEnd: (finalState: GameState, videoFileName?: string | null) => void;
  onSaveAndExit: (videoFileName?: string | null) => void;
  onAbandon: () => void;
  error: string | null; // To display errors from parent
  debugLog: string[];
}

const MatchScreen: React.FC<MatchScreenProps> = ({ state, dispatch, onMatchEnd, onSaveAndExit, onAbandon, error, debugLog }) => {
  const [showHistory, setShowHistory] = useState(true); // Default to showing history on wide screens
  const [showDebugLog, setShowDebugLog] = useState(false);
  
  // Video state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoFileName, setVideoFileName] = useState<string | null>(null);

  const playerMap = useMemo(() => 
    new Map([...state.team1.players, ...state.team2.players].map(p => [p.id, p.name])), 
    [state.team1.players, state.team2.players]
  );

  // Clean up video URL on unmount
  useEffect(() => {
    return () => {
        if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        const url = URL.createObjectURL(file);
        setVideoUrl(url);
        setVideoFileName(file.name);
    }
  };

  const getCurrentVideoTime = () => {
      return videoRef.current?.currentTime;
  };

  const skip = (seconds: number) => {
      if (videoRef.current) {
          videoRef.current.currentTime += seconds;
      }
  };

  const handleUndo = () => dispatch({ type: 'UNDO_LAST_POINT' });
  
  const handleFinish = () => onMatchEnd(state, videoFileName);

  const server = state.serverIndex !== null ? [...state.team1.players, ...state.team2.players].find(p => p.id === state.serverIndex)! : null;

  const renderVideoPlayer = () => (
      <Card>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-xl font-bold text-tennis-ball">Match Video</h3>
            {videoUrl && (
                <button 
                  onClick={() => {
                      setVideoUrl(null);
                      setVideoFileName(null);
                  }}
                  className="text-xs text-red-400 hover:text-red-300"
              >
                  Remove Video
              </button>
            )}
          </div>
          
          {!videoUrl ? (
              <div className="text-center p-8 border-2 border-dashed border-court-lines rounded-lg bg-court-bg">
                  <p className="mb-4 text-secondary-text">Load a video file to sync stats with timestamps.</p>
                  <label className="bg-court-lines hover:bg-opacity-80 text-white font-bold py-2 px-4 rounded cursor-pointer inline-block transition-colors">
                      Select Video File
                      <input type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
                  </label>
              </div>
          ) : (
              <div className="flex flex-col items-center">
                  <video 
                      ref={videoRef} 
                      src={videoUrl} 
                      controls 
                      className="w-full max-h-[60vh] bg-black rounded-lg mb-4"
                  />
                  <div className="flex gap-4 mb-2">
                    <button onClick={() => skip(-5)} className="bg-court-lines hover:bg-tennis-ball hover:text-court-bg text-primary-text px-4 py-2 rounded font-bold transition-colors">-5s</button>
                    <button onClick={() => skip(-2)} className="bg-court-lines hover:bg-tennis-ball hover:text-court-bg text-primary-text px-4 py-2 rounded font-bold transition-colors">-2s</button>
                    <button onClick={() => skip(2)} className="bg-court-lines hover:bg-tennis-ball hover:text-court-bg text-primary-text px-4 py-2 rounded font-bold transition-colors">+2s</button>
                    <button onClick={() => skip(5)} className="bg-court-lines hover:bg-tennis-ball hover:text-court-bg text-primary-text px-4 py-2 rounded font-bold transition-colors">+5s</button>
                  </div>
                  <span className="text-sm text-secondary-text truncate max-w-full">{videoFileName}</span>
              </div>
          )}
      </Card>
  );

  const renderScoringControls = () => {
    if (!server) return null; // Should not happen in 'scoring' state
    
    const timestamp = getCurrentVideoTime();

    return (
      <div>
        <h2 className="text-xl font-bold text-center mb-4">Point Outcome</h2>
        
        {/* Top Row: Serve Outcomes */}
        <div className="grid grid-cols-2 gap-3 mb-3">
           <button
            onClick={() => dispatch({ type: 'QUICK_ATTRIBUTE_POINT', payload: { reason: 'Ace', timestamp } })}
            className="bg-green-600 text-white font-bold py-3 px-2 rounded-md hover:bg-green-700 transition-colors duration-200 text-base"
           >
            Ace ({server.name})
           </button>
          {state.isFirstServeFaulted ? (
            <button
              onClick={() => dispatch({ type: 'QUICK_ATTRIBUTE_POINT', payload: { reason: 'Double Fault', timestamp } })}
              className="w-full bg-red-700 text-white font-bold py-3 px-4 rounded-md hover:bg-red-800 transition-colors duration-200 text-base"
            >
              Double Fault ({server.name})
            </button>
          ) : (
             <button
              onClick={() => dispatch({ type: 'FIRST_SERVE_FAULT' })}
              className="w-full bg-court-lines text-primary-text font-bold py-3 px-4 rounded-md hover:bg-opacity-80 transition-colors duration-200 text-base"
            >
              1st Serve Fault
            </button>
          )}
        </div>

        {/* Bottom Row: Rally Outcomes */}
        <div className="grid grid-cols-3 gap-3">
           <button
            onClick={() => dispatch({ type: 'AWARD_RALLY_START', payload: { reason: 'Winner', timestamp } })}
            className="bg-green-500 text-white font-bold py-3 px-2 rounded-md hover:bg-green-600 transition-colors duration-200 text-base"
           >
            Winner
           </button>
           <button
            onClick={() => dispatch({ type: 'AWARD_RALLY_START', payload: { reason: 'Forced Error', timestamp } })}
            className="bg-orange-500 text-white font-bold py-3 px-2 rounded-md hover:bg-orange-600 transition-colors duration-200 text-base"
           >
            Forced
           </button>
           <button
            onClick={() => dispatch({ type: 'AWARD_RALLY_START', payload: { reason: 'Unforced Error', timestamp } })}
            className="bg-red-500 text-white font-bold py-3 px-2 rounded-md hover:bg-red-600 transition-colors duration-200 text-base"
           >
            Unforced
           </button>
        </div>
      </div>
    );
  };
  
  const renderMainContent = () => {
    if (state.matchOver) {
      return (
        <div className="text-center">
          <h2 className="text-2xl font-bold text-tennis-ball">Match Over!</h2>
          <p className="text-xl mt-2">Team {state.winner} wins!</p>
          <button
              onClick={handleFinish}
              className="mt-6 bg-tennis-ball text-court-bg font-bold py-2 px-6 rounded-md hover:bg-opacity-80 transition-colors duration-200"
            >
              Finalise & Save Match
          </button>
        </div>
      );
    }
    
    switch (state.pointState) {
        case 'selectingServer':
            return <ServerSelection dispatch={dispatch} team1={state.team1} team2={state.team2} stage="first" />;
        case 'selectingSecondServer':
            const receivingTeam = state.team1.isServing ? state.team2 : state.team1;
            return <ServerSelection dispatch={dispatch} team1={state.team1} team2={state.team2} stage="second" selectingTeam={receivingTeam} />;
        case 'attributingRally':
            return <StatInput state={state} dispatch={dispatch} />;
        case 'scoring':
            return renderScoringControls();
        default:
            return null;
    }
  }

  const renderHistoryLog = () => (
      <Card className="flex flex-col flex-grow min-h-[300px] overflow-hidden">
        <h3 className="text-lg font-bold text-center mb-2 text-tennis-ball">Point History</h3>
        <div className="flex-grow overflow-y-auto pr-2 text-sm">
            {state.pointHistory.length > 0 ? (
                <ul className="space-y-2">
                    {[...state.pointHistory].reverse().map(p => (
                        <li key={p.id} className="bg-court-bg p-3 rounded-md">
                            <div className="flex justify-between items-start">
                                <div className="flex-grow">
                                    <p className="font-semibold">
                                        <span className="text-secondary-text">Server: {playerMap.get(p.serverStats.playerId)}</span>
                                        <span className="text-primary-text font-mono ml-2">{p.score}</span>
                                    </p>
                                    <p className="text-primary-text">{p.description}</p>
                                </div>
                                {p.timestamp !== undefined && (
                                    <span className="text-xs bg-court-lines px-2 py-1 rounded text-secondary-text ml-2">
                                        {Math.floor(p.timestamp / 60)}:{(Math.floor(p.timestamp % 60)).toString().padStart(2, '0')}
                                    </span>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
            <p className="text-center text-secondary-text mt-4">No points played yet.</p>
            )}
        </div>
      </Card>
  );

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column (8/12) - Main Visuals: Scoreboard, Video, Stats */}
          <div className="lg:col-span-8 flex flex-col gap-6">
              <Scoreboard state={state} />
              {renderVideoPlayer()}
              <StatSummary state={state} />
          </div>

          {/* Right Column (4/12) - Interactive: Controls, History, Actions */}
          <div className="lg:col-span-4 flex flex-col gap-4 lg:sticky lg:top-4 h-full">
               
               {/* Controls Card */}
               <Card className="p-4 shadow-xl border border-court-lines border-opacity-30">
                  {renderMainContent()}
               </Card>
               
               {/* Action Buttons */}
               <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleUndo}
                    disabled={state.history.length === 0 || state.pointState !== 'scoring' || state.matchOver}
                    className="bg-court-lines text-primary-text font-semibold py-3 rounded-md hover:bg-opacity-80 transition-colors disabled:opacity-50"
                  >
                    Undo
                  </button>
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="bg-blue-600 text-white font-semibold py-3 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    {showHistory ? 'Hide Logs' : 'Show Logs'}
                  </button>
                  <button
                    onClick={onAbandon}
                    className="bg-red-600 text-white font-semibold py-3 rounded-md hover:bg-red-700 transition-colors"
                  >
                    Abandon
                  </button>
                  <button
                    onClick={() => setShowDebugLog(!showDebugLog)}
                    className="bg-purple-600 text-white font-semibold py-3 rounded-md hover:bg-purple-700 transition-colors"
                  >
                    Debug
                  </button>
               </div>

               <button
                  onClick={() => onSaveAndExit(videoFileName)}
                  disabled={state.matchOver}
                  className="w-full bg-green-600 text-white font-semibold py-4 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 text-lg shadow-lg"
                >
                  Save & Exit Match
               </button>

               {/* History Panel */}
               {showHistory && renderHistoryLog()}

               {showDebugLog && (
                 <Card className="flex flex-col max-h-60">
                    <h3 className="text-sm font-bold text-center mb-2 text-tennis-ball">Debug Log</h3>
                    <div className="flex-grow overflow-y-auto pr-2 text-xs font-mono bg-court-bg p-2 rounded">
                        {debugLog.length > 0 ? (
                            <ul className="space-y-1">
                                {[...debugLog].reverse().map((log, index) => (
                                    <li key={index} className="whitespace-pre-wrap">{log}</li>
                                ))}
                            </ul>
                        ) : <p className="text-center text-secondary-text">Log empty.</p>}
                    </div>
                </Card>
               )}
          </div>
      </div>
    </div>
  );
};

export default MatchScreen;
