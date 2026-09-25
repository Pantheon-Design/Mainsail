<template>
    <v-dialog :value="value" fullscreen persistent no-click-animation>
        <v-card class="d-flex flex-column" style="height: 100vh; transition: background-color 0.3s ease" :style="{ backgroundColor: cardColor }" @click="onCardClick">
            <!-- Header -->
            <v-card-title class="d-flex align-center py-2">
                <v-icon left color="primary">{{ mdiTrayArrowDown }}</v-icon>
                <span>Load Spool</span>
                <v-spacer />
                <v-btn icon @click="exit">
                    <v-icon>{{ mdiClose }}</v-icon>
                </v-btn>
            </v-card-title>

            <!-- Persistent feedback banner (stays until the next result) -->
            <div
                v-if="banner"
                class="d-flex align-center px-4 py-2"
                :style="{ background: banner.kind === 'success' ? '#2E7D32' : '#C62828', color: 'white' }"
            >
                <v-icon color="white" class="mr-3">{{ banner.kind === 'success' ? mdiCheckCircle : mdiAlertCircle }}</v-icon>
                <span class="subtitle-1 font-weight-bold">{{ banner.text }}</span>
            </div>
            <p v-if="devMode" class="caption orange--text px-4 my-1" style="font-family: monospace">
                scan: {{ burst ? burst.trace : 'no detector' }} | focused={{ scanFocused }} | buffer="{{ scanBuffer }}" | phase={{ phase }} | relay={{ relay ? relay.status : '-' }}
            </p>
            <v-divider />

            <!-- Step chips -->
            <div class="d-flex align-center px-4 py-2" style="gap: 8px; flex-wrap: wrap">
                <v-chip small :color="spool ? 'success' : 'grey'" :outlined="!spool" dark>
                    <v-icon small left>{{ spool ? mdiCheckCircle : mdiSpoolIcon }}</v-icon>
                    {{ spool ? `Spool ${spoolQr}` : 'Spool — scan QR' }}
                </v-chip>
                <v-chip small :color="printerHost ? 'success' : 'grey'" :outlined="!printerHost" dark>
                    <v-icon small left>{{ printerHost ? mdiCheckCircle : mdiPrinter3d }}</v-icon>
                    {{ printerHost ? printerHost : 'Printer — scan hostname' }}
                </v-chip>
            </div>

            <!-- Visible scan input (all layouts) -->
            <div class="d-flex align-center px-4 py-2" style="background: rgba(255,255,255,0.03)">
                <v-text-field
                    ref="scanInput"
                    v-model="scanBuffer"
                    :label="scanLabel"
                    placeholder="spool QR or printer1.local"
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
                    :disabled="busy"
                    @input="onScanInput"
                    @keydown.enter="processScan"
                    @focus="scanFocused = true"
                    @blur="scanFocused = false"
                >
                    <template #append>
                        <v-btn icon small :disabled="!scanBuffer.trim() || busy" title="Submit" @click="processScan">
                            <v-icon small>{{ mdiSend }}</v-icon>
                        </v-btn>
                    </template>
                </v-text-field>
                <template v-if="isMobile">
                    <input ref="cameraInput" type="file" accept="image/*" capture="environment" class="scan-hidden-input" @change="onCameraCapture" />
                    <v-btn icon large class="ml-2" color="primary" title="Scan with camera" :loading="cameraProcessing" :disabled="busy" @click="openCamera">
                        <v-icon>{{ mdiCamera }}</v-icon>
                    </v-btn>
                </template>
            </div>
            <v-divider />

            <!-- Body -->
            <v-card-text class="d-flex flex-column flex-grow-1 pa-4" style="overflow-y: auto">
                <!-- Spool card -->
                <v-card v-if="spool" outlined class="mb-4">
                    <v-card-text class="d-flex align-center py-3">
                        <div
                            class="mr-4 flex-shrink-0"
                            :style="{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                backgroundColor: spool.filament.color_hex ? '#' + spool.filament.color_hex : 'transparent',
                                border: '1px solid rgba(255,255,255,0.3)',
                            }"
                        />
                        <div class="flex-grow-1">
                            <div class="text-h6" style="line-height: 1.2">{{ spoolLabel }}</div>
                            <div class="caption grey--text">
                                {{ spool.filament.material }}
                                <template v-if="spool.remaining_weight != null"> · {{ spool.remaining_weight.toFixed(0) }} g left</template>
                                <template v-if="spool.lot_nr"> · lot {{ spool.lot_nr }}</template>
                            </div>
                            <div class="mt-1" style="gap: 6px; display: flex; flex-wrap: wrap">
                                <v-chip v-if="spool.loaded_on_printer" x-small color="success" dark>on {{ spool.loaded_on_printer }}</v-chip>
                                <v-chip v-else-if="spool.in_oven" x-small :color="spool.is_ready ? 'light-blue darken-1' : 'amber darken-2'" dark>
                                    oven {{ (spool.in_oven || '').replace(/\.local$/i, '') }}<template v-if="spool.oven_row != null"> · R{{ spool.oven_row }}S{{ spool.oven_slot }}</template>
                                </v-chip>
                            </div>
                        </div>
                        <v-btn icon small title="Clear spool" :disabled="busy" @click="clearSpool">
                            <v-icon small>{{ mdiClose }}</v-icon>
                        </v-btn>
                    </v-card-text>
                </v-card>

                <!-- Status area -->
                <div class="d-flex flex-column align-center justify-center flex-grow-1" style="min-height: 200px">
                    <template v-if="phase === 'scan'">
                        <v-icon size="72" color="success">{{ mdiQrcodeScan }}</v-icon>
                        <p class="text-h6 mt-4 success--text text-center">{{ scanPrompt }}</p>
                        <p class="caption grey--text text-center">
                            Scans ending in <code>.local</code> are printers, anything else is a spool QR.<br />
                            The printer must be a fleet worker with its Set Filament / Load dialog open.
                        </p>
                        <v-btn v-if="spool && printerHost" color="primary" large class="mt-2" @click="send">
                            <v-icon left>{{ mdiSend }}</v-icon>
                            Send to {{ printerHost }}
                        </v-btn>
                    </template>

                    <template v-else-if="phase === 'sending'">
                        <v-progress-circular indeterminate color="primary" size="64" width="4" />
                        <p class="text-h6 mt-4 grey--text">Sending to {{ printerHost }}…</p>
                    </template>

                    <template v-else-if="phase === 'waiting'">
                        <v-progress-circular indeterminate :color="relayListening ? 'success' : 'warning'" size="64" width="4" />
                        <p class="text-h6 mt-4 text-center" :class="relayListening ? 'success--text' : 'warning--text'">
                            {{ waitingText }}
                        </p>
                        <p v-if="!relayListening" class="caption warning--text text-center">
                            {{ printerHost }} is not waiting for a scan.<br />
                            On the printer, tap <b>Set Filament</b> or <b>Load</b> — the scan is kept for 2 minutes.
                        </p>
                        <p v-else class="caption grey--text text-center">Confirm or cancel on the printer screen.</p>
                        <v-btn text color="grey" class="mt-2" @click="withdraw">Withdraw</v-btn>
                    </template>

                    <template v-else-if="phase === 'done'">
                        <v-icon size="72" color="success">{{ mdiCheckCircle }}</v-icon>
                        <p class="text-h6 mt-4 success--text text-center">Loaded on {{ printerHost }}</p>
                        <v-btn color="primary" large class="mt-2" @click="resetForNext">
                            <v-icon left>{{ mdiQrcodeScan }}</v-icon>
                            Scan next
                        </v-btn>
                    </template>
                </div>

                <!-- Session log -->
                <v-card v-if="log.length" outlined class="mt-4">
                    <v-card-title class="subtitle-2 py-2">Session Log ({{ log.length }})</v-card-title>
                    <v-divider />
                    <v-list dense class="pa-0" style="max-height: 240px; overflow-y: auto">
                        <v-list-item v-for="(entry, idx) in log.slice().reverse()" :key="idx" dense>
                            <v-list-item-icon class="mr-2">
                                <v-icon small :color="entry.ok ? 'success' : 'error'">{{ entry.ok ? mdiCheckCircle : mdiAlertCircle }}</v-icon>
                            </v-list-item-icon>
                            <v-list-item-content>
                                <v-list-item-title class="font-weight-bold">{{ entry.hostname }} — {{ entry.spool }}</v-list-item-title>
                                <v-list-item-subtitle>{{ entry.detail }} &bull; {{ entry.time }}</v-list-item-subtitle>
                            </v-list-item-content>
                        </v-list-item>
                    </v-list>
                </v-card>
            </v-card-text>
        </v-card>
    </v-dialog>
