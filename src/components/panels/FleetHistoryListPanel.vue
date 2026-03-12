<template>
    <v-card flat>
        <v-card-title class="d-flex align-center">
            <span>Print History</span>
            <v-spacer />
            <v-btn small color="primary" :loading="collecting" @click="collectNow" class="mr-2">
                Collect Now
            </v-btn>
            <v-btn small color="primary" outlined @click="enterQcMode" class="mr-2" title="QC Mode">
                <v-icon small left>{{ mdiQrcodeScan }}</v-icon>
                QC Mode
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
        <v-card-text class="pb-0">
            <v-row dense>
                <v-col cols="12" sm="3">
                    <v-select
                        v-model="filterPrinter"
                        :items="printerOptions"
                        label="Printer"
                        clearable
                        dense
                        outlined
                        hide-details
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
            <v-row dense class="mt-1">
                <v-col cols="12" sm="4">
                    <v-text-field
                        v-model="filterQrCode"
                        label="QR Code Search"
                        dense
                        outlined
                        clearable
                        hide-details
                        :prepend-inner-icon="mdiQrcodeScan"
                        @input="applyFiltersDebounced"
                        @keydown.enter="applyQrCodeFilter"
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

            <!-- QC status — inline dropdown -->
            <template #item.qc_status="{ item }">
                <v-select
                    :value="item.qc_status"
                    :items="qcOptions"
                    dense
                    hide-details
                    class="qc-select"
                    style="max-width: 110px"
                    @change="saveQC(item, $event)"
                />
            </template>

            <!-- QC Inspector -->
            <template #item.qc_inspector="{ item }">
                {{ item.qc_inspector || '—' }}
            </template>

            <!-- QC Date -->
            <template #item.qc_date="{ item }">
                {{ item.qc_date ? new Date(item.qc_date).toLocaleString() : '—' }}
            </template>

            <!-- QC note — click to edit -->
            <template #item.qc_note="{ item }">
                <div
                    v-if="editingNoteId !== item.id"
                    class="qc-note-cell"
                    style="min-width: 120px; cursor: pointer"
                    :title="item.qc_note || 'Click to add note'"
                    @click="startEditNote(item)"
                >
                    {{ item.qc_note || '—' }}
                </div>
                <v-text-field
                    v-else
                    v-model="editingNoteText"
                    dense
                    hide-details
                    autofocus
                    style="max-width: 200px"
                    placeholder="Enter note..."
                    @blur="saveNote(item)"
                    @keydown.enter="saveNote(item)"
                    @keydown.escape="cancelEditNote"
                />
            </template>

            <!-- QR code — click to edit (dev mode only) -->
            <template #item.qr_code="{ item }">
                <div
                    v-if="editingQrId !== item.id"
                    class="qr-code-cell"
                    :style="{ minWidth: '120px', cursor: devMode ? 'pointer' : 'default' }"
                    :title="devMode ? (item.qr_code || 'Click to add QR code') : (item.qr_code || '')"
                    @click="devMode && startEditQr(item)"
                >
                    {{ item.qr_code || '—' }}
                </div>
                <v-text-field
                    v-else
                    v-model="editingQrText"
                    dense
                    hide-details
                    autofocus
                    style="max-width: 200px"
                    placeholder="Scan or type QR..."
                    @blur="saveQr(item)"
                    @keydown.enter="saveQr(item)"
                    @keydown.escape="cancelEditQr"
                />
            </template>
        </v-data-table>

        <!-- Snackbar -->
        <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="3000" bottom>
            {{ snackbarText }}
        </v-snackbar>

        <!-- QC Mode Overlay -->
        <v-dialog v-model="qcMode" fullscreen persistent no-click-animation>
            <v-card class="qc-mode-card d-flex flex-column" :style="{ height: '100vh', backgroundColor: qcFlashVisible ? (qcFlashResult === 'pass' ? '#C8E6C9' : '#FFCDD2') : undefined, transition: 'background-color 0.3s ease' }">
                <!-- Header -->
                <v-card-title class="d-flex align-center py-2">
                    <v-icon left color="primary">{{ mdiQrcodeScan }}</v-icon>
                    <span>QC Mode</span>
                    <v-chip v-if="qcInspector" small class="ml-3" color="primary" outlined>
                        Inspector: {{ qcInspector }}
                    </v-chip>
                    <v-spacer />
                    <v-btn icon @click="exitQcMode">
                        <v-icon>{{ mdiClose }}</v-icon>
                    </v-btn>
                </v-card-title>
                <v-divider />

                <!-- Step 1: Inspector Selection -->
                <v-card-text v-if="qcStep === 'inspector'" class="d-flex flex-column align-center pt-12">
                    <v-icon size="64" color="primary" class="mb-4">{{ mdiAccountCheck }}</v-icon>
                    <h2 class="mb-4">Enter Inspector Name</h2>
                    <v-text-field
                        v-model="qcInspector"
                        label="Inspector Name"
                        dense
                        outlined
                        style="max-width: 400px; width: 100%"
                        hide-details
                        autofocus
                        @keydown.enter="confirmInspector"
                    />
                    <!-- Quick select from existing inspectors -->
                    <div v-if="qcInspectorList.length" class="d-flex flex-wrap mt-2" style="max-width: 400px; gap: 8px">
                        <v-chip
                            v-for="name in qcInspectorList"
                            :key="name"
                            small
                            outlined
                            :color="qcInspector === name ? 'primary' : ''"
                            @click="qcInspector = name"
                            style="cursor: pointer"
                        >
                            {{ name }}
                        </v-chip>
                    </div>
                    <v-btn color="primary" class="mt-4" :disabled="!qcInspector" @click="confirmInspector">
                        Start QC
                    </v-btn>
                </v-card-text>

                <!-- Step 2: Scanning -->
                <v-card-text v-else-if="qcStep === 'scanning'" class="d-flex flex-column flex-grow-1 pa-4">
                    <!-- Hidden input that captures scanner input -->
                    <input
                        ref="qcScanInput"
                        v-model="qcScanBuffer"
                        class="qc-hidden-input"
                        @keydown.enter="processScan"
                        autofocus
                        @blur="refocusScanInput"
                    />

                    <!-- Status banner -->
                    <v-alert
                        v-if="qcStatusMessage"
                        :type="qcStatusType"
                        dense
                        class="mb-4"
                        dismissible
                        @input="qcStatusMessage = ''"
                    >
                        {{ qcStatusMessage }}
                    </v-alert>

                    <v-row>
                        <!-- Left: Selected job info -->
                        <v-col cols="12" md="7">
                            <v-card outlined>
                                <v-card-title class="subtitle-2 py-2">
                                    {{ qcSelectedRecord ? 'Job Found' : 'Waiting for QR scan...' }}
                                </v-card-title>
                                <v-divider />
                                <v-card-text v-if="qcSelectedRecord" class="pt-3">
                                    <v-simple-table dense>
                                        <tbody>
                                            <tr><td class="font-weight-bold" width="150">QR Code</td><td>{{ qcSelectedRecord.qr_code }}</td></tr>
                                            <tr><td class="font-weight-bold">Printer</td><td>{{ qcSelectedRecord.printer_hostname }}</td></tr>
                                            <tr><td class="font-weight-bold">Model</td><td>{{ qcSelectedRecord.printer_model || '—' }}</td></tr>
                                            <tr><td class="font-weight-bold">Filename</td><td>{{ qcSelectedRecord.filename || '—' }}</td></tr>
                                            <tr><td class="font-weight-bold">Filament</td><td>{{ qcSelectedRecord.filament_type || '—' }}</td></tr>
                                            <tr><td class="font-weight-bold">Status</td><td>
                                                <v-chip x-small :color="statusColor(qcSelectedRecord.status)" dark>{{ qcSelectedRecord.status || 'unknown' }}</v-chip>
                                            </td></tr>
                                            <tr><td class="font-weight-bold">Start Time</td><td>{{ formatDate(qcSelectedRecord.start_time) }}</td></tr>
                                            <tr><td class="font-weight-bold">Duration</td><td>{{ formatDuration(qcSelectedRecord.print_duration_secs) }}</td></tr>
                                            <tr><td class="font-weight-bold">QC Status</td><td>
                                                <v-chip v-if="qcSelectedRecord.qc_status" x-small :color="qcSelectedRecord.qc_status === 'pass' ? 'success' : qcSelectedRecord.qc_status === 'fail' ? 'error' : 'warning'" dark>
                                                    {{ qcSelectedRecord.qc_status }}
                                                </v-chip>
                                                <span v-else>Pending</span>
                                            </td></tr>
                                            <tr><td class="font-weight-bold">QC Inspector</td><td>{{ qcSelectedRecord.qc_inspector || '—' }}</td></tr>
                                            <tr><td class="font-weight-bold">QC Date</td><td>{{ qcSelectedRecord.qc_date ? new Date(qcSelectedRecord.qc_date).toLocaleString() : '—' }}</td></tr>
                                            <tr><td class="font-weight-bold">QC Note</td><td>{{ qcSelectedRecord.qc_note || '—' }}</td></tr>
                                        </tbody>
                                    </v-simple-table>
                                </v-card-text>
                                <v-card-text v-else class="d-flex flex-column align-center justify-center" style="min-height: 300px">
                                    <v-icon size="80" color="grey lighten-1">{{ mdiQrcodeScan }}</v-icon>
                                    <p class="text-h6 grey--text mt-4">Scan a part QR code to begin</p>
                                </v-card-text>
                            </v-card>
                        </v-col>

                        <!-- Right: Pass/Fail actions -->
                        <v-col cols="12" md="5">
                            <v-card outlined class="d-flex flex-column align-center justify-center pa-4">
                                <p class="subtitle-2 mb-4">{{ qcSelectedRecord ? 'Scan or click to set QC result' : 'Select a job first' }}</p>

                                <v-row class="mb-6" justify="space-between" style="max-width: 600px">
                                    <v-col cols="5" class="d-flex flex-column align-center">
                                        <v-card
                                            outlined
                                            class="pa-4 d-flex flex-column align-center qc-action-card"
                                            :class="{ 'qc-action-disabled': !qcSelectedRecord }"
                                            @click="qcSelectedRecord && submitQcResult('pass')"
                                            style="cursor: pointer; width: 100%"
                                        >
                                            <img src="/img/icons/qr_code_1.png" alt="PASS" style="width: 120px; height: 120px" />
                                            <v-chip small color="success" dark class="mt-2">PASS</v-chip>
                                        </v-card>
                                    </v-col>
                                    <v-col cols="5" class="d-flex flex-column align-center">
                                        <v-card
                                            outlined
                                            class="pa-4 d-flex flex-column align-center qc-action-card"
                                            :class="{ 'qc-action-disabled': !qcSelectedRecord }"
                                            @click="qcSelectedRecord && submitQcResult('fail')"
                                            style="cursor: pointer; width: 100%"
                                        >
                                            <img src="/img/icons/qr_code_0.png" alt="FAIL" style="width: 120px; height: 120px" />
                                            <v-chip small color="error" dark class="mt-2">FAIL</v-chip>
                                        </v-card>
                                    </v-col>
                                </v-row>

                                <p class="caption grey--text text-center">
                                    Scan <strong>1</strong> for PASS or <strong>0</strong> for FAIL<br/>
                                    Or click the buttons above
                                </p>

                                <!-- Note input after QC result submitted -->
                                <v-expand-transition>
                                    <div v-if="qcNoteVisible" style="width: 100%; max-width: 360px" class="mt-4">
                                        <v-divider class="mb-3" />
                                        <v-text-field
                                            v-model="qcNoteText"
                                            label="QC Note (optional)"
                                            dense
                                            outlined
                                            hide-details
                                            placeholder="Add a note for this inspection..."
                                            @keydown.enter="saveQcNote"
                                        />
                                        <v-btn small color="primary" class="mt-2" @click="saveQcNote" :disabled="!qcNoteText.trim()">
                                            Save Note
                                        </v-btn>
                                    </div>
                                </v-expand-transition>
                            </v-card>
                        </v-col>
                    </v-row>
                </v-card-text>
            </v-card>
        </v-dialog>
    </v-card>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import { FleetHistoryRecord } from '@/store/fleet/history/types'
