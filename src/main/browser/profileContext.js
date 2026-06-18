'use strict'

const DEFAULT_PROFILE_ID = 'default'
const PROFILE_STORAGE_TYPES = [
  'cookies',
  'localstorage',
  'sessionstorage',
  'indexdb',
  'websql',
  'serviceworkers',
  'cachestorage',
]

function safePartitionId(value) {
  return String(value || DEFAULT_PROFILE_ID).replace(/[^a-zA-Z0-9_-]/g, '-')
}

function persistentPartition(profileId) {
  if (!profileId || profileId === DEFAULT_PROFILE_ID) return null
  return `persist:zap-profile-${safePartitionId(profileId)}`
}

function privatePartition(profileId, tabId) {
  return `zap-private-${safePartitionId(profileId)}-${safePartitionId(tabId)}`
}

function getPersistentSession(electronSession, profileId) {
  const partition = persistentPartition(profileId)
  return partition
    ? electronSession.fromPartition(partition)
    : electronSession.defaultSession
}

function getPrivateSession(electronSession, profileId, tabId) {
  return electronSession.fromPartition(privatePartition(profileId, tabId))
}

async function clearSessionStorage(targetSession) {
  await targetSession.clearStorageData({ storages: PROFILE_STORAGE_TYPES })
  await targetSession.clearCache()
  await targetSession.flushStorageData()
}

module.exports = {
  DEFAULT_PROFILE_ID,
  PROFILE_STORAGE_TYPES,
  persistentPartition,
  privatePartition,
  getPersistentSession,
  getPrivateSession,
  clearSessionStorage,
}
