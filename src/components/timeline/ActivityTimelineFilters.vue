<template>
    <v-row dense class="activity-timeline-filters align-center">
        <v-col v-if="showTier" cols="12" sm="auto">
            <v-btn-toggle :value="value.tier" mandatory dense @change="update('tier', $event)">
                <v-btn small :value="1">{{ $t('Timeline.Filters.ImportantOnly') }}</v-btn>
                <v-btn small :value="2">{{ $t('Timeline.Filters.All') }}</v-btn>
            </v-btn-toggle>
        </v-col>
        <v-col v-if="printerItems !== null" cols="12" sm="3">
            <v-select
                :value="value.printer"
                :items="printerItems"
                :label="$t('Timeline.Filters.Printer')"
                clearable
                dense
                outlined
                hide-details
                @change="update('printer', $event)" />
        </v-col>
        <v-col cols="12" sm="3">
            <v-select
                :value="value.types"
                :items="typeItems"
                :label="$t('Timeline.Filters.Types')"
                multiple
                chips
                small-chips
                deletable-chips
                clearable
                dense
                outlined
                hide-details
                @change="update('types', $event)" />
        </v-col>
        <v-col cols="6" sm="2">
            <v-menu v-model="fromMenu" :close-on-content-click="false" offset-y min-width="290">
                <template #activator="{ on, attrs }">
                    <v-text-field
                        :value="value.dateFrom"
                        :label="$t('Timeline.Filters.From')"
                        dense
                        outlined
                        readonly
                        clearable
                        hide-details
                        :prepend-inner-icon="mdiCalendar"
                        v-bind="attrs"
                        v-on="on"
                        @click:clear="update('dateFrom', null)" />
                </template>
                <v-date-picker
                    :value="value.dateFrom"
                    @input="
                        update('dateFrom', $event)
                        fromMenu = false
                    " />
            </v-menu>
        </v-col>
        <v-col cols="6" sm="2">
            <v-menu v-model="toMenu" :close-on-content-click="false" offset-y min-width="290">
                <template #activator="{ on, attrs }">
                    <v-text-field
                        :value="value.dateTo"
                        :label="$t('Timeline.Filters.To')"
                        dense
                        outlined
                        readonly
                        clearable
                        hide-details
                        :prepend-inner-icon="mdiCalendar"
                        v-bind="attrs"
                        v-on="on"
                        @click:clear="update('dateTo', null)" />
                </template>
                <v-date-picker
                    :value="value.dateTo"
                    @input="
                        update('dateTo', $event)
                        toMenu = false
                    " />
            </v-menu>
        </v-col>
        <v-col cols="12" sm="2">
            <v-text-field
                v-model="searchInput"
                :label="$t('Timeline.Search')"
                :prepend-inner-icon="mdiMagnify"
                dense
                outlined
                clearable
                hide-details />
        </v-col>
    </v-row>
</template>

<script lang="ts">
import { Component, Mixins, Prop, Watch } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import { mdiCalendar, mdiMagnify } from '@mdi/js'
import { ActivityFilterValue } from '@/components/timeline/types'

/**
 * Filter toolbar for the activity timeline.
 * Emits `input` with the merged filter object on every change and `apply` for the
 * changes that require a server re-query (everything except `search`, which is
 * client-side on both builds).
 */
@Component
export default class ActivityTimelineFilters extends Mixins(BaseMixin) {
    mdiCalendar = mdiCalendar
    mdiMagnify = mdiMagnify

    fromMenu = false
    toMenu = false
    searchInput = ''
    searchTimer: number | null = null

    @Prop({ required: true }) readonly value!: ActivityFilterValue
    @Prop({ default: () => [] }) readonly typeItems!: { text: string; value: string }[]
    @Prop({ default: true }) readonly showTier!: boolean
    @Prop({ default: null }) readonly printerItems!: string[] | null

    mounted() {
        this.searchInput = this.value.search ?? ''
    }

    update(key: keyof ActivityFilterValue, val: any) {
        const merged: ActivityFilterValue = { ...this.value, [key]: val }
        this.$emit('input', merged)
        if (key !== 'search') this.$emit('apply', merged)
    }

    @Watch('searchInput')
    onSearchInput(newVal: string | null) {
        if (this.searchTimer) window.clearTimeout(this.searchTimer)
        this.searchTimer = window.setTimeout(() => {
            this.update('search', newVal ?? '')
        }, 300)
    }
}
</script>
