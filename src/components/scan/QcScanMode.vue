<template>
    <v-dialog :value="value" fullscreen persistent no-click-animation>
        <v-card class="qc-mode-card d-flex flex-column" :style="{ height: '100vh', backgroundColor: qcFlashVisible ? (qcFlashResult === 'pass' ? '#C8E6C9' : '#FFCDD2') : undefined, transition: 'background-color 0.3s ease' }" @click="onQcCardClick">
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
                <div v-if="qcInspectorList.length" class="d-flex flex-wrap mt-2" style="max-width: 400px; gap: 8px">
                    <v-chip
                        v-for="name in qcInspectorList"
                        :key="name"
                        small
                        outlined
                        :color="qcInspector === name ? 'primary' : ''"
                        style="cursor: pointer"
                        @click="qcInspector = name"
                    >
                        {{ name }}
                    </v-chip>
                </div>
                <v-btn color="primary" class="mt-4" :disabled="!qcInspector" @click="confirmInspector">
                    Start QC
                </v-btn>
            </v-card-text>

            <!-- Step 2: Scanning -->
            <v-card-text v-else-if="qcStep === 'scanning'" class="d-flex flex-column flex-grow-1 pa-4" :class="{ 'qc-mobile-scanning': isMobile }">
                <!-- Hidden input for barcode scanner (all layouts) -->
                <input
                    ref="qcScanInput"
                    v-model="qcScanBuffer"
                    class="scan-hidden-input"
                    autocomplete="off"
                    autocorrect="off"
                    autocapitalize="off"
                    spellcheck="false"
                    autofocus
                    @input="onQcScanInput"
                    @keydown.enter="processScan"
                    @blur="onQcScanBlur"
                />
                <p v-if="devMode" class="caption orange--text mb-2" style="font-family: monospace">
                    scan: {{ qcBurst ? qcBurst.trace : 'no detector' }} | buffer="{{ qcScanBuffer }}"
                </p>

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

                <!-- Mobile: Camera capture + manual input -->
                <div v-if="isMobile" class="d-flex flex-column align-center mb-4" style="width: 100%">
                    <input
                        ref="qcCameraInput"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        class="scan-hidden-input"
                        @change="onCameraCapture"
                    />
                    <v-btn
                        color="primary"
                        :loading="qcCameraProcessing"
                        class="mb-3"
                        @click="openCameraCapture"
                    >
                        <v-icon left>{{ mdiCamera }}</v-icon>
                        Scan with Camera
                    </v-btn>
                    <v-text-field
                        ref="qcManualInput"
                        v-model="qcManualCode"
                        label="Or type code manually"
                        autocomplete="off"
                        autocorrect="off"
                        autocapitalize="off"
                        spellcheck="false"
                        dense
                        outlined
                        hide-details
                        style="max-width: 300px; width: 100%"
                        @input="onQcManualInput"
                        @keydown.enter="submitManualCode"
                    >
                        <template #append>
                            <v-btn icon small :disabled="!qcManualCode.trim()" @click="submitManualCode">
                                <v-icon small>{{ mdiQrcodeScan }}</v-icon>
                            </v-btn>
                        </template>
                    </v-text-field>
                </div>

                <!-- Pass/Fail actions -->
                <v-card outlined class="d-flex flex-column align-center justify-center pa-4 mb-4">
                    <p class="subtitle-2 mb-4">{{ qcSelectedRecord ? 'Scan or click to set QC result' : 'Select a part first' }}</p>

                    <div class="d-flex justify-space-between mb-6 qc-pass-fail-row" :style="isMobile ? { paddingLeft: '16px', paddingRight: '16px' } : { paddingLeft: '256px', paddingRight: '256px' }" style="width: 100%">
                        <v-card
                            outlined
                            class="pa-4 d-flex flex-column align-center qc-action-card"
                            :class="{ 'qc-action-disabled': !qcSelectedRecord }"
                            style="cursor: pointer"
                            @click="qcSelectedRecord && submitQcResult('pass')"
                        >
                            <img src="/img/icons/qr_code_1.png" alt="PASS" :style="isMobile ? 'width: 80px; height: 80px' : 'width: 120px; height: 120px'" />
                            <v-chip small color="success" dark class="mt-2">PASS</v-chip>
                        </v-card>
                        <v-card
                            outlined
                            class="pa-4 d-flex flex-column align-center qc-action-card"
                            :class="{ 'qc-action-disabled': !qcSelectedRecord }"
                            style="cursor: pointer"
                            @click="qcSelectedRecord && submitQcResult('fail')"
                        >
                            <img src="/img/icons/qr_code_0.png" alt="FAIL" :style="isMobile ? 'width: 80px; height: 80px' : 'width: 120px; height: 120px'" />
                            <v-chip small color="error" dark class="mt-2">FAIL</v-chip>
                        </v-card>
                    </div>

                    <p v-if="!isMobile" class="caption grey--text text-center">
                        Scan <strong>1</strong> for PASS or <strong>0</strong> for FAIL<br/>
                        Or click the buttons above
                    </p>

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
                            <v-btn small color="primary" class="mt-2" :disabled="!qcNoteText.trim()" @click="saveQcNote">
                                Save Note
                            </v-btn>
                        </div>
                    </v-expand-transition>
                </v-card>

                <!-- Part info (below) -->
                <v-card outlined>
                    <v-card-title class="subtitle-2 py-2">
                        {{ qcSelectedRecord ? 'Part Found' : 'Waiting for QR scan...' }}
                    </v-card-title>
                    <v-divider />
                    <v-card-text v-if="qcSelectedRecord" class="pt-3">
                        <v-simple-table dense>
                            <tbody>
                                <tr><td class="font-weight-bold" width="150">QR Code</td><td>{{ qcSelectedRecord.qr_code }}</td></tr>
                                <tr><td class="font-weight-bold">Printer</td><td>{{ qcSelectedRecord.printer_hostname }}</td></tr>
                                <tr><td class="font-weight-bold">Model</td><td>{{ qcSelectedRecord.printer_model || '—' }}</td></tr>
                                <tr><td class="font-weight-bold">Filename</td><td>
                                    {{ qcSelectedRecord.filename || '—' }}
                                    <v-btn
                                        v-if="qcSelectedRecord.gcode_archive_hash && !qcSelectedRecord.gcode_archive_hash.startsWith('deleted:')"
                                        x-small icon class="ml-1"
                                        title="Download archived gcode"
                                        @click="downloadArchivedGcode(qcSelectedRecord)"
                                    >
                                        <v-icon x-small>{{ mdiDownload }}</v-icon>
                                    </v-btn>
                                    <v-chip
                                        v-if="qcSelectedRecord.gcode_archive_hash && qcSelectedRecord.gcode_archive_hash.startsWith('deleted:')"
                                        x-small color="error" dark class="ml-1"
                                    >
                                        file deleted
                                    </v-chip>
                                </td></tr>
                                <tr><td class="font-weight-bold">Filament</td><td>{{ qcSelectedRecord.filament_type || '—' }}</td></tr>
                                <tr><td class="font-weight-bold">Status</td><td>
                                    <v-chip x-small :color="statusColor(qcSelectedRecord.status)" dark>{{ qcSelectedRecord.status || 'unknown' }}</v-chip>
                                </td></tr>
                                <tr><td class="font-weight-bold">Start Time</td><td>{{ formatDate(qcSelectedRecord.start_time) }}</td></tr>
                                <tr><td class="font-weight-bold">End Time</td><td>{{ qcSelectedRecord.status === 'in_progress' ? 'In Progress' : formatDate(qcSelectedRecord.end_time) }}</td></tr>
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
                    <v-card-text v-else class="d-flex flex-column align-center justify-center" style="min-height: 200px">
                        <v-icon size="80" color="grey lighten-1">{{ mdiQrcodeScan }}</v-icon>
                        <p class="text-h6 grey--text mt-4">Scan a part QR code to begin</p>
                    </v-card-text>
                </v-card>
            </v-card-text>
        </v-card>

        <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="2500" top>
            {{ snackbarText }}
        </v-snackbar>
    </v-dialog>
