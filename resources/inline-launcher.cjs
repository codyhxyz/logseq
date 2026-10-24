// Separate app profile, graph storage, plugins, and CLI metadata from stock Logseq.
const { app } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const sandbox = process.env.LOGSEQ_INLINE_DATA_DIR ||
  path.join(app.getPath('appData'), 'Logseq Inline')
const dotdir = path.join(sandbox, 'home', '.logseq')
const profile = path.join(sandbox, 'profile')
fs.mkdirSync(dotdir, { recursive: true })
fs.mkdirSync(profile, { recursive: true })
app.setName('Logseq Inline')
app.setPath('userData', profile)
// macOS needs the real HOME for Keychain; isolate only Logseq-owned directories.
process.env.LOGSEQ_DOTDIR = dotdir
process.env.LOGSEQ_GRAPHS_DIR = path.join(sandbox, 'graphs')
process.env.LOGSEQ_INLINE_SANDBOX = '1'

require('./electron.js')
