<template>
    <v-card flat>
        <v-card-title class="d-flex align-center flex-wrap">
            <span class="mr-3">Fleet workers</span>
            <v-chip small outlined :color="scheduler && scheduler.running ? 'green' : 'red'" class="mr-2">
                <v-icon x-small left>{{ mdiRobot }}</v-icon>
                scheduler {{ scheduler && scheduler.running ? 'running' : 'stopped' }}
                <span v-if="scheduler && scheduler.last_tick_at" class="ml-1">· tick {{ relative(scheduler.last_tick_at) }}</span>
                <span v-if="scheduler && scheduler.pending_items != null" class="ml-1">· {{ scheduler.pending_items }} pending</span>
            </v-chip>
            <v-btn x-small text :loading="ticking" @click="tick">Run scheduler now</v-btn>
            <v-spacer />
            <v-btn-toggle v-model="view" dense mandatory class="mr-3" @change="saveView">
                <v-btn small value="list" title="List"><v-icon small>{{ mdiFormatListBulleted }}</v-icon></v-btn>
                <v-btn small value="map" title="Map"><v-icon small>{{ mdiMapOutline }}</v-icon></v-btn>
            </v-btn-toggle>
            <v-btn small text @click="bulk(true)">Enable all</v-btn>
            <v-btn small text @click="bulk(false)">Disable all</v-btn>
        </v-card-title>
        <v-card-subtitle class="pb-1">
            Every printer connected to fleet_daemon is listed. Workers receive jobs automatically; manual prints of a job's
            file on any printer are still tracked.
        </v-card-subtitle>

        <v-alert v-if="error" type="error" dense dismissible class="mx-4" @input="error = ''">{{ error }}</v-alert>

        <!-- Map view: the fleet map as a toggle surface + a simplified side list -->
        <v-row v-if="view === 'map'" dense class="px-2 pb-2">
            <v-col cols="12" lg="8">
                <farm-map-section
                    location="farm"
                    name="Print Farm"
                    mode="workers"
                    :worker-hostnames="enabledHostnames"
                    :highlight-hostname="hoverHost"
                    class="mb-6"
                    @toggle-worker="toggleByHostname" />
                <farm-map-section
                    location="ground"
                    name="Ground Floor"
                    mode="workers"
                    :worker-hostnames="enabledHostnames"
                    :highlight-hostname="hoverHost"
                    @toggle-worker="toggleByHostname" />
            </v-col>
            <v-col cols="12" lg="4">
                <v-simple-table dense class="worker-side-list">
                    <thead>
                        <tr>
                            <th style="width: 60px">Worker</th>
                            <th>Printer</th>
                            <th>Filament / nozzle / weight</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="w in workersSorted"
                            :key="'side-' + w.printer_hostname"
                            :class="{ 'row-hover': hoverHost === w.printer_hostname }"
                            @mouseenter="hoverHost = w.printer_hostname"
                            @mouseleave="hoverHost = ''">
                            <td>
                                <v-switch
                                    :input-value="w.enabled"
                                    dense
                                    hide-details
                                    class="mt-0 pt-0"
                                    :loading="toggling === w.printer_hostname"
                                    @change="toggle(w, $event)" />
                            </td>
                            <td>
                                <span :class="{ 'text--secondary': !w.connected }">{{ shortName(w.printer_hostname) }}</span>
                                <v-icon v-if="w.enabled" x-small color="orange" class="ml-1">{{ mdiHammer }}</v-icon>
                                <div class="text-caption text--secondary">{{ w.printer_model || '' }} · {{ statusText(w) }}</div>
                            </td>
                            <td class="text-caption">
                                {{ liveFilament(w) || '—' }}
                                <span v-if="liveNozzle(w)"> · {{ liveNozzle(w) }} mm</span>
                                <span v-if="liveRemaining(w) != null"> · {{ Math.round(liveRemaining(w)) }} g</span>
                            </td>
                        </tr>
                    </tbody>
                </v-simple-table>
            </v-col>
        </v-row>

        <v-data-table
            v-else
            :headers="headers"
            :items="workers"
            :loading="loading"
            :items-per-page="100"
            :footer-props="{ 'items-per-page-options': [100, 250, 500, -1] }"
            dense
            sort-by="printer_hostname"
            item-key="printer_hostname">
            <template #item.enabled="{ item }">
                <div class="d-flex align-center">
                    <v-switch
                        :input-value="item.enabled"
                        dense
                        hide-details
                        class="mt-0"
                        :loading="toggling === item.printer_hostname"
                        @change="toggle(item, $event)" />
                    <span v-if="justDisabled === item.printer_hostname" class="text-caption text--secondary ml-2">
                        Current job keeps running and stays tracked; no new jobs will be sent.
                    </span>
                </div>
            </template>
            <template #item.printer_hostname="{ item }">
                <span>{{ item.printer_hostname }}</span>
                <div class="text-caption text--secondary">{{ item.printer_model || 'model ?' }}</div>
            </template>
            <template #item.print_state="{ item }">
                <v-chip x-small :color="statusColor(item)" text-color="white">{{ statusText(item) }}</v-chip>
                <div v-if="liveFilename(item)" class="text-caption text-truncate" style="max-width: 200px" :title="liveFilename(item)">{{ liveFilename(item) }}</div>
            </template>
            <template #item.filament_type="{ item }">
                <span>{{ liveFilament(item) || '—' }}</span>
                <span v-if="liveNozzle(item)" class="text--secondary"> · {{ liveNozzle(item) }} mm</span>
                <div class="text-caption text--secondary">{{ liveRemaining(item) != null ? Math.round(liveRemaining(item)) + ' g left' : '' }}</div>
            </template>
            <template #item.primed="{ item }">
                <v-chip v-if="livePrimed(item) === true" x-small color="green" text-color="white">primed</v-chip>
                <v-chip v-else-if="livePrimed(item) === false" x-small color="grey" text-color="white">not primed</v-chip>
                <span v-else class="text--secondary text-caption">n/a</span>
            </template>
            <template #item.reason="{ item }">
                <span :class="item.eligible ? 'green--text' : ''">{{ item.reason || '—' }}</span>
            </template>
            <template #item.active_run="{ item }">
                <div v-if="item.active_run" class="text-caption">
                    <v-chip x-small :color="item.active_run.source === 'manual' ? 'orange' : 'blue'" text-color="white" class="mr-1">
                        <v-icon v-if="item.active_run.source === 'manual'" x-small left>{{ mdiHandBackRight }}</v-icon>
                        {{ item.active_run.status }}
                    </v-chip>
                    <a class="job-link" @click.stop="openJob(item.active_run.job_id)">{{ item.active_run.job_name }}</a>
                    <div class="text--secondary text-truncate" style="max-width: 220px" :title="item.active_run.gcode_filename">
                        {{ item.active_run.gcode_filename }}
                    </div>
                </div>
                <span v-else class="text--secondary">—</span>
            </template>
        </v-data-table>
    </v-card>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import { mdiFormatListBulleted, mdiHammer, mdiHandBackRight, mdiMapOutline, mdiRobot } from '@mdi/js'
