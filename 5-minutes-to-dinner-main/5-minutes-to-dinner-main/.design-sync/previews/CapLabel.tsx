import { CapLabel } from '5-minutes-to-dinner'

export const Default = () => <CapLabel text="4p" />
export const InRow = () => (
  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
    <CapLabel text="Breakfast" />
    <span style={{ fontSize: 11, color: '#3f4947' }}>🕒 15m</span>
  </div>
)
