<template>
    <v-card flat>
        <v-card-title class="d-flex align-center">
            <span>GCode Archive</span>
            <v-spacer />
            <v-btn small color="primary" :loading="sweeping" @click="triggerSweep" class="mr-2">
                Sweep Now
            </v-btn>
            <v-btn small outlined @click="refreshStatus">
                Refresh
            </v-btn>
        </v-card-title>

        <!-- Stats -->
        <v-card-text class="py-1" v-if="status">
            <v-row dense>
                <v-col cols="6" sm="3">
                    <v-card outlined class="pa-2 text-center">
                        <div class="caption grey--text">Archived Files</div>
                        <div class="text-h6">{{ status.total_files.toLocaleString() }}</div>
                    </v-card>
                </v-col>
                <v-col cols="6" sm="3">
                    <v-card outlined class="pa-2 text-center">
                        <div class="caption grey--text">Total Size</div>
                        <div class="text-h6">{{ formatSize(status.total_size_bytes) }}</div>
                    </v-card>
                </v-col>
                <v-col cols="6" sm="3">
                    <v-card outlined class="pa-2 text-center">
                        <div class="caption grey--text">Un-archived Jobs</div>
                        <div class="text-h6">{{ status.unarchived_jobs.toLocaleString() }}</div>
                    </v-card>
                </v-col>
                <v-col cols="6" sm="3">
                    <v-card outlined class="pa-2 text-center">
                        <div class="caption grey--text">Deleted (File Gone)</div>
                        <div class="text-h6">{{ status.deleted_jobs.toLocaleString() }}</div>
                    </v-card>
                </v-col>
            </v-row>
        </v-card-text>

        <!-- Search -->
        <v-card-text class="py-1">
            <v-row dense>
                <v-col cols="12" sm="6">
                    <v-text-field
                        v-model="searchText"
                        label="Search archived files by name"
                        dense
                        outlined
                        clearable
                        hide-details
                        @keydown.enter="doSearch"
                        @click:clear="clearSearch"
                    />
                </v-col>
                <v-col cols="12" sm="2">
                    <v-btn color="primary" :loading="isLoading" @click="doSearch" block dense>
                        Search
                    </v-btn>
                </v-col>
            </v-row>
        </v-card-text>

        <!-- Results Table -->
        <v-data-table
            :headers="headers"
            :items="entries"
            :loading="isLoading"
            :items-per-page="25"
            :footer-props="{ 'items-per-page-options': [10, 25, 50, 100] }"
            sort-by="archived_at"
            :sort-desc="true"
            dense
            class="archive-table"
            @click:row="openFileDetail"
        >
            <template #item.original_filename="{ item }">
                <span :title="item.original_filename">{{ displayFilename(item.original_filename) }}</span>
            </template>

            <template #item.file_size="{ item }">
                {{ formatSize(item.file_size) }}
            </template>

            <template #item.archived_at="{ item }">
                {{ formatDate(item.archived_at) }}
            </template>

            <template #item.source_type="{ item }">
                <v-chip
                    x-small
                    :color="item.source_type === 'deleted' ? 'error' : item.source_type === 'fleet' ? 'blue' : 'grey'"
                    dark
                >
                    {{ item.source_type === 'deleted' ? 'file deleted' : item.source_type }}
                </v-chip>
            </template>

            <template #item.actions="{ item }">
                <v-btn
                    v-if="item.source_type !== 'deleted'"
                    x-small icon @click.stop="downloadFile(item)" title="Download gcode"
                >
                    <v-icon small>{{ mdiDownload }}</v-icon>
                </v-btn>
            </template>
        </v-data-table>

        <v-card-text v-if="!entries.length && !isLoading && searchPerformed" class="text-center grey--text">
            No archived files found matching "{{ lastSearch }}".
        </v-card-text>

        <!-- Snackbar -->
        <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="3000" bottom>
            {{ snackbarText }}
        </v-snackbar>

        <!-- File Detail Dialog -->
        <v-dialog v-model="detailDialog" max-width="800">
            <v-card v-if="detailEntry">
                <v-card-title class="d-flex align-center">
                    Archived File
                    <v-spacer />
                    <v-btn v-if="detailEntry.source_type !== 'deleted'" icon small class="mr-2" @click="downloadFile(detailEntry)" title="Download">
                        <v-icon small>{{ mdiDownload }}</v-icon>
                    </v-btn>
                    <v-btn icon small @click="detailDialog = false">
                        <v-icon small>{{ mdiClose }}</v-icon>
                    </v-btn>
                </v-card-title>
                <v-divider />
                <v-card-text class="pt-3">
                    <!-- File info -->
                    <span class="text-subtitle-2 font-weight-bold">File Info</span>
                    <v-simple-table dense class="mb-4">
                        <tbody>
                            <tr><td class="font-weight-bold" width="160">Filename</td><td>{{ detailEntry.original_filename }}</td></tr>
                            <tr><td class="font-weight-bold">Size</td><td>{{ formatSize(detailEntry.file_size) }}</td></tr>
                            <tr><td class="font-weight-bold">Content Hash</td><td class="caption">{{ detailEntry.content_hash }}</td></tr>
                            <tr><td class="font-weight-bold">Source Printer</td><td>{{ detailEntry.source_printer }}</td></tr>
                            <tr><td class="font-weight-bold">Source Type</td><td>
                                <v-chip x-small :color="detailEntry.source_type === 'fleet' ? 'blue' : 'grey'" dark>
                                    {{ detailEntry.source_type }}
                                </v-chip>
                            </td></tr>
                            <tr><td class="font-weight-bold">Archived At</td><td>{{ formatDate(detailEntry.archived_at) }}</td></tr>
                        </tbody>
                    </v-simple-table>

                    <!-- Associated Jobs -->
                    <div class="d-flex align-center mb-1">
                        <span class="text-subtitle-2 font-weight-bold">Jobs Using This File ({{ detailJobs.length }})</span>
                    </div>
                    <v-progress-linear v-if="detailJobsLoading" indeterminate color="primary" class="mb-2" />
                    <v-data-table
                        v-else-if="detailJobs.length"
                        :headers="jobHeaders"
                        :items="detailJobs"
                        :items-per-page="10"
                        :footer-props="{ 'items-per-page-options': [10, 25, 50] }"
                        sort-by="start_time"
                        :sort-desc="true"
                        dense
                    >
                        <template #item.status="{ item }">
                            <v-chip x-small :color="statusColor(item.status)" dark>
                                {{ item.status || 'unknown' }}
                            </v-chip>
                        </template>
                        <template #item.start_time="{ item }">
                            {{ formatDate(item.start_time) }}
                        </template>
                        <template #item.print_duration_secs="{ item }">
                            {{ formatDuration(item.print_duration_secs) }}
                        </template>
                        <template #item.filament_used_mm="{ item }">
                            {{ formatFilament(item.filament_used_mm) }}
                        </template>
                    </v-data-table>
                    <p v-else class="caption grey--text">No jobs found for this archived file.</p>
                </v-card-text>
            </v-card>
        </v-dialog>
    </v-card>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import { Watch } from 'vue-property-decorator'
