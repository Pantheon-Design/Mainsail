<template>
    <v-dialog :value="value" max-width="1100" scrollable @input="$emit('input', $event)">
        <v-card>
            <v-card-title class="d-flex align-center flex-wrap">
                <v-icon left color="deep-purple">{{ mdiPin }}</v-icon>
                <span>Next-gcode history</span>
                <span v-if="printer" class="ml-2 text-subtitle-2 text--secondary">· {{ printer }}</span>
                <span v-if="jobId != null" class="ml-2 text-subtitle-2 text--secondary">· job #{{ jobId }}</span>
                <v-spacer />
                <v-select
                    v-model="eventFilter"
                    :items="eventOptions"
                    label="Event"
                    dense
                    outlined
                    hide-details
                    clearable
                    style="max-width: 200px"
                    class="mr-2"
                    @change="load" />
                <v-btn small text :loading="loading" @click="load">
                    <v-icon small left>{{ mdiRefresh }}</v-icon>
                    Refresh
                </v-btn>
                <v-btn icon small @click="$emit('input', false)">
                    <v-icon>{{ mdiClose }}</v-icon>
                </v-btn>
            </v-card-title>
            <v-card-text>
                <v-alert v-if="error" type="error" dense>{{ error }}</v-alert>
                <v-data-table
                    :headers="headers"
                    :items="events"
                    :loading="loading"
                    :items-per-page="50"
                    :footer-props="{ 'items-per-page-options': [50, 100, 200, -1] }"
                    dense
                    item-key="id"
                    no-data-text="No next-gcode events">
                    <template #item.created_at="{ item }">
                        <span :title="item.created_at">{{ when(item.created_at) }}</span>
                    </template>
                    <template #item.printer_hostname="{ item }">
                        {{ shortName(item.printer_hostname) }}
                    </template>
                    <template #item.event="{ item }">
                        <v-chip
                            x-small
                            :color="eventMeta(item.event).color"
                            text-color="white"
                            :title="eventMeta(item.event).hint">
                            {{ item.event }}
                        </v-chip>
                        <div class="text-caption text--secondary">{{ item.actor }}</div>
                    </template>
                    <template #item.gcode_filename="{ item }">
                        <div class="text-truncate" style="max-width: 240px" :title="item.gcode_filename">
                            {{ item.gcode_filename || '—' }}
                        </div>
                        <div class="text-caption">
                            <a v-if="item.job_id" class="job-link" @click="openJob(item.job_id)">
                                #{{ item.job_id }}{{ item.job_name ? ' ' + item.job_name : '' }}
                            </a>
                        </div>
                    </template>
                    <template #item.policy="{ item }">
                        <span class="text-caption">{{ policy(item) }}</span>
                    </template>
                    <template #item.reason="{ item }">
                        <div class="text-caption reason-cell">
                            <span v-if="item.reason">{{ item.reason }}</span>
                            <div v-if="item.event === 'superseded' && item.fallback_job_id">
                                ran instead:
                                <a class="job-link" @click="openJob(item.fallback_job_id)">
                                    #{{ item.fallback_job_id
                                    }}{{ item.fallback_job_name ? ' ' + item.fallback_job_name : '' }}
                                </a>
                                <span v-if="item.fallback_gcode" class="text--secondary">
                                    · {{ item.fallback_gcode }}
                                </span>
                            </div>
                            <div v-if="item.run_id" class="text--secondary">run #{{ item.run_id }}</div>
                            <div v-if="item.note" class="text--secondary">note: “{{ item.note }}”</div>
                            <span v-if="!item.reason && !item.run_id && !item.note && item.event !== 'superseded'">
                                —
                            </span>
                        </div>
                    </template>
                    <template #item.set_by="{ item }">
                        <span class="text-caption">{{ item.set_by || '—' }}</span>
                    </template>
                </v-data-table>
            </v-card-text>
        </v-card>
    </v-dialog>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import { Prop, Watch } from 'vue-property-decorator'
