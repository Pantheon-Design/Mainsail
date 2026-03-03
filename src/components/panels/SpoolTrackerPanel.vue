<template>
    <div>
        <panel :icon="mdiGauge" :title="$t('Panels.SpoolTrackerPanel.Headline')" card-class="spool-tracker-panel" :collapsible="true">
            <v-card-text>
                <v-row>
                    <v-col cols="12">
                        <v-row>
                            <v-col cols="6" class="pr-1">
                                <strong>{{ $t('Panels.SpoolTrackerPanel.FilamentType') }}:</strong>
                            </v-col>
                            <v-col cols="6" class="pl-1" :class="{ 'red--text': !canTrack }">
                                {{ displayFilamentType }}
                            </v-col>
                        </v-row>
                        <v-row>
                            <v-col cols="6" class="pr-1">
                                <strong>{{ $t('Panels.SpoolTrackerPanel.FilamentName') }}:</strong>
                            </v-col>
                            <v-col cols="6" class="pl-1" :class="{ 'red--text': !canTrack }">
                                {{ displayFilamentName }}
                            </v-col>
                        </v-row>
                        <v-row>
                            <v-col cols="6" class="pr-1">
                                <strong>{{ $t('Panels.SpoolTrackerPanel.RemainingWeight') }}:</strong>
                            </v-col>
                            <v-col cols="6" class="pl-1" :class="{ 'red--text': !canTrack }">
                                {{ displayRemainingWeight }}
                            </v-col>
                        </v-row>
                    </v-col>
                </v-row>
            </v-card-text>
        </panel>
    </div>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import Panel from '@/components/ui/Panel.vue'
import { mdiGauge } from '@mdi/js'

@Component({
    components: { Panel },
})
export default class SpooltrackerPanel extends Mixins(BaseMixin) {
    mdiGauge = mdiGauge

    get filamentType(): string {
        return this.$store.state.server.spoolTracker.filament_type ?? 'N/A'
    }

    get filamentName(): string {
        return this.$store.state.server.spoolTracker.filament_name ?? 'Unknown'
    }

    get remainingWeight(): number {
        return this.$store.state.server.spoolTracker.weights?.remaining_weight ?? 0
    }

    get canTrack(): boolean {
        return this.$store.state.server.spoolTracker.can_track ?? false
    }

    get displayFilamentType(): string {
        return this.filamentType || 'N/A'
    }

    get displayFilamentName(): string {
        return this.filamentName || 'Unknown'
    }

    get displayRemainingWeight(): string {
        if (!this.canTrack) {
            return this.$t('Panels.SpoolTrackerPanel.Untracked') as string
        }
        return `${this.remainingWeight.toFixed(1)}g`
    }
}
</script>

<style scoped></style>
