"use client";

type RadarAttribute = {
  key: string;
  abbr: string;
  icon: string;
  value: number;
  max: number;
};

const SIZE = 230;
const R = 68;
const CX = SIZE / 2;
const CY = SIZE / 2;
const RINGS = [0.25, 0.5, 0.75, 1];

function polarToCartesian(angle: number, radius: number): [number, number] {
  return [CX + radius * Math.cos(angle), CY + radius * Math.sin(angle)];
}

function getAngle(index: number, total: number): number {
  return -Math.PI / 2 + (2 * Math.PI * index) / total;
}

function buildPolygonPoints(
  values: number[],
  maxValues: number[],
  total: number
): string {
  return values
    .map((val, i) => {
      const ratio = Math.min(val / maxValues[i], 1);
      const angle = getAngle(i, total);
      const [x, y] = polarToCartesian(angle, R * ratio);
      return `${x},${y}`;
    })
    .join(" ");
}

function buildRingPoints(ratio: number, total: number): string {
  return Array.from({ length: total }, (_, i) => {
    const angle = getAngle(i, total);
    const [x, y] = polarToCartesian(angle, R * ratio);
    return `${x},${y}`;
  }).join(" ");
}

export default function AttributeRadar({
  attributes,
}: {
  attributes: RadarAttribute[];
}) {
  const total = attributes.length;
  const LABEL_R = R * 1.35;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width="100%"
      className="block"
      style={{ filter: "drop-shadow(0 0 8px color-mix(in srgb, var(--ember) 9%, transparent))" }}
    >
      <defs>
        <radialGradient id="radar-fill-gradient" cx="50%" cy="50%" r="50%">
          <stop
            offset="0%"
            stopColor="var(--ember)"
            stopOpacity={0.35}
          />
          <stop
            offset="100%"
            stopColor="var(--ember)"
            stopOpacity={0.05}
          />
        </radialGradient>
      </defs>

      {/* Concentric rings */}
      {RINGS.map((ratio, i) => (
        <polygon
          key={`ring-${i}`}
          points={buildRingPoints(ratio, total)}
          fill="none"
          stroke={`color-mix(in srgb, var(--gold) ${ratio === 1 ? "33%" : "14%"}, transparent)`}
          strokeWidth={0.8}
          strokeDasharray={ratio < 1 ? "2 3" : undefined}
        />
      ))}

      {/* Spokes from center to outer vertices */}
      {attributes.map((_, i) => {
        const angle = getAngle(i, total);
        const [x, y] = polarToCartesian(angle, R);
        return (
          <line
            key={`spoke-${i}`}
            x1={CX}
            y1={CY}
            x2={x}
            y2={y}
            stroke="color-mix(in srgb, var(--gold) 14%, transparent)"
            strokeWidth={0.5}
          />
        );
      })}

      {/* Filled value polygon */}
      <polygon
        points={buildPolygonPoints(
          attributes.map((a) => a.value),
          attributes.map((a) => a.max),
          total
        )}
        fill="url(#radar-fill-gradient)"
        stroke="var(--ember)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />

      {/* Value dots */}
      {attributes.map((attr, i) => {
        const ratio = Math.min(attr.value / attr.max, 1);
        const angle = getAngle(i, total);
        const [x, y] = polarToCartesian(angle, R * ratio);
        return (
          <circle
            key={`dot-${i}`}
            cx={x}
            cy={y}
            r={3}
            fill="var(--ember)"
            stroke="white"
            strokeWidth={1.5}
          />
        );
      })}

      {/* Labels outside the hexagon */}
      {attributes.map((attr, i) => {
        const angle = getAngle(i, total);
        const [lx, ly] = polarToCartesian(angle, LABEL_R);
        return (
          <g key={`label-${i}`}>
            {/* Icon */}
            <text
              x={lx}
              y={ly - 8}
              textAnchor="middle"
              dominantBaseline="central"
              style={{
                fontFamily: "var(--font-cormorant)",
                fontStyle: "italic",
                fontSize: 11,
                fill: "var(--ember)",
              }}
            >
              {attr.icon}
            </text>
            {/* Abbreviation */}
            <text
              x={lx}
              y={ly + 2}
              textAnchor="middle"
              dominantBaseline="central"
              style={{
                fontFamily: "var(--font-cinzel)",
                fontSize: 7,
                fill: "color-mix(in srgb, var(--gold) 80%, transparent)",
                letterSpacing: "0.15em",
              }}
            >
              {attr.abbr}
            </text>
            {/* Value */}
            <text
              x={lx}
              y={ly + 11}
              textAnchor="middle"
              dominantBaseline="central"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 8,
                fontWeight: 500,
                fill: "#fff",
              }}
            >
              {attr.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
