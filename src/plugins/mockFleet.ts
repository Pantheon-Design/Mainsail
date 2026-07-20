// Dev-only mock mode: set VUE_APP_MOCK_FLEET=true in .env.development.local to run
// the UI without Moonraker or the fleet daemon. Fakes the socket-connected state and
// seeds the farm/fleet map with sample printers. Never active in production builds.

export const mockFleetEnabled =
    import.meta.env.DEV && String(import.meta.env.VUE_APP_MOCK_FLEET) === 'true'

interface MockPrinter {
    hostname: string
    model: 'HS-3' | 'HS-Pro'
    // print_stats.state; 'offline' = fleet daemon lost its WS to the printer,
    // 'shutdown' = klipper shutdown (webhooks.state)
    state: 'printing' | 'standby' | 'complete' | 'paused' | 'offline' | 'shutdown'
    progress?: number
    filament?: string
    remaining?: number
    file?: string
    position: { x: number; y: number }
    grid: { x: number; y: number }
}

const MOCK_PRINTERS: MockPrinter[] = [
    { hostname: 'vulcan-01', model: 'HS-3', state: 'printing', progress: 0.42, filament: 'PA-CF', remaining: 1840, file: 'bracket_v3.gcode', position: { x: 150, y: 120 }, grid: { x: 2, y: 2 } },
    { hostname: 'vulcan-02', model: 'HS-3', state: 'printing', progress: 0.87, filament: 'PETG-CF', remaining: 620, file: 'enclosure_lid.gcode', position: { x: 320, y: 180 }, grid: { x: 5, y: 2 } },
    { hostname: 'vulcan-03', model: 'HS-3', state: 'standby', filament: 'PA-GF', remaining: 2900, position: { x: 520, y: 140 }, grid: { x: 8, y: 3 } },
    { hostname: 'vulcan-04', model: 'HS-Pro', state: 'printing', progress: 0.13, filament: 'TPU', remaining: 2100, file: 'gasket_x12.gcode', position: { x: 720, y: 220 }, grid: { x: 12, y: 4 } },
    { hostname: 'vulcan-05', model: 'HS-Pro', state: 'complete', progress: 1, filament: 'PA-CF', remaining: 950, file: 'manifold_rev2.gcode', position: { x: 260, y: 480 }, grid: { x: 3, y: 9 } },
    { hostname: 'vulcan-06', model: 'HS-3', state: 'paused', progress: 0.55, filament: 'PETG-CF', remaining: 1400, file: 'fixture_plate.gcode', position: { x: 480, y: 560 }, grid: { x: 9, y: 11 } },
    { hostname: 'vulcan-07', model: 'HS-Pro', state: 'shutdown', position: { x: 680, y: 640 }, grid: { x: 14, y: 13 } },
    { hostname: 'vulcan-08', model: 'HS-3', state: 'offline', position: { x: 380, y: 780 }, grid: { x: 6, y: 17 } },
    { hostname: 'vulcan-09', model: 'HS-3', state: 'standby', filament: 'PA-GF', remaining: 3000, position: { x: 820, y: 820 }, grid: { x: 17, y: 20 } },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function installMockFleet(store: any) {
    store.commit('socket/setConnected')
    // empty the init list so guiIsReady becomes true and App.vue renders the router view
    store.commit('socket/removeInitModule', 'server')
    store.commit('farm/SET_FLEET_DAEMON_CONNECTED', true)

    MOCK_PRINTERS.forEach((p, i) => {
        const online = p.state !== 'offline'
        const printStatsState = ['offline', 'shutdown'].includes(p.state) ? 'standby' : p.state

        store.commit('gui/remoteprinters/store', {
            id: `mock-${i + 1}`,
            values: {
                hostname: p.hostname,
                port: 7125,
                position: p.position,
                gridPosition: p.grid,
                printerModel: p.model,
            },
        })

        store.commit('farm/SET_FLEET_DAEMON_PRINTER', {
            hostname: p.hostname,
            data: {
                fleet_to_printer_ws: online,
                webhooks: p.state === 'shutdown' ? { state: 'shutdown', state_message: 'Mock shutdown: heater verification failed' } : { state: 'ready' },
                print_stats: { state: printStatsState },
                virtual_sdcard: { progress: p.progress ?? 0 },
                toolhead: {
                    filament_type: p.filament,
                    nozzle_size: 0.4,
                    remaining_weight: p.remaining,
                    used_weight: p.remaining != null ? 3000 - p.remaining : undefined,
                },
                current_file: { filename: p.file, filament_type: p.filament },
                socket: {
                    hostname: p.hostname,
                    port: 7125,
                    webPort: 80,
                    isConnected: online,
                    position: p.position,
                    printerModel: p.model,
                },
            },
        })
    })
}
