<template>
    <v-dialog :value="value" fullscreen persistent no-click-animation>
        <v-card class="d-flex flex-column" style="height: 100vh; transition: background-color 0.3s ease" :style="{ backgroundColor: addSpoolCardColor }" @click="onAddSpoolCardClick">
            <!-- Header -->
            <v-card-title class="d-flex align-center py-2">
                <v-icon left color="primary">{{ mdiQrcodeScan }}</v-icon>
                <span>Add Spool Mode</span>
                <v-chip v-if="!addSpoolReady" small class="ml-3" color="warning" outlined>Select filament first</v-chip>
                <v-chip v-else-if="addSpoolPendingQr" small class="ml-3" color="info" outlined>QR {{ addSpoolPendingQr }} — scan batch/lot label</v-chip>
                <v-chip v-else small class="ml-3" color="success" outlined>Ready — scan spool QR</v-chip>
                <v-spacer />
                <v-btn icon @click="exitAddSpoolMode">
                    <v-icon>{{ mdiClose }}</v-icon>
                </v-btn>
            </v-card-title>
            <v-divider />

            <v-card-text class="d-flex flex-column flex-grow-1 pa-4" style="overflow-y: auto">
                <!-- Touch devices: visible scan box the user can tap to wake the keyboard -->
                <v-text-field
                    v-if="isTouch"
                    ref="addSpoolScanInput"
                    v-model="addSpoolScanBuffer"
                    label="Scan here"
                    autocomplete="off"
                    autocorrect="off"
                    autocapitalize="off"
                    spellcheck="false"
                    dense
                    outlined
                    hide-details
                    class="mb-4"
                    :prepend-inner-icon="mdiQrcodeScan"
                    @input="onAddSpoolScanFieldInput"
                    @keydown.enter="processAddSpoolScan"
                    @focus="addSpoolScanFocused = true"
                    @blur="addSpoolScanFocused = false"
                />
                <!-- Desktop: hidden scan input -->
                <input
                    v-else
                    ref="addSpoolScanInput"
                    v-model="addSpoolScanBuffer"
                    class="scan-hidden-input"
                    autocomplete="off"
                    autocorrect="off"
                    autocapitalize="off"
                    spellcheck="false"
                    autofocus
                    @input="onAddSpoolScanInput"
                    @keydown.enter="processAddSpoolScan"
                    @focus="addSpoolScanFocused = true"
                    @blur="addSpoolScanFocused = false"
                />

                <!-- Status alert -->
                <v-alert
                    v-if="addSpoolStatusMessage"
                    :type="addSpoolStatusType"
                    dense
                    class="mb-4"
                    dismissible
                    @input="addSpoolStatusMessage = ''"
                >
                    {{ addSpoolStatusMessage }}
                </v-alert>
                <p v-if="devMode" class="caption orange--text mb-2" style="font-family: monospace">
                    scan: {{ addSpoolBurst ? addSpoolBurst.trace : 'no detector' }} | focused={{ addSpoolScanFocused }} | buffer="{{ addSpoolScanBuffer }}"
                </p>

                <!-- Top: Preset form -->
                <v-card outlined class="mb-4">
                    <v-card-title class="subtitle-2 py-2">Spool Preset</v-card-title>
                    <v-divider />
                    <v-card-text class="pt-3">
                        <v-row dense>
                            <v-col cols="12" sm="6">
                                <v-select
                                    v-model="addSpoolForm.filament_id"
                                    :items="filamentItems"
                                    label="Filament *"
                                    dense outlined hide-details
                                    :rules="[v => v != null || 'Required']"
                                />
                            </v-col>
                            <v-col cols="12" sm="6">
                                <v-text-field v-model="addSpoolForm.location" label="Location" dense outlined hide-details />
                            </v-col>
                        </v-row>
                        <v-row dense>
                            <v-col cols="6">
                                <v-text-field v-model.number="addSpoolForm.initial_weight" label="Initial (g)" dense outlined hide-details type="number" />
                            </v-col>
                            <v-col cols="6">
                                <v-text-field v-model.number="addSpoolForm.spool_weight" label="Empty spool (g)" dense outlined hide-details type="number" />
                            </v-col>
                        </v-row>
                        <v-row dense>
                            <v-col cols="12">
                                <v-text-field v-model="addSpoolForm.comment" label="Comment" dense outlined hide-details />
                            </v-col>
                        </v-row>
                        <p class="caption grey--text mt-2 mb-0">
                            Scan the spool QR code, then the batch label. The QR becomes the spool identifier; the batch number becomes the lot #.
                        </p>
                    </v-card-text>
                </v-card>

                <!-- Bottom: Existing spools table (click to prefill) -->
                <v-card outlined class="flex-grow-1">
                    <v-card-title class="subtitle-2 py-2">
                        Existing Spools
                        <span class="caption grey--text ml-2">(click a row to prefill the form above)</span>
                    </v-card-title>
                    <v-divider />
                    <v-data-table
                        :headers="addSpoolTableHeaders"
                        :items="spools"
                        dense
                        sort-by="id"
                        :sort-desc="true"
                        :items-per-page="25"
                        :footer-props="{ 'items-per-page-options': [25, 50, 100] }"
                        class="spool-table"
                        @click:row="prefillFromSpool"
                    >
                        <template #item.color_hex="{ item }">
                            <div
                                v-if="item.color_hex"
                                :style="{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#' + item.color_hex, border: '1px solid rgba(255,255,255,0.3)', display: 'inline-block' }"
                            />
                            <span v-else>—</span>
                        </template>
                        <template #item.filament_label="{ item }">
                            {{ [item.vendor_name, item.filament_name].filter(Boolean).join(' — ') || item.material }}
                        </template>
                        <template #item.initial_weight="{ item }">
                            {{ item.initial_weight != null ? item.initial_weight.toFixed(0) + ' g' : '—' }}
                        </template>
                        <template #item.remaining_weight="{ item }">
                            {{ item.remaining_weight != null ? item.remaining_weight.toFixed(0) + ' g' : '—' }}
                        </template>
                        <template #item.loaded_on_printer="{ item }">
                            <v-chip v-if="item.loaded_on_printer" x-small color="success" dark>{{ item.loaded_on_printer }}</v-chip>
                            <v-chip v-else-if="item.in_oven" x-small :color="item.is_ready ? 'light-blue darken-1' : 'amber darken-2'" dark>
                                {{ (item.in_oven || '').replace(/\.local$/i, '') }}<template v-if="item.oven_row != null"> · R{{ item.oven_row }}S{{ item.oven_slot }}</template>
                            </v-chip>
                            <span v-else>—</span>
                        </template>
                    </v-data-table>
                </v-card>
            </v-card-text>
        </v-card>
    </v-dialog>
