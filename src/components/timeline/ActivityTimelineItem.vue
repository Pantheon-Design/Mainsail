<template>
    <v-timeline-item :icon="meta.icon" :color="meta.color" fill-dot small class="activity-timeline-event">
        <v-row class="pt-0" dense>
            <v-col class="pr-3">
                <div class="d-flex align-center flex-wrap">
                    <v-tooltip top>
                        <template #activator="{ on, attrs }">
                            <span class="caption text--secondary mr-2" v-bind="attrs" v-on="on">
                                {{ formatTime(event.ts * 1000, true) }}
                            </span>
                        </template>
                        <span>{{ formatDateTime(event.ts * 1000, true) }}</span>
                    </v-tooltip>
                    <span class="font-weight-medium mr-2">{{ event.summary || typeLabel }}</span>
                    <v-chip
                        v-if="showPrinter && event.printer_hostname"
                        x-small
                        outlined
                        label
                        class="mr-1"
                        color="secondary">
                        {{ printerLabel }}
                    </v-chip>
                    <v-chip x-small outlined class="mr-1" :color="sourceColor">
                        {{ sourceLabel }}
                    </v-chip>
                    <v-chip
                        v-if="event.tier === 2"
                        x-small
                        class="mr-1"
                        color="grey darken-2"
                        text-color="grey lighten-2">
                        {{ $t('Timeline.Tier.Verbose') }}
                    </v-chip>
                    <v-chip v-if="event.deleted" x-small color="error" outlined class="mr-1">
                        {{ $t('Timeline.Deleted') }}
                    </v-chip>
                    <v-tooltip v-if="nozzleHealth" top>
                        <template #activator="{ on, attrs }">
                            <v-chip
                                x-small
                                label
                                class="mr-1"
                                :color="nozzleHealthColor(nozzleHealth.health_pct)"
                                :outlined="nozzleHealth.source === 'daemon'"
                                v-bind="attrs"
                                v-on="on">
                                <v-icon x-small left>{{ mdiPrinter3dNozzleHeat }}</v-icon>
                                {{ formatPct(nozzleHealth.health_pct) }}
                                <span v-if="nozzleHealthAfter" class="ml-1">→ {{ formatPct(nozzleHealthAfter.health_pct) }}</span>
                            </v-chip>
                        </template>
                        <span>{{ nozzleChipTooltip }}</span>
                    </v-tooltip>
                    <v-tooltip v-if="motion" top>
                        <template #activator="{ on, attrs }">
                            <v-chip
                                x-small
                                label
                                class="mr-1"
                                color="info"
                                :outlined="motionEstimated"
                                v-bind="attrs"
                                v-on="on">
                                <v-icon x-small left>{{ mdiAxisArrow }}</v-icon>
                                <span v-if="motionXyTravel !== null">
                                    XY {{ formatDistance(motionXyTravel) }} {{ $t('Timeline.Motion.SinceLast') }}
                                </span>
                                <span v-else>{{ $t('Timeline.Motion.Baseline') }}</span>
                            </v-chip>
                        </template>
                        <span>{{ motionChipTooltip }}</span>
                    </v-tooltip>
                    <v-spacer />
                    <v-btn v-if="isEditableService" icon x-small class="mr-1" @click="$emit('edit-service', event)">
                        <v-icon small>{{ mdiPencil }}</v-icon>
                    </v-btn>
                    <v-btn v-if="isEditableService" icon x-small class="mr-1" @click="$emit('delete-service', event)">
                        <v-icon small>{{ mdiDelete }}</v-icon>
                    </v-btn>
                    <v-btn v-if="hasDetails" icon x-small @click="expanded = !expanded">
                        <v-icon small>{{ expanded ? mdiChevronUp : mdiChevronDown }}</v-icon>
                    </v-btn>
                </div>
                <div class="caption text--secondary">{{ typeLabel }}</div>
                <v-expand-transition>
                    <div v-if="expanded && hasDetails" class="mt-2">
                        <v-simple-table dense class="activity-details-table">
                            <tbody>
                                <tr v-if="event.filename">
                                    <td class="font-weight-bold" width="160">{{ $t('Timeline.Filename') }}</td>
                                    <td>
                                        {{ event.filename }}
                                        <v-btn
                                            v-if="event.job_id"
                                            x-small
                                            text
                                            color="primary"
                                            class="ml-2"
                                            @click="$emit('open-job', event)">
                                            <v-icon x-small left>{{ mdiOpenInNew }}</v-icon>
                                            {{ $t('Timeline.OpenJob') }}
                                        </v-btn>
                                    </td>
                                </tr>
                                <tr v-for="row of detailRows" :key="row.key">
                                    <td class="font-weight-bold" width="160">{{ row.label }}</td>
                                    <td class="activity-details-value">{{ row.value }}</td>
                                </tr>
                                <tr v-for="block of nozzleHealthBlocks" :key="block.key">
                                    <td class="font-weight-bold" width="160">{{ block.label }}</td>
                                    <td class="activity-details-value">
                                        <div class="d-flex align-center flex-wrap">
                                            <v-progress-linear
                                                :value="block.health.health_pct ?? 0"
                                                :color="nozzleHealthColor(block.health.health_pct)"
                                                height="8"
                                                rounded
                                                class="activity-nozzle-bar mr-3" />
                                            <span class="font-weight-medium mr-2">
                                                {{ formatPct(block.health.health_pct) }}
                                            </span>
                                            <span class="text--secondary">
                                                {{ formatKg(block.health.remaining_nozzle_life) }} /
                                                {{ formatKg(block.health.nozzle_life) }}
                                            </span>
                                        </div>
                                        <div class="caption text--secondary">
                                            <span v-if="formatNozzle(block.health)">{{ formatNozzle(block.health) }}</span>
                                            <span v-if="block.health.filament_type"> · {{ block.health.filament_type }}</span>
                                            <span v-if="block.health.odometer_e != null">
                                                · {{ $t('Timeline.NozzleHealth.OdometerE') }}
                                                {{ (block.health.odometer_e / 1000).toFixed(1) }} m
                                            </span>
                                            <span v-if="block.health.source === 'daemon'">
                                                · {{ $t('Timeline.NozzleHealth.Estimated') }}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                                <tr v-if="motion">
                                    <td class="font-weight-bold" width="160">{{ $t('Timeline.Motion.AtService') }}</td>
                                    <td class="activity-details-value">
                                        <div v-for="row of motionRows" :key="row.axis" class="d-flex align-center flex-wrap">
                                            <span class="font-weight-medium activity-motion-axis">{{ row.axis }}</span>
                                            <span class="mr-3">
                                                {{ $t('Timeline.Motion.Odometer') }} {{ formatDistance(row.odometer) }}
                                            </span>
                                            <span v-if="row.since !== null" class="text--secondary">
                                                +{{ formatDistance(row.since) }} {{ $t('Timeline.Motion.SinceLast') }}
                                            </span>
                                        </div>
                                        <div class="caption text--secondary">
                                            <span v-if="motionSince && motionSince.days !== null">
                                                {{ $t('Timeline.Motion.Days', { days: motionSince.days }) }}
                                            </span>
                                            <span v-if="motionSince && motionSince.prev_ts">
                                                ·
                                                {{
                                                    $t('Timeline.Motion.PreviousOn', {
                                                        type: serviceTypeLabel,
                                                        date: formatDateTime(motionSince.prev_ts * 1000),
                                                    })
                                                }}
                                            </span>
                                            <span v-if="!motionSince">{{ $t('Timeline.Motion.Baseline') }}</span>
                                            <span v-if="motionTripmeter">· {{ $t('Timeline.Motion.Tripmeter') }} {{ motionTripmeter }}</span>
                                            <span v-if="motion.basis === 'daily_snapshot'">· {{ $t('Timeline.Motion.DailyBasis') }}</span>
                                            <span v-if="motionEstimated">· {{ $t('Timeline.Motion.Estimated') }}</span>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </v-simple-table>
                    </div>
                </v-expand-transition>
            </v-col>
        </v-row>
    </v-timeline-item>
