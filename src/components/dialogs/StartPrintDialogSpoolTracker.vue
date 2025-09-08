<template>
    <div>
        <v-divider class="mt-3 mb-0" />
        <v-card-text class="py-0 px-2">
            <!-- Show current filament info if tracking is enabled -->
            <div v-if="canTrack" class="my-2 px-3">
                <v-row dense>
                    <v-col cols="4" class="text-caption text--secondary">Filament:</v-col>
                    <v-col cols="8" class="text-body-2">{{ filamentName }}</v-col>
                </v-row>
                <v-row dense>
                    <v-col cols="4" class="text-caption text--secondary">Type:</v-col>
                    <v-col cols="8" class="text-body-2">{{ filamentType }}</v-col>
                </v-row>
                <v-row dense>
                    <v-col cols="4" class="text-caption text--secondary">Remaining:</v-col>
                    <v-col cols="8" class="text-body-2">{{ remainingWeightDisplay }}</v-col>
                </v-row>
            </div>

            <!-- Show alerts for various conditions -->
            <v-alert v-for="alert in alerts" :key="alert.text" text :color="alert.color" class="mt-4 mx-3">
                {{ alert.text }}
            </v-alert>
        </v-card-text>
        <v-divider :class="classSecondDivider" />
    </div>
</template>

<script lang="ts">
    import { Component, Mixins, Prop } from 'vue-property-decorator'
    import BaseMixin from '@/components/mixins/base'
    import { FileStateGcodefile } from '@/store/files/types'

    @Component({})
    export default class StartPrintDialogSpoolTracker extends Mixins(BaseMixin) {
        @Prop({ required: true }) readonly file!: FileStateGcodefile

        get canTrack() {
            return this.$store.state.server.spoolTracker?.can_track ?? false
        }

        get filamentType() {
            return this.$store.state.server.spoolTracker?.filament_type ?? 'N/A'
        }

        get filamentName() {
            return this.$store.state.server.spoolTracker?.filament_name ?? 'Unknown'
        }

        get remainingWeight() {
            return this.$store.state.server.spoolTracker?.weights?.remaining_weight ?? 0
        }

        get remainingWeightDisplay() {
            if (!this.canTrack) return 'Untracked'
            return `${this.remainingWeight.toFixed(1)}g`
        }

        get classSecondDivider() {
            const classes = ['mt-4']
            classes.push(this.moonrakerComponents.includes('timelapse') ? 'mb-2' : 'mb-0')
            return classes
        }

        get alerts() {
            let alerts = []

            // Alert if tracking is disabled
            if (!this.canTrack) {
                alerts.push({
                    text: 'Filament tracking is disabled. No filament weight is being monitored.',
                    color: 'orange',
                })
                return alerts
            }

            // Alert if no filament is configured
            if (this.filamentType === 'N/A') {
                alerts.push({
                    text: 'No filament type configured in spool tracker.',
                    color: 'orange',
                })
                return alerts
            }

            // Check for filament type mismatch
            let gcodeFilamentType = this.file.filament_type ?? ''
            if (gcodeFilamentType.includes(';')) gcodeFilamentType = gcodeFilamentType.split(';')[0]

            if (
                gcodeFilamentType !== '' &&
                this.filamentType.toLowerCase() !== gcodeFilamentType.toLowerCase()
            ) {
                alerts.push({
                    text: `Filament type mismatch: File expects ${gcodeFilamentType}, but tracker shows ${this.filamentType}.`,
                    color: 'warning',
                })
            }
            // Check for insufficient filament weight
            const fileWeight = Math.round(this.file.filament_weight_total ?? 0)
            const trackerWeight = Math.round(this.remainingWeight)

            if (fileWeight > 0 && trackerWeight < fileWeight) {
                alerts.push({
                    text: `Insufficient filament: File needs ${fileWeight}g, but only ${trackerWeight}g remaining.`,
                    color: 'warning',
                })
                return alerts
            }

            // Warning if remaining weight is less than file weight + 150g buffer
            if (fileWeight > 0 && trackerWeight < (fileWeight + 150)) {
                alerts.push({
                    text: `Low filament: Approximately ${trackerWeight}g remaining. ${fileWeight}g is needed.`,
                    color: 'info',
                })
            }

            return alerts
        }
    }
</script>
