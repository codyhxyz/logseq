const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const source = fs.readFileSync(path.join(__dirname, '../resources/inline-launcher.cjs'), 'utf8')
for (const custom of [undefined, '/tmp/custom-inline-data']) {
  const paths = {}
  const created = []
  const env = { HOME: '/user/real-home', ...(custom ? { LOGSEQ_INLINE_DATA_DIR: custom } : {}) }
  let loaded = false
  vm.runInNewContext(source, {
    process: { env },
    require (name) {
      if (name === 'electron') return { app: {
        getPath: () => '/user/app-data',
        setPath: (key, value) => { paths[key] = value },
        setName: value => assert.equal(value, 'Logseq Inline'),
      } }
      if (name === 'node:fs') return { mkdirSync: directory => created.push(directory) }
      if (name === 'node:path') return path
      if (name === './electron.js') {
        assert.equal(env.LOGSEQ_INLINE_SANDBOX, '1')
        assert.equal(env.HOME, '/user/real-home')
        assert.equal(paths.home, undefined)
        assert.equal(env.LOGSEQ_DOTDIR, path.join(custom || '/user/app-data/Logseq Inline', 'home', '.logseq'))
        assert(paths.userData.startsWith(custom || '/user/app-data/Logseq Inline'))
        loaded = true
        return {}
      }
      throw new Error(`Unexpected dependency: ${name}`)
    },
  })
  assert(loaded)
  assert.equal(created.length, 2)
  assert.equal(env.LOGSEQ_GRAPHS_DIR, path.join(custom || '/user/app-data/Logseq Inline', 'graphs'))
}
console.log('PASS: Logseq directories are isolated; the real HOME and macOS home path remain unchanged.')
