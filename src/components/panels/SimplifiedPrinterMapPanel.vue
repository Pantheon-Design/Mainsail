<template>
    <div style="position: relative; width: 100%; height: 100%;">
        <div style="position: absolute; top: 60%; left: 50%; transform: translate(-50%, -50%); width: 16px; height: 16px; background-color: #ffffff; text-align: center; color: #000000; border-radius: 2px;">
            <span :style="{
                  userSelect: 'none',
                  pointerEvents: 'none',
                  padding: '1px',
                  lineHeight: '1',
                  fontSize: displayFilamentType.length > 2 ? '8px' : '9px',
                  fontWeight: 'bold',
                  display: 'block'
                  }">
                {{ displayFilamentType }}
            </span>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Mixins, Prop } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'

@Component({})
export default class SimplifiedPrinterMapPanel extends Mixins(BaseMixin) {
    @Prop({ type: Object, required: true }) declare printer: any

    get displayFilamentType(): string {
        const filament = this.printer?.toolhead?.filament_type

        // Return abbreviations for known types
        switch (filament) {
            case "PA-CF":
                return "CN"
            case "PA-GF":
                return "GN"
            case "PETG-CF":
                return "CP"
            case "TPU":
                return "FL"
        }

        // For unknown or long custom names: first 2 + "..." + last char
        if (filament && filament.length > 4) {
            return `${filament.slice(0, 1)}..${filament.slice(-1)}`
        }

        // Otherwise return as-is (short custom names, null, etc.)
        return filament || ""
    }
}
</script>

<style scoped>
/* No additional styles needed - keeping it simple */
</style>
