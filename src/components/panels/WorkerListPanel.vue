<template>
    <v-card flat>
        <v-card-title class="d-flex align-center flex-wrap">
            <span class="mr-3">Fleet workers</span>
            <v-chip small outlined :color="scheduler && scheduler.running ? 'green' : 'red'" class="mr-2">
                <v-icon x-small left>{{ mdiRobot }}</v-icon>
                scheduler {{ scheduler && scheduler.running ? 'running' : 'stopped' }}
                <span v-if="scheduler && scheduler.last_tick_at" class="ml-1">· tick {{ relative(scheduler.last_tick_at) }}</span>
                <span v-if="scheduler && scheduler.pending_items != null" class="ml-1">· {{ scheduler.pending_items }} pending</span>
            </v-chip>
            <v-tooltip v-if="scheduler && scheduler.dispatch_paused" bottom max-width="420">
                <template #activator="{ on }">
                    <v-chip small color="error" text-color="white" class="mr-2" v-on="on">
                        <v-icon x-small left>{{ mdiAlertCircle }}</v-icon>
                        dispatch paused
                    </v-chip>
                </template>
                <span>{{ scheduler.dispatch_paused }} — no jobs are sent to any printer until fleet gcode storage is back; dispatch resumes automatically.</span>
            </v-tooltip>
            <v-btn x-small text :loading="ticking" @click="tick">Run scheduler now</v-btn>
            <v-chip small outlined class="ml-2 mr-2">
                <v-icon x-small left color="orange">{{ mdiHammer }}</v-icon>
                {{ enabledHostnames.length }} worker{{ enabledHostnames.length === 1 ? '' : 's' }}
            </v-chip>
            <v-chip
                small
                :outlined="attentionHostnames.length === 0"
                :color="attentionHostnames.length ? 'error' : undefined"
                :text-color="attentionHostnames.length ? 'white' : undefined"
                title="Workers that could run a job but are blocked by low filament or not primed">
                <v-icon x-small left>{{ mdiExclamationThick }}</v-icon>
                {{ attentionHostnames.length }} need{{ attentionHostnames.length === 1 ? 's' : '' }} attention
            </v-chip>
            <v-spacer />
            <v-btn-toggle v-model="view" dense mandatory class="mr-3" @change="saveView">
                <v-btn small value="list" title="List"><v-icon small>{{ mdiFormatListBulleted }}</v-icon></v-btn>
                <v-btn small value="map" title="Map"><v-icon small>{{ mdiMapOutline }}</v-icon></v-btn>
            </v-btn-toggle>
            <v-btn small text color="error" :disabled="enabledCount === 0" @click="disableAllDialog = true">
                Disable all
            </v-btn>
        </v-card-title>

        <!-- Disable-all confirmation -->
        <v-dialog v-model="disableAllDialog" max-width="440">
            <v-card>
                <v-card-title>Disable all workers?</v-card-title>
                <v-card-text>
                    This turns off <strong>{{ enabledCount }}</strong> worker{{ enabledCount === 1 ? '' : 's' }}.
                    The scheduler will stop sending new jobs to every printer. Prints already running keep going and
                    stay tracked. You can re-enable printers one at a time from the list or the map.
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn text @click="disableAllDialog = false">Cancel</v-btn>
                    <v-btn color="error" :loading="bulkBusy" @click="confirmDisableAll">Disable all</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
        <v-card-subtitle class="pb-1">
            Every printer connected to fleet_daemon is listed. Workers receive jobs automatically; manual prints of a job's
            file on any printer are still tracked.
        </v-card-subtitle>

        <v-alert v-if="error" type="error" dense dismissible class="mx-4" @input="error = ''">{{ error }}</v-alert>

        <!-- Map view: the fleet map as a toggle surface + a simplified side list.
             The divider between them is draggable; the chosen list width is remembered.
             Side by side, the layout is sized to the viewport and the map column and the list
             each scroll on their own (the tab window above is overflow:hidden, so sticky can't
             be used here). Scrolling down to the second floor never moves the list off screen. -->
        <div
            v-if="view === 'map'"
            ref="mapLayout"
            class="worker-map-layout px-2 pb-2"
            :class="{ 'worker-map-layout--stacked': stacked, 'worker-map-layout--resizing': resizingSide }"
            :style="mapLayoutStyle">
            <div class="worker-map-main">
                <!-- TOTAL fleet status across both floors (same legend as the Fleet Map page) -->
                <div class="fleet-title-row mb-4">
                    <span class="fleet-title">Fleet total</span>
                    <span class="fleet-total">{{ totalPrinterCount }} total</span>
                    <div class="status-counters">
                        <span class="status-counter status-counter--total"
                              :title="`${totalWorkerCount} of ${totalPrinterCount} printers are enabled as fleet workers`">
                            <v-icon x-small color="orange">{{ mdiHammer }}</v-icon>
                            Workers {{ totalWorkerCount }}
                        </span>
                        <span v-for="s in totalStatusList" :key="'total-' + s.key" class="status-counter">
                            <span class="status-dot" :class="{ square: s.key === 'error' || s.key === 'printing' }"
                                  :style="{ backgroundColor: s.color }"></span>
                            {{ s.label }} {{ s.count }}
                        </span>
                    </div>
                </div>
                <farm-map-section
                    location="farm"
                    name="Print Farm"
                    mode="workers"
                    :worker-hostnames="enabledHostnames"
                    :attention-hostnames="attentionHostnames"
                    :attention-reasons="attentionReasons"
                    :highlight-hostname="hoverHost"
                    class="mb-6"
                    @toggle-worker="toggleByHostname" />
                <farm-map-section
                    location="ground"
                    name="Ground Floor"
                    mode="workers"
                    :worker-hostnames="enabledHostnames"
                    :attention-hostnames="attentionHostnames"
                    :attention-reasons="attentionReasons"
                    :highlight-hostname="hoverHost"
                    @toggle-worker="toggleByHostname" />
            </div>
            <div
                v-if="!stacked"
                class="worker-side-resizer"
                title="Drag to resize the worker list · double-click to reset"
                @pointerdown="startSideResize"
                @dblclick="resetSideWidth">
                <div class="worker-side-resizer__grip" />
            </div>
            <div class="worker-side-col" :style="sideColStyle">
                <v-simple-table dense fixed-header class="worker-side-list">
                    <thead>
                        <tr>
                            <th style="width: 60px">Worker</th>
                            <th>Printer</th>
                            <th>Filament / nozzle / weight</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="w in workersSorted"
                            :key="'side-' + w.printer_hostname"
                            :class="{ 'row-hover': hoverHost === w.printer_hostname }"
                            @mouseenter="hoverHost = w.printer_hostname"
                            @mouseleave="hoverHost = ''">
                            <td>
                                <v-switch
                                    :input-value="w.enabled"
                                    dense
                                    hide-details
                                    class="mt-0 pt-0"
                                    :loading="toggling === w.printer_hostname"
                                    @change="toggle(w, $event)" />
                            </td>
                            <td>
                                <span :class="{ 'text--secondary': !w.connected }">{{ shortName(w.printer_hostname) }}</span>
                                <v-icon v-if="needsAttention(w)" x-small color="error" class="ml-1" :title="w.reason">{{ mdiExclamationThick }}</v-icon>
                                <v-icon v-else-if="w.enabled" x-small color="orange" class="ml-1">{{ mdiHammer }}</v-icon>
                                <div class="text-caption text--secondary">{{ w.printer_model || '' }} · {{ statusText(w) }}</div>
                            </td>
                            <td class="text-caption">
                                {{ liveFilament(w) || '—' }}
                                <span v-if="liveNozzle(w)"> · {{ liveNozzle(w) }} mm</span>
                                <span v-if="liveRemaining(w) != null"> · {{ Math.round(liveRemaining(w)) }} g</span>
                            </td>
                        </tr>
                    </tbody>
                </v-simple-table>
            </div>
        </div>

        <v-data-table
            v-else
            :headers="headers"
            :items="workers"
            :loading="loading"
            :items-per-page="100"
            :footer-props="{ 'items-per-page-options': [100, 250, 500, -1] }"
            dense
            sort-by="printer_hostname"
            item-key="printer_hostname">
            <template #item.enabled="{ item }">
                <div class="d-flex align-center">
                    <v-switch
                        :input-value="item.enabled"
                        dense
                        hide-details
                        class="mt-0"
                        :loading="toggling === item.printer_hostname"
                        @change="toggle(item, $event)" />
                    <span v-if="justDisabled === item.printer_hostname" class="text-caption text--secondary ml-2">
                        Current job keeps running and stays tracked; no new jobs will be sent.
                    </span>
                </div>
            </template>
            <template #item.printer_hostname="{ item }">
                <span>{{ item.printer_hostname }}</span>
                <div class="text-caption text--secondary">{{ item.printer_model || 'model ?' }}</div>
            </template>
            <template #item.print_state="{ item }">
                <v-chip x-small :color="statusColor(item)" text-color="white">{{ statusText(item) }}</v-chip>
                <div v-if="liveFilename(item)" class="text-caption text-truncate" style="max-width: 200px" :title="liveFilename(item)">{{ liveFilename(item) }}</div>
            </template>
            <template #item.filament_type="{ item }">
                <span>{{ liveFilament(item) || '—' }}</span>
                <span v-if="liveNozzle(item)" class="text--secondary"> · {{ liveNozzle(item) }} mm</span>
                <div class="text-caption text--secondary">{{ liveRemaining(item) != null ? Math.round(liveRemaining(item)) + ' g left' : '' }}</div>
            </template>
            <template #item.primed="{ item }">
                <v-chip v-if="livePrimed(item) === true" x-small color="green" text-color="white">primed</v-chip>
                <v-chip v-else-if="livePrimed(item) === false" x-small color="grey" text-color="white">not primed</v-chip>
                <span v-else class="text--secondary text-caption">n/a</span>
            </template>
            <template #item.reason="{ item }">
                <span :class="item.eligible ? 'green--text' : ''">{{ item.reason || '—' }}</span>
            </template>
            <template #item.active_run="{ item }">
                <div v-if="item.active_run" class="text-caption">
                    <v-chip x-small :color="item.active_run.source === 'manual' ? 'orange' : 'blue'" text-color="white" class="mr-1">
                        <v-icon v-if="item.active_run.source === 'manual'" x-small left>{{ mdiHandBackRight }}</v-icon>
                        {{ item.active_run.status }}
                    </v-chip>
                    <a class="job-link" @click.stop="openJob(item.active_run.job_id)">{{ item.active_run.job_name }}</a>
                    <div class="text--secondary text-truncate" style="max-width: 220px" :title="item.active_run.gcode_filename">
                        {{ item.active_run.gcode_filename }}
                    </div>
                </div>
                <span v-else class="text--secondary">—</span>
            </template>
        </v-data-table>
    </v-card>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import { Watch } from 'vue-property-decorator'