import { FleetArchiveEntry } from '@/store/fleet/archive/types'
import { FleetHistoryRecord } from '@/store/fleet/history/types'
import { mdiDownload, mdiClose } from '@mdi/js'
import axios from 'axios'

@Component
export default class FleetArchivePanel extends Vue {
    mdiDownload = mdiDownload
    mdiClose = mdiClose

    searchText = ''
    lastSearch = ''
    searchPerformed = false
    sweeping = false
    snackbar = false
    snackbarText = ''
    snackbarColor = 'success'

    // Detail dialog
    detailDialog = false
    detailEntry: FleetArchiveEntry | null = null
    detailJobs: FleetHistoryRecord[] = []
    detailJobsLoading = false

    readonly headers = [
        { text: 'Filename', value: 'original_filename', sortable: true },
        { text: 'Size', value: 'file_size', sortable: true },
        { text: 'Archived', value: 'archived_at', sortable: true },
        { text: 'Source Printer', value: 'source_printer', sortable: true },
        { text: 'Type', value: 'source_type', sortable: true },
        { text: '', value: 'actions', sortable: false, width: '48px' },
    ]

    readonly jobHeaders = [
        { text: 'Printer', value: 'printer_hostname', sortable: true },
        { text: 'Status', value: 'status', sortable: true },
        { text: 'Start', value: 'start_time', sortable: true },
        { text: 'Duration', value: 'print_duration_secs', sortable: true },
        { text: 'Filament Used', value: 'filament_used_mm', sortable: true },
        { text: 'Filament Type', value: 'filament_type', sortable: true },
    ]

