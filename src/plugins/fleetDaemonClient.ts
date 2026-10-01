import store from '@/store'
import Vue from 'vue'
import { hostKey } from '@/plugins/hostKey'
import { GuiRemoteprintersStatePrinter, PrinterModel } from '@/store/gui/remoteprinters/types'
import { OvenFrame } from '@/store/farm/types'

/** One printer/oven frame as the daemon sends it — standalone, or as an item of a `batch`. */
interface FleetFrame {
    hostname: string
    device_type?: 'oven'
    update?: any
    removed?: boolean
}

/**
 * Frames received within this window are committed to Vuex in ONE mutation. The daemon
 * ships a batch every 0.5 s, so this mostly collapses the legacy one-message-per-printer
 * format (and a batch that straddles the timer) — with 50 printing printers that was 50
 * store commits, and 50 full re-renders of every map/panel, per second on a slow device.
 * setTimeout rather than requestAnimationFrame: rAF stops in background tabs, a throttled
 * timer still keeps the store current so the map is right when the tab comes back.
 */
const FLUSH_MS = 250

/**
 * Singleton WebSocket client for fleet_daemon.
 * Connects once and stays connected across page navigations.
 * All printer data is committed directly to the Vuex farm store.
 *
 * Wire formats (both accepted, see fleet_daemon ARCHITECTURE.md "WebSocket Protocol"):
 *   - `{"batch": [frame, ...]}` — one message per daemon flush tick, and the connect / 30 s resync dump
 *   - a bare frame `{hostname, update}` / `{hostname, device_type: "oven", update}` /
 *     `{hostname, removed: true}` — legacy daemons, or FLEET_WS_BATCH=0
 *   - `{"event": ...}` messages are re-emitted on `fleetDaemonEvents` unchanged.
 */
class FleetDaemonClient {
    private socket: WebSocket | null = null
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null
    private started = false

    /** Frames waiting for the next flush, keyed `${device_type}:${hostname}`; a later frame replaces an earlier one. */
    private pending = new Map<string, FleetFrame>()
    /** Signature of the last printer payload committed per hostname; an identical frame is skipped
     *  so the store entry keeps its object identity and nothing depending on it re-renders. */
    private lastSig = new Map<string, string>()
    private flushTimer: ReturnType<typeof setTimeout> | null = null

    get isConnected(): boolean {
        return this.socket !== null && this.socket.readyState === WebSocket.OPEN
    }

    /** Start the persistent connection. Safe to call multiple times. */
    start() {
        if (this.started) return
        this.started = true
        this.connect()

        // The URL can change after startup (loaded from the Moonraker DB during
        // gui/init, or edited in the settings tab) — reconnect when it does.
        store.watch(
            () => store.getters['gui/fleetDaemonUrl'],
            () => {
                if (this.started) this.reconnect()
            }
        )
    }

    /** Force reconnect (e.g. after changing the fleet daemon URL). */
    reconnect() {
        this.disconnect()
        this.connect()
    }

    /** Cleanly shut down. */
    stop() {
        this.started = false
        this.disconnect()
    }

    private get wsUrl(): string {
        const httpUrl: string = store.getters['gui/fleetDaemonUrl']
        return httpUrl.replace(/^http/, 'ws') + '/ws'
    }

    private connect() {
        if (this.socket) {
            this.socket.close()
        }

        try {
            this.socket = new WebSocket(this.wsUrl)

            this.socket.onopen = () => {
                console.log('[FleetDaemon] Connected')
                store.commit('farm/SET_FLEET_DAEMON_CONNECTED', true)
                if (this.reconnectTimer) {
                    clearTimeout(this.reconnectTimer)
                    this.reconnectTimer = null
                }
            }

            this.socket.onmessage = (event: MessageEvent) => {
                try {
                    // Ignore text-level ping/pong keep-alive messages
                    if (event.data === 'ping' || event.data === 'pong') return

                    const message = JSON.parse(event.data)

                    if (Array.isArray(message.batch)) {
                        for (const frame of message.batch) this.queueFrame(frame)
                        return
                    }
                    if (message.hostname && (message.update || message.removed)) {
                        this.queueFrame(message)
                        return
                    }

                    // Emit event for components that need to react to specific messages
                    if (message.event === 'history_updated') {
                        fleetDaemonEvents.$emit('history_updated')
                    }
                    if (message.event === 'spool_updated') {
                        fleetDaemonEvents.$emit('spool_updated')
                    }
                    if (message.event === 'ovens_updated') {
                        fleetDaemonEvents.$emit('ovens_updated')
                    }
                    if (message.event === 'gcodes_updated') {
                        fleetDaemonEvents.$emit('gcodes_updated')
                    }
                    if (message.event === 'download_queue_updated') {
                        fleetDaemonEvents.$emit('download_queue_updated')
                    }
                    if (message.event === 'jobs_updated') {
                        fleetDaemonEvents.$emit('jobs_updated')
                    }
                    if (message.event === 'workers_updated') {
                        fleetDaemonEvents.$emit('workers_updated')
                    }
                    if (message.event === 'activity_updated') {
                        fleetDaemonEvents.$emit('activity_updated', message.hostname ?? null)
                    }
                    if (message.event === 'toast') {
                        fleetDaemonEvents.$emit('toast', {
                            level: message.level ?? 'info',
                            message: message.message ?? '',
                            key: message.key ?? null,
                        })
                    }
                } catch (e) {
                    console.warn('[FleetDaemon] WS parse error:', e)
                }
            }

            this.socket.onclose = () => {
                console.warn('[FleetDaemon] Disconnected')
                this.socket = null
                this.resetBuffer()
                store.commit('farm/SET_FLEET_DAEMON_CONNECTED', false)

                if (this.started) {
                    this.reconnectTimer = setTimeout(() => this.connect(), 5000)
                }
            }

            this.socket.onerror = (error) => {
                console.error('[FleetDaemon] WS error:', error)
            }
        } catch (e) {
            console.error('[FleetDaemon] Failed to create WebSocket:', e)
            if (this.started) {
                this.reconnectTimer = setTimeout(() => this.connect(), 5000)
            }
        }
    }

