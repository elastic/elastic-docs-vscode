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

export interface MutationOperator {
    operator: string;
    description: string;
    example?: string;
}

// Export MUTATION_OPERATORS for use in hover provider
export const MUTATION_OPERATORS: Record<string, MutationOperator> = {
    'lc': {
        operator: 'lc',
        description: 'LowerCase - converts all characters to lowercase',
        example: 'Hello World → hello world'
    },
    'uc': {
        operator: 'uc',
        description: 'UpperCase - converts all characters to uppercase',
        example: 'Hello World → HELLO WORLD'
    },
    'tc': {
        operator: 'tc',
        description: 'TitleCase - capitalizes all words',
        example: 'hello world → Hello World'
    },
    'c': {
        operator: 'c',
        description: 'Capitalize - capitalizes the first letter',
        example: 'hello world → Hello world'
    },
    'kc': {
        operator: 'kc',
        description: 'KebabCase - converts to kebab-case',
        example: 'Hello World → hello-world'
    },
    'sc': {
        operator: 'sc',
        description: 'SnakeCase - converts to snake_case',
        example: 'Hello World → hello_world'
    },
    'cc': {
        operator: 'cc',
        description: 'CamelCase - converts to camelCase',
        example: 'Hello World → helloWorld'
    },
    'pc': {
        operator: 'pc',
        description: 'PascalCase - converts to PascalCase',
        example: 'Hello World → HelloWorld'
    },
    'trim': {
        operator: 'trim',
        description: 'Trim - removes common non-word characters from start and end',
        example: '  Hello World!  → Hello World!'
    },
    'M': {
        operator: 'M',
        description: 'Major - displays only the major version component',
        example: '9.1.5 → 9'
    },
    'M.x': {
        operator: 'M.x',
        description: 'Major.x - displays major component followed by \'.x\'',
        example: '9.1.5 → 9.x'
    },
    'M.M': {
        operator: 'M.M',
        description: 'Major.Minor - displays only the major and minor components',
        example: '9.1.5 → 9.1'
    },
    'M+1': {
        operator: 'M+1',
        description: 'Next Major - increments to the next major version',
        example: '9.1.5 → 10'
    },
    'M.M+1': {
        operator: 'M.M+1',
        description: 'Next Minor - increments to the next minor version',
        example: '9.1.5 → 9.2'
    }
};

/**
 * Parses a substitution string to extract the variable name and mutation chain
 * @param substitutionText The text inside {{ }}, e.g., "version | lc | trim"
 * @returns Object with variableName and mutations array
 */
export function parseSubstitution(substitutionText: string): {
    variableName: string;
    mutations: string[];
} {
    const parts = substitutionText.split('|').map(p => p.trim());
    const variableName = parts[0] || '';
    const mutations = parts.slice(1).filter(m => m.length > 0);

    return { variableName, mutations };
}

/**
 * Generates a description of the mutation chain
 * @param mutations Array of mutation operator strings
 * @returns Human-readable description of what the mutations do
 */
export function describeMutationChain(mutations: string[]): string {
    if (mutations.length === 0) {
        return '';
    }

    const descriptions: string[] = [];

    for (const mutation of mutations) {
        const operator = MUTATION_OPERATORS[mutation];
        if (operator) {
            descriptions.push(`**${mutation}**: ${operator.description}`);
        } else {
            descriptions.push(`**${mutation}**: Unknown operator`);
        }
    }

    return descriptions.join('\n\n');
}

/**
 * Gets completion items for mutation operators
 * @returns Array of mutation operators with descriptions
 */
export function getMutationCompletionItems(): MutationOperator[] {
    return Object.values(MUTATION_OPERATORS);
}