</template>

<script lang="ts">
import { Component, Mixins, Prop } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import {
    mdiAxisArrow,
    mdiChevronDown,
    mdiChevronUp,
    mdiDelete,
    mdiOpenInNew,
    mdiPencil,
    mdiPrinter3dNozzleHeat,
} from '@mdi/js'
import { ActivityEvent } from '@/components/timeline/types'
import { getActivityTypeMeta, getSourceColor } from '@/components/timeline/activityTypes'
import {
    NozzleHealth,
    formatKg,
    formatNozzle,
    formatPct,
    getNozzleHealth,
    getNozzleHealthAfter,
    nozzleHealthColor,
    nozzleHealthDetailKeys,
} from '@/components/timeline/nozzleHealth'
import {
    MotionSinceLast,
    MotionSnapshot,
    formatDistance,
    getMotion,
    getMotionSinceLast,
    motionAxes,
    motionDetailKeys,
    xyTravel,
} from '@/components/timeline/motion'

@Component
export default class ActivityTimelineItem extends Mixins(BaseMixin) {
    mdiAxisArrow = mdiAxisArrow
    mdiChevronDown = mdiChevronDown
    mdiChevronUp = mdiChevronUp
    mdiDelete = mdiDelete
    mdiOpenInNew = mdiOpenInNew
    mdiPencil = mdiPencil
    mdiPrinter3dNozzleHeat = mdiPrinter3dNozzleHeat

