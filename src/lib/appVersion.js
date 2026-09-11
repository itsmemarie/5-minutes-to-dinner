// Version string for Settings › Account. The two globals are injected by
// vite.config.js at build time; the fallbacks keep tests and tooling that
// import this module outside Vite from throwing.
/* global __APP_VERSION__, __BUILD_ID__ */
const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'
const build   = typeof __BUILD_ID__   !== 'undefined' ? __BUILD_ID__   : 'dev'

export const APP_VERSION_LABEL = `${version} · build ${build}`
