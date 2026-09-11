// ─── Design tokens ────────────────────────────────────────────────
export const C = {
  primary:'#2d602f', onPrimary:'#fff', primaryFixed:'#eaf6ea',
  secondaryContainer:'#fff1e6', onSecondaryContainer:'#e07a34',
  // Accessible text colour for 12px/700 text on #fff1e6
  onSecondaryContainerStrong:'#924b1a',
  tertiary:'#e07a34', tertiaryFixed:'#fff1e6', onTertiaryFixed:'#e07a34',
  error:'#ba1a1a', errorContainer:'#ffdad6',
  surface:'#f3f8f2', white:'#fff', surfaceContainerHigh:'#eaf6ea',
  onSurface:'#182417', onSurfaceVariant:'#5c6a58',
  outline:'#5c6a58', outlineVariant:'#c8d6c5',
  // Settings list chrome: chevrons and drag handles, a disabled row label, and a
  // destructive-label red that sits better on the green ground than `error`.
  outlineStrong:'#a4b3a0', onSurfaceDisabled:'#7a8877', errorInk:'#a3341f',
  accent2_100:'#fff3e8', accent2_300:'#f0c090', accent2_600:'#d9791f',
  accent2_700:'#b85f16', accent2_800:'#8a4410',
  // Striped stand-in for a recipe photo we don't have yet (photo tile view).
  placeholderStripeA:'#e7efe5', placeholderStripeB:'#dde8db', placeholderInk:'#8c9a88',
}
export const ep = {fontFamily:"'Caprasimo',cursive",fontWeight:400,letterSpacing:'-0.015em'}
export const mn = {fontFamily:"'Figtree',sans-serif"}
export const R = {sm:8, md:10, lg:14, pill:99}
// Top-level tab screen title (This week / Weekly planner / Shopping list / Batch cooking) — keep these matched.
export const screenTitle = {...ep,fontSize:28}
export const CARD = {background:'#fff',borderRadius:R.md,boxShadow:'0 1px 2px rgba(24,36,23,0.14)'}
export const TAG_C = {
  TM6:{bg:'#FFF5E0',tx:'#A86000',bd:'#F5C842'}, HOB:{bg:'#EEF4FF',tx:'#0050A0',bd:'#90C0F5'},
  OVEN:{bg:'#FFF0EE',tx:'#B83000',bd:'#F5A090'}, KNIFE:{bg:'#F4F4F0',tx:'#444',bd:'#CCCCCC'},
  NO_COOK:{bg:'#F0FFF4',tx:'#1A7A3A',bd:'#7FD4A0'}, DONE:{bg:'#1C1C1A',tx:'#F5F0E8',bd:'#1C1C1A'},
}
