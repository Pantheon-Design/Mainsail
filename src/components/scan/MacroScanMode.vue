<template>
    <v-dialog :value="value" fullscreen persistent no-click-animation>
        <v-card class="d-flex flex-column" style="height: 100vh; transition: background-color 0.3s ease" :style="{ backgroundColor: cardColor }" @click="onCardClick">
            <!-- Header -->
            <v-card-title class="d-flex align-center py-2">
                <v-btn v-if="selectedMacro" icon small class="mr-1" title="Back to macro list" @click="clearMacro">
                    <v-icon>{{ mdiArrowLeft }}</v-icon>
                </v-btn>
                <v-icon left color="primary">{{ mdiScriptTextOutline }}</v-icon>
                <span>Macros</span>
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
                scan: {{ burst ? burst.trace : 'no detector' }} | focused={{ scanFocused }} | buffer="{{ scanBuffer }}"
            </p>
            <v-divider />

            <!-- ==================== Step 1: pick a macro ==================== -->
            <v-card-text v-if="!selectedMacro" class="flex-grow-1 pa-4" style="overflow-y: auto">
                <p class="grey--text text-center mb-4">Select a command, then scan printer hostnames to run it.</p>
                <v-btn
                    v-for="macro in macros"
                    :key="macro.id"
                    block
                    x-large
                    dark
                    :color="macro.color"
                    class="mb-3 macro-btn"
                    @click="selectMacro(macro)"
                >
                    <v-icon left large>{{ macro.icon }}</v-icon>
                    <span class="text-left flex-grow-1">
                        {{ macro.label }}
                        <span v-if="macro.hasTemp" class="caption d-block" style="opacity: 0.8; text-transform: none">
                            default {{ defaultTemp }}°C · editable
                        </span>
                    </span>
                </v-btn>

                <!-- Session log also visible here so results survive going back -->
                <v-card v-if="log.length" outlined class="mt-4">
                    <v-card-title class="subtitle-2 py-2">Session Log ({{ log.length }})</v-card-title>
                    <v-divider />
                    <v-list dense class="pa-0" style="max-height: 240px; overflow-y: auto">
                        <v-list-item v-for="(entry, idx) in log.slice().reverse()" :key="idx" dense>
                            <v-list-item-icon class="mr-2">
                                <v-icon small :color="entry.ok ? 'success' : 'error'">{{ entry.ok ? mdiCheckCircle : mdiAlertCircle }}</v-icon>
                            </v-list-item-icon>
                            <v-list-item-content>
                                <v-list-item-title class="font-weight-bold">{{ entry.hostname }} — {{ entry.macro }}</v-list-item-title>
                                <v-list-item-subtitle>{{ entry.detail }} &bull; {{ entry.time }}</v-list-item-subtitle>
                            </v-list-item-content>
                        </v-list-item>
                    </v-list>
                </v-card>
            </v-card-text>

            <!-- ==================== Step 2: armed, listening for hostnames ==================== -->
            <template v-else>
                <!-- Armed macro banner -->
                <div class="d-flex align-center px-4 py-2" :style="{ background: selectedMacroColor, color: 'white' }">
                    <v-icon color="white" class="mr-3" size="28">{{ selectedMacro.icon }}</v-icon>
                    <div class="flex-grow-1">
                        <div class="text-h6 font-weight-bold" style="line-height: 1.2">{{ selectedMacro.label }}</div>
                        <div class="caption" style="font-family: monospace; opacity: 0.9">{{ currentGcode }}</div>
                    </div>
                    <v-progress-circular v-if="sending" indeterminate color="white" size="24" width="3" />
                </div>

                <!-- Temperature input (only for temp macros) -->
                <div v-if="selectedMacro.hasTemp" class="d-flex align-center px-4 py-2" style="background: rgba(255,255,255,0.05)">
                    <v-icon class="mr-3" color="grey">{{ mdiThermometer }}</v-icon>
                    <v-text-field
                        ref="tempInput"
                        v-model="tempInput"
                        label="Target temperature (°C)"
                        type="number"
                        inputmode="decimal"
                        min="0"
                        step="1"
                        dense
                        outlined
                        hide-details
                        autocomplete="off"
                        style="max-width: 220px"
                        :error="!tempValid"
                        @keydown.enter.prevent="refocusScanInput"
                        @blur="onTempBlur"
                    />
                    <div class="d-flex ml-3" style="gap: 6px; flex-wrap: wrap">
                        <v-chip
                            v-for="preset in selectedMacro.presets"
                            :key="preset"
                            small
                            outlined
                            :color="Number(tempInput) === preset ? 'primary' : ''"
                            style="cursor: pointer"
                            @click="setTemp(preset)"
                        >
                            {{ preset }}°
                        </v-chip>
                    </div>
                </div>
                <p v-if="!tempValid" class="caption error--text px-4 my-1">Enter a whole number of 0 or more.</p>

                <!-- Visible scan input (all layouts) -->
                <div class="d-flex align-center px-4 py-2" style="background: rgba(255,255,255,0.03)">
                    <v-text-field
                        ref="scanInput"
                        v-model="scanBuffer"
                        label="Scan printer hostname (or type it)"
                        placeholder="e.g. printer1.local"
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
                        :disabled="sending"
                        @input="onScanInput"
                        @keydown.enter="processScan"
                        @focus="scanFocused = true"
                        @blur="scanFocused = false"
                    >
                        <template #append>
                            <v-btn icon small :disabled="!scanBuffer.trim() || sending" title="Send" @click="processScan">
                                <v-icon small>{{ mdiSend }}</v-icon>
                            </v-btn>
                        </template>
                    </v-text-field>
                    <template v-if="isMobile">
                        <input
                            ref="cameraInput"
                            type="file"
                            accept="image/*"
                            capture="environment"
                            class="scan-hidden-input"
                            @change="onCameraCapture"
                        />
                        <v-btn icon large class="ml-2" color="primary" title="Scan with camera" :loading="cameraProcessing" :disabled="sending" @click="openCamera">
                            <v-icon>{{ mdiCamera }}</v-icon>
                        </v-btn>
                    </template>
                </div>
                <v-divider />

                <!-- Body -->
                <v-card-text class="d-flex flex-column flex-grow-1 pa-4" style="overflow-y: auto">
                    <div v-if="!log.length" class="d-flex flex-column align-center justify-center flex-grow-1" style="min-height: 200px">
                        <v-icon size="72" :color="sending ? 'grey' : 'success'">{{ sending ? mdiTimerSand : mdiPrinter3d }}</v-icon>
                        <p class="text-h6 mt-4" :class="sending ? 'grey--text' : 'success--text'">
                            {{ sending ? `Sending to ${sendingTo}…` : 'Ready — scan a printer hostname' }}
                        </p>
                        <p class="caption grey--text text-center">
                            Every scan runs <code>{{ currentGcode }}</code> on that printer.<br />
                            Printer QR codes end with .local
                        </p>
                    </div>

                    <v-card v-else outlined class="flex-grow-1 d-flex flex-column">
                        <v-card-title class="subtitle-2 py-2">
                            Session Log ({{ log.length }})
                            <v-spacer />
                            <span v-if="sending" class="caption grey--text">Sending to {{ sendingTo }}…</span>
                        </v-card-title>
                        <v-divider />
                        <v-simple-table v-if="!isMobile" dense class="flex-grow-1">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th></th>
                                    <th>Printer</th>
                                    <th>Macro</th>
                                    <th>G-code</th>
                                    <th>Result</th>
                                    <th>Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(entry, idx) in log.slice().reverse()" :key="idx">
                                    <td>{{ log.length - idx }}</td>
                                    <td><v-icon small :color="entry.ok ? 'success' : 'error'">{{ entry.ok ? mdiCheckCircle : mdiAlertCircle }}</v-icon></td>
                                    <td class="font-weight-bold">{{ entry.hostname }}</td>
                                    <td>{{ entry.macro }}</td>
                                    <td style="font-family: monospace">{{ entry.gcode }}</td>
                                    <td :class="entry.ok ? 'success--text' : 'error--text'">{{ entry.detail }}</td>
                                    <td>{{ entry.time }}</td>
                                </tr>
                            </tbody>
                        </v-simple-table>
                        <v-list v-else dense class="pa-0 flex-grow-1" style="overflow-y: auto">
                            <v-list-item v-for="(entry, idx) in log.slice().reverse()" :key="idx" dense>
                                <v-list-item-icon class="mr-2">
                                    <v-icon small :color="entry.ok ? 'success' : 'error'">{{ entry.ok ? mdiCheckCircle : mdiAlertCircle }}</v-icon>
                                </v-list-item-icon>
                                <v-list-item-content>
                                    <v-list-item-title class="font-weight-bold">{{ entry.hostname }} — {{ entry.macro }}</v-list-item-title>
                                    <v-list-item-subtitle>{{ entry.detail }} &bull; {{ entry.time }}</v-list-item-subtitle>
                                </v-list-item-content>
                            </v-list-item>
                        </v-list>
                    </v-card>
                </v-card-text>
            </template>
        </v-card>
    </v-dialog>
