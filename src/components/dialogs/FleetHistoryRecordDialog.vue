<template>
    <v-dialog :value="value" max-width="700" @input="$emit('input', $event)">
        <v-card v-if="record">
            <v-card-title class="d-flex align-center">
                {{ title }}
                <v-spacer />
                <v-btn icon small @click="$emit('input', false)">
                    <v-icon small>{{ mdiClose }}</v-icon>
                </v-btn>
            </v-card-title>
            <v-divider />
            <v-card-text class="pt-3">
                <slot name="top" />

                <!-- Job info -->
                <span class="text-subtitle-2 font-weight-bold">Job</span>
                <v-simple-table dense class="mb-4">
                    <tbody>
                        <tr><td class="font-weight-bold" width="160">Printer</td><td>{{ record.printer_hostname }}</td></tr>
                        <tr><td class="font-weight-bold">Model</td><td>{{ record.printer_model || '—' }}</td></tr>
                        <tr><td class="font-weight-bold">Filename</td><td>
                            {{ record.filename || '—' }}
                            <v-btn
                                v-if="record.gcode_archive_hash && !record.gcode_archive_hash.startsWith('deleted:')"
                                x-small
                                icon
                                class="ml-1"
                                title="Download archived gcode"
                                @click="downloadArchivedGcode(record)">
                                <v-icon x-small>{{ mdiDownload }}</v-icon>
                            </v-btn>
                            <v-chip
                                v-if="record.gcode_archive_hash && record.gcode_archive_hash.startsWith('deleted:')"
                                x-small
                                color="error"
                                dark
                                class="ml-1">
                                file deleted
                            </v-chip>
                        </td></tr>
                        <tr><td class="font-weight-bold">Telemetry</td><td>
                            <v-btn
                                v-if="record.telemetry_archive_status === 'archived'"
                                x-small
                                icon
                                title="Download per-print telemetry (.jsonl.gz)"
                                @click="downloadTelemetry(record)">
                                <v-icon x-small>{{ mdiDownload }}</v-icon>
                            </v-btn>
                            <v-chip v-else-if="record.telemetry_archive_status === 'unavailable'" x-small color="grey" dark>not available</v-chip>
                            <v-chip v-else-if="record.telemetry_archive_status === 'corrupt'" x-small color="error" dark>corrupt</v-chip>
                            <span v-else class="text--disabled">pending</span>
                        </td></tr>
                        <tr><td class="font-weight-bold">Filament</td><td>{{ record.filament_type || '—' }}</td></tr>
                        <tr><td class="font-weight-bold">Status</td><td>
                            <v-chip x-small :color="statusColor(record.status)" dark>{{ record.status || 'unknown' }}</v-chip>
                        </td></tr>
                        <tr><td class="font-weight-bold">Start</td><td>{{ formatDate(record.start_time) }}</td></tr>
                        <tr><td class="font-weight-bold">End</td><td>{{ record.status === 'in_progress' ? 'In Progress' : formatDate(record.end_time) }}</td></tr>
                        <tr><td class="font-weight-bold">Duration</td><td>{{ formatDuration(record.print_duration_secs) }}</td></tr>
                        <tr><td class="font-weight-bold">Filament Used</td><td>{{ formatFilament(record.filament_used_mm) }}</td></tr>
                        <tr><td class="font-weight-bold">Spool QR</td><td>{{ record.spool_qr_code || '—' }}</td></tr>
                    </tbody>
                </v-simple-table>

                <!-- Spool info (if spool_qr_code is linked) -->
                <div v-if="spool" class="mb-4">
                    <span class="text-subtitle-2 font-weight-bold">Spool</span>
                    <v-simple-table dense>
                        <tbody>
                            <tr><td class="font-weight-bold" width="160">Spool ID</td><td>#{{ spool.id }}</td></tr>
                            <tr><td class="font-weight-bold">Vendor</td><td>{{ (spool.filament && spool.filament.vendor && spool.filament.vendor.name) || '—' }}</td></tr>
                            <tr><td class="font-weight-bold">Filament</td><td>{{ (spool.filament && spool.filament.name) || '—' }}</td></tr>
                            <tr><td class="font-weight-bold">Material</td><td>{{ (spool.filament && spool.filament.material) || '—' }}</td></tr>
                            <tr v-if="spool.filament && spool.filament.color_hex"><td class="font-weight-bold">Color</td><td>
                                <div :style="{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#' + spool.filament.color_hex, border: '1px solid rgba(255,255,255,0.3)', display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }" />
                                #{{ spool.filament.color_hex }}
                            </td></tr>
                            <tr><td class="font-weight-bold">Initial Weight</td><td>{{ spool.initial_weight != null ? spool.initial_weight.toFixed(0) + ' g' : '—' }}</td></tr>
                            <tr><td class="font-weight-bold">Remaining</td><td>{{ spool.remaining_weight != null ? spool.remaining_weight.toFixed(0) + ' g' : '—' }}</td></tr>
                            <tr><td class="font-weight-bold">Loaded On</td><td>
                                <v-chip v-if="spool.loaded_on_printer" x-small color="success" dark>{{ spool.loaded_on_printer }}</v-chip>
                                <v-chip v-else-if="spool.in_oven" x-small :color="spool.is_ready ? 'light-blue darken-1' : 'amber darken-2'" dark>
                                    oven {{ (spool.in_oven || '').replace(/\.local$/i, '') }}<template v-if="spool.oven_row != null"> · R{{ spool.oven_row }}S{{ spool.oven_slot }}</template>
                                </v-chip>
                                <span v-else>Not loaded</span>
                            </td></tr>
                            <tr><td class="font-weight-bold">Location</td><td>{{ spool.location || '—' }}</td></tr>
                        </tbody>
                    </v-simple-table>
                </div>

                <!-- Parts list -->
                <div class="d-flex align-center mb-1">
                    <span class="text-subtitle-2 font-weight-bold">Parts ({{ parts.length }})</span>
                </div>
                <v-progress-linear v-if="partsLoading" indeterminate color="primary" class="mb-2" />
                <v-simple-table v-else-if="parts.length" dense>
                    <thead>
                        <tr>
                            <th>QR Code</th>
                            <th>Linked At</th>
                            <th>QC Status</th>
                            <th>QC Inspector</th>
                            <th>QC Date</th>
                            <th>QC Note</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="part in parts" :key="part.id">
                            <td>{{ part.qr_code }}</td>
                            <td>{{ part.qr_linked_at ? new Date(part.qr_linked_at).toLocaleString() : '—' }}</td>
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
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import { Prop, Watch } from 'vue-property-decorator'
import { mdiClose, mdiDownload } from '@mdi/js'
import { FleetHistoryRecord } from '@/store/fleet/history/types'

