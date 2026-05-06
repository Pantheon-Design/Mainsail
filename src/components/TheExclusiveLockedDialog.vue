<style scoped>
.lock-meta {
    font-size: 0.85em;
    opacity: 0.75;
}

.takeover-warning {
    font-size: 0.85em;
    line-height: 1.4;
}
</style>

<template>
    <v-dialog v-model="showDialog" persistent :width="460">
        <v-card>
            <v-toolbar flat dense>
                <v-toolbar-title>
                    <span class="subheading">
                        <v-icon left>{{ mdiLockOutline }}</v-icon>
                        Mainsail in use
                    </span>
                </v-toolbar-title>
            </v-toolbar>

            <v-card-text class="pt-5">
                <p class="mb-2">
                    This Mainsail instance is already being used by another browser. Only one session can control the
                    printer at a time.
                </p>

                <v-divider class="my-3"></v-divider>

                <div v-if="lockData">
                    <div>
                        <strong>Active session:</strong>
                        {{ lockData.owner_label }}
                    </div>
                    <div class="lock-meta">Connected since {{ formatDateTime(lockData.claimed_at) }}</div>
                    <div class="lock-meta">Last activity {{ relativeHeartbeat }}</div>
                </div>
                <div v-else>
                    <div class="lock-meta">Looking for active session…</div>
                </div>

                <v-divider class="my-3"></v-divider>

                <div class="text-center mb-3">
                    <v-btn class="primary--text" :loading="checking" @click="tryAgain">Try again</v-btn>
                </div>

                <v-expansion-panels flat>
                    <v-expansion-panel>
                        <v-expansion-panel-header class="px-2 py-1">
                            <span class="subheading">
                                <v-icon left small color="warning">{{ mdiAlertOutline }}</v-icon>
                                Force takeover
                            </span>
                        </v-expansion-panel-header>
                        <v-expansion-panel-content>
                            <p class="takeover-warning">
                                Force takeover will disconnect the other session and give control to this browser. Only
                                do this if you are sure the other session was abandoned (e.g. someone closed their
                                laptop without disconnecting). If a print is in progress it will continue, but the
                                previous user will lose control.
                            </p>
                            <div class="text-center">
                                <v-btn color="warning" outlined :loading="checking" @click="forceTakeover">
                                    <v-icon left>{{ mdiAccountSwitch }}</v-icon>
                                    Force takeover
                                </v-btn>
                            </div>
                        </v-expansion-panel-content>
                    </v-expansion-panel>
                </v-expansion-panels>
            </v-card-text>
        </v-card>
    </v-dialog>
</template>

<script lang="ts">
import Component from 'vue-class-component'
import { Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import ThemeMixin from '@/components/mixins/theme'
import { mdiLockOutline, mdiAccountSwitch, mdiAlertOutline } from '@mdi/js'
import { LockRecord } from '@/store/exclusiveLock/types'

@Component({})
export default class TheExclusiveLockedDialog extends Mixins(BaseMixin, ThemeMixin) {
    mdiLockOutline = mdiLockOutline
    mdiAccountSwitch = mdiAccountSwitch
    mdiAlertOutline = mdiAlertOutline

    get showDialog(): boolean {
        return true
    }

    get lockData(): LockRecord | null {
        return this.$store.state.exclusiveLock?.lockData ?? null
    }

    get checking(): boolean {
        return this.$store.state.exclusiveLock?.status === 'checking'
    }

    get relativeHeartbeat(): string {
        const ts = this.lockData?.last_heartbeat
        if (!ts) return 'unknown'
        const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000))
        if (seconds < 5) return 'just now'
        if (seconds < 60) return `${seconds} s ago`
        const minutes = Math.round(seconds / 60)
        return `${minutes} min ago`
    }

    tryAgain() {
        this.$store.dispatch('exclusiveLock/poll')
    }

    forceTakeover() {
        this.$store.dispatch('exclusiveLock/forceTakeover')
    }
}
</script>
