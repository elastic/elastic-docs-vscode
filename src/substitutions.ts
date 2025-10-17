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
import * as path from 'path';
import * as fs from 'fs';
import { outputChannel } from './logger';
import { PRODUCTS } from './products';

interface SubstitutionVariables {
    [key: string]: string;
}

interface ParsedYaml {
    [key: string]: unknown;
}

// Centralized cache for substitutions
class SubstitutionCache {
    private cache: Map<string, SubstitutionVariables> = new Map();

    get(key: string): SubstitutionVariables | undefined {
        return this.cache.get(key);
    }

    set(key: string, value: SubstitutionVariables): void {
        this.cache.set(key, value);
    }

    clear(): void {
        this.cache.clear();
    }

    has(key: string): boolean {
        return this.cache.has(key);
    }
}

// Export a singleton cache instance
export const substitutionCache = new SubstitutionCache();

/**
 * Resolves a shorthand variable name (e.g., ".elasticsearch") to its full form ("product.elasticsearch")
 * @param variableName The variable name, possibly with shorthand notation
 * @param substitutions The available substitutions
 * @returns The resolved variable name and value, or null if not found
 */
export function resolveShorthand(variableName: string, substitutions: SubstitutionVariables): {
    resolvedName: string;
    value: string;
    isShorthand: boolean;
} | null {
    // Check if it's a shorthand starting with a dot
    if (variableName.startsWith('.')) {
        const productKey = variableName.substring(1); // Remove the leading dot
        const fullForm = `product.${productKey}`;

        if (substitutions[fullForm]) {
            return {
                resolvedName: fullForm,
                value: substitutions[fullForm],
                isShorthand: true
            };
        }
        return null;
    }

    // Not a shorthand, check if it exists as-is
    if (substitutions[variableName]) {
        return {
            resolvedName: variableName,
            value: substitutions[variableName],
            isShorthand: false
        };
    }

    return null;
}

