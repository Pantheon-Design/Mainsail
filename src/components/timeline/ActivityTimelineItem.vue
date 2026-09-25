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
import { mdiChevronDown, mdiChevronUp, mdiDelete, mdiOpenInNew, mdiPencil } from '@mdi/js'
import { ActivityEvent } from '@/components/timeline/types'
import { getActivityTypeMeta, getSourceColor } from '@/components/timeline/activityTypes'

@Component
export default class ActivityTimelineItem extends Mixins(BaseMixin) {
    mdiChevronDown = mdiChevronDown
    mdiChevronUp = mdiChevronUp
    mdiDelete = mdiDelete
    mdiOpenInNew = mdiOpenInNew
    mdiPencil = mdiPencil

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

    get detailRows(): { key: string; label: string; value: string }[] {
        const details = this.event.details
        if (!details || typeof details !== 'object') return []

        return Object.keys(details).map((key) => {
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
        return this.detailRows.length > 0 || !!this.event.filename
    }
}
</script>

<style scoped>
.activity-details-value {
    white-space: pre-wrap;
    word-break: break-word;
}
</style>