</template>

<script lang="ts">
/**
 * Macros Mode — standalone fullscreen scanning dialog for Scanner Lite.
 *
 * Pick a Klipper command, then keep scanning printer hostnames: every scan
 * runs that command on the scanned printer through the fleet daemon
 * (`POST /printer/{hostname}/gcode` → Moonraker `printer.gcode.script`).
 *
 * The G-code strings are the exact ones the full Mainsail UI sends
 * (src/components/mixins/control.ts, panels/Temperature/*):
 *   home      → G28
 *   extruder  → SET_HEATER_TEMPERATURE HEATER=extruder TARGET=<t>
 *   bed       → SET_HEATER_TEMPERATURE HEATER=heater_bed TARGET=<t>
 *   chamber   → SET_TEMPERATURE_FAN_TARGET TEMPERATURE_FAN=chamber TARGET=<t>
 * KlipperScreen sends the same commands (ks_includes/KlippyGcodes.py uses
 * lower-case parameter names, which Klipper treats identically). The chamber
 * on HS3/HSPro is a `[temperature_fan chamber]` object.
 *
 * Open it with v-model; the host must call `warmScanKeyboard()` synchronously
 * inside the tap that opens it. Needs the `fleet/workers` store module.
 */
import Vue from 'vue'
import Component from 'vue-class-component'
import { Prop, Watch } from 'vue-property-decorator'
import {
    mdiQrcodeScan,
    mdiClose,
    mdiCamera,
    mdiScriptTextOutline,
    mdiPrinter3d,
    mdiCheckCircle,
    mdiAlertCircle,
    mdiArrowLeft,
    mdiHome,
    mdiPrinter3dNozzleHeat,
    mdiRadiator,
    mdiHeatWave,
    mdiThermometer,
    mdiSend,
    mdiTimerSand,
} from '@mdi/js'
import { ScanBurstDetector, takeScanInput, resolveScanInputEl } from '@/plugins/scanBurstDetector'

