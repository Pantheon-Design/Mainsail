<template>
    <v-card flat>
        <v-card-title class="d-flex align-center">
            <span>Print History</span>
            <v-spacer />
            <v-btn small color="primary" :loading="collecting" @click="collectNow" class="mr-2">
                Collect Now
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
                        @keydown.enter="applyFilters"
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

            <!-- QR code — click to edit -->
            <template #item.qr_code="{ item }">
                <div
                    v-if="editingQrId !== item.id"
                    class="qr-code-cell"
                    style="min-width: 120px; cursor: pointer"
                    :title="item.qr_code || 'Click to add QR code'"
                    @click="startEditQr(item)"
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
    </v-card>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import { FleetHistoryRecord } from '@/store/fleet/history/types'
import { mdiCog, mdiQrcodeScan } from '@mdi/js'

@Component
export default class FleetHistoryListPanel extends Vue {
    mdiCog = mdiCog
    mdiQrcodeScan = mdiQrcodeScan
    filterPrinter = ''
    filterStatus = ''
    filterFilename = ''
    filterModel = ''
    filterQrCode = ''
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

    readonly allHeaders = [
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
        { text: 'QC Note', value: 'qc_note', sortable: false },
        { text: 'QR Code', value: 'qr_code', sortable: true },
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
            this.visibleColumns = this.allHeaders.map((h) => h.value)
        }
        try {
            const w = localStorage.getItem(this.WIDTHS_KEY)
            if (w) this.columnWidths = JSON.parse(w)
        } catch { /* ignore */ }
    }

    mounted() {
        this.$nextTick(() => this.attachResizeHandles())
    }

    updated() {
        this.$nextTick(() => this.attachResizeHandles())
    }

    beforeDestroy() {
        this.cleanupResizeListeners()
    }

    get headers() {
        return this.allHeaders
            .filter((h) => this.visibleColumns.includes(h.value))
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
        if (this.filterQrCode) {
            const q = this.filterQrCode.toLowerCase()
            data = data.filter((r) => r.qr_code?.toLowerCase().includes(q))
        }
        return data
    }

    applyFilters() {
        this.$store.dispatch('fleet/history/loadHistory', {
            printer: this.filterPrinter || undefined,
            status: this.filterStatus || undefined,
            qr_code: this.filterQrCode || undefined,
            limit: 200,
        })
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
            await this.$store.dispatch('fleet/history/updateQC', { id: item.id, qc_status: qcStatus ?? '' })
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
