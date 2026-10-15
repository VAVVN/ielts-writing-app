// Renders the Task 1 visual (chart, table, map or diagram) for a question
// from the data in backend/questions.json. Everything is plain SVG/HTML so
// there's no charting library to load.

const SERIES_COLORS = ['#2e7d32', '#1565c0', '#ef6c00', '#6a1b9a', '#c62828', '#00838f'];

const MAP_FILLS = {
  water: '#bbdefb',
  sand: '#ffe0b2',
  green: '#c8e6c9',
  building: '#e0e0e0',
  road: '#f5f5f5',
  rail: '#9e9e9e',
  industry: '#d7ccc8',
};

// Picks a tidy tick step (1, 2, 2.5 or 5 x 10^n) for about 4 gridlines and
// rounds the axis maximum up to it (e.g. 35 -> 40 with ticks every 10).
function niceAxis(value) {
  const rough = value / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= rough) * magnitude;
  return { max: Math.ceil(value / step) * step, step };
}

function Legend({ names }) {
  return (
    <div className="chart-legend">
      {names.map((name, i) => (
        <span key={name} className="chart-legend-item">
          <span className="chart-swatch" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
          {name}
        </span>
      ))}
    </div>
  );
}

const PLOT = { width: 640, height: 300, left: 56, right: 16, top: 16, bottom: 36 };

function Axes({ yMax, yStep, yLabel, xLabels, xPositions }) {
  const ticks = Array.from({ length: Math.round(yMax / yStep) + 1 }, (_, i) => i * yStep);
  const plotHeight = PLOT.height - PLOT.top - PLOT.bottom;
  const y = (v) => PLOT.top + plotHeight * (1 - v / yMax);
  return (
    <g className="chart-axes">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PLOT.left} x2={PLOT.width - PLOT.right} y1={y(t)} y2={y(t)} stroke="#e2e2df" />
          <text x={PLOT.left - 8} y={y(t) + 4} textAnchor="end">{Number(t.toFixed(1))}</text>
        </g>
      ))}
      {xLabels.map((label, i) => (
        <text key={label} x={xPositions[i]} y={PLOT.height - PLOT.bottom + 20} textAnchor="middle">{label}</text>
      ))}
      <text x={14} y={PLOT.top + plotHeight / 2} textAnchor="middle" transform={`rotate(-90 14 ${PLOT.top + plotHeight / 2})`}>
        {yLabel}
      </text>
    </g>
  );
}

function LineChart({ visual }) {
  const { max: yMax, step: yStep } = niceAxis(Math.max(...visual.series.flatMap((s) => s.values)));
  const plotWidth = PLOT.width - PLOT.left - PLOT.right;
  const plotHeight = PLOT.height - PLOT.top - PLOT.bottom;
  const xPositions = visual.x.map((_, i) => PLOT.left + 20 + ((plotWidth - 40) * i) / (visual.x.length - 1));
  const y = (v) => PLOT.top + plotHeight * (1 - v / yMax);
  return (
    <>
      <svg className="chart" viewBox={`0 0 ${PLOT.width} ${PLOT.height}`} role="img" aria-label="Line graph">
        <Axes yMax={yMax} yStep={yStep} yLabel={visual.yLabel} xLabels={visual.x} xPositions={xPositions} />
        {visual.series.map((s, si) => {
          const color = SERIES_COLORS[si % SERIES_COLORS.length];
          return (
            <g key={s.name}>
              <polyline
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                points={s.values.map((v, i) => `${xPositions[i]},${y(v)}`).join(' ')}
              />
              {s.values.map((v, i) => (
                <circle key={i} cx={xPositions[i]} cy={y(v)} r="3.5" fill={color} />
              ))}
            </g>
          );
        })}
      </svg>
      <Legend names={visual.series.map((s) => s.name)} />
    </>
  );
}

function BarChart({ visual }) {
  const { max: yMax, step: yStep } = niceAxis(Math.max(...visual.series.flatMap((s) => s.values)));
  const plotWidth = PLOT.width - PLOT.left - PLOT.right;
  const plotHeight = PLOT.height - PLOT.top - PLOT.bottom;
  const groupWidth = plotWidth / visual.categories.length;
  const barWidth = Math.min(28, (groupWidth * 0.8) / visual.series.length);
  const xPositions = visual.categories.map((_, i) => PLOT.left + groupWidth * (i + 0.5));
  return (
    <>
      <svg className="chart" viewBox={`0 0 ${PLOT.width} ${PLOT.height}`} role="img" aria-label="Bar chart">
        <Axes yMax={yMax} yStep={yStep} yLabel={visual.yLabel} xLabels={visual.categories} xPositions={xPositions} />
        {visual.series.map((s, si) =>
          s.values.map((v, ci) => {
            const height = (plotHeight * v) / yMax;
            const x = xPositions[ci] - (barWidth * visual.series.length) / 2 + barWidth * si;
            return (
              <rect
                key={`${si}-${ci}`}
                x={x}
                y={PLOT.top + plotHeight - height}
                width={barWidth - 2}
                height={height}
                fill={SERIES_COLORS[si % SERIES_COLORS.length]}
              />
            );
          })
        )}
      </svg>
      {visual.series.length > 1 && <Legend names={visual.series.map((s) => s.name)} />}
    </>
  );
}