</template>

<script lang="ts">
/**
 * Load Spool Mode — standalone fullscreen scanning dialog for Scanner Lite.
 *
 * Scan a spool QR and a printer hostname (either order: a scan ending in
 * `.local` is a printer, anything else is a spool QR). The pair is sent to
 * the fleet daemon (`POST /spool/scan-relay`), which hands it to that
 * printer's KlipperScreen while its worker "Waiting for scan" dialog is open.
 * The operator confirms on the printer; this dialog polls
 * `GET /spool/scan-relay/{hostname}` to show the outcome
 * (delivered / loaded / cancelled).
 *
 * Open it with v-model; the host must call `warmScanKeyboard()` synchronously
 * inside the tap that opens it. Needs the `fleet/spools` store module.
 */
import Vue from 'vue'
import Component from 'vue-class-component'
import { Prop, Watch } from 'vue-property-decorator'
import {
    mdiQrcodeScan,
    mdiClose,
    mdiCamera,
    mdiPrinter3d,
    mdiCheckCircle,
    mdiAlertCircle,
    mdiSend,
    mdiTrayArrowDown,
} from '@mdi/js'
import { mdiSpool } from '@/plugins/customIcons'
import { ScanBurstDetector, takeScanInput, resolveScanInputEl } from '@/plugins/scanBurstDetector'
import { flashScreen } from '@/plugins/scanFlash'
import { FleetSpoolLookup, FleetScanRelayRecord } from '@/store/fleet/spools/types'
import { FleetApiError } from '@/store/fleet/utils'

