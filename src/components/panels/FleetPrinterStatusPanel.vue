<template>
    <div class="fleet-statistics-panel">
        <v-card-text>
            <!-- Display printer count and status breakdown -->
            <div class="printer-stats mb-4">
                <div class="d-flex justify-space-between align-center mb-2">
                    <p class="mb-0 font-weight-medium">Total Printers: {{ Object.keys(fleetDaemonPrinters).length }}</p>
                    <v-btn icon small @click="reconnectAllFleetPrinters" title="Reconnect All Printers">
                        <v-icon small>{{ mdiReload }}</v-icon>
                    </v-btn>
                </div>
                <div class="status-counters">
                    <span class="status-counter ready" v-if="printerStatusCounts.ready > 0">
                        <v-icon small color="hsl(90, 100%, 32%)">{{ mdiCheckCircle }}</v-icon> Ready: {{ printerStatusCounts.ready }}
                    </span>
                    <span class="status-counter printing pulsing-text" v-if="printerStatusCounts.printing > 0">
                        <v-icon small color="blue">{{ mdiPlayCircle }}</v-icon> Printing: {{ printerStatusCounts.printing }}
                    </span>
                    <span class="status-counter complete" v-if="printerStatusCounts.complete > 0">
                        <v-icon small color="blue">{{ mdiCheckboxMarkedCircle }}</v-icon> Complete: {{ printerStatusCounts.complete }}
                    </span>
                    <span class="status-counter error" v-if="printerStatusCounts.error > 0">
                        <v-icon small color="red">{{ mdiAlertCircle }}</v-icon> Error: {{ printerStatusCounts.error }}
                    </span>
                    <span class="status-counter disconnected" v-if="printerStatusCounts.disconnected > 0">
                        <v-icon small color="gray">{{ mdiConnection }}</v-icon> Disconnected: {{ printerStatusCounts.disconnected }}
                    </span>
                </div>
            </div>

            <!-- Simplified Map View -->
            <div class="simplified-map-container">
                <div class="background-container">
                    <div v-for="(printer, hostname) in fleetDaemonPrinters"
                         :key="hostname"
                         :style="getStyle(printer)"
                         @mouseover="showTooltip(printer, $event)"
                         @mouseleave="hideTooltip"
                         @click="clickPrinter(printer)">
                        <div :style="spinningBorderStyle(printer)"></div>
                        <simplified-printer-map-panel :printer="printer"></simplified-printer-map-panel>
                    </div>

                    <!-- Tooltip: Shows printer details on hover -->
                    <div v-if="hoveredPrinter" class="tooltip" ref="tooltip" :style="tooltipStyle">
                        <p><strong>{{ hoveredPrinter.socket.hostname }}</strong></p>
                        <p>Status: {{ hoveredPrinter.print_stats?.state || 'Unknown' }}</p>
                        <p>Connected: {{ hoveredPrinter.socket.isConnected ? 'Yes' : 'No' }}</p>
                        <p>Filament: {{ hoveredPrinter.toolhead?.filament_type || 'N/A' }}</p>
                        <p>Nozzle: {{ hoveredPrinter.toolhead?.nozzle_size || 'N/A' }}</p>
                        <p>Current File: {{ hoveredPrinter.current_file?.filename || 'None' }}</p>
                        <p>Progress: {{ getPrinterPrintPercent(hoveredPrinter) }}%</p>
                        <p v-if="hoveredPrinter.webhooks?.state_message" style="white-space: pre-wrap; max-width: 300px;">
                            <strong>Message:</strong><br>{{ hoveredPrinter.webhooks.state_message }}
                        </p>
                    </div>
                </div>
            </div>
        </v-card-text>
    </div>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import Panel from '@/components/ui/Panel.vue'
import SimplifiedPrinterMapPanel from '@/components/panels/SimplifiedPrinterMapPanel.vue'
import Vue from 'vue'
import {
    mdiViewDashboard,
    mdiReload,
    mdiCheckCircle,
    mdiPlayCircle,
    mdiCheckboxMarkedCircle,
    mdiAlertCircle,
    mdiConnection
} from '@mdi/js'

