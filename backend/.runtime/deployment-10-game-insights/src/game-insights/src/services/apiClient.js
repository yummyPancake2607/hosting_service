import axios from 'axios'
import { env } from '../lib/env'
import { supabase } from '../lib/supabase'

const GET_CACHE_STORAGE_KEY = 'gi:get-cache:v1'
const GET_CACHE_MAX_ENTRIES = 180
const TOKEN_EXPIRY_SKEW_MS = 30_000

const getResponseCache = new Map()
const inFlightGetRequests = new Map()

let cachePersistTimer = null
let cachedAccessToken = null
let cachedAccessTokenExpiresAt = 0
let sessionLookupPromise = null

const hasWindow = typeof window !== 'undefined'

const stableSerialize = (value) => {
  if (value === null || value === undefined) {
    return String(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value).sort()
    return `{${keys.map((key) => `${key}:${stableSerialize(value[key])}`).join(',')}}`
  }

  return JSON.stringify(value)
}

const getNormalizedPath = (url) => {
  const rawUrl = String(url || '')
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    try {
      return new URL(rawUrl).pathname
    } catch {
      return rawUrl
    }
  }
  return rawUrl
}

const isCacheableGetPath = (path) => path.startsWith('/games')

const resolveGetCacheTtlMs = (path, params) => {
  const safePath = String(path || '')

  if (safePath.startsWith('/games/home-content')) {
    return 2 * 60 * 1000
  }

  if (safePath.startsWith('/games/search')) {
    const query = String(params?.q || '').trim()
    return query ? 2 * 60 * 1000 : 5 * 60 * 1000
  }

  if (/^\/games\/[^/]+\/reviews$/.test(safePath)) {
    return 3 * 60 * 1000
  }

  if (/^\/games\/[^/]+$/.test(safePath)) {
    return 10 * 60 * 1000
  }

  return 60 * 1000
}

const buildGetCacheKey = (path, params) => `${path}?${stableSerialize(params || {})}`

const pruneGetCache = () => {
  const now = Date.now()
  for (const [key, entry] of getResponseCache.entries()) {
    if (!entry || entry.expiresAt <= now) {
      getResponseCache.delete(key)
    }
  }

  if (getResponseCache.size <= GET_CACHE_MAX_ENTRIES) {
    return
  }

  const orderedEntries = Array.from(getResponseCache.entries()).sort(
    (a, b) => (a[1]?.storedAt || 0) - (b[1]?.storedAt || 0),
  )

  const overflow = getResponseCache.size - GET_CACHE_MAX_ENTRIES
  for (let index = 0; index < overflow; index += 1) {
    getResponseCache.delete(orderedEntries[index][0])
  }
}

const persistGetCache = () => {
  if (!hasWindow) {
    return
  }

  try {
    pruneGetCache()
    const payload = JSON.stringify(Array.from(getResponseCache.entries()))
    window.sessionStorage.setItem(GET_CACHE_STORAGE_KEY, payload)
  } catch {
    // Ignore storage quota/unavailable errors and keep in-memory cache active.
  }
}

const schedulePersistGetCache = () => {
  if (!hasWindow || cachePersistTimer !== null) {
    return
  }

  cachePersistTimer = window.setTimeout(() => {
    cachePersistTimer = null
    persistGetCache()
  }, 120)
}

const loadGetCacheFromSession = () => {
  if (!hasWindow) {
    return
  }

  try {
    const raw = window.sessionStorage.getItem(GET_CACHE_STORAGE_KEY)
    if (!raw) {
      return
    }

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return
    }

    const now = Date.now()
    parsed.forEach(([key, entry]) => {
      if (!entry || entry.expiresAt <= now) {
        return
      }
      getResponseCache.set(key, entry)
    })

    pruneGetCache()
  } catch {
    // Ignore malformed stored cache and continue.
  }
}

const parseJwtExpiryMs = (accessToken) => {
  try {
    const payload = accessToken.split('.')[1]
    if (!payload) {
      return 0
    }

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
    const decoded = JSON.parse(atob(padded))

    if (!decoded?.exp) {
      return 0
    }

    return Number(decoded.exp) * 1000
  } catch {
    return 0
  }
}

const rememberAccessToken = (accessToken) => {
  cachedAccessToken = accessToken || null
  cachedAccessTokenExpiresAt = accessToken ? parseJwtExpiryMs(accessToken) : 0
}

