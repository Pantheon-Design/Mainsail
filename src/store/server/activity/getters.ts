import { GetterTree } from 'vuex'
import { ServerActivityState } from '@/store/server/activity/types'
import { ActivityEvent } from '@/components/timeline/types'
import { activityTypeCategories, tier1Types } from '@/components/timeline/activityTypes'
import i18n from '@/plugins/i18n'

export const getters: GetterTree<ServerActivityState, any> = {
    getEvents: (state): ActivityEvent[] => {
        return state.events
    },

    getFilteredEvents:
        (state) =>
        (search: string): ActivityEvent[] => {
            const needle = (search ?? '').trim().toLowerCase()
            if (!needle) return state.events

            return state.events.filter((event) => {
                const haystack = [event.summary, event.type, event.filename ?? '', event.source].join(' ').toLowerCase()
                return haystack.includes(needle)
            })
        },

    getServiceTypeItems: (state) => {
        return state.serviceTypes.map((type) => {
            const key = `Timeline.ServiceTypes.${type.id}`
            return {
                text: i18n.te(key) ? i18n.t(key).toString() : type.label,
                value: type.id,
            }
        })
    },

    getTypeItems: (state) => {
        const items: any[] = []
        activityTypeCategories.forEach((category) => {
            const types =
                state.filters.tier === 1 ? category.types.filter((t) => tier1Types.includes(t)) : category.types
            if (!types.length) return

            const headerKey = `Timeline.Categories.${category.key}`
            items.push({ header: i18n.te(headerKey) ? i18n.t(headerKey).toString() : category.key })
            types.forEach((type) => {
                const key = `Timeline.Types.${type}`
                items.push({ text: i18n.te(key) ? i18n.t(key).toString() : type, value: type })
            })
        })

        return items
    },
}
