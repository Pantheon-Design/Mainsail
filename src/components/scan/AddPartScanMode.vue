<template>
    <v-dialog :value="value" fullscreen persistent no-click-animation>
        <v-card class="d-flex flex-column" style="height: 100vh; transition: background-color 0.3s ease" :style="{ backgroundColor: addPartCardColor }" @click="onAddPartCardClick">
            <!-- Header -->
            <v-card-title class="d-flex align-center py-2">
                <v-btn v-if="isMobile && addPartStep !== 'printer'" icon small class="mr-1" @click="addPartGoBack">
                    <v-icon>{{ mdiArrowLeft }}</v-icon>
                </v-btn>
                <v-icon left color="primary">{{ mdiPackageVariantClosed }}</v-icon>
                <span>Add Part Mode</span>
                <v-spacer />
                <v-btn icon @click="exitAddPartMode">
                    <v-icon>{{ mdiClose }}</v-icon>
                </v-btn>
            </v-card-title>

            <!-- Persistent feedback banner (stays until the next scan result) -->
            <div
                v-if="addPartBanner"
                class="d-flex align-center px-4 py-2"
                :style="{ background: addPartBanner.kind === 'success' ? '#2E7D32' : '#C62828', color: 'white' }"
            >
                <v-icon color="white" class="mr-3">{{ addPartBanner.kind === 'success' ? mdiCheckCircle : mdiAlertCircle }}</v-icon>
                <span class="subtitle-1 font-weight-bold">{{ addPartBanner.text }}</span>
            </div>
            <p v-if="devMode" class="caption orange--text px-4 my-1" style="font-family: monospace">
                scan: {{ addPartBurst ? addPartBurst.trace : 'no detector' }} | focused={{ addPartScanFocused }} | buffer="{{ addPartScanBuffer }}"
            </p>

            <!-- Printer banner -->
            <div v-if="addPartSelectedPrinter" class="d-flex align-center px-4 py-2" style="background: var(--v-primary-base); color: white;">
                <v-icon color="white" class="mr-3" size="28">{{ mdiPrinter3d }}</v-icon>
                <span class="text-h5 font-weight-bold">{{ addPartSelectedPrinter }}</span>
                <v-chip v-if="addPartSelectedJob" small class="ml-4" color="white" outlined dark>
                    {{ addPartSelectedJob.filename || addPartSelectedJob.moonraker_job_id }}
                </v-chip>
            </div>
            <div v-else class="d-flex align-center px-4 py-2" style="background: rgba(255,255,255,0.05);">
                <v-icon class="mr-3" size="28" color="grey">{{ mdiPrinter3d }}</v-icon>
                <span :class="isMobile ? 'body-2' : 'text-h6'" class="grey--text">No printer selected — scan a printer QR code</span>
            </div>
            <v-divider />

            <!-- Visible scan input (all layouts) -->
            <div class="d-flex align-center px-4 py-2" style="background: rgba(255,255,255,0.03);">
                <v-text-field
                    ref="addPartScanInput"
                    v-model="addPartScanBuffer"
                    label="Scan or type here"
                    autocomplete="off"
                    autocorrect="off"
                    autocapitalize="off"
                    spellcheck="false"
                    dense
                    outlined
                    hide-details
                    autofocus
                    class="flex-grow-1"
                    :prepend-inner-icon="mdiQrcodeScan"
                    @input="onAddPartScanInput"
                    @keydown.enter="processAddPartScan"
                    @focus="addPartScanFocused = true"
                    @blur="addPartScanFocused = false"
                />
            </div>

            <!-- ==================== MOBILE FLOW ==================== -->
            <template v-if="isMobile">
                <v-card-text class="d-flex flex-column flex-grow-1 pa-3" style="overflow-y: auto">
                    <!-- Status alert -->
                    <v-alert
                        v-if="addPartStatusMessage"
                        :type="addPartStatusType"
                        dense
                        class="mb-3"
                        dismissible
                        @input="addPartStatusMessage = ''"
                    >
                        {{ addPartStatusMessage }}
                    </v-alert>

                    <!-- Step 1: Select Printer -->
                    <template v-if="addPartStep === 'printer'">
                        <div class="d-flex flex-column align-center pt-4">
                            <v-icon size="64" color="primary" class="mb-4">{{ mdiPrinter3d }}</v-icon>
                            <h3 class="mb-4 text-center">Scan Printer QR Code</h3>

                            <!-- Camera capture for printer QR -->
                            <input
                                ref="addPartCameraInput"
                                type="file"
                                accept="image/*"
                                capture="environment"
                                class="scan-hidden-input"
                                @change="onAddPartCameraCapture"
                            />
                            <v-btn
                                color="primary"
                                large
                                :loading="addPartCameraProcessing"
                                class="mb-4"
                                @click="openAddPartCamera"
                            >
                                <v-icon left>{{ mdiCamera }}</v-icon>
                                Scan Printer QR
                            </v-btn>

                            <p class="caption grey--text mb-4 text-center">— or search by name —</p>

                            <!-- Manual printer search -->
                            <v-combobox
                                v-model="addPartPrinterSearch"
                                :items="knownPrinters"
                                label="Search printer hostname"
                                dense
                                outlined
                                hide-details
                                :prepend-inner-icon="mdiMagnify"
                                style="max-width: 320px; width: 100%"
                                class="mb-3"
                                @change="onAddPartPrinterSelected"
                            />
                            <v-text-field
                                ref="addPartManualInput"
                                v-model="addPartManualCode"
                                label="Or type printer hostname"
                                autocomplete="off"
                                autocorrect="off"
                                autocapitalize="off"
                                spellcheck="false"
                                dense
                                outlined
                                hide-details
                                placeholder="e.g. printer1.local"
                                style="max-width: 320px; width: 100%"
                                class="mb-3"
                                @input="onAddPartManualInput"
                                @keydown.enter="submitAddPartManualPrinter"
                            >
                                <template #append>
                                    <v-btn icon small :disabled="!addPartManualCode.trim()" @click="submitAddPartManualPrinter">
                                        <v-icon small>{{ mdiCheckCircle }}</v-icon>
                                    </v-btn>
                                </template>
                            </v-text-field>
                        </div>
                    </template>

                    <!-- Step 2: Select Job -->
                    <template v-else-if="addPartStep === 'job'">
                        <div class="d-flex flex-column flex-grow-1">
                            <h3 class="mb-3 text-center">Select a Job</h3>
                            <v-card-text v-if="addPartRecentJobsLoading" class="d-flex align-center justify-center flex-grow-1">
                                <v-progress-circular indeterminate color="primary" />
                            </v-card-text>
                            <v-card-text v-else-if="addPartRecentJobs.length === 0" class="d-flex flex-column align-center justify-center flex-grow-1">
                                <p class="grey--text">No completed jobs found for this printer.</p>
                            </v-card-text>
                            <v-list v-else dense class="flex-grow-1 overflow-y-auto pa-0">
                                <v-list-item
                                    v-for="job in addPartRecentJobs"
                                    :key="job.id"
                                    :class="{ 'primary--text v-list-item--active': addPartSelectedJob && addPartSelectedJob.id === job.id }"
                                    style="cursor: pointer"
                                    @click="selectAddPartJobMobile(job)"
                                >
                                    <v-list-item-content>
                                        <v-list-item-title>
                                            {{ job.filename || 'Unknown file' }}
                                        </v-list-item-title>
                                        <v-list-item-subtitle>
                                            <v-chip x-small :color="statusColor(job.status)" dark>
                                                {{ job.status || 'unknown' }}
                                            </v-chip>
                                            <v-chip x-small class="ml-1" outlined>
                                                {{ job.parts_count ?? 0 }} parts
                                            </v-chip>
                                            <span class="ml-2">{{ job.end_time ? new Date(job.end_time).toLocaleString() : '—' }}</span>
                                        </v-list-item-subtitle>
                                    </v-list-item-content>
                                    <v-list-item-action>
                                        <v-icon small :color="addPartSelectedJob && addPartSelectedJob.id === job.id ? 'primary' : 'grey'">{{ mdiCheckCircle }}</v-icon>
                                    </v-list-item-action>
                                </v-list-item>
                            </v-list>
                        </div>
                    </template>

                    <!-- Step 3: Scan Part QR Codes -->
                    <template v-else-if="addPartStep === 'parts'">
                        <div class="d-flex flex-column align-center pt-4">
                            <v-icon size="48" color="success" class="mb-2">{{ mdiQrcodeScan }}</v-icon>
                            <h3 class="mb-2 text-center">Scan Part QR Codes</h3>
                            <p class="caption grey--text mb-4 text-center">
                                Job: {{ addPartSelectedJob ? (addPartSelectedJob.filename || addPartSelectedJob.moonraker_job_id) : '' }}
                            </p>

                            <!-- Camera capture for part QR -->
                            <input
                                ref="addPartCameraInput"
                                type="file"
                                accept="image/*"
                                capture="environment"
                                class="scan-hidden-input"
                                @change="onAddPartCameraCapture"
                            />
                            <v-btn
                                color="success"
                                large
                                :loading="addPartCameraProcessing"
                                class="mb-4"
                                @click="openAddPartCamera"
                            >
                                <v-icon left>{{ mdiCamera }}</v-icon>
                                Scan Part QR
                            </v-btn>

                            <v-text-field
                                ref="addPartManualInput"
                                v-model="addPartManualCode"
                                label="Or type part code manually"
                                autocomplete="off"
                                autocorrect="off"
                                autocapitalize="off"
                                spellcheck="false"
                                dense
                                outlined
                                hide-details
                                style="max-width: 300px; width: 100%"
                                class="mb-4"
                                @input="onAddPartManualInput"
                                @keydown.enter="submitAddPartManualPart"
                            >
                                <template #append>
                                    <v-btn icon small :disabled="!addPartManualCode.trim()" @click="submitAddPartManualPart">
                                        <v-icon small>{{ mdiQrcodeScan }}</v-icon>
                                    </v-btn>
                                </template>
                            </v-text-field>

                            <!-- Session log (compact for mobile) -->
                            <v-card v-if="addPartRegisteredParts.length > 0" outlined style="width: 100%" class="mt-2">
                                <v-card-title class="subtitle-2 py-2">
                                    Registered ({{ addPartRegisteredParts.length }})
                                </v-card-title>
                                <v-divider />
                                <v-list dense class="pa-0" style="max-height: 200px; overflow-y: auto">
                                    <v-list-item v-for="(entry, idx) in addPartRegisteredParts.slice().reverse()" :key="idx" dense>
                                        <v-list-item-content>
                                            <v-list-item-title class="font-weight-bold">{{ entry.qr_code }}</v-list-item-title>
                                            <v-list-item-subtitle>{{ entry.filename }} &bull; {{ entry.time }}</v-list-item-subtitle>
                                        </v-list-item-content>
                                    </v-list-item>
                                </v-list>
                            </v-card>
                        </div>
                    </template>
                </v-card-text>
            </template>

            <!-- ==================== DESKTOP FLOW ==================== -->
            <v-card-text v-else class="d-flex flex-column flex-grow-1 pa-4" style="overflow-y: auto">
                <!-- Status alert (info only — success/error go to the banner above) -->
                <v-alert
                    v-if="addPartStatusMessage && addPartStatusType === 'info'"
                    :type="addPartStatusType"
                    dense
                    class="mb-4"
                    dismissible
                    @input="addPartStatusMessage = ''"
                >
                    {{ addPartStatusMessage }}
                </v-alert>

                <v-row class="flex-grow-1" no-gutters>
                    <!-- Left: Active Job Selection -->
                    <v-col cols="12" md="6" class="pr-md-2">
                        <v-card outlined class="fill-height d-flex flex-column">
                            <v-card-title class="subtitle-2 py-2">
                                {{ addPartSelectedPrinter ? `Jobs — ${addPartSelectedPrinter}` : 'Scan Printer QR to Begin' }}
                            </v-card-title>
                            <v-divider />
                            <v-card-text v-if="!addPartSelectedPrinter" class="d-flex flex-column align-center justify-center flex-grow-1" style="min-height: 200px">
                                <v-icon size="80" color="grey lighten-1">{{ mdiPrinter3d }}</v-icon>
                                <p class="text-h6 grey--text mt-4">Scan a printer hostname QR code</p>
                                <p class="caption grey--text">Printer QR codes end with .local</p>
                            </v-card-text>
                            <v-card-text v-else-if="addPartRecentJobsLoading" class="d-flex align-center justify-center flex-grow-1">
                                <v-progress-circular indeterminate color="primary" />
                            </v-card-text>
                            <v-card-text v-else-if="addPartRecentJobs.length === 0" class="d-flex flex-column align-center justify-center flex-grow-1">
                                <p class="grey--text">No completed jobs found for this printer.</p>
                            </v-card-text>
                            <v-list v-else dense class="flex-grow-1 overflow-y-auto pa-0">
                                <v-list-item
                                    v-for="job in addPartRecentJobs"
                                    :key="job.id"
                                    :class="{ 'primary--text v-list-item--active': addPartSelectedJob && addPartSelectedJob.id === job.id }"
                                    style="cursor: pointer"
                                    @click="selectAddPartJob(job)"
                                >
                                    <v-list-item-content>
                                        <v-list-item-title>
                                            {{ job.filename || 'Unknown file' }}
                                            <v-chip x-small :color="statusColor(job.status)" dark class="ml-2">
                                                {{ job.status || 'unknown' }}
                                            </v-chip>
                                            <v-chip x-small class="ml-1" outlined>
                                                {{ job.parts_count ?? 0 }} parts
                                            </v-chip>
                                        </v-list-item-title>
                                        <v-list-item-subtitle>
                                            {{ job.end_time ? new Date(job.end_time).toLocaleString() : '—' }}
                                            &bull; {{ formatDuration(job.print_duration_secs) }}
                                        </v-list-item-subtitle>
                                    </v-list-item-content>
                                    <v-list-item-action v-if="addPartSelectedJob && addPartSelectedJob.id === job.id">
                                        <v-icon small color="primary">{{ mdiCheckCircle }}</v-icon>
                                    </v-list-item-action>
                                </v-list-item>
                            </v-list>
                        </v-card>
                    </v-col>

                    <!-- Right: Session Log -->
                    <v-col cols="12" md="6" class="pl-md-2 mt-4 mt-md-0">
                        <v-card outlined class="fill-height d-flex flex-column">
                            <v-card-title class="subtitle-2 py-2">
                                Session Log ({{ addPartRegisteredParts.length }})
                            </v-card-title>
                            <v-divider />
                            <v-card-text v-if="!addPartSelectedJob" class="d-flex flex-column align-center justify-center flex-grow-1" style="min-height: 200px">
                                <v-icon size="60" color="grey lighten-1">{{ mdiQrcodeScan }}</v-icon>
                                <p class="grey--text mt-4">Select a printer and job, then scan part QR codes</p>
                                <p class="caption grey--text">Part QR codes are numbers only</p>
                            </v-card-text>
                            <template v-else>
                                <v-card-text v-if="addPartRegisteredParts.length === 0" class="d-flex flex-column align-center justify-center flex-grow-1" style="min-height: 200px">
                                    <v-icon size="60" color="success">{{ mdiQrcodeScan }}</v-icon>
                                    <p class="text-h6 success--text mt-4">Ready — scan part QR codes</p>
                                    <p class="caption grey--text">
                                        Job: {{ addPartSelectedJob.filename || addPartSelectedJob.moonraker_job_id }}
                                    </p>
                                </v-card-text>
                                <v-simple-table v-else dense class="flex-grow-1">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>QR Code</th>
                                            <th>Printer</th>
                                            <th>Job</th>
                                            <th>Time</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="(entry, idx) in addPartRegisteredParts.slice().reverse()" :key="idx">
                                            <td>{{ addPartRegisteredParts.length - idx }}</td>
                                            <td class="font-weight-bold">{{ entry.qr_code }}</td>
                                            <td>{{ entry.hostname }}</td>
                                            <td>{{ entry.filename }}</td>
                                            <td>{{ entry.time }}</td>
                                        </tr>
                                    </tbody>
                                </v-simple-table>
                            </template>
                        </v-card>
                    </v-col>
                </v-row>
            </v-card-text>
        </v-card>
    </v-dialog>
