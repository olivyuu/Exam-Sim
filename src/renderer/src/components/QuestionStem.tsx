import type { TextHighlight } from '../../../shared/types'
import { splitStemSegments, type LabTableRow } from '../../../parser/labFormat'
import { HighlightableText } from './HighlightableText'

function columnCount(rows: LabTableRow[]): number {
  return Math.max(
    2,
    ...rows.map((row) => {
      if (row.type === 'header') return Math.max(2, row.values.length + (row.values.length > 1 ? 1 : 0))
      if (row.type === 'row') return 1 + Math.max(row.values.length, 1)
      return 2
    })
  )
}

function LabTable({ rows }: { rows: LabTableRow[] }) {
  const cols = columnCount(rows)
  return (
    <div className="lab-table-wrap">
      <table className="lab-table">
        <tbody>
          {rows.map((row, index) => {
            if (row.type === 'section') {
              return (
                <tr key={index} className="lab-section">
                  <td colSpan={cols}>{row.label}</td>
                </tr>
              )
            }
            if (row.type === 'header') {
              const heads = row.values.length + 1 === cols ? ['', ...row.values] : row.values
              return (
                <tr key={index} className="lab-head">
                  {heads.map((head, headIndex) => (
                    <th key={headIndex}>{head}</th>
                  ))}
                </tr>
              )
            }
            const values = [...row.values]
            while (1 + values.length < cols) values.push('')
            return (
              <tr key={index}>
                <td className="lab-name">{row.name}</td>
                {values.map((value, valueIndex) => (
                  <td key={valueIndex} className="lab-val">
                    {value}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function shiftHighlights(highlights: TextHighlight[], start: number, length: number): TextHighlight[] {
  return highlights
    .map((highlight) => ({
      ...highlight,
      start: highlight.start - start,
      end: highlight.end - start
    }))
    .filter((highlight) => highlight.end > 0 && highlight.start < length)
    .map((highlight) => ({
      ...highlight,
      start: Math.max(0, highlight.start),
      end: Math.min(length, highlight.end)
    }))
}

export function QuestionStem({
  stem,
  highlights = [],
  enabled = false,
  onChange
}: {
  stem: string
  highlights?: TextHighlight[]
  enabled?: boolean
  onChange?: (next: TextHighlight[]) => void
}) {
  const segments = splitStemSegments(stem)

  return (
    <div className="question-stem">
      {segments.map((segment, index) => {
        if (segment.type === 'labs') return <LabTable key={index} rows={segment.rows} />
        const local = shiftHighlights(highlights, segment.start, segment.text.length)
        if (!onChange) {
          return (
            <div key={index} className="question-prose">
              {segment.text}
            </div>
          )
        }
        return (
          <HighlightableText
            key={index}
            text={segment.text}
            highlights={local}
            enabled={enabled}
            onChange={(next) => {
              const others = highlights.filter(
                (highlight) => highlight.end <= segment.start || highlight.start >= segment.start + segment.text.length
              )
              onChange([
                ...others,
                ...next.map((highlight) => ({
                  ...highlight,
                  start: highlight.start + segment.start,
                  end: highlight.end + segment.start
                }))
              ])
            }}
          />
        )
      })}
    </div>
  )
}
