<template>
    <div>
        <!-- Fleet Printer Status Panel -->
        <v-row>
            <v-col>
                <v-card class="mb-3">
                    <v-card-title class="py-2 d-flex justify-space-between align-center">
                        <span class="text-h6">Fleet Printer Status</span>
                        <v-btn icon @click="togglePanel('fleetStatus')">
                            <v-icon>{{ panelStates.fleetStatus ? mdiChevronUp : mdiChevronDown }}</v-icon>
                        </v-btn>
                    </v-card-title>
                    <v-expand-transition>
                        <div v-show="panelStates.fleetStatus">
                            <fleet-printer-status-panel />
                        </div>
                    </v-expand-transition>
                </v-card>
            </v-col>
        </v-row>

        <!-- Job Statistics Panel -->
        <v-row>
            <v-col>
                <v-card class="mb-3">
                    <v-card-title class="py-2 d-flex justify-space-between align-center">
                        <span class="text-h6">Job Statistics</span>
                        <v-btn icon @click="togglePanel('jobStats')">
                            <v-icon>{{ panelStates.jobStats ? mdiChevronUp : mdiChevronDown }}</v-icon>
                        </v-btn>
                    </v-card-title>
                    <v-expand-transition>
                        <div v-show="panelStates.jobStats">
                            <job-statistics-panel />
                        </div>
                    </v-expand-transition>
                </v-card>
            </v-col>
        </v-row>

        <!-- Job List Panel -->
        <v-row class="mt-0">
            <v-col>
                <v-card class="mb-3">
                    <v-card-title class="py-2 d-flex justify-space-between align-center">
                        <span class="text-h6">Job Management</span>
                        <v-btn icon @click="togglePanel('jobList')">
                            <v-icon>{{ panelStates.jobList ? mdiChevronUp : mdiChevronDown }}</v-icon>
                        </v-btn>
                    </v-card-title>
                    <v-expand-transition>
                        <div v-show="panelStates.jobList">
                            <job-list-panel />
                        </div>
                    </v-expand-transition>
                </v-card>
            </v-col>
        </v-row>

        <!-- Customer Panel -->
        <v-row>
            <v-col>
                <v-card class="mb-3">
                    <v-card-title class="py-2 d-flex justify-space-between align-center">
                        <span class="text-h6">Customer Management</span>
                        <v-btn icon @click="togglePanel('customers')">
                            <v-icon>{{ panelStates.customers ? mdiChevronUp : mdiChevronDown }}</v-icon>
                        </v-btn>
                    </v-card-title>
                    <v-expand-transition>
                        <div v-show="panelStates.customers">
                            <customer-panel />
                        </div>
                    </v-expand-transition>
                </v-card>
            </v-col>
        </v-row>

        <!-- Floating Action Button - Expand/Collapse All -->
        <v-fab-transition>
            <v-btn fab
                   fixed
                   bottom
                   right
                   color="primary"
                   @click="toggleAllPanels"
                   class="mb-16 mr-4"
                   title="Expand/Collapse All Panels">
                <v-icon>{{ allPanelsExpanded ? mdiUnfoldLessHorizontal : mdiUnfoldMoreHorizontal }}</v-icon>
            </v-btn>
        </v-fab-transition>
    </div>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import JobListPanel from '@/components/panels/JobListPanel.vue'
import JobStatisticsPanel from '@/components/panels/JobStatisticsPanel.vue'
import CustomerPanel from '@/components/panels/CustomerPanel.vue'
import FleetPrinterStatusPanel from '@/components/panels/FleetPrinterStatusPanel.vue'
import {
    mdiChevronUp,
    mdiChevronDown,
    mdiUnfoldMoreHorizontal,
    mdiUnfoldLessHorizontal
} from '@mdi/js'

interface PanelStates {
    fleetStatus: boolean
    jobStats: boolean
    jobList: boolean
    customers: boolean
}

@Component({
    components: {
        JobStatisticsPanel,
        JobListPanel,
        CustomerPanel,
        FleetPrinterStatusPanel,
    },
})
export default class PageJob extends Mixins(BaseMixin) {
    mdiChevronUp = mdiChevronUp
    mdiChevronDown = mdiChevronDown
    mdiUnfoldMoreHorizontal = mdiUnfoldMoreHorizontal
    mdiUnfoldLessHorizontal = mdiUnfoldLessHorizontal
    // Fleet WebSocket management
    private fleetSocket: WebSocket | null = null
    private reconnectTimer: any = null
    private positions: { [id: string]: { x: number, y: number } } = {}

    // Panel collapse/expand states
    private panelStates: PanelStates = {
        fleetStatus: true,   // Expanded by default
        jobStats: true,      // Expanded by default
        jobList: true,       // Expanded by default (most important)
        customers: false,    // Collapsed by default (less frequently used)
    }

    get allPanelsExpanded(): boolean {
        return Object.values(this.panelStates).every(state => state === true)
    }

    get allPanelsCollapsed(): boolean {
        return Object.values(this.panelStates).every(state => state === false)
    }

