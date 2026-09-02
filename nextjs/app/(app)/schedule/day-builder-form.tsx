'use client'

import { useActionState, useState } from 'react'
import { formatClock } from '@/lib/format'
import { buildDayAction, type DayBuilderState } from './actions'

export interface Choice {
  id: number
  name: string
}

export interface WeekdayChoice extends Choice {
  code: string
}

export interface CurriculumEntry {
  classId: number
  subjectId: number
  subjectName: string
}

export interface AssignedEntry {
  classId: number
  termId: number
  subjectId: number
}

export interface TermChoice extends Choice {
  yearName: string
}

const DAYS = [
  ['0', 'Monday'],
  ['1', 'Tuesday'],
  ['2', 'Wednesday'],
  ['3', 'Thursday'],
  ['4', 'Friday'],
  ['5', 'Saturday'],
  ['6', 'Sunday'],
] as const

const TYPES = [
  ['regular', 'Regular class'],
  ['tutorial', 'Tutorial'],
  ['laboratory', 'Laboratory'],
  ['examination', 'Examination'],
] as const

const CONTROL =
  'w-full rounded-[8px] border border-silver bg-white px-2.5 py-1.5 text-[12px] ' +
  'text-graphite focus:border-action-blue focus:outline-none disabled:bg-paper disabled:text-stone'

interface Period {
  key: number
  subjectId: string
  roomId: string
  type: string
}

let nextKey = 1

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="mb-1 block text-[11px] font-medium text-graphite">
      {children}
      {required ? <span className="ml-0.5 text-danger">*</span> : null}
    </span>
  )
}

/**
 * Build a day of periods for one class.
 *
 * The clock times shown beside each period are a preview of what Odoo will
 * chain from the first start, the period length and the break — the wizard
 * computes the stored values itself, so nothing here is sent as a time.
 */
