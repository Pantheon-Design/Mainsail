<template>
    <panel
        :icon="mdiThermometerLines"
        :title="$t('Panels.TemperaturePanel.Headline')"
        :collapsible="true"
        card-class="temperature-panel">
        <template #buttons>
            <temperature-panel-presets />
            <temperature-panel-settings />
        </template>
        <v-card-text class="pa-0">
            <temperature-panel-list />
            <div v-if="!hasTemperatureObjects" class="text-center text--disabled py-3">
                {{ $t('Panels.TemperaturePanel.NoSensors') }}
            </div>
            <template v-if="boolTempchart">
                <v-divider class="my-0" />
                <temp-chart />
            </template>
        </v-card-text>
    </panel>
</template>

<script lang="ts">
import Component from 'vue-class-component'
import { Mixins } from 'vue-property-decorator'
import { capitalize, convertName } from '@/plugins/helpers'
import BaseMixin from '@/components/mixins/base'
import ControlMixin from '@/components/mixins/control'
import TempChart from '@/components/charts/TempChart.vue'
import TemperatureInput from '@/components/inputs/TemperatureInput.vue'
import Panel from '@/components/ui/Panel.vue'
import Responsive from '@/components/ui/Responsive.vue'
import { mdiCloseThick, mdiThermometerLines } from '@mdi/js'
import TemperaturePanelPresets from '@/components/panels/Temperature/TemperaturePanelPresets.vue'

@Component({
    components: { Panel, TempChart, TemperatureInput, Responsive, TemperaturePanelPresets },
})
export default class TemperaturePanel extends Mixins(BaseMixin, ControlMixin) {
    mdiCloseThick = mdiCloseThick
    mdiThermometerLines = mdiThermometerLines

    convertName = convertName
    capitalize = capitalize

    get boolTempchart(): boolean {
        return this.$store.state.gui.view.tempchart.boolTempchart ?? false
    }

    get hasTemperatureObjects(): boolean {
        const heaters = this.$store.state.printer?.heaters ?? {}
        const count =
            (heaters.available_heaters?.length ?? 0) +
            (heaters.available_sensors?.length ?? 0) +
            (heaters.available_monitors?.length ?? 0)

        return count > 0
    }
}
</script>
