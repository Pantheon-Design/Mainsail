export interface LockRecord {
    owner_tab_id: string
    owner_connection_id: number | null
    owner_label: string
    claimed_at: number
    last_heartbeat: number
}

export type LockStatus = 'idle' | 'checking' | 'owned' | 'blocked'

export interface ExclusiveLockState {
    status: LockStatus
    lockData: LockRecord | null
    heartbeatTimer: number | null
    pollTimer: number | null
    tabId: string
}
