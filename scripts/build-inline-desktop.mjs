#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { copyFileSync, cpSync, mkdirSync, mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { unsignedBuildEnv } from './electron-builder-unsigned.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
function run (command, args, cwd = root, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`)
}

if (process.platform !== 'darwin' || process.arch !== 'arm64') {
  throw new Error('This local desktop build targets Apple Silicon macOS.')
}
if (!process.argv.includes('--package-only')) {
  run('pnpm', ['install', '--frozen-lockfile'])
  run('pnpm', ['gulp:build'])
  run('clojure', ['-J-Xmx6g', '-M:cljs', 'release', 'app', 'db-worker', 'db-worker-node', 'electron'])
  run('pnpm', ['webpack-app-build'])
  run('pnpm', ['db-worker-node:bundle'])
}
// The sandbox disables CLI installation; only its worker runtime needs staging.
for (const file of ['inline-launcher.cjs', 'electron-builder-inline.yml']) {
  copyFileSync(path.join(root, 'resources', file), path.join(root, 'static', file))
}
copyFileSync(path.join(root, 'dist/db-worker-node.js'), path.join(root, 'static/js/db-worker-node.js'))
// Package outside the workspace: otherwise pnpm's dependency collector silently
// collects the root web-app dependencies instead of the desktop dependencies.
const stagingRoot = mkdtempSync(path.join(os.tmpdir(), 'logseq-inline-stage-'))
const staging = path.join(stagingRoot, 'app')
cpSync(path.join(root, 'static'), staging, {
  recursive: true,
  filter: source => !['node_modules', 'dist'].includes(path.basename(source)),
})
mkdirSync(path.join(stagingRoot, 'deps'), { recursive: true })
cpSync(path.join(root, 'deps/graph-lifecycle'), path.join(stagingRoot, 'deps/graph-lifecycle'), { recursive: true })
cpSync(path.join(root, 'sidecar'), path.join(stagingRoot, 'sidecar'), { recursive: true })
cpSync(path.join(root, '.agents/skills/logseq-cli'), path.join(staging, '.agents/skills/logseq-cli'), { recursive: true })
run('pnpm', ['install', '--ignore-workspace', '--frozen-lockfile'], staging)
run('pnpm', ['exec', 'electron-builder', '--config', 'electron-builder-inline.yml',
  '--mac', 'dir', '--arm64', '--publish', 'never',
  `-c.directories.output=${path.join(root, 'artifacts/inline-desktop')}`], staging, unsignedBuildEnv())