@Component({
    components: {
        Panel,
        SimplifiedPrinterMapPanel,
    },
})
export default class FleetPrinterStatusPanel extends Mixins(BaseMixin) {
    mdiViewDashboard = mdiViewDashboard
    mdiReload = mdiReload
    mdiCheckCircle = mdiCheckCircle
    mdiPlayCircle = mdiPlayCircle
    mdiCheckboxMarkedCircle = mdiCheckboxMarkedCircle
    mdiAlertCircle = mdiAlertCircle
    mdiConnection = mdiConnection

    private fleetSocket: WebSocket | null = null
    private reconnectTimer: any = null
    private positions: { [id: string]: { x: number, y: number } } = {}

    // Tooltip
    private hoveredPrinter: any = null
    private tooltipStyle = {
        top: '0px',
        left: '0px',
        position: 'absolute',
    }

    get fleetDaemonPrinters() {
        return this.$store.state.farm.fleetDaemonPrinters || {}
    }

    get printerStatusCounts() {
        const counts = {
            printing: 0,
            ready: 0,
            complete: 0,
            error: 0,
            disconnected: 0
        }

        Object.values(this.fleetDaemonPrinters).forEach((printer: any) => {
            const status = this.getPrinterStatus(printer)
            counts[status]++
        })

        return counts
    }

    mounted() {
        this.connectWebSocket()
        this.loadPrinterPositions()
    }

    beforeDestroy() {
        this.cleanup()
    }

