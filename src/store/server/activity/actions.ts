import Vue from 'vue'
import { ActionTree } from 'vuex'
import { ServerActivityFilters, ServerActivitySettings, ServerActivityState } from '@/store/server/activity/types'
import { RootState } from '@/store/types'
import { ActivityEvent, ActivityServiceForm } from '@/components/timeline/types'
import { ACTIVITY_PAGE_LIMIT } from '@/store/server/activity/index'

function buildListParams(filters: ServerActivityFilters, before: number | null): Record<string, any> {
    const params: Record<string, any> = {
        sort: 'ts',
        order: 'desc',
        limit: ACTIVITY_PAGE_LIMIT,
        tier: filters.tier === 1 ? '1' : '1,2',
    }
    if (filters.types.length) params.types = filters.types.join(',')
    if (filters.after !== null) params.after = filters.after
    const beforeTs = before ?? filters.before
    if (beforeTs !== null && beforeTs !== undefined) params.before = beforeTs

    return params
}

function passesFilters(event: ActivityEvent, filters: ServerActivityFilters): boolean {
    if (event.deleted) return false
    if (filters.tier === 1 && event.tier !== 1) return false
    if (filters.types.length && !filters.types.includes(event.type)) return false
    if (filters.after !== null && event.ts < filters.after) return false
    if (filters.before !== null && event.ts >= filters.before) return false

    return true
}

export const actions: ActionTree<ServerActivityState, RootState> = {
    reset({ commit }) {
        commit('reset')
    },

    init({ dispatch }) {
        Vue.$socket.emit('server.activity.service_types', {}, { action: 'server/activity/setServiceTypes' })
        Vue.$socket.emit('server.activity.get_settings', {}, { action: 'server/activity/setSettings' })
        dispatch('loadEvents', { reset: true })
    },

    loadEvents({ commit, state }, opts: { reset?: boolean; before?: number } = {}) {
        const before = opts.before ?? null
        if (before === null) commit('setLoading', true)
        else commit('setLoadingMore', true)

        Vue.$socket.emit('server.activity.list', buildListParams(state.filters, before), {
            action: 'server/activity/getEvents',
        })
    },

    getEvents({ commit, dispatch }, payload) {
        const requestParams = payload.requestParams ?? {}
        const events: ActivityEvent[] = Array.isArray(payload.events) ? payload.events : []
        const isFirstPage = requestParams.before === undefined || requestParams.before === null

        if (isFirstPage) commit('setEvents', events)
        else commit('appendEvents', events)

        commit('setMeta', {
            total: payload.total ?? 0,
            max_seq: payload.max_seq ?? 0,
            min_seq: payload.min_seq ?? 0,
            epoch: payload.epoch ?? null,
        })
        const limit = requestParams.limit ?? ACTIVITY_PAGE_LIMIT
        commit('setHasMore', payload.has_more ?? events.length >= limit)
        commit('setLoading', false)
        commit('setLoadingMore', false)

        dispatch('socket/removeInitModule', 'server/activity/init', { root: true })
    },

    loadMore({ state, dispatch }) {
        if (!state.events.length || state.loadingMore) return

        const oldest = state.events[state.events.length - 1]
        dispatch('loadEvents', { before: oldest.ts })
    },

    refresh({ dispatch }) {
        dispatch('loadEvents', { reset: true })
    },

    setFilters({ commit, dispatch }, filters: Partial<ServerActivityFilters>) {
        commit('setFilters', filters)
        dispatch('loadEvents', { reset: true })
    },

    getChanged({ commit, state }, payload: { action: string; event: ActivityEvent }) {
        const event = payload?.event
        if (!event) return

        if (payload.action === 'deleted' || event.deleted) {
            commit('removeEvent', event.id)
            return
        }

        const known = state.events.some((e) => e.id === event.id)
        if (known || passesFilters(event, state.filters)) commit('upsertEvent', event)
    },

    setServiceTypes({ commit }, payload) {
        commit('setServiceTypes', payload.service_types ?? [])
    },

    setSettings({ commit }, payload) {
        if (payload?.settings) commit('setSettings', payload.settings)
    },

    saveSettings(_, payload: Partial<ServerActivitySettings>) {
        Vue.$socket.emit('server.activity.post_settings', payload, { action: 'server/activity/setSettings' })
    },

    createService(_, payload: ActivityServiceForm) {
        Vue.$socket.emit('server.activity.post_service', {
            service_type: payload.service_type,
            service_type_other: payload.service_type_other,
            service_time: payload.service_time,
            operator: payload.operator,
            comment: payload.comment,
        })
    },

    updateService(_, payload: ActivityServiceForm) {
        Vue.$socket.emit('server.activity.service.update', {
            id: payload.id,
            service_type: payload.service_type,
            service_type_other: payload.service_type_other,
            service_time: payload.service_time,
            operator: payload.operator,
            comment: payload.comment,
        })
    },

    deleteService(_, id: string) {
        Vue.$socket.emit('server.activity.delete_service', { id })
    },
}
