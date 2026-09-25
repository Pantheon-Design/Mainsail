<template>
    <div>
        <v-row>
            <v-col>
                <activity-panel />
            </v-col>
        </v-row>
    </div>
</template>
<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import ActivityPanel from '@/components/panels/ActivityPanel.vue'
@Component({
    components: {
        ActivityPanel,
    },
})
export default class PageTimeline extends Mixins(BaseMixin) {}
</script>