const getAccessTokenFast = async () => {
  if (
    cachedAccessToken
    && cachedAccessTokenExpiresAt > 0
    && Date.now() < cachedAccessTokenExpiresAt - TOKEN_EXPIRY_SKEW_MS
  ) {
    return cachedAccessToken
  }

  if (sessionLookupPromise) {
    return sessionLookupPromise
  }

  sessionLookupPromise = supabase.auth
    .getSession()
    .then(({ data }) => {
      const nextToken = data?.session?.access_token || null
      rememberAccessToken(nextToken)
      return nextToken
    })
    .catch(() => null)
    .finally(() => {
      sessionLookupPromise = null
    })

  return sessionLookupPromise
}

const buildCachedAxiosResponse = (cacheEntry, requestConfig, url) => ({
  data: cacheEntry.data,
  status: cacheEntry.status || 200,
  statusText: cacheEntry.statusText || 'OK',
  headers: cacheEntry.headers || {},
  config: {
    ...(requestConfig || {}),
    url,
    _fromCache: true,
  },
  request: {
    fromCache: true,
  },
})

const shouldServeStaleCache = (error) => {
  if (!error) {
    return false
  }

  if (!error.response || error.code === 'ECONNABORTED') {
    return true
  }

  return Number(error.response.status || 0) >= 500
}

loadGetCacheFromSession()

try {
  supabase.auth.getSession().then(({ data }) => {
    rememberAccessToken(data?.session?.access_token || null)
  })

  supabase.auth.onAuthStateChange((_event, session) => {
    rememberAccessToken(session?.access_token || null)
  })
} catch {
  // Ignore auth bootstrap failures and continue with lazy token lookup.
}

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 10000,
})

apiClient.interceptors.request.use(async (config) => {
  // If a caller already attached a bearer token, do not block on an extra
  // session lookup (this can hang during token refresh edge cases).
  const existingAuthHeader =
    config.headers?.Authorization ||
    config.headers?.authorization;

  if (existingAuthHeader) {
    return config;
  }

  try {
  const accessToken = await getAccessTokenFast()

  if (accessToken) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${accessToken}`,
    }
  }
  } catch {
    // Keep requests flowing even if Supabase session resolution fails.
  }

  return config
})

const rawGet = apiClient.get.bind(apiClient)

apiClient.get = async (url, config = {}) => {
  const normalizedPath = getNormalizedPath(url)
  const cacheMode = config.cacheMode || 'default'
  const params = config.params || {}
  const cacheable = isCacheableGetPath(normalizedPath)
  const cacheTtlMs =
    typeof config.cacheTtlMs === 'number'
      ? config.cacheTtlMs
      : resolveGetCacheTtlMs(normalizedPath, params)

  const canUseCache = cacheable && cacheMode !== 'no-store' && cacheTtlMs > 0
  const cacheKey = buildGetCacheKey(normalizedPath, params)

  if (canUseCache && cacheMode !== 'force-refresh') {
    const cachedEntry = getResponseCache.get(cacheKey)
    if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
      return buildCachedAxiosResponse(cachedEntry, config, url)
    }
  }

  if (canUseCache && inFlightGetRequests.has(cacheKey)) {
    return inFlightGetRequests.get(cacheKey)
  }

  const requestPromise = rawGet(url, config)
    .then((response) => {
      if (canUseCache) {
        const now = Date.now()
        const cacheEntry = {
          storedAt: now,
          expiresAt: now + cacheTtlMs,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers || {},
          data: response.data,
        }

        getResponseCache.set(cacheKey, cacheEntry)
        pruneGetCache()
        schedulePersistGetCache()
      }

      return response
    })
    .catch((error) => {
      if (canUseCache && shouldServeStaleCache(error)) {
        const staleEntry = getResponseCache.get(cacheKey)
        if (staleEntry) {
          return buildCachedAxiosResponse(staleEntry, config, url)
        }
      }
      throw error
    })
    .finally(() => {
      if (canUseCache) {
        inFlightGetRequests.delete(cacheKey)
      }
    })

  if (canUseCache) {
    inFlightGetRequests.set(cacheKey, requestPromise)
  }

  return requestPromise
}

export const getCachedGetData = (url, params = {}) => {
  const path = getNormalizedPath(url)
  const key = buildGetCacheKey(path, params)
  const cachedEntry = getResponseCache.get(key)

  if (!cachedEntry || cachedEntry.expiresAt <= Date.now()) {
    getResponseCache.delete(key)
    return null
  }

  return cachedEntry.data
}

export const invalidateGetCache = (matcher) => {
  const predicate = typeof matcher === 'function'
    ? matcher
    : (cacheKey) => String(cacheKey).startsWith(String(matcher || ''))

  for (const [cacheKey] of getResponseCache.entries()) {
    if (predicate(cacheKey)) {
      getResponseCache.delete(cacheKey)
      inFlightGetRequests.delete(cacheKey)
    }
  }

  schedulePersistGetCache()
}
