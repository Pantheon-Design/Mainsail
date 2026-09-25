<template>
    <div class="activity-timeline">
        <v-alert v-if="!loading && events.length === 0" dense text type="info" class="ma-3">
            {{ emptyText || $t('Timeline.NoEvents') }}
        </v-alert>
        <v-timeline v-else :class="timelineClassName" align-top dense>
            <activity-timeline-day
                v-for="group of groupedByDay"
                :key="group.key"
                :group="group"
                :show-printer="showPrinter"
                :can-edit-service="canEditService"
                @edit-service="$emit('edit-service', $event)"
                @delete-service="$emit('delete-service', $event)"
                @open-job="$emit('open-job', $event)" />
            <v-timeline-item v-if="hasMore" hide-dot class="activity-timeline-more">
                <v-btn small text color="primary" :loading="loadingMore" @click="$emit('load-more')">
                    {{ $t('Timeline.LoadMore') }}
                </v-btn>
            </v-timeline-item>
        </v-timeline>
    </div>
</template>

<script lang="ts">
import { Component, Mixins, Prop } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import ActivityTimelineDay from '@/components/timeline/ActivityTimelineDay.vue'
import { ActivityDayGroup, ActivityEvent } from '@/components/timeline/types'

@Component({
    components: { ActivityTimelineDay },
})
export default class ActivityTimeline extends Mixins(BaseMixin) {
    @Prop({ required: true }) readonly events!: ActivityEvent[]
    @Prop({ default: false }) readonly showPrinter!: boolean
    @Prop({ default: false }) readonly loading!: boolean
    @Prop({ default: false }) readonly hasMore!: boolean
    @Prop({ default: false }) readonly loadingMore!: boolean
    @Prop({ default: false }) readonly canEditService!: boolean
    @Prop({ default: '' }) readonly emptyText!: string

    /** Input is assumed newest-first; the store controls ordering, we only group. */
    get groupedByDay(): ActivityDayGroup[] {
        const output: ActivityDayGroup[] = []
        let lastKey: string | null = null

        this.events.forEach((event: ActivityEvent) => {
            const date = new Date((event.ts ?? 0) * 1000)
            const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`

            if (key !== lastKey) {
                output.push({ date, key, events: [] })
                lastKey = key
            }

            output[output.length - 1].events.push(event)
        })

        return output
    }

    get timelineClassName() {
        if (this.isMobile) return ['activity-timeline-list', 'mobile']

        return ['activity-timeline-list']
    }
}
</script>

<style scoped>
.activity-timeline-list {
    padding-top: 0;
}

::v-deep {
    .activity-timeline-day {
        padding-top: 24px;
        padding-bottom: 0;

        .v-timeline-item__dot--small {
            width: 18px;
            height: 15px;
            margin-top: 2px;

            &:before {
                display: block;
                content: ' ';
                position: relative;
                width: 18px;
                height: 2px;
                top: 7px;
                background: rgba(255, 255, 255, 0.5);
                z-index: 1;
            }
        }

        .v-timeline-item__inner-dot {
            background-color: #1e1e1e !important;
            border: 2px solid rgba(255, 255, 255, 0.5) !important;
            width: 8px;
            height: 8px;
            position: relative;
            z-index: 2;
            margin-left: 5px;
            margin-top: 2px;
        }
    }

    .activity-timeline-event {
        padding-bottom: 12px;
    }

    .activity-timeline-more .v-timeline-item__body {
        padding-top: 8px;
    }
}

::v-deep .activity-timeline-list.mobile {
    &:before {
        left: 20px;
    }

    .v-timeline-item__body {
        max-width: calc(100% - 41px);
    }

    .v-timeline-item__divider {
        min-width: 41px;
    }
}
</style>
