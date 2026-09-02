import { cx } from './primitives'

/**
 * A bar chart, drawn as plain SVG.
 *
 * No charting library: these are grouped bars on a category axis, which is a
 * few dozen lines of SVG and avoids a runtime dependency for something the
 * platform draws natively. It also keeps the chart server-rendered, so it
 * appears with the page rather than after it.
 *
 * Stacked mode is what Odoo's stacked graph views use -- attendance by class
 * broken down by status, where the whole is as meaningful as the parts.
 */
export interface Series {
  label: string
  /** One value per category, in the same order. */
  values: number[]
}

const BAR_TONES = [
  'fill-ink',
  'fill-slate',
  'fill-stone',
  'fill-silver',
  'fill-graphite',
]

function niceCeiling(value: number): number {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  return Math.ceil(value / magnitude) * magnitude
}

export function BarChart({
  categories,
  series,
  stacked = false,
  height = 220,
  valueSuffix = '',
  caption,
}: {
  categories: string[]
  series: Series[]
  stacked?: boolean
  height?: number
  valueSuffix?: string
  caption: string
}) {
  if (categories.length === 0 || series.length === 0) return null

  const totals = categories.map((_, index) =>
    stacked
      ? series.reduce((sum, item) => sum + (item.values[index] ?? 0), 0)
      : Math.max(...series.map((item) => item.values[index] ?? 0)),
  )
  const ceiling = niceCeiling(Math.max(...totals, 0))

  // A wide category axis scrolls inside its own box rather than squashing.
  const slotWidth = Math.max(56, Math.min(96, Math.round(640 / categories.length)))
  const width = slotWidth * categories.length + 48
  const plotHeight = height - 28
  const barGap = 4
  const barWidth = stacked
    ? Math.min(28, slotWidth - 16)
    : Math.max(6, (slotWidth - 16 - barGap * (series.length - 1)) / series.length)

  return (
    <figure className="m-0">
      <div className="overflow-x-auto">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={caption}
          className="block"
        >
          <line
            x1={40}
            y1={plotHeight}
            x2={width - 8}
            y2={plotHeight}
            className="stroke-silver"
            strokeWidth={1}
          />
          {[0, 0.5, 1].map((fraction) => (
            <g key={fraction}>
              <line
                x1={40}
                y1={plotHeight - fraction * plotHeight}
                x2={width - 8}
                y2={plotHeight - fraction * plotHeight}
                className="stroke-silver"
                strokeWidth={fraction === 0 ? 0 : 1}
                strokeDasharray="2 3"
              />
              <text
                x={34}
                y={plotHeight - fraction * plotHeight + 4}
                textAnchor="end"
                className="fill-stone text-[10px]"
              >
                {Math.round(ceiling * fraction)}
              </text>
            </g>
          ))}

          {categories.map((category, index) => {
            const slotX = 44 + index * slotWidth
            let stackTop = plotHeight
            return (
              <g key={category}>
                {series.map((item, seriesIndex) => {
                  const value = item.values[index] ?? 0
                  const barHeight = ceiling === 0 ? 0 : (value / ceiling) * plotHeight
                  const x = stacked
                    ? slotX + (slotWidth - 16 - barWidth) / 2
                    : slotX + seriesIndex * (barWidth + barGap)
                  const y = stacked ? stackTop - barHeight : plotHeight - barHeight
                  if (stacked) stackTop -= barHeight
                  return (
                    <rect
                      key={item.label}
                      x={x}
                      y={y}
                      width={barWidth}
                      height={Math.max(0, barHeight)}
                      className={cx(BAR_TONES[seriesIndex % BAR_TONES.length])}
                    >
                      <title>{`${category} - ${item.label}: ${value}${valueSuffix}`}</title>
                    </rect>
                  )
                })}
                <text
                  x={slotX + (slotWidth - 16) / 2}
                  y={height - 8}
                  textAnchor="middle"
                  className="fill-stone text-[10px]"
                >
                  {category.length > 12 ? `${category.slice(0, 11)}\u2026` : category}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {series.length > 1 ? (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 p-0">
          {series.map((item, index) => (
            <li key={item.label} className="flex items-center gap-1.5 text-[11px] text-slate">
              <svg width={10} height={10} aria-hidden>
                <rect
                  width={10}
                  height={10}
                  rx={2}
                  className={BAR_TONES[index % BAR_TONES.length]}
                />
              </svg>
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}

      <figcaption className="mt-2 text-[11px] text-stone">{caption}</figcaption>
    </figure>
  )
}