    formatKg = formatKg
    formatPct = formatPct
    formatNozzle = formatNozzle
    nozzleHealthColor = nozzleHealthColor
    formatDistance = formatDistance

    expanded = false

    @Prop({ required: true }) readonly event!: ActivityEvent
    @Prop({ default: false }) readonly showPrinter!: boolean
    @Prop({ default: false }) readonly canEditService!: boolean

    get meta() {
        return getActivityTypeMeta(this.event.type)
    }

    get typeLabel(): string {
        const key = `Timeline.Types.${this.event.type}`
        if (this.$te(key)) return this.$t(key).toString()

        return this.event.type
    }

    get sourceLabel(): string {
        const source = this.event.source || 'system'
        const key = `Timeline.Sources.${source}`
        const label = this.$te(key) ? this.$t(key).toString() : source
        if (this.event.client && this.event.client.toLowerCase() !== source) return `${label} (${this.event.client})`

        return label
    }

    get sourceColor(): string {
        return getSourceColor(this.event.source)
    }

    get printerLabel(): string {
        return (this.event.printer_hostname ?? '').replace(/\.local$/, '')
    }

    get isEditableService(): boolean {
        return this.canEditService && this.event.type === 'service' && !this.event.deleted
    }

    /** Health of the nozzle at the moment of the change (before a reset). */
    get nozzleHealth(): NozzleHealth | null {
        return getNozzleHealth(this.event)
    }

    /** Health right after a nozzle_life_reset (null for other events). */
    get nozzleHealthAfter(): NozzleHealth | null {
        return getNozzleHealthAfter(this.event)
    }

    get nozzleChipTooltip(): string {
        const h = this.nozzleHealth
        if (!h) return ''
        const parts = [
            this.$t('Timeline.NozzleHealth.AtChange').toString(),
            `${formatKg(h.remaining_nozzle_life)} / ${formatKg(h.nozzle_life)}`,
        ]
        const nozzle = formatNozzle(h)
        if (nozzle) parts.push(nozzle)
        if (h.source === 'daemon') parts.push(this.$t('Timeline.NozzleHealth.Estimated').toString())

        return parts.join(' · ')
    }

