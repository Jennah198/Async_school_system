'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from '@/components/icons'
import { cx } from '@/components/ui/primitives'
import {
  daysInEthiopianMonth,
  ETHIOPIAN_MONTHS,
  ETHIOPIAN_WEEKDAYS,
  ethiopianWeekday,
  parseIsoDate,
  toEthiopian,
  toGregorian,
  toIsoDate,
  type EthiopianDate,
} from '@/lib/ethiopian-date'
import { formatDate } from '@/lib/format'

/**
 * A date field the school actually thinks in.
 *
 * The visible calendar is Ethiopian — thirteen months, Segno-first weeks. What
 * the form posts is a Gregorian `YYYY-MM-DD` in a hidden input, because that
 * is the only shape Odoo's Date fields accept. The Gregorian equivalent stays
 * visible under the field so it can be checked against Odoo's own backend.
 */

const TRIGGER =
  'flex w-full items-center justify-between gap-2 rounded-[8px] border border-silver bg-white ' +
  'px-3 py-2 text-left text-[13px] text-graphite hover:border-stone ' +
  'focus:border-action-blue focus:outline-none'

function todayEthiopian(): EthiopianDate {
  const now = new Date()
  return toEthiopian({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  })
}

function clampDay(date: EthiopianDate): EthiopianDate {
  const last = daysInEthiopianMonth(date.year, date.month)
  return date.day > last ? { ...date, day: last } : date
}

function shift(date: EthiopianDate, days: number): EthiopianDate {
  const gregorian = toGregorian(date)
  const moved = new Date(Date.UTC(gregorian.year, gregorian.month - 1, gregorian.day + days))
  return toEthiopian({
    year: moved.getUTCFullYear(),
    month: moved.getUTCMonth() + 1,
    day: moved.getUTCDate(),
  })
}

function sameDate(a: EthiopianDate, b: EthiopianDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day
}

