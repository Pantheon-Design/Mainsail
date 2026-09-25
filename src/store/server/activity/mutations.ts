import { getDefaultState } from './index'
import Vue from 'vue'
import { MutationTree } from 'vuex'
import { ServerActivityState } from '@/store/server/activity/types'
import { ActivityEvent } from '@/components/timeline/types'

export const mutations: MutationTree<ServerActivityState> = {
    reset(state) {
        Object.assign(state, getDefaultState())
    },

    setEvents(state, events: ActivityEvent[]) {
        Vue.set(state, 'events', events)
    },

    appendEvents(state, events: ActivityEvent[]) {
        const existing = new Set(state.events.map((e) => e.id))
        const novel = events.filter((e) => !existing.has(e.id))
        Vue.set(state, 'events', [...state.events, ...novel])
    },

    upsertEvent(state, event: ActivityEvent) {
        const index = state.events.findIndex((e) => e.id === event.id)
        if (index !== -1) {
            Vue.set(state.events, index, event)
            return
        }

        // keep newest-first order by ts
        const events = [...state.events]
        const insertAt = events.findIndex((e) => e.ts <= event.ts)
        if (insertAt === -1) events.push(event)
        else events.splice(insertAt, 0, event)
        Vue.set(state, 'events', events)
    },

    removeEvent(state, id: string) {
        const index = state.events.findIndex((e) => e.id === id)
        if (index !== -1) state.events.splice(index, 1)
    },

    setMeta(state, payload: { total: number; max_seq: number; min_seq: number; epoch: string | null }) {
        Vue.set(state, 'total', payload.total)
        Vue.set(state, 'max_seq', payload.max_seq)
        Vue.set(state, 'min_seq', payload.min_seq)
        Vue.set(state, 'epoch', payload.epoch)
    },

    setHasMore(state, value: boolean) {
        Vue.set(state, 'hasMore', value)
    },

    setLoading(state, value: boolean) {
        Vue.set(state, 'loading', value)
    },

    setLoadingMore(state, value: boolean) {
        Vue.set(state, 'loadingMore', value)
    },

    setFilters(state, payload) {
        Vue.set(state, 'filters', { ...state.filters, ...payload })
    },

    setServiceTypes(state, payload) {
        Vue.set(state, 'serviceTypes', payload)
    },

    setSettings(state, payload) {
        Vue.set(state, 'settings', { ...state.settings, ...payload })
    },
}
