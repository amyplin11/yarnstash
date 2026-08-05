import { Yarn, StashYarn } from '@/lib/types'
import { Badge } from '@/app/components/ui/Badge'
import { Button } from '@/app/components/ui/Button'
import { YarnEmpty } from './YarnEmpty'

interface YarnTableProps {
  yarns: (Yarn | StashYarn)[]
  showAddButton?: boolean
  onAdd?: (yarnId: string) => void
  editable?: boolean
  onDelete?: (yarnId: string) => void
  emptyMessage?: string
}

/** Matches the card's swatch fallback for yarns with no photo. */
const SWATCH_FALLBACK = '#d8d0bd'

const headerStyles =
  'whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-soft'
const cellStyles = 'px-3 py-3 align-middle text-sm text-ink-muted'

/**
 * The dense counterpart to {@link YarnGrid} — same data, same props, one row
 * per yarn. Stash-specific columns (colorway, skeins, where it lives) only
 * appear when the rows are stash entries, mirroring how YarnCard branches on
 * the presence of `skeins`.
 */
export function YarnTable({
  yarns,
  showAddButton = false,
  onAdd,
  editable = false,
  onDelete,
  emptyMessage = 'No yarns found.',
}: YarnTableProps) {
  if (yarns.length === 0) {
    return <YarnEmpty message={emptyMessage} />
  }

  // Rows in one table are always the same kind, so the first one sets the shape.
  const stashColumns = 'skeins' in yarns[0]
  const showActions = (editable && !!onDelete) || (showAddButton && !!onAdd)

  return (
    // The table is wider than a phone; it scrolls itself rather than the page.
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className={headerStyles}>
              Yarn
            </th>
            {stashColumns && (
              <th scope="col" className={headerStyles}>
                Colorway
              </th>
            )}
            <th scope="col" className={headerStyles}>
              Weight
            </th>
            <th scope="col" className={headerStyles}>
              Fiber
            </th>
            {stashColumns && (
              <th scope="col" className={`${headerStyles} text-right`}>
                Skeins
              </th>
            )}
            <th scope="col" className={`${headerStyles} text-right`}>
              Yardage
            </th>
            {stashColumns && (
              <th scope="col" className={`${headerStyles} text-right`}>
                Price
              </th>
            )}
            {stashColumns && (
              <th scope="col" className={headerStyles}>
                Where it lives
              </th>
            )}
            {/*
              aria-label rather than an sr-only span: `sr-only` is absolutely
              positioned, so with no positioned ancestor it escapes the scroll
              container to the table's full width and drags the whole page into
              horizontal scroll on a phone.
            */}
            {showActions && (
              <th scope="col" aria-label="Actions" className={`${headerStyles} text-right`} />
            )}
          </tr>
        </thead>

        <tbody>
          {yarns.map((yarn) => {
            const isStashYarn = 'skeins' in yarn
            const yarnData = isStashYarn ? yarn.yarn : yarn
            const stashInfo = isStashYarn ? yarn : null

            const swatch =
              yarnData.colors && yarnData.colors.length > 0
                ? yarnData.colors[0].hexCode || SWATCH_FALLBACK
                : SWATCH_FALLBACK

            // Yardage is per skein, so the stash view totals it across them.
            const yardage = stashInfo
              ? yarnData.yardage * stashInfo.skeins
              : yarnData.yardage
            const price = stashInfo?.purchasePrice ?? yarnData.price

            return (
              <tr
                key={yarn.id}
                className="border-b border-line last:border-b-0 transition-colors hover:bg-parchment"
              >
                <td className={`${cellStyles} min-w-[200px]`}>
                  <div className="flex items-center gap-3">
                    {yarnData.imageUrl ? (
                      <img
                        src={yarnData.imageUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div
                        className="h-10 w-10 shrink-0 rounded-lg"
                        style={{ backgroundColor: swatch }}
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-ink-soft">
                        {yarnData.brand}
                      </p>
                      <p className="truncate font-medium text-ink">{yarnData.name}</p>
                    </div>
                  </div>
                </td>

                {stashColumns && (
                  <td className={cellStyles}>{stashInfo?.colorway || '—'}</td>
                )}

                <td className={cellStyles}>
                  <Badge text={yarnData.weight} variant="primary" />
                </td>

                <td className={`${cellStyles} max-w-[200px]`}>
                  {yarnData.fiberContent || '—'}
                </td>

                {stashColumns && (
                  <td className={`${cellStyles} text-right tabular-nums`}>
                    {stashInfo?.skeins ?? '—'}
                  </td>
                )}

                <td className={`${cellStyles} whitespace-nowrap text-right tabular-nums`}>
                  {yardage ? `${yardage.toLocaleString()} yds` : '—'}
                </td>

                {stashColumns && (
                  <td className={`${cellStyles} text-right tabular-nums`}>
                    {price ? `$${price.toFixed(2)}` : '—'}
                  </td>
                )}

                {stashColumns && (
                  <td className={cellStyles}>{stashInfo?.location || '—'}</td>
                )}

                {showActions && (
                  <td className={`${cellStyles} text-right`}>
                    {showAddButton && onAdd && (
                      <Button variant="outline" size="sm" onClick={() => onAdd(yarn.id)}>
                        Add to Stash
                      </Button>
                    )}
                    {editable && onDelete && (
                      <Button variant="outline" size="sm" onClick={() => onDelete(yarn.id)}>
                        Remove
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
