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
 * File system abstraction that works in both Node.js and web environments
 */

// Detect if we're running in a web environment
const isWeb = typeof process === 'undefined' || typeof process.versions === 'undefined' || typeof process.versions.node === 'undefined';

/**
 * Read a file as UTF-8 text
 */
export async function readFile(uri: vscode.Uri): Promise<string> {
  const bytes = await vscode.workspace.fs.readFile(uri);
  return new TextDecoder('utf-8').decode(bytes);
}

/**
 * Read a file synchronously (only works in Node.js environment)
 */
export function readFileSync(filePath: string): string {
  if (isWeb) {
    throw new Error('readFileSync is not available in web environment. Use readFile instead.');
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs');
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Check if a file exists
 */
export async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a file exists synchronously (only works in Node.js environment)
 */
export function existsSync(filePath: string): boolean {
  if (isWeb) {
    // In web, we can't do sync operations
    return false;
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs');
  return fs.existsSync(filePath);
}

/**
 * Check if a path is a directory
 */
export async function isDirectory(uri: vscode.Uri): Promise<boolean> {
  try {
    const stat = await vscode.workspace.fs.stat(uri);
    return stat.type === vscode.FileType.Directory;
  } catch {
    return false;
  }
}

/**
 * Check if a path is a directory synchronously (only works in Node.js environment)
 */
export function isDirectorySync(filePath: string): boolean {
  if (isWeb) {
    return false;
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs');
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Path utilities that work in both environments
 */
export const pathUtils = {
  /**
   * Join path segments
   */
  join(...segments: string[]): string {
    if (isWeb) {
      // Simple path joining for web
      return segments
        .join('/')
        .replace(/\/+/g, '/')
        .replace(/\/\.\//g, '/')
        .replace(/\/\.$/, '');
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path');
    return path.join(...segments);
  },

  /**
   * Get directory name from a path
   */
  dirname(filePath: string): string {
    if (isWeb) {
      // Simple dirname for web
      const lastSlash = filePath.lastIndexOf('/');
      return lastSlash === -1 ? '.' : filePath.substring(0, lastSlash);
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path');
    return path.dirname(filePath);
  },

  /**
   * Get base name from a path
   */
  basename(filePath: string): string {
    if (isWeb) {
      const lastSlash = filePath.lastIndexOf('/');
      return lastSlash === -1 ? filePath : filePath.substring(lastSlash + 1);
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path');
    return path.basename(filePath);
  },
};

export { isWeb };
