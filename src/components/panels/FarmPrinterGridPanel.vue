<template>
    <div class="grid-tile"
         :class="{ 'tile-square': model === 'HS-Pro', 'tile-round': model !== 'HS-Pro', editing: isEditing }"
         :style="tileStyle">
        <div class="status-ring" :style="borderStyle"></div>
        <div class="tile-body" :style="bodyStyle">
            <div class="top-group">
                <div class="hostname" :title="hostname" :style="{ color: fgColorHi }">{{ hostname }}</div>
                <div class="info-row" :style="{ color: fgColorMid }">
                    <span class="filament">{{ filamentAbbr || '—' }}</span>
                    <span class="nozzle">{{ nozzle ? nozzle + 'mm' : '—' }}</span>
                </div>
                <div class="weight" :style="{ color: fgColorMid }">
                    {{ remainingG !== null ? Math.round(remainingG) + 'g' : '—' }}
                </div>
            </div>
            <div class="progress-track" :style="{ backgroundColor: fgColorFaint }">
                <div class="progress-bar" :style="{ width: progressPct + '%' }"></div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Mixins, Prop } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import ThemeMixin from '@/components/mixins/theme'
import { FarmPrinterState } from '@/store/farm/printer/types'
import {
    getStatusBorderStyle,
    displayFilamentType,
    getPrinterPrintPercent,
    computeRemainingFilamentG,
} from '@/components/panels/farmPrinterStatus'

@Component({})
export default class FarmPrinterGridPanel extends Mixins(BaseMixin, ThemeMixin) {
    @Prop({ type: Object, required: true }) declare printer: FarmPrinterState
    @Prop({ type: Boolean, default: false }) declare isEditing: boolean
    @Prop({ type: String, default: null }) declare model: 'HS-3' | 'HS-Pro' | null
    @Prop({ type: Boolean, default: false }) declare fleetDaemonConnected: boolean

    get hostname(): string {
        return (this.printer as any)?.socket?.hostname || ''
    }

    get filamentAbbr(): string {
        return displayFilamentType((this.printer as any)?.toolhead?.filament_type)
    }

    get nozzle(): string | number | null {
        return (this.printer as any)?.toolhead?.nozzle_size ?? null
    }

    get progressPct(): number {
        return getPrinterPrintPercent(this.printer)
    }

    get remainingG(): number | null {
        return computeRemainingFilamentG(this.printer)
    }

    get borderStyle(): Record<string, string | number> {
        return getStatusBorderStyle(this.printer, this.model, this.fleetDaemonConnected, 1, 'breathe')
    }

    get tileStyle(): Record<string, string> {
        const dark = this.$vuetify.theme.dark
        return {
            backgroundColor: dark ? '#282828' : '#e7e7e7',
            color: this.fgColorHi,
        }
    }

    get bodyStyle(): Record<string, string> {
        return this.model === 'HS-Pro'
            ? { inset: '14px' }
            : { inset: '22%' }
    }
}
</script>

<style scoped>
.grid-tile {
    position: relative;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    overflow: hidden;
    user-select: none;
    font-size: 10px;
    line-height: 1;
}

.grid-tile.tile-round {
    border-radius: 50%;
}

.grid-tile.tile-square {
    border-radius: 0;
}

.grid-tile.editing {
    cursor: move;
}

.status-ring {
    pointer-events: none;
}

.tile-body {
    position: absolute;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    text-align: center;
    z-index: 1;
}

.top-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    gap: 1px;
}

.hostname {
    font-weight: 700;
    font-size: 13px;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.info-row {
    display: flex;
    justify-content: space-between;
    width: 100%;
    gap: 4px;
    font-size: 11px;
}

.info-row .filament {
    font-weight: 700;
}

.weight {
    font-size: 11px;
}

.progress-track {
    width: 100%;
    height: 4px;
    border-radius: 2px;
    overflow: hidden;
}

.progress-bar {
    height: 100%;
    background-color: #2196f3;
    transition: width 0.3s ease;
}
</style>
