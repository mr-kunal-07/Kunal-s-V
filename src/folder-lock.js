// Version 1 uses Web Crypto PBKDF2-SHA-256. Only the salt and verifier are saved.
export const FOLDER_PASSWORD_ITERATIONS = 600000
export const MIN_FOLDER_PASSWORD_LENGTH = 8
export const MAX_FOLDER_PASSWORD_LENGTH = 128

const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
const fromHex = value => Uint8Array.from(value.match(/../g), pair => Number.parseInt(pair, 16))

export function folderPasswordError(password, confirmation = password) {
  if (typeof password !== 'string' || password.trim().length < MIN_FOLDER_PASSWORD_LENGTH) return 'Use at least 8 characters for the folder password.'
  if (password.length > MAX_FOLDER_PASSWORD_LENGTH) return 'Use no more than 128 characters for the folder password.'
  if (password !== confirmation) return 'The passwords do not match.'
  return ''
}

function validLock(lock) {
  return lock && lock.version === 1 && lock.iterations === FOLDER_PASSWORD_ITERATIONS
    && /^[a-f0-9]{32}$/.test(lock.salt) && /^[a-f0-9]{64}$/.test(lock.hash)
}

export function folderLockToken(lock) {
  return JSON.stringify([lock?.version, lock?.iterations, lock?.salt, lock?.hash])
}

async function derivePassword(password, salt) {
  if (!globalThis.crypto?.subtle) throw new Error('Folder passwords require HTTPS or localhost in a supported browser.')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: FOLDER_PASSWORD_ITERATIONS }, key, 256))
}

export async function createFolderLock(password) {
  const error = folderPasswordError(password)
  if (error) throw new Error(error)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return { version: 1, iterations: FOLDER_PASSWORD_ITERATIONS, salt: hex(salt), hash: hex(await derivePassword(password, salt)) }
}

export async function verifyFolderPassword(password, lock) {
  if (!validLock(lock)) throw new Error('This folder has an unsupported password lock. Its contents remain locked.')
  if (typeof password !== 'string' || password.length > MAX_FOLDER_PASSWORD_LENGTH) return false
  const actual = await derivePassword(password, fromHex(lock.salt)), expected = fromHex(lock.hash)
  let difference = 0
  for (let index = 0; index < actual.length; index++) difference |= actual[index] ^ expected[index]
  return difference === 0
}

// Fail closed for missing ancestors and cycles, including partially loaded archives.
export function folderAccess(item, items, unlocked = {}, includeSelf = true) {
  const index = items instanceof Map ? items : new Map(items.map(value => [value.id, value]))
  const chain = [], seen = new Set()
  let current = index.get(item?.id)
  if (!current) return { allowed: false, folder: null }
  const target = current
  while (current) {
    if (seen.has(current.id)) return { allowed: false, folder: null }
    seen.add(current.id)
    if (current !== target || includeSelf) chain.unshift(current)
    if (!current.parentId) break
    current = index.get(current.parentId)
    if (!current || current.kind !== 'folder') return { allowed: false, folder: null }
  }
  for (const entry of chain) {
    if (entry.kind === 'folder' && entry.folderLock && unlocked[entry.id] !== folderLockToken(entry.folderLock)) return { allowed: false, folder: entry }
  }
  return { allowed: true, folder: null }
}

export function visibleFolderItems(items, unlocked = {}) {
  const index = new Map(items.map(item => [item.id, item]))
  return items.filter(item => folderAccess(item, index, unlocked, false).allowed)
}

export function requireFolderAccess(targets, items, unlocked = {}) {
  const index = new Map(items.map(item => [item.id, item]))
  for (const item of targets) {
    const access = folderAccess(item, index, unlocked)
    if (!access.allowed) throw new Error(access.folder ? `Unlock “${access.folder.name}” before using this action.` : 'The folder path is unavailable. Reload the archive and try again.')
  }
}
