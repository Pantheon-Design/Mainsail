<template>
    <v-card flat>
        <v-card-title class="d-flex align-center">
            <span>Print Jobs</span>
            <v-spacer />
            <v-btn small color="primary" :loading="collecting" @click="collectNow" class="mr-2">
                Collect Now
            </v-btn>
            <v-btn small :color="devMode ? 'orange' : 'grey'" :outlined="!devMode" @click="toggleDevMode" class="mr-2" title="Toggle dev mode">
                <v-icon small left>{{ mdiBug }}</v-icon>
                Dev
            </v-btn>
            <v-menu offset-y :close-on-content-click="false" left>
                <template #activator="{ on, attrs }">
                    <v-btn small icon v-bind="attrs" v-on="on" title="Toggle columns">
                        <v-icon small>{{ mdiCog }}</v-icon>
                    </v-btn>
                </template>
                <v-card class="pa-2" style="max-height: 400px; overflow-y: auto">
                    <v-card-subtitle class="pa-1 caption font-weight-bold">Visible Columns</v-card-subtitle>
                    <v-checkbox
                        v-for="col in allHeaders"
                        :key="col.value"
                        :label="col.text"
                        :input-value="visibleColumns.includes(col.value)"
                        dense
                        hide-details
                        class="mt-0 ml-1"
                        @change="toggleColumn(col.value)"
                    />
                </v-card>
            </v-menu>
        </v-card-title>

        <!-- Filters -->
        <v-card-text class="py-1">
            <v-row dense>
                <v-col cols="12" sm="3">
                    <v-combobox
                        v-model="filterPrinter"
                        :items="printerOptions"
                        label="Printer"
                        clearable
                        dense
                        outlined
                        hide-details
                        :search-input.sync="printerSearch"
                        @change="applyFilters"
                    />
                </v-col>
                <v-col cols="12" sm="3">
                    <v-select
                        v-model="filterStatus"
                        :items="statusOptions"
                        label="Status"
                        clearable
                        dense
                        outlined
                        hide-details
                        @change="applyFilters"
                    />
                </v-col>
                <v-col cols="12" sm="3">
                    <v-text-field
                        v-model="filterFilename"
                        label="Filename search"
                        dense
                        outlined
                        clearable
                        hide-details
                        @input="applyFiltersDebounced"
                    />
                </v-col>
                <v-col cols="12" sm="3">
                    <v-select
                        v-model="filterModel"
                        :items="modelOptions"
                        label="Printer Model"
                        clearable
                        dense
                        outlined
                        hide-details
                        @change="applyFilters"
                    />
                </v-col>
            </v-row>
        </v-card-text>

        <!-- Table -->
        <v-data-table
            ref="historyTable"
            :headers="headers"
            :items="filteredRecords"
            :loading="isLoading"
            :items-per-page="50"
            :footer-props="{ 'items-per-page-options': [25, 50, 100, 200] }"
            sort-by="start_time"
            :sort-desc="true"
            dense
            class="fleet-history-table resizable-table"
            @click:row="openDetail"
        >
            <!-- Printer model -->
            <template #item.printer_model="{ item }">
                {{ item.printer_model || '—' }}
            </template>

            <!-- Status chip -->
            <template #item.status="{ item }">
                <v-chip x-small :color="statusColor(item.status)" dark>{{ item.status || 'unknown' }}</v-chip>
            </template>

            <!-- Duration formatted -->
            <template #item.print_duration_secs="{ item }">
                {{ formatDuration(item.print_duration_secs) }}
            </template>

            <!-- Filament mm → g -->
            <template #item.filament_used_mm="{ item }">
                {{ formatFilament(item.filament_used_mm) }}
            </template>

            <!-- Filament remaining weight -->
            <template #item.filament_remaining_weight="{ item }">
                {{ item.filament_remaining_weight != null ? `${item.filament_remaining_weight.toFixed(1)} g` : '—' }}
            </template>

            <!-- Spool QR code -->
            <template #item.spool_qr_code="{ item }">
                {{ item.spool_qr_code || '—' }}
            </template>

            <!-- Printer nozzle type -->
            <template #item.printer_nozzle_type="{ item }">
                {{ item.printer_nozzle_type || '—' }}
            </template>

            <!-- Nozzle health as percent bar -->
            <template #item.nozzle_health="{ item }">
                <v-tooltip bottom v-if="item.nozzle_life != null && item.printer_nozzle_start_health != null && item.nozzle_life > 0">
                    <template #activator="{ on, attrs }">
                        <div v-bind="attrs" v-on="on" style="min-width: 80px">
                            <v-progress-linear
                                :value="nozzleHealthPct(item)"
                                :color="nozzleHealthColor(item)"
                                height="16"
                                rounded
                                class="nozzle-bar"
                            >
                                <span class="white--text caption">{{ nozzleHealthPct(item) }}%</span>
                            </v-progress-linear>
                        </div>
                    </template>
                    <span>
                        Remaining: {{ item.printer_nozzle_start_health.toFixed(3) }} kg<br>
                        Total life: {{ item.nozzle_life.toFixed(3) }} kg<br>
                        Used: {{ (item.nozzle_life - item.printer_nozzle_start_health).toFixed(3) }} kg
                    </span>
                </v-tooltip>
                <span v-else>—</span>
            </template>

            <!-- Start time -->
            <template #item.start_time="{ item }">
                {{ formatDate(item.start_time) }}
            </template>

            <!-- Parts count -->
            <template #item.parts_count="{ item }">
                {{ partCount(item) }}
            </template>

            <!-- Add Part (dev mode) -->
            <template #item.actions="{ item }">
                <v-btn x-small color="primary" outlined @click.stop="openAddPart(item)" title="Add part with QR code">
                    <v-icon x-small left>{{ mdiPlus }}</v-icon>
                    Add Part
                </v-btn>
            </template>
        </v-data-table>

        <!-- Load More -->
        <div v-if="hasMore" class="text-center py-2">
            <v-btn small outlined color="primary" :loading="loadingMore" @click="loadMore">
                Load More ({{ records.length }} / {{ totalRecords }})
            </v-btn>
        </div>

        <!-- Snackbar -->
        <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="3000" bottom>
            {{ snackbarText }}
        </v-snackbar>

        <!-- Job Detail Dialog -->
        <v-dialog v-model="detailDialog" max-width="700">
            <v-card v-if="detailJob">
                <v-card-title class="d-flex align-center">
                    Job Detail
                    <v-spacer />
                    <v-btn icon small @click="detailDialog = false">
                        <v-icon small>{{ mdiClose }}</v-icon>
                    </v-btn>
                </v-card-title>
                <v-divider />
                <v-card-text class="pt-3">
                    <!-- Job info -->
                    <span class="text-subtitle-2 font-weight-bold">Job</span>
                    <v-simple-table dense class="mb-4">
                        <tbody>
                            <tr><td class="font-weight-bold" width="160">Printer</td><td>{{ detailJob.printer_hostname }}</td></tr>
                            <tr><td class="font-weight-bold">Model</td><td>{{ detailJob.printer_model || '—' }}</td></tr>
                            <tr><td class="font-weight-bold">Filename</td><td>{{ detailJob.filename || '—' }}</td></tr>
                            <tr><td class="font-weight-bold">Filament</td><td>{{ detailJob.filament_type || '—' }}</td></tr>
                            <tr><td class="font-weight-bold">Status</td><td>
                                <v-chip x-small :color="statusColor(detailJob.status)" dark>{{ detailJob.status || 'unknown' }}</v-chip>
                            </td></tr>
                            <tr><td class="font-weight-bold">Start</td><td>{{ formatDate(detailJob.start_time) }}</td></tr>
                            <tr><td class="font-weight-bold">Duration</td><td>{{ formatDuration(detailJob.print_duration_secs) }}</td></tr>
                            <tr><td class="font-weight-bold">Filament Used</td><td>{{ formatFilament(detailJob.filament_used_mm) }}</td></tr>
                            <tr><td class="font-weight-bold">Spool QR</td><td>{{ detailJob.spool_qr_code || '—' }}</td></tr>
                        </tbody>
                    </v-simple-table>

                    <!-- Spool info (if spool_qr_code is linked) -->
                    <div v-if="detailSpool" class="mb-4">
                        <span class="text-subtitle-2 font-weight-bold">Spool</span>
                        <v-simple-table dense>
                            <tbody>
                                <tr><td class="font-weight-bold" width="160">Spool ID</td><td>#{{ detailSpool.id }}</td></tr>
                                <tr><td class="font-weight-bold">Vendor</td><td>{{ (detailSpool.filament && detailSpool.filament.vendor && detailSpool.filament.vendor.name) || '—' }}</td></tr>
                                <tr><td class="font-weight-bold">Filament</td><td>{{ (detailSpool.filament && detailSpool.filament.name) || '—' }}</td></tr>
                                <tr><td class="font-weight-bold">Material</td><td>{{ (detailSpool.filament && detailSpool.filament.material) || '—' }}</td></tr>
                                <tr v-if="detailSpool.filament && detailSpool.filament.color_hex"><td class="font-weight-bold">Color</td><td>
                                    <div :style="{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#' + detailSpool.filament.color_hex, border: '1px solid rgba(255,255,255,0.3)', display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }" />
                                    #{{ detailSpool.filament.color_hex }}
                                </td></tr>
                                <tr><td class="font-weight-bold">Initial Weight</td><td>{{ detailSpool.initial_weight != null ? detailSpool.initial_weight.toFixed(0) + ' g' : '—' }}</td></tr>
                                <tr><td class="font-weight-bold">Remaining</td><td>{{ detailSpool.remaining_weight != null ? detailSpool.remaining_weight.toFixed(0) + ' g' : '—' }}</td></tr>
                                <tr><td class="font-weight-bold">Loaded On</td><td>
                                    <v-chip v-if="detailSpool.loaded_on_printer" x-small color="success" dark>{{ detailSpool.loaded_on_printer }}</v-chip>
                                    <span v-else>Not loaded</span>
                                </td></tr>
                                <tr><td class="font-weight-bold">Location</td><td>{{ detailSpool.location || '—' }}</td></tr>
                            </tbody>
                        </v-simple-table>
                    </div>

                    <!-- Parts list -->
                    <div class="d-flex align-center mb-1">
                        <span class="text-subtitle-2 font-weight-bold">Parts ({{ detailParts.length }})</span>
                    </div>
                    <v-progress-linear v-if="detailPartsLoading" indeterminate color="primary" class="mb-2" />
                    <v-simple-table v-else-if="detailParts.length" dense>
                        <thead>
                            <tr>
                                <th>QR Code</th>
                                <th>QC Status</th>
                                <th>QC Inspector</th>
                                <th>QC Date</th>
                                <th>QC Note</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="part in detailParts" :key="part.id">
                                <td>{{ part.qr_code }}</td>
                                <td>
                                    <v-chip v-if="part.qc_status" x-small :color="part.qc_status === 'pass' ? 'success' : part.qc_status === 'fail' ? 'error' : 'warning'" dark>
                                        {{ part.qc_status }}
                                    </v-chip>
                                    <span v-else>—</span>
                                </td>
                                <td>{{ part.qc_inspector || '—' }}</td>
                                <td>{{ part.qc_date ? new Date(part.qc_date).toLocaleString() : '—' }}</td>
                                <td>{{ part.qc_note || '—' }}</td>
                            </tr>
                        </tbody>
                    </v-simple-table>
                    <p v-else class="caption grey--text">No parts linked to this job.</p>
                </v-card-text>
            </v-card>
        </v-dialog>

        <!-- Add Part Dialog -->
        <v-dialog v-model="addPartDialog" max-width="420" persistent>
            <v-card>
                <v-card-title>Add Part</v-card-title>
                <v-card-text>
                    <p class="caption mb-2">
                        Printer: <strong>{{ addPartJob?.printer_hostname }}</strong><br>
                        File: <strong>{{ addPartJob?.filename || '—' }}</strong>
                    </p>
                    <v-text-field
                        v-model="addPartQrCode"
                        label="QR Code"
                        dense
                        outlined
                        hide-details
                        autofocus
                        @keydown.enter="submitAddPart"
                    />
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn text @click="addPartDialog = false">Cancel</v-btn>
                    <v-btn color="primary" :loading="addPartLoading" :disabled="!addPartQrCode.trim()" @click="submitAddPart">Add</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-card>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import { FleetHistoryRecord } from '@/store/fleet/history/types'
