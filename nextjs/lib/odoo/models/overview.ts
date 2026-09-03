import 'server-only'
import { cache } from 'react'
import { searchCount, searchRead } from '@/lib/odoo/client'
import { orNullOnRefusal } from '@/lib/odoo/errors'
import {
  aggregate,
  crossTab,
  groupBy,
  rollUp,
  series,
  type Bucket,
  type CrossTabPeriod,
  type Series,
} from '@/lib/odoo/analytics'
import { todayIso } from '@/lib/format'
import { m2oId, type Domain, type Many2one } from '@/lib/odoo/types'

/**
 * The school overview — everything the command-centre dashboard renders.
 *
 * This module exists to answer one architectural question: how does a screen
 * showing twenty different figures avoid making twenty sequential round trips?
 *
 * The answer is that each read is a `cache()`d function returning a plain,
 * already-normalised shape, and the role dashboards start every read they need
 * in a single `Promise.all`. Nothing here awaits anything else in this file, so
 * the wall-clock cost is the slowest query rather than the sum of all of them.
 * `cache()` then means a figure asked for by both a KPI tile and a chart is
 * fetched once per request, not once per component.
 *
 * The counts are deliberately *not* separate `search_count` calls sitting
 * beside the breakdowns. A total that is the sum of its own buckets cannot
 * disagree with them; two independent queries can, and eventually will, when a
 * record rule or a domain differs by a hair.
 */

/* ---------------------------------------------------------------- scope --- */

/**
 * The academic year and term the dashboard is looking at.
 *
 * Not every model carries `academic_year_id` — attendance is dated and has no
 * term at all — so the scope is applied per model by the helpers below rather
 * than as one universal domain. Applying a term filter to a model that has no
 * term would silently return nothing, which reads as "no data" and is a lie.
 */
export interface Scope {
  yearId: number | null
  termId: number | null
  /** The chosen term's date range, for the models that are dated, not termed. */
  termRange: { start: string; end: string } | null
}

export const EMPTY_SCOPE: Scope = { yearId: null, termId: null, termRange: null }

/** Domain fragment for models that carry `academic_year_id`. */
function inYear(scope: Scope): Domain {
  return scope.yearId ? [['academic_year_id', '=', scope.yearId]] : []
}

/** Domain fragment for models that carry `term_id`, plus the year above it. */
function inTerm(scope: Scope): Domain {
  return [...inYear(scope), ...(scope.termId ? [['term_id', '=', scope.termId]] : [])]
}

/** Domain fragment for dated models, which is how a term reaches attendance. */
function inTermDates(scope: Scope, field = 'date'): Domain {
  if (!scope.termRange) return []
  return [
    [field, '>=', scope.termRange.start],
    [field, '<=', scope.termRange.end],
  ]
}

/* -------------------------------------------------------- academic year --- */

export interface Period {
  id: number
  name: string
}

export interface AcademicPeriods {
  years: Period[]
  terms: Array<Period & { academic_year_id: Many2one; date_start: string; date_end: string }>
  /** Odoo's own `is_current` year, and the term whose dates contain today. */
  currentYearId: number | null
  currentTermId: number | null
}

/**
 * The years and terms the dashboard may be scoped to.
 *
 * Both lists come from Odoo and both may be empty — a Director cannot read
 * either model, so the context selector simply does not appear for them rather
 * than showing a year that was guessed.
 *
 * The current year is Odoo's `is_current` flag, which a constraint keeps
 * unique. Terms carry no equivalent flag, so "current" is the term whose date
 * range contains today: a query, not a rule invented here.
 */