import { mdiAlertCircle, mdiExclamationThick, mdiFormatListBulleted, mdiHammer, mdiHandBackRight, mdiMapOutline, mdiRobot } from '@mdi/js'
import { FleetWorker, FleetSchedulerStatus } from '@/store/fleet/jobs/types'
import { getPrinterStatus, PrinterStatus } from '@/components/panels/farmPrinterStatus'
import FarmMapSection from '@/components/panels/FarmMapSection.vue'
import {
    workerNeedsAttention,
    enabledWorkerHostnames,
    attentionWorkerHostnames,
    attentionWorkerReasons,
} from '@/components/panels/fleetWorkerAttention'

const VIEW_KEY = 'fleetWorkersView'
const SIDE_WIDTH_KEY = 'fleetWorkersSideWidth'
/** Side-list width bounds (px) while dragging. */
const SIDE_MIN_WIDTH = 260
const MAP_MIN_WIDTH = 360

@Component({ components: { FarmMapSection } })
export default class WorkerListPanel extends Vue {
    mdiAlertCircle = mdiAlertCircle
    mdiHandBackRight = mdiHandBackRight
    mdiRobot = mdiRobot
    mdiHammer = mdiHammer
    mdiExclamationThick = mdiExclamationThick
    mdiFormatListBulleted = mdiFormatListBulleted
    mdiMapOutline = mdiMapOutline

