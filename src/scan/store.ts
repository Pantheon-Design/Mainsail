/**
 * Minimal Vuex store for Scanner Lite.
 *
 * The fleet store modules resolve the daemon with `rootGetters['gui/fleetDaemonUrl']`,
 * so a tiny `gui` stub is all they need. The full Mainsail app keeps its real
 * `gui` module; this file is only used by src/scan/main.ts.
 */
import Vue from 'vue'
import Vuex, { Module } from 'vuex'
import { fleet } from '@/store/fleet'

Vue.use(Vuex)

const DAEMON_URL_KEY = 'scanner.daemonUrl'

/** Same default as the full app: src/store/gui/getters.ts fleetDaemonUrl. */
export function defaultDaemonUrl(): string {
    return `http://${window.location.hostname}:8090`
}

/**
 * Resolution order: `?daemon=` query param (persisted) → saved value → default.
 * Passing `?daemon=` (empty) clears the saved value.
 */
export function resolveDaemonUrl(): string {
    let fromQuery: string | null = null
    try {
        const params = new URLSearchParams(window.location.search)
        if (params.has('daemon')) {
            fromQuery = (params.get('daemon') || '').trim()
            if (fromQuery) localStorage.setItem(DAEMON_URL_KEY, fromQuery)
            else localStorage.removeItem(DAEMON_URL_KEY)
            // Drop the query so a reload does not re-apply it
            params.delete('daemon')
            const qs = params.toString()
            window.history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''))
        }
    } catch {
        /* ignore */
    }
    if (fromQuery) return fromQuery.replace(/\/+$/, '')
    try {
        const saved = localStorage.getItem(DAEMON_URL_KEY)
        if (saved) return saved.replace(/\/+$/, '')
    } catch {
        /* ignore */
    }
    return defaultDaemonUrl()
}

export function saveDaemonUrl(url: string): void {
    const clean = (url || '').trim().replace(/\/+$/, '')
    try {
        if (clean) localStorage.setItem(DAEMON_URL_KEY, clean)
        else localStorage.removeItem(DAEMON_URL_KEY)
    } catch {
        /* ignore */
    }
}

interface GuiStubState {
    fleetDaemonUrl: string
}

const guiStub: Module<GuiStubState, any> = {
    namespaced: true,
    state: { fleetDaemonUrl: resolveDaemonUrl() },
    getters: {
        fleetDaemonUrl: (state) => state.fleetDaemonUrl,
    },
    mutations: {
        setFleetDaemonUrl(state, url: string) {
            state.fleetDaemonUrl = url
        },
    },
}

export function createScanStore() {
    return new Vuex.Store({
        modules: {
            gui: guiStub,
            fleet,
        },
    })
}
