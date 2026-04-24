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

        <div v-if="editable" class="drawing-toolbar" @mousedown.stop>
            <div class="toolbar-row">
                <label class="toolbar-label">Color</label>
                <div class="color-swatches">
                    <button
                        v-for="c in colorPalette"
                        :key="c"
                        type="button"
                        class="swatch"
                        :class="{ active: color === c }"
                        :style="{ backgroundColor: c }"
                        @click="color = c"
                    />
                </div>
                <input v-model="color" type="color" class="color-input" />
            </div>
            <div class="toolbar-row">
                <label class="toolbar-label">Width</label>
                <input v-model.number="strokeWidth" type="range" min="1" max="20" step="1" class="width-slider" />
                <span class="width-value">{{ strokeWidth }}px</span>
            </div>
            <div class="toolbar-row">
                <v-btn x-small :disabled="strokes.length === 0" @click="undo">Undo</v-btn>
                <v-btn x-small color="error" :disabled="strokes.length === 0" @click="clearAll">Clear</v-btn>
            </div>
        </div>
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

    private color = '#ff0000'
    private strokeWidth = 3
    private currentStroke: GuiStateMapDrawingStroke | null = null

    private colorPalette = ['#ff0000', '#ff9800', '#ffeb3b', '#4caf50', '#2196f3', '#9c27b0', '#ffffff', '#000000']

    get strokes(): GuiStateMapDrawingStroke[] {
        return this.$store.state.gui?.mapdrawing?.strokes ?? []
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

    undo() {
        if (this.strokes.length === 0) return
        this.persistStrokes(this.strokes.slice(0, -1))
    }

    clearAll() {
        if (this.strokes.length === 0) return
        this.persistStrokes([])
    }

    private persistStrokes(value: GuiStateMapDrawingStroke[]) {
        this.$store.dispatch('gui/saveSetting', { name: 'mapdrawing.strokes', value })
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

.drawing-toolbar {
    position: absolute;
    top: 8px;
    right: 8px;
    background: rgba(30, 30, 30, 0.9);
    color: #fff;
    padding: 8px 10px;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    pointer-events: auto;
    z-index: 3;
    font-size: 12px;
    min-width: 220px;
}

.toolbar-row {
    display: flex;
    align-items: center;
    gap: 8px;
}

.toolbar-label {
    width: 45px;
    flex-shrink: 0;
}

.color-swatches {
    display: flex;
    gap: 3px;
    flex-wrap: wrap;
}

.swatch {
    width: 16px;
    height: 16px;
    border-radius: 3px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    cursor: pointer;
    padding: 0;
}

.swatch.active {
    border: 2px solid #fff;
}

.color-input {
    width: 24px;
    height: 20px;
    border: none;
    background: transparent;
    cursor: pointer;
    padding: 0;
}

.width-slider {
    flex: 1;
}

.width-value {
    width: 36px;
    text-align: right;
}
</style>
