/**
 * Canonical key for matching hostnames across the roster (gui/remoteprinters), fleet_daemon
 * frames and the scheduler's worker lists.
 *
 * fleet_daemon lowercases every roster hostname and appends `.local` when missing
 * (`Oven1` -> `oven1.local`) before connecting and broadcasting, so a roster entry saved as
 * `oven1` must still match the `oven1.local` frame. Equality therefore ignores case and that
 * suffix. Use this for every roster <-> daemon lookup instead of `toLowerCase()`.
 */
export function hostKey(hostname: string | null | undefined): string {
    return (hostname || '')
        .trim()
        .toLowerCase()
        .replace(/\.local$/, '')
}

export function sameHost(a: string | null | undefined, b: string | null | undefined): boolean {
    return hostKey(a) === hostKey(b)
}