</template>

<script lang="ts">
/**
 * Add Spool Mode — standalone fullscreen scanning dialog.
 *
 * Shared by the full Mainsail Spools panel and the Scanner Lite entry.
 * Open it with v-model; the host must call `warmScanKeyboard()` synchronously
 * inside the tap that opens it (see plugins/scanFocus.ts). Emits `closed`
 * after the dialog closes so the host can refresh its own lists.
 *
 * Needs the `fleet/spools` store module (spools + filaments loaded).
 */
import Vue from 'vue'
import Component from 'vue-class-component'
import { Prop, Watch } from 'vue-property-decorator'
import { mdiClose, mdiQrcodeScan } from '@mdi/js'
import { FleetSpool, FleetFilament } from '@/store/fleet/spools/types'
import { ScanBurstDetector, takeScanInput, resolveScanInputEl } from '@/plugins/scanBurstDetector'
import { isTouchDevice } from '@/plugins/scanFocus'
import { flashScreen } from '@/plugins/scanFlash'

@Component
export default class AddSpoolScanMode extends Vue {
    @Prop({ type: Boolean, default: false }) readonly value!: boolean
    @Prop({ type: Boolean, default: false }) readonly devMode!: boolean

    mdiClose = mdiClose
    mdiQrcodeScan = mdiQrcodeScan

    addSpoolScanBuffer = ''
    addSpoolStatusMessage = ''
    addSpoolStatusType: 'success' | 'error' | 'warning' | 'info' = 'info'
    addSpoolSaving = false
    addSpoolScanFocused = false
    addSpoolPendingQr: string | null = null
    addSpoolFlash: 'success' | 'error' | null = null
    addSpoolFlashTimer: ReturnType<typeof setTimeout> | null = null
    addSpoolForm = this.emptyAddSpoolForm()
    /** Auto-submits scanner bursts that arrive without a trailing Enter (set in created). */
    addSpoolBurst: ScanBurstDetector | null = null

