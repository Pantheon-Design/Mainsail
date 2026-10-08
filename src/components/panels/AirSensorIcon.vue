<template>
    <svg
        class="air-sensor-icon"
        :class="{ 'air-sensor-icon--offline': offline }"
        :width="size"
        :height="size * (44 / 40)"
        viewBox="0 0 40 44"
        xmlns="http://www.w3.org/2000/svg">
        <!-- antennas: from the top corners of the body up and outward, a dot at each tip -->
        <line x1="10" y1="12" x2="6" y2="3" :stroke="antennaColor" stroke-width="2.2" stroke-linecap="round" />
        <line x1="30" y1="12" x2="34" y2="3" :stroke="antennaColor" stroke-width="2.2" stroke-linecap="round" />
        <circle cx="6" cy="3" r="2.2" :fill="antennaColor" />
        <circle cx="34" cy="3" r="2.2" :fill="antennaColor" />
        <!-- body: rounded square filled with the band colour -->
        <rect
            x="4"
            y="12"
            width="32"
            height="28"
            rx="5"
            :fill="fill"
            :stroke="offline ? '#c4c4c4' : 'rgba(255,255,255,0.9)'"
            :stroke-dasharray="offline ? '4 3' : undefined"
            stroke-width="2" />
        <!-- reading of the selected metric -->
        <text
            x="20"
            :y="unit ? 24 : 29"
            text-anchor="middle"
            class="air-sensor-icon__value"
            :style="{ fontSize: valueFontSize + 'px' }">
            {{ value }}
        </text>
        <text v-if="unit" x="20" y="35" text-anchor="middle" class="air-sensor-icon__unit">{{ unit }}</text>
    </svg>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'

/**
 * Map marker for an air-quality sensor: a square body with two antennas, filled with the
 * quality-band colour of the selected metric and showing its exact reading.
 * Offline sensors get a grey dashed outline (the parent lowers the opacity).
 */
@Component
export default class AirSensorIcon extends Vue {
    /** rendered width in px (height follows the 40:44 viewBox) */
    @Prop({ type: Number, default: 36 }) readonly size!: number
    /** body fill (band colour, or the neutral grey) */
    @Prop({ type: String, default: '#9e9e9e' }) readonly fill!: string
    /** value text drawn inside the body */
    @Prop({ type: String, default: '' }) readonly value!: string
    /** unit drawn under the value (empty for unitless metrics) */
    @Prop({ type: String, default: '' }) readonly unit!: string
    @Prop({ type: Boolean, default: false }) readonly offline!: boolean

    get antennaColor(): string {
        return this.offline ? '#9e9e9e' : '#2b2824'
    }

    /** Shrink long readings (e.g. `1234`, `0.012`) so they stay inside the body. */
    get valueFontSize(): number {
        const len = this.value.length
        if (len <= 3) return 13
        if (len <= 4) return 11.5
        if (len <= 5) return 10
        return 8.5
    }
}
</script>

<style scoped>
.air-sensor-icon {
    display: block;
    overflow: visible;
    filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.4));
}
.air-sensor-icon--offline {
    opacity: 0.55;
    filter: none;
}
.air-sensor-icon__value,
.air-sensor-icon__unit {
    fill: #fff;
    font-family: Roboto, sans-serif;
    font-weight: 800;
    paint-order: stroke fill;
    stroke: rgba(0, 0, 0, 0.55);
    stroke-width: 2px;
    stroke-linejoin: round;
    letter-spacing: -0.02em;
    pointer-events: none;
}
.air-sensor-icon__unit {
    font-size: 7px;
    font-weight: 700;
}
</style>
