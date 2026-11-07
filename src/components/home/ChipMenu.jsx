import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { C, mn, R } from '../../lib/theme.js'
import { visibleEdges } from '../../lib/useTrayDrag.js'
import { Icon } from '../ui/index.js'

const GAP = 4
const EDGE = 8
const MENU_WIDTH = 198
const SCROLL_SLOP = 4
const CHIP_PAD = { padding:'4px 10px', borderWidth:1 }
const OPEN_PAD = { padding:'3.5px 9.5px', borderWidth:1.5 }

// A dropdown chip. `look` is { background, color, borderColor, icon, label } for
// its current state; `items` are { value, label, icon?, iconColor?, labelColor? }.
// The menu sits in a portal, so day cards can't clip it and it can flip above the
// chip near the bottom of the screen. Its backdrop catches an outside tap, so closing
// the menu can't also open the recipe underneath, and only one menu can be open.
export function ChipMenu({ look, items, value, label, onPick }) {
  const [open, setOpen] = useState(false)
  const [place, setPlace] = useState(null)   // { left, top }
  const chip = useRef(null)
  const pill = useRef(null)
  const menu = useRef(null)

  const close = refocus => {
    setOpen(false)
    setPlace(null)
    if (refocus) chip.current?.focus({ preventScroll:true })
  }

  useLayoutEffect(() => {
    if (!open) return
    const box = pill.current.getBoundingClientRect()
    const height = menu.current.offsetHeight
    const { top, bottom } = visibleEdges()
    const fitsBelow = box.bottom + GAP + height <= bottom
    const fitsAbove = box.top - GAP - height >= top
    setPlace({
      left: Math.max(EDGE, Math.min(box.left, window.innerWidth - MENU_WIDTH - EDGE)),
      top: fitsBelow ? box.bottom + GAP : fitsAbove ? box.top - GAP - height : Math.max(top + EDGE, bottom - height - EDGE),
    })
  }, [open])

  // The current choice takes focus, or the first item. preventScroll, or moving the
  // focus could count as the scroll that closes the menu.
  const placed = !!place
  useEffect(() => {
    if (!placed) return
    const at = Math.max(0, items.findIndex(i => i.value === value))
    menu.current?.querySelectorAll('[role="menuitemradio"]')[at]?.focus({ preventScroll:true })
  }, [placed])

  useEffect(() => {
    if (!open) return
    // A list still settling when the chip was tapped sends a scroll event or two,
    // so only a page that has really moved closes the menu.
    const openedAt = window.scrollY
    const onScroll = () => { if (Math.abs(window.scrollY - openedAt) > SCROLL_SLOP) close(false) }
    const onResize = () => close(false)
    window.addEventListener('scroll', onScroll, { capture:true, passive:true })
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll, { capture:true })
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  const onMenuKey = e => {
    const buttons = [...menu.current.querySelectorAll('[role="menuitemradio"]')]
    const at = buttons.indexOf(document.activeElement)
    const move = { ArrowDown:at + 1, ArrowUp:at - 1, Home:0, End:buttons.length - 1 }[e.key]
    if (move !== undefined) { e.preventDefault(); buttons[(move + buttons.length) % buttons.length].focus({ preventScroll:true }) }
    else if (e.key === 'Escape') { e.preventDefault(); close(true) }
    else if (e.key === 'Tab') close(false)
  }

  const pick = v => { close(true); onPick(v) }

  return (
    <>
      <button ref={chip} type='button' aria-haspopup='menu' aria-expanded={open} aria-label={label}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={e => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true) } }}
        style={{ border:'none', background:'none', padding:'5px 0', margin:0, cursor:'pointer', display:'inline-flex', minWidth:0, WebkitTapHighlightColor:'transparent' }}>
        <span ref={pill} style={{ ...mn, ...(open ? OPEN_PAD : CHIP_PAD), borderStyle:'solid', boxSizing:'border-box', minHeight:30, display:'inline-flex', alignItems:'center', gap:5, borderRadius:R.pill, fontSize:12, fontWeight:700, whiteSpace:'nowrap', background:look.background, color:open && !value ? C.onSurface : look.color, borderColor:open ? C.primary : look.borderColor }}>
          {look.icon && <Icon name={look.icon} size={13}/>}
          {look.label}
          <span style={{ display:'flex', transform:open ? 'rotate(180deg)' : undefined }}><Icon name='chevronDown' size={11}/></span>
        </span>
      </button>
      {open && createPortal(
        <div data-no-drag>
          <div onClick={() => close(false)} style={{ position:'fixed', inset:0, zIndex:60 }}/>
          <div ref={menu} role='menu' aria-label={label} onKeyDown={onMenuKey}
            style={{ ...mn, position:'fixed', zIndex:61, left:place?.left ?? 0, top:place?.top ?? 0, visibility:place ? 'visible' : 'hidden', width:MENU_WIDTH, boxSizing:'border-box', background:C.white, borderRadius:R.md, padding:4, boxShadow:'0 1px 2px rgba(24,36,23,.14), 0 12px 32px rgba(24,36,23,.16)' }}>
            {items.map(item => {
              const selected = item.value === value
              return (
                <button key={item.value} type='button' role='menuitemradio' aria-checked={selected} tabIndex={-1} onClick={() => pick(item.value)}
                  style={{ ...mn, width:'100%', height:44, display:'flex', alignItems:'center', gap:10, padding:'0 12px', border:'none', borderRadius:R.sm, background:selected ? C.primaryFixed : 'none', color:item.labelColor ?? C.onSurface, fontSize:14, fontWeight:600, textAlign:'left', cursor:'pointer' }}>
                  {item.icon && <Icon name={item.icon} size={17} color={item.iconColor}/>}
                  <span style={{ flex:1 }}>{item.label}</span>
                  {selected && <Icon name='check' size={15} color={C.primary}/>}
                </button>
              )
            })}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
