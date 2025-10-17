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

/**
 * Engine for applying mutation operators to substitution values
 */

/**
 * Apply a single mutation operator to a value
 * @param value The input value
 * @param operator The mutation operator to apply
 * @returns The transformed value, or the original value if transformation fails
 */
export function applyMutation(value: string, operator: string): string {
    try {
        switch (operator) {
            // Text case mutations
            case 'lc':
                return toLowerCase(value);
            case 'uc':
                return toUpperCase(value);
            case 'tc':
                return toTitleCase(value);
            case 'c':
                return capitalize(value);
            case 'kc':
                return toKebabCase(value);
            case 'sc':
                return toSnakeCase(value);
            case 'cc':
                return toCamelCase(value);
            case 'pc':
                return toPascalCase(value);
            case 'trim':
                return trimValue(value);

            // Version mutations
            case 'M':
                return getMajor(value);
            case 'M.x':
                return getMajorDotX(value);
            case 'M.M':
                return getMajorMinor(value);
            case 'M+1':
                return getNextMajor(value);
            case 'M.M+1':
                return getNextMinor(value);

            default:
                return value; // Unknown operator, return unchanged
        }
    } catch (error) {
        // If any error occurs, return the original value
        return value;
    }
}

/**
 * Apply a chain of mutation operators to a value
 * @param value The input value
 * @param operators Array of mutation operators to apply in sequence
 * @returns Array of intermediate results, including the original value
 */
export function applyMutationChain(value: string, operators: string[]): string[] {
    const results: string[] = [value]; // Start with original value
    let currentValue = value;

    for (const operator of operators) {
        currentValue = applyMutation(currentValue, operator);
        results.push(currentValue);
    }

    return results;
}

// Text case mutations

function toLowerCase(value: string): string {
    return value.toLowerCase();
}

function toUpperCase(value: string): string {
    return value.toUpperCase();
}

function toTitleCase(value: string): string {
    return value.replace(/\b\w/g, char => char.toUpperCase());
}

function capitalize(value: string): string {
    if (value.length === 0) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function toKebabCase(value: string): string {
    return value
        .replace(/([a-z])([A-Z])/g, '$1-$2') // Handle camelCase
        .replace(/[\s_]+/g, '-') // Replace spaces and underscores with hyphens
        .toLowerCase();
}

function toSnakeCase(value: string): string {
    return value
        .replace(/([a-z])([A-Z])/g, '$1_$2') // Handle camelCase
        .replace(/[\s-]+/g, '_') // Replace spaces and hyphens with underscores
        .toLowerCase();
}

function toCamelCase(value: string): string {
    return value
        .replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '')
        .replace(/^[A-Z]/, char => char.toLowerCase());
}

function toPascalCase(value: string): string {
    return value
        .replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '')
        .replace(/^[a-z]/, char => char.toUpperCase());
}

function trimValue(value: string): string {
    // Trim common non-word characters from start and end
    return value.replace(/^[^\w]+|[^\w]+$/g, '');
}

// Version mutations

/**
 * Parse a semantic version string
 * @param version Version string like "9.1.5" or "9.1"
 * @returns Object with major, minor, patch components
 */
function parseVersion(version: string): { major: number; minor: number; patch: number } | null {
    const match = version.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    if (!match) {
        return null;
    }

    return {
        major: parseInt(match[1], 10),
        minor: match[2] ? parseInt(match[2], 10) : 0,
        patch: match[3] ? parseInt(match[3], 10) : 0
    };
}

function getMajor(value: string): string {
    const parsed = parseVersion(value);
    if (!parsed) return value;
    return parsed.major.toString();
}

function getMajorDotX(value: string): string {
    const parsed = parseVersion(value);
    if (!parsed) return value;
    return `${parsed.major}.x`;
}

function getMajorMinor(value: string): string {
    const parsed = parseVersion(value);
    if (!parsed) return value;
    return `${parsed.major}.${parsed.minor}`;
}

function getNextMajor(value: string): string {
    const parsed = parseVersion(value);
    if (!parsed) return value;
    return (parsed.major + 1).toString();
}

function getNextMinor(value: string): string {
    const parsed = parseVersion(value);
    if (!parsed) return value;
    return `${parsed.major}.${parsed.minor + 1}`;
}