export function DayBuilderForm({
  classes,
  terms,
  rooms,
  weekdays,
  curriculum,
  assigned,
}: {
  classes: Choice[]
  terms: TermChoice[]
  rooms: Choice[]
  weekdays: WeekdayChoice[]
  curriculum: CurriculumEntry[]
  assigned: AssignedEntry[]
}) {
  const [state, formAction, pending] = useActionState<DayBuilderState, FormData>(buildDayAction, {})
  const [open, setOpen] = useState(false)
  const [classId, setClassId] = useState('')
  const [termId, setTermId] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState('0')
  const [firstStart, setFirstStart] = useState('08:00')
  const [periodMinutes, setPeriodMinutes] = useState('45')
  const [breakMinutes, setBreakMinutes] = useState('0')
  const [periods, setPeriods] = useState<Period[]>([])

  const errors = state.fieldErrors ?? {}

  // Only subjects on the class curriculum that also carry an active assignment
  // for the term can become a period — the same set the wizard computes.
  const assignedHere = new Set(
    assigned
      .filter((row) => String(row.classId) === classId && String(row.termId) === termId)
      .map((row) => row.subjectId),
  )
  const subjects = [
    ...new Map(
      curriculum
        .filter((row) => String(row.classId) === classId && assignedHere.has(row.subjectId))
        .map((row) => [row.subjectId, row.subjectName]),
    ),
  ]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const ready = Boolean(classId && termId)

  const startHours = (() => {
    const [h, m] = firstStart.split(':').map(Number)
    return Number.isFinite(h) && Number.isFinite(m) ? h + m / 60 : 8
  })()

  function previewTimes(index: number) {
    const step = Number(periodMinutes) / 60
    const gap = Number(breakMinutes) / 60
    if (!Number.isFinite(step) || !Number.isFinite(gap)) return ''
    const start = startHours + index * (step + gap)
    return `${formatClock(start)}–${formatClock(start + step)}`
  }

  function addPeriod() {
    setPeriods((current) => [
      ...current,
      { key: nextKey++, subjectId: '', roomId: '', type: 'regular' },
    ])
  }

  function update(key: number, patch: Partial<Period>) {
    setPeriods((current) =>
      current.map((period) => (period.key === key ? { ...period, ...patch } : period)),
    )
  }

  function move(index: number, by: number) {
    setPeriods((current) => {
      const next = [...current]
      const target = index + by
      if (target < 0 || target >= next.length) return current
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  if (!open) {
    return (
      <div className="p-6 pt-0">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-[9999px] border border-silver px-3.5 py-1.5 text-[12px] font-medium hover:bg-paper"
        >
          Build a day
        </button>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4 p-6 pt-0">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <Label required>Class</Label>
          <select
            name="classId"
            value={classId}
            onChange={(event) => {
              setClassId(event.target.value)
              setPeriods([])
            }}
            className={CONTROL}
          >
            <option value="">Choose a class…</option>
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          {errors.classId ? <span role="alert" className="mt-1 block text-[11px] text-danger">{errors.classId}</span> : null}
        </label>

        <label className="block">
          <Label required>Term</Label>
          <select
            name="termId"
            value={termId}
            onChange={(event) => {
              setTermId(event.target.value)
              setPeriods([])
            }}
            className={CONTROL}
          >
            <option value="">Choose a term…</option>
            {terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.yearName} · {term.name}
              </option>
            ))}
          </select>
          {errors.termId ? <span role="alert" className="mt-1 block text-[11px] text-danger">{errors.termId}</span> : null}
        </label>

        <label className="block">
          <Label required>Day</Label>
          <select
            name="dayOfWeek"
            value={dayOfWeek}
            onChange={(event) => setDayOfWeek(event.target.value)}
            className={CONTROL}
          >
            {DAYS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block">
          <Label required>First period starts</Label>
          <input
            name="firstStartTimeDisplay"
            type="time"
            value={firstStart}
            onChange={(event) => setFirstStart(event.target.value)}
            className={CONTROL}
          />
          <input type="hidden" name="firstStartTime" value={startHours} />
        </label>

        <label className="block">
          <Label required>Period length</Label>
          <input
            name="periodMinutes"
            type="number"
            min={1}
            value={periodMinutes}
            onChange={(event) => setPeriodMinutes(event.target.value)}
            className={CONTROL}
          />
          <span className="mt-1 block text-[11px] text-stone">minutes</span>
        </label>

        <label className="block">
          <Label>Break between</Label>
          <input
            name="breakMinutes"
            type="number"
            min={0}
            value={breakMinutes}
            onChange={(event) => setBreakMinutes(event.target.value)}
            className={CONTROL}
          />
          <span className="mt-1 block text-[11px] text-stone">minutes</span>
        </label>

        <label className="block">
          <Label>Default room</Label>
          <select name="defaultRoomId" defaultValue="" className={CONTROL}>
            <option value="">None</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset>
        <legend className="mb-1 text-[11px] font-medium text-graphite">Also copy to</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {weekdays.map((weekday) => (
            <label key={weekday.id} className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                name="repeatWeekdayIds"
                value={weekday.id}
                disabled={weekday.code === dayOfWeek}
                className="h-3.5 w-3.5 rounded border-silver"
              />
              <span className="text-[12px] text-graphite">{weekday.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="border-t border-silver pt-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-[12px] font-medium text-graphite">Periods</span>
          <button
            type="button"
            onClick={addPeriod}
            disabled={!ready}
            className="rounded-[9999px] border border-silver px-3 py-1 text-[11px] hover:bg-paper disabled:opacity-50"
          >
            Add period
          </button>
        </div>

        {!ready ? (
          <p className="text-[11px] text-stone">Choose a class and term first.</p>
        ) : subjects.length === 0 ? (
          <p className="text-[11px] text-stone">
            No subject on this class has an active teacher assignment for that term, so no period
            can be built yet.
          </p>
        ) : periods.length === 0 ? (
          <p className="text-[11px] text-stone">No periods yet. Add the first one.</p>
        ) : (
          <ul className="space-y-2">
            {periods.map((period, index) => (
              <li key={period.key} className="flex flex-wrap items-center gap-2">
                <span className="tabular w-24 shrink-0 text-[11px] text-stone">
                  {previewTimes(index)}
                </span>

                <select
                  name="periodSubjectId"
                  value={period.subjectId}
                  onChange={(event) => update(period.key, { subjectId: event.target.value })}
                  className={`${CONTROL} w-auto min-w-[9rem] flex-1`}
                  aria-label={`Subject for period ${index + 1}`}
                >
                  <option value="">Choose a subject…</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>

                <select
                  name="periodRoomId"
                  value={period.roomId}
                  onChange={(event) => update(period.key, { roomId: event.target.value })}
                  className={`${CONTROL} w-auto min-w-[7rem]`}
                  aria-label={`Room for period ${index + 1}`}
                >
                  <option value="">Default room</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>

                <select
                  name="periodType"
                  value={period.type}
                  onChange={(event) => update(period.key, { type: event.target.value })}
                  className={`${CONTROL} w-auto min-w-[7rem]`}
                  aria-label={`Type for period ${index + 1}`}
                >
                  {TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>

                <span className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move period ${index + 1} earlier`}
                    className="rounded-[6px] border border-silver px-2 py-1 text-[11px] hover:bg-paper disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === periods.length - 1}
                    aria-label={`Move period ${index + 1} later`}
                    className="rounded-[6px] border border-silver px-2 py-1 text-[11px] hover:bg-paper disabled:opacity-40"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriods((current) => current.filter((item) => item.key !== period.key))}
                    aria-label={`Remove period ${index + 1}`}
                    className="rounded-[6px] border border-silver px-2 py-1 text-[11px] text-danger hover:bg-danger-bg"
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        {errors.periods ? (
          <p role="alert" className="mt-2 text-[11px] text-danger">
            {errors.periods}
          </p>
        ) : null}
      </div>

      <label className="flex cursor-pointer items-center gap-2 border-t border-silver pt-3">
        <input type="checkbox" name="state" value="draft" className="h-4 w-4 rounded border-silver" />
        <span className="text-[12px] text-graphite">Create as draft rather than published</span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || periods.length === 0}
          className="rounded-[9999px] bg-ink px-3.5 py-1.5 text-[12px] font-medium text-white hover:bg-graphite disabled:opacity-50"
        >
          {pending ? 'Building…' : 'Build the day'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-[9999px] border border-silver px-3.5 py-1.5 text-[12px] hover:bg-paper"
        >
          Cancel
        </button>

        {state.error ? (
          <span role="alert" className="text-[11px] text-danger">
            {state.error}
          </span>
        ) : null}
        {state.ok && !state.error ? (
          <span role="status" className="text-[11px] text-action-blue">
            {state.ok}
          </span>
        ) : null}
      </div>

      <p className="text-[11px] text-stone">
        Odoo picks each period&rsquo;s teacher from the active assignment for that subject, class and
        term, and refuses the whole build if one is missing.
      </p>
    </form>
  )
}