export const academicPeriods = cache(async (): Promise<AcademicPeriods> => {
  const today = todayIso()
  const [years, terms] = await Promise.all([
    orNullOnRefusal(
      searchRead<Period & { is_current: boolean }>(
        'school.academic.year',
        ['name', 'is_current'],
        { limit: 20, order: 'date_start desc', withTotal: false },
      ),
    ),
    orNullOnRefusal(
      searchRead<AcademicPeriods['terms'][number]>(
        'school.term',
        ['name', 'academic_year_id', 'date_start', 'date_end'],
        { domain: [['active', '=', true]], limit: 60, order: 'date_start', withTotal: false },
      ),
    ),
  ])

  const yearRows = years?.rows ?? []
  const termRows = terms?.rows ?? []
  return {
    years: yearRows.map(({ id, name }) => ({ id, name })),
    terms: termRows,
    currentYearId: yearRows.find((year) => year.is_current)?.id ?? null,
    currentTermId:
      termRows.find((term) => term.date_start <= today && term.date_end >= today)?.id ?? null,
  }
})

/**
 * Turn the URL's `?year=&term=` into a scope, refusing anything Odoo did not
 * offer.
 *
 * The ids are validated against the lists above rather than trusted, so a
 * hand-edited query string cannot widen the domain to a year this role was
 * never shown. It would not breach anything — Odoo applies its own rules to
 * every query regardless — but a filter that silently ignores its own
 * allowlist is the kind of thing that later becomes one that matters.
 */
export async function resolveScope(params: {
  year?: string
  term?: string
}): Promise<Scope & { periods: AcademicPeriods }> {
  const periods = await academicPeriods()

  const requestedYear = Number(params.year)
  const yearId =
    params.year === 'all'
      ? null
      : (periods.years.find((year) => year.id === requestedYear)?.id ??
        periods.currentYearId ??
        null)

  const requestedTerm = Number(params.term)
  const term =
    params.term === 'all'
      ? null
      : (periods.terms.find(
          (candidate) =>
            candidate.id === requestedTerm &&
            // A term from a different year is not a narrowing, it is a mismatch.
            (!yearId || m2oId(candidate.academic_year_id) === yearId),
        ) ??
        periods.terms.find((candidate) => candidate.id === periods.currentTermId && !params.term) ??
        null)

  return {
    periods,
    yearId,
    termId: term?.id ?? null,
    termRange: term ? { start: term.date_start, end: term.date_end } : null,
  }
}

/* -------------------------------------------------------------- students --- */

export interface StudentOverview {
  /** The sum of the lifecycle buckets — one query, one consistent total. */
  total: number | null
  active: number | null
  byLifecycle: Bucket[] | null
  byRegistration: Bucket[] | null
  byGrade: Bucket[] | null
  /** Registrations per month. Fewer than two months is not a trend. */
  intake: Series | null
}

export const studentOverview = cache(async (scope: Scope): Promise<StudentOverview> => {
  const domain = inYear(scope)
  const [byLifecycle, byRegistration, byClass, classes, intake] = await Promise.all([
    groupBy('school.student', 'lifecycle_status', { domain }),
    groupBy('school.student', 'registration_status', { domain }),
    groupBy('school.student', 'class_id', { domain }),
    gradedClasses(),
    series('school.student', 'registration_date', 'month', { domain, limit: 12 }),
  ])

  return {
    total: byLifecycle ? sum(byLifecycle) : null,
    active: byLifecycle
      ? (byLifecycle.find((bucket) => bucket.value === 'active')?.count ?? 0)
      : null,
    byLifecycle,
    byRegistration,
    /*
      Students carry a class, not a grade, and `class_grade_level` is a
      non-stored related field that Odoo cannot group by. The grade totals are
      therefore the class totals rolled up through the classes — still two
      aggregate queries, still Odoo's own numbers, and it stays two queries
      whether the school has three classes or three hundred.
    */
    byGrade: byClass && classes ? rollUp(byClass, classes) : null,
    intake,
  }
})