</template>

<script lang="ts">
/**
 * Add Part Mode — standalone fullscreen scanning dialog.
 *
 * Shared by the full Mainsail Parts panel and the Scanner Lite entry.
 * Open it with v-model; the host must call `warmScanKeyboard()` synchronously
 * inside the tap that opens it. Emits `closed` after the dialog closes so the
 * host can refresh its own lists.
 *
 * Needs the `fleet/history` store module (fetchRecentJobs, linkQrCode).
 */
import Vue from 'vue'
import Component from 'vue-class-component'
import { Prop, Watch } from 'vue-property-decorator'
import { mdiQrcodeScan, mdiClose, mdiCamera, mdiPackageVariantClosed, mdiPrinter3d, mdiCheckCircle, mdiAlertCircle, mdiMagnify, mdiArrowLeft } from '@mdi/js'
import { FleetHistoryRecord } from '@/store/fleet/history/types'
import { ScanBurstDetector, takeScanInput, resolveScanInputEl } from '@/plugins/scanBurstDetector'

@Component
export default class AddPartScanMode extends Vue {
    @Prop({ type: Boolean, default: false }) readonly value!: boolean
    @Prop({ type: Boolean, default: false }) readonly devMode!: boolean
    @Prop({ type: Boolean, default: false }) readonly isMobile!: boolean
    /** Hostnames already known to the fleet, used to tell "unknown printer" from "no jobs". */
    @Prop({ type: Array, default: () => [] }) readonly knownPrinters!: string[]

