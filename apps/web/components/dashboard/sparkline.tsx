'use client';

interface Props {
  data: Array<{ date: string; amount: number }>;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Tiny SVG sparkline. Pads to month-length so visually short months don't
 * hide the trend.
 */
export function Sparkline({ data, width = 200, height = 40, className = '' }: Props) {
  if (data.length === 0) {
    return <div className={`text-xs text-gray-400 ${className}`}>No data yet this month</div>;
  }
  const values = data.map((d) => d.amount);
  const max = Math.max(...values, 0.001);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = width / Math.max(data.length - 1, 1);
  const points = data.map((d, i) => {
    const x = i * stepX;
    const y = height - ((d.amount - min) / range) * height * 0.9 - height * 0.05;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const pathD = `M ${points.join(' L ')}`;
  // Area fill
  const areaD = `M 0,${height} L ${points.join(' L ')} L ${width.toFixed(1)},${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} className={className}
      preserveAspectRatio="none">
      <path d={areaD} fill="rgb(34 197 94 / 0.12)" />
      <path d={pathD} stroke="rgb(34 197 94)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
