import store from '@/store'
import Vue from 'vue'

/**
 * Singleton WebSocket client for fleet_daemon.
 * Connects once and stays connected across page navigations.
 * All printer data is committed directly to the Vuex farm store.
 */
class FleetDaemonClient {
    private socket: WebSocket | null = null
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null
    private started = false

    get isConnected(): boolean {
        return this.socket !== null && this.socket.readyState === WebSocket.OPEN
    }

    /** Start the persistent connection. Safe to call multiple times. */
    start() {
        if (this.started) return
        this.started = true
        this.connect()
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
        const httpUrl: string = store.getters['gui/fleetDaemonUrl'] ?? 'http://pantheonfleet.local:8090'
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

                    if (message.removed && message.hostname) {
                        store.commit('farm/REMOVE_FLEET_DAEMON_PRINTER', message.hostname)
                    } else if (message.hostname && message.update) {
                        const position = this.getPrinterPosition(message.hostname)
                        const model = this.getPrinterModel(message.hostname)
                        const printerData = {
                            ...message.update,
                            socket: {
                                hostname: message.hostname,
                                isConnected: true,
                                webPort: 80,
                                position: position,
                                printerModel: model,
                            },
                            current_file: {
                                filename: message.update?.print_stats?.filename ?? '',
                            },
                            _namespace: message.hostname,
                        }

                        store.commit('farm/SET_FLEET_DAEMON_PRINTER', {
                            hostname: message.hostname,
                            data: printerData,
                        })
                    }

                    // Emit event for components that need to react to specific messages
                    if (message.event === 'history_updated') {
                        fleetDaemonEvents.$emit('history_updated')
                    }
                    if (message.event === 'spool_updated') {
                        fleetDaemonEvents.$emit('spool_updated')
                    }
                    if (message.event === 'gcodes_updated') {
                        fleetDaemonEvents.$emit('gcodes_updated')
                    }
                } catch (e) {
                    console.warn('[FleetDaemon] WS parse error:', e)
                }
            }

            this.socket.onclose = () => {
                console.warn('[FleetDaemon] Disconnected')
                this.socket = null
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
            this.socket.onclose = null  // prevent auto-reconnect
            this.socket.close()
            this.socket = null
        }
        store.commit('farm/SET_FLEET_DAEMON_CONNECTED', false)
    }

    private getPrinterPosition(hostname: string): { x: number; y: number } {
        const key = hostname.toLowerCase()
        const remotePrinters = store.state.gui?.remoteprinters?.printers || {}
        for (const printer of Object.values(remotePrinters)) {
            if ((printer as any).hostname?.toLowerCase() === key && (printer as any).position) {
                return (printer as any).position
            }
        }
        return { x: 400, y: 400 }
    }

    private getPrinterModel(hostname: string): 'HS-3' | 'HS-Pro' | null {
        const key = hostname.toLowerCase()
        const remotePrinters = store.state.gui?.remoteprinters?.printers || {}
        for (const printer of Object.values(remotePrinters)) {
            if ((printer as any).hostname?.toLowerCase() === key) {
                return (printer as any).printerModel ?? null
            }
        }
        return null
    }
}

/** Event bus for fleet daemon events that components can listen to */
export const fleetDaemonEvents = new Vue()

/** Singleton instance */
export const fleetDaemonClient = new FleetDaemonClient()