    get nozzleHealthBlocks(): { key: string; label: string; health: NozzleHealth }[] {
        const blocks: { key: string; label: string; health: NozzleHealth }[] = []
        const before = this.nozzleHealth
        const after = this.nozzleHealthAfter
        if (before) {
            const labelKey = after ? 'Timeline.NozzleHealth.Before' : 'Timeline.NozzleHealth.AtChange'
            blocks.push({ key: 'nozzle_health', label: this.$t(labelKey).toString(), health: before })
        }
        if (after) blocks.push({ key: 'nozzle_health_after', label: this.$t('Timeline.NozzleHealth.After').toString(), health: after })

        return blocks
    }

    /** Travel counters at a lubrication / belts service (null for other events). */
    get motion(): MotionSnapshot | null {
        return getMotion(this.event)
    }

    /** Travel since the previous service of the same type (null = baseline). */
    get motionSince(): MotionSinceLast | null {
        return getMotionSinceLast(this.event)
    }

    get motionXyTravel(): number | null {
        return xyTravel(this.motionSince)
    }

    get motionEstimated(): boolean {
        return this.motion?.source === 'daemon' || this.motionSince?.source === 'daemon'
    }

    get serviceTypeLabel(): string {
        const stype = this.event.details?.service_type
        const key = `Timeline.ServiceTypes.${stype}`
        if (stype && this.$te(key)) return this.$t(key).toString()

        return this.event.details?.service_type_label ?? stype ?? ''
    }

    get motionRows(): { axis: string; odometer: number | null; since: number | null }[] {
        const m = this.motion
        if (!m) return []
        const s = this.motionSince

        return motionAxes.map((axis) => ({
            axis: axis.toUpperCase(),
            odometer: m.odometer[axis],
            since: s ? s[axis] : null,
        }))
    }

    /** "X 12.3 m · Y 11.9 m · Z 150 mm · E 6.1 m" or '' */
    get motionTripmeter(): string {
        const t = this.motion?.tripmeter
        if (!t) return ''

        return motionAxes
            .filter((axis) => t[axis] !== null)
            .map((axis) => `${axis.toUpperCase()} ${formatDistance(t[axis])}`)
            .join(' · ')
    }

    get motionChipTooltip(): string {
        const s = this.motionSince
        const parts: string[] = []
        if (s) {
            if (s.days !== null) parts.push(this.$t('Timeline.Motion.Days', { days: s.days }).toString())
            if (s.prev_ts) {
                parts.push(
                    this.$t('Timeline.Motion.PreviousOn', {
                        type: this.serviceTypeLabel,
                        date: this.formatDateTime(s.prev_ts * 1000),
                    }).toString()
                )
            }
        } else parts.push(this.$t('Timeline.Motion.AtService').toString())
        if (this.motionEstimated) parts.push(this.$t('Timeline.Motion.Estimated').toString())

        return parts.join(' · ')
    }

    get detailRows(): { key: string; label: string; value: string }[] {
        const details = this.event.details
        if (!details || typeof details !== 'object') return []

        return Object.keys(details)
            .filter((key) => !nozzleHealthDetailKeys.includes(key) && !motionDetailKeys.includes(key))
            .map((key) => {
            const raw = details[key]
            let value: string
            if (raw === null || raw === undefined) value = '—'
            else if (typeof raw === 'object') value = JSON.stringify(raw)
            else if (typeof raw === 'boolean') value = raw ? 'true' : 'false'
            else value = String(raw)

            const labelKey = `Timeline.DetailKeys.${key}`
            const label = this.$te(labelKey) ? this.$t(labelKey).toString() : key

            return { key, label, value }
        })
    }

    get hasDetails(): boolean {
        return this.detailRows.length > 0 || this.nozzleHealthBlocks.length > 0 || !!this.event.filename || !!this.motion
    }
}
</script>

<style scoped>
.activity-details-value {
    white-space: pre-wrap;
    word-break: break-word;
}
.activity-nozzle-bar {
    max-width: 140px;
    min-width: 80px;
}
.activity-motion-axis {
    display: inline-block;
    width: 1.5em;
}
</style>
