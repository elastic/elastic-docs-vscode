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

const esbuild = require('esbuild');

const watch = process.argv.includes('--watch');
const minify = process.argv.includes('--minify');

// Common options for both builds
const baseOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  external: ['vscode'],
  format: 'cjs',
  sourcemap: !minify,
  minify,
};

// Desktop (Node.js) build
const desktopOptions = {
  ...baseOptions,
  outfile: 'out/extension.js',
  platform: 'node',
};

// Web (Browser) build - with polyfills for Node.js modules
const webOptions = {
  ...baseOptions,
  outfile: 'out/extension-web.js',
  platform: 'browser',
  // Mark Node.js built-ins as external so they don't cause errors
  // In the web version, we'll need to handle these differently
  external: [...baseOptions.external, 'path', 'fs', 'https'],
  define: {
    'process.env.IS_WEB': 'true',
  },
};

async function build() {
  try {
    // Build desktop version
    const desktopCtx = await esbuild.context(desktopOptions);
    if (watch) {
      await desktopCtx.watch();
      console.log('Watching desktop bundle...');
    } else {
      await desktopCtx.rebuild();
      await desktopCtx.dispose();
      console.log('Desktop bundle built successfully');
    }

    // Build web version
    const webCtx = await esbuild.context(webOptions);
    if (watch) {
      await webCtx.watch();
      console.log('Watching web bundle...');
    } else {
      await webCtx.rebuild();
      await webCtx.dispose();
      console.log('Web bundle built successfully');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