    readonly addSpoolTableHeaders = [
        { text: 'ID', value: 'id', sortable: true },
        { text: '', value: 'color_hex', sortable: false },
        { text: 'QR Code', value: 'qr_code', sortable: true },
        { text: 'Filament', value: 'filament_label', sortable: false },
        { text: 'Material', value: 'material', sortable: true },
        { text: 'Initial', value: 'initial_weight', sortable: true },
        { text: 'Remaining', value: 'remaining_weight', sortable: true },
        { text: 'Lot #', value: 'lot_nr', sortable: true },
        { text: 'Placement', value: 'loaded_on_printer', sortable: true },
    ]

    created() {
        this.addSpoolBurst = new ScanBurstDetector((value) => {
            this.addSpoolScanBuffer = value
            this.processAddSpoolScan()
        })
    }

    beforeDestroy() {
        this.addSpoolBurst?.unwatch()
        this.addSpoolBurst?.reset()
    }

    @Watch('value')
    onValueChange(open: boolean) {
        if (open) this.onOpen()
        else this.onClose()
    }

    // --- store ---

    get spools(): FleetSpool[] {
        return this.$store.getters['fleet/spools/getSpools']
    }

    get filaments(): FleetFilament[] {
        return this.$store.getters['fleet/spools/getFilaments']
    }

    get filamentItems() {
        return this.filaments.map((f) => {
            const vendor = f.vendor_name || ''
            const name = f.name || ''
            const label = [vendor, name, `(${f.material})`].filter(Boolean).join(' — ')
            return { text: `#${f.id} ${label}`, value: f.id }
        })
    }

    // --- state ---

    get isTouch(): boolean {
        return isTouchDevice()
    }

    get addSpoolReady(): boolean {
        return this.addSpoolForm.filament_id != null
    }

    get addSpoolCardColor(): string | undefined {
        if (this.addSpoolFlash === 'success') return '#2E7D32'
        if (this.addSpoolFlash === 'error') return '#C62828'
        if (this.addSpoolScanFocused && this.addSpoolReady) return '#1B5E20'
        return undefined
    }

    emptyAddSpoolForm() {
        return {
            filament_id: null as number | null,
            initial_weight: null as number | null,
            spool_weight: null as number | null,
            location: '',
            comment: '',
        }
    }

    focusAddSpoolScanInput() {
        this.$nextTick(() => {
            const input = this.$refs.addSpoolScanInput as HTMLInputElement | undefined
            if (input) input.focus()
        })
    }

    flashAddSpool(kind: 'success' | 'error') {
        flashScreen(kind)
        this.addSpoolFlash = kind
        if (this.addSpoolFlashTimer) clearTimeout(this.addSpoolFlashTimer)
        this.addSpoolFlashTimer = setTimeout(() => {
            this.addSpoolFlash = null
            this.addSpoolFlashTimer = null
        }, 1500)
    }

    onAddSpoolScanInput(event: Event) {
        this.addSpoolBurst?.onInput((event.target as HTMLInputElement).value)
    }

    onAddSpoolScanFieldInput(value: string) {
        this.addSpoolBurst?.onInput(value)
    }

    resetAddSpoolScanState() {
        this.addSpoolBurst?.reset()
        this.addSpoolScanBuffer = ''
        this.addSpoolStatusMessage = ''
        this.addSpoolPendingQr = null
        this.addSpoolFlash = null
        if (this.addSpoolFlashTimer) {
            clearTimeout(this.addSpoolFlashTimer)
            this.addSpoolFlashTimer = null
        }
    }

    onOpen() {
        this.addSpoolForm = this.emptyAddSpoolForm()
        this.resetAddSpoolScanState()
        this.focusAddSpoolScanInput()
        // Poll the field so detection works even if no input events reach us
        this.addSpoolBurst?.watch(() => resolveScanInputEl(this.$refs.addSpoolScanInput)?.value ?? '')
    }

    onClose() {
        this.addSpoolBurst?.unwatch()
        this.resetAddSpoolScanState()
    }

    exitAddSpoolMode() {
        this.$emit('input', false)
        this.$emit('closed')
    }

    onAddSpoolCardClick(event: MouseEvent) {
        const target = event.target as HTMLElement
        // Don't steal focus from form inputs, selects, buttons, or table rows
        if (target.closest('input, textarea, select, button, .v-input, .v-select, .v-btn, .v-data-table, .v-menu')) return
        const input = this.$refs.addSpoolScanInput as HTMLInputElement | undefined
        if (input) input.focus()
    }

