
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
        forcedErrors: match.playerStats[p.profileId]?.forcedErrors ?? 0,
    }));

    const width = 500;
    const height = 220;
    const margin = { top: 20, right: 20, bottom: 60, left: 40 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const maxValue = Math.max(...playerStats.flatMap(p => [p.winners, p.unforcedErrors, p.forcedErrors]), 5);
    const yScale = (val: number) => chartHeight - (val / maxValue) * chartHeight;

    const barWidth = 15;
    const groupPadding = 30;
    const totalGroupWidth = (barWidth * 3) + 10;
    const groupSpacing = (chartWidth - (totalGroupWidth * 4)) / 3;

    const Legend = () => (
        <div className="flex justify-center flex-wrap gap-4 mt-4 text-sm">
            <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-sm bg-green-500"></div>
                <span>Winners</span>
            </div>
            <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-sm bg-red-500"></div>
                <span>Unforced Errors</span>
            </div>
            <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-sm border border-orange-500 border-dashed bg-orange-500 bg-opacity-40"></div>
                <span>Forced Errors</span>
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
                                <text x={barWidth / 2} y={yScale(d.winners) - 5} fill="#e2e8f0" textAnchor="middle" fontSize="10" fontWeight="bold">{d.winners}</text>

                                {/* Unforced Errors Bar */}
                                <rect
                                    x={barWidth + 5}
                                    y={yScale(d.unforcedErrors)}
                                    width={barWidth}
                                    height={chartHeight - yScale(d.unforcedErrors)}
                                    fill="#ef4444"
                                >
                                    <title>{d.name} - Unforced Errors: {d.unforcedErrors}</title>
                                </rect>
                                <text x={barWidth + 5 + barWidth / 2} y={yScale(d.unforcedErrors) - 5} fill="#e2e8f0" textAnchor="middle" fontSize="10" fontWeight="bold">{d.unforcedErrors}</text>

                                {/* Forced Errors Bar (Faded/Dotted) */}
                                <rect
                                    x={(barWidth * 2) + 10}
                                    y={yScale(d.forcedErrors)}
                                    width={barWidth}
                                    height={chartHeight - yScale(d.forcedErrors)}
                                    fill="rgba(249, 115, 22, 0.4)" // Orange with opacity
                                    stroke="#f97316"
                                    strokeWidth="1"
                                    strokeDasharray="3,2"
                                >
                                    <title>{d.name} - Forced Errors: {d.forcedErrors}</title>
                                </rect>
                                <text x={(barWidth * 2) + 10 + barWidth / 2} y={yScale(d.forcedErrors) - 5} fill="#e2e8f0" textAnchor="middle" fontSize="10" fontWeight="bold">{d.forcedErrors}</text>

                                {/* Player Name Label */}
                                <text
                                    x={totalGroupWidth / 2}
                                    y={chartHeight + 15}
                                    textAnchor="middle"
                                    fill="#a0aec0"
                                    fontSize="11"
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