import { FleetWorker, FleetSchedulerStatus } from '@/store/fleet/jobs/types'
import { getPrinterStatus } from '@/components/panels/farmPrinterStatus'
import FarmMapSection from '@/components/panels/FarmMapSection.vue'

const VIEW_KEY = 'fleetWorkersView'

@Component({ components: { FarmMapSection } })
export default class WorkerListPanel extends Vue {
    mdiHandBackRight = mdiHandBackRight
    mdiRobot = mdiRobot
    mdiHammer = mdiHammer
    mdiFormatListBulleted = mdiFormatListBulleted
    mdiMapOutline = mdiMapOutline

    view: 'list' | 'map' = 'list'
    /** Printer hovered in the side list; highlighted on the map. */
    hoverHost = ''

    created() {
        try {
            const v = localStorage.getItem(VIEW_KEY)
            if (v === 'map' || v === 'list') this.view = v
        } catch (e) {
            // storage unavailable — keep default
        }
    }

    saveView(v: string) {
        try {
            localStorage.setItem(VIEW_KEY, v)
        } catch (e) {
            // ignore
        }
    }

    error = ''
    toggling: string | null = null
    justDisabled: string | null = null
    ticking = false

    headers = [
        { text: 'Worker', value: 'enabled', width: 110, sortable: false },
        { text: 'Printer', value: 'printer_hostname' },
        { text: 'Status', value: 'print_state', width: 150 },
        { text: 'Filament / nozzle', value: 'filament_type', width: 150 },
        { text: 'Primed', value: 'primed', width: 100 },
        { text: 'Scheduler', value: 'reason' },
        { text: 'Active run', value: 'active_run', sortable: false },
    ]

    get workers(): FleetWorker[] {
        return this.$store.getters['fleet/workers/getWorkers']
    }

    get loading(): boolean {
        return this.$store.getters['fleet/workers/isLoading']
    }

    get scheduler(): FleetSchedulerStatus | null {
        return this.$store.getters['fleet/workers/getSchedulerStatus']
    }

    get enabledHostnames(): string[] {
        return this.workers.filter((w) => w.enabled).map((w) => w.printer_hostname)
    }

    get workersSorted(): FleetWorker[] {
        return [...this.workers].sort((a, b) => a.printer_hostname.localeCompare(b.printer_hostname))
    }

