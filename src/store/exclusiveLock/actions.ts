import { ActionTree } from 'vuex'
import { ExclusiveLockState, LockRecord } from './types'
import { RootState } from '@/store/types'

const NAMESPACE = 'mainsail'
const KEY = 'exclusiveLock'
const STALE_MS = 30_000
const HEARTBEAT_MS = 10_000
const POLL_MS = 5_000
const RACE_RESOLVE_MS = 1_500

function dbItemUrl(rootGetters: any): string {
    return rootGetters['socket/getUrl'] + '/server/database/item'
}

function lockItemUrl(rootGetters: any): string {
    return dbItemUrl(rootGetters) + '?namespace=' + NAMESPACE + '&key=' + KEY
}

function safetySettingUrl(rootGetters: any): string {
    return dbItemUrl(rootGetters) + '?namespace=' + NAMESPACE + '&key=general.ul2011SafetyCompliant'
}

async function readSafetySetting(rootGetters: any): Promise<boolean> {
    try {
        const res = await fetch(safetySettingUrl(rootGetters), { cache: 'no-store' })
        if (res.status === 404) return false
        if (!res.ok) return false
        const data = await res.json()
        return data?.result?.value === true
    } catch {
        return false
    }
}

function makeOwnerLabel(): string {
    const ua = navigator.userAgent
    let browser = 'Browser'
    if (/Edg\//.test(ua)) browser = 'Edge'
    else if (/OPR\//.test(ua)) browser = 'Opera'
    else if (/Chrome\//.test(ua)) browser = 'Chrome'
    else if (/Firefox\//.test(ua)) browser = 'Firefox'
    else if (/Safari\//.test(ua)) browser = 'Safari'

    let os = 'Unknown OS'
    if (/Windows/.test(ua)) os = 'Windows'
    else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS'
    else if (/Android/.test(ua)) os = 'Android'
    else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS'
    else if (/Linux/.test(ua)) os = 'Linux'

    return `${browser} on ${os}`
}

async function readLock(rootGetters: any): Promise<LockRecord | null> {
    const res = await fetch(lockItemUrl(rootGetters), { cache: 'no-store' })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`exclusiveLock read failed: ${res.status}`)
    const data = await res.json()
    return (data?.result?.value as LockRecord) ?? null
}

async function writeLock(rootGetters: any, record: LockRecord): Promise<void> {
    const res = await fetch(dbItemUrl(rootGetters), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ namespace: NAMESPACE, key: KEY, value: record }),
    })
    if (!res.ok) throw new Error(`exclusiveLock write failed: ${res.status}`)
}

async function deleteLock(rootGetters: any, opts?: { keepalive?: boolean }): Promise<void> {
    await fetch(lockItemUrl(rootGetters), {
        method: 'DELETE',
        keepalive: opts?.keepalive ?? false,
    }).catch(() => {
        /* best-effort */
    })
}

function isStale(record: LockRecord): boolean {
    return Date.now() - (record.last_heartbeat ?? 0) > STALE_MS
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export const actions: ActionTree<ExclusiveLockState, RootState> = {
    async init({ state, dispatch, commit, rootGetters, rootState }) {
        // Cancel any leftover timers from a previous connection.
        dispatch('clearTimers')

        // UL 2011 Safety Compliant mode gates the entire exclusive-access feature.
        const enabled = await readSafetySetting(rootGetters)
        if (!enabled) {
            commit('setLockData', null)
            commit('setStatus', 'idle')
            return
        }

        // Hold guiIsReady false until the lock check resolves to avoid a UI flash.
        dispatch('socket/addInitModule', 'exclusiveLock', { root: true })
        commit('setStatus', 'checking')

        let current: LockRecord | null = null
        try {
            current = await readLock(rootGetters)
        } catch (e) {
            window.console.warn('[exclusiveLock] initial read failed, treating as no lock', e)
            current = null
        }

        const ourTabId = state.tabId
        const ourConnId = rootState.socket?.connection_id ?? null

        const free = current === null || isStale(current) || current.owner_tab_id === ourTabId

        if (!free && current) {
            commit('setLockData', current)
            commit('setStatus', 'blocked')
            dispatch('socket/removeInitModule', 'exclusiveLock', { root: true })
            dispatch('startPolling')
            return
        }

        await dispatch('claim', { connection_id: ourConnId })
        dispatch('socket/removeInitModule', 'exclusiveLock', { root: true })
    },

    async claim({ state, commit, dispatch, rootGetters, rootState }, payload?: { connection_id?: number | null }) {
        const ourTabId = state.tabId
        const ourConnId = payload?.connection_id ?? rootState.socket?.connection_id ?? null
        const now = Date.now()

        const record: LockRecord = {
            owner_tab_id: ourTabId,
            owner_connection_id: ourConnId,
            owner_label: makeOwnerLabel(),
            claimed_at: now,
            last_heartbeat: now,
        }

        try {
            await writeLock(rootGetters, record)
        } catch (e) {
            window.console.error('[exclusiveLock] claim write failed', e)
            commit('setStatus', 'blocked')
            commit('setLockData', null)
            dispatch('startPolling')
            return
        }

        commit('setLockData', record)

        // Resolve simultaneous-open races: re-read after a short delay.
        await delay(RACE_RESOLVE_MS)

        let after: LockRecord | null = null
        try {
            after = await readLock(rootGetters)
        } catch (e) {
            window.console.warn('[exclusiveLock] race-resolve read failed, assuming we won', e)
            after = record
        }

        if (after && after.owner_tab_id === ourTabId) {
            commit('setLockData', after)
            commit('setStatus', 'owned')
            dispatch('startHeartbeat')
        } else {
            commit('setLockData', after)
            commit('setStatus', 'blocked')
            dispatch('startPolling')
        }
    },

    startHeartbeat({ state, commit, dispatch }) {
        if (state.heartbeatTimer !== null) return
        const id = window.setInterval(() => {
            dispatch('heartbeat')
        }, HEARTBEAT_MS)
        commit('setHeartbeatTimer', id)
    },

    async heartbeat({ state, commit, dispatch, rootGetters, rootState }) {
        if (state.status !== 'owned') return

        let current: LockRecord | null = null
        try {
            current = await readLock(rootGetters)
        } catch (e) {
            // Transient failure (e.g. brief network blip). Keep state, retry next tick.
            window.console.debug('[exclusiveLock] heartbeat read failed', e)
            return
        }

        if (!current || current.owner_tab_id !== state.tabId) {
            // Someone took over (stale-claim or force-takeover). Step aside.
            window.console.warn('[exclusiveLock] lost ownership during heartbeat')
            commit('setLockData', current)
            commit('setStatus', 'blocked')
            dispatch('clearHeartbeat')
            dispatch('startPolling')
            return
        }

        const updated: LockRecord = {
            ...current,
            owner_connection_id: rootState.socket?.connection_id ?? current.owner_connection_id,
            last_heartbeat: Date.now(),
        }
        try {
            await writeLock(rootGetters, updated)
            commit('setLockData', updated)
        } catch (e) {
            window.console.debug('[exclusiveLock] heartbeat write failed', e)
        }
    },

    startPolling({ state, commit, dispatch }) {
        if (state.pollTimer !== null) return
        const id = window.setInterval(() => {
            dispatch('poll')
        }, POLL_MS)
        commit('setPollTimer', id)
    },

    async poll({ state, commit, dispatch, rootGetters }) {
        if (state.status !== 'blocked') return

        let current: LockRecord | null = null
        try {
            current = await readLock(rootGetters)
        } catch (e) {
            window.console.debug('[exclusiveLock] poll read failed', e)
            return
        }

        commit('setLockData', current)

        const free = current === null || isStale(current)
        if (!free) return

        // Lock is free — try to claim.
        dispatch('clearPolling')
        await dispatch('claim')
    },

    async forceTakeover({ commit, dispatch }) {
        dispatch('clearPolling')
        commit('setStatus', 'checking')
        await dispatch('claim')
    },

    async release({ state, commit, dispatch, rootGetters }) {
        dispatch('clearTimers')
        const owned = state.status === 'owned' && state.lockData?.owner_tab_id === state.tabId
        if (owned) {
            await deleteLock(rootGetters)
        }
        commit('setLockData', null)
        commit('setStatus', 'idle')
    },

    releaseOnUnload({ state, rootGetters }) {
        // Best-effort synchronous release on page unload — uses fetch keepalive.
        if (state.status !== 'owned') return
        if (state.lockData?.owner_tab_id !== state.tabId) return
        try {
            void deleteLock(rootGetters, { keepalive: true })
        } catch {
            /* best-effort */
        }
    },

    clearHeartbeat({ state, commit }) {
        if (state.heartbeatTimer !== null) {
            window.clearInterval(state.heartbeatTimer)
            commit('setHeartbeatTimer', null)
        }
    },

    clearPolling({ state, commit }) {
        if (state.pollTimer !== null) {
            window.clearInterval(state.pollTimer)
            commit('setPollTimer', null)
        }
    },

    clearTimers({ dispatch }) {
        dispatch('clearHeartbeat')
        dispatch('clearPolling')
    },
}
