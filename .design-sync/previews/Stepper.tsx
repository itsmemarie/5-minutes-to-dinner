import { useState } from 'react'
import { Stepper } from '5-minutes-to-dinner'

export const Default = () => {
  const [v, setV] = useState(4)
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', width: 200 }}>
      <Stepper value={v} min={1} onChange={setV} />
    </div>
  )
}
export const AtMinimum = () => (
  <div style={{ display: 'flex', justifyContent: 'flex-end', width: 200 }}>
    <Stepper value={1} min={1} onChange={() => {}} />
  </div>
)
