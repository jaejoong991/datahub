import {
  BarChart as RechartsBar,
  LineChart as RechartsLine,
  ComposedChart as RechartsComposed,
  PieChart as RechartsPie,
  Bar, Line, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { formatAmount, formatCount, formatDateWIB, isMissing } from '../lib/format.js';
import { Empty } from './states.jsx';

function cssVar(name) {
  if (typeof document === 'undefined') return '#888';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}

function resolveColor(index) {
  const palette = [
    cssVar('--primary'),
    cssVar('--accent-blue') || '#3b82f6',
    cssVar('--accent-saffron') || '#f59e0b',
    cssVar('--accent-basil') || '#10b981',
    cssVar('--accent-grape') || '#8b5cf6',
    cssVar('--accent-cyan') || '#06b6d4',
    cssVar('--accent-tomato') || '#ef4444',
    cssVar('--accent-lime') || '#84cc16',
  ];
  return palette[index % palette.length];
}

function CustomTooltip({ active, payload, label, valuePrefix = 'Rp', dateKey }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">
        {dateKey ? formatDateWIB(label) : label}
      </div>
      {payload.map((entry, i) => {
        const val = entry.value;
        const text = isMissing(val) ? '—' : valuePrefix === 'Rp' ? formatAmount(val) : formatCount(val);
        return (
          <div key={i} className="chart-tooltip-row" style={{ color: entry.color }}>
            <span>{entry.name}:</span>
            <span className="mono">{text}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Chart — wrapper Recharts.
 *
 * Props:
 *   type: 'bar' | 'line' | 'composed' | 'pie'
 *   data: array
 *   xKey: string (default 'label')
 *   series: array of { key, name, color?, type? } (untuk bar/line/composed)
 *   pieData: array of { name, value, color? } (untuk pie)
 *   height: number (default 280)
 *   valuePrefix: 'Rp' | 'count'
 *   dateKey: boolean
 *   stacked: boolean
 *   loading: boolean
 */
export default function Chart({
  type = 'bar',
  data = [],
  xKey = 'label',
  series = [],
  pieData = [],
  height = 280,
  valuePrefix = 'Rp',
  dateKey = false,
  stacked = false,
  loading = false,
}) {
  if (loading) {
    return (
      <div className="chart-skeleton" style={{ height }}>
        <div className="chart-skel-bar" style={{ height: '60%' }} />
        <div className="chart-skel-bar" style={{ height: '85%' }} />
        <div className="chart-skel-bar" style={{ height: '45%' }} />
        <div className="chart-skel-bar" style={{ height: '70%' }} />
        <div className="chart-skel-bar" style={{ height: '55%' }} />
      </div>
    );
  }

  if ((type === 'pie' && !pieData.length) || (type !== 'pie' && !data.length)) {
    return <div className="chart-empty" style={{ height }}><Empty title="Belum ada data" /></div>;
  }

  const axisStyle = { fontSize: 11, fill: cssVar('--ink-3') };

  if (type === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <RechartsPie>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            cx="50%" cy="50%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={3}
          >
            {pieData.map((entry, i) => (
              <Cell key={i} fill={entry.color || resolveColor(i)} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip valuePrefix={valuePrefix} />} />
          <Legend
            wrapperStyle={{ fontSize: 11.5, color: cssVar('--ink-2') }}
            iconType="circle" iconSize={8}
          />
        </RechartsPie>
      </ResponsiveContainer>
    );
  }

  const commonProps = { data, margin: { top: 8, right: 8, bottom: 0, left: -8 } };
  const yTick = (v) => valuePrefix === 'Rp' && v >= 1_000_000
    ? `${(v / 1_000_000).toFixed(0)}jt`
    : `${(v / 1000).toFixed(0)}k`;

  function renderChart(ChartComponent, children) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <ChartComponent {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={cssVar('--line')} />
          <XAxis dataKey={xKey} tick={axisStyle} tickLine={false} axisLine={{ stroke: cssVar('--line') }} interval="preserveStartEnd" />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={yTick} />
          <Tooltip content={<CustomTooltip valuePrefix={valuePrefix} dateKey={dateKey} />} />
          {children}
        </ChartComponent>
      </ResponsiveContainer>
    );
  }

  if (type === 'line') {
    return renderChart(RechartsLine,
      series.map((s, i) => (
        <Line key={s.key} type="monotone" dataKey={s.key} name={s.name || s.key}
          stroke={s.color || resolveColor(i)} strokeWidth={2}
          dot={{ r: 3, fill: s.color || resolveColor(i) }}
          activeDot={{ r: 5 }} />
      ))
    );
  }

  if (type === 'composed') {
    return renderChart(RechartsComposed,
      series.map((s, i) => s.type === 'line'
        ? <Line key={s.key} type="monotone" dataKey={s.key} name={s.name || s.key}
            stroke={s.color || resolveColor(i)} strokeWidth={2} dot={{ r: 2 }} />
        : <Bar key={s.key} dataKey={s.key} name={s.name || s.key}
            fill={s.color || resolveColor(i)} radius={[3, 3, 0, 0]}
            stackId={stacked ? 'stack' : undefined} maxBarSize={40} />
      )
    );
  }

  return renderChart(RechartsBar,
    series.map((s, i) => (
      <Bar key={s.key} dataKey={s.key} name={s.name || s.key}
        fill={s.color || resolveColor(i)} radius={[3, 3, 0, 0]}
        stackId={stacked ? 'stack' : undefined} maxBarSize={40} />
    ))
  );
}
