<template>
    <div class="dash-jobs">
        <div class="dash-jobs__head">
            <v-icon small class="mr-1">{{ mdiBriefcaseOutline }}</v-icon>
            {{ $t('FleetDashboard.FleetJobs') }}
            <span class="dash-jobs__pill">{{ jobs.length }}</span>
            <span v-if="jobs.length" class="dash-jobs__totals text--secondary">
                {{ formatHoursDh(totalLeft) }} {{ $t('FleetDashboard.Left') }} · {{ formatGrams(totalGramsLeft) }}
                {{ $t('FleetDashboard.Left') }}
            </span>
        </div>
        <v-alert v-if="error" dense text type="warning" class="mb-2 dash-jobs__alert">{{ error }}</v-alert>
        <div v-else-if="!jobs.length" class="dash-jobs__empty">{{ $t('FleetDashboard.NoJobs') }}</div>
        <div class="dash-jobs__list">
            <div v-for="j in jobs" :key="j.job_id" class="dash-job" @click="openJob(j.job_id)">
                <div class="dash-job__row">
                    <span class="dash-job__name text-truncate" :title="j.name">{{ j.name }}</span>
                    <span v-if="j.customer_name" class="dash-job__customer text-truncate">{{ j.customer_name }}</span>
                    <v-chip x-small :color="statusColor(j)" text-color="white" class="ml-1">{{ statusText(j) }}</v-chip>
                    <v-chip v-if="j.priority === 'high'" x-small color="error" text-color="white" class="ml-1">
                        high
                    </v-chip>
                    <span class="dash-job__workers" :title="j.workers.join('\n')">
                        <v-icon small color="orange">{{ mdiHammer }}</v-icon>
                        {{ $tc('FleetDashboard.WorkersOn', j.workers_active, { n: j.workers_active }) }}
                    </span>
                </div>
                <v-progress-linear
                    :value="timePercent(j)"
                    height="36"
                    rounded
                    :color="j.time_complete ? 'blue' : 'blue-grey'"
                    background-color="rgba(128,128,128,0.25)"
                    class="dash-job__bar"
                    :title="j.time_complete ? '' : $t('FleetDashboard.TimeIncomplete')">
                    <span class="dash-job__bar-text">
                        {{ j.time_complete ? '' : '~' }}{{ formatHoursDh(j.secs_done) }}
                        {{ $t('FleetDashboard.Done') }} · {{ j.time_complete ? '' : '~'
                        }}{{ formatHoursDh(j.secs_left) }} {{ $t('FleetDashboard.Left') }}
                        <span class="dash-job__bar-pct">{{ timePercent(j) }}%</span>
                    </span>
                </v-progress-linear>
                <div class="dash-job__row dash-job__row--sub">
                    <span class="dash-job__qty">
                        {{ j.qty_done }}/{{ j.qty_total }}
                        <span v-if="j.qty_active" class="blue--text">(+{{ j.qty_active }})</span>
                    </span>
                    <span
                        class="dash-job__weight"
                        :title="j.weight_complete ? '' : $t('FleetDashboard.WeightIncomplete')">
                        <v-icon small class="mr-1">{{ mdiWeight }}</v-icon>
                        {{ j.weight_complete ? '' : '~' }}{{ formatGrams(j.grams_done) }}
                        {{ $t('FleetDashboard.Done') }} · {{ j.weight_complete ? '' : '~'
                        }}{{ formatGrams(j.grams_left) }} {{ $t('FleetDashboard.Left') }}
                    </span>
                    <span class="dash-job__materials">
                        <span
                            v-for="m in j.materials"
                            :key="m.filament_type"
                            class="dash-job__material"
                            :title="`${m.filament_type}: ${formatGrams(m.grams_done)} done · ${formatGrams(
                                m.grams_left
                            )} left`">
                            {{ m.filament_type }} {{ formatGrams(m.grams_left) }}
                        </span>
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import { mdiBriefcaseOutline, mdiHammer, mdiWeight } from '@mdi/js'
import BaseMixin from '@/components/mixins/base'
import { FleetJobForecast } from '@/store/fleet/jobs/types'
import { formatGrams, formatHoursDh } from '@/store/fleet/forecast'

/** Open fleet jobs (in_progress + pending) with workers, print-time and filament progress. */
@Component
export default class DashboardJobsPanel extends Mixins(BaseMixin) {
    mdiBriefcaseOutline = mdiBriefcaseOutline
    mdiHammer = mdiHammer
    mdiWeight = mdiWeight
    formatHoursDh = formatHoursDh
    formatGrams = formatGrams

    get jobs(): FleetJobForecast[] {
        return this.$store.getters['fleet/jobs/getForecast'] ?? []
    }

    get error(): string | null {
        return this.$store.getters['fleet/jobs/getForecastError']
    }

    get totalLeft(): number {
        return this.jobs.reduce((s, j) => s + (j.secs_left || 0), 0)
    }

    get totalGramsLeft(): number {
        return this.jobs.reduce((s, j) => s + (j.grams_left || 0), 0)
    }

    timePercent(j: FleetJobForecast): number {
        const total = (j.secs_done || 0) + (j.secs_left || 0)
        if (total <= 0) return j.qty_total ? Math.round((100 * j.qty_done) / j.qty_total) : 0
        return Math.min(100, Math.round((100 * (j.secs_done || 0)) / total))
    }

    statusColor(j: FleetJobForecast): string {
        if (j.hold_reason) return 'orange'
        return j.status === 'in_progress' ? 'blue' : 'grey'
    }

    statusText(j: FleetJobForecast): string {
        if (j.hold_reason) return this.$t('FleetDashboard.Paused') as string
        return j.status === 'in_progress' ? 'in progress' : 'pending'
    }

    openJob(id: number) {
        this.$router.push({ path: '/jobs', query: { openJob: String(id) } }).catch(() => {})
    }
}
</script>

<style scoped>
.dash-jobs {
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(128, 128, 128, 0.25);
    border-radius: 6px;
    padding: 8px 12px 10px;
}
.dash-jobs__head {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 24px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 6px;
    flex: 0 0 auto;
}
.dash-jobs__pill {
    font-size: 22px;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 9px;
    background: var(--v-primary-base, #f0d3b0);
    color: #1a1712;
}
.dash-jobs__totals {
    margin-left: auto;
    font-weight: 500;
    text-transform: none;
    letter-spacing: 0;
}
.dash-jobs__alert {
    font-size: 24px;
}
.dash-jobs__empty {
    font-size: 24px;
    opacity: 0.6;
    padding: 6px 0;
}
.dash-jobs__list {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.dash-job {
    padding: 6px 8px;
    border-radius: 6px;
    background: rgba(128, 128, 128, 0.08);
    cursor: pointer;
}
.dash-job:hover {
    background: rgba(128, 128, 128, 0.16);
}
.dash-job__row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 24px;
    min-width: 0;
}
.dash-job__row--sub {
    margin-top: 3px;
    font-size: 22px;
    opacity: 0.85;
    flex-wrap: wrap;
}
.dash-job__name {
    font-weight: 700;
    font-size: 26px;
    min-width: 0;
}
.dash-job__customer {
    opacity: 0.7;
    min-width: 0;
    max-width: 30%;
}
.dash-job__workers {
    margin-left: auto;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-weight: 600;
}
.dash-job__bar {
    margin-top: 4px;
    font-variant-numeric: tabular-nums;
}
.dash-job__bar-text {
    font-size: 22px;
    font-weight: 700;
    color: #fff;
    text-shadow: 0 0 3px rgba(0, 0, 0, 0.7);
    white-space: nowrap;
}
.dash-job__bar-pct {
    margin-left: 6px;
    opacity: 0.85;
}
.dash-job__qty {
    font-variant-numeric: tabular-nums;
}
.dash-job__weight {
    display: inline-flex;
    align-items: center;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
}
.dash-job__materials {
    display: inline-flex;
    gap: 4px;
    flex-wrap: wrap;
    margin-left: auto;
}
.dash-job__material {
    font-size: 20px;
    padding: 0 6px;
    border-radius: 8px;
    border: 1px solid rgba(128, 128, 128, 0.45);
    white-space: nowrap;
}
</style>