interface LoadLogEntry {
    hostname: string
    spool: string
    ok: boolean
    detail: string
    time: string
}

type Phase = 'scan' | 'sending' | 'waiting' | 'done'

const HOSTNAME_RE = /^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)*\.local$/
const POLL_MS = 2000
const POLL_TIMEOUT_MS = 90_000

@Component
export default class LoadSpoolScanMode extends Vue {
    @Prop({ type: Boolean, default: false }) readonly value!: boolean
    @Prop({ type: Boolean, default: false }) readonly devMode!: boolean
    @Prop({ type: Boolean, default: false }) readonly isMobile!: boolean

    mdiQrcodeScan = mdiQrcodeScan
    mdiClose = mdiClose
    mdiCamera = mdiCamera
    mdiPrinter3d = mdiPrinter3d
    mdiCheckCircle = mdiCheckCircle
    mdiAlertCircle = mdiAlertCircle
    mdiSend = mdiSend
    mdiTrayArrowDown = mdiTrayArrowDown
    mdiSpoolIcon = mdiSpool

    spool: FleetSpoolLookup | null = null
    spoolQr = ''
    printerHost = ''
    phase: Phase = 'scan'
    relay: FleetScanRelayRecord | null = null
    pollTimer: ReturnType<typeof setTimeout> | null = null
    pollStarted = 0
    lookingUp = false

    scanBuffer = ''
    scanFocused = false
    log: LoadLogEntry[] = []

    flash: 'success' | 'error' | null = null
    flashTimer: ReturnType<typeof setTimeout> | null = null
    banner: { kind: 'success' | 'error'; text: string } | null = null
    burst: ScanBurstDetector | null = null

    cameraProcessing = false

    created() {
        this.burst = new ScanBurstDetector((value) => {
            this.scanBuffer = value
            this.processScan()
        })
    }

    beforeDestroy() {
        this.burst?.unwatch()
        this.burst?.reset()
        this.stopPolling()
        if (this.flashTimer) clearTimeout(this.flashTimer)
    }

    @Watch('value')
    onValueChange(open: boolean) {
        if (open) this.onOpen()
        else this.onClose()
    }

    onOpen() {
        this.burst?.reset()
        this.resetForNext()
        this.log = []
        this.cameraProcessing = false
        this.resetFeedback()
        this.$nextTick(() => {
            this.burst?.watch(() => resolveScanInputEl(this.$refs.scanInput)?.value ?? '')
            this.refocusScanInput()
        })
    }

    onClose() {
        this.burst?.unwatch()
        this.burst?.reset()
        this.stopPolling()
        this.scanBuffer = ''
        this.resetFeedback()
    }

    exit() {
        if (this.phase === 'waiting' && this.printerHost) {
            this.$store.dispatch('fleet/spools/cancelLoadScan', this.printerHost).catch(() => {})
        }
        this.$emit('input', false)
        this.$emit('closed')
    }

