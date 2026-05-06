import { Module } from 'vuex'
import { ExclusiveLockState } from './types'
import { actions } from './actions'
import { mutations } from './mutations'
import { getters } from './getters'
import { RootState } from '@/store/types'

const TAB_ID_STORAGE_KEY = 'mainsailExclusiveLockTabId'

function generateTabId(): string {
    const c = (typeof crypto !== 'undefined' ? crypto : null) as { randomUUID?: () => string } | null
    if (c && typeof c.randomUUID === 'function') return c.randomUUID()
    return 'tab-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36)
}

function getOrCreateTabId(): string {
    try {
        const existing = window.sessionStorage.getItem(TAB_ID_STORAGE_KEY)
        if (existing) return existing
        const fresh = generateTabId()
        window.sessionStorage.setItem(TAB_ID_STORAGE_KEY, fresh)
        return fresh
    } catch {
        // sessionStorage may be unavailable (private mode etc.) — fall back to a per-load id.
        return generateTabId()
    }
}

export const getDefaultState = (): ExclusiveLockState => ({
    status: 'idle',
    lockData: null,
    heartbeatTimer: null,
    pollTimer: null,
    tabId: getOrCreateTabId(),
})

const state = getDefaultState()

export const exclusiveLock: Module<ExclusiveLockState, RootState> = {
    namespaced: true,
    state,
    getters,
    actions,
    mutations,
}
