<template>
    <v-container fluid class="pa-4">
        <panel :icon="mdiHeartPulse" :title="$t('FleetStatus.Title')" card-class="fleet-status-panel" :loading="loading">
            <template #buttons>
                <v-select
                    v-model="days"
                    :items="dayOptions"
                    dense
                    hide-details
                    outlined
                    class="fleet-status-days mr-2"
                    @change="reload" />
                <v-btn icon tile :title="$t('FleetStatus.Refresh')" :loading="loading" @click="reload">
                    <v-icon>{{ mdiRefresh }}</v-icon>
                </v-btn>
            </template>
            <v-card-text>
                <p class="text--secondary mb-4">{{ $t('FleetStatus.Description') }}</p>
                <v-alert v-if="error" dense text type="error" class="mb-4">{{ error }}</v-alert>
                <v-alert v-else-if="!loading && rows.length === 0" dense text type="info">
                    {{ $t('FleetStatus.NoSites') }}
                </v-alert>
                <fleet-uptime-timeline
                    v-for="row in rows"
                    :key="row.key"
                    :title="row.title"
                    :subtitle="row.subtitle"
                    :online="row.online"
                    :now="now"
                    :segments="row.segments"
                    :outages="row.outages"
                    :days="days"
                    :outages-are-downtime="row.outagesAreDowntime"
                    :outage-label="row.outageLabel"
                    :down-label="row.downLabel" />
                <div v-if="fetchedAt" class="caption text--secondary mt-3">
                    {{ $t('FleetStatus.Updated', { time: fetchedAt }) }}
                </div>
            </v-card-text>
        </panel>
    </v-container>
</template>

<script lang="ts">
/**
 * Fleet Status — status-page style uptime for every fleet_daemon.
 *
 * GET <fleet_daemon>/daemon/uptime returns this site's own timeline straight
 * from the daemon; if that request fails the daemon itself is down, so the
 * last known timeline is kept and shown as offline. The cloud dashboard
 * (PantheonFleetMainsail, /status) renders the same component per site.
 */
import { Component, Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import Panel from '@/components/ui/Panel.vue'
import FleetUptimeTimeline, { SyncOutage, UptimeSegment } from '@/components/panels/FleetUptimeTimeline.vue'
import axios from 'axios'
import { mdiHeartPulse, mdiRefresh } from '@mdi/js'

interface StatusRow {
    key: string
    title: string
    subtitle: string
    online: boolean
    segments: UptimeSegment[]
    outages: SyncOutage[]
    outagesAreDowntime: boolean
    outageLabel: string
    downLabel: string
}

const NAS_DOWN_LABEL = 'Fleet daemon down — NAS state unknown'

function withOpen(closed: SyncOutage[], openSince: string | null | undefined, now: string, error?: string | null): SyncOutage[] {
    const out = [...closed]
    if (openSince) out.push({ started_at: openSince, ended_at: now, error: error ?? null, ongoing: true })
    return out
}

const REFRESH_MS = 60_000

@Component({
    components: { Panel, FleetUptimeTimeline },
})
export default class FleetStatus extends Mixins(BaseMixin) {
    mdiHeartPulse = mdiHeartPulse
    mdiRefresh = mdiRefresh

    loading = false
    error: string | null = null
    days = 90
    dayOptions = [
        { text: '30 days', value: 30 },
        { text: '60 days', value: 60 },
        { text: '90 days', value: 90 },
    ]
    now = new Date().toISOString()
    rows: StatusRow[] = []
    fetchedAt = ''
    private timer: ReturnType<typeof setInterval> | null = null
    private onVisibility = () => {
        if (document.visibilityState === 'visible') this.reload()
    }

    get baseUrl(): string {
        return this.$store.getters['gui/fleetDaemonUrl']
    }

    mounted() {
        this.reload()
        this.timer = setInterval(() => {
            if (document.visibilityState === 'visible') this.reload()
        }, REFRESH_MS)
        document.addEventListener('visibilitychange', this.onVisibility)
    }

    beforeDestroy() {
        if (this.timer) clearInterval(this.timer)
        document.removeEventListener('visibilitychange', this.onVisibility)
    }

    async reload() {
        if (this.loading) return
        this.loading = true
        try {
            await this.loadLocal()
            this.error = null
            this.fetchedAt = new Date().toLocaleTimeString()
        } catch (e: any) {
            // The daemon serves its own timeline: an unreachable endpoint IS the outage.
            this.error = `fleet_daemon is not reachable at ${this.baseUrl} — showing the last known timeline.`
            this.now = new Date().toISOString()
            this.rows = this.rows.map((r) => ({ ...r, online: false }))
        } finally {
            this.loading = false
        }
    }

    private async loadLocal() {
        const { data } = await axios.get(`${this.baseUrl}/daemon/uptime`, { params: { days: this.days } })
        this.now = data.now
        this.rows = localRows(data)
    }
}

/** Rows for one daemon's own snapshot (GET /daemon/uptime). */
function localRows(data: any): StatusRow[] {
    const segments: UptimeSegment[] = data.segments ?? []
    const outages = data.outages ?? {}
    const open = data.open_outages ?? {}
    const rows: StatusRow[] = [
        {
            key: 'daemon',
            title: `Fleet daemon — ${data.site}`,
            subtitle: data.host_name ?? '',
            online: true,
            segments,
            outages: [],
            outagesAreDowntime: false,
            outageLabel: '',
            downLabel: '',
        },
    ]
    if (data.cloud_sync_enabled) {
        rows.push({
            key: 'cloudsync',
            title: 'Cloud sync (Neon)',
            subtitle: 'Live status + history mirrored to the cloud dashboard',
            online: true,
            segments,
            outages: withOpen(outages.cloud_sync ?? [], open.cloud_sync?.started_at, data.now, open.cloud_sync?.error),
            outagesAreDowntime: true,
            outageLabel: 'Cloud sync interrupted',
            downLabel: 'Fleet daemon down — cloud sync off',
        })
    }
    if (data.nas_enabled) {
        rows.push({
            key: 'nas',
            title: 'NAS',
            subtitle: (data.nas_paths ?? []).join(' · ') || 'Archive storage mount',
            online: true,
            segments,
            outages: withOpen(outages.nas ?? [], open.nas?.started_at, data.now, open.nas?.error),
            outagesAreDowntime: true,
            outageLabel: 'NAS unreachable',
            downLabel: NAS_DOWN_LABEL,
        })
    }
    return rows
}
</script>

<style scoped>
.fleet-status-days {
    max-width: 130px;
}
.fleet-status-days >>> .v-input__slot {
    min-height: 32px !important;
}
.fleet-status-days >>> .v-input__append-inner {
    margin-top: 4px !important;
}
</style>
