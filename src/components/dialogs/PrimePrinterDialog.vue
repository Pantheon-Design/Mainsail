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

            <v-card-actions>
                <v-spacer />
                <v-btn text @click="closeDialog">Cancel</v-btn>
                <v-btn color="primary"
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

            
        textArray.push('Please follow the following instruction to prime the printer:')
        stylesArray.push(defaultStyle)
        textArray.push("1. Clear bed of parts, prime line, and supports.")
        stylesArray.push(defaultStyle)
        textArray.push("2. Inspect nozzle for goop, clean if goopy.")
        stylesArray.push(defaultStyle)
        textArray.push("3. Clean bed with alcohol and clean room wipe.")
        stylesArray.push(defaultStyle)
        textArray.push("4. Coat bed with adhesive.")
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