    mdiQrcodeScan = mdiQrcodeScan
    mdiClose = mdiClose
    mdiCamera = mdiCamera
    mdiPackageVariantClosed = mdiPackageVariantClosed
    mdiPrinter3d = mdiPrinter3d
    mdiCheckCircle = mdiCheckCircle
    mdiAlertCircle = mdiAlertCircle
    mdiMagnify = mdiMagnify
    mdiArrowLeft = mdiArrowLeft

    addPartScanBuffer = ''
    addPartSelectedPrinter = ''
    addPartRecentJobs: FleetHistoryRecord[] = []
    addPartSelectedJob: FleetHistoryRecord | null = null
    addPartRecentJobsLoading = false
    addPartStatusMessage = ''
    addPartStatusType: 'success' | 'error' | 'info' | 'warning' = 'info'
    addPartRegisteredParts: Array<{ qr_code: string; hostname: string; filename: string; time: string }> = []
    addPartScanFocused = false
    addPartSaving = false
    addPartFlash: 'success' | 'error' | null = null
    addPartFlashTimer: ReturnType<typeof setTimeout> | null = null
    addPartBanner: { kind: 'success' | 'error'; text: string } | null = null
    /** Auto-submit scanner bursts that arrive without a trailing Enter (set in created). */
    addPartBurst: ScanBurstDetector | null = null
    addPartManualBurst: ScanBurstDetector | null = null

