
import React, { useMemo } from 'react';
import { MatchRecord } from '../types';
import Card from './common/Card';

interface ServeReturnAnalysisProps {
    match: MatchRecord;
}

const ServeReturnAnalysis: React.FC<ServeReturnAnalysisProps> = ({ match }) => {
    
    // Process Data
    const analysis = useMemo(() => {
        const allPlayers = [...match.team1.players, ...match.team2.players];
        const stats = new Map(allPlayers.map(p => [p.id, { 
            name: p.name,
            totalServes: 0,
            aces: 0,
            unreturned: 0, // Forced Return Errors
            returnErrors: 0, // Unforced Return Errors
            serviceGames: 0
        }]));

        let previousWasGameEnd = true; // Start of match counts as a new game start

        match.pointHistory.forEach(log => {
            const serverId = log.serverStats.playerId;
            const pStats = stats.get(serverId);
            
            if (pStats) {
                // Count every point as a serve point
                pStats.totalServes++;

                // Count Service Games
                // If the previous point ended a game (or it's the start), this is a new game.
                // We exclude tiebreaks from "Service Games" count (approximated by checking score format).
                // Standard game scores contain "15", "30", "40", "Ad" or "Game". 
                // Tiebreak scores are usually integers like "1-0".
                if (previousWasGameEnd) {
                    const isStandardGameScore = log.score.includes('15') || log.score.includes('30') || log.score.includes('40') || log.score.includes('Ad') || log.score === 'Game';
                    if (isStandardGameScore) {
                        pStats.serviceGames++;
                    }
                }
                
                // Track stats
                if (log.serverStats.isAce) {
                    pStats.aces++;
                } else if (log.rallyStats && log.rallyStats.isReturnEvent) {
                    if (log.rallyStats.outcome === 'Forced Error') {
                        pStats.unreturned++;
                    } else if (log.rallyStats.outcome === 'Unforced Error') {
                        pStats.returnErrors++;
                    }
                }
            }
            
            // Check if this point resulted in a game or set end
            previousWasGameEnd = log.score === 'Game' || log.score.includes('(Set)');
        });

        return Array.from(stats.values()).map(s => {
            const freePoints = s.aces + s.unreturned + s.returnErrors;
            const total = s.totalServes;
            const effectiveness = total > 0 ? (freePoints / total) * 100 : 0;
            
            return {
                ...s,
                freePoints,
                effectiveness,
                freePointPercentStr: `${Math.round(effectiveness)}%`
            };
        });

    }, [match]);

    // Stacked Bar Chart Settings
    const width = 600;
    const height = 300; 
    const margin = { top: 40, right: 140, bottom: 20, left: 100 }; 
    const chartWidth = width - margin.left - margin.right;
    
    // Calculate max serves to scale the bars proportionally to volume
    const maxServes = Math.max(...analysis.map(p => p.totalServes), 1);

    const barHeight = 30;
    const barGap = 20;

    return (
        <Card className="flex flex-col items-center h-full">
            <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-tennis-ball">Serve Effectiveness</h3>
                <p className="text-secondary-text text-xs">Bars lengths are proportional to total number of serves</p>
            </div>
            
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                <g transform={`translate(${margin.left}, ${margin.top})`}>
                    
                    {analysis.map((player, i) => {
                        const y = i * (barHeight + barGap);
                        
                        if (player.totalServes === 0) {
                             return (
                                <g key={player.name} transform={`translate(0, ${y})`}>
                                     <text x="-10" y={barHeight / 2} dy=".32em" textAnchor="end" fill="#e2e8f0" fontSize="12" fontWeight="bold">{player.name}</text>
                                     <rect width={10} height={barHeight} fill="#2d3748" rx="4" />
                                     <text x={20} y={barHeight / 2} dy=".32em" textAnchor="start" fill="#718096" fontSize="10">0 Serves</text>
                                </g>
                             )
                        }

                        // Scale based on MAX serves
                        const scale = chartWidth / maxServes;
                        
                        const wAce = player.aces * scale;
                        const wForced = player.unreturned * scale;
                        const wUnforced = player.returnErrors * scale;
                        const rallyCount = player.totalServes - player.freePoints;
                        const wRally = rallyCount * scale;

                        return (
                            <g key={player.name} transform={`translate(0, ${y})`}>
                                {/* Player Name */}
                                <text x="-10" y={barHeight / 2} dy=".32em" textAnchor="end" fill="#e2e8f0" fontSize="12" fontWeight="bold">{player.name}</text>
                                
                                {/* 1. Ace Bar */}
                                <rect x={0} y={0} width={wAce} height={barHeight} fill="#22c55e">
                                     <title>Aces: {player.aces}</title>
                                </rect>
                                {wAce > 15 && <text x={wAce/2} y={barHeight/2} dy=".32em" textAnchor="middle" fill="#1a202c" fontSize="10" fontWeight="bold">{player.aces}</text>}

                                {/* 2. Forced (Unreturned) Bar */}
                                <rect x={wAce} y={0} width={wForced} height={barHeight} fill="#f97316">
                                     <title>Forced Return Errors: {player.unreturned}</title>
                                </rect>
                                {wForced > 15 && <text x={wAce + wForced/2} y={barHeight/2} dy=".32em" textAnchor="middle" fill="#1a202c" fontSize="10" fontWeight="bold">{player.unreturned}</text>}
                                
                                {/* 3. Unforced (Return Error) Bar */}
                                <rect x={wAce + wForced} y={0} width={wUnforced} height={barHeight} fill="#ef4444">
                                     <title>Unforced Return Errors: {player.returnErrors}</title>
                                </rect>
                                {wUnforced > 15 && <text x={wAce + wForced + wUnforced/2} y={barHeight/2} dy=".32em" textAnchor="middle" fill="#1a202c" fontSize="10" fontWeight="bold">{player.returnErrors}</text>}
                                
                                {/* 4. Rally Started Bar (Remainder) */}
                                <rect x={wAce + wForced + wUnforced} y={0} width={wRally} height={barHeight} fill="#2d3748" stroke="#4a5568" strokeOpacity="0.5">
                                     <title>Rally Started: {rallyCount}</title>
                                </rect>
                                {wRally > 60 && (
                                    <text x={wAce + wForced + wUnforced + wRally/2} y={barHeight/2} dy=".32em" textAnchor="middle" fill="#a0aec0" fontSize="10">
                                        Rally ({rallyCount})
                                    </text>
                                )}
                                
                                {/* STATS Labels (Right Side) */}
                                <text x={wAce + wForced + wUnforced + wRally + 8} y={barHeight / 2} dy=".32em" textAnchor="start" fontSize="12" fontWeight="bold">
                                    <tspan fill="#e2e8f0">{player.freePointPercentStr} Free</tspan>
                                    <tspan fill="#718096" fontSize="8" dx="5">({player.serviceGames} Games Served)</tspan>
                                </text>
                            </g>
                        );
                    })}
                </g>
            </svg>
            
            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-4 mt-2 text-xs">
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded"></div><span>Ace</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-orange-500 rounded"></div><span>Unreturned</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded"></div><span>Return Error</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-gray-700 border border-gray-600 rounded"></div><span>Rally Started</span></div>
            </div>
        </Card>
    );
};

export default ServeReturnAnalysis;
