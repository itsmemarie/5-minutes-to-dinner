import { PillBtn } from '5-minutes-to-dinner'

export const Active = () => <PillBtn label="Mains" active onClick={() => {}} />
export const Inactive = () => <PillBtn label="❄ Freezer" onClick={() => {}} />
export const Group = () => (
  <div style={{ display: 'flex', gap: 8 }}>
    <PillBtn label="Mains" active onClick={() => {}} />
    <PillBtn label="❄ Freezer" onClick={() => {}} />
    <PillBtn label="⊟ Filter" onClick={() => {}} />
  </div>
)
