<template>
    <panel 
        :icon="mdiPrinter3d"
        :title="printer_name"
        card-class="farmprinter-panel"
        :class="panelClass"
        :loading="printer.socket.isConnecting"
        :toolbar-color="isCurrentPrinter ? 'primary' : ''">
        <v-hover>
            <template #default="{ hover }">
                <div>
                    <v-img ref="imageDiv" :height="imageHeight" :src="printer_image" class="d-flex align-end">
                        <v-card-title
                            class="white--text py-2"
                            style="background-color: rgba(0, 0, 0, 0.3); backdrop-filter: blur(3px)">
                            <v-row>
                                <v-col class="col" style="width: 100px">
                                    <h3 class="font-weight-regular">{{ printer_status }}</h3>
                                    <span
                                        v-if="printer_current_filename !== ''"
                                        class="subtitle-2 text-truncate px-0 text--disabled d-block">
                                        <v-icon small class="mr-1">{{ mdiFileOutline }}</v-icon>
                                        {{ printer_current_filename }}
                                    </span>
                                </v-col>
                            </v-row>
                        </v-card-title>
                    </v-img>
                    <v-fade-transition>
                        <v-overlay v-if="hover" absolute :z-index="4">
                            <v-btn color="primary" @click="clickPrinter">
                                {{
                                    printer.socket.isConnected
                                        ? $t('Panels.FarmPrinterPanel.SwitchToPrinter')
                                        : $t('Panels.FarmPrinterPanel.ReconnectToPrinter')
                                }}
                            </v-btn>
                        </v-overlay>
                    </v-fade-transition>
                </div>
            </template>
        </v-hover>
        <resize-observer @notify="handleResize" />
    </panel>
</template>

<script lang="ts">
import { Component, Mixins, Prop, Ref, Vue } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import { FarmPrinterState } from '@/store/farm/printer/types'
import PantheonLogo from '@/components/ui/PantheonLogo.vue'
import Panel from '@/components/ui/Panel.vue'
import { mdiPrinter3d, mdiWebcam, mdiMenuDown, mdiWebcamOff, mdiFileOutline } from '@mdi/js'
import { Debounce } from 'vue-debounce-decorator'
import WebcamMixin from '@/components/mixins/webcam'
import WebcamWrapper from '@/components/webcams/WebcamWrapper.vue'
import { GuiWebcamStateWebcam } from '@/store/gui/webcams/types'
import ThemeMixin from '@/components/mixins/theme'

@Component({
    components: {
        Panel,
        'webcam-wrapper': WebcamWrapper,
        'pantheon-logo': PantheonLogo,
    },
})
export default class FarmPrinterPanel extends Mixins(BaseMixin, ThemeMixin, WebcamMixin) {
    mdiPrinter3d = mdiPrinter3d
    mdiWebcam = mdiWebcam
    mdiMenuDown = mdiMenuDown
    mdiWebcamOff = mdiWebcamOff
    mdiFileOutline = mdiFileOutline

    private imageHeight = 200

    @Prop({ type: Object, required: true }) declare printer: FarmPrinterState
    @Ref() declare readonly imageDiv: Vue

    get printerUrl() {
        const thisUrl = window.location.href.split('/')
        const protocol = thisUrl[0]

        let url = protocol + '//' + this.printer.socket.hostname
        if (80 !== this.printer.socket.webPort) url += ':' + this.printer.socket.webPort

        return url
    }

    get isCurrentPrinter() {
        return this.$store.getters['farm/' + this.printer._namespace + '/isCurrentPrinter']
    }

    get currentCamName() {
        return this.$store.getters['farm/' + this.printer._namespace + '/getSetting']('currentCamName', 'off')
    }

    set currentCamName(newVal) {
        this.$store.dispatch('farm/' + this.printer._namespace + '/setSettings', { currentCamName: newVal })
    }

    get printer_name() {
        return this.printer.socket.position
        //return this.$store.getters['farm/' + this.printer._namespace + '/getPrinterName']
    }

    get printer_status() {
        return this.$store.getters['farm/' + this.printer._namespace + '/getStatus']
    }

    get printer_current_filename() {
        return this.$store.getters['farm/' + this.printer._namespace + '/getCurrentFilename']
    }

    get printer_image() {
        if (this.currentWebcam) return this.sidebarBgImage

        return this.$store.getters['farm/' + this.printer._namespace + '/getImage'] ?? this.sidebarBgImage
    }

    get printer_logo() {
        return this.$store.getters['farm/' + this.printer._namespace + '/getLogo']
    }

    get printerLogoColor() {
        return this.$store.getters['farm/' + this.printer._namespace + '/getLogoColor']
    }

    get printer_position() {
        return this.$store.getters['farm/' + this.printer._namespace + '/getPosition']
    }

    get printer_preview() {
        return this.$store.getters['farm/' + this.printer._namespace + '/getPrinterPreview']
    }

    get showWebcamSwitch() {
        if (this.printer_webcams.length == 0) return false

        return this.printer.socket.isConnected
    }

    get printer_webcams(): GuiWebcamStateWebcam[] {
        return this.$store.getters['farm/' + this.printer._namespace + '/getPrinterWebcams']
    }

    get currentWebcam(): GuiWebcamStateWebcam | null {
        const currentCam = this.printer_webcams?.find(
            (webcam: GuiWebcamStateWebcam) => webcam.name === this.currentCamName
        )
        if (currentCam) return currentCam

        return null
    }

    get panelClass(): string[] {
        let output = []

        if (!this.printer.socket.isConnected && !this.printer.socket.isConnecting) output.push('disabledPrinter')

        return output
    }

    clickPrinter() {
        if (this.printer.socket.isConnected) this.$store.dispatch('changePrinter', { printer: this.printer._namespace })
        else this.$store.dispatch('farm/' + this.printer._namespace + '/reconnect')
    }

    mounted() {
        this.calcImageHeight()
    }

    calcImageHeight() {
        if (this.imageDiv?.$el?.clientWidth) {
            this.imageHeight = Math.round((this.imageDiv.$el.clientWidth / 3) * 2)
            return
        }

        this.imageHeight = 200
    }

    @Debounce(200)
    handleResize() {
        this.$nextTick(() => {
            this.calcImageHeight()
        })
    }
}
</script>

<style scoped>
.v-card.disabledPrinter {
    opacity: 0.6;
    filter: grayscale(70%);
}

.webcamContainer,
.webcamContainer .vue-load-image,
.webcamContainer > div,
.webcamContainer img {
    position: absolute !important;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
}

.webcamContainer img {
    height: 100%;
}

.webcamContainer .webcamFpsOutput {
    display: none;
}

.v-overlay {
    top: 48px;
}

::v-deep .farmprinter-panel {
    position: relative;
}
</style>
