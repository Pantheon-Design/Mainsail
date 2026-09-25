import {
    mdiAlertCircle,
    mdiAlertOctagon,
    mdiAlertOctagram,
    mdiAxisArrow,
    mdiBackupRestore,
    mdiCheckCircle,
    mdiCheckDecagram,
    mdiCloseCircle,
    mdiCodeBraces,
    mdiCodeTags,
    mdiCounter,
    mdiDelete,
    mdiDownload,
    mdiFileCog,
    mdiHome,
    mdiInformationOutline,
    mdiPaletteSwatch,
    mdiPaperRoll,
    mdiPause,
    mdiPlay,
    mdiPower,
    mdiPowerPlugOff,
    mdiPrinter3dNozzle,
    mdiPrinter3dNozzleOutline,
    mdiRestart,
    mdiRobotIndustrial,
    mdiThermometer,
    mdiUpload,
    mdiWrench,
} from '@mdi/js'

export interface ActivityTypeMeta {
    icon: string
    color: string
}

export const activityTypeMeta: Record<string, ActivityTypeMeta> = {
    print_started: { icon: mdiPlay, color: 'success' },
    print_resumed: { icon: mdiPlay, color: 'info' },
    print_paused: { icon: mdiPause, color: 'warning' },
    print_completed: { icon: mdiCheckCircle, color: 'success' },
    print_cancelled: { icon: mdiCloseCircle, color: 'warning' },
    print_error: { icon: mdiAlertCircle, color: 'error' },
    print_interrupted: { icon: mdiPowerPlugOff, color: 'error' },
    filament_set: { icon: mdiPaletteSwatch, color: 'primary' },
    spool_loaded: { icon: mdiPaperRoll, color: 'primary' },
    nozzle_set: { icon: mdiPrinter3dNozzle, color: 'primary' },
    nozzle_life_reset: { icon: mdiPrinter3dNozzleOutline, color: 'grey' },
    service: { icon: mdiWrench, color: 'primary' },
    klippy_shutdown: { icon: mdiPower, color: 'error' },
    klippy_error: { icon: mdiAlertOctagon, color: 'error' },
    emergency_stop: { icon: mdiAlertOctagram, color: 'error' },
    firmware_restart: { icon: mdiRestart, color: 'warning' },
    prime_confirmed: { icon: mdiCheckDecagram, color: 'success' },
    prime_reset: { icon: mdiBackupRestore, color: 'grey' },
    fleet_worker_toggled: { icon: mdiRobotIndustrial, color: 'info' },
    gcode: { icon: mdiCodeBraces, color: 'grey' },
    jog: { icon: mdiAxisArrow, color: 'grey' },
    homing: { icon: mdiHome, color: 'grey' },
    macro: { icon: mdiCodeTags, color: 'grey' },
    temperature: { icon: mdiThermometer, color: 'orange' },
    klippy_restart: { icon: mdiRestart, color: 'grey' },
    klippy_ready: { icon: mdiCheckCircle, color: 'grey' },
    moonraker_started: { icon: mdiPower, color: 'grey' },
    moonraker_exit: { icon: mdiPower, color: 'grey' },
    odometer_set: { icon: mdiCounter, color: 'grey' },
    tripmeter_reset: { icon: mdiCounter, color: 'grey' },
    fleet_download: { icon: mdiDownload, color: 'info' },
    file_uploaded: { icon: mdiUpload, color: 'grey' },
    file_deleted: { icon: mdiDelete, color: 'grey' },
    config_generate: { icon: mdiFileCog, color: 'info' },
}

const fallbackMeta: ActivityTypeMeta = { icon: mdiInformationOutline, color: 'grey' }

export function getActivityTypeMeta(type: string): ActivityTypeMeta {
    if (type in activityTypeMeta) return activityTypeMeta[type]
    if (type.startsWith('client.')) return { icon: mdiFileCog, color: 'info' }
    return fallbackMeta
}

export const sourceColor: Record<string, string> = {
    mainsail: 'primary',
    klipperscreen: 'teal',
    fleet_daemon: 'indigo',
    http: 'grey',
    websocket: 'grey',
    system: 'blue-grey',
}

export function getSourceColor(source: string | null | undefined): string {
    if (!source) return 'grey'
    return sourceColor[source] ?? 'grey'
}

/** Type groups used by the type multi-select. Category keys map to Timeline.Categories.<key>. */
export const activityTypeCategories: { key: string; types: string[] }[] = [
    {
        key: 'Print',
        types: [
            'print_started',
            'print_paused',
            'print_resumed',
            'print_completed',
            'print_cancelled',
            'print_error',
            'print_interrupted',
        ],
    },
    {
        key: 'Consumables',
        types: ['filament_set', 'spool_loaded', 'nozzle_set', 'nozzle_life_reset'],
    },
    { key: 'Service', types: ['service'] },
    {
        key: 'Klipper',
        types: [
            'klippy_shutdown',
            'klippy_error',
            'emergency_stop',
            'firmware_restart',
            'klippy_restart',
            'klippy_ready',
            'prime_confirmed',
            'prime_reset',
        ],
    },
    {
        key: 'Fleet',
        types: ['fleet_worker_toggled', 'fleet_download', 'file_uploaded', 'file_deleted'],
    },
    { key: 'Motion', types: ['jog', 'homing', 'temperature', 'macro', 'gcode', 'odometer_set', 'tripmeter_reset'] },
    { key: 'Other', types: ['moonraker_started', 'moonraker_exit', 'config_generate'] },
]

export const tier1Types: string[] = [
    'print_started',
    'print_paused',
    'print_resumed',
    'print_completed',
    'print_cancelled',
    'print_error',
    'print_interrupted',
    'filament_set',
    'spool_loaded',
    'nozzle_set',
    'nozzle_life_reset',
    'service',
    'klippy_shutdown',
    'klippy_error',
    'emergency_stop',
    'firmware_restart',
    'prime_confirmed',
    'prime_reset',
    'fleet_worker_toggled',
]