    shortName(hostname: string): string {
        return hostname.replace(/\.local$/i, '')
    }

    /** Map click: flip the worker flag of that printer. */
    async toggleByHostname(hostname: string) {
        const h = hostname.toLowerCase()
        const w = this.workers.find((x) => x.printer_hostname.toLowerCase() === h)
        if (w) {
            await this.toggle(w, !w.enabled)
            return
        }
        // Printer known to the map but not yet in the workers snapshot: enable it.
        this.toggling = h
        try {
            await this.$store.dispatch('fleet/workers/setWorkerEnabled', { hostname: h, enabled: true })
            await this.$store.dispatch('fleet/workers/loadWorkers')
        } catch (e: any) {
            this.error = e?.message ?? String(e)
        } finally {
            this.toggling = null
        }
    }

    /** Live state from the daemon WebSocket when available, else the /workers snapshot. */
    livePrinter(w: FleetWorker): any | null {
        return this.$store.state.farm.fleetDaemonPrinters?.[w.printer_hostname] ?? null
    }

    // The columns below prefer the 1 Hz WebSocket stream (updates within a
    // second of the printer changing) and fall back to the REST snapshot.
    livePrimed(w: FleetWorker): boolean | null {
        const ms = this.livePrinter(w)?.machine_state
        if (ms && ms.is_primed != null) return ms.is_primed === 1
        return w.primed
    }

    liveFilename(w: FleetWorker): string | null {
        const live = this.livePrinter(w)
        return live?.print_stats?.filename ?? w.filename ?? null
    }

    liveFilament(w: FleetWorker): string | null {
        const live = this.livePrinter(w)
        return live?.toolhead?.filament_type ?? w.filament_type ?? null
    }

    liveNozzle(w: FleetWorker): string | null {
        const live = this.livePrinter(w)
        const v = live?.toolhead?.nozzle_size ?? w.nozzle_size
        return v != null && String(v) !== '' ? String(v) : null
    }

    liveRemaining(w: FleetWorker): number | null {
        const live = this.livePrinter(w)
        const v = live?.toolhead?.remaining_weight
        return v != null ? Number(v) : w.remaining_weight
    }

    statusText(w: FleetWorker): string {
        const live = this.livePrinter(w)
        if (live) return getPrinterStatus(live, this.$store.state.farm.fleetDaemonConnected)
        if (!w.connected) return 'disconnected'
        if (w.klippy_state && w.klippy_state !== 'ready') return w.klippy_state
        return w.print_state === 'standby' ? 'ready' : w.print_state || 'unknown'
    }

    statusColor(w: FleetWorker): string {
        return (
            { printing: 'blue', ready: 'green', complete: 'indigo', error: 'red', disconnected: 'grey' }[this.statusText(w)] ??
            'grey'
        )
    }

    relative(ts: string | number | null): string {
        if (!ts) return ''
        const ms = typeof ts === 'number' ? ts * 1000 : new Date(ts).getTime()
        const s = Math.max(0, Math.round((Date.now() - ms) / 1000))
        return s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`
    }

    async toggle(w: FleetWorker, enabled: boolean) {
        this.toggling = w.printer_hostname
        this.error = ''
        try {
            await this.$store.dispatch('fleet/workers/setWorkerEnabled', { hostname: w.printer_hostname, enabled })
            this.justDisabled = !enabled && w.active_run ? w.printer_hostname : null
        } catch (e: any) {
            this.error = e?.message ?? String(e)
        } finally {
            this.toggling = null
        }
    }

    async bulk(enabled: boolean) {
        this.error = ''
        try {
            await this.$store.dispatch('fleet/workers/bulkSetEnabled', {
                hostnames: this.workers.filter((w) => w.in_printer_list).map((w) => w.printer_hostname),
                enabled,
            })
        } catch (e: any) {
            this.error = e?.message ?? String(e)
        }
    }

    async tick() {
        this.ticking = true
        try {
            await this.$store.dispatch('fleet/workers/triggerTick')
            setTimeout(() => {
                this.$store.dispatch('fleet/workers/loadWorkers').catch(() => {})
                this.$store.dispatch('fleet/workers/loadSchedulerStatus').catch(() => {})
            }, 1000)
        } catch (e: any) {
            this.error = e?.message ?? String(e)
        } finally {
            this.ticking = false
        }
    }

    openJob(id: number) {
        this.$router.push({ path: '/jobs', query: { openJob: String(id) } }).catch(() => {})
    }
}
</script>

<style scoped>
.worker-side-list >>> td {
    vertical-align: middle;
}
.worker-side-list >>> tr.row-hover td {
    background: rgba(255, 235, 59, 0.12);
}
.job-link {
    cursor: pointer;
    text-decoration: underline;
}
</style>
