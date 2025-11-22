import React from 'react';
import { GameState, Player } from '../types';
import Card from './common/Card';

interface StatSummaryProps {
  state: GameState;
}

const StatSummary: React.FC<StatSummaryProps> = ({ state }) => {
  const allPlayers = [...state.team1.players, ...state.team2.players];

  if (!allPlayers[0]?.name) return null;

  const getStatPercent = (val: number, total: number) => {
    if (total === 0) return '0%';
    return `${Math.round((val / total) * 100)}%`;
  }

  const renderPlayerRow = (player: Player) => {
    const stats = state.stats[player.id];
    return (
       <tr key={player.id} className="border-b border-court-lines last:border-b-0">
          <td className="py-3 px-2 text-left font-bold">{player.name}</td>
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
    )
  }

  return (
    <Card>
      <h2 className="text-xl font-bold text-center mb-4">Player Statistics</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-center whitespace-nowrap">
          <thead className="border-b-2 border-court-lines">
            <tr>
              <th className="py-2 px-2 font-semibold text-left">Player</th>
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
            {renderPlayerRow(state.team1.players[0])}
            {renderPlayerRow(state.team1.players[1])}
            <tr className="border-b-2 border-tennis-ball"><td colSpan={11}></td></tr>
            {renderPlayerRow(state.team2.players[0])}
            {renderPlayerRow(state.team2.players[1])}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default StatSummary;