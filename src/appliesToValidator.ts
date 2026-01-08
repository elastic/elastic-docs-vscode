/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *	http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import * as vscode from 'vscode';

/**
 * Shared applies_to validation logic
 * Used by both frontmatterValidationProvider and directiveDiagnosticProvider
 */

// Lifecycle states for validation
export const LIFECYCLE_STATES = [
    'ga', 'preview', 'beta', 'deprecated', 'removed',
    'unavailable', 'planned', 'development', 'discontinued'
] as const;

// Single lifecycle entry pattern (supports all version specifier formats):
// - Greater than or equal (default): x.x, x.x+, x.x.x, x.x.x+
// - Range: x.x-y.y, x.x.x-y.y.y
// - Exact: =x.x, =x.x.x
// - All: all
export const SINGLE_ENTRY_PATTERN = /^(preview|beta|ga|deprecated|removed|unavailable|planned|development|discontinued)(\s+(all|=[0-9]+(\.[0-9]+)*|[0-9]+(\.[0-9]+)*-[0-9]+(\.[0-9]+)*|[0-9]+(\.[0-9]+)*\+?))?$/;

// Pattern to detect implicit version (x.x without + or =) for hint
export const IMPLICIT_VERSION_PATTERN = /^(preview|beta|ga|deprecated|removed|unavailable|planned|development|discontinued)\s+[0-9]+(\.[0-9]+)*$/;

export interface ParsedVersionEntry {
    originalEntry: string;
    lifecycle: string;
    versionSpec: string | null;
    isRange: boolean;
    isExact: boolean;
    isUnbound: boolean;
    startVersion: number[] | null;
    endVersion: number[] | null;
}

export interface SemanticValidationResult {
    hasImplicitEntries: boolean;
    allEntriesImplicit: boolean;
    unboundCount: number;
    invalidRanges: ParsedVersionEntry[];
    removedExactAsHighest: ParsedVersionEntry | null;
    overlap: [string, string, string] | null;
    parsedEntries: ParsedVersionEntry[];
}

export interface ValidationDiagnostic {
    message: string;
    severity: vscode.DiagnosticSeverity;
    code?: string;
}

/**
 * Parse a version string into an array of numbers
 */
export function parseVersion(versionStr: string): number[] | null {
    if (!versionStr) return null;
    const parts = versionStr.split('.').map(p => parseInt(p, 10));
    if (parts.some(isNaN)) return null;
    return parts;
}

/**
 * Compare two version arrays
 * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export function compareVersions(v1: number[], v2: number[]): number {
    const maxLen = Math.max(v1.length, v2.length);
    for (let i = 0; i < maxLen; i++) {
        const p1 = v1[i] || 0;
        const p2 = v2[i] || 0;
        if (p1 < p2) return -1;
        if (p1 > p2) return 1;
    }
    return 0;
}

/**
 * Parse a single lifecycle entry into structured format
 */
export function parseVersionEntry(entry: string): ParsedVersionEntry | null {
    const trimmed = entry.trim();
    const parts = trimmed.split(/\s+/);
    if (parts.length === 0) return null;

    const lifecycle = parts[0];
    if (!LIFECYCLE_STATES.includes(lifecycle as typeof LIFECYCLE_STATES[number])) return null;

    if (parts.length === 1) {
        // Just lifecycle, no version
        return {
            originalEntry: trimmed,
            lifecycle,
            versionSpec: null,
            isRange: false,
            isExact: false,
            isUnbound: true, // No version means "all versions"
            startVersion: null,
            endVersion: null
        };
    }

    const versionSpec = parts[1];

    // Check for 'all'
    if (versionSpec === 'all') {
        return {
            originalEntry: trimmed,
            lifecycle,
            versionSpec: 'all',
            isRange: false,
            isExact: false,
            isUnbound: true,
            startVersion: null,
            endVersion: null
        };
    }

    // Check for exact version (=x.x)
    if (versionSpec.startsWith('=')) {
        const version = parseVersion(versionSpec.substring(1));
        return {
            originalEntry: trimmed,
            lifecycle,
            versionSpec,
            isRange: false,
            isExact: true,
            isUnbound: false,
            startVersion: version,
            endVersion: version
        };
    }

    // Check for range (x.x-y.y)
    if (versionSpec.includes('-')) {
        const rangeParts = versionSpec.split('-');
        if (rangeParts.length === 2) {
            const startVersion = parseVersion(rangeParts[0]);
            const endVersion = parseVersion(rangeParts[1]);
            return {
                originalEntry: trimmed,
                lifecycle,
                versionSpec,
                isRange: true,
                isExact: false,
                isUnbound: false,
                startVersion,
                endVersion
            };
        }
    }

    // Greater than or equal (x.x or x.x+)
    const versionStr = versionSpec.endsWith('+') ? versionSpec.slice(0, -1) : versionSpec;
    const version = parseVersion(versionStr);
    return {
        originalEntry: trimmed,
        lifecycle,
        versionSpec,
        isRange: false,
        isExact: false,
        isUnbound: true, // Greater-than-or-equal is unbound
        startVersion: version,
        endVersion: null // Infinity
    };
}