    // Mobile camera scanning
    addPartCameraProcessing = false
    addPartManualCode = ''
    addPartStep: 'printer' | 'job' | 'parts' = 'printer'
    addPartPrinterSearch = ''

    created() {
        this.addPartBurst = new ScanBurstDetector((value) => {
            this.addPartScanBuffer = value
            this.processAddPartScan()
        })
        this.addPartManualBurst = new ScanBurstDetector((value) => {
            this.addPartManualCode = value
            if (this.addPartStep === 'parts') this.submitAddPartManualPart()
            else this.submitAddPartManualPrinter()
        })
    }

    beforeDestroy() {
        this.addPartBurst?.unwatch()
        this.addPartBurst?.reset()
        this.addPartManualBurst?.unwatch()
        this.addPartManualBurst?.reset()
    }

    @Watch('value')
    onValueChange(open: boolean) {
        if (open) this.onOpen()
        else this.onClose()
    }

    onOpen() {
        this.addPartBurst?.reset()
        // Poll the fields so detection works even if no input events reach us
        this.addPartBurst?.watch(() => resolveScanInputEl(this.$refs.addPartScanInput)?.value ?? '')
        this.addPartManualBurst?.watch(() => resolveScanInputEl(this.$refs.addPartManualInput)?.value ?? '')
        this.addPartScanBuffer = ''
        this.addPartSelectedPrinter = ''
        this.addPartRecentJobs = []
        this.addPartSelectedJob = null
        this.addPartStatusMessage = ''
        this.addPartRegisteredParts = []
        this.addPartCameraProcessing = false
        this.addPartManualCode = ''
        this.addPartStep = 'printer'
        this.addPartPrinterSearch = ''
        this.resetAddPartFeedback()
        this.$nextTick(() => this.refocusAddPartInput())
    }

