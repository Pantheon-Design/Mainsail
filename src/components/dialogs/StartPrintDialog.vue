<template>
    <v-dialog v-model="bool" :max-width="400" @click:outside="closeDialog" @keydown.esc="closeDialog">
        <v-card>
            <div v-if="file.big_thumbnail" class="d-flex align-center justify-center" style="min-height: 200px">
                <v-img
                    :src="file.big_thumbnail"
                    :max-width="maxThumbnailWidth"
                    class="d-inline-block"
                    :style="bigThumbnailStyle" />
            </div>
            <v-card-title class="text-h5">{{ $t('Dialogs.StartPrint.Headline') }}</v-card-title>
            <v-card-text class="pb-0">
                <p v-for="(text, index) in question.textArray" :key="index" :style="question.stylesArray[index]">
                    {{ text }}
                </p>
            </v-card-text>

            <start-print-dialog-spoolman v-if="moonrakerComponents.includes('spoolman')" :file="file" />
            <template v-if="moonrakerComponents.includes('timelapse')">
                <v-divider v-if="!moonrakerComponents.includes('spoolman')" class="mt-3 mb-2" />
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
                <v-btn
                    color="primary"
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

@Component({
    components: {
        SettingsRow,
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

    get question() {
        const defaultStyle = {
            color: 'white',
            backgroundColor: 'transparent'
        }

        const warningStyle = {
            color: 'orange',
            backgroundColor: 'transparent'
        }

        const cautionStyle = {
            color: 'rgb( 218, 218, 11)',
            backgroundColor: 'transparent'
        }

        const dangerStyle = {
            color: 'red',
            backgroundColor: 'transparent'
        }

        const cautionHeadlineStyle = {
            color: 'black',
            backgroundColor: 'rgb( 218, 218, 11)',
            fontWeight: 'bold',
            fontSize: '26px'
        }

        const warningHeadlineStyle = {
            color: 'black',
            backgroundColor: 'orange',
            fontWeight: 'bold',
            fontSize: '26px'
        }

        const dangerHeadlineStyle = {
            color: 'black',
            backgroundColor: 'red',
            fontWeight: 'bold',
            fontSize: '26px'
        }

        const cautionGenericStyle = {
            color: 'rgb( 218, 218, 11)',
            fontStyle: 'italic'
        }

        const warningGenericStyle = {
            color: 'orange',
            fontStyle: 'italic'
        }

        const dangerGenericStyle = {
            color: 'red',
            fontStyle: 'italic'
        }

        const cautionGenericText = 'Print Quality my be degraded'

        const warningGenericText = 'Running this file may damage your machine'

        let textArray = []
        let stylesArray = []


        
        //this.$toast.success(" " + this.file.small_thumbnail)
        //this.$toast.error(" " + this.file.config_yml)
        if (this.file.slicer == 'PantheonSlicer') {
            // Scenario 1: config_yml doesnt exist for pantheonslicer
            if (this.file.config_yml == undefined) {
                if (this.active_spool) {
                    textArray.push("Caution")
                    stylesArray.push(cautionHeadlineStyle)
                    textArray.push(cautionGenericText)
                    stylesArray.push(cautionGenericStyle)
                    textArray.push("Caution: Out of date PantheonSlicer Detected.")
                    stylesArray.push(cautionStyle)
                    textArray.push("Please update PantheonSlicer and the profiles")
                    stylesArray.push(cautionStyle)
                } else {
                    textArray.push("Caution")
                    stylesArray.push(cautionHeadlineStyle)
                    textArray.push(cautionGenericText)
                    stylesArray.push(cautionGenericStyle)
                    textArray.push("Caution: Out of date PantheonSlicer Detected.")
                    stylesArray.push(cautionStyle)
                    textArray.push("Please update PantheonSlicer and the profiles")
                    stylesArray.push(cautionStyle)
                }
            } else {
                // Scenario 2:config check passed
                if (this.file.config_verifier == ''){
                    if (this.active_spool) {
                        textArray.push(this.$t('Dialogs.StartPrint.DoYouWantToStartFilenameFilament', {
                            filename: this.file?.filename ?? 'unknown',
                        }))
                        stylesArray.push(defaultStyle)
                    }
                    else {
                        textArray.push(this.$t('Dialogs.StartPrint.DoYouWantToStartFilename', { 
                            filename: this.file?.filename ?? 'unknown' }
                        ))
                        stylesArray.push(defaultStyle)
                        
                    }
                } else if (this.file.config_verifier == undefined){
                    // Scenario 3: Gcode_yml format is invalid
                    if (this.active_spool) {
                        textArray.push("Caution")
                        stylesArray.push(cautionHeadlineStyle)
                        textArray.push(cautionGenericText)
                        stylesArray.push(cautionGenericStyle)
                        textArray.push("Caution: config_verifier not found\nRe-uploading " +  this.file.slicer
                        + "is recommended")
                        stylesArray.push(cautionStyle)
                    }
                    else {
                        textArray.push("Caution")
                        stylesArray.push(cautionHeadlineStyle)
                        textArray.push(cautionGenericText)
                        stylesArray.push(cautionGenericStyle)
                        textArray.push("Caution: config_verifier not found\nRe-uploading " +  this.file.slicer
                        + "is recommended")
                        stylesArray.push(cautionStyle)
                    }
                }
                // Scenario : Difference found
                else {
                    let warningStrings: string[] = [];
                    let cautionStrings: string[] = [];
                    let dangerStrings: string[] = [];
                    let updatedTextArray: string[] = [];
                    let updatedStylesArray: any[] = [];

                    textArray = this.file.config_verifier
                    textArray.forEach((str : string) => {
                        if (str.startsWith("Warning")) {
                            warningStrings.push(str)
                            stylesArray.push(defaultStyle);
                        } else if (str.startsWith("Caution")) {
                            cautionStrings.push(str)
                            stylesArray.push(defaultStyle);
                        } else if (str.startsWith("Danger")) {
                            dangerStrings.push(str)
                            stylesArray.push(defaultStyle);
                        }
                    });


                    // Add warnings and their styles if they exist
                    if (warningStrings.length > 0) {
                        updatedTextArray.push("Warning");
                        updatedStylesArray.push(warningHeadlineStyle); // You can add a separate style for headlines if needed
                        updatedTextArray.push(warningGenericText)
                        updatedStylesArray.push(warningGenericStyle)
                        warningStrings.forEach((str) => {
                            updatedTextArray.push(str);
                            updatedStylesArray.push(warningStyle);
                        });
                    }

                    // Add cautions and their styles if they exist
                    if (cautionStrings.length > 0) {
                        updatedTextArray.push("Caution");
                        updatedStylesArray.push(cautionHeadlineStyle); // You can add a separate style for headlines if needed
                        updatedTextArray.push(cautionGenericText)
                        updatedStylesArray.push(cautionGenericStyle)
                        cautionStrings.forEach((str) => {
                            updatedTextArray.push(str);
                            updatedStylesArray.push(cautionStyle);
                        });
                    }

                    // Add dangers and their styles if they exist
                    if (dangerStrings.length > 0) {
                        updatedTextArray.push("Danger");
                        updatedStylesArray.push(dangerHeadlineStyle); // You can add a separate style for headlines if needed
                        dangerStrings.forEach((str) => {
                            updatedTextArray.push(str);
                            updatedStylesArray.push(defaultStyle);
                        });
                    }
                    // Assign the updated arrays back to the original arrays
                    textArray = updatedTextArray;
                    stylesArray = updatedStylesArray

                }
            }
        } else {
            //Scenario 6: Not Pantheon Slicer
            if (this.active_spool) {
                textArray.push("Warning")
                stylesArray.push(warningHeadlineStyle)
                textArray.push(warningGenericText)
                stylesArray.push(warningGenericStyle)
                textArray.push("Warning: Third-party slicer detected: <<" +  this.file.slicer
                + ">>")
                stylesArray.push(warningStyle)
            }
            else {
                textArray.push("Warning")
                stylesArray.push(warningHeadlineStyle)
                textArray.push(warningGenericText)
                stylesArray.push(warningGenericStyle)
                textArray.push("Warning: Third-party slicer detected: <<" +  this.file.slicer
                + ">>")
                stylesArray.push(warningStyle)
            }
        }


            return { textArray, stylesArray };
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