import { mdiCog, mdiBug, mdiPlus, mdiClose } from '@mdi/js'
import axios from 'axios'
import { fleetDaemonEvents } from '@/plugins/fleetDaemonClient'

@Component
export default class FleetHistoryListPanel extends Vue {
    mdiCog = mdiCog
    mdiBug = mdiBug
    mdiPlus = mdiPlus
    mdiClose = mdiClose

    filterPrinter = ''
    printerSearch = ''
    filterStatus = ''
    filterFilename = ''
    filterModel = ''
    collecting = false
    snackbar = false
    snackbarText = ''
    snackbarColor = 'success'
    debounceTimer: ReturnType<typeof setTimeout> | null = null

    // Job Detail dialog
    detailDialog = false
    detailJob: FleetHistoryRecord | null = null
    detailParts: FleetHistoryRecord[] = []
    detailPartsLoading = false
    detailSpool: any = null

    // Add Part dialog
    addPartDialog = false
    addPartJob: FleetHistoryRecord | null = null
    addPartQrCode = ''
    addPartLoading = false

    readonly STORAGE_KEY = 'fleet_history_visible_columns'
    readonly WIDTHS_KEY = 'fleet_history_column_widths'
    readonly HIDE_THRESHOLD = 36

    columnWidths: Record<string, number> = {}
    resizingCol = ''
    resizeStartX = 0
    resizeStartW = 0