    onClose() {
        this.addPartBurst?.unwatch()
        this.addPartBurst?.reset()
        this.addPartManualBurst?.unwatch()
        this.addPartManualBurst?.reset()
        this.addPartSelectedPrinter = ''
        this.addPartRecentJobs = []
        this.addPartSelectedJob = null
        this.addPartScanBuffer = ''
        this.addPartStatusMessage = ''
        this.addPartRegisteredParts = []
        this.resetAddPartFeedback()
    }

    exitAddPartMode() {
        this.$emit('input', false)
        this.$emit('closed')
    }

    onAddPartScanInput(value: string) {
        this.addPartBurst?.onInput(value)
    }

    onAddPartManualInput(value: string) {
        this.addPartManualBurst?.onInput(value)
    }

    // ---- feedback (flash + persistent banner) ----

    get addPartCardColor(): string | undefined {
        if (this.addPartFlash === 'success') return '#2E7D32'
        if (this.addPartFlash === 'error') return '#C62828'
        return undefined
    }

    /** Green/red screen flash plus a banner that stays until the next feedback replaces it. */
    addPartFeedback(kind: 'success' | 'error', text: string) {
        this.addPartBanner = { kind, text }
        this.addPartStatusMessage = text
        this.addPartStatusType = kind
        this.addPartFlash = kind
        if (this.addPartFlashTimer) clearTimeout(this.addPartFlashTimer)
        this.addPartFlashTimer = setTimeout(() => {
            this.addPartFlash = null
            this.addPartFlashTimer = null
        }, 1500)
    }