    private disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer)
            this.reconnectTimer = null
        }
        if (this.socket) {
            this.socket.onclose = null // prevent auto-reconnect
            this.socket.close()
            this.socket = null
        }
        this.resetBuffer()
        store.commit('farm/SET_FLEET_DAEMON_CONNECTED', false)
    }

    /** Drop buffered frames and forget signatures: the next connection starts with a full snapshot. */
    private resetBuffer() {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer)
            this.flushTimer = null
        }
        this.pending.clear()
        this.lastSig.clear()
    }

    private queueFrame(frame: FleetFrame) {
        if (!frame || !frame.hostname) return
        const kind = frame.device_type === 'oven' ? 'oven' : 'printer'
        this.pending.set(kind + ':' + frame.hostname, frame)
        if (!this.flushTimer) {
            this.flushTimer = setTimeout(() => this.flush(), FLUSH_MS)
        }
    }

    /** Commit everything buffered since the last flush as one store mutation. */
    private flush() {
        this.flushTimer = null
        if (this.pending.size === 0) return

        const roster: Record<string, GuiRemoteprintersStatePrinter> =
            store.getters['gui/remoteprinters/byHostKey'] || {}
        const currentPrinters = (store.state as any).farm?.fleetDaemonPrinters || {}

        const printers: { [hostname: string]: any } = {}
        const ovens: { [hostname: string]: OvenFrame } = {}
        const removedPrinters: string[] = []
        const removedOvens: string[] = []

        for (const frame of this.pending.values()) {
            const hostname = frame.hostname

            // Oven frames ({hostname, device_type: 'oven', update|removed}) go to their
            // own store map (farm.fleetDaemonOvens): printer counters, the worker list and
            // status derivation read fleetDaemonPrinters and must stay printer-only.
            if (frame.device_type === 'oven') {
                if (frame.removed) removedOvens.push(hostname)
                else if (frame.update) {
                    ovens[hostname] = {
                        ...frame.update,
                        hostname,
                        device_type: 'oven',
                        received_at: Date.now(),
                    }
                }
                continue
            }

            if (frame.removed) {
                removedPrinters.push(hostname)
                this.lastSig.delete(hostname)
                continue
            }
            if (!frame.update) continue

            const entry = roster[hostKey(hostname)]
            const position = entry?.position ?? { x: 400, y: 400 }
            const model: PrinterModel | null = entry?.printerModel ?? null

            // The daemon already drops frames whose wire text did not change; this catches the
            // legacy per-printer format and the 30 s resync, which re-send everything.
            const sig = frameSignature(frame.update) + '|' + position.x + ',' + position.y + '|' + (model ?? '')
            if (this.lastSig.get(hostname) === sig && currentPrinters[hostname]) continue
            this.lastSig.set(hostname, sig)

            printers[hostname] = {
                ...frame.update,
                socket: {
                    hostname,
                    isConnected: true,
                    webPort: 80,
                    position,
                    printerModel: model,
                },
                current_file: {
                    filename: frame.update?.print_stats?.filename ?? '',
                },
                _namespace: hostname,
            }
        }
        this.pending.clear()

        if (
            Object.keys(printers).length ||
            Object.keys(ovens).length ||
            removedPrinters.length ||
            removedOvens.length
        ) {
            store.commit('farm/APPLY_FLEET_DAEMON_BATCH', { printers, ovens, removedPrinters, removedOvens })
        }
    }
}

/**
 * Text used to decide whether a printer frame changed. `fleet_worker.evaluated_at` is the
 * daemon's own "last looked at this worker" clock: it ticks on every scheduler pass, nothing
 * in the UI reads it, and on a quiet fleet it was the only change in two thirds of all frames —
 * each one re-rendering every map and panel on screen.
 */
function frameSignature(update: any): string {
    const fw = update?.fleet_worker
    if (fw && typeof fw === 'object' && 'evaluated_at' in fw) {
        const rest = { ...fw }
        delete rest.evaluated_at
        return JSON.stringify({ ...update, fleet_worker: rest })
    }
    return JSON.stringify(update)
}

/** Event bus for fleet daemon events that components can listen to */
export const fleetDaemonEvents = new Vue()

/** Singleton instance */
export const fleetDaemonClient = new FleetDaemonClient()
