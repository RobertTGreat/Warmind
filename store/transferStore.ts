import { create } from 'zustand';

export type TransferOperation = {
    itemHash: number;
    itemInstanceId: string;
    fromOwnerId: string; // characterId or 'VAULT'
    toOwnerId: string;   // characterId or 'VAULT'
    item: any;           // The full item object for optimistic rendering
    bucketHash?: number; // The target bucket (optional, for predicting slot)
    type: 'transfer' | 'equip';
};

interface TransferStore {
    pendingOperations: TransferOperation[];
    addOperation: (op: TransferOperation) => void;
    removeOperation: (itemInstanceId: string) => void;
}

export const useTransferStore = create<TransferStore>((set) => ({
    pendingOperations: [],
    addOperation: (op) => set((state) => ({ 
        pendingOperations: [...state.pendingOperations, op] 
    })),
    removeOperation: (id) => set((state) => ({ 
        pendingOperations: state.pendingOperations.filter(op => op.itemInstanceId !== id) 
    })),
}));

