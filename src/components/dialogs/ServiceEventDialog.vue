<template>
    <v-dialog :value="value" max-width="520" persistent @input="$emit('input', $event)">
        <panel
            :title="isEdit ? $t('Timeline.EditService') : $t('Timeline.AddService')"
            :icon="mdiWrench"
            card-class="activity-service-dialog"
            :margin-bottom="false">
            <template #buttons>
                <v-btn icon tile @click="close">
                    <v-icon>{{ mdiCloseThick }}</v-icon>
                </v-btn>
            </template>
            <v-card-text>
                <v-form ref="form" v-model="formValid" @submit.prevent="save">
                    <v-row dense>
                        <v-col cols="7">
                            <v-menu v-model="dateMenu" :close-on-content-click="false" offset-y min-width="290">
                                <template #activator="{ on, attrs }">
                                    <v-text-field
                                        v-model="form.date"
                                        :label="$t('Timeline.ServiceDialog.Date')"
                                        dense
                                        outlined
                                        readonly
                                        :rules="[rules.required]"
                                        :prepend-inner-icon="mdiCalendar"
                                        v-bind="attrs"
                                        v-on="on" />
                                </template>
                                <v-date-picker v-model="form.date" @input="dateMenu = false" />
                            </v-menu>
                        </v-col>
                        <v-col cols="5">
                            <v-menu
                                ref="timeMenu"
                                v-model="timeMenu"
                                :close-on-content-click="false"
                                offset-y
                                min-width="290">
                                <template #activator="{ on, attrs }">
                                    <v-text-field
                                        v-model="form.time"
                                        :label="$t('Timeline.ServiceDialog.Time')"
                                        dense
                                        outlined
                                        readonly
                                        :rules="[rules.required]"
                                        :prepend-inner-icon="mdiClockOutline"
                                        v-bind="attrs"
                                        v-on="on" />
                                </template>
                                <v-time-picker
                                    v-if="timeMenu"
                                    v-model="form.time"
                                    format="24hr"
                                    @click:minute="timeMenu = false" />
                            </v-menu>
                        </v-col>
                    </v-row>
                    <v-select
                        v-model="form.service_type"
                        :items="serviceTypeItems"
                        :label="$t('Timeline.ServiceDialog.ServiceType')"
                        :rules="[rules.required]"
                        dense
                        outlined />
                    <v-text-field
                        v-if="form.service_type === 'other'"
                        v-model="form.service_type_other"
                        :label="$t('Timeline.ServiceDialog.ServiceTypeOther')"
                        :rules="[rules.required]"
                        dense
                        outlined />
                    <v-text-field
                        v-model="form.operator"
                        :label="$t('Timeline.ServiceDialog.Operator')"
                        :rules="[rules.required]"
                        dense
                        outlined />
                    <v-textarea
                        v-model="form.comment"
                        :label="$t('Timeline.ServiceDialog.Comment')"
                        dense
                        outlined
                        rows="3"
                        auto-grow />
                </v-form>
            </v-card-text>
            <v-card-actions>
                <v-spacer />
                <v-btn text @click="close">{{ $t('Timeline.Cancel') }}</v-btn>
                <v-btn color="primary" text :disabled="!formValid" @click="save">{{ $t('Timeline.Save') }}</v-btn>
            </v-card-actions>
        </panel>
    </v-dialog>
</template>

<script lang="ts">
import { Component, Mixins, Prop, Watch } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import Panel from '@/components/ui/Panel.vue'
import { mdiCalendar, mdiClockOutline, mdiCloseThick, mdiWrench } from '@mdi/js'
import { ActivityEvent } from '@/components/timeline/types'

interface ServiceFormModel {
    date: string
    time: string
    service_type: string
    service_type_other: string
    operator: string
    comment: string
}

function pad(n: number): string {
    return n < 10 ? `0${n}` : `${n}`
}

function splitDate(ts: number): { date: string; time: string } {
    const d = new Date(ts * 1000)
    return {
        date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    }
}

@Component({
    components: { Panel },
})
export default class ServiceEventDialog extends Mixins(BaseMixin) {
    mdiCalendar = mdiCalendar
    mdiClockOutline = mdiClockOutline
    mdiCloseThick = mdiCloseThick
    mdiWrench = mdiWrench

    @Prop({ required: true }) readonly value!: boolean
    @Prop({ default: null }) readonly event!: ActivityEvent | null
    @Prop({ default: () => [] }) readonly serviceTypeItems!: { text: string; value: string }[]

    dateMenu = false
    timeMenu = false
    formValid = false

    form: ServiceFormModel = {
        date: '',
        time: '',
        service_type: '',
        service_type_other: '',
        operator: '',
        comment: '',
    }

    rules = {
        required: (v: string) => !!(v ?? '').toString().trim() || this.$t('Timeline.ServiceDialog.Required'),
    }

    get isEdit(): boolean {
        return this.event !== null
    }

    get lastOperator(): string {
        return this.$store.state.gui.view?.timeline?.lastOperator ?? ''
    }

    @Watch('value')
    onValueChanged(newVal: boolean) {
        if (newVal) this.resetForm()
    }

    resetForm() {
        const details = this.event?.details ?? {}
        const now = splitDate(this.event?.ts ?? Date.now() / 1000)

        this.form = {
            date: now.date,
            time: now.time,
            service_type: (details.service_type as string) ?? '',
            service_type_other: (details.service_type_other as string) ?? '',
            operator: (details.operator as string) ?? this.lastOperator,
            comment: (details.comment as string) ?? '',
        }

        this.$nextTick(() => {
            const form = this.$refs.form as any
            if (form?.resetValidation) form.resetValidation()
        })
    }

    close() {
        this.$emit('input', false)
    }

    save() {
        const form = this.$refs.form as any
        if (form?.validate && !form.validate()) return

        const service_time = Math.floor(new Date(`${this.form.date}T${this.form.time}:00`).getTime() / 1000)
        const payload = {
            id: this.event?.id,
            service_time,
            service_type: this.form.service_type,
            service_type_other: this.form.service_type === 'other' ? this.form.service_type_other.trim() : '',
            operator: this.form.operator.trim(),
            comment: this.form.comment.trim(),
        }

        if (this.isEdit) this.$store.dispatch('server/activity/updateService', payload)
        else this.$store.dispatch('server/activity/createService', payload)

        if (payload.operator !== this.lastOperator) {
            this.$store.dispatch('gui/saveSetting', { name: 'view.timeline.lastOperator', value: payload.operator })
        }

        this.$emit('saved', payload)
        this.close()
    }
}
</script>