    private loaded = false

    mounted() {
        this.loadInitial()
    }

    activated() {
        // Called when kept-alive component is re-activated
        if (!this.entries.length && !this.isLoading) this.loadInitial()
    }

    loadInitial() {
        this.refreshStatus()
        this.loadRecentFiles()
    }

    get entries(): FleetArchiveEntry[] {
        return this.$store.getters['fleet/archive/getEntries']
    }

    get status() {
        return this.$store.getters['fleet/archive/getStatus']
    }

    get isLoading(): boolean {
        return this.$store.getters['fleet/archive/isLoading']
    }

    get fleetDaemonUrl(): string {
        return this.$store.getters['gui/fleetDaemonUrl']
    }

    refreshStatus() {
        this.$store.dispatch('fleet/archive/loadStatus')
    }

    loadRecentFiles() {
        this.$store.dispatch('fleet/archive/loadRecent')
    }

    doSearch() {
        const q = (this.searchText || '').trim()
        if (!q) {
            this.clearSearch()
            return
        }
        this.searchPerformed = true
        this.lastSearch = q
        this.$store.dispatch('fleet/archive/searchFiles', q)
    }

    clearSearch() {
        this.searchText = ''
        this.searchPerformed = false
        this.loadRecentFiles()
    }

    async triggerSweep() {
        this.sweeping = true
        try {
            await this.$store.dispatch('fleet/archive/triggerSweep')
            this.showSnackbar('Archive sweep started', 'success')
            setTimeout(() => this.refreshStatus(), 5000)
        } catch {
            this.showSnackbar('Failed to start sweep', 'error')
        } finally {
            this.sweeping = false
        }
    }

    async openFileDetail(entry: FleetArchiveEntry) {
        this.detailEntry = entry
        this.detailJobs = []
        this.detailJobsLoading = true
        this.detailDialog = true

        try {
            // Fetch jobs that reference this archive hash
            const response = await axios.get(`${this.fleetDaemonUrl}/history`, {
                params: {
                    gcode_archive_hash: entry.content_hash,
                    has_qr_code: false,
                    limit: 200,
                },
            })
            this.detailJobs = response.data.records ?? response.data
        } catch (err) {
            console.error('Failed to load jobs for archive entry:', err)
            this.detailJobs = []
        } finally {
            this.detailJobsLoading = false
        }
    }

    downloadFile(entry: FleetArchiveEntry) {
        const url = `${this.fleetDaemonUrl}/archive/file/${entry.content_hash}`
        window.open(url)
    }

    showSnackbar(text: string, color: string) {
        this.snackbarText = text
        this.snackbarColor = color
        this.snackbar = true
    }

    displayFilename(filename: string): string {
        if (!filename) return '—'
        const parts = filename.split('/')
        return parts[parts.length - 1]
    }

    formatSize(bytes: number | null): string {
        if (!bytes) return '—'
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
    }

    formatDate(iso: string | null): string {
        if (!iso) return '—'
        return new Date(iso).toLocaleString()
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
}
</script>

<style scoped>
.archive-table tbody tr {
    cursor: pointer;
}
</style>
