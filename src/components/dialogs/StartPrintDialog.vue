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
                <p class="body-2">
                    {{ question }}
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
import yaml from 'js-yaml'
import axios from 'axios'
 

@Component({
    components: {
        SettingsRow,
    },
})
export default class StartPrintDialog extends Mixins(BaseMixin) {
    mdiPrinter3d = mdiPrinter3d

    @Prop({ required: true, default: false })
    declare readonly bool: boolean

    @Prop({ required: true, default: '' })
    declare readonly currentPath: string

    @Prop({ required: true })
    declare file: FileStateGcodefile

    yamldata: any = null

    gcodedata: any = null

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
        this.loadgcodeYaml()
        const comparisonResult = this.compareYamlData();
        const gcodeYamlContent = JSON.stringify(this.gcodedata, null, 2);
        const printerYamlContent = JSON.stringify(this.yamldata, null, 2);

        if (this.active_spool) {
            return `${this.$t('Dialogs.StartPrint.DoYouWantToStartFilenameFilament', {
            filename: this.file?.filename ?? 'unknown',
            })}\n\nComparison Result:\n${comparisonResult}\n\nGcode YAML:\n${gcodeYamlContent}\n\nPrinter YAML:\n${printerYamlContent}`;
        }

        //return this.$t('Dialogs.StartPrint.DoYouWantToStartFilename', { filename: this.file?.filename ?? 'unknown' })  + '\n' + printerYamlContent + '\n ==================\n' + '\n ==================\n' + gcodeYamlContent +'\n ==================\n';
    
        return `${this.$t('Dialogs.StartPrint.DoYouWantToStartFilename', {
            filename: this.file?.filename ?? 'unknown',
        })}\n\nComparison Result:\n${comparisonResult}\n\nGcode YAML:\n${gcodeYamlContent}\n\nPrinter YAML:\n${printerYamlContent}`;
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

    async loadprinterYaml() {
        try {
            //load printer config
            const response = await axios.get('/src/assets/sample-config.yml');
            this.yamldata = yaml.load(response.data)
        } catch (e) {
            this.yamldata = "asdf: " + e
        }
    }

    async loadgcodeYaml() {
        try {
            //this.$toast.success("trying to load gcode yaml")
            this.$socket.emit('server.files.metadata', { filename: this.file.filename }, { action: 'files/getMetadata' })

            this.gcodedata = yaml.load(this.file.config_yml.replace('---', '').replace('...', '').replace(/;/g, '\n'))

        } catch (e) {
            this.$toast.error("failed to load gcode yaml")
            this.gcodedata = "asdf: " + e
            //this.gcodedata = "8"
        }
    }    

    compareYamlData() {
      if (!this.gcodedata || !this.yamldata) {
        return 'YAML data not loaded yet';
      }

      // Function to compare two objects
      const compare = (obj1: Record<string, any>, obj2: Record<string, any>, path = '') => {
        let differences = '';

        for (const key in obj1) {
          if (obj1.hasOwnProperty(key)) {
            const fullPath = path ? `${path}.${key}` : key;
            if (obj2.hasOwnProperty(key)) {
              if (typeof obj1[key] === 'object' && typeof obj2[key] === 'object') {
                differences += compare(obj1[key], obj2[key], fullPath);
              } else if (obj1[key] !== obj2[key]) {
                differences += `Difference at ${fullPath}: ${obj1[key]} !== ${obj2[key]}\n`;
              }
            } else {
              differences += `Missing in second YAML at ${fullPath}\n`;
            }
          }
        }

        return differences;
      };

      return compare(this.gcodedata, this.yamldata) || 'YAML data match';
    }

    created() {
        // Load the YAML data here or whenever appropriate
        this.loadprinterYaml()
    }


}
</script>


<style>
textarea {
  width: 100%;
  height: 100px;
}
</style>