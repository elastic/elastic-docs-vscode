#!/usr/bin/env node
/**
 * Script to check and optionally fix copyright headers in TypeScript files
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Read the standard copyright header
const copyrightHeaderPath = path.join(__dirname, 'copyright-header.txt');
const EXPECTED_HEADER = fs.readFileSync(copyrightHeaderPath, 'utf8').trim();

// Command line arguments
const args = process.argv.slice(2);
const shouldFix = args.includes('--fix');
const showHelp = args.includes('--help') || args.includes('-h');

if (showHelp) {
    console.log(`
Usage: node scripts/check-copyright.js [options]

Options:
  --fix     Automatically add missing copyright headers
  --help    Show this help message

Examples:
  node scripts/check-copyright.js          # Check for missing headers
  node scripts/check-copyright.js --fix    # Add missing headers
`);
    process.exit(0);
}

/**
 * Get all TypeScript files in the project
 */
function getTypeScriptFiles() {
    try {
        const output = execSync('find src -name "*.ts" -type f', { encoding: 'utf8' });
        return output.trim().split('\n').filter(file => file.length > 0);
    } catch (error) {
        console.error('Error finding TypeScript files:', error.message);
        return [];
    }
}

/**
 * Check if a file has the expected copyright header
 */
function hasCopyrightHeader(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return content.startsWith(EXPECTED_HEADER);
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error.message);
        return false;
    }
}

/**
 * Add copyright header to a file
 */
function addCopyrightHeader(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const newContent = EXPECTED_HEADER + '\n\n' + content;
        fs.writeFileSync(filePath, newContent, 'utf8');
        return true;
    } catch (error) {
        console.error(`Error adding copyright header to ${filePath}:`, error.message);
        return false;
    }
}

/**
 * Main function
 */
function main() {
    console.log('🔍 Checking copyright headers in TypeScript files...\n');
    
    const tsFiles = getTypeScriptFiles();
    
    if (tsFiles.length === 0) {
        console.log('No TypeScript files found.');
        return;
    }
    
    const filesWithoutHeader = [];
    const filesWithHeader = [];
    
    // Check each file
    tsFiles.forEach(file => {
        if (hasCopyrightHeader(file)) {
            filesWithHeader.push(file);
        } else {
            filesWithoutHeader.push(file);
        }
    });
    
    // Report results
    console.log(`✅ Files with copyright header: ${filesWithHeader.length}`);
    filesWithHeader.forEach(file => console.log(`   ${file}`));
    
    if (filesWithoutHeader.length > 0) {
        console.log(`\n❌ Files missing copyright header: ${filesWithoutHeader.length}`);
        filesWithoutHeader.forEach(file => console.log(`   ${file}`));
        
        if (shouldFix) {
            console.log('\n🔧 Adding missing copyright headers...');
            let fixed = 0;
            filesWithoutHeader.forEach(file => {
                if (addCopyrightHeader(file)) {
                    console.log(`   ✅ Fixed: ${file}`);
                    fixed++;
                } else {
                    console.log(`   ❌ Failed to fix: ${file}`);
                }
            });
            console.log(`\n📊 Fixed ${fixed}/${filesWithoutHeader.length} files`);
        } else {
            console.log('\n💡 Run with --fix to automatically add missing headers');
        }
    } else {
        console.log('\n🎉 All TypeScript files have the correct copyright header!');
    }
    
    // Exit with error code if there were missing headers and we didn't fix them
    if (filesWithoutHeader.length > 0 && !shouldFix) {
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}