    view: 'list' | 'map' = 'map'
    /** Printer hovered in the side list; highlighted on the map. */
    hoverHost = ''

    /** Width (px) of the side list in map view; null = default share of the row. */
    sideWidth: number | null = null
    resizingSide = false
    private resizeStartX = 0
    private resizeStartWidth = 0
    private onSidePointerMove: ((e: PointerEvent) => void) | null = null
    private onSidePointerUp: ((e: PointerEvent) => void) | null = null

    /** Document-relative top of the map layout; the layout fills the viewport below it. */
    layoutTop = 0
    private layoutObserver: ResizeObserver | null = null

    created() {
        try {
            const v = localStorage.getItem(VIEW_KEY)
            if (v === 'map' || v === 'list') this.view = v
            const w = Number(localStorage.getItem(SIDE_WIDTH_KEY))
            if (Number.isFinite(w) && w >= SIDE_MIN_WIDTH) this.sideWidth = w
        } catch (e) {
            // storage unavailable — keep defaults
        }
    }

    mounted() {
        window.addEventListener('resize', this.measureLayout)
        if (typeof ResizeObserver !== 'undefined') {
            // Anything above the layout changing height (title wrapping, an alert) moves it.
            this.layoutObserver = new ResizeObserver(() => this.measureLayout())
            this.layoutObserver.observe(this.$el as HTMLElement)
        }
        this.$nextTick(this.measureLayout)
    }

