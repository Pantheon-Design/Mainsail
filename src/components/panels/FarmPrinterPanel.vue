<template>
    <panel :icon="mdiPrinter3d"
           :title="printer_name"
           card-class="farmprinter-panel"
           :class="panelClass"
           :loading="false"
           :toolbar-color="''">
        <v-hover>
            <template #default="{ hover }">
                <div>
                    <v-img ref="imageDiv" :height="imageHeight" :src="printer_image" class="d-flex align-end">
                        <v-card-title class="white--text py-2"
                                      style="background-color: rgba(0, 0, 0, 0.3); backdrop-filter: blur(3px)">
                            <v-row>
                                <v-col class="col-auto pr-0 d-flex align-center" style="width: 58px">
                                    <pantheon-logo :color="'white'"
                                                   style="width: 100%"
                                                   class="my-auto" />
                                </v-col>
                                <v-col class="col" style="width: 100px">
                                    <h3 class="font-weight-regular">{{ printer_status }}</h3>
                                    <span v-if="printer_current_filename !== ''"
                                          class="subtitle-2 text-truncate px-0 text--disabled d-block">
                                        <v-icon small class="mr-1">{{ mdiFileOutline }}</v-icon>
                                        {{ printer_current_filename }}
                                    </span>
                                </v-col>
                            </v-row>
                        </v-card-title>
                    </v-img>
                    <v-card-text v-if="false" class="px-0 py-2">
                        <v-container class="py-0">
                            <v-row>
                                <v-col>
                                    <strong class="d-block text-center">Preview Hidden</strong>
                                </v-col>
                            </v-row>
                        </v-container>
                    </v-card-text>
                </div>
            </template>
        </v-hover>
        <resize-observer @notify="handleResize" />
    </panel>
</template>

<script lang="ts">
    import { Component, Mixins, Prop, Ref, Vue } from 'vue-property-decorator'
    import BaseMixin from '@/components/mixins/base'
    import PantheonLogo from '@/components/ui/PantheonLogo.vue'
    import Panel from '@/components/ui/Panel.vue'
    import { mdiPrinter3d, mdiFileOutline } from '@mdi/js'
    import { Debounce } from 'vue-debounce-decorator'
    import ThemeMixin from '@/components/mixins/theme'

    @Component({
        components: {
            Panel,
            'pantheon-logo': PantheonLogo,
        },
    })
    export default class FarmPrinterPanel extends Mixins(BaseMixin, ThemeMixin) {
        mdiPrinter3d = mdiPrinter3d
        mdiFileOutline = mdiFileOutline

        private imageHeight = 200

        @Prop({ type: String, required: true }) declare hostname: string
        @Prop({ type: Object, required: true }) declare printerData: any
        @Ref() declare readonly imageDiv: Vue

        get printer_name() {
            return this.hostname
        }

        get printer_status() {
            return this.printerData?.print_stats?.state ?? 'Unknown'
        }

        get printer_current_filename() {
            return this.printerData?.print_stats?.filename ?? ''
        }

        get printer_image() {
            return this.sidebarBgImage
        }

        get panelClass(): string[] {
            if (this.printerData?.print_stats?.state === 'error') return ['disabledPrinter']
            return []
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

    .v-overlay {
        top: 48px;
    }

    ::v-deep .farmprinter-panel {
        position: relative;
    }
</style>
