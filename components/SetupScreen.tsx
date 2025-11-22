
import React, { useState, useMemo } from 'react';
import Card from './common/Card';
import { Action, PlayerProfile } from '../types';

interface SetupScreenProps {
  dispatch: React.Dispatch<Action>;
  profiles: PlayerProfile[];
  addProfile: (name: string) => PlayerProfile;
}

const SetupScreen: React.FC<SetupScreenProps> = ({ dispatch, profiles, addProfile }) => {
  // These will hold the final selected profiles.
  const [team1Players, setTeam1Players] = useState<(PlayerProfile | null)[]>([null, null]);
  const [team2Players, setTeam2Players] = useState<(PlayerProfile | null)[]>([null, null]);

  // These will hold the text in the input boxes.
  const [inputValues, setInputValues] = useState<string[]>(['', '', '', '']);

  // This will track which input box is focused to show suggestions.
  const [focusedInput, setFocusedInput] = useState<number | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const allPlayers = [...team1Players, ...team2Players];
    if (allPlayers.some(p => p === null)) {
      alert("Please select or create a player for all four slots.");
      return;
    }

    if (new Set(allPlayers.map(p => p!.id)).size !== 4) {
      alert("Each player in the match must be unique.");
      return;
    }

    dispatch({
      type: 'START_MATCH',
      payload: {
        team1: [
          { id: 0, name: team1Players[0]!.name, profileId: team1Players[0]!.id },
          { id: 1, name: team1Players[1]!.name, profileId: team1Players[1]!.id },
        ],
        team2: [
          { id: 2, name: team2Players[0]!.name, profileId: team2Players[0]!.id },
          { id: 3, name: team2Players[1]!.name, profileId: team2Players[1]!.id },
        ],
      }
    });
  };

  const handleSelectPlayer = (index: number, profile: PlayerProfile) => {
    const newInputValues = [...inputValues];
    newInputValues[index] = profile.name;
    setInputValues(newInputValues);

    if (index < 2) {
      const newTeam1Players = [...team1Players];
      newTeam1Players[index] = profile;
      setTeam1Players(newTeam1Players);
    } else {
      const newTeam2Players = [...team2Players];
      newTeam2Players[index - 2] = profile;
      setTeam2Players(newTeam2Players);
    }
    setFocusedInput(null); // Hide suggestions
  };

  const handleCreateOrSelectOnBlur = (index: number) => {
    const name = inputValues[index].trim();

    // Check if a player is already properly selected for this input
    const currentPlayer = index < 2 ? team1Players[index] : team2Players[index - 2];
    if (currentPlayer && currentPlayer.name === name) {
      setFocusedInput(null);
      return;
    }
    
    // If input is cleared, deselect player
    if (!name) {
       if (index < 2) {
         const newTeam1 = [...team1Players];
         newTeam1[index] = null;
         setTeam1Players(newTeam1);
       } else {
         const newTeam2 = [...team2Players];
         newTeam2[index - 2] = null;
         setTeam2Players(newTeam2);
       }
       setFocusedInput(null);
       return;
    }

    const existingProfile = profiles.find(p => p.name.toLowerCase() === name.toLowerCase());

    if (existingProfile) {
      handleSelectPlayer(index, existingProfile);
    } else {
      const newProfile = addProfile(name);
      handleSelectPlayer(index, newProfile);
    }
  };

  const handleInputChange = (index: number, value: string) => {
    const newInputValues = [...inputValues];
    newInputValues[index] = value;
    setInputValues(newInputValues);

    // If text no longer matches a selected player, deselect them
    const currentProfile = index < 2 ? team1Players[index] : team2Players[index - 2];
    if (currentProfile && currentProfile.name !== value) {
      if (index < 2) {
        const newTeam1Players = [...team1Players];
        newTeam1Players[index] = null;
        setTeam1Players(newTeam1Players);
      } else {
        const newTeam2Players = [...team2Players];
        newTeam2Players[index - 2] = null;
        setTeam2Players(newTeam2Players);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur(); // Trigger the blur handler to create/select player
    }
  };
  
  const filteredProfiles = useMemo(() => {
    if (focusedInput === null || !inputValues[focusedInput]) {
      return [];
    }
    const query = inputValues[focusedInput].toLowerCase();
    const allSelectedIds = [...team1Players, ...team2Players].filter(p => p).map(p => p!.id);
    return profiles.filter(p => 
      !allSelectedIds.includes(p.id) && p.name.toLowerCase().includes(query)
    );
  }, [focusedInput, inputValues, profiles, team1Players, team2Players]);


  const renderPlayerInput = (index: number) => {
    const placeholder = `Player ${index < 2 ? index + 1 : index - 1}`;
    return (
      <div className="relative">
        <input
          type="text"
          placeholder={placeholder}
          value={inputValues[index]}
          onChange={(e) => handleInputChange(index, e.target.value)}
          onFocus={() => setFocusedInput(index)}
          onBlur={() => setTimeout(() => handleCreateOrSelectOnBlur(index), 150)} // Timeout to allow click on suggestion
          onKeyDown={handleKeyDown}
          className="w-full bg-court-bg p-3 rounded-md border border-court-lines focus:outline-none focus:ring-2 focus:ring-tennis-ball"
          autoComplete="off"
          required
        />
        {focusedInput === index && filteredProfiles.length > 0 && (
          <ul className="absolute z-10 w-full bg-court-bg-light border border-court-lines rounded-md mt-1 max-h-40 overflow-y-auto shadow-lg">
            {filteredProfiles.map(p => (
              <li
                key={p.id}
                onClick={() => handleSelectPlayer(index, p)}
                className="p-3 hover:bg-tennis-ball hover:text-court-bg cursor-pointer"
              >
                {p.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <Card className="max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-center mb-6 text-tennis-ball">Setup New Match</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-primary-text border-b border-court-lines pb-2">Team 1</h3>
          {renderPlayerInput(0)}
          {renderPlayerInput(1)}
        </div>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-primary-text border-b border-court-lines pb-2">Team 2</h3>
          {renderPlayerInput(2)}
          {renderPlayerInput(3)}
        </div>
        <button
          type="submit"
          className="w-full bg-tennis-ball text-court-bg font-bold py-3 px-4 rounded-md hover:bg-opacity-80 transition-colors duration-200"
        >
          Start Match
        </button>
      </form>
    </Card>
  );
};

export default SetupScreen;
