import React, { useState, useMemo } from 'react';
import { GameState, Action, Player, RallyAttributionPayload } from '../types';

interface StatInputProps {
    state: GameState & {isMatchStarted: true};
    dispatch: React.Dispatch<Action>;
}

const StatInput: React.FC<StatInputProps> = ({ state, dispatch }) => {
    const { pointEndReason, team1, team2, serverIndex } = state;

    const [endingPlayer, setEndingPlayer] = useState<Player | null>(null);
    const [wasAtNet, setWasAtNet] = useState(false);

    const playerOptions = useMemo(() => {
        return [...team1.players, ...team2.players];
    }, [team1, team2]);

    const serverTeamId = serverIndex < 2 ? 1 : 2;
    const selectedPlayerTeamId = endingPlayer ? (endingPlayer.id < 2 ? 1 : 2) : null;
    const isReceiverSelected = selectedPlayerTeamId !== null && selectedPlayerTeamId !== serverTeamId;

    const getReturnButtonText = () => {
        switch(pointEndReason) {
            case 'Winner': return 'Confirm as Return Winner';
            case 'Forced Error': return 'Confirm as Unreturned Serve';
            case 'Unforced Error': return 'Confirm as Return Error';
            default: return '';
        }
    }

    const handleSubmit = (isReturnEvent: boolean) => {
        if (!endingPlayer) {
            alert("Please select the player responsible.");
            return;
        }

        const payload: RallyAttributionPayload = {
            pointEndingPlayer: endingPlayer,
            wasAtNet,
            isReturnEvent,
        };
        dispatch({ type: 'ATTRIBUTE_RALLY', payload });
    };

    const handleCancel = () => dispatch({ type: 'CANCEL_POINT' });

    if (!pointEndReason) return null;

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-tennis-ball text-center">
                Who Hit the {pointEndReason}?
            </h2>
            
            {/* Ending Player */}
            <div className="space-y-2">
                 <label className="font-semibold text-lg">1. Player Responsible</label>
                 <div className="grid grid-cols-2 gap-2">
                    {playerOptions.map(p => (
                        <button key={p.id} onClick={() => setEndingPlayer(p)} className={`p-3 rounded-md font-semibold truncate ${endingPlayer?.id === p.id ? 'bg-tennis-ball text-court-bg' : 'bg-court-bg'}`}>{p.name}</button>
                    ))}
                 </div>
            </div>

            {/* At Net Checkbox */}
            <div className="flex items-center space-x-3">
                <input type="checkbox" id="at-net" checked={wasAtNet} onChange={(e) => setWasAtNet(e.target.checked)} className="h-5 w-5 rounded bg-court-bg border-court-lines text-tennis-ball focus:ring-tennis-ball"/>
                <label htmlFor="at-net" className="font-semibold text-lg">Did this player finish the point at the net?</label>
            </div>


            {/* Actions */}
            <div className="flex justify-between items-center pt-4">
                <button onClick={handleCancel} className="text-secondary-text hover:text-primary-text underline">Cancel</button>
                <div className="flex items-center gap-3">
                    {isReceiverSelected && (
                        <button onClick={() => handleSubmit(true)} className="bg-court-lines text-primary-text font-bold py-3 px-6 rounded-md hover:bg-opacity-80 transition-colors duration-200">
                           {getReturnButtonText()}
                        </button>
                    )}
                    <button onClick={() => handleSubmit(false)} className="bg-tennis-ball text-court-bg font-bold py-3 px-8 rounded-md hover:bg-opacity-80 transition-colors duration-200">
                        Confirm Point
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StatInput;