    cleanup() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer)
            this.reconnectTimer = null
        }
        if (this.fleetSocket) {
            this.fleetSocket.close()
            this.fleetSocket = null
        }
    }

    connectWebSocket() {
        if (this.fleetSocket) {
            this.fleetSocket.close()
        }

        try {
            this.fleetSocket = new WebSocket('ws://pantheonfleet2.local:8090/ws')

            this.fleetSocket.onopen = () => {
                console.log('Fleet Daemon connected from Jobs page')
                // Clear any reconnect timer
                if (this.reconnectTimer) {
                    clearTimeout(this.reconnectTimer)
                    this.reconnectTimer = null
                }
            }

            this.fleetSocket.onmessage = (event: MessageEvent) => {
                try {
                    const message = JSON.parse(event.data)
                    if (message.removed && message.hostname) {
                        // Handle printer removal
                        this.$store.commit('farm/REMOVE_FLEET_DAEMON_PRINTER', message.hostname)
                    } else if (message.hostname && message.update) {
                        // Handle printer update
                        const printerData = {
                            socket: {
                                hostname: message.hostname,
                                isConnected: true,
                                webPort: 80,
                                position: this.positions[message.hostname] || { x: 400, y: 400 }
                            },
                            ...message.update,
                            current_file: {
                                filename: message.update?.print_stats?.filename ?? '',
                            },
                            _namespace: message.hostname
                        }

                        this.$store.commit('farm/SET_FLEET_DAEMON_PRINTER', {
                            hostname: message.hostname,
                            data: printerData
                        })
                    }
                } catch (e) {
                    console.warn('Fleet daemon WS error:', e)
                }
            }

            this.fleetSocket.onclose = () => {
                console.warn('Fleet daemon WebSocket closed')
                this.fleetSocket = null

                // Attempt to reconnect after 5 seconds
                this.reconnectTimer = setTimeout(() => {
                    this.connectWebSocket()
                }, 5000)
            }

            this.fleetSocket.onerror = (error) => {
                console.error('Fleet daemon WebSocket error:', error)
            }

        } catch (e) {
            console.error('Failed to create WebSocket:', e)

            // Retry after 5 seconds
            this.reconnectTimer = setTimeout(() => {
                this.connectWebSocket()
            }, 5000)
        }
    }

    loadPrinterPositions() {
        // Load positions from remoteprinters config if available
        const remotePrinters = this.$store.state.gui?.remoteprinters?.printers || {}
        Object.entries(remotePrinters).forEach(([id, printer]: [string, any]) => {
            if (printer.hostname && printer.position) {
                this.positions[printer.hostname] = printer.position
            }
        })
    }

    getPrinterStatus(printer: any): 'disconnected' | 'error' | 'printing' | 'complete' | 'ready' {
        const fleetDisconnected = printer.fleet_to_printer_ws === false

        // 1. Fleet to printer WS is disconnected
        if (fleetDisconnected) {
            return 'disconnected'
        }

        // 2. WebSocket or printer connection is down
        if (!this.fleetSocket || this.fleetSocket.readyState !== WebSocket.OPEN || !printer.socket?.isConnected) {
            return 'disconnected'
        }

        // 3. Webhook shutdown
        if (printer.webhooks?.state === 'shutdown') {
            return 'error'
        }

        // 4. Check print_stats state
        const state = printer.print_stats?.state
        if (state === 'printing') {
            return 'printing'
        } else if (state === 'error' || state === 'paused' || state === 'cancelled') {
            return 'error'
        } else if (state === 'complete') {
            return 'complete'
        } else if (state === 'standby') {
            return 'ready'
        }

        // Default to disconnected if state is unknown
        return 'disconnected'
    }

    getPrinterModel(hostname: string): 'HS-3' | 'HS-Pro' | null {
        const remotePrinters = this.$store.state.gui?.remoteprinters?.printers || {}
        for (const printer of Object.values(remotePrinters)) {
            if ((printer as any).hostname === hostname) {
                return (printer as any).printerModel ?? null
            }
        }
        return null
    }

    getStyle(printer: any) {
        const hostname = printer.socket?.hostname || ''
        const position = this.positions[hostname] || { x: 400, y: 400 }
        const size = "20px" // Slightly smaller for the jobs page

        // Determine style based on model
        const model = this.getPrinterModel(hostname)
        const clip = model === 'HS-Pro' ? 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)' : 'circle(50%)'

        return {
            position: 'absolute',
            left: (position.x) + 'px',
            top: (position.y) + 'px',
            width: size,
            height: size,
            borderRadius: model === 'HS-Pro' ? '0%' : '50%',
            clipPath: clip,
            backgroundColor: 'transparent',
            cursor: 'pointer'
        }
    }

    spinningBorderStyle(printer: any) {
        const hostname = printer.socket?.hostname || ''
        const model = this.getPrinterModel(hostname)
        const isSquare = model === 'HS-Pro'

        const fleetDisconnected = printer.fleet_to_printer_ws === false

        // 1. FLEET TO PRINTER WS is disconnected = GRAY
        if (fleetDisconnected) {
            return {
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                borderRadius: isSquare ? '0%' : '50%',
                border: '0.2em solid gray',
                zIndex: 2,
                pointerEvents: 'none',
            }
        }

        // 2. WebSocket or printer connection is down = GRAY
        if (!this.fleetSocket || this.fleetSocket.readyState !== WebSocket.OPEN || !printer.socket?.isConnected) {
            return {
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                borderRadius: isSquare ? '0%' : '50%',
                border: '0.2em solid gray',
                zIndex: 2,
                pointerEvents: 'none',
            }
        }

        // 3. Webhook shutdown = RED
        if (printer.webhooks?.state === 'shutdown') {
            return {
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                borderRadius: isSquare ? '0%' : '50%',
                border: '0.2em solid red',
                zIndex: 2,
                pointerEvents: 'none',
            }
        }

        // 4. Printing = spinning animation
        const state = printer.print_stats?.state
        if (state === 'printing') {
            if (isSquare) {
                return {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    borderRadius: '0%',
                    background: `conic-gradient(transparent 0%, blue 10%, transparent 90%)`,
                    mask: `
                        linear-gradient(#fff 0 0) content-box,
                        linear-gradient(#fff 0 0)
                    `,
                    maskComposite: 'subtract',
                    padding: '0.2em',
                    animation: 'spin 2s linear infinite',
                    zIndex: 2,
                    pointerEvents: 'none',
                }
            } else {
                return {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    background: `conic-gradient(transparent 0%, blue 10%, transparent 90%)`,
                    mask: "radial-gradient(farthest-side, transparent calc(100% - 0.25em), black calc(100% - 0.25em))",
                    animation: 'spin 2s linear infinite',
                    zIndex: 2,
                    pointerEvents: 'none',
                }
            }
        }

        // 5. Other states
        let color = 'gray'
        if (state === 'error' || state === 'paused' || state === 'cancelled') {
            color = 'red'
        } else if (state === 'complete') {
            color = 'blue'
        } else if (state === 'standby') {
            color = 'hsl(90, 100%, 32%)'
        }

        return {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            borderRadius: isSquare ? '0%' : '50%',
            border: `0.2em solid ${color}`,
            zIndex: 2,
            pointerEvents: 'none',
        }
    }

    showTooltip(printer: any, event: MouseEvent) {
        this.hoveredPrinter = printer

        this.$nextTick(() => {
            const tooltipElement = this.$refs.tooltip as HTMLElement
            if (!tooltipElement) return

            const hostname = printer.socket?.hostname || ''
            const printerPosition = this.positions[hostname] || { x: 400, y: 400 }
            const screenWidth = window.innerWidth
            const tooltipWidth = tooltipElement.offsetWidth

            // Position tooltip to the right of printer, scaled down
            let tooltipLeft = (printerPosition.x) + 30

            // Check if tooltip would go off right edge of screen
            if (event.clientX + tooltipWidth > (screenWidth - 300)) {
                // Move tooltip to the left of printer
                tooltipLeft = (printerPosition.x) - tooltipWidth + 10

                // Check if moving to left would go off left edge of screen
                if (tooltipLeft < 10) {
                    tooltipLeft = (printerPosition.x) + 30
                    if (tooltipLeft + tooltipWidth > screenWidth - 10) {
                        tooltipLeft = screenWidth - tooltipWidth - 10
                    }
                }
            }

            this.tooltipStyle.top = `${(printerPosition.y) + 15}px`
            this.tooltipStyle.left = `${tooltipLeft}px`
        })
    }

    hideTooltip() {
        this.hoveredPrinter = null
    }

    clickPrinter(printer: any) {

        //this.$toast.success(JSON.stringify(printer, null, 2));
        //this.$toast.success(this.$store.state.gui?.remoteprinters?.printers);
        console.log(this.$store.state)
        /*
        if (printer.socket.isConnected) {
            const thisUrl = window.location.href.split('/')
            const protocol = thisUrl[0]

            let url = protocol + '//' + printer.socket.hostname
            if (80 !== printer.socket.webPort) url += ':' + printer.socket.webPort

            window.open(url)
        }
        */
    }

    reconnectAllFleetPrinters() {
        this.$toast.info('Reconnecting all printers...')

        // First reconnect WebSocket
        this.cleanup()
        this.connectWebSocket()

        // Then trigger printer reconnect
        fetch('http://pantheonfleet2.local:8090/reconnect_all', { method: 'POST' })
            .then(res => {
                if (res.ok) {
                    this.$toast.success('Reconnecting all printers...')
                } else {
                    throw new Error('Failed to reconnect')
                }
            })
            .catch(err => {
                console.error(err)
                this.$toast.error('Failed to trigger reconnect')
            })
    }

    getPrinterPrintPercent(printer: any) {
        const progress = printer.virtual_sdcard?.progress || 0
        return Math.floor(progress * 100)
    }
}
</script>