    resetAddPartFeedback() {
        this.addPartBanner = null
        this.addPartFlash = null
        this.addPartSaving = false
        if (this.addPartFlashTimer) {
            clearTimeout(this.addPartFlashTimer)
            this.addPartFlashTimer = null
        }
    }

    refocusAddPartInput() {
        this.$nextTick(() => {
            const field = this.$refs.addPartScanInput as any
            if (field && this.value) {
                if (field.focus) field.focus()
                else if (field.$el) field.$el.querySelector('input')?.focus()
            }
        })
    }

    onAddPartCardClick(e: MouseEvent) {
        const el = e.target as HTMLElement
        if (el.closest('input, textarea, button, .v-input, .v-btn, .v-list-item')) return
        this.refocusAddPartInput()
    }

    selectAddPartJob(job: FleetHistoryRecord) {
        this.addPartSelectedJob = job
        this.addPartStatusMessage = `Selected job: ${job.filename || job.moonraker_job_id}`
        this.addPartStatusType = 'info'
        this.$nextTick(() => this.refocusAddPartInput())
    }

    async processAddPartScan() {
        this.addPartBurst?.reset()
        const scanned = takeScanInput(this.$refs.addPartScanInput, this.addPartScanBuffer)
        this.addPartScanBuffer = ''
        if (!scanned) return

        // Printer hostname scan (ends with .local)
        if (scanned.toLowerCase().endsWith('.local')) {
            await this.addPartSelectPrinter(scanned.toLowerCase())
            this.refocusAddPartInput()
            return
        }

        // Part QR code scan (numbers only)
        if (/^\d+$/.test(scanned)) {
            await this.addPartRegisterPart(scanned)
            this.refocusAddPartInput()
            return
        }

        // Invalid scan
        this.addPartFeedback('error', `Scanned "${scanned}" — not a printer hostname (.local) or part QR (numbers only)`)
        this.refocusAddPartInput()
    }

