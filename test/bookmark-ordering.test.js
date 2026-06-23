'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')

test('reorders and moves bookmarks without duplicates or folder cycles', () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'zap-bookmarks-'))
  const originalLoad = Module._load

  Module._load = function (request, parent, isMain) {
    if (request === 'electron') {
      return { app: { getPath: () => userData } }
    }
    return originalLoad.call(this, request, parent, isMain)
  }

  const dbModulePath = require.resolve('../src/main/db')
  let DB = require(dbModulePath)

  try {
    DB.init()

    const bar = DB.getFavorites().find(item =>
      Number(item.is_folder) === 1 &&
      String(item.title).toLowerCase() === 'bookmarks bar'
    )
    assert.ok(bar)

    const first = DB.addFavorite({ title: 'First', url: 'https://first.test', parent_id: bar.id })
    const second = DB.addFavorite({ title: 'Second', url: 'https://second.test', parent_id: bar.id })
    const emptyFolder = DB.addFavorite({ title: 'Empty', url: '', parent_id: bar.id, is_folder: 1 })
    const nestedFolder = DB.addFavorite({ title: 'Nested', url: '', parent_id: bar.id, is_folder: 1 })

    assert.equal(DB.moveFavorite(second.id, bar.id, 0).ok, true)
    assert.deepEqual(
      DB.getFavorites().filter(item => Number(item.parent_id) === Number(bar.id)).map(item => item.id),
      [second.id, first.id, emptyFolder.id, nestedFolder.id],
    )

    assert.equal(DB.moveFavorite(first.id, emptyFolder.id, 0).ok, true)
    assert.deepEqual(
      DB.getFavorites().filter(item => Number(item.parent_id) === Number(emptyFolder.id)).map(item => item.id),
      [first.id],
    )

    assert.equal(DB.moveFavorite(nestedFolder.id, emptyFolder.id, 1).ok, true)
    assert.equal(DB.moveFavorite(emptyFolder.id, nestedFolder.id, 0).ok, false)

    assert.equal(DB.moveFavorite(first.id, null, 0).ok, true)
    assert.equal(DB.getFavorites().filter(item => Number(item.id) === Number(first.id)).length, 1)

    DB._db().close()
    delete require.cache[dbModulePath]
    DB = require(dbModulePath)
    DB.init()

    const persistedRoot = DB.getFavorites().filter(item => item.parent_id == null)
    assert.equal(persistedRoot[0].id, first.id)
    assert.equal(persistedRoot.filter(item => Number(item.id) === Number(first.id)).length, 1)
    assert.equal(
      DB.getFavorites().find(item => Number(item.id) === Number(nestedFolder.id)).parent_id,
      emptyFolder.id,
    )
  } finally {
    DB._db()?.close()
    delete require.cache[dbModulePath]
    Module._load = originalLoad
    fs.rmSync(userData, { recursive: true, force: true })
  }
})

test('creates dragged page bookmarks at exact positions and persists metadata', () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'zap-dragged-bookmarks-'))
  const originalLoad = Module._load

  Module._load = function (request, parent, isMain) {
    if (request === 'electron') {
      return { app: { getPath: () => userData } }
    }
    return originalLoad.call(this, request, parent, isMain)
  }

  const dbModulePath = require.resolve('../src/main/db')
  let DB = require(dbModulePath)

  try {
    DB.init()

    const bar = DB.getFavorites().find(item =>
      Number(item.is_folder) === 1 &&
      String(item.title).toLowerCase() === 'bookmarks bar'
    )
    assert.ok(bar)

    const first = DB.addFavorite({ title: 'First', url: 'https://first.test', parent_id: bar.id })
    const folder = DB.addFavorite({ title: 'Folder', url: '', parent_id: bar.id, is_folder: 1 })
    const last = DB.addFavorite({ title: 'Last', url: 'https://last.test', parent_id: bar.id })
    const favicon = 'https://icons.test/current.png'

    const inserted = DB.addFavoriteAt({
      title: 'Current page',
      url: 'https://current.test/path',
      favicon,
      parent_id: bar.id,
    }, 1)

    assert.equal(inserted.ok, true)
    assert.deepEqual(
      DB.getFavorites().filter(item => Number(item.parent_id) === Number(bar.id)).map(item => item.id),
      [first.id, inserted.id, folder.id, last.id],
    )

    const nested = DB.addFavoriteAt({
      title: 'Inside folder',
      url: 'https://nested.test',
      favicon,
      parent_id: folder.id,
    })

    assert.equal(nested.ok, true)
    assert.deepEqual(
      DB.getFavorites().filter(item => Number(item.parent_id) === Number(folder.id)).map(item => item.id),
      [nested.id],
    )
    assert.equal(DB.addFavoriteAt({
      title: 'Invalid parent',
      url: 'https://invalid.test',
      parent_id: first.id,
    }, 0).ok, false)

    DB._db().close()
    delete require.cache[dbModulePath]
    DB = require(dbModulePath)
    DB.init()

    const persisted = DB.getFavorites().find(item => Number(item.id) === Number(inserted.id))
    assert.equal(persisted.title, 'Current page')
    assert.equal(persisted.url, 'https://current.test/path')
    assert.equal(persisted.favicon, favicon)
    assert.equal(persisted.parent_id, bar.id)
    assert.equal(persisted.sort_order, 1)
    assert.equal(
      DB.getFavorites().find(item => Number(item.id) === Number(nested.id)).parent_id,
      folder.id,
    )
  } finally {
    DB._db()?.close()
    delete require.cache[dbModulePath]
    Module._load = originalLoad
    fs.rmSync(userData, { recursive: true, force: true })
  }
})
