import React from 'react';
import { MatchRecord, PlayerStats } from '../types';

interface PointBreakdownChartProps {
    match: MatchRecord;
    team1Stats: PlayerStats;
    team2Stats: PlayerStats;
}

const PointBreakdownChart: React.FC<PointBreakdownChartProps> = ({ match, team1Stats, team2Stats }) => {
    
    const team1Winners = team1Stats.winners + team1Stats.aces;
    const team1FromErrors = team2Stats.unforcedErrors + team2Stats.forcedErrors + team2Stats.doubleFaults;

    const team2Winners = team2Stats.winners + team2Stats.aces;
    const team2FromErrors = team1Stats.unforcedErrors + team1Stats.forcedErrors + team1Stats.doubleFaults;

    const data = [
        { team: `Team 1 (${match.team1.players.map(p => p.name.split(' ')[0]).join('/')})`, winners: team1Winners, fromErrors: team1FromErrors },
        { team: `Team 2 (${match.team2.players.map(p => p.name.split(' ')[0]).join('/')})`, winners: team2Winners, fromErrors: team2FromErrors },
    ];
    
    const width = 500;
    const height = 200;
    const margin = { top: 20, right: 20, bottom: 50, left: 40 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const maxPoints = Math.max(team1Stats.pointsWon, team2Stats.pointsWon, 10);
    const yScale = (val: number) => chartHeight - (val / maxPoints) * chartHeight;

    const barWidth = 40;
    const groupSpacing = chartWidth / 2;

    const Legend = () => (
        <div className="flex justify-center space-x-6 mt-2 text-sm">
            <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-sm bg-green-500"></div>
                <span>Winners</span>
            </div>
            <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-sm bg-red-500"></div>
                <span>From Opp. Error</span>
            </div>
        </div>
    );

    return (
        <div className="w-full flex flex-col items-center">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                 <g transform={`translate(${margin.left}, ${margin.top})`}>
                    {/* Y Axis */}
                    <line x1="0" y1="0" x2="0" y2={chartHeight} stroke="#4a5568" />
                    {[...Array(5 + 1)].map((_, i) => {
                        const y = chartHeight - (i / 5) * chartHeight;
                        const label = Math.round((i/5) * maxPoints);
                        return (
                             <g key={i} transform={`translate(0, ${y})`}>
                                <line x1="-5" y1="0" x2={chartWidth} y2="0" stroke="#4a5568" strokeDasharray="2,2"/>
                                <text x="-10" dy=".32em" textAnchor="end" fill="#a0aec0" fontSize="10">{label}</text>
                            </g>
                        )
                    })}

                    {/* Bars */}
                    {data.map((d, i) => {
                        const groupX = groupSpacing * (i + 0.5) - (barWidth * 2 + 5)/2;
                        return (
                            <g key={d.team} transform={`translate(${groupX}, 0)`}>
                                {/* Winners Bar */}
                                <rect 
                                    x="0" 
                                    y={yScale(d.winners)} 
                                    width={barWidth} 
                                    height={chartHeight - yScale(d.winners)} 
                                    fill="#22c55e"
                                >
                                    <title>Winners: {d.winners}</title>
                                </rect>
                                <text x={barWidth/2} y={yScale(d.winners) + 15} fill="white" textAnchor="middle" fontSize="12" fontWeight="bold">{d.winners}</text>

                                {/* Errors Bar */}
                                <rect 
                                    x={barWidth + 5} 
                                    y={yScale(d.fromErrors)} 
                                    width={barWidth} 
                                    height={chartHeight - yScale(d.fromErrors)}
                                    fill="#ef4444"
                                >
                                     <title>From Opponent Errors: {d.fromErrors}</title>
                                </rect>
                                <text x={barWidth + 5 + barWidth/2} y={yScale(d.fromErrors) + 15} fill="white" textAnchor="middle" fontSize="12" fontWeight="bold">{d.fromErrors}</text>
                                
                                {/* Team Label */}
                                <text 
                                    x={(barWidth*2 + 5)/2} 
                                    y={chartHeight + 20} 
                                    textAnchor="middle" 
                                    fill="#a0aec0" 
                                    fontSize="12"
                                >
                                    {d.team}
                                </text>
                            </g>
                        )
                    })}
                </g>
            </svg>
            <Legend />
        </div>
    );
};

export default PointBreakdownChart;