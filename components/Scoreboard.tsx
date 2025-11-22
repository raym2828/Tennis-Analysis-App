import React from 'react';
import { GameState } from '../types';
import Card from './common/Card';

interface ScoreboardProps {
  state: GameState;
}

const pointMap: { [key: number]: string } = {
  0: '0',
  1: '15',
  2: '30',
  3: '40',
};

const Scoreboard: React.FC<ScoreboardProps> = ({ state }) => {
  const { team1, team2, isTieBreak } = state;
  
  const getPointDisplay = (team1Points: number, team2Points: number, isServing: boolean) => {
    if (isTieBreak) {
      return team1Points;
    }
    if (team1Points >= 3 && team2Points >= 3) {
      if (team1Points === team2Points) return 'Deuce';
      if (team1Points > team2Points) return 'Ad';
      // Return a transparent "Ad" for alignment when opponent has advantage
      if (team2Points > team1Points) return <span className="text-transparent">Ad</span>;
    }
    return pointMap[team1Points];
  };

  const getPointDisplayTeam2 = (team1Points: number, team2Points: number, isServing: boolean) => {
      if (isTieBreak) {
        return team2Points;
      }
      if (team1Points >= 3 && team2Points >= 3) {
        if (team1Points === team2Points) return 'Deuce';
        if (team2Points > team1Points) return 'Ad';
        if (team1Points > team2Points) return <span className="text-transparent">Ad</span>;
      }
      return pointMap[team2Points];
  }


  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-center text-lg md:text-xl">
          <thead className="border-b-2 border-court-lines">
            <tr>
              <th className="py-2 px-2 md:px-4 font-semibold text-left">Team</th>
              {team1.games.map((_, index) => (
                 <th key={index} className="py-2 px-2 md:px-4 font-semibold">Set {index + 1}</th>
              ))}
              <th className="py-2 px-2 md:px-4 font-bold text-tennis-ball">{isTieBreak ? 'Tiebreak' : 'Points'}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-court-lines">
              <td className="py-3 px-2 md:px-4 text-left font-bold relative">
                 {team1.isServing && <span className="absolute left-[-12px] top-1/2 -translate-y-1/2 text-tennis-ball text-2xl">●</span>}
                 {team1.players[0].name} / {team1.players[1].name}
              </td>
              {team1.games.map((games, index) => (
                <td key={index} className="py-3 px-2 md:px-4 font-mono">{games}</td>
              ))}
              <td className="py-3 px-2 md:px-4 font-bold font-mono text-tennis-ball">
                {getPointDisplay(team1.points, team2.points, team1.isServing)}
              </td>
            </tr>
            <tr>
              <td className="py-3 px-2 md:px-4 text-left font-bold relative">
                {team2.isServing && <span className="absolute left-[-12px] top-1/2 -translate-y-1/2 text-tennis-ball text-2xl">●</span>}
                {team2.players[0].name} / {team2.players[1].name}
              </td>
              {team2.games.map((games, index) => (
                <td key={index} className="py-3 px-2 md:px-4 font-mono">{games}</td>
              ))}
              <td className="py-3 px-2 md:px-4 font-bold font-mono text-tennis-ball">
                 {getPointDisplayTeam2(team1.points, team2.points, team2.isServing)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default Scoreboard;