<template>
    <v-card flat>
        <v-card-text>
            <settings-row
                :title="$t('Settings.DashboardTab.FinishIntervals')"
                :sub-title="$t('Settings.DashboardTab.FinishIntervalsHint')"
                :mobile-second-row="true">
                <v-combobox
                    v-model="finishIntervalsHours"
                    hide-selected
                    hide-details="auto"
                    multiple
                    small-chips
                    :deletable-chips="true"
                    append-icon=""
                    type="number"
                    :rules="[(v) => v.length > 0 || $t('Settings.DashboardTab.MinimumValues')]"
                    dense
                    outlined
                    hide-spin-buttons />
            </settings-row>
            <v-divider class="my-2" />
            <settings-row :title="$t('Settings.DashboardTab.Reset')" :sub-title="$t('Settings.DashboardTab.ResetHint')">
                <v-btn small outlined color="primary" @click="reset">{{ $t('Settings.DashboardTab.Reset') }}</v-btn>
            </settings-row>
        </v-card-text>
    </v-card>
</template>

<script lang="ts">
import Component from 'vue-class-component'
import { Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import SettingsRow from '@/components/settings/SettingsRow.vue'
import { sanitizeIntervals } from '@/store/fleet/forecast'

const DEFAULT_INTERVALS = [1, 2]

/** Interface Settings > Dashboard: hour marks for the "prints finishing within" forecast. */
@Component({
    components: { SettingsRow },
})
export default class SettingsDashboardTab extends Mixins(BaseMixin) {
    get finishIntervalsHours(): number[] {
        return sanitizeIntervals(this.$store.state.gui.dashboard?.finishIntervalsHours)
    }

    set finishIntervalsHours(newVal: (number | string)[]) {
        this.$store.dispatch('gui/saveSetting', {
            name: 'dashboard.finishIntervalsHours',
            value: sanitizeIntervals(newVal),
        })
    }

    reset() {
        this.$store.dispatch('gui/saveSetting', {
            name: 'dashboard.finishIntervalsHours',
            value: [...DEFAULT_INTERVALS],
        })
    }
}
</script>
