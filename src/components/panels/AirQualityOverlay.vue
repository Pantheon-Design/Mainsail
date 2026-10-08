<template>
    <canvas
        ref="c"
        class="air-quality-overlay"
        :width="bufferW"
        :height="bufferH"
        :style="{
            width: width + 'px',
            height: height + 'px',
            opacity: opacity,
            filter: 'blur(' + blurPx + 'px)',
        }"></canvas>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator'
import { AirMetric, AirMetricBand } from '@/store/fleet/air/types'
import { bandFor, hexToRgb } from '@/components/panels/airQualityBands'

/** One sensor's contribution: cell centre + radius in grid px and its reading of the selected metric. */
export interface AirField {
    cx: number
    cy: number
    radius: number
    value: number
}

/**
 * Air-quality colour field under the map markers.
 *
 * Drawn as a low-resolution canvas (1 buffer px per `scale` grid px) upscaled by CSS and
 * softened with a small blur. Per buffer pixel the sensor VALUES are blended with
 * inverse-distance weights and the blended value is mapped to one band colour, so two
 * overlapping sensors never mix green and red into brown. Inside a sensor's range the
 * coverage is 1; from the range edge it fades to transparent over another
 * `(fadeFactor - 1) * range`, which is the "air slowly recovers" look outside the range.
 *
 * ~43k pixels x 20 sensors is a few ms; renders are coalesced (trailing timer + rAF).
 */
@Component
export default class AirQualityOverlay extends Vue {
    /** grid size in px (the map's gridW / gridH) */
    @Prop({ type: Number, required: true }) readonly width!: number
    @Prop({ type: Number, required: true }) readonly height!: number
    /** online sensors with a reading for the selected metric, in grid px */
    @Prop({ type: Array, default: () => [] }) readonly fields!: AirField[]
    @Prop({ type: Object, default: null }) readonly metric!: AirMetric | null
    /** grid px per buffer px */
    @Prop({ type: Number, default: 4 }) readonly scale!: number
    @Prop({ type: Number, default: 0.4 }) readonly opacity!: number
    /** the field reaches `fadeFactor * radius` before it is fully transparent */
    @Prop({ type: Number, default: 1.5 }) readonly fadeFactor!: number
    @Prop({ type: Number, default: 4 }) readonly blurPx!: number
    /** distance (grid px) at which a sensor's weight has halved, for the value blend */
    @Prop({ type: Number, default: 46 }) readonly cell!: number

    private renderTimer: ReturnType<typeof setTimeout> | null = null
    private raf: number | null = null
    /** coalescing window; matches fleetDaemonClient FLUSH_MS */
    static readonly RENDER_MS = 250

    get bufferW(): number {
        return Math.max(1, Math.ceil(this.width / this.scale))
    }

    get bufferH(): number {
        return Math.max(1, Math.ceil(this.height / this.scale))
    }

    mounted() {
        this.draw()
    }

    beforeDestroy() {
        if (this.renderTimer) clearTimeout(this.renderTimer)
        if (this.raf !== null) cancelAnimationFrame(this.raf)
    }

    @Watch('fields', { deep: true })
    @Watch('metric')
    @Watch('bufferW')
    @Watch('bufferH')
    @Watch('fadeFactor')
    onInputsChanged() {
        this.scheduleRender()
    }

    scheduleRender() {
        if (this.renderTimer) return
        this.renderTimer = setTimeout(() => {
            this.renderTimer = null
            if (this.raf !== null) cancelAnimationFrame(this.raf)
            this.raf = requestAnimationFrame(() => {
                this.raf = null
                this.draw()
            })
        }, AirQualityOverlay.RENDER_MS)
    }

    draw() {
        const canvas = this.$refs.c as HTMLCanvasElement | undefined
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        const w = this.bufferW
        const h = this.bufferH
        ctx.clearRect(0, 0, w, h)

        const metric = this.metric
        const fields = this.fields.filter((f) => Number.isFinite(f.value) && f.radius > 0)
        if (!metric || !metric.bands?.length || !fields.length) return

        // band colours resolved once per render
        const rgbByBand = new Map<AirMetricBand, [number, number, number]>()
        metric.bands.forEach((b) => rgbByBand.set(b, hexToRgb(b.color)))

        const image = ctx.createImageData(w, h)
        const data = image.data
        const scale = this.scale
        const fade = Math.max(1.0001, this.fadeFactor)
        const halfW = Math.max(1, this.cell)
        const smoothstep = (t: number) => {
            const x = Math.min(1, Math.max(0, t))
            return x * x * (3 - 2 * x)
        }

        for (let j = 0; j < h; j++) {
            const py = (j + 0.5) * scale
            for (let i = 0; i < w; i++) {
                const px = (i + 0.5) * scale
                let sumW = 0
                let sumV = 0
                let alpha = 0
                for (const f of fields) {
                    const dx = px - f.cx
                    const dy = py - f.cy
                    const d = Math.sqrt(dx * dx + dy * dy)
                    const outer = f.radius * fade
                    if (d > outer) continue
                    const coverage = d <= f.radius ? 1 : 1 - smoothstep((d - f.radius) / (outer - f.radius))
                    if (coverage <= 0) continue
                    const dn = d / halfW
                    const weight = coverage / (1 + dn * dn)
                    sumW += weight
                    sumV += weight * f.value
                    alpha = 1 - (1 - alpha) * (1 - coverage)
                }
                if (sumW <= 0) continue
                const band = bandFor(metric, sumV / sumW)
                if (!band) continue
                const rgb = rgbByBand.get(band) ?? hexToRgb(band.color)
                const idx = (j * w + i) * 4
                data[idx] = rgb[0]
                data[idx + 1] = rgb[1]
                data[idx + 2] = rgb[2]
                data[idx + 3] = Math.round(255 * alpha)
            }
        }
        ctx.putImageData(image, 0, 0)
    }
}
</script>

<style scoped>
.air-quality-overlay {
    position: absolute;
    left: 0;
    top: 0;
    pointer-events: none;
    image-rendering: auto;
}
</style>
