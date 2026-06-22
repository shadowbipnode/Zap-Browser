'use strict'

const { spawnSync } = require('node:child_process')
const electronPath = require('electron')

const result = spawnSync(electronPath, [
  '--test',
  'test/migration-hardening.test.js',
  'test/profile-architecture.test.js',
  'test/bookmark-ordering.test.js',
], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
  },
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
