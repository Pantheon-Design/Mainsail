<template>
    <div>
        <panel
            :icon="mdiWrench"
            :title="$t('Panels.ServiceTrackerPanel.Headline')"
            card-class="service-tracker-panel"
            :collapsible="true">
            <v-card-text class="pb-2">
                <!-- Nozzle Status -->
                <v-row no-gutters class="mb-1">
                    <v-col cols="12">
                        <div class="d-flex align-center justify-space-between mb-1">
                            <span class="text-subtitle-2 font-weight-bold">
                                {{ $t('Panels.ServiceTrackerPanel.NozzleStatus') }}
                            </span>
                            <v-btn icon x-small @click="openNozzleDialog" :title="$t('Panels.ServiceTrackerPanel.EditNozzle')">
                                <v-icon small>{{ mdiPencil }}</v-icon>
                            </v-btn>
                        </div>
                    </v-col>
                </v-row>
                <v-row no-gutters class="mb-1">
                    <v-col cols="6">
                        <span class="text-caption grey--text">{{ $t('Panels.ServiceTrackerPanel.NozzleType') }}</span>
                    </v-col>
                    <v-col cols="6" class="text-right">
                        <span class="text-caption">{{ nozzleType }}</span>
                    </v-col>
                </v-row>
                <v-row no-gutters class="mb-1">
                    <v-col cols="6">
                        <span class="text-caption grey--text">{{ $t('Panels.ServiceTrackerPanel.NozzleSize') }}</span>
                    </v-col>
                    <v-col cols="6" class="text-right">
                        <span class="text-caption">{{ nozzleSize }} mm</span>
                    </v-col>
                </v-row>
                <v-row no-gutters class="mb-1">
                    <v-col cols="6">
                        <span class="text-caption grey--text">{{ $t('Panels.ServiceTrackerPanel.NozzleLife') }}</span>
                    </v-col>
                    <v-col cols="6" class="text-right">
                        <span class="text-caption">{{ nozzleLife }} hrs</span>
                    </v-col>
                </v-row>
                <v-row no-gutters class="mb-1">
                    <v-col cols="6">
                        <span class="text-caption grey--text">{{ $t('Panels.ServiceTrackerPanel.RemainingNozzleLife') }}</span>
                    </v-col>
                    <v-col cols="6" class="text-right">
                        <span class="text-caption" :class="remainingNozzleLifeClass">{{ remainingNozzleLife }} hrs</span>
                    </v-col>
                </v-row>
                <v-row no-gutters class="mb-3">
                    <v-col cols="12">
                        <div class="d-flex align-center">
                            <v-progress-linear
                                :value="nozzleLifePercent"
                                :color="nozzleLifeColor"
                                background-color="grey darken-3"
                                height="12"
                                rounded
                                class="mr-2">
                            </v-progress-linear>
                            <span class="text-caption" style="min-width: 40px; text-align: right" :class="remainingNozzleLifeClass">
                                {{ nozzleLifePercent }}%
                            </span>
                        </div>
                    </v-col>
                </v-row>

                <v-divider class="mb-2" />

                <!-- Odometer -->
                <v-row no-gutters class="mb-1">
                    <v-col cols="12">
                        <span class="text-subtitle-2 font-weight-bold">
                            {{ $t('Panels.ServiceTrackerPanel.Odometer') }}
                        </span>
                    </v-col>
                </v-row>
                <v-row no-gutters class="mb-3">
                    <v-col cols="6" v-for="axis in axes" :key="'odo-' + axis" class="mb-1">
                        <span class="text-caption grey--text">{{ axis.toUpperCase() }}:</span>
                        <span class="text-caption ml-1">{{ formatDistance(odometer[axis]) }}</span>
                    </v-col>
                </v-row>

                <v-divider class="mb-2" />

                <!-- Tripmeter -->
                <v-row no-gutters class="mb-1">
                    <v-col cols="6">
                        <span class="text-subtitle-2 font-weight-bold">
                            {{ $t('Panels.ServiceTrackerPanel.Tripmeter') }}
                        </span>
                    </v-col>
                    <v-col cols="6" class="text-right">
                        <v-btn x-small text @click="resetAllTripmeter" :loading="isResettingAll">
                            {{ $t('Panels.ServiceTrackerPanel.ResetAll') }}
                        </v-btn>
                    </v-col>
                </v-row>
                <v-row no-gutters>
                    <v-col cols="6" v-for="axis in axes" :key="'trip-' + axis" class="mb-1 d-flex align-center">
                        <span class="text-caption grey--text">{{ axis.toUpperCase() }}:</span>
                        <span class="text-caption ml-1 mr-1">{{ formatDistance(tripmeter[axis]) }}</span>
                        <v-btn icon x-small @click="resetTripmeter(axis)" :loading="resettingAxis === axis">
                            <v-icon x-small>{{ mdiRestore }}</v-icon>
                        </v-btn>
                    </v-col>
                </v-row>
            </v-card-text>
        </panel>

        <!-- Nozzle Edit Dialog -->
        <v-dialog v-model="nozzleDialog" max-width="360" persistent>
            <v-card>
                <v-card-title class="text-subtitle-1">
                    {{ $t('Panels.ServiceTrackerPanel.EditNozzle') }}
                </v-card-title>
                <v-card-text>
                    <v-select
                        v-model="editNozzleTypeSelection"
                        :items="nozzleTypeOptions"
                        :label="$t('Panels.ServiceTrackerPanel.NozzleType')"
                        dense
                        outlined
                        class="mb-2">
                    </v-select>
                    <v-text-field
                        v-if="editNozzleTypeSelection === 'Custom'"
                        v-model="editCustomNozzleType"
                        :label="$t('Panels.ServiceTrackerPanel.CustomNozzleType')"
                        :counter="20"
                        maxlength="20"
                        dense
                        outlined
                        class="mb-2">
                    </v-text-field>
                    <v-text-field
                        v-model.number="editNozzleLife"
                        :label="$t('Panels.ServiceTrackerPanel.NozzleLife') + ' (hrs)'"
                        type="number"
                        min="0"
                        dense
                        outlined
                        class="mb-2">
                    </v-text-field>
                    <v-text-field
                        v-model.number="editRemainingNozzleLife"
                        :label="$t('Panels.ServiceTrackerPanel.RemainingNozzleLife') + ' (hrs)'"
                        type="number"
                        dense
                        outlined>
                    </v-text-field>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn text @click="nozzleDialog = false">
                        {{ $t('Panels.ServiceTrackerPanel.Cancel') }}
                    </v-btn>
                    <v-btn color="primary" text @click="saveNozzle" :disabled="!canSaveNozzle">
                        {{ $t('Panels.ServiceTrackerPanel.SaveNozzle') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import Panel from '@/components/ui/Panel.vue'
import { mdiWrench, mdiPencil, mdiRestore } from '@mdi/js'

@Component({
    components: { Panel },
})
export default class ServiceTrackerPanel extends Mixins(BaseMixin) {
    mdiWrench = mdiWrench
    mdiPencil = mdiPencil
    mdiRestore = mdiRestore

    readonly axes: Array<'x' | 'y' | 'z' | 'e'> = ['x', 'y', 'z', 'e']

    isResettingAll = false
    resettingAxis: string | null = null

    readonly nozzleTypeOptions = ['DLC Hardened Steel', 'Nickel Plated Copper', 'Custom']

    nozzleDialog = false
    editNozzleTypeSelection = 'DLC Hardened Steel'
    editCustomNozzleType = ''
    editNozzleLife = 0
    editRemainingNozzleLife = 0

    get canSaveNozzle(): boolean {
        if (this.editNozzleTypeSelection === 'Custom') {
            return this.editCustomNozzleType.trim().length > 0
        }
        return true
    }

    get resolvedNozzleType(): string {
        return this.editNozzleTypeSelection === 'Custom'
            ? this.editCustomNozzleType.trim()
            : this.editNozzleTypeSelection
    }

    get nozzleType(): string {
        return this.$store.state.printer.toolhead?.nozzle_type ?? 'N/A'
    }

    get nozzleSize(): number {
        return this.$store.state.printer.toolhead?.nozzle_size ?? 0
    }

    get nozzleLife(): number {
        return this.$store.state.printer.toolhead?.nozzle_life ?? 0
    }

    get remainingNozzleLife(): number {
        return this.$store.state.printer.toolhead?.remaining_nozzle_life ?? 0
    }

    get odometer(): { x: number; y: number; z: number; e: number } {
        const o = this.$store.state.printer.toolhead?.odometer
        return { x: o?.x ?? 0, y: o?.y ?? 0, z: o?.z ?? 0, e: o?.e ?? 0 }
    }

    get tripmeter(): { x: number; y: number; z: number; e: number } {
        const t = this.$store.state.printer.toolhead?.tripmeter
        return { x: t?.x ?? 0, y: t?.y ?? 0, z: t?.z ?? 0, e: t?.e ?? 0 }
    }

    get nozzleLifePercent(): number {
        if (this.nozzleLife <= 0) return 0
        const pct = Math.round((this.remainingNozzleLife / this.nozzleLife) * 100)
        return Math.max(0, Math.min(100, pct))
    }

    get nozzleLifeColor(): string {
        if (this.remainingNozzleLife <= 0) return 'error'
        if (this.nozzleLifePercent <= 20) return 'warning'
        return 'success'
    }

    get remainingNozzleLifeClass(): string {
        if (this.remainingNozzleLife <= 0) return 'error--text'
        if (this.nozzleLifePercent <= 20) return 'warning--text'
        return ''
    }

    formatDistance(mm: number): string {
        if (mm >= 1000) return (mm / 1000).toFixed(2) + ' m'
        return mm.toFixed(1) + ' mm'
    }

    openNozzleDialog() {
        const presets = this.nozzleTypeOptions.filter((o) => o !== 'Custom')
        if (presets.includes(this.nozzleType)) {
            this.editNozzleTypeSelection = this.nozzleType
            this.editCustomNozzleType = ''
        } else {
            this.editNozzleTypeSelection = 'Custom'
            this.editCustomNozzleType = this.nozzleType !== 'N/A' ? this.nozzleType : ''
        }
        this.editNozzleLife = this.nozzleLife
        this.editRemainingNozzleLife = this.remainingNozzleLife
        this.nozzleDialog = true
    }

    saveNozzle() {
        this.$store.dispatch('server/serviceTracker/setNozzleLife', {
            nozzle_type: this.resolvedNozzleType,
            nozzle_life: Number(this.editNozzleLife),
            remaining_nozzle_life: Number(this.editRemainingNozzleLife),
        })
        this.nozzleDialog = false
    }

    async resetTripmeter(axis: 'x' | 'y' | 'z' | 'e') {
        this.resettingAxis = axis
        await this.$store.dispatch('server/serviceTracker/resetTripmeter', axis)
        this.resettingAxis = null
    }

    async resetAllTripmeter() {
        this.isResettingAll = true
        for (const axis of this.axes) {
            await this.$store.dispatch('server/serviceTracker/resetTripmeter', axis)
        }
        this.isResettingAll = false
    }

}
</script>

<style scoped></style>
