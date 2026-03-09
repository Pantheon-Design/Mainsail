<template>
    <v-card flat>
        <v-card-title class="d-flex align-center">
            <span>Print History</span>
            <v-spacer />
            <v-btn small color="primary" :loading="collecting" @click="collectNow" class="mr-2">
                Collect Now
            </v-btn>
        </v-card-title>

        <!-- Filters -->
        <v-card-text class="pb-0">
            <v-row dense>
                <v-col cols="12" sm="4">
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
                <v-col cols="12" sm="4">
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
                <v-col cols="12" sm="4">
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
            </v-row>
        </v-card-text>

        <!-- Table -->
        <v-data-table
            :headers="headers"
            :items="filteredRecords"
            :loading="isLoading"
            :items-per-page="50"
            :footer-props="{ 'items-per-page-options': [25, 50, 100, 200] }"
            dense
            class="fleet-history-table"
        >
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

@Component
export default class FleetHistoryListPanel extends Vue {
    filterPrinter = ''
    filterStatus = ''
    filterFilename = ''
    collecting = false
    snackbar = false
    snackbarText = ''
    snackbarColor = 'success'
    debounceTimer: ReturnType<typeof setTimeout> | null = null

    readonly headers = [
        { text: 'Printer', value: 'printer_hostname', sortable: true },
        { text: 'Filename', value: 'filename', sortable: true },
        { text: 'Filament', value: 'filament_type', sortable: true },
        { text: 'Status', value: 'status', sortable: true },
        { text: 'Start', value: 'start_time', sortable: true },
        { text: 'Duration', value: 'print_duration_secs', sortable: true },
        { text: 'Filament Used', value: 'filament_used_mm', sortable: true },
        { text: 'QC', value: 'qc_status', sortable: false },
    ]

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

    get filteredRecords(): FleetHistoryRecord[] {
        let data = this.records
        if (this.filterFilename) {
            const q = this.filterFilename.toLowerCase()
            data = data.filter((r) => r.filename?.toLowerCase().includes(q))
        }
        return data
    }

    applyFilters() {
        this.$store.dispatch('fleet/history/loadHistory', {
            printer: this.filterPrinter || undefined,
            status: this.filterStatus || undefined,
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
            await this.$store.dispatch('fleet/history/updateQC', { id: item.id, qc_status: qcStatus })
            this.showSnackbar('QC saved', 'success')
        } catch {
            this.showSnackbar('Failed to save QC', 'error')
        }
    }

    showSnackbar(text: string, color: string) {
        this.snackbarText = text
        this.snackbarColor = color
        this.snackbar = true
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
</style>