function PieCharts({ visual }) {
  const labels = visual.charts[0].slices.map((s) => s.label);
  const radius = 90;
  return (
    <>
      <div className="pie-row">
        {visual.charts.map((chart) => {
          const total = chart.slices.reduce((sum, s) => sum + s.value, 0);
          let angle = -Math.PI / 2;
          return (
            <figure key={chart.title} className="pie-figure">
              <svg className="pie" viewBox="-100 -100 200 200" role="img" aria-label={`Pie chart ${chart.title}`}>
                {chart.slices.map((s) => {
                  const sweep = (s.value / total) * Math.PI * 2;
                  const start = angle;
                  angle += sweep;
                  const mid = start + sweep / 2;
                  const large = sweep > Math.PI ? 1 : 0;
                  const color = SERIES_COLORS[labels.indexOf(s.label) % SERIES_COLORS.length];
                  return (
                    <g key={s.label}>
                      <path
                        d={`M0 0 L${radius * Math.cos(start)} ${radius * Math.sin(start)} A${radius} ${radius} 0 ${large} 1 ${radius * Math.cos(angle)} ${radius * Math.sin(angle)} Z`}
                        fill={color}
                        stroke="white"
                        strokeWidth="1.5"
                      />
                      <text x={58 * Math.cos(mid)} y={58 * Math.sin(mid) + 4} textAnchor="middle" className="pie-label">
                        {s.value}%
                      </text>
                    </g>
                  );
                })}
              </svg>
              <figcaption>{chart.title}</figcaption>
            </figure>
          );
        })}
      </div>
      <Legend names={labels} />
    </>
  );
}

function DataTable({ visual }) {
  return (
    <table className="data-table">
      <caption>{visual.caption}</caption>
      <thead>
        <tr>
          {visual.columns.map((c) => (
            <th key={c}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {visual.rows.map((row) => (
          <tr key={row[0]}>
            {row.map((cell, i) => (
              <td key={i}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Splits a map label into lines that fit inside a box `width` units wide.
function wrapLabel(label, width) {
  const maxChars = Math.max(4, Math.floor(width / 0.19));
  const lines = [];
  for (const word of label.split(' ')) {
    const last = lines[lines.length - 1];
    if (last && (last + ' ' + word).length <= maxChars) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

function MapPlans({ visual }) {
  return (
    <div className="map-row">
      {visual.panels.map((panel) => (
        <figure key={panel.title} className="map-figure">
          <svg className="map" viewBox="0 0 12 8" role="img" aria-label={`Map ${panel.title}`}>
            <rect x="0" y="0" width="12" height="8" fill="#fafaf8" />
            {panel.items.map((item) => {
              const lines = wrapLabel(item.label, item.w);
              const lineHeight = 0.42;
              const firstY = item.y + item.h / 2 - ((lines.length - 1) * lineHeight) / 2 + 0.12;
              return (
                <g key={item.label}>
                  <rect
                    x={item.x}
                    y={item.y}
                    width={item.w}
                    height={item.h}
                    fill={MAP_FILLS[item.kind] || '#eee'}
                    stroke="#9e9e9e"
                    strokeWidth="0.03"
                    strokeDasharray={item.kind === 'rail' ? '0.2 0.1' : undefined}
                  />
                  {lines.map((line, i) => (
                    <text key={i} x={item.x + item.w / 2} y={firstY + i * lineHeight} textAnchor="middle" className="map-label">
                      {line}
                    </text>
                  ))}
                </g>
              );
            })}
            <rect x="0" y="0" width="12" height="8" fill="none" stroke="#666" strokeWidth="0.05" />
          </svg>
          <figcaption>{panel.title}</figcaption>
        </figure>
      ))}
    </div>
  );
}

function Diagram({ visual }) {
  return (
    <div className="diagram-row">
      {visual.sections.map((section) => (
        <div key={section.title} className="diagram-section">
          <h4>{section.title}</h4>
          {section.kind === 'layers' ? (
            <ol className="diagram-layers">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          ) : (
            <ol className="diagram-flow">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          )}
        </div>
      ))}
    </div>
  );
}

const RENDERERS = {
  line: LineChart,
  bar: BarChart,
  pie: PieCharts,
  table: DataTable,
  map: MapPlans,
  diagram: Diagram,
};

export default function Visual({ visual }) {
  const Renderer = RENDERERS[visual.kind];
  if (!Renderer) return null;
  return (
    <div className="visual">
      <Renderer visual={visual} />
      <p className="visual-note">Số liệu/hình vẽ chỉ mang tính minh hoạ - đề thi thật không công bố số liệu gốc.</p>
    </div>
  );
}
