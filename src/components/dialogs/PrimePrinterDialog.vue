<template>
    <v-dialog v-model="bool" :max-width="450" @click:outside="closeDialog" @keydown.esc="closeDialog">
        <v-card>
            <v-card-title class="text-h5">{{ filename ? 'Prime Printer First' : 'Prime Printer' }}</v-card-title>
            <v-card-text class="pb-0">
                <p v-for="(text, index) in question.textArray" :key="index" :style="question.stylesArray[index]">
                    {{ text }}
                </p>
            </v-card-text>

            <div class="d-flex justify-center" style="min-height: 150px;">
                <v-img src="/img/neko-cat.gif"
                       max-width="300"
                       aspect-ratio="1"
                       contain></v-img>
            </div>


            <v-card-text class="pb-0">
                <!-- Display TextArray Content -->
                <p v-if="filename" class="non-selectable">If you are 100% sure the printer is primed, you can enter the filename to force print:<br>{{ filename }}</p>
                <!-- Text Input Field for Filename -->
                <v-text-field v-model="userInput"
                              label="Enter filename"
                              outlined></v-text-field>
            </v-card-text>

            <v-card-actions>
                <v-spacer />
                <v-btn text @click="closeDialog">Cancel</v-btn>
                <v-btn :disabled="userInput !== filename"
                       color="primary"
                       text
                       @click="handlePrimeAction()">
                    {{ filename ? 'PRIME AND PRINT' : 'PRIME' }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script lang="ts">
import { Component, Mixins, Prop } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import SettingsRow from '@/components/settings/SettingsRow.vue'
import { mdiPrinter3d } from '@mdi/js'

@Component({
    components: {
        SettingsRow,
    },
})
export default class StartPrintDialog extends Mixins(BaseMixin) {
    mdiPrinter3d = mdiPrinter3d

    @Prop({
        required: true,
        default: false,
    })
    declare readonly bool: boolean

    @Prop({
        required: false,
        default: '',
    })
    declare readonly filename: string

    @Prop({
        required: false,
        default: '',
    })
    declare readonly userInput: string

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

    get question() {
        const defaultStyle = {
            color: 'white',
            backgroundColor: 'transparent'
        }

        let textArray = []
        let stylesArray = []

            
        textArray.push('Please prime the printer, and confirm it on the printer\'s touchscreen')
        stylesArray.push(defaultStyle)


        return { textArray, stylesArray }
        

    }


    handlePrimeAction() {
        if (this.filename) {
            this.primeAndPrintAction();
        } else {
            this.primePrinter();
        }
    }

    primeAndPrintAction() {
        //this.$toast.error('Primed and Print ${this.filename}!')
        this.closeDialog()
        this.$socket.emit('printer.print.start', { filename: this.filename }, { loading: 'statusPrintReprint' })
    }


    primePrinter() {
        this.closeDialog()
        this.$socket.emit('printer.gcode.script', { script: 'SDCARD_RESET_FILE' }, { loading: 'statusPrintClear' })
    }

    closeDialog() {
        this.$emit('closeDialog')
    }
}
</script>

<style>
    .non-selectable {
        user-select: none;
    }
</style>
