import { C, mn, R } from '../../lib/theme.js'
import { Icon } from './Icon.jsx'

// `strong` uses the accessible darker orange when the pill isn't selected.
export function PillBtn({label,active,onClick,icon,iconSize=13,strong}){
  const color=active?C.onPrimary:strong?C.onSecondaryContainerStrong:C.onSecondaryContainer
  return (
    <button onClick={onClick} style={{...mn,background:active?C.primary:C.secondaryContainer,color,border:'none',borderRadius:R.pill,padding:'7px 14px',fontSize:13,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,display:'inline-flex',alignItems:'center',gap:6}}>
      {icon&&<Icon name={icon} size={iconSize} color={color}/>}
      {label}
    </button>
  )
}