/**
 * Get the overlapping version between two entries, or null if no overlap
 */
function getOverlapVersion(a: ParsedVersionEntry, b: ParsedVersionEntry): string | null {
    // If either has no version info, can't determine overlap
    if (!a.startVersion || !b.startVersion) return null;

    // For unbound entries (x.x+), they extend to infinity
    const aEnd = a.isUnbound ? [99999, 99999, 99999] : (a.endVersion || a.startVersion);
    const bEnd = b.isUnbound ? [99999, 99999, 99999] : (b.endVersion || b.startVersion);

    // Check if ranges overlap: a.start <= b.end AND b.start <= a.end
    const aStartLeBEnd = compareVersions(a.startVersion, bEnd) <= 0;
    const bStartLeAEnd = compareVersions(b.startVersion, aEnd) <= 0;

    if (aStartLeBEnd && bStartLeAEnd) {
        // Find the overlapping version - it's the maximum of the two start versions
        // (the point where both ranges begin to cover)
        const overlapStart = compareVersions(a.startVersion, b.startVersion) >= 0
            ? a.startVersion
            : b.startVersion;
        return overlapStart.join('.');
    }

    return null;
}

/**
 * Find overlapping entries and return details about the overlap
 * Returns: [entry1, entry2, overlapping version] or null if no overlap
 */
function findOverlappingEntries(entries: ParsedVersionEntry[]): [string, string, string] | null {
    for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
            const overlapVersion = getOverlapVersion(entries[i], entries[j]);
            if (overlapVersion) {
                return [entries[i].originalEntry, entries[j].originalEntry, overlapVersion];
            }
        }
    }
    return null;
}

/**
 * Analyze applies_to entries in a single pass
 * Returns all semantic validation information needed
 */
export function analyzeAppliesToEntries(entries: string[]): SemanticValidationResult {
    const parsedEntries: ParsedVersionEntry[] = [];
    let implicitCount = 0;
    let versionedCount = 0;
    let unboundCount = 0;
    const invalidRanges: ParsedVersionEntry[] = [];
    let highestVersion: number[] | null = null;
    let highestEntry: ParsedVersionEntry | null = null;
    let removedExactAsHighest: ParsedVersionEntry | null = null;

    // Single pass to collect all information
    for (const entry of entries) {
        if (!entry) continue;

        const parsed = parseVersionEntry(entry);
        if (!parsed) continue;

        parsedEntries.push(parsed);

        // Check if implicit (has version but no + or = or range)
        if (IMPLICIT_VERSION_PATTERN.test(entry)) {
            implicitCount++;
        }

        // Count entries with versions (not just lifecycle state alone)
        if (parsed.versionSpec && parsed.versionSpec !== 'all') {
            versionedCount++;
        }

        // Count unbound entries with versions
        if (parsed.isUnbound && parsed.startVersion) {
            unboundCount++;
        }

        // Check for invalid ranges (min > max)
        if (parsed.isRange && parsed.startVersion && parsed.endVersion) {
            if (compareVersions(parsed.startVersion, parsed.endVersion) > 0) {
                invalidRanges.push(parsed);
            }
        }

        // Track highest version for removed-exact check
        const effectiveVersion = parsed.endVersion || parsed.startVersion;
        if (effectiveVersion) {
            if (!highestVersion || compareVersions(effectiveVersion, highestVersion) > 0) {
                highestVersion = effectiveVersion;
                highestEntry = parsed;
            }
        }
    }

    // Check if highest version is a removed with exact syntax
    if (highestEntry && highestEntry.lifecycle === 'removed' && highestEntry.isExact) {
        removedExactAsHighest = highestEntry;
    }

    const hasImplicitEntries = implicitCount > 0;
    const allEntriesImplicit = versionedCount > 0 && implicitCount === versionedCount;

    // Check for overlapping versions (skip if all implicit)
    let overlap: [string, string, string] | null = null;
    if (parsedEntries.length > 1 && !allEntriesImplicit) {
        overlap = findOverlappingEntries(parsedEntries);
    }

    return {
        hasImplicitEntries,
        allEntriesImplicit,
        unboundCount,
        invalidRanges,
        removedExactAsHighest,
        overlap,
        parsedEntries
    };
}