    beforeDestroy() {
        this.stopSideResize()
        window.removeEventListener('resize', this.measureLayout)
        this.layoutObserver?.disconnect()
        this.layoutObserver = null
    }

    @Watch('view')
    onViewChange() {
        this.$nextTick(this.measureLayout)
    }

    measureLayout() {
        const el = this.$refs.mapLayout as HTMLElement | undefined
        if (!el) return
        const top = Math.round(el.getBoundingClientRect().top + window.scrollY)
        if (top !== this.layoutTop) this.layoutTop = top
    }

    /** Side by side: fill the viewport below the layout's top so each column scrolls on its own. */
    get mapLayoutStyle(): Record<string, string> {
        if (this.stacked) return {}
        // 16px keeps the card's bottom padding visible; min-height keeps short windows usable.
        return { height: `max(420px, calc(100vh - ${this.layoutTop}px - 16px))` }
    }

    /** Below the lg breakpoint the map and list stack, so there is nothing to resize. */
    get stacked(): boolean {
        return this.$vuetify.breakpoint.mdAndDown
    }

    get sideColStyle(): Record<string, string> {
        if (this.stacked) return { width: '100%' }
        if (this.sideWidth == null) return { width: '33.333%' }
        return { width: `${this.sideWidth}px` }
    }

    startSideResize(e: PointerEvent) {
        if (this.stacked || e.button !== 0) return
        e.preventDefault()
        const sideEl = (this.$refs.mapLayout as HTMLElement | undefined)?.querySelector<HTMLElement>('.worker-side-col')
        if (!sideEl) return
        this.resizingSide = true
        this.resizeStartX = e.clientX
        this.resizeStartWidth = sideEl.offsetWidth
        this.onSidePointerMove = (ev: PointerEvent) => this.moveSideResize(ev)
        this.onSidePointerUp = () => this.stopSideResize(true)
        window.addEventListener('pointermove', this.onSidePointerMove)
        window.addEventListener('pointerup', this.onSidePointerUp)
        window.addEventListener('pointercancel', this.onSidePointerUp)
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
    }

    moveSideResize(e: PointerEvent) {
        const layout = this.$refs.mapLayout as HTMLElement | undefined
        if (!layout) return
        // The list sits on the right, so dragging left makes it wider.
        const wanted = this.resizeStartWidth - (e.clientX - this.resizeStartX)
        const max = Math.max(SIDE_MIN_WIDTH, layout.clientWidth - MAP_MIN_WIDTH)
        this.sideWidth = Math.round(Math.min(max, Math.max(SIDE_MIN_WIDTH, wanted)))
    }

