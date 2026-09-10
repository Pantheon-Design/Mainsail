import axios from 'axios'

/**
 * Extract a human-readable error message from an axios error or generic Error.
 * Prioritises the backend's `detail` field, then status text, then message.
 */
export function extractError(err: any): string {
    if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail
        if (detail) return typeof detail === 'string' ? detail : JSON.stringify(detail)
        if (err.response) return `Server error ${err.response.status}: ${err.response.statusText}`
        if (err.code === 'ECONNABORTED') return 'Request timed out — is fleet_daemon running?'
        if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error'))
            return 'Network error — cannot reach fleet_daemon'
        return err.message || 'Unknown request error'
    }
    if (err instanceof Error) return err.message
    return String(err)
}

/** HTTP status of an axios error, or null for non-HTTP failures. */
export function errorStatus(err: any): number | null {
    if (axios.isAxiosError(err)) return err.response?.status ?? null
    return null
}

/**
 * Error thrown by fleet store actions: carries the HTTP status so callers
 * can react to 404/409 without string matching.
 */
export class FleetApiError extends Error {
    status: number | null

    constructor(message: string, status: number | null) {
        super(message)
        this.name = 'FleetApiError'
        this.status = status
    }
}

export function toApiError(err: any): FleetApiError {
    return new FleetApiError(extractError(err), errorStatus(err))
}

/** Encode a relative path for use inside a URL, keeping '/' separators. */
export function encodePath(path: string): string {
    return path
        .replace(/^\/+/, '')
        .split('/')
        .map((s) => encodeURIComponent(s))
        .join('/')
}