/**
 * The Fleet History "Job Detail" view for one fleet_print_history record
 * (job info, linked spool, QR-linked parts with QC). Shared by the Fleet
 * History Jobs tab and the job run view under Jobs, so both show exactly
 * the same record.
 */
@Component
export default class FleetHistoryRecordDialog extends Vue {
    mdiClose = mdiClose
    mdiDownload = mdiDownload

    @Prop({ type: Boolean, default: false }) value!: boolean
    @Prop({ type: Object, default: null }) record!: FleetHistoryRecord | null
    @Prop({ type: String, default: 'Job Detail' }) title!: string

    parts: FleetHistoryRecord[] = []
    partsLoading = false
    spool: any = null

    get fleetDaemonUrl(): string {
        return this.$store.getters['gui/fleetDaemonUrl']
    }

    @Watch('record', { immediate: true })
    async onRecordChanged(record: FleetHistoryRecord | null) {
        this.parts = []
        this.spool = null
        if (!record) return
        this.partsLoading = true
        try {
            await Promise.all([
                this.$store
                    .dispatch('fleet/history/fetchPartsForJob', {
                        printer_hostname: record.printer_hostname,
                        moonraker_job_id: record.moonraker_job_id,
                    })
                    .then((parts: FleetHistoryRecord[]) => {
                        this.parts = parts
                    })
                    .catch(() => {
                        this.parts = []
                    }),
                record.spool_qr_code
                    ? this.$store
                          .dispatch('fleet/spools/lookupByQr', record.spool_qr_code)
                          .then((spool: any) => {
                              this.spool = spool
                          })
                          .catch(() => {
                              this.spool = null
                          })
                    : Promise.resolve(),
            ])
        } finally {
            this.partsLoading = false
        }
    }

    downloadArchivedGcode(job: FleetHistoryRecord) {
        if (!job.gcode_archive_hash) return
        window.open(`${this.fleetDaemonUrl}/archive/file/${job.gcode_archive_hash}`)
    }

    downloadTelemetry(job: FleetHistoryRecord) {
        if (job.telemetry_archive_status !== 'archived') return
        window.open(`${this.fleetDaemonUrl}/archive/telemetry/file/${job.id}`)
    }

    statusColor(status: string | null): string {
        switch (status) {
            case 'completed':
                return 'success'
            case 'cancelled':
                return 'grey'
            case 'in_progress':
                return 'blue'
            case 'error':
            case 'klippy_shutdown':
            case 'klippy_disconnect':
                return 'error'
            default:
                return 'grey darken-1'
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
        const grams = (mm * Math.PI * (1.75 / 2) ** 2 * 1.1) / 1000
        return `${grams.toFixed(1)} g`
    }

    formatDate(iso: string | null): string {
        if (!iso) return '—'
        return new Date(iso).toLocaleString()
    }
}
</script>