</template>

<script lang="ts">
/**
 * QC Mode — standalone fullscreen scanning dialog.
 *
 * Shared by the full Mainsail Parts panel and the Scanner Lite entry.
 * Open it with v-model. Focus/keyboard warm-up happens in `confirmInspector`
 * (a real tap), so the host does not need to call `warmScanKeyboard()`.
 * Emits `closed` after the dialog closes so the host can refresh its lists.
 *
 * Needs the `fleet/history` store module (fetchInspectors, searchByQrCode,
 * updateQC) and the `gui/fleetDaemonUrl` getter for gcode downloads.
 */
import Vue from 'vue'
import Component from 'vue-class-component'
import { Prop, Watch } from 'vue-property-decorator'
import { mdiQrcodeScan, mdiClose, mdiAccountCheck, mdiCamera, mdiDownload } from '@mdi/js'
import { FleetHistoryRecord } from '@/store/fleet/history/types'
import { ScanBurstDetector, takeScanInput, resolveScanInputEl } from '@/plugins/scanBurstDetector'
import { warmScanKeyboard } from '@/plugins/scanFocus'
import { flashScreen } from '@/plugins/scanFlash'

@Component
export default class QcScanMode extends Vue {
    @Prop({ type: Boolean, default: false }) readonly value!: boolean
    @Prop({ type: Boolean, default: false }) readonly devMode!: boolean
    @Prop({ type: Boolean, default: false }) readonly isMobile!: boolean