export interface ScanMacro {
    id: string
    label: string
    icon: string
    color: string
    /** When true the macro takes a target temperature (default DEFAULT_TEMP). */
    hasTemp: boolean
    /** Quick-pick chips shown next to the temperature field. */
    presets: number[]
    gcode: (temp: number) => string
}

interface MacroLogEntry {
    hostname: string
    macro: string
    gcode: string
    ok: boolean
    detail: string
    time: string
}

/** Default target for every temperature macro, per the current spec. */
export const DEFAULT_TEMP = 20

export const SCAN_MACROS: ScanMacro[] = [
    {
        id: 'home',
        label: 'Home All (G28)',
        icon: mdiHome,
        color: 'primary',
        hasTemp: false,
        presets: [],
        gcode: () => 'G28',
    },
    {
        id: 'extruder_temp',
        label: 'Set Extruder Temp',
        icon: mdiPrinter3dNozzleHeat,
        color: 'deep-orange',
        hasTemp: true,
        presets: [0, 20, 200, 240, 260],
        gcode: (temp) => `SET_HEATER_TEMPERATURE HEATER=extruder TARGET=${temp}`,
    },
    {
        id: 'bed_temp',
        label: 'Set Bed Temp',
        icon: mdiRadiator,
        color: 'purple',
        hasTemp: true,
        presets: [0, 20, 60, 80, 100],
        gcode: (temp) => `SET_HEATER_TEMPERATURE HEATER=heater_bed TARGET=${temp}`,
    },
    {
        id: 'chamber_temp',
        label: 'Set Chamber Temp',
        icon: mdiHeatWave,
        color: 'teal',
        hasTemp: true,
        presets: [0, 20, 40, 50, 60],
        gcode: (temp) => `SET_TEMPERATURE_FAN_TARGET TEMPERATURE_FAN=chamber TARGET=${temp}`,
    },
]