/**
 * Generate validation diagnostics from semantic analysis results
 */
export function generateSemanticDiagnostics(
    analysis: SemanticValidationResult,
    entries: string[]
): ValidationDiagnostic[] {
    const diagnostics: ValidationDiagnostic[] = [];

    // Hint for implicit version syntax
    if (analysis.hasImplicitEntries) {
        if (analysis.allEntriesImplicit && entries.length > 1) {
            diagnostics.push({
                message: `Consider using explicit version ranges for clarity. Example: 'preview 9.4-10.9, ga 11.0-12.2, removed 12.3+' instead of inferring ranges.`,
                severity: vscode.DiagnosticSeverity.Hint,
                code: 'implicit_version_syntax'
            });
        } else {
            diagnostics.push({
                message: `Consider using explicit syntax: Use '+' for "and later" (e.g., 'ga 9.1+') or '=' for exact version (e.g., 'ga =9.1')`,
                severity: vscode.DiagnosticSeverity.Hint,
                code: 'implicit_version_syntax'
            });
        }
    }

    // Warning for multiple unbound values (skip if all implicit)
    if (analysis.unboundCount > 1 && !analysis.allEntriesImplicit) {
        diagnostics.push({
            message: `Only one entry per key can use the greater-than syntax. Found ${analysis.unboundCount} unbound entries.`,
            severity: vscode.DiagnosticSeverity.Warning,
            code: 'multiple_unbound_versions'
        });
    }

    // Warning for invalid ranges
    for (const entry of analysis.invalidRanges) {
        diagnostics.push({
            message: `Invalid version range in '${entry.originalEntry}': the first version must be less than or equal to the second version`,
            severity: vscode.DiagnosticSeverity.Warning,
            code: 'invalid_version_range'
        });
    }

    // Hint for removed exact version as highest
    if (analysis.removedExactAsHighest) {
        const version = analysis.removedExactAsHighest.startVersion!.join('.');
        diagnostics.push({
            message: `'removed =${version}' means removed only in version ${version}. If the feature stays removed, use 'removed ${version}+' instead.`,
            severity: vscode.DiagnosticSeverity.Hint,
            code: 'removed_exact_version'
        });
    }

    // Warning for overlapping versions
    if (analysis.overlap) {
        const [entry1, entry2, overlapVersion] = analysis.overlap;
        diagnostics.push({
            message: `Overlapping versions: '${entry1}' and '${entry2}' both cover version ${overlapVersion}. A version cannot be in multiple lifecycle states.`,
            severity: vscode.DiagnosticSeverity.Warning,
            code: 'overlapping_versions'
        });
    }

    return diagnostics;
}

/**
 * Validate a single entry against the pattern
 */
export function isValidEntry(entry: string): boolean {
    if (!entry) return true;
    if (LIFECYCLE_STATES.includes(entry as typeof LIFECYCLE_STATES[number])) return true;
    return SINGLE_ENTRY_PATTERN.test(entry);
}

/**
 * Validate applies_to value and return diagnostics
 * This is the main entry point for validation
 */
export function validateAppliesToValue(value: string): ValidationDiagnostic[] {
    const diagnostics: ValidationDiagnostic[] = [];

    // Handle empty value
    if (!value.trim()) {
        return diagnostics;
    }

    // Check if it's just "all" by itself (invalid)
    if (value === 'all') {
        diagnostics.push({
            message: `Invalid lifecycle value 'all'. 'all' must be preceded by a lifecycle state (e.g., 'ga all', 'beta all')`,
            severity: vscode.DiagnosticSeverity.Error,
            code: 'invalid_lifecycle_value'
        });
        return diagnostics;
    }

    // Split by comma and validate each entry
    const entries = value.split(',').map(e => e.trim());

    // Check syntax validity
    for (const entry of entries) {
        if (!isValidEntry(entry)) {
            diagnostics.push({
                message: `Invalid lifecycle value '${value}'. Expected format: 'state', 'state version', 'state version+', 'state =version', 'state x.x-y.y', or 'state all'`,
                severity: vscode.DiagnosticSeverity.Error,
                code: 'invalid_lifecycle_value'
            });
            return diagnostics; // Return early on syntax error
        }
    }

    // Run semantic analysis
    const analysis = analyzeAppliesToEntries(entries);
    const semanticDiagnostics = generateSemanticDiagnostics(analysis, entries);
    diagnostics.push(...semanticDiagnostics);

    return diagnostics;
}