import { mdiClose, mdiPin, mdiRefresh } from '@mdi/js'
import { FleetNextGcodeEvent } from '@/store/fleet/jobs/types'
import { formatHoldMinutes } from '@/components/panels/fleetWorkerAttention'

const EVENT_META: Record<string, { color: string; hint: string }> = {
    set: { color: 'deep-purple', hint: 'Next-gcode set via the API' },
    replaced: { color: 'deep-purple', hint: 'Next-gcode replaced via the API (timer restarted)' },
    cleared: { color: 'grey', hint: 'Next-gcode cleared via the API' },
    started: { color: 'green', hint: 'The next-gcode print started; next-gcode cleared' },
    dispatch_failed: { color: 'red', hint: 'Upload/start of the next-gcode failed; next-gcode kept' },
    superseded: { color: 'orange', hint: 'Blocked; a regular job ran instead and cleared it' },
    hold_started: { color: 'blue-grey', hint: 'Blocked on a free printer with fallback off: hold timer started' },
    hold_expired: { color: 'red', hint: 'Hold timer ran out while still blocked: cleared, regular jobs resume' },
}

@Component
export default class NextGcodeHistoryDialog extends Vue {
    mdiClose = mdiClose
    mdiPin = mdiPin
    mdiRefresh = mdiRefresh

    @Prop({ type: Boolean, default: false }) value!: boolean
    /** Limit to one printer (hostname) */
    @Prop({ type: String, default: null }) printer!: string | null
    /** Limit to one job (its next-gcodes, or runs that superseded one) */
    @Prop({ type: Number, default: null }) jobId!: number | null

    events: FleetNextGcodeEvent[] = []
    loading = false
    error = ''
    eventFilter: string | null = null

    eventOptions = Object.keys(EVENT_META)

    headers = [
        { text: 'When', value: 'created_at', width: 120 },
        { text: 'Printer', value: 'printer_hostname', width: 110 },
        { text: 'Event', value: 'event', width: 120 },
        { text: 'Gcode / job', value: 'gcode_filename' },
        { text: 'Policy', value: 'policy', sortable: false, width: 150 },
        { text: 'Reason / details', value: 'reason', sortable: false },
        { text: 'By', value: 'set_by', width: 90 },
    ]

    @Watch('value', { immediate: true })
    onOpen(open: boolean) {
        if (open) this.load()
    }

    @Watch('printer')
    @Watch('jobId')
    onFilterChange() {
        if (this.value) this.load()
    }

    async load() {
        this.loading = true
        this.error = ''
        try {
            this.events = await this.$store.dispatch('fleet/workers/loadNextGcodeHistory', {
                printer: this.printer,
                jobId: this.jobId,
                event: this.eventFilter,
                limit: 500,
            })
        } catch (e: any) {
            this.error = e?.message ?? String(e)
        } finally {
            this.loading = false
        }
    }

    eventMeta(ev: string) {
        return EVENT_META[ev] ?? { color: 'grey', hint: ev }
    }

    /** Fallback / hold policy recorded with the event. */
    policy(e: FleetNextGcodeEvent): string {
        if (e.fallback == null) return '—'
        if (e.fallback) return 'fallback'
        return e.hold_minutes ? `no fallback · hold ${formatHoldMinutes(e.hold_minutes)}` : 'no fallback · indefinite'
    }

    when(ts: string): string {
        const d = new Date(ts)
        if (isNaN(d.getTime())) return ts
        return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    }

    shortName(h: string): string {
        return (h || '').replace(/\.local$/i, '')
    }

    openJob(id: number) {
        this.$emit('input', false)
        this.$router.push({ path: '/jobs', query: { openJob: String(id) } }).catch(() => {})
    }
}
</script>

<style scoped>
.job-link {
    cursor: pointer;
    text-decoration: underline;
}
.reason-cell {
    white-space: normal;
    max-width: 360px;
}
</style>
