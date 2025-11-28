
import React, { useState, useMemo } from 'react';
import { MatchRecord, PointLog } from '../types';

interface MomentumChartProps {
    match: MatchRecord;
}

interface ChartDataPoint {
    index: number;
    momentum: number;
    log: PointLog;
    isGameWin: boolean;
    isSetWin: boolean;
    gameScore: string; // "3-2"
    setScore: string; // "1-0"
    serverName: string;
}

const MomentumChart: React.FC<MomentumChartProps> = ({ match }) => {
    const { pointHistory, team1, team2 } = match;
    const [hoveredData, setHoveredData] = useState<ChartDataPoint | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    
    // Memoize the data processing to calculate running scores and momentum
    const chartData = useMemo(() => {
        if (!pointHistory || pointHistory.length < 2) return [];

        let currentMomentum = 0;
        let t1Games = 0;
        let t2Games = 0;
        let t1Sets = 0;
        let t2Sets = 0;
        
        const allPlayers = [...team1.players, ...team2.players];
        const playerMap = new Map(allPlayers.map(p => [p.id, p.name]));

        return pointHistory.map((log, index) => {
            // Update Momentum
            currentMomentum += (log.pointWinnerId === 1 ? 1 : -1);

            // Check for Game/Set Wins
            const isGameWin = log.score === 'Game' || log.score.includes('(Set)');
            const isSetWin = log.score.includes('(Set)') || 
                             (isGameWin && index < pointHistory.length - 1 && pointHistory[index+1].set > log.set);

            // Update Running Scores
            if (isGameWin) {
                if (log.pointWinnerId === 1) t1Games++;
                else t2Games++;
            }
            
            // Handle Set Reset logic for display
            const previousLog = index > 0 ? pointHistory[index-1] : null;
            if (previousLog && log.set > previousLog.set) {
                 if (t1Games > t2Games) t1Sets++; else t2Sets++;
                 t1Games = 0;
                 t2Games = 0;
            }
            
            // Server Name
            const serverName = playerMap.get(log.serverStats.playerId) || 'Unknown';

            return {
                index,
                momentum: currentMomentum,
                log,
                isGameWin,
                isSetWin,
                gameScore: `${t1Games}-${t2Games}`,
                setScore: `${t1Sets}-${t2Sets}`,
                serverName
            };
        });
    }, [pointHistory, team1, team2]);

    if (chartData.length === 0) {
        return <p className="text-center text-secondary-text">Not enough data to show momentum.</p>;
    }

    // Chart Dimensions
    const width = 600;
    const height = 250;
    const margin = { top: 30, right: 30, bottom: 40, left: 50 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Scales
    const maxAbsMomentum = Math.max(...chartData.map(d => Math.abs(d.momentum)), 5);
    const yScale = (val: number) => chartHeight / 2 - (val / maxAbsMomentum) * (chartHeight / 2);
    const xScale = (i: number) => (i / (chartData.length - 1)) * chartWidth;
    
    // Calculate step for hover bands
    const stepX = chartData.length > 1 ? xScale(1) - xScale(0) : chartWidth;

    // Generate Path
    const pathData = chartData.map((d, i) => 
        `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.momentum)}`
    ).join(' ');

    const handleMouseMove = (e: React.MouseEvent, data: ChartDataPoint) => {
        const rect = e.currentTarget.getBoundingClientRect();
        // Calculate relative position within the SVG
        // We use the mouse position relative to the whole SVG to position the tooltip
        setTooltipPos({
            x: e.clientX - rect.left, 
            y: e.clientY - rect.top
        });
        setHoveredData(data);
    };

    return (
        <div className="w-full relative" onMouseLeave={() => setHoveredData(null)}>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto bg-court-bg-light rounded-lg border border-court-lines">
                <g transform={`translate(${margin.left}, ${margin.top})`}>
                    
                    {/* Grid Lines */}
                    <line x1="0" y1={chartHeight/2} x2={chartWidth} y2={chartHeight/2} stroke="#4a5568" strokeWidth="1" />
                    <text x={-10} y={chartHeight/2} dy="4" fill="#a0aec0" fontSize="10" textAnchor="end">0</text>
                    
                    {/* Max/Min Labels */}
                    <text x={-10} y={0} dy="4" fill="#a0aec0" fontSize="10" textAnchor="end">+{maxAbsMomentum}</text>
                    <text x={-10} y={chartHeight} dy="4" fill="#a0aec0" fontSize="10" textAnchor="end">-{maxAbsMomentum}</text>

                    {/* Team Labels */}
                    <text x={10} y={-15} fill="#c5f542" fontSize="12" fontWeight="bold">
                        ▲ {team1.players.map(p => p.name.split(' ')[0]).join('/')}
                    </text>
                    <text x={10} y={chartHeight + 25} fill="#e2e8f0" fontSize="12" fontWeight="bold">
                        ▼ {team2.players.map(p => p.name.split(' ')[0]).join('/')}
                    </text>

                    {/* Set Dividers */}
                    {chartData.filter(d => d.isSetWin).map(d => (
                        <g key={`set-${d.index}`}>
                            <line 
                                x1={xScale(d.index)} y1={0} 
                                x2={xScale(d.index)} y2={chartHeight} 
                                stroke="#a0aec0" strokeDasharray="4,4" opacity="0.5" 
                            />
                            <text x={xScale(d.index)} y={chartHeight + 15} textAnchor="middle" fill="#a0aec0" fontSize="10">End Set</text>
                        </g>
                    ))}

                    {/* Momentum Line */}
                    <path d={pathData} fill="none" stroke="#c5f542" strokeWidth="2" />
                    
                    {/* Game Markers */}
                    {chartData.filter(d => d.isGameWin).map(d => (
                         <circle 
                            key={`game-${d.index}`}
                            cx={xScale(d.index)} 
                            cy={yScale(d.momentum)} 
                            r="3" 
                            fill="#ffffff" 
                         />
                    ))}
                    
                    {/* Hover Indicator (The visible dot) */}
                    {hoveredData && (
                        <circle 
                            cx={xScale(hoveredData.index)} 
                            cy={yScale(hoveredData.momentum)} 
                            r="5" 
                            fill="#c5f542" 
                            stroke="white"
                            strokeWidth="2"
                            pointerEvents="none"
                        />
                    )}

                    {/* INVISIBLE HIT BANDS FOR RELIABLE HOVER */}
                    {chartData.map((d, i) => (
                        <rect
                            key={`hit-${i}`}
                            x={xScale(i) - stepX / 2}
                            y={0}
                            width={stepX}
                            height={chartHeight}
                            fill="transparent"
                            onMouseEnter={(e) => handleMouseMove(e, d)}
                            className="cursor-crosshair"
                        />
                    ))}
                </g>
            </svg>

            {/* Tooltip */}
            {hoveredData && (
                <div 
                    className="absolute z-10 bg-gray-800/90 backdrop-blur-sm text-primary-text text-xs p-3 rounded shadow-xl border border-gray-600 pointer-events-none"
                    style={{ 
                        left: Math.min(width - 150, Math.max(0, tooltipPos.x + margin.left + 10)),
                        top: Math.max(0, tooltipPos.y + margin.top - 80)
                    }}
                >
                    <div className="font-bold text-tennis-ball mb-1">Point #{hoveredData.index + 1}</div>
                    <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
                        <span className="text-secondary-text">Server:</span>
                        <span>{hoveredData.serverName}</span>
                        
                        <span className="text-secondary-text">Outcome:</span>
                        <span>{hoveredData.log.score === 'Game' ? 'Game Won' : hoveredData.log.score}</span>
                        
                        <span className="text-secondary-text">Details:</span>
                        <span className="truncate max-w-[150px]">{hoveredData.log.description}</span>
                        
                        <span className="text-secondary-text">Games:</span>
                        <span className="font-mono">{hoveredData.gameScore} (Set {hoveredData.log.set + 1})</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MomentumChart;
