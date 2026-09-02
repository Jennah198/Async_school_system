import Link from 'next/link'
import type { ReactNode } from 'react'
import { formatCount, trimNumber } from '@/lib/format'
import { statusTone, type StatusTone } from '@/lib/status'
import { cx } from '@/components/ui'

/*
  The dashboard's charts.

  Four decisions shape everything in this file.

  **No chart library.** The application already draws its own icons rather than
  taking an icon dependency, and these charts are simpler than that: bars are
  divs, a ring is one circle with a dash offset, a trend is one polyline. A
  charting library would add a few hundred kilobytes of client JavaScript, a
  render pass after hydration, and a second set of colours to keep in step with
  the design tokens — to draw shapes that are a dozen lines of SVG each.

  **They are server components.** Every chart here renders to markup on the
  server with no client JavaScript at all, so the dashboard paints once, in one
  pass, with the numbers already in it. Nothing flashes an empty axis first.

  **The numbers are always readable as text.** A chart is how the shape of the
  data is seen quickly; it is never the only way to get the value. Bars carry
  their count beside them, and the shapes that cannot — the ring, the trend —
  carry a visually hidden table. Colour is never the only carrier of meaning:
  every tone is paired with a label.

  **Nothing is drawn that was not measured.** No point is interpolated, no line
  is smoothed through a gap, and a series with one point renders as a stated
  figure rather than as a flat line implying a trend.
*/

/* --------------------------------------------------------------- tones --- */

const TONE_FILL: Record<StatusTone, string> = {
  idle: 'var(--color-status-idle)',
  progress: 'var(--color-status-progress)',
  active: 'var(--color-status-active)',
  done: 'var(--color-status-done)',
  stopped: 'var(--color-status-stopped)',
  muted: 'var(--color-status-muted)',
}

/** The fill for a state code, through the shared status vocabulary. */
export function toneFill(code: string, model?: string): string {
  return TONE_FILL[statusTone(code, model)]
}

/*
  Neutral bars for the charts that count things rather than state them —
  students per grade is not a status, and colouring it would imply one grade is
  "done" and another "stopped". A single graphite ramp keeps the comparison
  about length, which is what a bar chart is read for.
*/
const NEUTRAL = 'var(--color-graphite)'

export interface Datum {
  value: string
  label: string
  count: number
  measure?: number
}

/* ----------------------------------------------------------- bar rows --- */

/**
 * Horizontal bars, one per category.
 *
 * Horizontal rather than vertical because the categories here are named things
 * — grades, subjects, departments — and a horizontal bar gives the name a full
 * line of room instead of a rotated stub under an axis.
 */
export function BarRows({
  data,
  hrefFor,
  format = (datum) => formatCount(datum.count),
  weigh = (datum) => datum.count,
  tone,
  max,
  limit,
}: {
  data: Datum[]
  hrefFor?: (datum: Datum) => string
  /** The number shown at the end of the row. */
  format?: (datum: Datum) => string
  /** What sets the bar's length, where that differs from the count. */
  weigh?: (datum: Datum) => number
  /** A status-coloured bar, where the category really is a state. */
  tone?: (datum: Datum) => string
  max?: number
  limit?: number
}) {
  const shown = limit ? data.slice(0, limit) : data
  // Scaled against the largest bar, not the total: these compare with each
  // other, and against a total most schools' bars would be slivers.
  const ceiling = max ?? Math.max(...shown.map(weigh), 1)

  return (
    <ul className="space-y-2">
      {shown.map((datum) => {
        const share = Math.max((weigh(datum) / ceiling) * 100, 1.5)
        const row = (
          <>
            <span className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[12.5px] text-graphite">{datum.label}</span>
              <span className="tabular shrink-0 text-[12.5px] font-medium text-graphite">
                {format(datum)}
              </span>
            </span>
            <span aria-hidden className="mt-1 block h-1.5 rounded-full bg-silver/60">
              <span
                className="block h-full rounded-full"
                style={{ width: `${share}%`, background: tone ? tone(datum) : NEUTRAL }}
              />
            </span>
          </>
        )
        return (
          <li key={datum.value || datum.label}>
            {hrefFor ? (
              <Link
                href={hrefFor(datum)}
                className="-mx-1.5 block rounded-[8px] px-1.5 py-1 transition-colors hover:bg-paper"
              >
                {row}
              </Link>
            ) : (
              <span className="block px-0 py-1">{row}</span>
            )}
          </li>
        )
      })}
      {limit && data.length > limit ? (
        <li className="pt-0.5 text-[11px] text-stone">
          and {data.length - limit} more
        </li>
      ) : null}
    </ul>
  )
}

