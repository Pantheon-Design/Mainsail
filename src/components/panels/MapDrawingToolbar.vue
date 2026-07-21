<template>
    <div class="drawing-toolbar">
        <div class="toolbar-row">
            <label class="toolbar-label">Color</label>
            <div class="color-swatches">
                <button v-for="c in colorPalette"
                        :key="c"
                        type="button"
                        class="swatch"
                        :class="{ active: color === c }"
                        :style="{ backgroundColor: c }"
                        @click="setColor(c)" />
            </div>
            <input :value="color" type="color" class="color-input" @input="onColorPickerInput" />
        </div>
        <div class="toolbar-row">
            <label class="toolbar-label">Width</label>
            <input :value="strokeWidth"
                   type="range"
                   min="1"
                   max="20"
                   step="1"
                   class="width-slider"
                   @input="onWidthInput" />
            <span class="width-value">{{ strokeWidth }}px</span>
        </div>
        <div class="toolbar-row">
            <v-btn x-small :disabled="strokes.length === 0" @click="undo">Undo</v-btn>
            <v-btn x-small color="error" :disabled="strokes.length === 0" @click="clearAll">Clear</v-btn>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Mixins, Prop } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import { GuiStateMapDrawingStroke } from '@/store/gui/types'

@Component({})
export default class MapDrawingToolbar extends Mixins(BaseMixin) {
    @Prop({ type: String, default: '#ff0000' }) declare color: string
    @Prop({ type: Number, default: 3 }) declare strokeWidth: number
    @Prop({ type: String, default: 'mapdrawing.farmStrokes' }) declare storageKey: string

    private colorPalette = ['#ff0000', '#ff9800', '#ffeb3b', '#4caf50', '#2196f3', '#9c27b0', '#ffffff', '#000000']

    get strokes(): GuiStateMapDrawingStroke[] {
        const segments = this.storageKey.split('.')
        let node: any = this.$store.state.gui
        for (const seg of segments) {
            if (node == null) return []
            node = node[seg]
        }
        return Array.isArray(node) ? node : []
    }

    setColor(c: string) {
        this.$emit('update:color', c)
    }

    onColorPickerInput(event: Event) {
        const target = event.target as HTMLInputElement
        this.$emit('update:color', target.value)
    }

    onWidthInput(event: Event) {
        const target = event.target as HTMLInputElement
        this.$emit('update:strokeWidth', Number(target.value))
    }

    undo() {
        if (this.strokes.length === 0) return
        this.persist(this.strokes.slice(0, -1))
    }

    clearAll() {
        if (this.strokes.length === 0) return
        this.persist([])
    }

    private persist(value: GuiStateMapDrawingStroke[]) {
        this.$store.dispatch('gui/saveSetting', { name: this.storageKey, value })
    }
}
</script>

<style scoped>
.drawing-toolbar {
    display: inline-flex;
    flex-direction: column;
    gap: 6px;
    background: rgba(30, 30, 30, 0.9);
    color: #fff;
    padding: 8px 10px;
    border-radius: 6px;
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