import { mdiCog, mdiQrcodeScan, mdiBug, mdiClose, mdiAccountCheck } from '@mdi/js'

@Component
export default class FleetHistoryListPanel extends Vue {
    mdiCog = mdiCog
    mdiQrcodeScan = mdiQrcodeScan
    mdiBug = mdiBug
    mdiClose = mdiClose
    mdiAccountCheck = mdiAccountCheck
    // QC Mode state
    qcMode = false
    qcStep: 'inspector' | 'scanning' = 'inspector'
    qcInspector = ''
    qcInspectorList: string[] = []
    qcInspectorsLoading = false
    qcScanBuffer = ''
    qcSelectedRecord: FleetHistoryRecord | null = null
    qcStatusMessage = ''
    qcStatusType: 'success' | 'error' | 'info' | 'warning' = 'info'
    qcFlashVisible = false
    qcFlashResult: 'pass' | 'fail' = 'pass'
    qcFlashTimer: ReturnType<typeof setTimeout> | null = null
    qcNoteVisible = false
    qcNoteText = ''
    filterPrinter = ''
    filterStatus = ''
    filterFilename = ''
    filterModel = ''
    filterQrCode = ''
    appliedQrCode = ''
    collecting = false
    editingNoteId: string | null = null
    editingNoteText = ''
    editingQrId: string | null = null
    editingQrText = ''
    snackbar = false
    snackbarText = ''
    snackbarColor = 'success'
    debounceTimer: ReturnType<typeof setTimeout> | null = null

