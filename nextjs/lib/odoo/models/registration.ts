import 'server-only'
import { callKw, create, searchRead, write } from '@/lib/odoo/client'
import { orNullOnRefusal } from '@/lib/odoo/errors'
import type { Many2one, Page, Selection } from '@/lib/odoo/types'

/**
 * The registration questionnaire and the required-document rules.
 *
 * Both are enforced by `school.student._validate_submission_requirements`,
 * which refuses to submit a registration while any applicable question is
 * unanswered or any required document type is missing — naming each one. Until
 * now neither could be configured or answered anywhere in this app, so the
 * only way out of such a refusal was the Odoo backend.
 *
 * Applicability is Odoo's rule, restated here once so the student page asks
 * exactly the questions the submission check will demand: active, required,
 * the grade inside [grade_from, grade_to], the admission type matching or
 * 'all', and the stream either unset on the question or equal to the
 * student's.
 */

/* ------------------------------------------------------------ questions --- */

export interface QuestionRow {
  id: number
  name: string
  code: string
  sequence: number
  answer_type: Selection
  option_ids: number[]
  grade_from: number
  grade_to: number
  admission_type: Selection
  stream_id: Many2one
  support_need_only: boolean
  required: boolean
  active: boolean
}

const QUESTION_FIELDS = [
  'name', 'code', 'sequence', 'answer_type', 'option_ids', 'grade_from',
  'grade_to', 'admission_type', 'stream_id', 'support_need_only', 'required', 'active',
] as const

export function listQuestions(): Promise<Page<QuestionRow> | null> {
  return orNullOnRefusal(
    searchRead<QuestionRow>('school.registration.question', QUESTION_FIELDS, {
      // Retired questions still have to be visible to be brought back.
      context: { active_test: false },
      order: 'sequence, id',
      limit: 200,
    }),
  )
}

export function getQuestion(id: number): Promise<QuestionRow | null> {
  return orNullOnRefusal(
    searchRead<QuestionRow>('school.registration.question', QUESTION_FIELDS, {
      domain: [['id', '=', id]],
      context: { active_test: false },
      limit: 1,
    }).then((page) => page.rows[0] ?? null),
  )
}

export function createQuestion(values: Record<string, unknown>): Promise<number> {
  return create('school.registration.question', values)
}

export function updateQuestion(id: number, values: Record<string, unknown>): Promise<boolean> {
  return write('school.registration.question', [id], values)
}

/* -------------------------------------------------------------- options --- */

export interface OptionRow {
  id: number
  question_id: Many2one
  name: string
  value: string
  sequence: number
}

export function listOptions(questionId: number): Promise<Page<OptionRow> | null> {
  return orNullOnRefusal(
    searchRead<OptionRow>(
      'school.registration.question.option',
      ['question_id', 'name', 'value', 'sequence'],
      { domain: [['question_id', '=', questionId]], order: 'sequence, name', limit: 100 },
    ),
  )
}

export function addOption(
  questionId: number,
  option: { name: string; value: string; sequence?: number },
): Promise<number> {
  return create('school.registration.question.option', { question_id: questionId, ...option })
}

export function removeOption(id: number): Promise<boolean> {
  return callKw<boolean>('school.registration.question.option', 'unlink', [[id]])
}

/* -------------------------------------------------------------- answers --- */

export interface AnswerRow {
  id: number
  question_id: Many2one
  value_text: string | false
  option_id: Many2one
}

export function listAnswers(studentId: number): Promise<Page<AnswerRow> | null> {
  return orNullOnRefusal(
    searchRead<AnswerRow>(
      'school.registration.answer',
      ['question_id', 'value_text', 'option_id'],
      { domain: [['student_id', '=', studentId]], limit: 200 },
    ),
  )
}

/**
 * The questions this student actually has to answer.
 *
 * The domain mirrors `_validate_submission_requirements` exactly, minus the
 * `required` clause: an optional question still belongs on the form, it just
 * will not block submission. Answering happens against this list, so the page
 * can never ask for something the check does not want or omit something it does.
 */
export function listApplicableQuestions(scope: {
  gradeLevel: number
  admissionType: string
  streamId: number | null
}): Promise<Page<QuestionRow> | null> {
  return orNullOnRefusal(
    searchRead<QuestionRow>('school.registration.question', QUESTION_FIELDS, {
      domain: [
        ['active', '=', true],
        ['grade_from', '<=', scope.gradeLevel || 12],
        ['grade_to', '>=', scope.gradeLevel || 1],
        ['admission_type', 'in', ['all', scope.admissionType]],
        '|',
        ['stream_id', '=', false],
        ['stream_id', '=', scope.streamId ?? false],
      ],
      order: 'sequence, id',
      limit: 200,
    }),
  )
}

/**
 * Record one answer.
 *
 * `unique(student_id, question_id)` means an answer is created once and
 * written thereafter, so the caller passes the existing id when there is one.
 * Odoo's `_check_option_question` rejects an option belonging to a different
 * question, which is why the option is sent as an id rather than a label.
 */
export function saveAnswer(
  studentId: number,
  questionId: number,
  answer: { id?: number; value_text?: string | false; option_id?: number | false },
): Promise<number | boolean> {
  const values = {
    value_text: answer.value_text ?? false,
    option_id: answer.option_id ?? false,
  }
  return answer.id
    ? write('school.registration.answer', [answer.id], values)
    : create('school.registration.answer', {
        student_id: studentId,
        question_id: questionId,
        ...values,
      })
}

/* ------------------------------------------------------- document rules --- */

export interface DocumentRuleRow {
  id: number
  document_type_id: Many2one
  sequence: number
  admission_type: Selection
  grade_from: number
  grade_to: number
  stream_id: Many2one
  required: boolean
  active: boolean
}

export function listDocumentRules(): Promise<Page<DocumentRuleRow> | null> {
  return orNullOnRefusal(
    searchRead<DocumentRuleRow>(
      'school.document.rule',
      ['document_type_id', 'sequence', 'admission_type', 'grade_from', 'grade_to',
       'stream_id', 'required', 'active'],
      { context: { active_test: false }, order: 'sequence, id', limit: 200 },
    ),
  )
}

export function listDocumentTypes(): Promise<Page<{ id: number; name: string }> | null> {
  return orNullOnRefusal(
    searchRead<{ id: number; name: string }>('school.document.type', ['name'], {
      order: 'name',
      limit: 200,
    }),
  )
}

export function createDocumentRule(values: Record<string, unknown>): Promise<number> {
  return create('school.document.rule', values)
}

export function updateDocumentRule(
  id: number,
  values: Record<string, unknown>,
): Promise<boolean> {
  return write('school.document.rule', [id], values)
}

export function removeDocumentRule(id: number): Promise<boolean> {
  return callKw<boolean>('school.document.rule', 'unlink', [[id]])
}