    mdiQrcodeScan = mdiQrcodeScan
    mdiClose = mdiClose
    mdiAccountCheck = mdiAccountCheck
    mdiCamera = mdiCamera
    mdiDownload = mdiDownload

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

    // Mobile camera scanning
    qcCameraProcessing = false
    qcManualCode = ''

    qcBurst: ScanBurstDetector | null = null
    qcManualBurst: ScanBurstDetector | null = null

    snackbar = false
    snackbarText = ''
    snackbarColor = 'success'

    created() {
        this.qcBurst = new ScanBurstDetector((value) => {
            this.qcScanBuffer = value
            this.processScan()
        })
        this.qcManualBurst = new ScanBurstDetector((value) => {
            this.qcManualCode = value
            this.submitManualCode()
        })
    }

    beforeDestroy() {
        this.stopDetectors()
        if (this.qcFlashTimer) clearTimeout(this.qcFlashTimer)
    }

    @Watch('value')
    onValueChange(open: boolean) {
        if (open) this.onOpen()
        else this.onClose()
    }

    stopDetectors() {
        this.qcBurst?.unwatch()
        this.qcBurst?.reset()
        this.qcManualBurst?.unwatch()
        this.qcManualBurst?.reset()
    }

    async onOpen() {
        this.stopDetectors()
        this.qcStep = 'inspector'
        this.qcInspector = ''
        this.qcSelectedRecord = null
        this.qcStatusMessage = ''
        this.qcScanBuffer = ''
        this.qcNoteVisible = false
        this.qcNoteText = ''

        this.qcInspectorsLoading = true
        try {
            this.qcInspectorList = await this.$store.dispatch('fleet/history/fetchInspectors')
        } catch {
            this.qcInspectorList = []
        } finally {
            this.qcInspectorsLoading = false
        }
    }

    onClose() {
        this.stopDetectors()
        this.qcStep = 'inspector'
        this.qcSelectedRecord = null
        this.qcScanBuffer = ''
        this.qcStatusMessage = ''
    }

    exitQcMode() {
        this.$emit('input', false)
        this.$emit('closed')
    }

    get fleetDaemonUrl(): string {
        return this.$store.getters['gui/fleetDaemonUrl']
    }

    showSnackbar(text: string, color: string) {
        this.snackbarText = text
        this.snackbarColor = color
        this.snackbar = true
    }

    onQcScanInput(event: Event) {
        this.qcBurst?.onInput((event.target as HTMLInputElement).value)
    }

    onQcManualInput(value: string) {
        this.qcManualBurst?.onInput(value)
    }

    confirmInspector() {
        if (!this.qcInspector) return
        warmScanKeyboard() // synchronous, inside the tap gesture
        this.qcStep = 'scanning'
        this.$nextTick(() => this.refocusScanInput())
        // Poll the fields so detection works even if no input events reach us
        this.qcBurst?.watch(() => resolveScanInputEl(this.$refs.qcScanInput)?.value ?? '')
        this.qcManualBurst?.watch(() => resolveScanInputEl(this.$refs.qcManualInput)?.value ?? '')
    }

    onQcCardClick(e: MouseEvent) {
        // Don't steal focus if clicking on an input/button/textarea or a Vuetify control
        const el = e.target as HTMLElement
        if (el.closest('input, textarea, button, .v-input, .v-btn, .v-list-item, .v-menu')) return
        if (this.qcNoteVisible) return
        this.refocusScanInput()
    }

    onQcScanBlur(e: FocusEvent) {
        // Focus moved to another control (e.g. the manual field on mobile) — leave it alone
        const t = e.relatedTarget as HTMLElement | null
        if (t && t.closest('input, textarea, select, button, .v-input, .v-btn')) return
        this.refocusScanInput()
    }

    refocusScanInput() {
        this.$nextTick(() => {
            // Don't steal focus when the QC note field is active
            if (this.qcNoteVisible) return
            const input = this.$refs.qcScanInput as HTMLInputElement | undefined
            if (input && this.value && this.qcStep === 'scanning') {
                input.focus()
            }
        })
    }

