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

import { outputChannel } from './logger';

// Detect if we're running in a web environment
const isWeb = typeof process === 'undefined' || typeof process.versions === 'undefined' || typeof process.versions.node === 'undefined';

const VERSIONS_URL = 'https://raw.githubusercontent.com/elastic/docs-builder/main/config/versions.yml';
const CACHE_DURATION_MS = 1000 * 60 * 60; // 1 hour

/**
 * Cache for versions.yml from the docs-builder repository.
 * Fetches version substitutions like {{version.edot_php}} and caches them.
 */
export class VersionsCache {
    private static instance: VersionsCache;
    private versions: Record<string, string> = {};
    private lastFetchTime: number = 0;
    private fetchPromise: Promise<void> | null = null;

    private constructor() {}

    public static getInstance(): VersionsCache {
        if (!VersionsCache.instance) {
            VersionsCache.instance = new VersionsCache();
        }
        return VersionsCache.instance;
    }

    /**
     * Initialize the cache by fetching versions from GitHub.
     * Called on extension activation.
     */
    public async initialize(): Promise<void> {
        await this.fetchVersions();
    }

    /**
     * Get all cached versions as a Record<string, string>.
     * Returns an empty object if the cache is not loaded.
     */
    public getVersions(): Record<string, string> {
        return { ...this.versions };
    }

    /**
     * Get a specific version value by key (e.g., "edot_php").
     * Returns undefined if the key doesn't exist.
     */
    public getVersion(key: string): string | undefined {
        return this.versions[key];
    }

    /**
     * Check if the cache needs to be refreshed and refresh it if needed.
     * This is called periodically to keep the cache up to date.
     */
    public async refreshIfNeeded(): Promise<void> {
        const now = Date.now();
        if (now - this.lastFetchTime > CACHE_DURATION_MS) {
            await this.fetchVersions();
        }
    }

    /**
     * Fetch versions.yml from GitHub and parse it.
     * Fails silently if the fetch fails.
     */
    private async fetchVersions(): Promise<void> {
        // If a fetch is already in progress, wait for it
        if (this.fetchPromise) {
            return this.fetchPromise;
        }

        this.fetchPromise = this.doFetch();
        try {
            await this.fetchPromise;
        } finally {
            this.fetchPromise = null;
        }
    }

    private async doFetch(): Promise<void> {
        try {
            if (isWeb) {
                // In web environment, use fetch API
                const response = await fetch(VERSIONS_URL);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                const data = await response.text();
                const versions = this.parseSimpleYaml(data);
                this.versions = versions;
                this.lastFetchTime = Date.now();
            } else {
                // In Node.js environment, use https module
                return new Promise<void>((resolve) => {
                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                    const https = require('https');
                    
                    https.get(VERSIONS_URL, (res: { statusCode?: number; headers: { location?: string }; on: (event: string, callback: (chunk: Buffer) => void) => void }) => {
                        // Handle redirects
                        if (res.statusCode === 301 || res.statusCode === 302) {
                            if (res.headers.location) {
                                https.get(res.headers.location, (redirectRes: { statusCode?: number; headers: { location?: string }; on: (event: string, callback: (chunk: Buffer) => void) => void }) => {
                                    this.handleNodeResponse(redirectRes, resolve);
                                });
                                return;
                            }
                        }

                        this.handleNodeResponse(res, resolve);
                    }).on('error', (err: Error) => {
                        // Fail silently as requested
                        outputChannel.appendLine(`Failed to fetch versions.yml: ${err.message}`);
                        resolve();
                    });
                });
            }
        } catch (err) {
            // Fail silently as requested
            outputChannel.appendLine(`Failed to fetch versions.yml: ${err}`);
        }
    }

    private handleNodeResponse(res: { on: (event: string, callback: (chunk: Buffer) => void) => void }, resolve: () => void): void {
        let data = '';
        
        res.on('data', (chunk: Buffer) => {
            data += chunk.toString();
        });

        res.on('end', () => {
            try {
                // Parse YAML using simple parser
                const versions = this.parseSimpleYaml(data);
                this.versions = versions;
                this.lastFetchTime = Date.now();
            } catch (err) {
                // Fail silently as requested
                outputChannel.appendLine(`Failed to parse versions.yml: ${err}`);
            }
            resolve();
        });
    }

    /**
     * Simple YAML parser for the versions.yml structure.
     * Parses nested structure under versioning_systems and extracts 'current' values.
     * Handles YAML anchors (&name) and aliases (*name).
     *
     * Expected structure:
     * versioning_systems:
     *   stack: &stack
     *     base: 9.0
     *     current: 9.1.5
     *   self: *stack
     */
    private parseSimpleYaml(content: string): Record<string, string> {
        const lines = content.split('\n');
        const versions: Record<string, string> = {};
        const anchors: Record<string, { base: string; current: string }> = {};
        let inVersioningSystems = false;
        let currentProduct: string | null = null;
        let currentAnchor: string | null = null;
        let baseIndent = 0;
        let currentVersionData: { base?: string; current?: string } = {};

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Skip empty lines and comments
            if (!trimmed || trimmed.startsWith('#')) {
                continue;
            }

            const indent = line.length - line.trimStart().length;

            // Check if we're entering versioning_systems section
            if (trimmed === 'versioning_systems:') {
                inVersioningSystems = true;
                baseIndent = indent;
                continue;
            }

            if (!inVersioningSystems) {
                continue;
            }

            // Parse product entries (one level deeper than versioning_systems)
            if (indent === baseIndent + 2 && trimmed.includes(':')) {
                // Save previous product's version data if it has an anchor
                if (currentProduct && currentAnchor && currentVersionData.current) {
                    anchors[currentAnchor] = {
                        base: currentVersionData.base || '',
                        current: currentVersionData.current
                    };
                }

                const colonIndex = trimmed.indexOf(':');
                const key = trimmed.substring(0, colonIndex).trim();
                const value = trimmed.substring(colonIndex + 1).trim();

                currentProduct = key;
                currentAnchor = null;
                currentVersionData = {};

                // Check if this product has an anchor definition (e.g., "stack: &stack")
                if (value.startsWith('&')) {
                    currentAnchor = value.substring(1).trim();
                    continue;
                }

                // Check if this product is an alias reference (e.g., "self: *stack")
                if (value.startsWith('*')) {
                    const aliasName = value.substring(1).trim();
                    if (anchors[aliasName]) {
                        versions[currentProduct] = anchors[aliasName].current;
                    }
                    currentProduct = null;
                    continue;
                }

                // Regular product entry (no anchor or alias)
                continue;
            }

            // Parse version fields (current, base) under each product
            if (currentProduct && indent > baseIndent + 2 && trimmed.includes(':')) {
                const colonIndex = trimmed.indexOf(':');
                const field = trimmed.substring(0, colonIndex).trim();
                const value = trimmed.substring(colonIndex + 1).trim();

                const cleanValue = value.replace(/^["']|["']$/g, '');

                if (field === 'current') {
                    currentVersionData.current = cleanValue;
                    versions[currentProduct] = cleanValue;
                } else if (field === 'base') {
                    currentVersionData.base = cleanValue;
                }
            }
        }

        // Save last product's anchor if needed
        if (currentProduct && currentAnchor && currentVersionData.current) {
            anchors[currentAnchor] = {
                base: currentVersionData.base || '',
                current: currentVersionData.current
            };
        }

        return versions;
    }

    /**
     * Clear the cache (useful for testing or manual refresh).
     */
    public clear(): void {
        this.versions = {};
        this.lastFetchTime = 0;
    }
}