    stopSideResize(persist = false) {
        if (this.onSidePointerMove) window.removeEventListener('pointermove', this.onSidePointerMove)
        if (this.onSidePointerUp) {
            window.removeEventListener('pointerup', this.onSidePointerUp)
            window.removeEventListener('pointercancel', this.onSidePointerUp)
        }
        this.onSidePointerMove = null
        this.onSidePointerUp = null
        if (!this.resizingSide) return
        this.resizingSide = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        if (persist) this.saveSideWidth()
    }

    resetSideWidth() {
        this.sideWidth = null
        this.saveSideWidth()
    }

    saveSideWidth() {
        try {
            if (this.sideWidth == null) localStorage.removeItem(SIDE_WIDTH_KEY)
            else localStorage.setItem(SIDE_WIDTH_KEY, String(this.sideWidth))
        } catch (e) {
            // ignore
        }
    }

    saveView(v: string) {
        try {
            localStorage.setItem(VIEW_KEY, v)
        } catch (e) {
            // ignore
        }
    }

    error = ''
    toggling: string | null = null
    justDisabled: string | null = null
    ticking = false
    disableAllDialog = false
    bulkBusy = false

    headers = [
        { text: 'Worker', value: 'enabled', width: 110, sortable: false },
        { text: 'Printer', value: 'printer_hostname' },
        { text: 'Status', value: 'print_state', width: 150 },
        { text: 'Filament / nozzle', value: 'filament_type', width: 150 },
        { text: 'Primed', value: 'primed', width: 100 },
        { text: 'Scheduler', value: 'reason' },
        { text: 'Active run', value: 'active_run', sortable: false },
    ]

    get workers(): FleetWorker[] {
        return this.$store.getters['fleet/workers/getWorkers']
    }

    get loading(): boolean {
        return this.$store.getters['fleet/workers/isLoading']
    }

    get scheduler(): FleetSchedulerStatus | null {
        return this.$store.getters['fleet/workers/getSchedulerStatus']
    }

    get enabledHostnames(): string[] {
        return enabledWorkerHostnames(this.workers)
    }

    /** See fleetWorkerAttention.ts (shared with the Fleet Map page). */
    needsAttention(w: FleetWorker): boolean {
        return workerNeedsAttention(w)
    }

    get attentionHostnames(): string[] {
        return attentionWorkerHostnames(this.workers)
    }

    /** hostname -> scheduler reason, for the map tooltip. */
    get attentionReasons(): Record<string, string> {
        return attentionWorkerReasons(this.workers)
    }

    get enabledCount(): number {
        return this.enabledHostnames.length
    }

    // Status color/label vocabulary (matches Farm.vue + FarmMapSection)
    readonly STATUS_META: Record<PrinterStatus, { color: string; label: string }> = {
        printing: { color: '#2196f3', label: 'Printing' },
        ready: { color: 'hsl(90, 100%, 32%)', label: 'Ready' },
        complete: { color: '#1976d2', label: 'Complete' },
        error: { color: '#d32f2f', label: 'Error' },
        disconnected: { color: '#8a8a8a', label: 'Offline' },
    }
    readonly STATUS_ORDER: PrinterStatus[] = ['printing', 'ready', 'complete', 'error', 'disconnected']

    get fleetDaemonPrinters(): Record<string, any> {
        return this.$store.state.farm.fleetDaemonPrinters || {}
    }

    /** Every printer the daemon knows about, across both floors. */
    get totalPrinterCount(): number {
        return Object.keys(this.fleetDaemonPrinters).length
    }

    /** Daemon printers currently enabled as workers (sums the per-floor "Workers" counts). */
    get totalWorkerCount(): number {
        const enabled = new Set(this.enabledHostnames.map((h) => h.toLowerCase()))
        return Object.keys(this.fleetDaemonPrinters).filter((h) => enabled.has(h.toLowerCase())).length
    }

