/**
 * What the dashboard looks like while Odoo is answering.
 *
 * The command centre makes upwards of thirty aggregate queries, all in
 * parallel, and on a loaded Odoo that is most of a second. Next streams this
 * in immediately and swaps the real page in when the data lands, so the
 * navigation is acknowledged at once instead of leaving the previous screen up
 * with nothing happening.
 *
 * The skeleton mirrors the real layout — a header, a band of four tiles, then
 * panels — because a placeholder that does not match the shape it precedes
 * makes the swap feel like a second page load rather than the same one
 * arriving.
 *
 * It is announced rather than only drawn: the bars mean nothing to a screen
 * reader, so `role="status"` carries the words.
 */
export default function DashboardLoading() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading your dashboard</span>

      <header className="mb-5" aria-hidden>
        <div className="h-[30px] w-64 rounded-[8px] bg-silver/70" />
        <div className="mt-2 h-[16px] w-40 rounded-[6px] bg-silver/50" />
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-silver/70 pt-3.5">
          <div className="h-[16px] w-36 rounded-[6px] bg-silver/50" />
          <div className="flex gap-2">
            <div className="h-[30px] w-28 rounded-[8px] bg-silver/50" />
            <div className="h-[30px] w-24 rounded-[8px] bg-silver/50" />
          </div>
        </div>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden>
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="rounded-[12px] border border-silver/80 bg-white p-4">
            <div className="h-[12px] w-20 rounded-[4px] bg-silver/60" />
            <div className="mt-3 h-[26px] w-16 rounded-[6px] bg-silver/70" />
            <div className="mt-3 h-[10px] w-24 rounded-[4px] bg-silver/40" />
          </div>
        ))}
      </div>

      {[0, 1].map((band) => (
        <div key={band} className="mb-4" aria-hidden>
          <div className="mb-2.5 h-[13px] w-32 rounded-[4px] bg-silver/60" />
          <div className="grid items-start gap-3 lg:grid-cols-3">
            {[0, 1, 2].map((panel) => (
              <div
                key={panel}
                className="rounded-[12px] border border-silver/80 bg-white p-4"
                style={{ minHeight: 168 }}
              >
                <div className="h-[15px] w-36 rounded-[4px] bg-silver/60" />
                <div className="mt-4 space-y-2.5">
                  {[0, 1, 2, 3].map((row) => (
                    <div key={row}>
                      <div className="h-[11px] w-28 rounded-[4px] bg-silver/40" />
                      <div className="mt-1.5 h-1.5 rounded-full bg-silver/50" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
