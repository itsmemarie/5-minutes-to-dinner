import { TodayTag } from '5-minutes-to-dinner'

export const Default = () => <TodayTag />
export const InRow = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: 260 }}>
    <span>Chicken Stir-Fry</span>
    <TodayTag />
  </div>
)
