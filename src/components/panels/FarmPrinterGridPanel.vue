<template>
    <div class="grid-tile"
         :class="{
             'tile-square': model === 'HS-Pro',
             'tile-round': model !== 'HS-Pro',
             editing: isEditing,
             clickable: !isEditing
         }"
         :style="tileStyle"
         @click="onTileClick">
        <div class="status-ring" :style="borderStyle"></div>
        <div class="tile-body" :style="bodyStyle">
            <div class="hostname" :title="hostname" :style="{ color: fgColorHi }">{{ hostname }}</div>
            <div class="bottom-group">
                <div class="info-row" :style="{ color: fgColorMid }">
                    <span class="filament">{{ filamentAbbr || '—' }}</span>
                    <span class="nozzle">{{ nozzle ? nozzle + 'mm' : '—' }}</span>
                </div>
                <div class="weight" :style="{ color: fgColorMid }">
                    {{ remainingG !== null ? Math.round(remainingG) + 'g' : '—' }}
                </div>
                <div class="weight-track" :style="{ backgroundColor: fgColorFaint }">
                    <div class="weight-bar" :style="{ width: (remainingPct ?? 0) + '%' }"></div>
                </div>
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
    computeRemainingFilamentG,
    computeRemainingWeightPct,
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

    get remainingG(): number | null {
        return computeRemainingFilamentG(this.printer)
    }

    get remainingPct(): number | null {
        const v = computeRemainingWeightPct(this.printer)
        return v !== null ? Math.round(v) : null
    }

    get borderStyle(): Record<string, string | number> {
        return getStatusBorderStyle(this.printer, this.model, this.fleetDaemonConnected, 0.6, 'breathe', '#1976d2')
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

    onTileClick() {
        if (this.isEditing) return
        if ((this.printer as any)?.socket?.isConnected) {
            window.open(this.getPrinterUrl())
        } else {
            this.$store.dispatch('farm/' + (this.printer as any)._namespace + '/reconnect')
        }
    }

    getPrinterUrl(): string {
        const protocol = window.location.href.split('/')[0]
        const socket = (this.printer as any)?.socket
        const hostname = socket?.hostname ?? ''
        const webPort = socket?.webPort ?? 80
        let url = protocol + '//' + hostname
        if (webPort !== 80) url += ':' + webPort
        return url
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

.grid-tile.clickable {
    cursor: pointer;
    transition: filter 0.15s ease, box-shadow 0.15s ease;
}

.grid-tile.clickable:hover {
    filter: brightness(1.15);
    box-shadow: 0 0 8px 2px rgba(33, 150, 243, 0.4);
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

.bottom-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    gap: 2px;
}

.hostname {
    font-weight: 700;
    font-size: 13px;
    max-width: 100%;
    line-height: 1.1;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-word;
}

.info-row {
    display: flex;
    justify-content: space-between;
    width: 100%;
    gap: 4px;
    font-size: 13px;
}

.info-row .filament {
    font-weight: 700;
}

.weight {
    font-size: 13px;
}

.weight-track {
    width: 100%;
    height: 4px;
    border-radius: 2px;
    overflow: hidden;
}

.weight-bar {
    height: 100%;
    background-color: #2196f3;
    transition: width 0.3s ease;
}
</style>