    // ---- derived ----

    get busy(): boolean {
        return this.phase === 'sending' || this.lookingUp
    }

    get scanLabel(): string {
        if (!this.spool && !this.printerHost) return 'Scan spool QR or printer hostname'
        if (!this.spool) return 'Scan spool QR'
        if (!this.printerHost) return 'Scan printer hostname'
        return 'Scan again to replace'
    }

    get scanPrompt(): string {
        if (!this.spool && !this.printerHost) return 'Ready — scan a spool QR'
        if (!this.spool) return `Printer ${this.printerHost} — now scan a spool QR`
        if (!this.printerHost) return 'Spool ready — now scan the printer hostname'
        return 'Ready to send'
    }

    get spoolLabel(): string {
        if (!this.spool) return ''
        const f = this.spool.filament
        return [f.vendor?.name, f.name].filter(Boolean).join(' — ') || f.material
    }

    get relayListening(): boolean {
        return this.relay?.printer_listening ?? false
    }

    get waitingText(): string {
        if (this.relay?.status === 'delivered') return `Shown on ${this.printerHost} — confirm there`
        if (this.relayListening) return `Sent to ${this.printerHost} — waiting for the printer`
        return `Waiting for ${this.printerHost} to open the scan dialog`
    }

    // ---- feedback (flash + persistent banner) ----

    get cardColor(): string | undefined {
        if (this.flash === 'success') return '#2E7D32'
        if (this.flash === 'error') return '#C62828'
        return undefined
    }

    feedback(kind: 'success' | 'error', text: string) {
        flashScreen(kind)
        this.banner = { kind, text }
        this.flash = kind
        if (this.flashTimer) clearTimeout(this.flashTimer)
        this.flashTimer = setTimeout(() => {
            this.flash = null
            this.flashTimer = null
        }, 1500)
    }

    resetFeedback() {
        this.banner = null
        this.flash = null
        if (this.flashTimer) {
            clearTimeout(this.flashTimer)
            this.flashTimer = null
        }
    }

    // ---- scan input handling ----

    refocusScanInput() {
        this.$nextTick(() => {
            const field = this.$refs.scanInput as any
            if (field && this.value) {
                if (field.focus) field.focus()
                else if (field.$el) field.$el.querySelector('input')?.focus()
            }
        })
    }

    onCardClick(e: MouseEvent) {
        const el = e.target as HTMLElement
        if (el.closest('input, textarea, button, .v-input, .v-btn, .v-list-item, .v-chip')) return
        this.refocusScanInput()
    }

    onScanInput(value: string) {
        this.burst?.onInput(value)
    }

    async processScan() {
        this.burst?.reset()
        const scanned = takeScanInput(this.$refs.scanInput, this.scanBuffer)
        this.scanBuffer = ''
        if (!scanned) return
        await this.handleScan(scanned)
        this.refocusScanInput()
    }

    /** Route a scan to the printer or spool slot; send once both are filled. */
    async handleScan(raw: string) {
        const value = raw.trim()
        if (!value) return
        if (this.phase === 'sending') {
            this.feedback('error', 'Still sending — scan again in a moment')
            return
        }
        if (this.phase === 'waiting') {
            // A new scan while waiting withdraws the previous relay first.
            await this.withdraw(false)
        }
        if (this.phase === 'done') this.resetForNext()

        if (value.toLowerCase().endsWith('.local')) {
            const host = value.toLowerCase()
            if (!HOSTNAME_RE.test(host)) {
                this.feedback('error', `"${raw}" is not a valid printer hostname`)
                return
            }
            this.printerHost = host
            this.banner = null
        } else {
            this.lookingUp = true
            try {
                const spool: FleetSpoolLookup = await this.$store.dispatch('fleet/spools/lookupByQr', value)
                this.spool = spool
                this.spoolQr = value
                this.banner = null
            } catch (err: any) {
                const status = err instanceof FleetApiError ? err.status : null
                if (status === 404) this.feedback('error', `"${value}" is not a known spool QR`)
                else this.feedback('error', `Spool lookup failed: ${err?.message || 'request failed'}`)
                return
            } finally {
                this.lookingUp = false
            }
        }

        if (this.spool && this.printerHost) await this.send()
    }

