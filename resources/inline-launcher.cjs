// Separate app profile, graph storage, plugins, and CLI metadata from stock Logseq.
const { app } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const sandbox = process.env.LOGSEQ_INLINE_DATA_DIR ||
  path.join(app.getPath('appData'), 'Logseq Inline')
const home = path.join(sandbox, 'home')
const profile = path.join(sandbox, 'profile')
fs.mkdirSync(home, { recursive: true })
fs.mkdirSync(profile, { recursive: true })
app.setName('Logseq Inline')
app.setPath('home', home)
app.setPath('userData', profile)
process.env.HOME = home
process.env.LOGSEQ_GRAPHS_DIR = path.join(sandbox, 'graphs')
process.env.LOGSEQ_INLINE_SANDBOX = '1'

require('./electron.js')
