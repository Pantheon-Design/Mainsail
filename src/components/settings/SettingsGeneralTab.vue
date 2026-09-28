<template>
    <div>
        <v-card flat>
            <v-card-text>
                <settings-row :title="$t('Name')">
                    <v-text-field v-model="printerName" hide-details outlined dense></v-text-field>
                </settings-row>
                <v-divider class="my-2" />
                <settings-row :title="$t('Settings.GeneralTab.Language')">
                    <v-select v-model="currentLanguage" :items="availableLanguages" hide-details outlined dense />
                </settings-row>
                <v-divider class="my-2" />
                <settings-row :title="$t('Settings.GeneralTab.DateFormat')">
                    <v-select v-model="dateFormat" :items="dateFormatItems" hide-details outlined dense />
                </settings-row>
                <v-divider class="my-2" />
                <settings-row :title="$t('Settings.GeneralTab.TimeFormat')">
                    <v-select v-model="timeFormat" :items="timeFormatItems" hide-details outlined dense />
                </settings-row>
                <v-divider class="my-2" />
                <settings-row
                    :title="$t('Settings.GeneralTab.CalcPrintProgress')"
                    :sub-title="$t('Settings.GeneralTab.CalcPrintProgressDescription')">
                    <v-select v-model="calcPrintProgress" :items="calcPrintProgressItems" hide-details dense outlined />
                </settings-row>
                <v-divider class="my-2" />
                <settings-row
                    :title="$t('Settings.GeneralTab.CalcEstimateTime')"
                    :sub-title="$t('Settings.GeneralTab.CalcEstimateTimeDescription')">
                    <v-select
                        v-model="calcEstimateTime"
                        :items="calcEstimateItems"
                        multiple
                        hide-details
                        dense
                        outlined />
                </settings-row>
                <v-divider class="my-2" />
                <settings-row
                    :title="$t('Settings.GeneralTab.CalcEtaTime')"
                    :sub-title="$t('Settings.GeneralTab.CalcEtaTimeDescription')">
                    <v-select v-model="calcEtaTime" :items="calcEtaTimeItems" multiple hide-details dense outlined />
                </settings-row>
                <v-divider class="my-2" />
                <settings-row
                    :title="$t('Settings.GeneralTab.BackupFleetDaemonUrl')"
                    :sub-title="$t('Settings.GeneralTab.BackupFleetDaemonUrlDescription')"
                    :dynamic-slot-width="true">
                    <div class="d-flex align-center flex-wrap" style="gap: 8px">
                        <v-text-field
                            v-model="backupUrlInput"
                            placeholder="http://backup-host:8090"
                            hide-details="auto"
                            dense
                            outlined
                            style="min-width: 260px"
                            :error-messages="backupUrlError"
                            @keyup.enter="connectBackup" />
                        <v-btn small color="primary" :disabled="!backupUrlInput.trim()" @click="connectBackup">
                            <v-icon left small>{{ mdiLanConnect }}</v-icon>
                            {{ $t('Settings.GeneralTab.BackupFleetDaemonConnect') }}
                        </v-btn>
                        <v-btn v-if="backupActive" small outlined @click="revertBackup">
                            {{ $t('Settings.GeneralTab.BackupFleetDaemonRevert') }}
                        </v-btn>
                    </div>
                    <div v-if="backupActive" class="text-caption warning--text mt-1">
                        {{
                            $t('Settings.GeneralTab.BackupFleetDaemonActive', {
                                url: backupActive,
                                primary: primaryFleetDaemonUrl,
                            })
                        }}
                    </div>
                </settings-row>
                <v-divider class="my-2" />
                <settings-row :title="$t('Settings.GeneralTab.MainsailSettingsMoonrakerDb')" :dynamic-slot-width="true">
                    <settings-general-tab-backup-database />
                    <settings-general-tab-restore-database />
                </settings-row>
                <v-divider class="my-2" />
                <settings-row :title="$t('Settings.GeneralTab.FactoryReset')" :dynamic-slot-width="true">
                    <settings-general-tab-reset-database />
                </settings-row>
            </v-card-text>
        </v-card>
    </div>
</template>

