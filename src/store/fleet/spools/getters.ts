import { GetterTree } from 'vuex'
import { FleetSpoolsState, FleetVendor, FleetFilament, FleetSpool } from './types'

export const getters: GetterTree<FleetSpoolsState, any> = {
    getVendors(state): FleetVendor[] {
        return state.vendors
    },

    getFilaments(state): FleetFilament[] {
        return state.filaments
    },

    getSpools(state): FleetSpool[] {
        return state.spools
    },

    isLoading(state): boolean {
        return state.loading
    },

    getVendorById: (state) => (id: number): FleetVendor | undefined => {
        return state.vendors.find((v) => v.id === id)
    },

    getFilamentById: (state) => (id: number): FleetFilament | undefined => {
        return state.filaments.find((f) => f.id === id)
    },

    getMaterials(state): string[] {
        const materials = new Set(state.filaments.map((f) => f.material))
        return Array.from(materials).sort()
    },

    getLocations(state): string[] {
        const locations = new Set(
            state.spools
                .map((s) => s.location)
                .filter((l): l is string => l != null && l !== '')
        )
        return Array.from(locations).sort()
    },
}