    // ---- mobile helpers ----

    addPartGoBack() {
        if (this.addPartStep === 'parts') {
            this.addPartStep = 'job'
        } else if (this.addPartStep === 'job') {
            this.addPartStep = 'printer'
            this.addPartSelectedPrinter = ''
            this.addPartRecentJobs = []
            this.addPartSelectedJob = null
        }
        this.addPartStatusMessage = ''
        this.addPartManualCode = ''
    }

    openAddPartCamera() {
        const input = this.$refs.addPartCameraInput as HTMLInputElement | undefined
        if (input) {
            input.value = ''
            input.click()
        }
    }

    async onAddPartCameraCapture(e: Event) {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return
        this.addPartCameraProcessing = true
        try {
            const { readBarcodesFromImageFile } = await import('zxing-wasm')
            const blob = new Blob([await file.arrayBuffer()], { type: file.type })
            const results = await readBarcodesFromImageFile(blob, {
                formats: ['DataMatrix', 'QRCode'],
                tryHarder: true,
                tryRotate: true,
                tryInvert: true,
                tryDownscale: true,
                maxNumberOfSymbols: 1,
            })
            if (results.length && results[0].text) {
                const scanned = results[0].text.trim()
                if (this.addPartStep === 'printer') {
                    await this.addPartSelectPrinter(scanned)
                } else if (this.addPartStep === 'parts') {
                    await this.addPartRegisterPart(scanned)
                }
            } else {
                this.addPartStatusMessage = 'No code found in photo. Ensure the QR code is clearly visible and well-lit.'
                this.addPartStatusType = 'warning'
            }
        } catch {
            this.addPartStatusMessage = 'Failed to process photo. Please try again.'
            this.addPartStatusType = 'error'
        } finally {
            this.addPartCameraProcessing = false
        }
    }

    async onAddPartPrinterSelected(val: string) {
        if (!val) return
        const hostname = val.endsWith('.local') ? val : `${val}.local`
        await this.addPartSelectPrinter(hostname)
    }

    async submitAddPartManualPrinter() {
        this.addPartManualBurst?.reset()
        const code = takeScanInput(this.$refs.addPartManualInput, this.addPartManualCode)
        this.addPartManualCode = ''
        if (!code) return
        const hostname = code.endsWith('.local') ? code : `${code}.local`
        await this.addPartSelectPrinter(hostname)
    }

    async submitAddPartManualPart() {
        this.addPartManualBurst?.reset()
        const code = takeScanInput(this.$refs.addPartManualInput, this.addPartManualCode)
        this.addPartManualCode = ''
        if (!code) return
        await this.addPartRegisterPart(code)
    }

