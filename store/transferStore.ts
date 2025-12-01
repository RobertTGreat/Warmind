import { create } from 'zustand';

export type TransferStatus = 'pending' | 'syncing' | 'success' | 'error';

export type TransferOperation = {
    itemHash: number;
    itemInstanceId: string;
    fromOwnerId: string; // characterId or 'VAULT'
    toOwnerId: string;   // characterId or 'VAULT'
    item: any;           // The full item object for optimistic rendering
    bucketHash?: number; // The target bucket (optional, for predicting slot)
    type: 'transfer' | 'equip';
    status: TransferStatus;
    // For error recovery / bounce-back animation
    originalPosition?: {
        ownerId: string;
        bucketHash?: number;
    };
    // Timestamp for animation timing
    startTime: number;
};

interface TransferStore {
    pendingOperations: TransferOperation[];
    addOperation: (op: Omit<TransferOperation, 'status' | 'startTime' | 'originalPosition'>) => void;
    updateOperationStatus: (itemInstanceId: string, status: TransferStatus) => void;
    removeOperation: (itemInstanceId: string) => void;
    getOperationStatus: (itemInstanceId: string) => TransferStatus | null;
    isItemTransferring: (itemInstanceId: string) => boolean;
}

export const useTransferStore = create<TransferStore>((set, get) => ({
    pendingOperations: [],
    
    addOperation: (op) => set((state) => ({ 
        pendingOperations: [...state.pendingOperations, {
            ...op,
            status: 'syncing' as TransferStatus,
            startTime: Date.now(),
            originalPosition: {
                ownerId: op.fromOwnerId,
                bucketHash: op.bucketHash
            }
        }] 
    })),
    
    updateOperationStatus: (id, status) => set((state) => ({
        pendingOperations: state.pendingOperations.map(op => 
            op.itemInstanceId === id 
                ? { ...op, status } 
                : op
        )
    })),
    
    removeOperation: (id) => set((state) => ({ 
        pendingOperations: state.pendingOperations.filter(op => op.itemInstanceId !== id) 
    })),
    
    getOperationStatus: (id) => {
        const op = get().pendingOperations.find(op => op.itemInstanceId === id);
        return op?.status ?? null;
    },
    
    isItemTransferring: (id) => {
        return get().pendingOperations.some(op => op.itemInstanceId === id);
    }
}));