    readonly STORAGE_KEY = 'fleet_history_visible_columns'
    readonly WIDTHS_KEY = 'fleet_history_column_widths'
    readonly HIDE_THRESHOLD = 36

    columnWidths: Record<string, number> = {}
    resizingCol = ''
    resizeStartX = 0
    resizeStartW = 0

    // bound handlers for cleanup
    private _onMouseMove: ((e: MouseEvent) => void) | null = null
    private _onMouseUp: ((e: MouseEvent) => void) | null = null

    // WebSocket for live history updates
    private fleetHistoryWs: WebSocket | null = null
    private wsReconnectTimer: ReturnType<typeof setTimeout> | null = null

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
        { text: 'Nozzle Type', value: 'printer_nozzle_type', sortable: true },
        { text: 'Nozzle Health', value: 'nozzle_health', sortable: false },
        { text: 'QC', value: 'qc_status', sortable: false },
        { text: 'QC Inspector', value: 'qc_inspector', sortable: true },
        { text: 'QC Date', value: 'qc_date', sortable: true },
        { text: 'QC Note', value: 'qc_note', sortable: false },
        { text: 'QR Code', value: 'qr_code', sortable: true },
    ]

    readonly devHeaders = [
        { text: 'Moonraker Job ID', value: 'moonraker_job_id', sortable: true },
    ]

    get allHeaders() {
        return this.devMode ? [...this.baseHeaders, ...this.devHeaders] : this.baseHeaders
    }

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
            this.visibleColumns = this.allHeaders.map((h) => h.value)
        }
        try {
            const w = localStorage.getItem(this.WIDTHS_KEY)
            if (w) this.columnWidths = JSON.parse(w)
        } catch { /* ignore */ }
    }

    mounted() {
        this.$nextTick(() => this.attachResizeHandles())
        this.connectFleetWs()
    }

    updated() {
        this.$nextTick(() => this.attachResizeHandles())
    }

    beforeDestroy() {
        this.disconnectFleetWs()
        this.cleanupResizeListeners()
    }

    get fleetDaemonUrl(): string {
        return this.$store.getters['gui/fleetDaemonUrl'] ?? 'http://pantheonfleet.local:8090'
    }

    connectFleetWs() {
        this.disconnectFleetWs()
        try {
            const wsUrl = this.fleetDaemonUrl.replace(/^http/, 'ws') + '/ws'
            this.fleetHistoryWs = new WebSocket(wsUrl)

            this.fleetHistoryWs.onmessage = (event: MessageEvent) => {
                try {
                    const msg = JSON.parse(event.data)
                    if (msg.event === 'history_updated') {
                        this.applyFilters()
                    }
                } catch { /* ignore non-JSON */ }
            }

            this.fleetHistoryWs.onclose = () => {
                this.fleetHistoryWs = null
                this.wsReconnectTimer = setTimeout(() => this.connectFleetWs(), 5000)
            }

            this.fleetHistoryWs.onerror = () => {
                this.fleetHistoryWs?.close()
            }
        } catch {
            this.wsReconnectTimer = setTimeout(() => this.connectFleetWs(), 5000)
        }
    }

    disconnectFleetWs() {
        if (this.wsReconnectTimer) {
            clearTimeout(this.wsReconnectTimer)
            this.wsReconnectTimer = null
        }
        if (this.fleetHistoryWs) {
            this.fleetHistoryWs.onclose = null
            this.fleetHistoryWs.close()
            this.fleetHistoryWs = null
        }
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

    readonly qcOptions = [
        { text: '—', value: null },
        { text: 'Pass', value: 'pass' },
        { text: 'Fail', value: 'fail' },
        { text: 'Pending', value: 'pending' },
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

    get printerOptions(): string[] {
        const hostnames = this.records.map((r) => r.printer_hostname).filter(Boolean)
        return [...new Set(hostnames)].sort()
    }

    get modelOptions(): string[] {
        const models = this.records.map((r) => r.printer_model).filter(Boolean) as string[]
        return [...new Set(models)].sort()
    }

    get filteredRecords(): FleetHistoryRecord[] {
        let data = this.records
        if (this.filterFilename) {
            const q = this.filterFilename.toLowerCase()
            data = data.filter((r) => r.filename?.toLowerCase().includes(q))
        }
        if (this.filterModel) {
            data = data.filter((r) => r.printer_model === this.filterModel)
        }
        if (this.appliedQrCode) {
            const q = this.appliedQrCode.toLowerCase()
            data = data.filter((r) => r.qr_code?.toLowerCase().includes(q))
        }
        return data
    }

    applyFilters() {
        this.$store.dispatch('fleet/history/loadHistory', {
            printer: this.filterPrinter || undefined,
            status: this.filterStatus || undefined,
            qr_code: this.appliedQrCode || undefined,
            limit: 200,
        })
    }

    applyQrCodeFilter() {
        // Strip #1 or #0 prefix if present (from QC scanner codes)
        let qr = this.filterQrCode || ''
        if (qr.match(/^#[01]/)) qr = qr.slice(2)
        this.appliedQrCode = qr
        this.applyFilters()
        this.$nextTick(() => { this.filterQrCode = '' })
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

    async saveQC(item: FleetHistoryRecord, qcStatus: string | null) {
        try {
            await this.$store.dispatch('fleet/history/updateQC', { id: item.id, qc_status: qcStatus ?? '', qc_date: new Date().toISOString().slice(0, 10) })
            this.showSnackbar('QC saved', 'success')
        } catch {
            this.showSnackbar('Failed to save QC', 'error')
        }
    }

    startEditNote(item: FleetHistoryRecord) {
        this.editingNoteId = item.id
        this.editingNoteText = item.qc_note || ''
    }

    cancelEditNote() {
        this.editingNoteId = null
        this.editingNoteText = ''
    }

    async saveNote(item: FleetHistoryRecord) {
        const newNote = this.editingNoteText.trim()
        this.editingNoteId = null
        // Skip save if unchanged
        if (newNote === (item.qc_note || '')) return
        try {
            await this.$store.dispatch('fleet/history/updateQC', { id: item.id, qc_note: newNote || '' })
            this.showSnackbar('Note saved', 'success')
        } catch {
            this.showSnackbar('Failed to save note', 'error')
        }
    }

    startEditQr(item: FleetHistoryRecord) {
        this.editingQrId = item.id
        this.editingQrText = item.qr_code || ''
    }

    cancelEditQr() {
        this.editingQrId = null
        this.editingQrText = ''
    }

    async saveQr(item: FleetHistoryRecord) {
        const newQr = this.editingQrText.trim()
        this.editingQrId = null
        if (newQr === (item.qr_code || '')) return
        try {
            await this.$store.dispatch('fleet/history/updateQC', { id: item.id, qr_code: newQr || '' })
            this.showSnackbar('QR code saved', 'success')
        } catch (err: any) {
            if (err?.response?.status === 409) {
                this.showSnackbar('QR code already assigned to another record (409 Conflict)', 'error')
            } else {
                this.showSnackbar('Failed to save QR code', 'error')
            }
        }
    }

    showSnackbar(text: string, color: string) {
        this.snackbarText = text
        this.snackbarColor = color
        this.snackbar = true
    }

    // ---- QC Mode ----

    async enterQcMode() {
        this.qcMode = true
        this.qcStep = 'inspector'
        this.qcInspector = ''
        this.qcSelectedRecord = null
        this.qcStatusMessage = ''
        this.qcScanBuffer = ''

        // Fetch inspector list
        this.qcInspectorsLoading = true
        try {
            this.qcInspectorList = await this.$store.dispatch('fleet/history/fetchInspectors')
        } catch {
            this.qcInspectorList = []
        } finally {
            this.qcInspectorsLoading = false
        }
    }

    exitQcMode() {
        this.qcMode = false
        this.qcStep = 'inspector'
        this.qcSelectedRecord = null
        this.qcScanBuffer = ''
        this.qcStatusMessage = ''
        // Refresh history table
        this.applyFilters()
    }

    confirmInspector() {
        if (!this.qcInspector) return
        this.qcStep = 'scanning'
        this.$nextTick(() => this.refocusScanInput())
    }

    refocusScanInput() {
        // Keep focus on the hidden input so scanner input is captured
        this.$nextTick(() => {
            const input = this.$refs.qcScanInput as HTMLInputElement | undefined
            if (input && this.qcMode && this.qcStep === 'scanning') {
                input.focus()
            }
        })
    }

    async processScan() {
        const scanned = this.qcScanBuffer.trim()
        this.qcScanBuffer = ''

        if (!scanned) return

        // Check if it's a pass/fail code (plain "1"/"0")
        if (scanned === '1' || scanned === '0') {
            if (!this.qcSelectedRecord) {
                // No job selected — ignore pass/fail scan
                return
            }
            await this.submitQcResult(scanned === '1' ? 'pass' : 'fail')
            return
        }

        // Check for #1 or #0 prefix — means "find QR code and apply pass/fail in one scan"
        const prefixMatch = scanned.match(/^#([01])(.+)$/)
        if (prefixMatch && (prefixMatch[2] === '0' || prefixMatch[2] === '1')) {
            // Pass/fail code scanned with the wrong scanner — warn and ignore
            this.qcStatusMessage = 'Pass/Fail codes should not be scanned with the QC scanner. Use the standard scanner instead.'
            this.qcStatusType = 'warning'
            this.refocusScanInput()
            return
        }
        if (prefixMatch) {
            const qcResult: 'pass' | 'fail' = prefixMatch[1] === '1' ? 'pass' : 'fail'
            const qrCode = prefixMatch[2]

            this.qcStatusMessage = ''
            this.qcNoteVisible = false
            this.qcNoteText = ''
            try {
                const record = await this.$store.dispatch('fleet/history/searchByQrCode', qrCode)
                if (record) {
                    this.qcSelectedRecord = record
                    await this.submitQcResult(qcResult)
                } else {
                    this.qcSelectedRecord = null
                    this.qcStatusMessage = `No job found for QR code: ${qrCode}`
                    this.qcStatusType = 'warning'
                }
            } catch {
                this.qcStatusMessage = `Error searching for QR code: ${qrCode}`
                this.qcStatusType = 'error'
            }

            this.refocusScanInput()
            return
        }

        // Otherwise treat as a part QR code — search for the job
        this.qcStatusMessage = ''
        this.qcNoteVisible = false
        this.qcNoteText = ''
        try {
            const record = await this.$store.dispatch('fleet/history/searchByQrCode', scanned)
            if (record) {
                this.qcSelectedRecord = record
                this.qcStatusMessage = `Found job: ${record.filename || record.printer_hostname}`
                this.qcStatusType = 'info'
            } else {
                this.qcSelectedRecord = null
                this.qcStatusMessage = `No job found for QR code: ${scanned}`
                this.qcStatusType = 'warning'
            }
        } catch {
            this.qcStatusMessage = `Error searching for QR code: ${scanned}`
            this.qcStatusType = 'error'
        }

        this.refocusScanInput()
    }

    async submitQcResult(result: 'pass' | 'fail') {
        if (!this.qcSelectedRecord) return

        try {
            await this.$store.dispatch('fleet/history/updateQC', {
                id: this.qcSelectedRecord.id,
                qc_status: result,
                qc_inspector: this.qcInspector,
                qc_date: new Date().toISOString().slice(0, 10),
            })
            // Re-fetch the record to get updated data (including qc_date set by backend)
            const updated = await this.$store.dispatch('fleet/history/searchByQrCode', this.qcSelectedRecord.qr_code)
            if (updated) this.qcSelectedRecord = updated

            this.qcStatusMessage = `QC ${result.toUpperCase()} recorded for ${this.qcSelectedRecord?.qr_code}`
            this.qcStatusType = result === 'pass' ? 'success' : 'error'
            this.qcFlashResult = result
            this.qcFlashVisible = true
            if (this.qcFlashTimer) clearTimeout(this.qcFlashTimer)
            this.qcFlashTimer = setTimeout(() => { this.qcFlashVisible = false }, 2000)
            this.qcNoteVisible = true
            this.qcNoteText = ''
        } catch {
            this.qcStatusMessage = `Failed to update QC status`
            this.qcStatusType = 'error'
        }

        this.refocusScanInput()
    }

    async saveQcNote() {
        const note = this.qcNoteText.trim()
        if (!note || !this.qcSelectedRecord) return

        try {
            await this.$store.dispatch('fleet/history/updateQC', {
                id: this.qcSelectedRecord.id,
                qc_note: note,
            })
            const updated = await this.$store.dispatch('fleet/history/searchByQrCode', this.qcSelectedRecord.qr_code)
            if (updated) this.qcSelectedRecord = updated
            this.showSnackbar('Note saved', 'success')
        } catch {
            this.showSnackbar('Failed to save note', 'error')
        }

        this.refocusScanInput()
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

        if (newW < this.HIDE_THRESHOLD) {
            // Hide the column
            const col = this.allHeaders.find((h) => h.value === this.resizingCol)
            this.toggleColumn(this.resizingCol)
            // Remove stored width so it comes back at default size
            delete this.columnWidths[this.resizingCol]
            localStorage.setItem(this.WIDTHS_KEY, JSON.stringify(this.columnWidths))
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

    // ---- Nozzle helpers ----

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
        // mm * π * (d/2)² * density / 1000 → grams
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
.qc-select :deep(.v-input__slot) {
    min-height: 28px !important;
}
.qc-note-cell {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.qr-code-cell {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.nozzle-bar {
    cursor: default;
}
.qc-hidden-input {
    position: absolute;
    left: -9999px;
    opacity: 0;
    width: 1px;
    height: 1px;
}
.qc-action-card {
    transition: transform 0.15s, box-shadow 0.15s;
}
.qc-action-card:hover:not(.qc-action-disabled) {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
.qc-action-disabled {
    opacity: 0.4;
    cursor: not-allowed !important;
}
</style>

<style>
.resizable-table table {
    table-layout: fixed;
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
