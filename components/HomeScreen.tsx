
import React, { useRef, useState } from 'react';
import Card from './common/Card';
import { PlayerProfile, MatchRecord } from '../types';
import { parseMatchCSV } from '../utils/analytics';

interface HomeScreenProps {
  setView: (view: 'home' | 'setup' | 'match') => void;
  profiles: PlayerProfile[];
  matchHistory: MatchRecord[];
  onViewMatch: (match: MatchRecord) => void;
  onResumeMatch: (match: MatchRecord) => void;
  addMatch: (match: MatchRecord) => void;
  addProfile: (name: string) => PlayerProfile;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ 
  setView, 
  profiles, 
  matchHistory, 
  onViewMatch, 
  onResumeMatch,
  addMatch,
  addProfile
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importedMatch = await parseMatchCSV(text, profiles, addProfile);
      addMatch(importedMatch);
      alert("Match imported successfully!");
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error(err);
      alert("Failed to import CSV. Ensure format is correct.");
    }
  };
  
  const toggleMenu = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (activeMenuId === id) setActiveMenuId(null);
      else setActiveMenuId(id);
  };

  // Close menu when clicking outside
  React.useEffect(() => {
    const closeMenu = () => setActiveMenuId(null);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <div className="text-center flex flex-col gap-3 items-center">
          <h2 className="text-2xl font-bold text-tennis-ball mb-2">Main Menu</h2>
          <button
            onClick={() => setView('setup')}
            className="w-full max-w-sm bg-tennis-ball text-court-bg font-bold py-3 px-4 rounded-md hover:bg-opacity-80 transition-colors duration-200 text-lg"
          >
            Start New Match
          </button>
          
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
          />
          <button
            onClick={handleImportClick}
            className="w-full max-w-sm bg-court-lines text-primary-text font-bold py-3 px-4 rounded-md hover:bg-opacity-80 transition-colors duration-200"
          >
            Import Match (CSV)
          </button>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="flex flex-col">
          <h3 className="text-xl font-bold text-center mb-4 text-tennis-ball">Player Profiles</h3>
          <div className="flex-grow overflow-y-auto max-h-96 pr-2">
            {profiles.length > 0 ? (
              <ul className="space-y-2">
                {profiles.map(p => (
                  <li key={p.id} className="bg-court-bg p-3 rounded-md flex justify-between items-center">
                    <span className="font-semibold">{p.name}</span>
                    <span className="text-sm text-secondary-text">{p.wins}W / {p.losses}L</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-center text-secondary-text">No player profiles found. Start a match to create one!</p>
            )}
          </div>
        </Card>
        
        <Card className="flex flex-col">
          <h3 className="text-xl font-bold text-center mb-4 text-tennis-ball">Match History</h3>
          <div className="flex-grow overflow-y-auto max-h-96 pr-2">
            {matchHistory.length > 0 ? (
                <ul className="space-y-2 pb-16"> 
                    {matchHistory.map(m => (
                        <li key={m.id} className="relative group">
                          <div 
                            className="w-full bg-court-bg p-3 rounded-md text-sm text-left flex justify-between items-start"
                          >
                            <div className="flex-grow" onClick={() => onViewMatch(m)}>
                                <p className="font-semibold cursor-pointer hover:text-tennis-ball">{m.date}</p>
                                <p className="text-secondary-text truncate">{m.team1.players.map(p=>p.name).join(' / ')} vs {m.team2.players.map(p=>p.name).join(' / ')}</p>
                                <div className="flex items-center mt-1 gap-2">
                                    <p className="font-mono text-primary-text">Score: {m.team1.score?.join('-') || 'N/A'} / {m.team2.score?.join('-') || 'N/A'}</p>
                                    {typeof m.winner !== 'undefined' ? (
                                        <span className="text-xs font-bold text-tennis-ball px-2 py-1 rounded-full bg-court-bg-light">Team {m.winner} Won</span>
                                    ) : (
                                        <span className="text-xs font-semibold text-yellow-400 px-2 py-1 rounded-full bg-court-bg-light">In Progress</span>
                                    )}
                                </div>
                            </div>
                            
                            <div className="relative">
                                <button onClick={(e) => toggleMenu(e, m.id)} className="p-1 hover:bg-court-lines rounded-full transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-secondary-text" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                    </svg>
                                </button>
                                {activeMenuId === m.id && (
                                    <div className="absolute right-0 top-8 z-20 w-40 bg-court-lines rounded-md shadow-xl border border-gray-600 overflow-hidden">
                                        <button 
                                            onClick={() => onViewMatch(m)}
                                            className="w-full text-left px-4 py-2 hover:bg-court-bg text-primary-text transition-colors"
                                        >
                                            View Stats
                                        </button>
                                        {m.lastGameState && (
                                            <button 
                                                onClick={() => onResumeMatch(m)}
                                                className="w-full text-left px-4 py-2 hover:bg-court-bg text-green-400 transition-colors"
                                            >
                                                Continue Match
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                          </div>
                        </li>
                    ))}
                </ul>
            ) : (
              <p className="text-center text-secondary-text">No completed matches yet.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default HomeScreen;