/* -------------------------------------------------------------- donut --- */

const RADIUS = 42
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * A composition ring.
 *
 * Used only where the parts genuinely make a whole and the question is "what
 * is the split" — today's register is exactly that. It is not used for
 * comparisons between categories, where a length beats an angle.
 */
export function Donut({
  segments,
  centre,
  centreLabel,
  caption,
}: {
  segments: Array<{ value: string; label: string; count: number; fill: string }>
  centre: string
  centreLabel: string
  caption: string
}) {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0)

  /*
    Arc lengths and their starting offsets are computed up front rather than
    accumulated while rendering. A running total mutated inside the map would
    give a different picture on a re-render, and the React compiler is right to
    refuse it.
  */
  const arcs = segments.reduce<Array<{ segment: (typeof segments)[number]; length: number; offset: number }>>(
    (running, segment) => {
      const previous = running[running.length - 1]
      const offset = previous ? previous.offset + previous.length : 0
      return [...running, { segment, length: (segment.count / total) * CIRCUMFERENCE, offset }]
    },
    [],
  )

  return (
    <div className="flex items-center gap-5">
      <svg
        viewBox="0 0 100 100"
        className="h-[112px] w-[112px] shrink-0 -rotate-90"
        role="img"
        aria-label={caption}
      >
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          stroke="var(--color-silver)"
          strokeWidth="12"
        />
        {arcs.map(({ segment, length, offset }) => (
          <circle
            key={segment.value}
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke={segment.fill}
            strokeWidth="12"
            strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
            strokeDashoffset={-offset}
          />
        ))}
        <text
          x="50"
          y="50"
          transform="rotate(90 50 50)"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-graphite"
          style={{ fontSize: '20px', fontWeight: 500 }}
        >
          {centre}
        </text>
      </svg>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {segments.map((segment) => (
          <li key={segment.value} className="flex items-center gap-2 text-[12.5px]">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{ background: segment.fill }}
            />
            <span className="min-w-0 flex-1 truncate text-graphite">{segment.label}</span>
            <span className="tabular shrink-0 text-graphite">{formatCount(segment.count)}</span>
            <span className="tabular w-9 shrink-0 text-right text-[11px] text-stone">
              {Math.round((segment.count / total) * 100)}%
            </span>
          </li>
        ))}
        <li className="sr-only">{centreLabel}</li>
      </ul>
    </div>
  )
}

/* --------------------------------------------------------------- trend --- */

export interface TrendPoint {
  label: string
  value: number
  iso: string
}

/**
 * A line over time, with the area under it filled.
 *
 * The y-axis is deliberately not zero-based when the values are percentages
 * clustered near the top — a 91-to-96% attendance range flattened against a
 * zero baseline shows nothing. The axis labels state the range so the scale is
 * never implied.
 *
 * Gaps are gaps. Odoo returns only the periods that hold records, and a day on
 * which no register was taken is not joined across as though it were.
 */
export function Trend({
  points,
  caption,
  suffix = '',
  /*
    A percentage axis reading "66.67%" is precision nobody asked for and makes
    the label wider than the chart. The underlying value keeps its precision;
    only the tick is rounded.
  */
  format = suffix === '%' ? (value: number) => String(Math.round(value)) : trimNumber,
  hrefFor,
}: {
  points: TrendPoint[]
  caption: string
  suffix?: string
  format?: (value: number) => string
  hrefFor?: (point: TrendPoint) => string
}) {
  const values = points.map((point) => point.value)
  const high = Math.max(...values)
  const low = Math.min(...values)
  // A flat series still needs a band to sit in, or every point lands on one
  // pixel and the line disappears.
  const top = high === low ? high + 1 : high
  const bottom = high === low ? Math.max(low - 1, 0) : low
  const span = top - bottom

  const W = 300
  const H = 76
  const x = (index: number) => (points.length === 1 ? W / 2 : (index / (points.length - 1)) * W)
  const y = (value: number) => H - ((value - bottom) / span) * H

  const line = points.map((point, index) => `${x(index)},${y(point.value)}`).join(' ')
  const area = `${x(0)},${H} ${line} ${x(points.length - 1)},${H}`

  return (
    <div>
      <div className="flex gap-2">
        <div className="tabular flex w-9 shrink-0 flex-col justify-between py-0.5 text-right text-[10px] text-stone">
          <span>
            {format(top)}
            {suffix}
          </span>
          <span>
            {format(bottom)}
            {suffix}
          </span>
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-[76px] w-full"
          role="img"
          aria-label={caption}
        >
          <polygon points={area} fill="var(--color-action-blue)" opacity="0.09" />
          <polyline
            points={line}
            fill="none"
            stroke="var(--color-action-blue)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {points.map((point, index) => (
            <circle
              key={point.iso}
              cx={x(index)}
              cy={y(point.value)}
              r="3"
              fill="var(--color-white)"
              stroke="var(--color-action-blue)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>

      <div className="mt-1.5 flex gap-2 pl-11">
        <ul className="flex flex-1 justify-between text-[10px] text-stone">
          {points.map((point, index) => (
            <li
              key={point.iso}
              // Only the ends and the middle are labelled: fourteen dates on a
              // narrow card overlap into an unreadable smear.
              className={cx(
                'truncate',
                index !== 0 && index !== points.length - 1 && 'hidden sm:block',
              )}
            >
              {hrefFor ? (
                <Link href={hrefFor(point)} className="hover:text-action-blue">
                  {shortLabel(point.label)}
                </Link>
              ) : (
                shortLabel(point.label)
              )}
            </li>
          ))}
        </ul>
      </div>

      <DataTable
        caption={caption}
        rows={points.map((point) => [point.label, `${format(point.value)}${suffix}`])}
      />
    </div>
  )
}

