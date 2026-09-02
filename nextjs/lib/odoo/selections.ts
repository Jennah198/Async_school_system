import 'server-only'
import { cache } from 'react'
import { callKw } from './client'
import { orNullOnRefusal } from './errors'

/**
 * Selection choices, read from Odoo rather than restated here.
 *
 * A filter dropdown has to offer exactly the values the model accepts. Copying
 * the list into TypeScript means it silently goes stale the next time somebody
 * adds a state — which has happened three times already in this module. Asking
 * `fields_get` costs one small call and also returns Odoo's own labels, which
 * are the translated ones.
 */

/**
 * Every selection field on one model, in one call.
 *
 * Keyed by model rather than by field on purpose. A screen that filters on
 * three selection fields of the same model used to make three round trips for
 * one dictionary; the dashboard, which groups by a dozen selection fields
 * across seven models, made a dozen. Asking for the whole model's metadata
 * costs no more than asking for one field of it — `attributes: ['selection']`
 * keeps the response to the selections themselves — so the call count is now
 * the number of models involved rather than the number of questions asked.
 *
 * `cache` dedupes within a single request, so this is one call per model per
 * render however many components ask.
 */
const selectionsFor = cache(
  async (model: string): Promise<Record<string, Array<{ value: string; label: string }>>> => {
    const meta = await orNullOnRefusal(
      callKw<Record<string, { selection?: Array<[string, string]> }>>(model, 'fields_get', [], {
        attributes: ['selection'],
      }),
    )
    // A role that cannot read the model gets no options rather than an error;
    // the list itself will already be explaining the refusal.
    if (!meta) return {}

    return Object.fromEntries(
      Object.entries(meta)
        .filter(([, field]) => Array.isArray(field.selection))
        .map(([name, field]) => [
          name,
          (field.selection ?? []).map(([value, label]) => ({ value, label })),
        ]),
    )
  },
)

/** The choices one selection field accepts, with Odoo's own labels. */
export async function selectionOptions(
  model: string,
  field: string,
): Promise<Array<{ value: string; label: string }>> {
  return (await selectionsFor(model))[field] ?? []
}

/** Several selection fields of one model, in one place — and now one call. */
export async function selectionFilters(
  model: string,
  fields: readonly string[],
): Promise<Record<string, Array<{ value: string; label: string }>>> {
  const all = await selectionsFor(model)
  return Object.fromEntries(fields.map((field) => [field, all[field] ?? []]))
}