    async processScan() {
        this.qcBurst?.reset()
        const scanned = takeScanInput(this.$refs.qcScanInput, this.qcScanBuffer)
        this.qcScanBuffer = ''
        if (!scanned) return

        // Check if it's a pass/fail code (plain "1"/"0")
        if (scanned === '1' || scanned === '0') {
            if (!this.qcSelectedRecord) return
            await this.submitQcResult(scanned === '1' ? 'pass' : 'fail')
            return
        }

        // Check for #1 or #0 prefix
        const prefixMatch = scanned.match(/^#([01])(.+)$/)
        if (prefixMatch && (prefixMatch[2] === '0' || prefixMatch[2] === '1')) {
            this.qcStatusMessage = 'Pass/Fail codes should not be scanned with the QC scanner. Use the standard scanner instead.'
            this.qcStatusType = 'warning'
            flashScreen('error')
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
                    this.qcStatusMessage = `No part found for QR code: ${qrCode}`
                    this.qcStatusType = 'warning'
                    flashScreen('error')
                }
            } catch {
                this.qcStatusMessage = `Error searching for QR code: ${qrCode}`
                this.qcStatusType = 'error'
                flashScreen('error')
            }
            this.refocusScanInput()
            return
        }

        // Otherwise treat as a part QR code
        this.qcStatusMessage = ''
        this.qcNoteVisible = false
        this.qcNoteText = ''
        try {
            const record = await this.$store.dispatch('fleet/history/searchByQrCode', scanned)
            if (record) {
                this.qcSelectedRecord = record
                this.qcStatusMessage = `Found part: ${record.qr_code} (${record.filename || record.printer_hostname})`
                this.qcStatusType = 'info'
                flashScreen('success')
            } else {
                this.qcSelectedRecord = null
                this.qcStatusMessage = `No part found for QR code: ${scanned}`
                this.qcStatusType = 'warning'
                flashScreen('error')
            }
        } catch {
            this.qcStatusMessage = `Error searching for QR code: ${scanned}`
            this.qcStatusType = 'error'
            flashScreen('error')
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
            const updated = await this.$store.dispatch('fleet/history/searchByQrCode', this.qcSelectedRecord.qr_code)
            if (updated) this.qcSelectedRecord = updated

            this.qcStatusMessage = `QC ${result.toUpperCase()} recorded for ${this.qcSelectedRecord?.qr_code}`
            this.qcStatusType = result === 'pass' ? 'success' : 'error'
            this.qcFlashResult = result
            this.qcFlashVisible = true
            flashScreen(result === 'pass' ? 'success' : 'error')
            if (this.qcFlashTimer) clearTimeout(this.qcFlashTimer)
            this.qcFlashTimer = setTimeout(() => { this.qcFlashVisible = false }, 2000)
            this.qcNoteVisible = true
            this.qcNoteText = ''
        } catch {
            this.qcStatusMessage = 'Failed to update QC status'
            this.qcStatusType = 'error'
            flashScreen('error')
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
        this.qcNoteVisible = false
        this.qcNoteText = ''
        this.refocusScanInput()
    }

    // ---- Mobile camera scanning ----

    openCameraCapture() {
        const input = this.$refs.qcCameraInput as HTMLInputElement | undefined
        if (input) {
            input.value = ''
            input.click()
        }
    }

    async submitManualCode() {
        this.qcManualBurst?.reset()
        const code = takeScanInput(this.$refs.qcManualInput, this.qcManualCode)
        this.qcManualCode = ''
        if (!code) return
        this.qcScanBuffer = code
        await this.processScan()
    }

    async onCameraCapture(e: Event) {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return
        this.qcCameraProcessing = true
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
                this.qcScanBuffer = results[0].text
                await this.processScan()
            } else {
                this.qcStatusMessage = 'No code found in photo. Ensure the Data Matrix is clearly visible and well-lit.'
                this.qcStatusType = 'warning'
                flashScreen('error')
            }
        } catch {
            this.qcStatusMessage = 'Failed to process photo. Please try again.'
            this.qcStatusType = 'error'
            flashScreen('error')
        } finally {
            this.qcCameraProcessing = false
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

    formatDate(iso: string | null): string {
        if (!iso) return '—'
        return new Date(iso).toLocaleString()
    }

    downloadArchivedGcode(record: any) {
        if (!record.gcode_archive_hash) return
        const url = `${this.fleetDaemonUrl}/archive/file/${record.gcode_archive_hash}`
        window.open(url)
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
.qc-mobile-scanning {
    overflow-y: auto;
}
</style>
