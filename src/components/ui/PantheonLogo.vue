<template>
    <svg
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        xmlns:xlink="http://www.w3.org/1999/xlink"
        x="0px"
        y="0px"
        viewBox="0 0 599.38 523.11"
        xml:space="preserve">
        <g>
            <path
                :style="'fill:' + color + ';'"
                d="M282.8,85.2 L520.6,85.4 L560,0.6 L214.9,1.1 L282.8,85.2 Z" />
            <path
                :style="'fill:' + color + ';'"
                d="M34.5,125.4 L24,147.8 L315.3,523.1 L354.2,440.5 L111.1,125.3 L34.5,125.4 Z" />
            <path
                :style="'fill:' + color + ';'"
                d="M502.2,124.5 L265.9,125 L167,0.8 L90.4,0.9 L79.9,23.3 L371.2,398.6 L411.6,312.8 L331.2,209.3 L462.9,209.4 L502.2,124.5 Z" />
        </g>
    </svg>
</template>

<script lang="ts">
import Component from 'vue-class-component'
import { Mixins, Prop, Watch } from 'vue-property-decorator'
import BaseMixin from '../mixins/base'
import { defaultLogoColor } from '@/store/variables'

@Component
export default class PantheonLogo extends Mixins(BaseMixin) {
    private internalColor = defaultLogoColor

    @Prop({ required: false, default: '' })
    declare readonly color: string

    @Watch('color')
    colorChanged(newVal: string) {
        this.internalColor = newVal !== '' ? newVal : defaultLogoColor
    }

    created() {
        if (this.color !== '') this.internalColor = this.color
    }
}
</script>