export function EthiopianDateInput({
  name,
  id,
  defaultValue = '',
  describedBy,
  onChange,
}: {
  name: string
  id?: string
  /** Gregorian `YYYY-MM-DD`, as Odoo stores it. */
  defaultValue?: string
  describedBy?: string
  /** Receives the Gregorian ISO value, for fields derived from this one. */
  onChange?: (isoDate: string) => void
}) {
  const fallbackId = useId()
  const fieldId = id ?? fallbackId
  const gridId = `${fieldId}-grid`

  const [value, setValue] = useState(defaultValue)
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState<EthiopianDate | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const selected = (() => {
    const gregorian = parseIsoDate(value)
    return gregorian ? toEthiopian(gregorian) : null
  })()

  // A click anywhere else is a dismissal, the same as Escape.
  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  // The focused day owns the roving tabindex, so it has to actually take focus.
  useEffect(() => {
    if (!open || !cursor) return
    gridRef.current
      ?.querySelector<HTMLButtonElement>('button[tabindex="0"]')
      ?.focus()
  }, [open, cursor])

  function openPicker() {
    setCursor(selected ?? todayEthiopian())
    setOpen(true)
  }

  function commit(date: EthiopianDate) {
    const iso = toIsoDate(toGregorian(date))
    setValue(iso)
    onChange?.(iso)
    setOpen(false)
    containerRef.current?.querySelector<HTMLButtonElement>('button[data-trigger]')?.focus()
  }

  function handleGridKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!cursor) return
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
      PageUp: -30,
      PageDown: 30,
    }
    const days = moves[event.key]
    if (days !== undefined) {
      event.preventDefault()
      setCursor(shift(cursor, days))
      return
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const day = event.key === 'Home' ? 1 : daysInEthiopianMonth(cursor.year, cursor.month)
      setCursor({ ...cursor, day })
    }
  }

  const view = cursor ?? selected ?? todayEthiopian()
  const monthLength = open ? daysInEthiopianMonth(view.year, view.month) : 0
  const leadingBlanks = open ? ethiopianWeekday({ ...view, day: 1 }) : 0
  const today = open ? todayEthiopian() : null

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value={value} />

      <button
        data-trigger
        type="button"
        id={fieldId}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={describedBy}
        onClick={() => (open ? setOpen(false) : openPicker())}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) setOpen(false)
        }}
        className={TRIGGER}
      >
        <span className={selected ? '' : 'text-stone'}>
          {selected
            ? `${ETHIOPIAN_MONTHS[selected.month - 1]} ${selected.day}, ${selected.year}`
            : 'Choose a date…'}
        </span>
        <Icon name="academicYear" className="h-4 w-4 shrink-0 text-stone" />
      </button>

      <p className="mt-1 text-[11px] text-stone">
        {value ? formatDate(value) : 'Gregorian date appears here'}
      </p>

      {open ? (
        <div
          role="dialog"
          aria-label="Ethiopian calendar"
          className="absolute z-20 mt-1 w-[268px] rounded-[12px] border border-silver bg-white p-3 shadow-lg"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              setOpen(false)
              containerRef.current?.querySelector<HTMLButtonElement>('button[data-trigger]')?.focus()
            }
          }}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <MonthStep
              label="Previous month"
              icon="arrowLeft"
              onClick={() =>
                setCursor(
                  clampDay(
                    view.month === 1
                      ? { ...view, year: view.year - 1, month: 13 }
                      : { ...view, month: view.month - 1 },
                  ),
                )
              }
            />
            <div className="text-center text-[13px] font-medium text-graphite">
              {ETHIOPIAN_MONTHS[view.month - 1]} {view.year}
            </div>
            <MonthStep
              label="Next month"
              icon="arrowRight"
              onClick={() =>
                setCursor(
                  clampDay(
                    view.month === 13
                      ? { ...view, year: view.year + 1, month: 1 }
                      : { ...view, month: view.month + 1 },
                  ),
                )
              }
            />
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5" aria-hidden>
            {ETHIOPIAN_WEEKDAYS.map((weekday) => (
              <div key={weekday} className="py-1 text-center text-[10px] text-stone">
                {weekday.slice(0, 2)}
              </div>
            ))}
          </div>

          <div
            ref={gridRef}
            id={gridId}
            role="group"
            aria-label={`${ETHIOPIAN_MONTHS[view.month - 1]} ${view.year}`}
            className="grid grid-cols-7 gap-0.5"
            onKeyDown={handleGridKeyDown}
          >
            {Array.from({ length: leadingBlanks }, (_, index) => (
              <div key={`blank-${index}`} aria-hidden />
            ))}

            {Array.from({ length: monthLength }, (_, index) => {
              const date = { year: view.year, month: view.month, day: index + 1 }
              const isSelected = selected ? sameDate(selected, date) : false
              const isCursor = cursor ? sameDate(cursor, date) : false
              const isToday = today ? sameDate(today, date) : false

              return (
                <button
                  key={date.day}
                  type="button"
                  aria-label={`${ETHIOPIAN_MONTHS[view.month - 1]} ${date.day}, ${view.year}`}
                  aria-current={isSelected ? 'date' : undefined}
                  tabIndex={isCursor ? 0 : -1}
                  onClick={() => commit(date)}
                  onFocus={() => {
                    if (!cursor || !sameDate(cursor, date)) setCursor(date)
                  }}
                  className={cx(
                    'h-8 rounded-[6px] text-[12px] focus:outline-none focus:ring-2 focus:ring-action-blue',
                    isSelected
                      ? 'bg-ink font-medium text-white'
                      : 'text-graphite hover:bg-paper',
                    !isSelected && isToday ? 'ring-1 ring-silver' : '',
                  )}
                >
                  {date.day}
                </button>
              )
            })}
          </div>

          <p className="mt-2 border-t border-silver pt-2 text-[11px] text-stone">
            {cursor ? formatDate(toIsoDate(toGregorian(cursor))) : null}
          </p>
        </div>
      ) : null}
    </div>
  )
}

function MonthStep({
  label,
  icon,
  onClick,
}: {
  label: string
  icon: 'arrowLeft' | 'arrowRight'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="rounded-[6px] p-1.5 text-stone hover:bg-paper hover:text-graphite focus:outline-none focus:ring-2 focus:ring-action-blue"
    >
      <Icon name={icon} className="h-4 w-4" />
    </button>
  )
}