    async mounted() {
        // Load saved panel states from localStorage
        this.loadPanelStates()
        
        // Initialize fleet WebSocket connection
        this.connectFleetWebSocket()
        this.loadPrinterPositions()
        
        // Initialize job data when page loads
        await this.loadJobs()
        await this.loadCustomers()
    }

    beforeDestroy() {
        this.cleanupFleetConnection()
    }

    // Fleet WebSocket methods
    connectFleetWebSocket() {
        if (this.fleetSocket) {
            this.fleetSocket.close()
        }

        try {
            this.fleetSocket = new WebSocket('ws://pantheonfleet2.local:8090/ws')

            this.fleetSocket.onopen = () => {
                console.log('Fleet Daemon connected from Jobs page')
                if (this.reconnectTimer) {
                    clearTimeout(this.reconnectTimer)
                    this.reconnectTimer = null
                }
            }

            this.fleetSocket.onmessage = (event: MessageEvent) => {
                try {
                    const message = JSON.parse(event.data)
                    if (message.removed && message.hostname) {
                        this.$store.commit('farm/REMOVE_FLEET_DAEMON_PRINTER', message.hostname)
                    } else if (message.hostname && message.update) {
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

                this.reconnectTimer = setTimeout(() => {
                    this.connectFleetWebSocket()
                }, 5000)
            }

            this.fleetSocket.onerror = (error) => {
                console.error('Fleet daemon WebSocket error:', error)
            }

        } catch (e) {
            console.error('Failed to create WebSocket:', e)
            this.reconnectTimer = setTimeout(() => {
                this.connectFleetWebSocket()
            }, 5000)
        }
    }

    loadPrinterPositions() {
        const remotePrinters = this.$store.state.gui?.remoteprinters?.printers || {}
        Object.entries(remotePrinters).forEach(([id, printer]: [string, any]) => {
            if (printer.hostname && printer.position) {
                this.positions[printer.hostname] = printer.position
            }
        })
    }

    cleanupFleetConnection() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer)
            this.reconnectTimer = null
        }
        if (this.fleetSocket) {
            this.fleetSocket.close()
            this.fleetSocket = null
        }
    }

    async mounted() {
        // Load saved panel states from localStorage
        this.loadPanelStates()

        // Initialize job data when page loads
        await this.loadJobs()
        await this.loadCustomers()
    }

    async loadJobs() {
        try {
            await this.$store.dispatch('fleet/jobs/loadJobs')
        } catch (error) {
            console.error('Failed to load jobs:', error)
        }
    }

    async loadCustomers() {
        try {
            await this.$store.dispatch('fleet/jobs/loadCustomers')
        } catch (error) {
            console.error('Failed to load customers:', error)
        }
    }

    togglePanel(panelName: keyof PanelStates) {
        this.panelStates[panelName] = !this.panelStates[panelName]
        this.savePanelStates()
    }

    toggleAllPanels() {
        const targetState = this.allPanelsExpanded ? false : true

        // Set all panels to the target state
        Object.keys(this.panelStates).forEach(key => {
            this.panelStates[key as keyof PanelStates] = targetState
        })

        this.savePanelStates()
    }

    expandAllPanels() {
        Object.keys(this.panelStates).forEach(key => {
            this.panelStates[key as keyof PanelStates] = true
        })
        this.savePanelStates()
    }

    collapseAllPanels() {
        Object.keys(this.panelStates).forEach(key => {
            this.panelStates[key as keyof PanelStates] = false
        })
        this.savePanelStates()
    }

    savePanelStates() {
        try {
            localStorage.setItem('jobPagePanelStates', JSON.stringify(this.panelStates))
        } catch (error) {
            console.warn('Failed to save panel states to localStorage:', error)
        }
    }

    loadPanelStates() {
        try {
            const saved = localStorage.getItem('jobPagePanelStates')
            if (saved) {
                const parsedStates = JSON.parse(saved)
                // Merge saved states with defaults to handle new panels
                this.panelStates = { ...this.panelStates, ...parsedStates }
            }
        } catch (error) {
            console.warn('Failed to load panel states from localStorage:', error)
            // Keep default states if loading fails
        }
    }
}
</script>

<style scoped>
    /* Custom styles for collapsible panels */
    .v-card-title {
        cursor: pointer;
        user-select: none;
        transition: background-color 0.2s ease;
    }

        .v-card-title:hover {
            background-color: rgba(0, 0, 0, 0.04);
        }

    /* Dark theme hover effect */
    .theme--dark .v-card-title:hover {
        background-color: rgba(255, 255, 255, 0.04);
    }

    /* Smooth transitions for panel content */
    .v-expand-transition-enter-active,
    .v-expand-transition-leave-active {
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.5, 1);
    }

    /* Floating action button positioning */
    .v-btn--fab {
        z-index: 6;
    }

    /* Ensure panels have proper spacing */
    .v-card {
        overflow: hidden;
    }

        /* Panel content padding adjustment */
        .v-card .v-card-text {
            padding-top: 0;
        }
</style>
