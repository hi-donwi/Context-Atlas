import type { ContextExportOptions, ContextPacket, ContextSnapshot } from './types.js';
/** Create a portable packet; authorization and source allowlists remain host-owned. */
export declare function exportContext(snapshot: ContextSnapshot, options: ContextExportOptions): ContextPacket;
