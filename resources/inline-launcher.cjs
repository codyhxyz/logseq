// Separate app profile, graph storage, plugins, and CLI metadata from stock Logseq.
const { app } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const sandbox = process.env.LOGSEQ_INLINE_DATA_DIR ||
  path.join(app.getPath('appData'), 'Logseq Inline')
const settingsFile = path.join(sandbox, 'inline-config.json')
const settings = fs.existsSync(settingsFile) ? JSON.parse(fs.readFileSync(settingsFile, 'utf8')) : {}
const graphsDir = settings.graphsDir ?? path.join(sandbox, 'graphs')
if (typeof graphsDir !== 'string' || !path.isAbsolute(graphsDir)) {
  throw new Error('inline-config.json graphsDir must be an absolute directory path')
}
if (settings.graphsDir !== undefined && !fs.statSync(graphsDir).isDirectory()) {
  throw new Error('inline-config.json graphsDir must name an existing directory')
}
const dotdir = path.join(sandbox, 'home', '.logseq')
const profile = path.join(sandbox, 'profile')
fs.mkdirSync(dotdir, { recursive: true })
fs.mkdirSync(profile, { recursive: true })
app.setName('Logseq Inline')
app.setPath('userData', profile)
// macOS needs the real HOME for Keychain; isolate only Logseq-owned directories.
process.env.LOGSEQ_DOTDIR = dotdir
process.env.LOGSEQ_GRAPHS_DIR = graphsDir
process.env.LOGSEQ_INLINE_SANDBOX = '1'

require('./electron.js')
