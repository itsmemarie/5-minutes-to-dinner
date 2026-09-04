import { useState } from 'react'
import { RecipeBucket } from '5-minutes-to-dinner'

const items = [
  { id: 'r1', name: 'Slow-Roasted Tomato & Ricotta Pasta', base: 4, min: 2, prep: 15, diet: 'veg', hasSides: true, fun: true, husband: false },
  { id: 'r2', name: 'Chicken Stir-Fry', base: 4, min: 2, prep: 20, diet: 'omni', hasSides: false, fun: false, husband: true },
  { id: 'r3', name: 'Lentil & Sweet Potato Curry', base: 4, min: 4, prep: 25, diet: 'vegan', hasSides: false, fun: false, husband: false },
]

export const Default = () => {
  const [selected, setSelected] = useState([])
  return (
    <RecipeBucket
      title="Default"
      items={items}
      selected={selected}
      onToggle={(id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
    />
  )
}
export const WithPreviewLinks = () => <RecipeBucket title="Try Out" items={items} selected={[]} onToggle={() => {}} onPreview={() => {}} />
