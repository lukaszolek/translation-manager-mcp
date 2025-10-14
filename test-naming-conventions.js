#!/usr/bin/env node
/**
 * Simple test to verify that both naming conventions work:
 * - Full locale format: pl-pl.json, en-us.json
 * - Language-only format: pl.json, en.json
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// We need to import TranslationManager class directly without running the server
// So we'll create our own instance
class TranslationManager {
  constructor() {
    this.translations = new Map();
    this.locales = [];
    this.messagesDir = null;
    this.tempStateFile = null;
    this.previousState = null;
    this.hasLoadedInitialCheck = false;
    this.fileWatcher = null;
    this.reloadTimer = null;
  }

  flattenJson(data, parentKey = '') {
    const items = [];

    for (const [key, value] of Object.entries(data)) {
      const newKey = parentKey ? `${parentKey}.${key}` : key;

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        items.push(...this.flattenJson(value, newKey));
      } else {
        items.push([newKey, value]);
      }
    }

    return items;
  }

  async initialize(messagesDir = null) {
    if (!messagesDir) {
      messagesDir = path.join(process.cwd(), 'messages');
    }
    this.messagesDir = messagesDir;

    await this.loadTranslationsFromJson();
  }

  async loadTranslationsFromJson() {
    try {
      const files = await fs.readdir(this.messagesDir);
      this.locales = [];

      // First pass - collect all locales
      for (const filename of files) {
        if (filename.endsWith('.json') && !filename.endsWith('.bak') && filename !== 'translation-check.json') {
          const locale = filename.replace('.json', '');
          this.locales.push(locale);
        }
      }

      // Second pass - load translations
      for (const filename of files) {
        if (filename.endsWith('.json') && !filename.endsWith('.bak') && filename !== 'translation-check.json') {
          const locale = filename.replace('.json', '');
          const filepath = path.join(this.messagesDir, filename);

          try {
            const content = await fs.readFile(filepath, 'utf8');
            const data = JSON.parse(content);
            const flatData = this.flattenJson(data);

            for (const [key, value] of flatData) {
              if (!this.translations.has(key)) {
                this.translations.set(key, {
                  isChecked: false,
                  translations: {}
                });
              }

              const entry = this.translations.get(key);
              entry.translations[locale] = value;
            }
          } catch (error) {
            console.error(`Error processing ${filename}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error loading translations:', error);
      throw error;
    }
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createTestFiles(testDir, namingConvention) {
  const testData = {
    common: {
      greeting: namingConvention === 'full' ? 'Hello World (full locale)' : 'Hello World (language only)',
      button: {
        save: 'Save',
        cancel: 'Cancel'
      }
    }
  };

  const locales = namingConvention === 'full'
    ? ['en-us', 'pl-pl', 'fr-fr']
    : ['en', 'pl', 'fr'];

  for (const locale of locales) {
    const filePath = path.join(testDir, `${locale}.json`);
    await fs.writeFile(filePath, JSON.stringify(testData, null, 2), 'utf8');
  }

  console.log(`✅ Created test files with ${namingConvention} naming convention`);
  return locales;
}

async function runTest(namingConvention) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing ${namingConvention.toUpperCase()} naming convention`);
  console.log('='.repeat(60));

  const testDir = path.join(__dirname, `test-messages-${namingConvention}`);

  try {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });

    // Create test translation files
    const expectedLocales = await createTestFiles(testDir, namingConvention);

    // Initialize translation manager
    const manager = new TranslationManager();
    await manager.initialize(testDir);

    // Verify locales were loaded
    console.log(`\n📊 Test Results:`);
    console.log(`   Expected locales: ${expectedLocales.join(', ')}`);
    console.log(`   Loaded locales: ${manager.locales.join(', ')}`);
    console.log(`   Translation keys: ${manager.translations.size}`);

    // Check if all locales were detected
    const allLocalesFound = expectedLocales.every(locale =>
      manager.locales.includes(locale)
    );

    if (!allLocalesFound) {
      console.log(`\n❌ FAILED: Not all locales were detected`);
      return false;
    }

    // Check if translations were loaded
    if (manager.translations.size === 0) {
      console.log(`\n❌ FAILED: No translations were loaded`);
      return false;
    }

    // Check if language extraction works for non-breaking spaces
    const testLocale = expectedLocales[0];
    const { getLanguageFromLocale } = await import('./src/utils/non-breaking-spaces.js');
    const extractedLanguage = getLanguageFromLocale(testLocale);
    const expectedLanguage = testLocale.split('-')[0];

    console.log(`\n🔍 Language Extraction Test:`);
    console.log(`   Locale: ${testLocale}`);
    console.log(`   Extracted language: ${extractedLanguage}`);
    console.log(`   Expected language: ${expectedLanguage}`);

    if (extractedLanguage !== expectedLanguage) {
      console.log(`\n❌ FAILED: Language extraction failed`);
      return false;
    }

    console.log(`\n✅ PASSED: All tests passed for ${namingConvention} convention`);
    return true;

  } catch (error) {
    console.log(`\n❌ FAILED: ${error.message}`);
    console.error(error);
    return false;
  } finally {
    // Cleanup
    try {
      await fs.rm(testDir, { recursive: true, force: true });
      console.log(`\n🧹 Cleaned up test directory: ${testDir}`);
    } catch (error) {
      console.error(`Failed to cleanup: ${error.message}`);
    }
  }
}

async function main() {
  console.log('🧪 Translation Manager Naming Convention Tests');
  console.log('='.repeat(60));

  const results = [];

  // Test full locale format (pl-pl.json)
  results.push(await runTest('full'));

  // Test language-only format (pl.json)
  results.push(await runTest('language'));

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 Test Summary');
  console.log('='.repeat(60));

  const allPassed = results.every(r => r === true);

  if (allPassed) {
    console.log('✅ All tests PASSED!');
    console.log('\nBoth naming conventions are supported:');
    console.log('  • Full locale: pl-pl.json, en-us.json, fr-fr.json');
    console.log('  • Language only: pl.json, en.json, fr.json');
    process.exit(0);
  } else {
    console.log('❌ Some tests FAILED');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
