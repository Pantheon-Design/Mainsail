<template>
    <v-app dark>
        <v-app-bar app dense flat color="#1E1E1E">
            <v-icon left color="primary">{{ mdiQrcodeScan }}</v-icon>
            <v-toolbar-title class="subtitle-1">Scanner</v-toolbar-title>
            <v-spacer />
            <v-chip x-small :color="daemonStatus === 'ok' ? 'success' : daemonStatus === 'checking' ? 'grey' : 'error'" outlined class="mr-2">
                {{ daemonStatusLabel }}
            </v-chip>
            <v-btn icon small :color="devMode ? 'orange' : 'grey'" title="Toggle scan debug trace" @click="devMode = !devMode">
                <v-icon small>{{ mdiBug }}</v-icon>
            </v-btn>
            <v-btn icon small title="Daemon settings" @click="openSettings">
                <v-icon small>{{ mdiCog }}</v-icon>
            </v-btn>
        </v-app-bar>

        <v-main>
            <v-container class="pa-4" style="max-width: 640px">
                <v-alert v-if="loadError" type="error" dense dismissible class="mb-4" @input="loadError = ''">
                    {{ loadError }}
                </v-alert>

                <v-btn block x-large color="primary" class="mb-4 scan-mode-btn" :disabled="loading" @click="openQc">
                    <v-icon left large>{{ mdiMagnifyCheck }}</v-icon>
                    QC Mode
                </v-btn>
                <v-btn block x-large color="teal" dark class="mb-4 scan-mode-btn" :disabled="loading" @click="openAddSpool">
                    <v-icon left large>{{ mdiSpool }}</v-icon>
                    Add Spool Mode
                </v-btn>
                <v-btn block x-large color="indigo" dark class="mb-4 scan-mode-btn" :disabled="loading" @click="openAddPart">
                    <v-icon left large>{{ mdiPackageVariantClosed }}</v-icon>
                    Add Part Mode
                </v-btn>
                <v-btn block x-large color="deep-orange" dark class="mb-4 scan-mode-btn" :disabled="loading" @click="openMacros">
                    <v-icon left large>{{ mdiScriptTextOutline }}</v-icon>
                    Macros
                </v-btn>
                <v-btn block x-large color="green darken-2" dark class="mb-4 scan-mode-btn" :disabled="loading" @click="openLoadSpool">
                    <v-icon left large>{{ mdiTrayArrowDown }}</v-icon>
                    Load Spool
                </v-btn>

                <p class="caption grey--text text-center mt-6 mb-1">
                    Daemon: {{ daemonUrl }}
                </p>
                <p class="caption grey--text text-center mb-0">
                    {{ spools.length }} spools · {{ filaments.length }} filaments · {{ knownPrinters.length }} printers
                    <v-btn x-small text color="primary" :loading="loading" @click="loadAll">reload</v-btn>
                </p>
            </v-container>
        </v-main>

        <!-- Scanning modes -->
        <qc-scan-mode v-model="qcMode" :dev-mode="devMode" :is-mobile="isMobile" />
        <add-spool-scan-mode v-model="addSpoolMode" :dev-mode="devMode" @closed="loadSpools" />
        <add-part-scan-mode v-model="addPartMode" :dev-mode="devMode" :is-mobile="isMobile" :known-printers="knownPrinters" @closed="loadHistory" />
        <macro-scan-mode v-model="macroMode" :dev-mode="devMode" :is-mobile="isMobile" />
        <load-spool-scan-mode v-model="loadSpoolMode" :dev-mode="devMode" :is-mobile="isMobile" @closed="loadSpools" />

        <!-- Daemon URL settings -->
        <v-dialog v-model="settingsOpen" max-width="420">
            <v-card>
                <v-card-title class="subtitle-1">Fleet daemon URL</v-card-title>
                <v-card-text>
                    <v-text-field
                        v-model="settingsUrl"
                        label="http://host:8090"
                        dense
                        outlined
                        hide-details
                        autocomplete="off"
                        autocapitalize="off"
                        spellcheck="false"
                        @keydown.enter="saveSettings"
                    />
                    <p class="caption grey--text mt-2 mb-0">
                        Leave empty to use the default ({{ defaultUrl }}). You can also open this page with
                        <code>?daemon=http://host:8090</code> once; it is remembered.
                    </p>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn text @click="settingsOpen = false">Cancel</v-btn>
                    <v-btn color="primary" text @click="saveSettings">Save &amp; reload</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-app>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import { mdiQrcodeScan, mdiBug, mdiCog, mdiPackageVariantClosed, mdiScriptTextOutline, mdiTrayArrowDown } from '@mdi/js'
