<template>
    <v-dialog :value="value" max-width="520" @input="$emit('input', $event)">
        <panel
            :title="$t('Timeline.Settings.Title')"
            :icon="mdiCog"
            card-class="activity-settings-dialog"
            :margin-bottom="false">
            <template #buttons>
                <v-btn icon tile @click="close">
                    <v-icon>{{ mdiCloseThick }}</v-icon>
                </v-btn>
            </template>
            <v-card-text>
                <settings-row
                    :title="$t('Timeline.Settings.RetentionDays')"
                    :sub-title="$t('Timeline.Settings.RetentionDaysDescription')">
                    <v-text-field
                        v-model.number="retentionDays"
                        type="number"
                        min="1"
                        max="3650"
                        suffix="d"
                        dense
                        outlined
                        hide-details
                        :rules="[rules.positive]" />
                </settings-row>
                <v-divider class="my-2" />
                <settings-row
                    :title="$t('Timeline.Settings.RecordGcode')"
                    :sub-title="$t('Timeline.Settings.RecordGcodeDescription')">
                    <v-switch v-model="recordGcode" hide-details class="mt-0" />
                </settings-row>
                <v-divider class="my-2" />
                <settings-row
                    :title="$t('Timeline.Settings.CoalesceWindow')"
                    :sub-title="$t('Timeline.Settings.CoalesceWindowDescription')">
                    <v-text-field
                        v-model.number="coalesceWindow"
                        type="number"
                        min="0"
                        max="60"
                        step="1"
                        suffix="s"
                        dense
                        outlined
                        hide-details />
                </settings-row>
            </v-card-text>
            <v-card-actions>
                <v-spacer />
                <v-btn text @click="close">{{ $t('Timeline.Cancel') }}</v-btn>
                <v-btn color="primary" text :disabled="!isValid" @click="save">{{ $t('Timeline.Save') }}</v-btn>
            </v-card-actions>
        </panel>
    </v-dialog>
</template>

<script lang="ts">
import { Component, Mixins, Prop, Watch } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import Panel from '@/components/ui/Panel.vue'
import SettingsRow from '@/components/settings/SettingsRow.vue'
import { mdiCloseThick, mdiCog } from '@mdi/js'
import { ServerActivitySettings } from '@/store/server/activity/types'

@Component({
    components: { Panel, SettingsRow },
})
export default class ActivitySettingsDialog extends Mixins(BaseMixin) {
    mdiCloseThick = mdiCloseThick
    mdiCog = mdiCog

    @Prop({ required: true }) readonly value!: boolean

    retentionDays = 90
    recordGcode = true
    coalesceWindow = 10

    rules = {
        positive: (v: number) => (Number(v) >= 1 && Number(v) <= 3650) || 'range 1..3650',
    }

    get settings(): ServerActivitySettings {
        return this.$store.state.server.activity.settings
    }

    get isValid(): boolean {
        const days = Number(this.retentionDays)
        const win = Number(this.coalesceWindow)
        return Number.isFinite(days) && days >= 1 && days <= 3650 && Number.isFinite(win) && win >= 0 && win <= 60
    }

    @Watch('value')
    onValueChanged(newVal: boolean) {
        if (newVal) this.loadFromStore()
    }

    loadFromStore() {
        this.retentionDays = this.settings.retention_days
        this.recordGcode = this.settings.record_gcode
        this.coalesceWindow = this.settings.coalesce_window
    }

    close() {
        this.$emit('input', false)
    }

    save() {
        if (!this.isValid) return

        this.$store.dispatch('server/activity/saveSettings', {
            retention_days: Math.round(Number(this.retentionDays)),
            record_gcode: !!this.recordGcode,
            coalesce_window: Number(this.coalesceWindow),
        })
        this.$toast.success(this.$t('Timeline.Settings.Saved').toString())
        this.close()
    }
}
</script>