    private _onMouseMove: ((e: MouseEvent) => void) | null = null
    private _onMouseUp: ((e: MouseEvent) => void) | null = null

    readonly baseHeaders = [
        { text: 'Printer', value: 'printer_hostname', sortable: true },
        { text: 'Model', value: 'printer_model', sortable: true },
        { text: 'Filename', value: 'filename', sortable: true },
        { text: 'Filament', value: 'filament_type', sortable: true },
        { text: 'Status', value: 'status', sortable: true },
        { text: 'Start', value: 'start_time', sortable: true },
        { text: 'Duration', value: 'print_duration_secs', sortable: true },
        { text: 'Filament Used', value: 'filament_used_mm', sortable: true },
        { text: 'Remaining Wt', value: 'filament_remaining_weight', sortable: true },
        { text: 'Spool QR', value: 'spool_qr_code', sortable: true },
        { text: 'Nozzle Type', value: 'printer_nozzle_type', sortable: true },
        { text: 'Nozzle Health', value: 'nozzle_health', sortable: false },
        { text: 'Parts', value: 'parts_count', sortable: false },
    ]

    readonly devHeaders = [
        { text: 'Moonraker Job ID', value: 'moonraker_job_id', sortable: true },
        { text: '', value: 'actions', sortable: false },
    ]