    clearSpool() {
        this.spool = null
        this.spoolQr = ''
        this.refocusScanInput()
    }

    resetForNext() {
        this.stopPolling()
        this.spool = null
        this.spoolQr = ''
        this.printerHost = ''
        this.phase = 'scan'
        this.relay = null
        this.lookingUp = false
        this.refocusScanInput()
    }

    // ---- relay ----

    async send() {
        if (!this.spool || !this.printerHost || this.phase === 'sending') return
        const hostname = this.printerHost
        const qr = this.spoolQr
        this.phase = 'sending'
        this.banner = null
        try {
            const rec: FleetScanRelayRecord = await this.$store.dispatch('fleet/spools/relayLoadScan', {
                qr_code: qr,
                printer_hostname: hostname,
            })
            this.relay = rec
            this.phase = 'waiting'
            this.startPolling()
        } catch (err: any) {
            const msg = err?.message || 'request failed'
            this.feedback('error', `${hostname}: ${msg}`)
            this.log.push({ hostname, spool: this.spoolLabel, ok: false, detail: msg, time: this.now() })
            this.phase = 'scan'
        }
    }

    startPolling() {
        this.stopPolling()
        this.pollStarted = Date.now()
        this.pollTimer = setTimeout(() => this.poll(), POLL_MS)
    }

    stopPolling() {
        if (this.pollTimer) {
            clearTimeout(this.pollTimer)
            this.pollTimer = null
        }
    }

    async poll() {
        this.pollTimer = null
        if (this.phase !== 'waiting' || !this.printerHost) return
        const hostname = this.printerHost
        try {
            const rec: FleetScanRelayRecord = await this.$store.dispatch('fleet/spools/getLoadScanStatus', hostname)
            if (this.phase !== 'waiting' || this.printerHost !== hostname) return
            this.relay = rec
            if (rec.status === 'loaded') {
                this.feedback('success', `${hostname}: ${this.spoolLabel} loaded`)
                this.log.push({ hostname, spool: this.spoolLabel, ok: true, detail: 'loaded', time: this.now() })
                this.phase = 'done'
                return
            }
            if (rec.status === 'cancelled') {
                this.feedback('error', `${hostname}: cancelled on the printer`)
                this.log.push({ hostname, spool: this.spoolLabel, ok: false, detail: 'cancelled on printer', time: this.now() })
                this.phase = 'scan'
                return
            }
            if (rec.status === 'none') {
                this.feedback('error', `${hostname}: scan expired on the daemon`)
                this.log.push({ hostname, spool: this.spoolLabel, ok: false, detail: 'expired', time: this.now() })
                this.phase = 'scan'
                return
            }
        } catch {
            // transient — keep polling until the timeout
        }
        if (Date.now() - this.pollStarted > POLL_TIMEOUT_MS) {
            this.$store.dispatch('fleet/spools/cancelLoadScan', hostname).catch(() => {})
            this.feedback('error', `${hostname}: no response from the printer`)
            this.log.push({ hostname, spool: this.spoolLabel, ok: false, detail: 'no response (timed out)', time: this.now() })
            this.phase = 'scan'
            return
        }
        this.pollTimer = setTimeout(() => this.poll(), POLL_MS)
    }

    /** Withdraw a relayed scan that has not been confirmed yet. */
    async withdraw(report = true) {
        this.stopPolling()
        const hostname = this.printerHost
        this.phase = 'scan'
        this.relay = null
        if (hostname) {
            await this.$store.dispatch('fleet/spools/cancelLoadScan', hostname).catch(() => {})
            if (report) this.log.push({ hostname, spool: this.spoolLabel, ok: false, detail: 'withdrawn', time: this.now() })
        }
        this.refocusScanInput()
    }

    now(): string {
        return new Date().toLocaleTimeString()
    }

    // ---- mobile camera ----

    openCamera() {
        const input = this.$refs.cameraInput as HTMLInputElement | undefined
        if (input) {
            input.value = ''
            input.click()
        }
    }

    async onCameraCapture(e: Event) {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return
        this.cameraProcessing = true
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
                await this.handleScan(results[0].text.trim())
            } else {
                this.feedback('error', 'No code found in photo. Ensure the QR code is clearly visible and well-lit.')
            }
        } catch {
            this.feedback('error', 'Failed to process photo. Please try again.')
        } finally {
            this.cameraProcessing = false
            this.refocusScanInput()
        }
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