import { mdiMagnifyCheck, mdiSpool } from '@/plugins/customIcons'
import QcScanMode from '@/components/scan/QcScanMode.vue'
import AddSpoolScanMode from '@/components/scan/AddSpoolScanMode.vue'
import AddPartScanMode from '@/components/scan/AddPartScanMode.vue'
import MacroScanMode from '@/components/scan/MacroScanMode.vue'
import LoadSpoolScanMode from '@/components/scan/LoadSpoolScanMode.vue'
import { warmScanKeyboard } from '@/plugins/scanFocus'
import { defaultDaemonUrl, saveDaemonUrl } from './store'
import { FleetHistoryRecord } from '@/store/fleet/history/types'
import { FleetSpool, FleetFilament } from '@/store/fleet/spools/types'

@Component({ components: { QcScanMode, AddSpoolScanMode, AddPartScanMode, MacroScanMode, LoadSpoolScanMode } })
export default class ScanApp extends Vue {
    mdiQrcodeScan = mdiQrcodeScan
    mdiBug = mdiBug
    mdiCog = mdiCog
    mdiMagnifyCheck = mdiMagnifyCheck
    mdiSpool = mdiSpool
    mdiPackageVariantClosed = mdiPackageVariantClosed
    mdiScriptTextOutline = mdiScriptTextOutline
    mdiTrayArrowDown = mdiTrayArrowDown

    qcMode = false
    addSpoolMode = false
    addPartMode = false
    macroMode = false
    loadSpoolMode = false
    devMode = false

    loading = false
    loadError = ''
    daemonStatus: 'checking' | 'ok' | 'down' = 'checking'

    settingsOpen = false
    settingsUrl = ''

    get isMobile(): boolean {
        return 'ontouchstart' in window && window.innerWidth < 768
    }

    get daemonUrl(): string {
        return this.$store.getters['gui/fleetDaemonUrl']
    }

    get defaultUrl(): string {
        return defaultDaemonUrl()
    }

    get daemonStatusLabel(): string {
        if (this.daemonStatus === 'ok') return 'daemon OK'
        if (this.daemonStatus === 'checking') return 'checking…'
        return 'daemon unreachable'
    }

    get spools(): FleetSpool[] {
        return this.$store.getters['fleet/spools/getSpools'] || []
    }

    get filaments(): FleetFilament[] {
        return this.$store.getters['fleet/spools/getFilaments'] || []
    }

    get knownPrinters(): string[] {
        const records: FleetHistoryRecord[] = this.$store.state.fleet.history.records || []
        const hostnames = records.map((r) => r.printer_hostname).filter(Boolean) as string[]
        return [...new Set(hostnames)].sort()
    }

    mounted() {
        this.loadAll()
    }

    async loadAll() {
        this.loading = true
        this.loadError = ''
        this.daemonStatus = 'checking'
        const errors: string[] = []
        await Promise.all([
            this.$store.dispatch('fleet/spools/loadVendors').catch((e: Error) => errors.push(e.message)),
            this.$store.dispatch('fleet/spools/loadFilaments').catch((e: Error) => errors.push(e.message)),
            this.$store.dispatch('fleet/spools/loadSpools').catch((e: Error) => errors.push(e.message)),
            this.loadHistory().catch((e: Error) => errors.push(e.message)),
        ])
        this.loading = false
        if (errors.length === 4) {
            this.daemonStatus = 'down'
            this.loadError = `Cannot reach the fleet daemon at ${this.daemonUrl}. Check the URL in settings.`
        } else {
            this.daemonStatus = 'ok'
            if (errors.length) this.loadError = [...new Set(errors)].join(' | ')
        }
    }

    loadSpools() {
        this.$store.dispatch('fleet/spools/loadSpools').catch(() => {})
    }

    /** Seeds the known-printer list used by Add Part Mode. */
    async loadHistory() {
        await this.$store.dispatch('fleet/history/loadHistory', { limit: 200 })
    }

    openQc() {
        // QC warms the keyboard itself when the inspector is confirmed (a real tap)
        this.qcMode = true
    }

    openAddSpool() {
        warmScanKeyboard() // must be first: synchronous, inside the tap gesture
        this.addSpoolMode = true
    }

    openAddPart() {
        warmScanKeyboard() // must be first: synchronous, inside the tap gesture
        this.addPartMode = true
    }

    openMacros() {
        warmScanKeyboard() // must be first: synchronous, inside the tap gesture
        this.macroMode = true
    }

    openLoadSpool() {
        warmScanKeyboard() // must be first: synchronous, inside the tap gesture
        this.loadSpoolMode = true
    }

    openSettings() {
        this.settingsUrl = this.daemonUrl === this.defaultUrl ? '' : this.daemonUrl
        this.settingsOpen = true
    }

    saveSettings() {
        saveDaemonUrl(this.settingsUrl)
        window.location.reload()
    }
}
</script>

<style>
@import '../assets/styles/fonts.css';

.scan-mode-btn {
    height: 72px !important;
    font-size: 1.15rem !important;
}
</style>