    prefillFromSpool(spool: FleetSpool) {
        this.addSpoolForm.filament_id = spool.filament_id
        this.addSpoolForm.initial_weight = spool.initial_weight
        this.addSpoolForm.spool_weight = spool.spool_weight
        this.addSpoolForm.location = spool.location || ''
        this.addSpoolForm.comment = spool.comment || ''
        this.addSpoolStatusMessage = `Preset filled from spool #${spool.id} (${spool.material})`
        this.addSpoolStatusType = 'info'
        this.focusAddSpoolScanInput()
    }

    reloadSpools() {
        this.$store.dispatch('fleet/spools/loadSpools').catch(() => {})
    }

    /**
     * Two-step scan flow:
     *   1. A plain scan (no ':') is the spool QR. It becomes the pending QR,
     *      replacing any earlier pending QR that was never paired with a lot#.
     *   2. A scan containing ':' (e.g. "Batch No:12345") is the batch label.
     *      Everything up to and including the first ':' is stripped; the rest
     *      is the lot#. The pending QR + lot# create the spool.
     */
    async processAddSpoolScan() {
        this.addSpoolBurst?.reset()
        const scanned = takeScanInput(this.$refs.addSpoolScanInput, this.addSpoolScanBuffer)
        this.addSpoolScanBuffer = ''
        if (!scanned) return

        if (!this.addSpoolReady) {
            this.addSpoolStatusMessage = 'Select a filament first before scanning'
            this.addSpoolStatusType = 'warning'
            this.flashAddSpool('error')
            this.focusAddSpoolScanInput()
            return
        }

        const colonIdx = scanned.indexOf(':')
        const isLotScan = colonIdx >= 0

        if (!isLotScan) {
            // QR scan: (re)arm the pending QR and wait for the batch label
            this.addSpoolPendingQr = scanned
            this.addSpoolStatusMessage = `QR ${scanned} captured — now scan the batch/lot label`
            this.addSpoolStatusType = 'info'
            flashScreen('success')
            this.focusAddSpoolScanInput()
            return
        }

        const lotNr = scanned.slice(colonIdx + 1).trim()
        if (!this.addSpoolPendingQr) {
            this.addSpoolStatusMessage = 'Scan the spool QR code first, then the batch label'
            this.addSpoolStatusType = 'warning'
            this.flashAddSpool('error')
            this.focusAddSpoolScanInput()
            return
        }
        if (!lotNr) {
            this.addSpoolStatusMessage = `Batch label "${scanned}" has no lot number after ':' — rescan the label`
            this.addSpoolStatusType = 'warning'
            this.flashAddSpool('error')
            this.focusAddSpoolScanInput()
            return
        }

        if (this.addSpoolSaving) return
        this.addSpoolSaving = true
        const qrCode = this.addSpoolPendingQr

        try {
            const toNum = (v: any) => (v === '' || v === null || v === undefined || Number.isNaN(v)) ? null : Number(v)
            const payload: any = {
                filament_id: this.addSpoolForm.filament_id,
                qr_code: qrCode,
                initial_weight: toNum(this.addSpoolForm.initial_weight),
                used_weight: 0,
                spool_weight: toNum(this.addSpoolForm.spool_weight),
                location: this.addSpoolForm.location || null,
                lot_nr: lotNr,
                comment: this.addSpoolForm.comment || null,
            }
            await this.$store.dispatch('fleet/spools/createSpool', payload)
            this.addSpoolStatusMessage = `Spool created — QR: ${qrCode}, Lot #: ${lotNr}`
            this.addSpoolStatusType = 'success'
            this.flashAddSpool('success')
            this.reloadSpools()
        } catch (err: any) {
            this.addSpoolStatusMessage = err?.message || 'Failed to create spool'
            this.addSpoolStatusType = 'error'
            this.flashAddSpool('error')
        } finally {
            // Either way the pair is consumed; next spool starts with a fresh QR scan
            this.addSpoolPendingQr = null
            this.addSpoolSaving = false
            this.focusAddSpoolScanInput()
        }
    }
}
</script>

<style scoped>
.spool-table tbody tr {
    cursor: pointer;
}
.scan-hidden-input {
    position: absolute;
    left: -9999px;
    opacity: 0;
    width: 1px;
    height: 1px;
}
</style>