const MACRO_COLORS: Record<string, string> = {
    primary: 'var(--v-primary-base)',
    'deep-orange': '#E64A19',
    purple: '#7B1FA2',
    teal: '#00796B',
}

@Component
export default class MacroScanMode extends Vue {
    @Prop({ type: Boolean, default: false }) readonly value!: boolean
    @Prop({ type: Boolean, default: false }) readonly devMode!: boolean
    @Prop({ type: Boolean, default: false }) readonly isMobile!: boolean

    mdiQrcodeScan = mdiQrcodeScan
    mdiClose = mdiClose
    mdiCamera = mdiCamera
    mdiScriptTextOutline = mdiScriptTextOutline
    mdiPrinter3d = mdiPrinter3d
    mdiCheckCircle = mdiCheckCircle
    mdiAlertCircle = mdiAlertCircle
    mdiArrowLeft = mdiArrowLeft
    mdiThermometer = mdiThermometer
    mdiSend = mdiSend
    mdiTimerSand = mdiTimerSand

    macros = SCAN_MACROS
    defaultTemp = DEFAULT_TEMP

    selectedMacro: ScanMacro | null = null
    tempInput = String(DEFAULT_TEMP)

    scanBuffer = ''
    scanFocused = false
    sending = false
    sendingTo = ''
    log: MacroLogEntry[] = []