<style scoped>
.simplified-map-container {
    position: relative;
    width: 100%;
    height: 600px;
}

.background-container {
    background-image: url('@/components/ui/NewBuilding v2.png');
    background-size: 100% 100%;
    background-repeat: no-repeat;
    background-position: left;
    width: 1000px;
    height: 500px;
    position: absolute;
}

/* Status counter styles */
.printer-stats {
    font-size: 14px;
}

.status-counters {
    display: flex;
    gap: 15px;
    flex-wrap: wrap;
}

.status-counter {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 8px;
    border-radius: 4px;
    background-color: rgba(0, 0, 0, 0.05);
}

.status-counter.printing {
    color: #1976d2;
}

.status-counter.ready {
    color: hsl(90, 100%, 32%);
}

.status-counter.complete {
    color: #1976d2;
}

.status-counter.error {
    color: #d32f2f;
}

.status-counter.disconnected {
    color: #757575;
}

@keyframes pulse {
    0%, 100% {
        opacity: 1;
    }
    50% {
        opacity: 0.4;
    }
}

.pulsing-text {
    animation: pulse 1.5s infinite;
}

@keyframes spin {
    from {
        transform: rotate(0);
    }
    to {
        transform: rotate(360deg);
    }
}

.tooltip {
    position: absolute;
    background-color: rgba(0, 0, 0, 0.75);
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    white-space: nowrap;
    z-index: 10;
    font-size: 12px;
}
</style>
