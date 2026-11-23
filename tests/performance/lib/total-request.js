// Backward-compatible re-export.
//
// The request logic has moved to request.js (which supports any endpoint),
// but older imports of total-request.js still work through this file.

export { getTotal, makeRequest } from './request.js';
