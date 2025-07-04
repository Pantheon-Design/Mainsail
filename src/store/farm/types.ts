import { FarmPrinterState } from '@/store/farm/printer/types'

export interface FarmState {
    fleetDaemonPrinters: { [hostname: string]: any };
    [printerId: string]: any; // <- allow dynamic printer namespaces
}
