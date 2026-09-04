import { useState } from 'react'
import { RecipeCard } from '5-minutes-to-dinner'

const recipe = {
  id: 'r1', name: 'Slow-Roasted Tomato & Ricotta Pasta',
  base: 4, min: 2, prep: 15, diet: 'veg', hasSides: true, fun: true, husband: false,
}

export const Unselected = () => {
  const [selected, setSelected] = useState([])
  return (
    <RecipeCard
      r={recipe}
      selected={selected}
      onToggle={(id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
    />
  )
}
export const Selected = () => <RecipeCard r={recipe} selected={[recipe.id]} onToggle={() => {}} />
export const WithPreviewLink = () => <RecipeCard r={recipe} selected={[]} onToggle={() => {}} onPreview={() => {}} />
export const Disabled = () => <RecipeCard r={recipe} disabled selected={[recipe.id]} onToggle={() => {}} />
