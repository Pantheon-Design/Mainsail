import { GetterTree } from 'vuex'
import { ExclusiveLockState } from './types'
import { RootState } from '@/store/types'

export const getters: GetterTree<ExclusiveLockState, RootState> = {
    isBlocked: (state): boolean => state.status === 'blocked',
    isChecking: (state): boolean => state.status === 'checking',
    hasLock: (state): boolean => state.status === 'owned',
    getLockData: (state) => state.lockData,
}
