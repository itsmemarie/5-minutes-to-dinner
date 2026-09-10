import { C, R } from '../../lib/theme.js'
import { scaleText } from '../../lib/quantityScaling.js'

// Renders recipe prose with rescaled amounts tinted, so it's obvious which
// numbers the app adjusted — and by implication which (times, oven temps,
// Thermomix speeds) it deliberately left alone.
export function ScaledText({ text, scale, knownQtys, style }) {
  const segments = scaleText(text, scale, knownQtys)
  return (
    <>
      {segments.map((s, i) => s.scaled ? (
        <span
          key={i}
          title={s.was ? `was ${s.was}` : undefined}
          style={{ background: C.primaryFixed, color: C.primary, fontWeight: 700, borderRadius: R.sm, padding: '0 3px', ...style }}
        >{s.t}</span>
      ) : (
        <span key={i}>{s.t}</span>
      ))}
    </>
  )
}