/** '02 Sep 2026' is too long for a tick; 'Sep 02' is not. */
function shortLabel(label: string): string {
  const parts = label.split(' ')
  return parts.length >= 2 ? `${parts[1]} ${parts[0]}` : label
}

/* ------------------------------------------------------------ sparkline --- */

/** The same line, small enough to sit inside a KPI tile. */
export function Sparkline({ points, label }: { points: number[]; label: string }) {
  if (points.length < 2) return null
  const high = Math.max(...points)
  const low = Math.min(...points)
  const span = high === low ? 1 : high - low
  const line = points
    .map((value, index) => `${(index / (points.length - 1)) * 60},${16 - ((value - low) / span) * 14}`)
    .join(' ')

  return (
    <svg viewBox="0 0 60 18" className="h-[18px] w-[60px]" role="img" aria-label={label}>
      <polyline
        points={line}
        fill="none"
        stroke="var(--color-action-blue)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/* ------------------------------------------------------------ pipeline --- */

/**
 * A workflow as one segmented bar, in the workflow's own order.
 *
 * State breakdowns were previously drawn as independent bars, which lost the
 * thing that matters about a pipeline: that these are stages of one journey
 * and the pile in an early stage is the backlog. Ordering the segments by the
 * Odoo state machine and butting them together shows where records are stuck.
 */
export function Pipeline({
  stages,
  model,
  hrefFor,
}: {
  stages: Datum[]
  model?: string
  hrefFor?: (datum: Datum) => string
}) {
  const total = stages.reduce((sum, stage) => sum + stage.count, 0)
  if (total === 0) return null

  return (
    <div>
      <div
        className="flex h-2.5 gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={stages.map((stage) => `${stage.label} ${stage.count}`).join(', ')}
      >
        {stages.map((stage) => (
          <span
            key={stage.value}
            className="first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${(stage.count / total) * 100}%`,
              background: toneFill(stage.value, model),
            }}
          />
        ))}
      </div>
      <ul className="mt-3 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {stages.map((stage) => {
          const row = (
            <span className="flex items-center gap-2 text-[12.5px]">
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: toneFill(stage.value, model) }}
              />
              <span className="min-w-0 flex-1 truncate text-graphite">{stage.label}</span>
              <span className="tabular shrink-0 text-graphite">{formatCount(stage.count)}</span>
            </span>
          )
          return (
            <li key={stage.value}>
              {hrefFor ? (
                <Link
                  href={hrefFor(stage)}
                  className="-mx-1.5 block rounded-[6px] px-1.5 py-0.5 hover:bg-paper"
                >
                  {row}
                </Link>
              ) : (
                row
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* --------------------------------------------------------------- table --- */

/**
 * The numbers behind a shape that cannot show them inline.
 *
 * Hidden visually, present in the accessibility tree and in the page text, so
 * a chart is never the only way to get at a figure.
 */
export function DataTable({ caption, rows }: { caption: string; rows: Array<[string, string]> }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <th scope="row">{label}</th>
            <td>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ---------------------------------------------------------------- chrome --- */

/**
 * The line under a chart that says what it is measuring and over what.
 *
 * Every chart on this dashboard carries one. "92%" is not a fact until it says
 * 92% of what, counted when.
 */
export function ChartNote({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[11px] leading-relaxed text-stone">{children}</p>
}
