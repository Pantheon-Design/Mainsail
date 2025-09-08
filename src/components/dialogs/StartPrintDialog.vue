<template>
    <v-dialog v-model="bool" :max-width="450" @click:outside="closeDialog" @keydown.esc="closeDialog">
        <v-card>
            <div v-if="file.big_thumbnail" class="d-flex align-center justify-center" style="min-height: 200px">
                <v-img :src="file.big_thumbnail"
                       :max-width="maxThumbnailWidth"
                       class="d-inline-block"
                       :style="bigThumbnailStyle" />
            </div>
            <v-card-title class="text-h5">{{ $t('Dialogs.StartPrint.Headline') }}</v-card-title>
            <v-card-text class="pb-0">
                <p>{{ mainQuestionText }}</p>

                <!-- Show alerts for various conditions -->
                <v-alert v-for="alert in alerts" :key="alert.text" text :color="alert.color" class="mt-4 mx-3">
                    {{ alert.text }}
                </v-alert>
            </v-card-text>

            <start-print-dialog-spoolman v-if="moonrakerComponents.includes('spoolman')" :file="file" />
            <start-print-dialog-spool-tracker v-if="moonrakerComponents.includes('spool_tracker')" :file="file" />
            <template v-if="moonrakerComponents.includes('timelapse')">
                <v-divider v-if="!moonrakerComponents.includes('spoolman') && !moonrakerComponents.includes('spool_tracker')" class="mt-3 mb-2" />
                <v-card-text class="py-0">
                    <settings-row :title="$t('Dialogs.StartPrint.Timelapse')">
                        <v-switch v-model="timelapseEnabled" hide-details class="mt-0" />
                    </settings-row>
                </v-card-text>
                <v-divider class="mt-2 mb-0" />
            </template>
            <v-card-actions>
                <v-spacer />
                <v-btn text @click="closeDialog">{{ $t('Dialogs.StartPrint.Cancel') }}</v-btn>
                <v-btn color="primary"
                       text
                       :disabled="printerIsPrinting || !klipperReadyForGui"
                       @click="startPrint(file.filename)">
                    {{ $t('Dialogs.StartPrint.Print') }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script lang="ts">
    import { Component, Mixins, Prop } from 'vue-property-decorator'
    import BaseMixin from '@/components/mixins/base'
    import { FileStateGcodefile } from '@/store/files/types'
    import SettingsRow from '@/components/settings/SettingsRow.vue'
    import { mdiPrinter3d } from '@mdi/js'
    import { ServerSpoolmanStateSpool } from '@/store/server/spoolman/types'
    import { defaultBigThumbnailBackground } from '@/store/variables'
    import StartPrintDialogSpoolTracker from '@/components/dialogs/StartPrintDialogSpoolTracker.vue'

    @Component({
        components: {
            SettingsRow,
            StartPrintDialogSpoolTracker,
        },
    })
    export default class StartPrintDialog extends Mixins(BaseMixin) {
        mdiPrinter3d = mdiPrinter3d

        printer_config_file_path = '/home/hs3/printer_data/config/printer-config.yml'

        @Prop({ required: true, default: false })
        declare readonly bool: boolean

        @Prop({ required: true, default: '' })
        declare readonly currentPath: string

        @Prop({ required: true })
        declare file: FileStateGcodefile

        get timelapseEnabled() {
            return this.$store.state.server.timelapse?.settings?.enabled ?? false
        }

        set timelapseEnabled(newVal) {
            this.$socket.emit(
                'machine.timelapse.post_settings',
                { enabled: newVal },
                { action: 'server/timelapse/initSettings' }
            )
        }

        get bigThumbnailBackground() {
            return this.$store.state.gui.uiSettings.bigThumbnailBackground ?? defaultBigThumbnailBackground
        }

        get bigThumbnailStyle() {
            if (defaultBigThumbnailBackground.toLowerCase() === this.bigThumbnailBackground.toLowerCase()) {
                return {}
            }

            return { backgroundColor: this.bigThumbnailBackground }
        }

        get active_spool(): ServerSpoolmanStateSpool | null {
            return this.$store.state.server.spoolman.active_spool ?? null
        }

        get filamentVendor() {
            return this.active_spool?.filament?.vendor?.name ?? 'Unknown'
        }

        get filamentName() {
            return this.active_spool?.filament.name ?? 'Unknown'
        }

        get filament() {
            return `${this.filamentVendor} - ${this.filamentName}`
        }

        get mainQuestionText() {
            if (this.active_spool) {
                return this.$t('Dialogs.StartPrint.DoYouWantToStartFilenameFilament', {
                    filename: this.file?.filename ?? 'unknown',
                })
            } else {
                return this.$t('Dialogs.StartPrint.DoYouWantToStartFilename', {
                    filename: this.file?.filename ?? 'unknown'
                })
            }
        }

        get alerts() {
            let alerts = []

            // If config_verifier is not enabled, no alerts needed
            if (!this.file.enable_config_verifier) {
                return alerts
            }

            if (this.file.slicer == 'PantheonSlicer') {
                // Scenario 2: config_yml doesn't exist for pantheonslicer
                if (this.file.config_yml == undefined) {
                    alerts.push({
                        text: 'Out of date PantheonSlicer detected. Please update PantheonSlicer and the profiles. Print quality may be degraded.',
                        color: 'warning',
                    })
                    return alerts
                }

                // Handle filament type and nozzle size check
                let configVerifier = [...this.file.config_verifier];  // Shallow copy of the config_verifier array

                // Handle filament type check
                if (this.file.filament_type !== this.$store.state.printer.toolhead.filament_type) {
                    const filamentWarning = `Filament type mismatch: expected ${this.file.filament_type}, but the printer filament is set to ${this.$store.state.printer.toolhead.filament_type}`;
                    configVerifier.push(`Warning! ${filamentWarning}`);
                }

                // Handle nozzle size check
                const nozzleDiameter = parseFloat(this.$store.state.printer.toolhead.nozzle_size);
                if (this.file.nozzle_diameter !== nozzleDiameter) {
                    const nozzleWarning = `Nozzle diameter mismatch: expected ${this.file.nozzle_diameter} mm, but the printer nozzle size is set to ${this.$store.state.printer.toolhead.nozzle_size} mm`;
                    configVerifier.push(`Warning! ${nozzleWarning}`);
                }

                // Scenario 3: config check passed - no alerts needed
                if (configVerifier.length === 0) {
                    return alerts
                }

                // Scenario 4: Gcode_yml format is invalid
                if (this.file.config_verifier == undefined) {
                    alerts.push({
                        text: `Gcode_yml format is invalid. Please try update PantheonSlicer profiles or check ${this.file.slicer} template_custom_gcode content. Print quality may be degraded.`,
                        color: 'warning',
                    })
                    return alerts
                }

                // Scenario 4: Differences found
                configVerifier.forEach((str: string) => {
                    if (str.startsWith("Warning")) {
                        alerts.push({
                            text: `${str}. Running this file may damage your machine.`,
                            color: 'orange',
                        })
                    } else if (str.startsWith("Caution")) {
                        alerts.push({
                            text: `${str}. Print quality may be degraded.`,
                            color: 'info',
                        })
                    } else if (str.startsWith("Danger")) {
                        alerts.push({
                            text: str,
                            color: 'error',
                        })
                    }
                })

            } else {
                // Scenario 5: Not Pantheon Slicer
                alerts.push({
                    text: `Third-party slicer detected: ${this.file.slicer}. Running this file may damage your machine.`,
                    color: 'orange',
                })
            }

            return alerts
        }

        get maxThumbnailWidth() {
            return this.file?.big_thumbnail_width ?? 400
        }

        startPrint(filename = '') {
            filename = (this.currentPath + '/' + filename).substring(1)
            this.closeDialog()
            this.$socket.emit('printer.print.start', { filename: filename }, { action: 'switchToDashboard' })
        }

        closeDialog() {
            this.$emit('closeDialog')
        }
    }
</script>
