import React from 'react';
import { MatchRecord } from '../types';

interface IndividualStatChartProps {
    match: MatchRecord;
}

const IndividualStatChart: React.FC<IndividualStatChartProps> = ({ match }) => {
    const allPlayers = [...match.team1.players, ...match.team2.players];
    const playerStats = allPlayers.map(p => ({
        name: p.name,
        winners: match.playerStats[p.profileId]?.winners ?? 0,
        unforcedErrors: match.playerStats[p.profileId]?.unforcedErrors ?? 0,
    }));

    const width = 500;
    const height = 220;
    const margin = { top: 20, right: 20, bottom: 60, left: 40 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const maxValue = Math.max(...playerStats.flatMap(p => [p.winners, p.unforcedErrors]), 5);
    const yScale = (val: number) => chartHeight - (val / maxValue) * chartHeight;

    const barWidth = 20;
    const groupPadding = 30;
    const totalGroupWidth = (barWidth * 2) + 5;
    const groupSpacing = (chartWidth - (totalGroupWidth * 4)) / 3;

    const Legend = () => (
        <div className="flex justify-center space-x-6 mt-4 text-sm">
            <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-sm bg-green-500"></div>
                <span>Winners</span>
            </div>
            <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-sm bg-red-500"></div>
                <span>Unforced Errors</span>
            </div>
        </div>
    );

    return (
        <div className="w-full flex flex-col items-center">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                <g transform={`translate(${margin.left}, ${margin.top})`}>
                    {/* Y Axis */}
                    <line x1="0" y1="0" x2="0" y2={chartHeight} stroke="#4a5568" />
                    {[...Array(6)].map((_, i) => {
                        const y = chartHeight - (i / 5) * chartHeight;
                        const label = Math.round((i / 5) * maxValue);
                        return (
                            <g key={i} transform={`translate(0, ${y})`}>
                                <line x1="-5" y1="0" x2={chartWidth} y2="0" stroke="#4a5568" strokeDasharray="2,2" />
                                <text x="-10" dy=".32em" textAnchor="end" fill="#a0aec0" fontSize="10">{label}</text>
                            </g>
                        );
                    })}

                    {/* Bars */}
                    {playerStats.map((d, i) => {
                        const groupX = i * (totalGroupWidth + groupSpacing);
                        return (
                            <g key={d.name} transform={`translate(${groupX}, 0)`}>
                                {/* Winners Bar */}
                                <rect
                                    x="0"
                                    y={yScale(d.winners)}
                                    width={barWidth}
                                    height={chartHeight - yScale(d.winners)}
                                    fill="#22c55e"
                                >
                                    <title>{d.name} - Winners: {d.winners}</title>
                                </rect>
                                <text x={barWidth / 2} y={yScale(d.winners) - 5} fill="#e2e8f0" textAnchor="middle" fontSize="12" fontWeight="bold">{d.winners}</text>

                                {/* Errors Bar */}
                                <rect
                                    x={barWidth + 5}
                                    y={yScale(d.unforcedErrors)}
                                    width={barWidth}
                                    height={chartHeight - yScale(d.unforcedErrors)}
                                    fill="#ef4444"
                                >
                                    <title>{d.name} - Unforced Errors: {d.unforcedErrors}</title>
                                </rect>
                                <text x={barWidth + 5 + barWidth / 2} y={yScale(d.unforcedErrors) - 5} fill="#e2e8f0" textAnchor="middle" fontSize="12" fontWeight="bold">{d.unforcedErrors}</text>

                                {/* Player Name Label */}
                                <text
                                    x={(barWidth * 2 + 5) / 2}
                                    y={chartHeight + 15}
                                    textAnchor="middle"
                                    fill="#a0aec0"
                                    fontSize="12"
                                >
                                    {d.name}
                                </text>
                            </g>
                        );
                    })}
                </g>
            </svg>
            <Legend />
        </div>
    );
};

export default IndividualStatChart;