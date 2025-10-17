#!/usr/bin/env node
/**
 * Automated tests for Translation Manager MCP v2.0.0
 * Tests all API changes and new functionality
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { watch } from 'fs';
import { insertNonBreakingSpaces, getLanguageFromLocale } from './src/utils/non-breaking-spaces.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Copy TranslationManager class here to avoid starting the server
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

  async initialize(messagesDir = null) {
    if (!messagesDir) {
      messagesDir = path.join(process.cwd(), 'messages');
    }
    this.messagesDir = messagesDir;
    this.tempStateFile = path.join(__dirname, '.translation-state.json');

    await this.loadPreviousState();
    await this.loadTranslationsFromJson();

    if (!this.hasLoadedInitialCheck) {
      await this.loadCheckedStatus();
      this.hasLoadedInitialCheck = true;
    }
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

  unflattenJson(flatData) {
    const sortedData = [...flatData].sort((a, b) => {
      const depthA = a[0].split('.').length;
      const depthB = b[0].split('.').length;

      if (depthA !== depthB) {
        return depthA - depthB;
      }

      return a[0].localeCompare(b[0]);
    });

    const result = {};

    for (const [flatKey, value] of sortedData) {
      const keys = flatKey.split('.');
      let current = result;

      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!current[key]) {
          current[key] = {};
        }
        current = current[key];
      }

      current[keys[keys.length - 1]] = value;
    }

    return result;
  }

  async loadTranslationsFromJson() {
    try {
      const files = await fs.readdir(this.messagesDir);
      this.locales = [];

      const currentState = new Map();
      for (const [key, data] of this.translations.entries()) {
        currentState.set(key, { ...data.translations });
      }

      for (const filename of files) {
        if (filename.endsWith('.json') && !filename.endsWith('.bak') && filename !== 'translation-check.json') {
          const locale = filename.replace('.json', '');
          this.locales.push(locale);
        }
      }

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

              if (this.previousState && this.previousState[key]) {
                if (this.previousState[key][locale] !== value) {
                  entry.isChecked = false;
                }
              } else if (this.previousState && !this.previousState[key]) {
                entry.isChecked = false;
              }
            }
          } catch (error) {
            console.error(`Error processing ${filename}:`, error);
          }
        }
      }

      await this.saveCurrentState();
    } catch (error) {
      console.error('Error loading translations:', error);
      throw error;
    }
  }

  async saveTranslationsToJson() {
    return this.saveTranslationsToJsonForLocales(this.locales);
  }

  async saveTranslationsToJsonForLocales(localesToSave) {
    try {
      for (const locale of localesToSave) {
        if (!this.locales.includes(locale)) {
          continue;
        }

        const filename = `${locale}.json`;
        const filepath = path.join(this.messagesDir, filename);

        const flatData = [];
        const language = getLanguageFromLocale(locale);

        for (const [key, data] of this.translations.entries()) {
          if (data.translations[locale] !== undefined) {
            const processedTranslation = insertNonBreakingSpaces(data.translations[locale], language);
            flatData.push([key, processedTranslation]);
          }
        }

        const nestedData = this.unflattenJson(flatData);

        const jsonContent = JSON.stringify(nestedData, null, 4);
        await fs.writeFile(filepath, jsonContent, 'utf8');
      }

      await this.saveCheckedStatus();

      return {
        success: true,
        savedLocales: [...localesToSave, 'translation-check'],
        keyCount: this.translations.size
      };
    } catch (error) {
      console.error('Error saving translations:', error);
      throw error;
    }
  }

  async loadCheckedStatus() {
    try {
      const filepath = path.join(this.messagesDir, 'translation-check.json');
      const content = await fs.readFile(filepath, 'utf8');
      const checkedData = JSON.parse(content);

      for (const [key, isChecked] of Object.entries(checkedData)) {
        if (this.translations.has(key)) {
          const entry = this.translations.get(key);
          entry.isChecked = isChecked;
        }
      }
    } catch (error) {
      // OK if file doesn't exist
    }
  }

  async saveCheckedStatus() {
    try {
      const filepath = path.join(this.messagesDir, 'translation-check.json');
      const checkedData = {};

      for (const [key, data] of this.translations.entries()) {
        checkedData[key] = data.isChecked;
      }

      const jsonContent = JSON.stringify(checkedData, null, 2);
      await fs.writeFile(filepath, jsonContent, 'utf8');
    } catch (error) {
      console.error('Error saving translation-check.json:', error);
      throw error;
    }
  }

  getMessagesToCheck(n = 10) {
    const uncheckedMessages = {};
    let count = 0;

    for (const [key, data] of this.translations.entries()) {
      if (!data.isChecked) {
        uncheckedMessages[key] = data.translations;
        count++;

        if (count >= n) {
          break;
        }
      }
    }

    return uncheckedMessages;
  }

  async updateTranslations(updates) {
    let updatedCount = 0;
    const modifiedLocales = new Set();

    for (const [key, localeTranslations] of Object.entries(updates)) {
      if (!this.translations.has(key)) {
        continue;
      }

      const entry = this.translations.get(key);

      for (const [locale, translation] of Object.entries(localeTranslations)) {
        if (!this.locales.includes(locale)) {
          continue;
        }

        const language = getLanguageFromLocale(locale);
        const processedTranslation = insertNonBreakingSpaces(translation, language);

        entry.translations[locale] = processedTranslation;
        modifiedLocales.add(locale);
        updatedCount++;
      }
    }

    if (modifiedLocales.size > 0) {
      try {
        await this.saveTranslationsToJsonForLocales(Array.from(modifiedLocales));
      } catch (error) {
        return { success: false, error: error.message };
      }
    }

    return { success: true, updatedKeys: updatedCount };
  }

  async markChecked(keys) {
    const keyList = Array.isArray(keys) ? keys : [keys];
    let markedCount = 0;

    for (const key of keyList) {
      if (!this.translations.has(key)) {
        continue;
      }

      const entry = this.translations.get(key);
      entry.isChecked = true;
      markedCount++;
    }

    await this.saveCheckedStatus();

    return { success: true, markedCount };
  }

  getCheckedKeys() {
    const checkedKeys = [];

    for (const [key, data] of this.translations.entries()) {
      if (data.isChecked) {
        checkedKeys.push(key);
      }
    }

    return checkedKeys;
  }

  getMissingTranslationKeys(page = 1, pageSize = 50) {
    const allMissingKeys = [];

    for (const [key, data] of this.translations.entries()) {
      const missingLocales = [];

      for (const locale of this.locales) {
        if (!data.translations[locale] || data.translations[locale] === '') {
          missingLocales.push(locale);
        }
      }

      if (missingLocales.length > 0) {
        allMissingKeys.push({
          key,
          missingLocales,
          existingTranslations: data.translations
        });
      }
    }

    const totalCount = allMissingKeys.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedKeys = allMissingKeys.slice(startIndex, endIndex);

    return {
      count: totalCount,
      totalPages,
      currentPage: page,
      pageSize,
      keys: paginatedKeys
    };
  }

  getTranslationByKeyPrefix(keyPrefix, page = 1, pageSize = 50) {
    const allResults = [];

    for (const [key, data] of this.translations.entries()) {
      if (key.startsWith(keyPrefix)) {
        allResults.push({ key, translations: data.translations });
      }
    }

    const totalCount = allResults.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedResults = allResults.slice(startIndex, endIndex);

    const keys = {};
    for (const item of paginatedResults) {
      keys[item.key] = item.translations;
    }

    return {
      count: totalCount,
      totalPages,
      currentPage: page,
      pageSize,
      keys
    };
  }

  async addTranslations(newTranslations) {
    let addedKeys = 0;
    const addedLocales = new Set();

    for (const [key, localeTranslations] of Object.entries(newTranslations)) {
      if (!this.translations.has(key)) {
        this.translations.set(key, {
          isChecked: false,
          translations: {}
        });
        addedKeys++;
      }

      const entry = this.translations.get(key);

      for (const [locale, translation] of Object.entries(localeTranslations)) {
        if (!this.locales.includes(locale)) {
          this.locales.push(locale);
          this.locales.sort();
        }

        const language = getLanguageFromLocale(locale);
        const processedTranslation = insertNonBreakingSpaces(translation, language);

        entry.translations[locale] = processedTranslation;
        addedLocales.add(locale);
      }
    }

    if (addedLocales.size > 0) {
      try {
        await this.saveTranslationsToJson();
      } catch (error) {
        return { success: false, error: error.message };
      }
    }

    return {
      success: true,
      addedKeys,
      addedLocales: Array.from(addedLocales)
    };
  }

  async loadPreviousState() {
    try {
      const content = await fs.readFile(this.tempStateFile, 'utf8');
      this.previousState = JSON.parse(content);
    } catch (error) {
      this.previousState = null;
    }
  }

  async saveCurrentState() {
    try {
      const state = {};

      for (const [key, data] of this.translations.entries()) {
        state[key] = { ...data.translations };
      }

      await fs.writeFile(this.tempStateFile, JSON.stringify(state, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving translation state:', error);
    }
  }

  async deleteKeysByPrefix(prefix, locales = null) {
    if (!prefix) {
      throw new Error('Prefix is required');
    }

    let deletedCount = 0;
    const affectedLocales = new Set();

    if (locales && locales.length > 0) {
      for (const [key, data] of this.translations.entries()) {
        if (key.startsWith(prefix)) {
          for (const locale of locales) {
            if (data.translations[locale]) {
              delete data.translations[locale];
              affectedLocales.add(locale);
              deletedCount++;
            }
          }
          if (Object.keys(data.translations).length === 0) {
            this.translations.delete(key);
          }
        }
      }
    } else {
      const keysToDelete = [];
      for (const key of this.translations.keys()) {
        if (key.startsWith(prefix)) {
          keysToDelete.push(key);
        }
      }

      for (const key of keysToDelete) {
        this.translations.delete(key);
      }
      deletedCount = keysToDelete.length;
    }

    if (deletedCount > 0) {
      if (affectedLocales.size > 0) {
        await this.saveTranslationsToJsonForLocales(Array.from(affectedLocales));
      } else {
        await this.saveTranslationsToJson();
      }
      await this.saveCheckedStatus();
    }

    return {
      success: true,
      deletedCount
    };
  }
}

// Test utilities
const testDir = path.join(__dirname, 'test-messages');
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ ${message}`);
    testsPassed++;
  } else {
    console.error(`✗ ${message}`);
    testsFailed++;
  }
}

async function setup() {
  await fs.mkdir(testDir, { recursive: true });

  await fs.writeFile(
    path.join(testDir, 'en-us.json'),
    JSON.stringify({
      common: {
        button: {
          save: 'Save',
          cancel: 'Cancel',
          submit: 'Submit'
        }
      },
      home: {
        title: 'Home Page',
        subtitle: 'Welcome'
      }
    }, null, 2)
  );

  await fs.writeFile(
    path.join(testDir, 'pl-pl.json'),
    JSON.stringify({
      common: {
        button: {
          save: 'Zapisz',
          cancel: 'Anuluj'
        }
      },
      home: {
        title: 'Strona główna',
        subtitle: 'Witaj'
      }
    }, null, 2)
  );

  console.log('✓ Test environment set up\n');
}

async function cleanup() {
  await fs.rm(testDir, { recursive: true, force: true });

  const stateFile = path.join(__dirname, '.translation-state.json');
  try {
    await fs.unlink(stateFile);
  } catch {
    // File might not exist
  }

  console.log('\n✓ Test environment cleaned up');
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('Translation Manager MCP v2.0.0 - Automated Tests');
  console.log('='.repeat(60));
  console.log();

  const manager = new TranslationManager();
  await manager.initialize(testDir);

  // Test 1: Initialization
  console.log('Test 1: Initialization');
  console.log('-'.repeat(60));
  assert(manager.translations.size > 0, 'Translations loaded');
  assert(manager.locales.includes('en-us'), 'en-us locale detected');
  assert(manager.locales.includes('pl-pl'), 'pl-pl locale detected');
  console.log();

  // Test 2: update_translations - simplified response
  console.log('Test 2: update_translations - Simplified Response');
  console.log('-'.repeat(60));
  const updateResult = await manager.updateTranslations({
    'common.button.save': {
      'en-us': 'Save Now',
      'pl-pl': 'Zapisz teraz'
    }
  });
  assert(updateResult.success === true, 'Update returns success');
  assert(updateResult.updatedKeys === 2, 'Update returns updatedKeys count');
  assert(!updateResult.hasOwnProperty('translation'), 'No verbose translation details');
  console.log();

  // Test 3: mark_checked - simplified response
  console.log('Test 3: mark_checked - Simplified Response');
  console.log('-'.repeat(60));
  const markResult = await manager.markChecked(['common.button.save', 'common.button.cancel']);
  assert(markResult.success === true, 'Mark returns success');
  assert(markResult.markedCount === 2, 'Mark returns markedCount');
  assert(!Array.isArray(markResult), 'Mark does not return array');
  console.log();

  // Test 4: get_missing_translation_keys - pagination
  console.log('Test 4: get_missing_translation_keys - Pagination');
  console.log('-'.repeat(60));
  const missingKeys = manager.getMissingTranslationKeys(1, 2);
  assert(missingKeys.hasOwnProperty('count'), 'Has count property');
  assert(missingKeys.hasOwnProperty('totalPages'), 'Has totalPages property');
  assert(missingKeys.hasOwnProperty('currentPage'), 'Has currentPage property');
  assert(missingKeys.hasOwnProperty('pageSize'), 'Has pageSize property');
  assert(missingKeys.currentPage === 1, 'Current page is 1');
  assert(missingKeys.pageSize === 2, 'Page size is 2');
  assert(Array.isArray(missingKeys.keys), 'Keys is an array');
  console.log();

  // Test 5: get_translation_by_key_prefix - pagination
  console.log('Test 5: get_translation_by_key_prefix - Pagination');
  console.log('-'.repeat(60));
  const prefixResult = manager.getTranslationByKeyPrefix('common.button', 1, 2);
  assert(prefixResult.hasOwnProperty('count'), 'Has count property');
  assert(prefixResult.hasOwnProperty('totalPages'), 'Has totalPages property');
  assert(prefixResult.hasOwnProperty('currentPage'), 'Has currentPage property');
  assert(prefixResult.hasOwnProperty('pageSize'), 'Has pageSize property');
  assert(prefixResult.currentPage === 1, 'Current page is 1');
  assert(prefixResult.pageSize === 2, 'Page size is 2');
  assert(typeof prefixResult.keys === 'object', 'Keys is an object');
  assert(prefixResult.count >= 3, 'Found at least 3 keys with prefix');
  console.log();

  // Test 6: add_translations - simplified response + auto-save
  console.log('Test 6: add_translations - Simplified Response + Auto-save');
  console.log('-'.repeat(60));
  const addResult = await manager.addTranslations({
    'test.new.key': {
      'en-us': 'New Key',
      'pl-pl': 'Nowy klucz'
    }
  });
  assert(addResult.success === true, 'Add returns success');
  assert(addResult.addedKeys === 1, 'Add returns addedKeys count');
  assert(Array.isArray(addResult.addedLocales), 'Add returns addedLocales array');
  assert(addResult.addedLocales.includes('en-us'), 'addedLocales includes en-us');
  assert(!addResult.hasOwnProperty('translation'), 'No verbose translation details');

  // Verify auto-save happened
  const savedFile = await fs.readFile(path.join(testDir, 'en-us.json'), 'utf8');
  const savedData = JSON.parse(savedFile);
  assert(savedData.test?.new?.key === 'New Key', 'New key was auto-saved to file');
  console.log();

  // Test 7: delete_keys_by_prefix - all locales
  console.log('Test 7: delete_keys_by_prefix - All Locales');
  console.log('-'.repeat(60));
  const deleteAllResult = await manager.deleteKeysByPrefix('test.new');
  assert(deleteAllResult.success === true, 'Delete returns success');
  assert(deleteAllResult.deletedCount === 1, 'Delete returns deletedCount');
  assert(!deleteAllResult.hasOwnProperty('deletedKeys'), 'No verbose key list');
  assert(!manager.translations.has('test.new.key'), 'Key was deleted from memory');
  console.log();

  // Test 8: delete_keys_by_prefix - specific locales
  console.log('Test 8: delete_keys_by_prefix - Specific Locales');
  console.log('-'.repeat(60));

  // First add a key to multiple locales
  await manager.addTranslations({
    'test.locale.specific': {
      'en-us': 'English',
      'pl-pl': 'Polish'
    }
  });

  // Delete only from pl-pl
  const deleteLocaleResult = await manager.deleteKeysByPrefix('test.locale', ['pl-pl']);
  assert(deleteLocaleResult.success === true, 'Delete with locales returns success');
  assert(deleteLocaleResult.deletedCount === 1, 'Delete returns deletedCount');

  const entry = manager.translations.get('test.locale.specific');
  assert(entry !== undefined, 'Key still exists in memory');
  assert(entry.translations['en-us'] === 'English', 'en-us translation still exists');
  assert(entry.translations['pl-pl'] === undefined, 'pl-pl translation was deleted');
  console.log();

  // Test 9: No backup files created
  console.log('Test 9: No Backup Files Created');
  console.log('-'.repeat(60));
  const backupDir = path.join(testDir, 'backup');
  let backupExists = false;
  try {
    await fs.access(backupDir);
    backupExists = true;
  } catch {
    backupExists = false;
  }
  assert(!backupExists, 'Backup directory was not created');
  console.log();

  // Test 10: Non-breaking spaces still work
  console.log('Test 10: Non-breaking Spaces Auto-application');
  console.log('-'.repeat(60));

  // First add the key
  await manager.addTranslations({
    'test.nbsp': {
      'pl-pl': 'Ma 5 lat i 10 kg'
    }
  });

  const nbspEntry = manager.translations.get('test.nbsp');
  if (nbspEntry && nbspEntry.translations['pl-pl']) {
    const polishText = nbspEntry.translations['pl-pl'];
    assert(polishText.includes('\u00A0'), 'Non-breaking space was applied');
    console.log(`  Original: "Ma 5 lat i 10 kg"`);
    console.log(`  Processed: "${polishText}"`);
  } else {
    console.error('✗ Could not find test.nbsp entry');
    testsFailed++;
  }
  console.log();

  // Summary
  console.log('='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`✓ Passed: ${testsPassed}`);
  console.log(`✗ Failed: ${testsFailed}`);
  console.log(`Total: ${testsPassed + testsFailed}`);
  console.log();

  if (testsFailed === 0) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('❌ Some tests failed. Please review the output above.');
    process.exit(1);
  }
}

// Run tests
(async () => {
  try {
    await setup();
    await runTests();
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  } finally {
    await cleanup();
  }
})();