    visibleColumns: string[] = []

    created() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY)
            if (saved) {
                const parsed = JSON.parse(saved) as string[]
                if (Array.isArray(parsed) && parsed.length > 0) {
                    this.visibleColumns = parsed
                }
            }
        } catch { /* ignore */ }
        if (!this.visibleColumns.length) {
            this.visibleColumns = ['printer_hostname', 'filename', 'filament_type', 'status', 'start_time', 'nozzle_health', 'parts_count']
        }
        try {
            const w = localStorage.getItem(this.WIDTHS_KEY)
            if (w) this.columnWidths = JSON.parse(w)
        } catch { /* ignore */ }
    }

    mounted() {
        this.$nextTick(() => this.attachResizeHandles())
        // Listen for history updates from the shared fleet daemon connection
        fleetDaemonEvents.$on('history_updated', this.onHistoryUpdated)
        // Initial load
        this.applyFilters()
    }

    updated() {
        this.$nextTick(() => this.attachResizeHandles())
    }

    beforeDestroy() {
        fleetDaemonEvents.$off('history_updated', this.onHistoryUpdated)
        this.cleanupResizeListeners()
    }

    get fleetDaemonUrl(): string {
        return this.$store.getters['gui/fleetDaemonUrl'] ?? 'http://pantheonfleet.local:8090'
    }

    onHistoryUpdated() {
        // Debounce WebSocket-triggered reloads to avoid duplicate fetches
        if (this.debounceTimer) clearTimeout(this.debounceTimer)
        this.debounceTimer = setTimeout(() => this.applyFilters(), 500)
    }

    get allHeaders() {
        return this.devMode ? [...this.baseHeaders, ...this.devHeaders] : this.baseHeaders
    }

    get devColumnValues(): string[] {
        return this.devHeaders.map((h) => h.value)
    }

    get headers() {
        return this.allHeaders
            .filter((h) => this.visibleColumns.includes(h.value) || this.devColumnValues.includes(h.value))
            .map((h) => {
                const w = this.columnWidths[h.value]
                return w ? { ...h, width: `${w}px` } : h
            })
    }

    toggleColumn(value: string) {
        const idx = this.visibleColumns.indexOf(value)
        if (idx >= 0) {
            if (this.visibleColumns.length <= 1) return
            this.visibleColumns.splice(idx, 1)
        } else {
            this.visibleColumns.push(value)
        }
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.visibleColumns))
    }

    readonly statusOptions = [
        'completed', 'cancelled', 'error', 'in_progress',
        'klippy_shutdown', 'klippy_disconnect', 'interrupted',
    ]

    get devMode(): boolean {
        return this.$store.getters['fleet/history/isDevMode']
    }

    toggleDevMode() {
        this.$store.commit('fleet/history/setDevMode', !this.devMode)
    }

    get records(): FleetHistoryRecord[] {
        return this.$store.getters['fleet/history/getRecords']
    }

    get isLoading(): boolean {
        return this.$store.getters['fleet/history/isLoading']
    }

    /** Only show base rows (jobs without a QR code — the collector-created rows) */
    get jobRecords(): FleetHistoryRecord[] {
        return this.records.filter((r) => r.qr_code === null || r.qr_code === undefined)
    }

    get printerOptions(): string[] {
        const hostnames = this.jobRecords.map((r) => r.printer_hostname).filter(Boolean)
        return [...new Set(hostnames)].sort()
    }

    get modelOptions(): string[] {
        const models = this.jobRecords.map((r) => r.printer_model).filter(Boolean) as string[]
        return [...new Set(models)].sort()
    }

    get filteredRecords(): FleetHistoryRecord[] {
        let data = this.jobRecords
        // Client-side partial printer name filter (while typing in combobox)
        const pSearch = (this.printerSearch || '').trim().toLowerCase()
        if (pSearch && pSearch !== (this.filterPrinter || '').toLowerCase()) {
            data = data.filter((r) => r.printer_hostname?.toLowerCase().includes(pSearch))
        }
        if (this.filterFilename) {
            const q = this.filterFilename.toLowerCase()
            data = data.filter((r) => r.filename?.toLowerCase().includes(q))
        }
        if (this.filterModel) {
            data = data.filter((r) => r.printer_model === this.filterModel)
        }
        return data
    }

    /** Count QR-linked parts for a given base row */
    partCount(item: FleetHistoryRecord): number {
        return this.records.filter(
            (r) => r.printer_hostname === item.printer_hostname
                && r.moonraker_job_id === item.moonraker_job_id
                && r.qr_code != null
        ).length
    }

    applyFilters() {
        this.$store.dispatch('fleet/history/loadHistory', {
            printer: this.filterPrinter || undefined,
            status: this.filterStatus || undefined,
            has_qr_code: false,
            limit: 200,
        })
    }

    loadingMore = false

    get totalRecords(): number {
        return this.$store.getters['fleet/history/getTotal']
    }

    get hasMore(): boolean {
        return this.records.length < this.totalRecords
    }

    async loadMore() {
        this.loadingMore = true
        try {
            await this.$store.dispatch('fleet/history/loadMoreHistory', {
                printer: this.filterPrinter || undefined,
                status: this.filterStatus || undefined,
                has_qr_code: false,
                limit: 200,
                offset: this.records.length,
            })
        } finally {
            this.loadingMore = false
        }
    }

    applyFiltersDebounced() {
        if (this.debounceTimer) clearTimeout(this.debounceTimer)
        this.debounceTimer = setTimeout(() => this.applyFilters(), 400)
    }

    async collectNow() {
        this.collecting = true
        try {
            await this.$store.dispatch('fleet/history/triggerCollect')
            this.showSnackbar('Collection triggered successfully', 'success')
            setTimeout(() => this.applyFilters(), 2000)
        } catch {
            this.showSnackbar('Collection failed', 'error')
        } finally {
            this.collecting = false
        }
    }

    showSnackbar(text: string, color: string) {
        this.snackbarText = text
        this.snackbarColor = color
        this.snackbar = true
    }

    // ---- Job Detail ----

    async openDetail(item: FleetHistoryRecord) {
        this.detailJob = item
        this.detailParts = []
        this.detailPartsLoading = true
        this.detailSpool = null
        this.detailDialog = true
        try {
            const [parts] = await Promise.all([
                this.$store.dispatch('fleet/history/fetchPartsForJob', {
                    printer_hostname: item.printer_hostname,
                    moonraker_job_id: item.moonraker_job_id,
                }),
                item.spool_qr_code
                    ? this.$store.dispatch('fleet/spools/lookupByQr', item.spool_qr_code)
                        .then((spool: any) => { this.detailSpool = spool })
                        .catch(() => { this.detailSpool = null })
                    : Promise.resolve(),
            ])
            this.detailParts = parts
        } catch {
            this.detailParts = []
        } finally {
            this.detailPartsLoading = false
        }
    }

    // ---- Add Part (dev mode) ----

    openAddPart(item: FleetHistoryRecord) {
        this.addPartJob = item
        this.addPartQrCode = ''
        this.addPartDialog = true
    }

    async submitAddPart() {
        if (!this.addPartJob || !this.addPartQrCode.trim()) return
        this.addPartLoading = true
        // Strip #1 or #0 prefix if present (from QC scanners)
        let qr = this.addPartQrCode.trim()
        if (qr.match(/^#[01]/) && qr.length > 2) qr = qr.slice(2)
        try {
            const baseUrl = this.$store.getters['gui/fleetDaemonUrl'] ?? 'http://pantheonfleet.local:8090'
            const response = await axios.post(`${baseUrl}/history/qr-link`, {
                printer_hostname: this.addPartJob.printer_hostname,
                moonraker_job_id: this.addPartJob.moonraker_job_id,
                qr_code: qr,
            })
            // Safely add to store if response looks valid
            if (response.data?.id) {
                this.$store.commit('fleet/history/addRecord', response.data)
            }
            this.showSnackbar(`Part added: ${qr}`, 'success')
            this.addPartDialog = false
        } catch (err: any) {
            // Backend may return 500 even though the part was created (e.g. WS broadcast error)
            if (err?.response?.data?.id) {
                this.$store.commit('fleet/history/addRecord', err.response.data)
                this.showSnackbar(`Part added: ${qr}`, 'success')
                this.addPartDialog = false
            } else if (err?.response?.status === 409) {
                this.showSnackbar('QR code already assigned to another record', 'error')
            } else if (err?.response?.status === 404) {
                this.showSnackbar('Base job record not found', 'error')
            } else {
                this.showSnackbar('Failed to add part', 'error')
            }
        } finally {
            this.addPartLoading = false
        }
    }

    // ---- Column resize ----

    attachResizeHandles() {
        const table = (this.$refs.historyTable as any)?.$el as HTMLElement | undefined
        if (!table) return
        const ths = table.querySelectorAll('thead th')
        ths.forEach((th, idx) => {
            const el = th as HTMLElement
            if (el.querySelector('.col-resize-handle')) return
            el.style.position = 'relative'
            const handle = document.createElement('div')
            handle.className = 'col-resize-handle'
            handle.addEventListener('mousedown', (e) => {
                const header = this.headers[idx]
                if (!header) return
                e.preventDefault()
                e.stopPropagation()
                this.resizingCol = header.value
                this.resizeStartX = e.clientX
                this.resizeStartW = el.offsetWidth
                this._onMouseMove = (ev: MouseEvent) => this.onResizeMove(ev, el)
                this._onMouseUp = (ev: MouseEvent) => this.onResizeEnd(ev, el)
                document.addEventListener('mousemove', this._onMouseMove)
                document.addEventListener('mouseup', this._onMouseUp)
                document.body.style.cursor = 'col-resize'
                document.body.style.userSelect = 'none'
            })
            el.appendChild(handle)
        })
    }

    onResizeMove(e: MouseEvent, th: HTMLElement) {
        const delta = e.clientX - this.resizeStartX
        const newW = Math.max(20, this.resizeStartW + delta)
        th.style.width = newW + 'px'
        th.style.minWidth = newW + 'px'
    }

    onResizeEnd(e: MouseEvent, th: HTMLElement) {
        this.cleanupResizeListeners()
        const delta = e.clientX - this.resizeStartX
        const newW = Math.max(20, this.resizeStartW + delta)

        // Block the click event that fires after mouseup to prevent sort toggle
        const blockClick = (ev: Event) => { ev.stopPropagation(); ev.preventDefault() }
        th.addEventListener('click', blockClick, { capture: true, once: true })

        if (newW < this.HIDE_THRESHOLD) {
            this.toggleColumn(this.resizingCol)
            delete this.columnWidths[this.resizingCol]
            localStorage.setItem(this.WIDTHS_KEY, JSON.stringify(this.columnWidths))
            const col = this.allHeaders.find((h) => h.value === this.resizingCol)
            if (col) this.showSnackbar(`"${col.text}" column hidden`, 'info')
        } else {
            this.$set(this.columnWidths, this.resizingCol, newW)
            localStorage.setItem(this.WIDTHS_KEY, JSON.stringify(this.columnWidths))
        }
        this.resizingCol = ''
    }

    cleanupResizeListeners() {
        if (this._onMouseMove) document.removeEventListener('mousemove', this._onMouseMove)
        if (this._onMouseUp) document.removeEventListener('mouseup', this._onMouseUp)
        this._onMouseMove = null
        this._onMouseUp = null
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
    }

    // ---- Helpers ----

    nozzleHealthPct(item: FleetHistoryRecord): number {
        if (!item.nozzle_life || item.printer_nozzle_start_health == null) return 0
        const pct = (item.printer_nozzle_start_health / item.nozzle_life) * 100
        return Math.round(Math.min(100, Math.max(0, pct)))
    }

    nozzleHealthColor(item: FleetHistoryRecord): string {
        const pct = this.nozzleHealthPct(item)
        if (pct > 60) return 'success'
        if (pct > 30) return 'warning'
        return 'error'
    }

    statusColor(status: string | null): string {
        switch (status) {
            case 'completed': return 'success'
            case 'cancelled': return 'grey'
            case 'in_progress': return 'blue'
            case 'error':
            case 'klippy_shutdown':
            case 'klippy_disconnect': return 'error'
            default: return 'grey darken-1'
        }
    }

    formatDuration(secs: number | null): string {
        if (!secs) return '—'
        const h = Math.floor(secs / 3600)
        const m = Math.floor((secs % 3600) / 60)
        return `${h}h ${m.toString().padStart(2, '0')}m`
    }

    formatFilament(mm: number | null): string {
        if (!mm) return '—'
        const grams = mm * Math.PI * (1.75 / 2) ** 2 * 1.1 / 1000
        return `${grams.toFixed(1)} g`
    }

    formatDate(iso: string | null): string {
        if (!iso) return '—'
        return new Date(iso).toLocaleString()
    }
}
</script>

<style scoped>
.nozzle-bar {
    cursor: default;
}
.fleet-history-table tbody tr {
    cursor: pointer;
}
</style>

<style>
.resizable-table table {
    table-layout: fixed;
}
@media (max-width: 600px) {
    .resizable-table table {
        table-layout: auto !important;
    }
    .resizable-table .col-resize-handle {
        display: none;
    }
    .v-data-table__mobile-row__cell {
        max-width: 60vw;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
}
.resizable-table thead th {
    position: relative !important;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    border-right: 1px solid rgba(255, 255, 255, 0.12) !important;
}
.resizable-table td {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    border-right: 1px solid rgba(255, 255, 255, 0.06) !important;
}
.resizable-table .col-resize-handle {
    position: absolute !important;
    right: -3px;
    top: 0;
    bottom: 0;
    width: 7px;
    cursor: col-resize !important;
    z-index: 10;
}
.resizable-table .col-resize-handle:hover,
.resizable-table .col-resize-handle:active {
    background: rgba(33, 150, 243, 0.5);
}
</style>