export function getSubstitutions(documentUri: vscode.Uri): SubstitutionVariables {
  // Check cache first
  const cached = substitutionCache.get(documentUri.fsPath);
  if (cached) {
      return cached;
  }

  const substitutions: SubstitutionVariables = {};

  try {
      // Find all docset.yml files in the workspace
      const docsetFiles = findDocsetFiles(documentUri);

      for (const docsetFile of docsetFiles) {
          const unorderedSubs = parseDocsetFile(docsetFile);
          const productValues = Object.values(PRODUCTS);
          const filteredSubs = Object.keys(unorderedSubs).filter(sub => {
            return !productValues.includes(unorderedSubs[sub]);
          }).reduce(
              (obj: { [key: string]: string }, key: string) => {
                  obj[key] = unorderedSubs[key];
                  return obj;
              },
              {} as { [key: string]: string }
          );
          Object.assign(substitutions, filteredSubs);
      }

  } catch (error) {
      outputChannel.appendLine(`Error reading docset files: ${error}`);
  }

  // Parse frontmatter subs from the current document
  try {
      const frontmatterSubs = parseFrontmatterSubs(documentUri);
      Object.assign(substitutions, frontmatterSubs);
  } catch (error) {
      outputChannel.appendLine(`Error parsing frontmatter subs: ${error}`);
  }

  // Add centralized product name subs
  for (const [key, value] of Object.entries(PRODUCTS)) {
      substitutions[`product.${key}`] = value;
  }

  const orderedKeys = Object.keys(substitutions).sort((a: string, b: string) => {
      return substitutions[b].length - substitutions[a].length;
  });
  const orderedSubs = orderedKeys.reduce(
      (obj: { [key: string]: string }, key: string) => {
          obj[key] = substitutions[key];
          return obj;
      },
      {} as { [key: string]: string }
  );

  function findDocsetFiles(documentUri: vscode.Uri): string[] {
      const docsetFiles: string[] = [];
      const documentPath = documentUri.fsPath;
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);


      if (!workspaceFolder) {
          return docsetFiles;
      }

      const workspaceRoot = workspaceFolder.uri.fsPath;

      // Define possible docset file names
      const docsetFileNames = ['docset.yml', '_docset.yml'];

      // Check workspace root
      for (const fileName of docsetFileNames) {
          const rootDocsetPath = path.join(workspaceRoot, fileName);
          if (fs.existsSync(rootDocsetPath)) {
              docsetFiles.push(rootDocsetPath);
          }
      }

      // Check /docs folder in workspace root
      const docsFolderPath = path.join(workspaceRoot, 'docs');
      if (fs.existsSync(docsFolderPath) && fs.statSync(docsFolderPath).isDirectory()) {
          for (const fileName of docsetFileNames) {
              const docsDocsetPath = path.join(docsFolderPath, fileName);
              if (fs.existsSync(docsDocsetPath)) {
                  docsetFiles.push(docsDocsetPath);
              }
          }
      }

      // Also search upwards from the document location for backward compatibility
      let currentDir = path.dirname(documentPath);
      while (currentDir && currentDir.startsWith(workspaceRoot)) {
          for (const fileName of docsetFileNames) {
              const docsetPath = path.join(currentDir, fileName);
              if (fs.existsSync(docsetPath)) {
                  docsetFiles.push(docsetPath);
              }
          }

          const parentDir = path.dirname(currentDir);
          if (parentDir === currentDir) {
              break; // Reached root
          }
          currentDir = parentDir;
      }

      // Remove duplicates while preserving order
      return [...new Set(docsetFiles)];
  }

  function parseDocsetFile(filePath: string): SubstitutionVariables {
      try {
          const content = fs.readFileSync(filePath, 'utf8');

          const parsed = parseYaml(content);

          if (parsed && typeof parsed === 'object' && 'subs' in parsed) {
              const subs = parsed.subs;

              // The subs section is already properly parsed as key-value pairs
              if (typeof subs === 'object' && subs !== null) {
                  const result = subs as SubstitutionVariables;
                  return result;
              }
              return subs as unknown as SubstitutionVariables;
          }

          return {};
      } catch (error) {
          outputChannel.appendLine(`Error parsing docset file ${filePath}: ${error}`);
          return {};
      }
  }

  function parseFrontmatterSubs(documentUri: vscode.Uri): SubstitutionVariables {
      try {
          // Read the document content
          const document = vscode.workspace.textDocuments.find(doc => doc.uri.fsPath === documentUri.fsPath);
          if (!document) {
              // If document is not open, try to read from file system
              const content = fs.readFileSync(documentUri.fsPath, 'utf8');
              return extractSubsFromFrontmatter(content);
          }

          return extractSubsFromFrontmatter(document.getText());
      } catch (error) {
          outputChannel.appendLine(`Error parsing frontmatter subs from ${documentUri.fsPath}: ${error}`);
          return {};
      }
  }

  function extractSubsFromFrontmatter(content: string): SubstitutionVariables {
      // Match frontmatter: starts with --- and ends with ---
      const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
      if (!frontmatterMatch) {
          return {};
      }

      const frontmatter = frontmatterMatch[1];
      const parsed = parseYaml(frontmatter);

      // Check for 'sub:' field in frontmatter
      if (parsed && typeof parsed === 'object' && 'sub' in parsed) {
          const sub = parsed.sub;
          if (typeof sub === 'object' && sub !== null) {
              return sub as SubstitutionVariables;
          }
      }

      return {};
  }

  function parseYaml(content: string): ParsedYaml {
      // Simple YAML parser for the specific structure we need
      const lines = content.split('\n');
      const result: ParsedYaml = {};
      let currentSection: ParsedYaml | null = null;
      let currentIndent = 0;


      for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;

          const indent = line.length - line.trimStart().length;

          // Check for both 'subs:' (docset.yml) and 'sub:' (frontmatter)
          if (trimmed === 'subs:') {
              result.subs = {};
              currentSection = result.subs as ParsedYaml;
              currentIndent = indent;
              continue;
          }

          if (trimmed === 'sub:') {
              result.sub = {};
              currentSection = result.sub as ParsedYaml;
              currentIndent = indent;
              continue;
          }

          if (currentSection && indent > currentIndent) {
              // This is a key-value pair in the subs/sub section
              const colonIndex = trimmed.indexOf(':');
              if (colonIndex > 0) {
                  const key = trimmed.substring(0, colonIndex).trim();
                  const value = trimmed.substring(colonIndex + 1).trim();

                  // Remove quotes if present
                  const cleanValue = value.replace(/^["']|["']$/g, '');
                  currentSection[key] = cleanValue;

              }
          }
      }

      return result;
  }

  // Cache the result before returning
  substitutionCache.set(documentUri.fsPath, orderedSubs);

  return orderedSubs;
}

