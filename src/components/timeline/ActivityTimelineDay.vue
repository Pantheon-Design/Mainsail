<template>
    <div>
        <v-timeline-item small class="activity-timeline-day">
            <v-row class="pt-0">
                <v-col class="pr-6">
                    <h3 class="caption">
                        {{ $t('Timeline.EventsOnDate', { date: groupDate }) }}
                    </h3>
                </v-col>
            </v-row>
        </v-timeline-item>
        <activity-timeline-item
            v-for="event of group.events"
            :key="event.id"
            :event="event"
            :show-printer="showPrinter"
            :can-edit-service="canEditService"
            @edit-service="$emit('edit-service', $event)"
            @delete-service="$emit('delete-service', $event)"
            @open-job="$emit('open-job', $event)" />
    </div>
</template>

<script lang="ts">
import { Component, Mixins, Prop } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import ActivityTimelineItem from '@/components/timeline/ActivityTimelineItem.vue'
import { ActivityDayGroup } from '@/components/timeline/types'

@Component({
    components: { ActivityTimelineItem },
})
export default class ActivityTimelineDay extends Mixins(BaseMixin) {
    @Prop({ required: true }) readonly group!: ActivityDayGroup
    @Prop({ default: false }) readonly showPrinter!: boolean
    @Prop({ default: false }) readonly canEditService!: boolean

    get groupDate() {
        return new Date(this.group.date).toLocaleDateString(this.browserLocale, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        })
    }
}
</script>