    get totalStatusList() {
        const counts: Record<PrinterStatus, number> = { printing: 0, ready: 0, complete: 0, error: 0, disconnected: 0 }
        Object.values(this.fleetDaemonPrinters).forEach((printer: any) => {
            counts[getPrinterStatus(printer, this.$store.state.farm.fleetDaemonConnected)]++
        })
        return this.STATUS_ORDER.map((k) => ({ key: k, label: this.STATUS_META[k].label, color: this.STATUS_META[k].color, count: counts[k] }))
    }

    get workersSorted(): FleetWorker[] {
        return [...this.workers].sort((a, b) => a.printer_hostname.localeCompare(b.printer_hostname))
    }

    shortName(hostname: string): string {
        return hostname.replace(/\.local$/i, '')
    }

    /** Map click: flip the worker flag of that printer. */
    async toggleByHostname(hostname: string) {
        const h = hostname.toLowerCase()
        const w = this.workers.find((x) => x.printer_hostname.toLowerCase() === h)
        if (w) {
            await this.toggle(w, !w.enabled)
            return
        }
        // Printer known to the map but not yet in the workers snapshot: enable it.
        this.toggling = h
        try {
            await this.$store.dispatch('fleet/workers/setWorkerEnabled', { hostname: h, enabled: true })
            await this.$store.dispatch('fleet/workers/loadWorkers')
        } catch (e: any) {
            this.error = e?.message ?? String(e)
        } finally {
            this.toggling = null
        }
    }

    /** Live state from the daemon WebSocket when available, else the /workers snapshot. */
    livePrinter(w: FleetWorker): any | null {
        return this.$store.state.farm.fleetDaemonPrinters?.[w.printer_hostname] ?? null
    }

    // The columns below prefer the 1 Hz WebSocket stream (updates within a
    // second of the printer changing) and fall back to the REST snapshot.
    livePrimed(w: FleetWorker): boolean | null {
        const ms = this.livePrinter(w)?.machine_state
        if (ms && ms.is_primed != null) return ms.is_primed === 1
        return w.primed
    }

    liveFilename(w: FleetWorker): string | null {
        const live = this.livePrinter(w)
        return live?.print_stats?.filename ?? w.filename ?? null
    }

    liveFilament(w: FleetWorker): string | null {
        const live = this.livePrinter(w)
        return live?.toolhead?.filament_type ?? w.filament_type ?? null
    }

    liveNozzle(w: FleetWorker): string | null {
        const live = this.livePrinter(w)
        const v = live?.toolhead?.nozzle_size ?? w.nozzle_size
        return v != null && String(v) !== '' ? String(v) : null
    }

    liveRemaining(w: FleetWorker): number | null {
        const live = this.livePrinter(w)
        const v = live?.toolhead?.remaining_weight
        return v != null ? Number(v) : w.remaining_weight
    }

    statusText(w: FleetWorker): string {
        const live = this.livePrinter(w)
        if (live) return getPrinterStatus(live, this.$store.state.farm.fleetDaemonConnected)
        if (!w.connected) return 'disconnected'
        if (w.klippy_state && w.klippy_state !== 'ready') return w.klippy_state
        return w.print_state === 'standby' ? 'ready' : w.print_state || 'unknown'
    }

    statusColor(w: FleetWorker): string {
        return (
            { printing: 'blue', ready: 'green', complete: 'indigo', error: 'red', disconnected: 'grey' }[this.statusText(w)] ??
            'grey'
        )
    }

