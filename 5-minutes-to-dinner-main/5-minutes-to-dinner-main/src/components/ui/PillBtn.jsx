import { C, mn } from '../../lib/theme.js'
import { Icon } from './Icon.jsx'

export function PillBtn({label,active,onClick,icon}){
  const color=active?C.onPrimary:C.onSecondaryContainer
  return (
    <button onClick={onClick} style={{...mn,background:active?C.primary:C.secondaryContainer,color,border:'none',borderRadius:99,padding:'7px 14px',fontSize:13,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,display:'inline-flex',alignItems:'center',gap:6}}>
      {icon&&<Icon name={icon} size={13} color={color}/>}
      {label}
    </button>
  )
}