    flash: 'success' | 'error' | null = null
    flashTimer: ReturnType<typeof setTimeout> | null = null
    banner: { kind: 'success' | 'error'; text: string } | null = null
    /** Auto-submit scanner bursts that arrive without a trailing Enter (set in created). */
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
        if (this.flashTimer) clearTimeout(this.flashTimer)
    }

    @Watch('value')
    onValueChange(open: boolean) {
        if (open) this.onOpen()
        else this.onClose()
    }

    onOpen() {
        this.burst?.reset()
        this.selectedMacro = null
        this.tempInput = String(DEFAULT_TEMP)
        this.scanBuffer = ''
        this.sending = false
        this.sendingTo = ''
        this.log = []
        this.cameraProcessing = false
        this.resetFeedback()
    }

    onClose() {
        this.burst?.unwatch()
        this.burst?.reset()
        this.selectedMacro = null
        this.scanBuffer = ''
        this.resetFeedback()
    }

    exit() {
        this.$emit('input', false)
        this.$emit('closed')
    }

    // ---- macro selection ----

    get tempValid(): boolean {
        const t = this.tempInput.trim()
        return /^\d+$/.test(t)
    }

    get temp(): number {
        return this.tempValid ? parseInt(this.tempInput.trim(), 10) : DEFAULT_TEMP
    }

    get currentGcode(): string {
        return this.selectedMacro ? this.selectedMacro.gcode(this.temp) : ''
    }

    get selectedMacroColor(): string {
        return this.selectedMacro ? MACRO_COLORS[this.selectedMacro.color] ?? this.selectedMacro.color : ''
    }

    selectMacro(macro: ScanMacro) {
        this.selectedMacro = macro
        this.tempInput = String(DEFAULT_TEMP)
        this.scanBuffer = ''
        this.banner = null
        this.$nextTick(() => {
            // Poll the field so detection works even if no input events reach us
            this.burst?.reset()
            this.burst?.watch(() => resolveScanInputEl(this.$refs.scanInput)?.value ?? '')
            this.refocusScanInput()
        })
    }

    clearMacro() {
        this.burst?.unwatch()
        this.burst?.reset()
        this.selectedMacro = null
        this.scanBuffer = ''
    }

    setTemp(preset: number) {
        this.tempInput = String(preset)
        this.refocusScanInput()
    }

    onTempBlur() {
        if (!this.tempValid) this.tempInput = String(DEFAULT_TEMP)
    }

    // ---- feedback (flash + persistent banner) ----

    get cardColor(): string | undefined {
        if (this.flash === 'success') return '#2E7D32'
        if (this.flash === 'error') return '#C62828'
        return undefined
    }

    feedback(kind: 'success' | 'error', text: string) {
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
            if (field && this.value && this.selectedMacro) {
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
        await this.runOn(scanned)
        this.refocusScanInput()
    }

    /** Accepts `printer1` or `printer1.local`; the daemon normalises the same way. */
    normalizeHostname(raw: string): string {
        const h = raw.trim().toLowerCase()
        if (!h) return ''
        return h.endsWith('.local') ? h : `${h}.local`
    }

    async runOn(rawHostname: string) {
        if (!this.selectedMacro) {
            this.feedback('error', 'Select a macro first')
            return
        }
        if (this.selectedMacro.hasTemp && !this.tempValid) {
            this.feedback('error', 'Enter a valid temperature before scanning')
            return
        }
        const hostname = this.normalizeHostname(rawHostname)
        if (!/^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)*\.local$/.test(hostname)) {
            this.feedback('error', `"${rawHostname}" is not a printer hostname`)
            return
        }
        if (this.sending) {
            this.feedback('error', `Still sending to ${this.sendingTo} — scan again in a moment`)
            return
        }

        const macro = this.selectedMacro
        const gcode = this.currentGcode
        this.sending = true
        this.sendingTo = hostname
        this.banner = null
        try {
            await this.$store.dispatch('fleet/workers/sendGcode', { hostname, script: gcode })
            this.feedback('success', `${hostname}: ${macro.label} sent (${gcode})`)
            this.log.push({ hostname, macro: macro.label, gcode, ok: true, detail: 'ok', time: new Date().toLocaleTimeString() })
        } catch (err: any) {
            const msg = err?.message || 'request failed'
            this.feedback('error', `${hostname}: ${msg}`)
            this.log.push({ hostname, macro: macro.label, gcode, ok: false, detail: msg, time: new Date().toLocaleTimeString() })
        } finally {
            this.sending = false
            this.sendingTo = ''
        }
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
                await this.runOn(results[0].text.trim())
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
.macro-btn {
    height: 72px !important;
    font-size: 1.1rem !important;
    justify-content: flex-start;
}
.macro-btn ::v-deep .v-btn__content {
    justify-content: flex-start;
    width: 100%;
}
.scan-hidden-input {
    position: absolute;
    left: -9999px;
    opacity: 0;
    width: 1px;
    height: 1px;
}
</style>