    relative(ts: string | number | null): string {
        if (!ts) return ''
        const ms = typeof ts === 'number' ? ts * 1000 : new Date(ts).getTime()
        const s = Math.max(0, Math.round((Date.now() - ms) / 1000))
        return s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`
    }

    async toggle(w: FleetWorker, enabled: boolean) {
        this.toggling = w.printer_hostname
        this.error = ''
        try {
            await this.$store.dispatch('fleet/workers/setWorkerEnabled', { hostname: w.printer_hostname, enabled })
            this.justDisabled = !enabled && w.active_run ? w.printer_hostname : null
        } catch (e: any) {
            this.error = e?.message ?? String(e)
        } finally {
            this.toggling = null
        }
    }

    async confirmDisableAll() {
        this.error = ''
        this.bulkBusy = true
        try {
            await this.$store.dispatch('fleet/workers/bulkSetEnabled', {
                hostnames: this.workers.filter((w) => w.in_printer_list).map((w) => w.printer_hostname),
                enabled: false,
            })
            this.disableAllDialog = false
        } catch (e: any) {
            this.error = e?.message ?? String(e)
        } finally {
            this.bulkBusy = false
        }
    }

    async tick() {
        this.ticking = true
        try {
            await this.$store.dispatch('fleet/workers/triggerTick')
            setTimeout(() => {
                this.$store.dispatch('fleet/workers/loadWorkers').catch(() => {})
                this.$store.dispatch('fleet/workers/loadSchedulerStatus').catch(() => {})
            }, 1000)
        } catch (e: any) {
            this.error = e?.message ?? String(e)
        } finally {
            this.ticking = false
        }
    }

    openJob(id: number) {
        this.$router.push({ path: '/jobs', query: { openJob: String(id) } }).catch(() => {})
    }
}
</script>

<style scoped>
.worker-map-layout {
    display: flex;
    align-items: flex-start;
}
.worker-map-layout--stacked {
    flex-direction: column;
}
.worker-map-layout--resizing {
    cursor: col-resize;
}
.worker-map-layout--resizing .worker-map-main {
    /* keep the map from swallowing pointer events mid-drag */
    pointer-events: none;
}
.worker-map-main {
    flex: 1 1 0;
    min-width: 0;
    /* Side by side: the maps scroll inside this column, not the page */
    align-self: stretch;
    overflow-y: auto;
    overflow-x: hidden;
}
.worker-map-layout--stacked .worker-map-main {
    width: 100%;
    align-self: auto;
    overflow: visible;
}
.worker-side-col {
    flex: 0 0 auto;
    min-width: 0;
    max-width: 100%;
    /* Side by side: the list scrolls inside this column, independent of the map */
    align-self: stretch;
    min-height: 0;
    display: flex;
    flex-direction: column;
}
.worker-side-col > .worker-side-list {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
}
.worker-side-list >>> .v-data-table__wrapper {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
}
.worker-map-layout--stacked .worker-side-col {
    align-self: auto;
    display: block;
}
.worker-map-layout--stacked .worker-side-col > .worker-side-list {
    display: block;
}
.worker-map-layout--stacked .worker-side-list >>> .v-data-table__wrapper {
    overflow-y: visible;
}
.worker-side-resizer {
    flex: 0 0 10px;
    align-self: stretch;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: col-resize;
    touch-action: none;
    user-select: none;
}
.worker-side-resizer__grip {
    width: 2px;
    height: 100%;
    min-height: 120px;
    border-radius: 1px;
    background: rgba(128, 128, 128, 0.35);
    transition: background 0.15s;
}
.worker-side-resizer:hover .worker-side-resizer__grip,
.worker-map-layout--resizing .worker-side-resizer__grip {
    background: var(--v-primary-base, #2196f3);
}
.worker-side-list >>> td {
    vertical-align: middle;
}
.worker-side-list >>> tr.row-hover td {
    background: rgba(255, 235, 59, 0.12);
}
.job-link {
    cursor: pointer;
    text-decoration: underline;
}

/* Total fleet status (mirrors Farm.vue header + FarmMapSection legend) */
.fleet-title-row {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
}
.fleet-title {
    font-size: 14px;
    font-weight: 700;
}
.fleet-total {
    font-size: 13px;
    opacity: 0.75;
    font-weight: 600;
    padding-left: 14px;
    border-left: 1px solid rgba(128, 128, 128, 0.4);
}
.status-counters {
    display: flex;
    gap: 15px;
    flex-wrap: wrap;
    align-items: center;
}
.status-counter {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    font-weight: 500;
}
.status-counter--total {
    font-weight: 700;
    padding-right: 12px;
    border-right: 1px solid rgba(128, 128, 128, 0.4);
}
.status-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    display: inline-block;
}
.status-dot.square {
    border-radius: 2px;
}
</style>
