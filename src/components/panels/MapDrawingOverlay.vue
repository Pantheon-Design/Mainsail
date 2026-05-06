<template>
    <div class="map-drawing-overlay" :class="{ editable }">
        <svg
            ref="svg"
            class="drawing-svg"
            :viewBox="`0 0 ${width} ${height}`"
            :width="width"
            :height="height"
            preserveAspectRatio="none"
            @mousedown.stop="onMouseDown"
            @mousemove="onMouseMove"
            @mouseup="onMouseUp"
            @mouseleave="onMouseUp"
        >
            <polyline
                v-for="stroke in strokesWithCurrent"
                :key="stroke.id"
                :points="pointsToString(stroke.points)"
                :stroke="stroke.color"
                :stroke-width="stroke.width"
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        </svg>
    </div>
</template>

<script lang="ts">
import { Component, Mixins, Prop } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import { GuiStateMapDrawingStroke } from '@/store/gui/types'

@Component({})
export default class MapDrawingOverlay extends Mixins(BaseMixin) {
    @Prop({ type: Boolean, default: false }) declare editable: boolean
    @Prop({ type: Number, default: 1000 }) declare width: number
    @Prop({ type: Number, default: 500 }) declare height: number
    @Prop({ type: String, default: 'mapdrawing.strokes' }) declare storageKey: string
    @Prop({ type: String, default: '#ff0000' }) declare color: string
    @Prop({ type: Number, default: 3 }) declare strokeWidth: number

    private currentStroke: GuiStateMapDrawingStroke | null = null

    get strokes(): GuiStateMapDrawingStroke[] {
        const segments = this.storageKey.split('.')
        let node: any = this.$store.state.gui
        for (const seg of segments) {
            if (node == null) return []
            node = node[seg]
        }
        return Array.isArray(node) ? node : []
    }

    get strokesWithCurrent(): GuiStateMapDrawingStroke[] {
        if (this.currentStroke) return [...this.strokes, this.currentStroke]
        return this.strokes
    }

    pointsToString(points: { x: number; y: number }[]): string {
        return points.map((p) => `${p.x},${p.y}`).join(' ')
    }

    private svgCoords(event: MouseEvent): { x: number; y: number } {
        const svg = this.$refs.svg as SVGSVGElement
        const rect = svg.getBoundingClientRect()
        const x = ((event.clientX - rect.left) / rect.width) * this.width
        const y = ((event.clientY - rect.top) / rect.height) * this.height
        return { x, y }
    }

    onMouseDown(event: MouseEvent) {
        if (!this.editable) return
        const point = this.svgCoords(event)
        this.currentStroke = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            color: this.color,
            width: this.strokeWidth,
            points: [point],
        }
    }

    onMouseMove(event: MouseEvent) {
        if (!this.editable || !this.currentStroke) return
        const point = this.svgCoords(event)
        const last = this.currentStroke.points[this.currentStroke.points.length - 1]
        if (Math.abs(point.x - last.x) < 1 && Math.abs(point.y - last.y) < 1) return
        this.currentStroke.points.push(point)
        this.currentStroke = { ...this.currentStroke, points: [...this.currentStroke.points] }
    }

    onMouseUp() {
        if (!this.editable || !this.currentStroke) return
        if (this.currentStroke.points.length > 1) {
            const updated = [...this.strokes, this.currentStroke]
            this.persistStrokes(updated)
        }
        this.currentStroke = null
    }

    private persistStrokes(value: GuiStateMapDrawingStroke[]) {
        this.$store.dispatch('gui/saveSetting', { name: this.storageKey, value })
    }
}
</script>

<style scoped>
.map-drawing-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
}

.drawing-svg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}

.map-drawing-overlay.editable {
    z-index: 5;
}

.map-drawing-overlay.editable .drawing-svg {
    pointer-events: auto;
    cursor: crosshair;
}
</style>
