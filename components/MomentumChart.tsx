
import React from 'react';
import { MatchRecord } from '../types';

interface MomentumChartProps {
    match: MatchRecord;
}

const MomentumChart: React.FC<MomentumChartProps> = ({ match }) => {
    const { pointHistory, team1, team2 } = match;
    
    if (!pointHistory || pointHistory.length < 2) {
        return <p className="text-center text-secondary-text">Not enough data to show momentum.</p>;
    }

    // FIX: The original logic for calculating momentum was brittle, relying on parsing the description string.
    // This is replaced with a direct and reliable check of the `pointWinnerId` from the structured point log data.
    const momentumData = pointHistory.reduce((acc, point) => {
        const lastValue = acc[acc.length - 1];
        acc.push(lastValue + (point.pointWinnerId === 1 ? 1 : -1));
        return acc;
    }, [0]);

    const width = 500;
    const height = 200;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const maxMomentum = Math.max(...momentumData.map(d => Math.abs(d)));
    const yMax = maxMomentum > 0 ? maxMomentum : 5; // Ensure we have a range even if score is 0

    const xScale = (i: number) => (i / (momentumData.length - 1)) * chartWidth;
    const yScale = (val: number) => chartHeight / 2 - (val / yMax) * (chartHeight / 2);

    const pathData = momentumData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d)}`).join(' ');
    
    const yAxisLabels = [-yMax, -Math.round(yMax/2), 0, Math.round(yMax/2), yMax].filter((v, i, a) => a.indexOf(v) === i); // a.indexOf(v) === i for uniqueness

    return (
        <div className="w-full flex flex-col items-center">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                <g transform={`translate(${margin.left}, ${margin.top})`}>
                    {/* Y-Axis line and labels */}
                    <line x1="0" y1="0" x2="0" y2={chartHeight} stroke="#4a5568" />
                    {yAxisLabels.map(label => (
                         <g key={label} transform={`translate(0, ${yScale(label)})`}>
                            <line x1="-5" y1="0" x2={chartWidth} y2="0" stroke="#4a5568" strokeDasharray={label === 0 ? "0" : "2,2"} />
                            <text x="-10" dy=".32em" textAnchor="end" fill="#a0aec0" fontSize="10">{label}</text>
                         </g>
                    ))}
                    
                    {/* Y-Axis Team Advantage Labels */}
                    <text x={chartWidth} y={0} textAnchor="end" fill="#a0aec0" fontSize="10" dy="-4">
                        Adv. {team1.players.map(p => p.name.split(' ')[0]).join('/')}
                    </text>
                    <text x={chartWidth} y={chartHeight} textAnchor="end" fill="#a0aec0" fontSize="10" dy="12">
                        Adv. {team2.players.map(p => p.name.split(' ')[0]).join('/')}
                    </text>
                    
                    {/* X-Axis */}
                    <line x1="0" y1={chartHeight} x2={chartWidth} y2={chartHeight} stroke="#4a5568" />
                     <text x={chartWidth / 2} y={chartHeight + 20} textAnchor="middle" fill="#a0aec0" fontSize="10">Points Played</text>

                    {/* Momentum Line */}
                    <path d={pathData} fill="none" stroke="#c5f542" strokeWidth="2" />
                </g>
            </svg>
        </div>
    );
};

export default MomentumChart;