<script lang="ts">
import Component from 'vue-class-component'
import { Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import SettingsRow from '@/components/settings/SettingsRow.vue'
import Panel from '@/components/ui/Panel.vue'
import CheckboxList from '@/components/inputs/CheckboxList.vue'
import SettingsGeneralTabBackupDatabase from '@/components/settings/General/GeneralBackup.vue'
import SettingsGeneralTabRestoreDatabase from '@/components/settings/General/GeneralRestore.vue'
import SettingsGeneralTabResetDatabase from '@/components/settings/General/GeneralReset.vue'
import SettingsGeneralDatabase from '@/components/mixins/settingsGeneralDatabase'
import { mdiLanConnect } from '@mdi/js'

@Component({
    components: {
        Panel,
        SettingsRow,
        CheckboxList,
        SettingsGeneralTabBackupDatabase,
        SettingsGeneralTabRestoreDatabase,
        SettingsGeneralTabResetDatabase,
    },
})
export default class SettingsGeneralTab extends Mixins(BaseMixin, SettingsGeneralDatabase) {
    availableLanguages: { text: string; value: string }[] = []
    mdiLanConnect = mdiLanConnect

    // ---- backup fleet daemon (session only; see gui/setFleetDaemonUrlOverride) ----
    backupUrlInput = ''
    backupUrlError = ''

    /** Backup URL currently in use, or null when the printers URL is active. */
    get backupActive(): string | null {
        return this.$store.getters['gui/fleetDaemonUrlOverride']
    }

    /** The URL from Settings > Printers (or the same-host default) that a reload returns to. */
    get primaryFleetDaemonUrl(): string {
        return this.$store.state.gui.fleetDaemonUrl || `http://${window.location.hostname}:8090`
    }

    connectBackup() {
        let url = this.backupUrlInput.trim().replace(/\/+$/, '')
        // A bare "host:port" is not a valid origin for XHR; assume http (same rule as Settings > Printers).
        if (url && !/^([a-z][a-z0-9+.-]*:)?\/\//i.test(url)) url = `http://${url}`
        try {
            if (!url) throw new Error('empty')
            new URL(url)
        } catch (e) {
            this.backupUrlError = this.$t('Settings.GeneralTab.BackupFleetDaemonUrlInvalid') as string
            return
        }
        this.backupUrlError = ''
        this.backupUrlInput = url
        this.$store.dispatch('gui/setFleetDaemonUrlOverride', url)
    }

    revertBackup() {
        this.backupUrlError = ''
        this.backupUrlInput = ''
        this.$store.dispatch('gui/setFleetDaemonUrlOverride', null)
    }

    async created() {
        // Show the backup URL only while it is in use (it is never persisted).
        this.backupUrlInput = this.backupActive ?? ''
        const locales = import.meta.glob<string>('../../locales/*.json', { import: 'title' })
        const languages: { text: string; value: string }[] = []

        for (const file in locales) {
            const langKey = file.slice(file.lastIndexOf('/') + 1, file.lastIndexOf('.'))
            const title = await locales[file]()

            languages.push({
                text: title,
                value: langKey,
            })
        }

        this.availableLanguages = languages
    }

    get printerName() {
        return this.$store.state.gui.general.printername
    }

    set printerName(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'general.printername', value: newVal })
    }

    get currentLanguage() {
        return this.$store.state.gui.general.language
    }

    set currentLanguage(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'general.language', value: newVal })
    }

    get dateFormat() {
        return this.$store.state.gui.general.dateFormat
    }

    set dateFormat(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'general.dateFormat', value: newVal })
    }

    get dateFormatItems() {
        const date = new Date()
        const userLocale =
            navigator.languages && navigator.languages.length ? navigator.languages[0] : navigator.language

        return [
            { value: null, text: `Browser (${date.toLocaleDateString(userLocale, { dateStyle: 'medium' })})` },
            {
                value: '2-digits',
                text: date.toLocaleDateString(userLocale, { day: '2-digit', month: '2-digit', year: 'numeric' }),
            },
            {
                value: 'short',
                text: date.toLocaleDateString(userLocale, { day: '2-digit', month: 'short', year: 'numeric' }),
            },
        ]
    }

    get timeFormat() {
        return this.$store.state.gui.general.timeFormat
    }

    set timeFormat(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'general.timeFormat', value: newVal })
    }

    get timeFormatItems() {
        const date = new Date()
        const userLocale =
            navigator.languages && navigator.languages.length ? navigator.languages[0] : navigator.language

        return [
            { value: null, text: `Browser (${date.toLocaleTimeString(userLocale, { timeStyle: 'short' })})` },
            {
                value: '24hours',
                text: this.$t('Settings.GeneralTab.24hours', {
                    time: date.toLocaleTimeString(userLocale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
                }),
            },
            {
                value: '12hours',
                text: this.$t('Settings.GeneralTab.12hours', {
                    time: date.toLocaleTimeString(userLocale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h12' }),
                }),
            },
        ]
    }

    get calcPrintProgressItems() {
        return [
            { value: 'file-relative', text: this.$t('Settings.GeneralTab.CalcPrintProgressItems.FileRelative') },
            { value: 'file-absolute', text: this.$t('Settings.GeneralTab.CalcPrintProgressItems.FileAbsolute') },
            { value: 'slicer', text: this.$t('Settings.GeneralTab.CalcPrintProgressItems.Slicer') },
            { value: 'filament', text: this.$t('Settings.GeneralTab.CalcPrintProgressItems.Filament') },
        ]
    }

    get calcPrintProgress() {
        return this.$store.state.gui.general.calcPrintProgress ?? 'file-relative'
    }

    set calcPrintProgress(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'general.calcPrintProgress', value: newVal })
    }

    get calcEstimateItems() {
        return [
            { value: 'file', text: this.$t('Settings.GeneralTab.EstimateValues.File') },
            { value: 'filament', text: this.$t('Settings.GeneralTab.EstimateValues.Filament') },
        ]
    }

    get calcEstimateTime() {
        return this.$store.state.gui.general.calcEstimateTime
    }

    set calcEstimateTime(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'general.calcEstimateTime', value: newVal })
    }

    get calcEtaTimeItems() {
        return [
            { value: 'file', text: this.$t('Settings.GeneralTab.EstimateValues.File') },
            { value: 'filament', text: this.$t('Settings.GeneralTab.EstimateValues.Filament') },
            { value: 'slicer', text: this.$t('Settings.GeneralTab.EstimateValues.Slicer') },
        ]
    }

    get calcEtaTime() {
        return this.$store.state.gui.general.calcEtaTime
    }

    set calcEtaTime(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'general.calcEtaTime', value: newVal })
    }
}
</script>
