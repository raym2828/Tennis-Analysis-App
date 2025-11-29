
import React, { useState, useMemo } from 'react';
import { MatchRecord } from '../types';

interface IndividualStatChartProps {
    match: MatchRecord;
}

type StatFilter = 'all' | 'return' | 'net' | 'serves' | 'groundstrokes';

const IndividualStatChart: React.FC<IndividualStatChartProps> = ({ match }) => {
    const [filter, setFilter] = useState<StatFilter>('all');

    const allPlayers = useMemo(() => [...match.team1.players, ...match.team2.players], [match]);

    const chartData = useMemo(() => {
        const stats = new Map<number, { winners: number; unforcedErrors: number; forcedErrors: number }>();
        allPlayers.forEach(p => {
            stats.set(p.id, { winners: 0, unforcedErrors: 0, forcedErrors: 0 });
        });

        match.pointHistory.forEach(log => {
            const serverId = log.serverStats.playerId;
            const rallyStats = log.rallyStats;

            const addStat = (playerId: number, type: 'winners' | 'unforcedErrors' | 'forcedErrors') => {
                const pStats = stats.get(playerId);
                if (pStats) {
                    pStats[type]++;
                }
            };

            // 1. SERVES (Ace / DF)
            if (filter === 'all' || filter === 'serves') {
                if (log.serverStats.isAce) addStat(serverId, 'winners');
                if (log.serverStats.isDoubleFault) addStat(serverId, 'unforcedErrors');
            }

            // 2. RALLIES
            if (rallyStats) {
                const endingPlayerId = rallyStats.endingPlayerId;
                const isReturn = rallyStats.isReturnEvent;
                const isNet = rallyStats.isAtNet;
                
                let matchesFilter = false;
                if (filter === 'all') matchesFilter = true;
                else if (filter === 'return' && isReturn) matchesFilter = true;
                else if (filter === 'net' && isNet) matchesFilter = true;
                else if (filter === 'groundstrokes' && !isReturn && !isNet) matchesFilter = true;
                
                if (matchesFilter) {
                    if (rallyStats.outcome === 'Winner') addStat(endingPlayerId, 'winners');
                    else if (rallyStats.outcome === 'Unforced Error') addStat(endingPlayerId, 'unforcedErrors');
                    else if (rallyStats.outcome === 'Forced Error') addStat(endingPlayerId, 'forcedErrors');
                }
            }
        });

        return allPlayers.map(p => {
            const playerStats = stats.get(p.id);
            const statsObj = playerStats || { winners: 0, unforcedErrors: 0, forcedErrors: 0 };
            return {
                name: p.name,
                ...statsObj
            };
        });
    }, [match, filter, allPlayers]);


    const width = 600;
    const height = 320; // Reduced height to tighten display
    // Adjusted margins: Less on left (was 80), More on right (was 80) to fix cutoff
    const margin = { top: 30, right: 120, bottom: 60, left: 40 }; 
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Calculate max value based on stacked errors vs winners
    const maxValue = Math.max(...chartData.map(d => Math.max(d.winners, d.unforcedErrors + d.forcedErrors)), 5);
    
    const yScale = (val: number) => chartHeight - (val / maxValue) * chartHeight;

    const barWidth = 14;
    const groupPadding = 30;
    const totalGroupWidth = (barWidth * 2) + 8; // 2 Columns (Winners, Stacked Errors)
    const groupSpacing = (chartWidth - (totalGroupWidth * 4)) / 3;

    const Legend = () => (
        <div className="flex justify-center flex-wrap gap-4 mt-2 text-sm">
            <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-sm bg-green-500"></div>
                <span>Winners</span>
            </div>
            <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-sm border border-orange-500 border-dashed bg-orange-500 bg-opacity-40"></div>
                <span>Forced Errors</span>
            </div>
            <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-sm bg-red-500"></div>
                <span>Unforced Errors</span>
            </div>
        </div>
    );

    return (
        <div className="w-full flex flex-col items-center">
            {/* Filter Tabs */}
            <div className="flex flex-wrap justify-center gap-2 mb-4">
                {[
                    { id: 'all', label: 'All' },
                    { id: 'return', label: 'Returns' },
                    { id: 'net', label: 'At Net' },
                    { id: 'serves', label: 'Serves' },
                    { id: 'groundstrokes', label: 'Game Play' }
                ].map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => setFilter(tab.id as StatFilter)}
                        className={`px-3 py-1 rounded text-xs md:text-sm font-bold transition-colors ${filter === tab.id ? 'bg-tennis-ball text-court-bg' : 'bg-court-lines text-secondary-text hover:text-primary-text'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="w-full overflow-hidden">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" style={{ overflow: 'visible' }}>
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
                        {chartData.map((d, i) => {
                            const groupX = i * (totalGroupWidth + groupSpacing) + (groupSpacing/2);
                            
                            // Stack Calculations
                            const ueHeight = Math.max(0, chartHeight - yScale(d.unforcedErrors));
                            const feHeight = Math.max(0, chartHeight - yScale(d.forcedErrors));
                            // UE is bottom, FE is top
                            const ueY = yScale(d.unforcedErrors);
                            const feY = yScale(d.unforcedErrors + d.forcedErrors);

                            return (
                                <g key={d.name} transform={`translate(${groupX}, 0)`}>
                                    {/* 1. Winners Bar */}
                                    <rect
                                        x="0"
                                        y={yScale(d.winners)}
                                        width={barWidth}
                                        height={Math.max(0, chartHeight - yScale(d.winners))}
                                        fill="#22c55e"
                                    >
                                        <title>{d.name} - Winners: {d.winners}</title>
                                    </rect>
                                    {d.winners > 0 && <text x={barWidth / 2} y={yScale(d.winners) - 5} fill="#e2e8f0" textAnchor="middle" fontSize="9" fontWeight="bold">{d.winners}</text>}

                                    {/* 2. Errors Stack (Unforced at bottom) */}
                                    <rect
                                        x={barWidth + 4}
                                        y={ueY}
                                        width={barWidth}
                                        height={ueHeight}
                                        fill="#ef4444"
                                    >
                                        <title>{d.name} - Unforced Errors: {d.unforcedErrors}</title>
                                    </rect>
                                    {d.unforcedErrors > 0 && ueHeight > 10 && (
                                        <text 
                                            x={barWidth + 4 + barWidth / 2} 
                                            y={ueY + ueHeight / 2} 
                                            dy=".32em" 
                                            textAnchor="middle" 
                                            fill="#ffffff" 
                                            fontSize="9" 
                                            fontWeight="bold"
                                            pointerEvents="none"
                                        >
                                            {d.unforcedErrors}
                                        </text>
                                    )}

                                    {/* 3. Errors Stack (Forced on top) */}
                                    <rect
                                        x={barWidth + 4}
                                        y={feY}
                                        width={barWidth}
                                        height={feHeight}
                                        fill="rgba(249, 115, 22, 0.4)" 
                                        stroke="#f97316"
                                        strokeWidth="1"
                                        strokeDasharray="3,2"
                                    >
                                        <title>{d.name} - Forced Errors: {d.forcedErrors}</title>
                                    </rect>
                                    {d.forcedErrors > 0 && feHeight > 10 && (
                                        <text 
                                            x={barWidth + 4 + barWidth / 2} 
                                            y={feY + feHeight / 2} 
                                            dy=".32em" 
                                            textAnchor="middle" 
                                            fill="#ffffff" 
                                            fontSize="9" 
                                            fontWeight="bold"
                                            pointerEvents="none"
                                        >
                                            {d.forcedErrors}
                                        </text>
                                    )}

                                    {/* Stack Label (Total Errors) */}
                                    {(d.unforcedErrors + d.forcedErrors) > 0 && (
                                        <text x={barWidth + 4 + barWidth / 2} y={feY - 5} fill="#e2e8f0" textAnchor="middle" fontSize="9" fontWeight="bold">
                                            {d.unforcedErrors + d.forcedErrors}
                                        </text>
                                    )}

                                    {/* Player Name Label */}
                                    <text
                                        x={totalGroupWidth / 2}
                                        y={chartHeight + 10}
                                        textAnchor="end"
                                        fill="#a0aec0"
                                        fontSize="12"
                                        fontWeight="bold"
                                        transform={`rotate(-45, ${totalGroupWidth / 2}, ${chartHeight + 10})`}
                                    >
                                        {d.name.split(' ')[0]}
                                    </text>
                                </g>
                            );
                        })}
                    </g>
                </svg>
            </div>
            <Legend />
        </div>
    );
};

export default IndividualStatChart;
