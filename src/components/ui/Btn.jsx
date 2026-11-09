import { C, mn, R } from '../../lib/theme.js'
import { Icon } from './Icon.jsx'

// `strong` swaps a secondary button's text for the accessible darker orange.
// `danger` is the filled destructive button. `icon` goes before the label, as on
// PillBtn. `ariaLabel` names the button for screen readers when the label alone
// doesn't say enough. `hit` adds a transparent area that lifts a small button's
// tap target to 44px without changing how it looks.
export function Btn({label,full,onClick,disabled,secondary,small,strong,danger,icon,iconSize=14,iconStroke,ariaLabel,hit}){
  const color=disabled?C.outline:secondary?(strong?C.onSecondaryContainerStrong:C.onSecondaryContainer):C.onPrimary
  const padding=small?(icon?'9px 16px 9px 13px':'9px 18px'):'13px 22px'
  return (
    <button onClick={disabled?undefined:onClick} aria-label={ariaLabel} style={{...mn,background:disabled?C.surfaceContainerHigh:danger?C.errorInk:secondary?C.secondaryContainer:C.primary,color,border:'none',borderRadius:R.pill,padding,fontSize:small?13:15,fontWeight:700,cursor:disabled?'not-allowed':'pointer',width:full?'100%':undefined,opacity:disabled?0.72:1,display:'inline-flex',alignItems:'center',justifyContent:'center',gap:icon?6:8,position:hit?'relative':undefined,whiteSpace:icon?'nowrap':undefined}}>
      {icon&&<Icon name={icon} size={iconSize} color={color} strokeWidth={iconStroke}/>}
      {label}
      {hit&&<span aria-hidden style={{position:'absolute',top:-6,bottom:-6,left:0,right:0}}/>}
    </button>
  )
}
