
import React from 'react';

export interface PerformanceData {
  name: string;
  winners: number;
  errors: number;
}

interface DonutChartProps {
    data: PerformanceData[];
    filterType: 'all' | 'serves' | 'returns';
}

const DonutSegment: React.FC<{
    cx: number; cy: number; radius: number;
    startAngle: number; endAngle: number;
    color: string;
    value: number; 
}> = ({ cx, cy, radius, startAngle, endAngle, color, value }) => {
    
    const dAngle = endAngle - startAngle;
    
    if (Math.abs(dAngle) < 0.001) return null;

    // 1. Draw Arc
    let d = "";
    const isFullCircle = Math.abs(dAngle) >= 2 * Math.PI - 0.001;
    
    if (isFullCircle) {
         d = [
            "M", cx + radius, cy,
            "A", radius, radius, 0, 1, 0, cx - radius, cy,
            "A", radius, radius, 0, 1, 0, cx + radius, cy
         ].join(" ");
    } else {
        const start = {
            x: cx + radius * Math.cos(startAngle),
            y: cy + radius * Math.sin(startAngle)
        };
        const end = {
            x: cx + radius * Math.cos(endAngle),
            y: cy + radius * Math.sin(endAngle)
        };
        const largeArcFlag = dAngle > Math.PI ? "1" : "0";
        d = [
            "M", start.x, start.y,
            "A", radius, radius, 0, largeArcFlag, 1, end.x, end.y
        ].join(" ");
    }

    // 2. Calculate Label Position (Center of arc)
    const midAngle = startAngle + dAngle / 2;
    // Position text in center of stroke
    const textX = cx + radius * Math.cos(midAngle);
    const textY = cy + radius * Math.sin(midAngle);

    // Only show label if slice is big enough to hold it (~15 degrees)
    const showLabel = value > 0 && dAngle > 0.25;

    return (
        <>
            <path d={d} fill="none" stroke={color} strokeWidth="30" />
            {showLabel && (
                <text 
                    x={textX} 
                    y={textY} 
                    dy="0.35em" 
                    textAnchor="middle" 
                    fill="#ffffff"
                    fontSize="12" 
                    fontWeight="bold"
                    pointerEvents="none"
                    style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.5)' }}
                >
                    {value}
                </text>
            )}
        </>
    );
};


const PerformanceDonutChart: React.FC<DonutChartProps> = ({ data, filterType }) => {
    const width = 500;
    const height = 250;
    const chartRadius = 70;

    const Legend = () => {
        let winnerLabel = "Winners";
        let errorLabel = "Unforced Errors";
        if (filterType === 'serves') {
            winnerLabel = "Aces";
            errorLabel = "Double Faults";
        } else if (filterType === 'returns') {
            winnerLabel = "Return Winners";
            errorLabel = "Return UEs";
        }
        return (
            <div className="flex justify-center space-x-6 mt-4 text-sm">
                <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 rounded-sm bg-green-500"></div>
                    <span>{winnerLabel}</span>
                </div>
                <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 rounded-sm bg-red-500"></div>
                    <span>{errorLabel}</span>
                </div>
            </div>
        );
    }
    
    return (
        <div className="w-full flex flex-col items-center">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                {data.map((d, i) => {
                    const total = d.winners + d.errors;
                    
                    // Layout logic: Center if 1 item, spread if 2
                    let cx = width / 2;
                    if (data.length === 2) {
                         const groupSpacing = width / 2;
                         cx = groupSpacing * (i + 0.5);
                    }
                    
                    const cy = height / 2 - 20;

                    if (total === 0) return (
                        <g key={d.name} transform={`translate(${cx}, ${cy})`}>
                             <text textAnchor="middle" x="0" y="-95" fill="#a0aec0" fontSize="14" fontWeight="bold">{d.name}</text>
                             <circle cx="0" cy="0" r={chartRadius} fill="none" stroke="#2d3748" strokeWidth="30" />
                             <text textAnchor="middle" y="5" fill="#718096" fontSize="12">No Data</text>
                        </g>
                    );
                    
                    // Start at -PI/2 (12 o'clock)
                    const startAngle = -Math.PI / 2;
                    const winnerAngleDelta = (d.winners / total) * 2 * Math.PI;
                    const winnerEndAngle = startAngle + winnerAngleDelta;
                    const errorEndAngle = startAngle + 2 * Math.PI;

                    // Calculate Percentage of Winners
                    const winPercent = Math.round((d.winners / total) * 100);

                    return (
                        <g key={d.name}>
                             {/* Name Label positioned above chart */}
                            <text textAnchor="middle" x={cx} y={cy - chartRadius - 25} fill="#e2e8f0" fontSize="14" fontWeight="bold">{d.name}</text>
                            
                            {/* Winners Segment (Green) */}
                            <DonutSegment 
                                cx={cx} cy={cy} 
                                radius={chartRadius} 
                                startAngle={startAngle} 
                                endAngle={winnerEndAngle} 
                                color="#22c55e" 
                                value={d.winners}
                            />
                            
                            {/* Errors Segment (Red) - starts where winner ends */}
                            <DonutSegment 
                                cx={cx} cy={cy} 
                                radius={chartRadius} 
                                startAngle={winnerEndAngle} 
                                endAngle={errorEndAngle} 
                                color="#ef4444" 
                                value={d.errors}
                            />
                            
                            {/* Center Text: Percentage */}
                            <text textAnchor="middle" x={cx} y={cy} dy="-5" fill="#e2e8f0" fontSize="24" fontWeight="bold">
                                {winPercent}%
                            </text>
                            <text textAnchor="middle" x={cx} y={cy} dy="15" fill="#a0aec0" fontSize="10">
                                Success
                            </text>
                        </g>
                    )
                })}
            </svg>
            <Legend />
        </div>
    );
};

export default PerformanceDonutChart;
