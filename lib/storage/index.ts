/**
 * Storage Module
 * 
 * Centralized exports for all storage-related functionality.
 * 
 * Architecture:
 * - Cache API: Full manifest definitions (HTTP response caching)
 * - IndexedDB (Dexie): Queryable data, user data, profiles
 * - localStorage: Tiny UI preferences (synchronous access)
 */

// Database
export * from '../db';

// Manifest (Cache API + Dexie Index)
export * from '../manifestCache';
export * from '../manifestIndex';

// Profile Cache
export * from '../profileCache';

// User Data Services
export * from '../loadoutService';
export * from '../wishlistService';
export * from '../itemAnnotations';

// Data Migration
export * from '../dataMigration';

