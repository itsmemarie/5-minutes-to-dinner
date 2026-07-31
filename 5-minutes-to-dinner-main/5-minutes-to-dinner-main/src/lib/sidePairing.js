const NOT_RECOMMENDED = 'Not Recommended'

export function parseSideNames(text){
  if(!text)return []
  return text.split(/[,;]/).map(s=>s.trim()).filter(s=>s&&s!==NOT_RECOMMENDED)
}

export function formatSideNames(names){
  if(names.length===0)return ''
  if(names.length===1)return names[0]
  if(names.length===2)return `${names[0]} or ${names[1]}`
  return `${names.slice(0,-1).join(', ')} or ${names[names.length-1]}`
}

// Many recipe names carry a trailing " | CODE" id suffix (e.g. "Simple Green Salad | MP-SMPL")
// while side_recommendation stores the plain name — strip the suffix before comparing.
const normalize=name=>name.replace(/\s*\|[^|]*$/,'').trim().toLowerCase()

export function matchSideRecipes(names, recipes){
  const sides=recipes.filter(r=>r.cat==='Sides')
  const seen=new Set()
  const out=[]
  names.forEach(name=>{
    const target=name.toLowerCase()
    const match=sides.find(r=>normalize(r.name)===target)
    if(match&&!seen.has(match.id)){seen.add(match.id);out.push(match)}
  })
  return out
}