/** Classes keyed for roll-up, ordered by the grade's own sequence. */
const gradedClasses = cache(async () => {
  const page = await orNullOnRefusal(
    searchRead<{ id: number; name: string; grade_id: Many2one }>(
      'school.class',
      ['name', 'grade_id'],
      { limit: 500, order: 'name', withTotal: false },
    ),
  )
  if (!page) return null

  const grades = await orNullOnRefusal(
    searchRead<{ id: number; name: string; sequence: number }>(
      'school.grade',
      ['name', 'sequence'],
      { limit: 100, order: 'sequence', withTotal: false },
    ),
  )
  // Grade order is `sequence` on the grade, not the alphabet: sorting by name
  // puts Grade 10 between Grade 1 and Grade 2.
  const order = new Map((grades?.rows ?? []).map((grade) => [grade.id, grade.sequence]))

  return page.rows.map((row) => ({
    id: row.id,
    key: row.grade_id ? String(row.grade_id[0]) : '',
    label: row.grade_id ? row.grade_id[1] : 'No grade',
    sequence: row.grade_id ? (order.get(row.grade_id[0]) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER,
  }))
})

/* ----------------------------------------------------------------- staff --- */

export interface StaffOverview {
  total: number | null
  active: number | null
  byDepartment: Bucket[] | null
  byState: Bucket[] | null
  teachers: number | null
  activeTeachers: number | null
}

export const staffOverview = cache(async (): Promise<StaffOverview> => {
  const [byDepartment, byState, byTeachingStatus] = await Promise.all([
    groupBy('school.staff', 'department'),
    groupBy('school.staff', 'state'),
    groupBy('school.teacher', 'teaching_status'),
  ])

  return {
    total: byState ? sum(byState) : null,
    active: byState ? (byState.find((bucket) => bucket.value === 'active')?.count ?? 0) : null,
    byDepartment,
    byState,
    teachers: byTeachingStatus ? sum(byTeachingStatus) : null,
    activeTeachers: byTeachingStatus
      ? (byTeachingStatus.find((bucket) => bucket.value === 'active')?.count ?? 0)
      : null,
  }
})

/* ------------------------------------------------------------- structure --- */

export interface StructureOverview {
  classes: number | null
  classesByGrade: Bucket[] | null
  seats: number | null
  grades: number | null
  subjects: number | null
  sections: number | null
  streams: number | null
}

/**
 * The shape of the school: how many classes sit under each grade, and how many
 * seats they hold.
 *
 * The class total and the seat total both come out of the same grouped query
 * as the per-grade bars, so the headline cannot disagree with the chart under
 * it.
 */
export const structureOverview = cache(async (scope: Scope): Promise<StructureOverview> => {
  const domain = inYear(scope)
  const [classesByGrade, subjects, sections, streams] = await Promise.all([
    groupBy('school.class', 'grade_id', { domain, measure: 'capacity:sum' }),
    countOf('school.subject'),
    countOf('school.section'),
    countOf('school.stream'),
  ])

  return {
    classes: classesByGrade ? sum(classesByGrade) : null,
    classesByGrade,
    seats: classesByGrade
      ? classesByGrade.reduce((total, bucket) => total + (bucket.measure ?? 0), 0)
      : null,
    // Grades *in use this year*, which is the number that matches the bars —
    // not every grade the school has ever configured.
    grades: classesByGrade ? classesByGrade.filter((bucket) => bucket.value).length : null,
    subjects,
    sections,
    streams,
  }
})

/* ------------------------------------------------------------ attendance --- */

export interface AttendanceOverview {
  /** Today's register by status. Empty array means nobody took one today. */
  today: Bucket[] | null
  todayTotal: number
  presentRate: number | null
  trend: CrossTabPeriod[] | null
}

/**
 * Attendance today, and the run of days behind it.
 *
 * The present rate is null rather than 0 when no register exists — a school
 * where nobody has taken the register is not a school with nobody present, and
 * showing "0%" for it is the single most misleading thing this dashboard could
 * do.
 */
export const attendanceOverview = cache(async (scope: Scope): Promise<AttendanceOverview> => {
  const today = todayIso()
  const [todayBuckets, trend] = await Promise.all([
    groupBy('school.attendance', 'status', { domain: [['date', '=', today]] }),
    crossTab('school.attendance', 'date', 'day', 'status', {
      domain: inTermDates(scope),
      limit: 14,
    }),
  ])

  const todayTotal = todayBuckets ? sum(todayBuckets) : 0
  const present = todayBuckets?.find((bucket) => bucket.value === 'present')?.count ?? 0

  return {
    today: todayBuckets,
    todayTotal,
    presentRate: todayTotal > 0 ? (present / todayTotal) * 100 : null,
    trend,
  }
})

/* ----------------------------------------------------------- performance --- */

export interface PerformanceOverview {
  /** Mean mark percentage, with the number of marks it averages over. */
  overall: { value: number; count: number } | null
  byGrade: Bucket[] | null
  bySubject: Bucket[] | null
  assessments: Bucket[] | null
  reportCards: Bucket[] | null
}

export const performanceOverview = cache(async (scope: Scope): Promise<PerformanceOverview> => {
  const termed = inTerm(scope)
  const [overall, byGrade, bySubject, assessments, reportCards] = await Promise.all([
    aggregate('school.mark', 'percentage:avg', termed),
    groupBy('school.report.card', 'grade_id', {
      domain: termed,
      measure: 'overall_average:avg',
    }),
    groupBy('school.mark', 'subject_id', { domain: termed, measure: 'percentage:avg' }),
    groupBy('school.assessment', 'state', { domain: termed }),
    groupBy('school.report.card', 'state', { domain: termed }),
  ])

  return { overall, byGrade, bySubject, assessments, reportCards }
})

/* -------------------------------------------------------------- activity --- */

export interface ActivityEntry {
  id: number
  at: string
  model: string
  recordId: number
  recordName: string
  /** Odoo's own chatter line, or 'updated' for a bare tracking message. */
  what: string
  author: string
}

/**
 * Recent activity, from Odoo's chatter rather than from timestamps.
 *
 * `mail.message` is the real audit trail: every model in this addon inherits
 * `mail.thread`, so a creation or a state change already writes a message
 * carrying the model, the record, its display name, the author and the moment.
 * Reading it is one query for the whole feed, where scraping `write_date`
 * across eight models would be eight queries and would still not know *what*
 * had changed.
 *
 * It is also authorised for free: `mail.message` record rules only return
 * messages on records the reader may read, so a teacher's feed narrows to
 * their own classes without this code filtering anything.
 *
 * Tracking-only messages carry an empty body — Odoo renders those from
 * `tracking_value_ids`, which is refused below `base.group_system`. They are
 * shown as a plain "updated" rather than dropped or guessed at.
 */
export const recentActivity = cache(async (limit = 12): Promise<ActivityEntry[] | null> => {
  const page = await orNullOnRefusal(
    searchRead<{
      id: number
      date: string
      model: string
      res_id: number
      record_name: string | false
      body: string | false
      author_id: Many2one
    }>('mail.message', ['date', 'model', 'res_id', 'record_name', 'body', 'author_id'], {
      domain: [
        ['model', 'like', 'school.'],
        ['res_id', '!=', false],
      ],
      limit,
      order: 'date desc',
      withTotal: false,
    }),
  )
  if (!page) return null

  return page.rows.map((row) => ({
    id: row.id,
    at: row.date,
    model: row.model,
    recordId: row.res_id,
    recordName: row.record_name || 'Record',
    what: stripHtml(row.body || '') || 'updated',
    author: row.author_id ? row.author_id[1] : 'System',
  }))
})

/* -------------------------------------------------------------- helpers --- */

function sum(buckets: Bucket[]): number {
  return buckets.reduce((total, bucket) => total + bucket.count, 0)
}

/** A plain count that answers null rather than throwing when a role cannot read. */
function countOf(model: string, domain: Domain = []): Promise<number | null> {
  return orNullOnRefusal(searchCount(model, domain))
}

/**
 * Odoo's chatter bodies are HTML it wrote itself, not user input, but they
 * still have to become a single line of text. Tags out, entities in, collapsed.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}
