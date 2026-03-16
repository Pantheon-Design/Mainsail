import { FarmPrinterState } from '@/store/farm/printer/types'

export interface FarmState {
    fleetDaemonPrinters: { [hostname: string]: any };
    fleetDaemonConnected: boolean;
    [printerId: string]: any; // <- allow dynamic printer namespaces
}
