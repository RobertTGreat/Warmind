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
    // O(1) lookup of a single item's transfer status, kept in sync with the array.
    operationStatusByItemId: Map<string, TransferStatus>;
    addOperation: (op: Omit<TransferOperation, 'status' | 'startTime' | 'originalPosition'>) => void;
    updateOperationStatus: (itemInstanceId: string, status: TransferStatus) => void;
    removeOperation: (itemInstanceId: string) => void;
    getOperationStatus: (itemInstanceId: string) => TransferStatus | null;
    isItemTransferring: (itemInstanceId: string) => boolean;
}

function buildOperationStatusIndex(
    pendingOperations: TransferOperation[],
): Map<string, TransferStatus> {
    const statusByItemId = new Map<string, TransferStatus>();
    for (const operation of pendingOperations) {
        statusByItemId.set(operation.itemInstanceId, operation.status);
    }
    return statusByItemId;
}

export const useTransferStore = create<TransferStore>((set, get) => ({
    pendingOperations: [],
    operationStatusByItemId: new Map<string, TransferStatus>(),

    addOperation: (op) => set((state) => {
        const pendingOperations = [...state.pendingOperations, {
            ...op,
            status: 'syncing' as TransferStatus,
            startTime: Date.now(),
            originalPosition: {
                ownerId: op.fromOwnerId,
                bucketHash: op.bucketHash
            }
        }];
        return {
            pendingOperations,
            operationStatusByItemId: buildOperationStatusIndex(pendingOperations),
        };
    }),

    updateOperationStatus: (id, status) => set((state) => {
        const pendingOperations = state.pendingOperations.map(op =>
            op.itemInstanceId === id
                ? { ...op, status }
                : op
        );
        return {
            pendingOperations,
            operationStatusByItemId: buildOperationStatusIndex(pendingOperations),
        };
    }),

    removeOperation: (id) => set((state) => {
        const pendingOperations = state.pendingOperations.filter(
            op => op.itemInstanceId !== id
        );
        return {
            pendingOperations,
            operationStatusByItemId: buildOperationStatusIndex(pendingOperations),
        };
    }),

    getOperationStatus: (id) => {
        return get().operationStatusByItemId.get(id) ?? null;
    },

    isItemTransferring: (id) => {
        return get().operationStatusByItemId.has(id);
    }
}));
