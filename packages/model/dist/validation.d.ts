import type { ContextSnapshot, ValidationResult } from './types.js';
/** Validate structural shape and graph references without modifying imported data. */
export declare function validateSnapshot(input: unknown): ValidationResult;
export declare function assertSnapshot(snapshot: ContextSnapshot): void;