    async addPartSelectPrinter(hostname: string) {
        hostname = hostname.trim().toLowerCase()
        if (!hostname.endsWith('.local')) {
            this.addPartFeedback('error', `"${hostname}" is not a valid printer hostname (must end with .local)`)
            return
        }
        this.addPartRecentJobsLoading = true
        try {
            const jobs = await this.$store.dispatch('fleet/history/fetchRecentJobs', {
                printer_hostname: hostname,
                limit: 10,
            })
            if (jobs.length > 0) {
                this.addPartSelectedPrinter = hostname
                this.addPartRecentJobs = jobs
                this.addPartSelectedJob = jobs[0]
                const jobName = jobs[0].filename || jobs[0].moonraker_job_id
                this.addPartFeedback('success', `Printer ${hostname} — ${jobs.length} recent job${jobs.length > 1 ? 's' : ''}, selected ${jobName}`)
                this.addPartStep = 'job'
            } else {
                this.addPartSelectedPrinter = ''
                this.addPartRecentJobs = []
                this.addPartSelectedJob = null
                const known = this.knownPrinters.some((h) => (h || '').toLowerCase() === hostname)
                this.addPartFeedback('error', known
                    ? `${hostname} has no completed jobs to register parts against`
                    : `${hostname} is not a known printer in the fleet`)
            }
        } catch {
            this.addPartSelectedPrinter = ''
            this.addPartRecentJobs = []
            this.addPartSelectedJob = null
            this.addPartFeedback('error', `Could not look up ${hostname} — not a valid printer or daemon unreachable`)
        } finally {
            this.addPartRecentJobsLoading = false
        }
    }

    selectAddPartJobMobile(job: FleetHistoryRecord) {
        this.addPartSelectedJob = job
        this.addPartStatusMessage = `Selected job: ${job.filename || job.moonraker_job_id}`
        this.addPartStatusType = 'info'
        this.addPartStep = 'parts'
        this.addPartManualCode = ''
    }

    async addPartRegisterPart(scanned: string) {
        if (!this.addPartSelectedJob) {
            this.addPartFeedback('error', 'Scan a printer first before scanning parts')
            return
        }
        if (!/^\d+$/.test(scanned)) {
            this.addPartFeedback('error', `"${scanned}" is not a valid part QR code (numbers only)`)
            return
        }
        if (this.addPartSaving) return
        this.addPartSaving = true
        try {
            await this.$store.dispatch('fleet/history/linkQrCode', {
                printer_hostname: this.addPartSelectedPrinter,
                moonraker_job_id: this.addPartSelectedJob.moonraker_job_id,
                qr_code: scanned,
            })
            const jobName = this.addPartSelectedJob.filename || this.addPartSelectedJob.moonraker_job_id
            this.addPartFeedback('success', `Part ${scanned} registered to ${jobName}`)
            this.addPartStep = 'parts'
            this.addPartRegisteredParts.push({
                qr_code: scanned,
                hostname: this.addPartSelectedPrinter,
                filename: jobName,
                time: new Date().toLocaleTimeString(),
            })
            if (this.addPartSelectedJob.parts_count != null) {
                const updated = { ...this.addPartSelectedJob, parts_count: this.addPartSelectedJob.parts_count + 1 }
                this.addPartSelectedJob = updated
                const idx = this.addPartRecentJobs.findIndex((j) => j.id === updated.id)
                if (idx >= 0) this.$set(this.addPartRecentJobs, idx, updated)
            }
        } catch (err: any) {
            const msg = err?.response?.data?.detail || err?.response?.data?.error || err?.message || 'Failed to register part'
            this.addPartFeedback('error', `Part ${scanned} rejected: ${msg}`)
        } finally {
            this.addPartSaving = false
        }
    }

    // ---- helpers ----

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
}
</script>

<style scoped>
.scan-hidden-input {
    position: absolute;
    left: -9999px;
    opacity: 0;
    width: 1px;
    height: 1px;
}
</style>
