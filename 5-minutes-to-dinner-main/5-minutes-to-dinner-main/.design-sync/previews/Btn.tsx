import { Btn } from '5-minutes-to-dinner'

export const Primary = () => <Btn label="Save Day" onClick={() => {}} />
export const Secondary = () => <Btn label="Cancel" secondary onClick={() => {}} />
export const Small = () => <Btn label="+ New Recipe" small onClick={() => {}} />
export const Full = () => (
  <div style={{ width: 280 }}>
    <Btn label="🛒 Generate Shopping List" full onClick={() => {}} />
  </div>
)
export const Disabled = () => <Btn label="Saving…" disabled onClick={() => {}} />
