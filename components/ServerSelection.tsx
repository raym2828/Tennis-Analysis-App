import React from 'react';
import { Action, Team } from '../types';

interface ServerSelectionProps {
    dispatch: React.Dispatch<Action>;
    team1: Team;
    team2: Team;
    stage: 'first' | 'second';
    selectingTeam?: Team; // Only provided for stage 'second'
}

const ServerSelection: React.FC<ServerSelectionProps> = ({ dispatch, team1, team2, stage, selectingTeam }) => {

    const handleSelectServer = (playerId: number) => {
        if (stage === 'first') {
            dispatch({ type: 'SET_FIRST_SERVER', payload: { serverId: playerId } });
        } else {
            dispatch({ type: 'CONFIRM_SECOND_SERVER', payload: { serverId: playerId } });
        }
    };

    if (stage === 'second' && selectingTeam) {
        return (
            <div className="space-y-6">
                <h2 className="text-xl font-bold text-tennis-ball text-center">
                    Who is serving for the receiving team?
                </h2>
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-primary-text border-b border-court-lines pb-2">
                        {selectingTeam.players[0].name} / {selectingTeam.players[1].name}
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        {selectingTeam.players.map(p => (
                            <button 
                                key={p.id} 
                                onClick={() => handleSelectServer(p.id)}
                                className="p-3 rounded-md font-semibold truncate bg-court-bg hover:bg-tennis-ball hover:text-court-bg transition-colors"
                            >
                                {p.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }


    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-tennis-ball text-center">
                Who is serving first for this set?
            </h2>
            
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-primary-text border-b border-court-lines pb-2">Team 1</h3>
                <div className="grid grid-cols-2 gap-3">
                    {team1.players.map(p => (
                        <button 
                            key={p.id} 
                            onClick={() => handleSelectServer(p.id)}
                            className="p-3 rounded-md font-semibold truncate bg-court-bg hover:bg-tennis-ball hover:text-court-bg transition-colors"
                        >
                            {p.name}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-primary-text border-b border-court-lines pb-2">Team 2</h3>
                 <div className="grid grid-cols-2 gap-3">
                    {team2.players.map(p => (
                        <button 
                            key={p.id} 
                            onClick={() => handleSelectServer(p.id)}
                            className="p-3 rounded-md font-semibold truncate bg-court-bg hover:bg-tennis-ball hover:text-court-bg transition-colors"
                        >
                            {p.name}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ServerSelection;