#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { watch } from 'fs';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import non-breaking spaces utility
import { insertNonBreakingSpaces, getLanguageFromLocale } from './src/utils/non-breaking-spaces.js';

export class TranslationManager {
  constructor() {
    this.translations = new Map(); // key -> { isChecked: boolean, translations: { locale: string } }
    this.locales = [];
    this.messagesDir = null;
    this.tempStateFile = null;
    this.previousState = null;
    this.hasLoadedInitialCheck = false;
    this.fileWatcher = null;
    this.reloadTimer = null;
  }

  async initialize(messagesDir = null) {
    // If no messagesDir provided, try to find it relative to current working directory
    if (!messagesDir) {
      // Default to 'messages' directory in current working directory
      messagesDir = path.join(process.cwd(), 'messages');
    }
    this.messagesDir = messagesDir;
    this.tempStateFile = path.join(__dirname, '.translation-state.json');
    
    // Load previous state if exists
    await this.loadPreviousState();
    
    // Load translations and detect changes
    await this.loadTranslationsFromJson();
    
    // Only load checked status from translation-check.json on first load
    if (!this.hasLoadedInitialCheck) {
      await this.loadCheckedStatus();
      this.hasLoadedInitialCheck = true;
    }
    
    // Set up file watcher for JSON files
    this.setupFileWatcher();
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
    // Sort keys by depth (number of dots), then alphabetically
    const sortedData = [...flatData].sort((a, b) => {
      const depthA = a[0].split('.').length;
      const depthB = b[0].split('.').length;
      
      // First sort by depth (ascending)
      if (depthA !== depthB) {
        return depthA - depthB;
      }
      
      // Then sort alphabetically
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
      
      // Store current state before loading new translations
      const currentState = new Map();
      for (const [key, data] of this.translations.entries()) {
        currentState.set(key, { ...data.translations });
      }
      
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
              
              // Check if this translation has changed compared to previous state
              if (this.previousState && this.previousState[key]) {
                if (this.previousState[key][locale] !== value) {
                  // Translation changed, mark as unchecked
                  entry.isChecked = false;
                }
              } else if (this.previousState && !this.previousState[key]) {
                // New key, mark as unchecked
                entry.isChecked = false;
              }
            }
          } catch (error) {
            console.error(`Error processing ${filename}:`, error);
          }
        }
      }
      
      // Save current state for next comparison
      await this.saveCurrentState();
      
      console.error(`Loaded ${this.translations.size} keys in ${this.locales.length} locales`);
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
      // Save each specified locale file
      for (const locale of localesToSave) {
        if (!this.locales.includes(locale)) {
          continue;
        }

        const filename = `${locale}.json`;
        const filepath = path.join(this.messagesDir, filename);

        // Create flattened data for this locale
        const flatData = [];
        const language = getLanguageFromLocale(locale);

        for (const [key, data] of this.translations.entries()) {
          if (data.translations[locale] !== undefined) {
            // Apply non-breaking spaces before saving
            const processedTranslation = insertNonBreakingSpaces(data.translations[locale], language);
            flatData.push([key, processedTranslation]);
          }
        }

        // Unflatten to nested structure
        const nestedData = this.unflattenJson(flatData);

        // Write the new content
        const jsonContent = JSON.stringify(nestedData, null, 4);
        await fs.writeFile(filepath, jsonContent, 'utf8');
      }

      console.error(`Saved translations to ${localesToSave.length} JSON files`);

      // Also save the checked status
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
      
      // Apply checked status to existing translations
      for (const [key, isChecked] of Object.entries(checkedData)) {
        if (this.translations.has(key)) {
          const entry = this.translations.get(key);
          entry.isChecked = isChecked;
        }
      }
      
      console.error(`Loaded checked status for ${Object.keys(checkedData).length} keys`);
    } catch (error) {
      console.error('Could not load translation-check.json, starting with all unchecked:', error.message);
      // It's OK if the file doesn't exist, we'll create it on first save
    }
  }

  async saveCheckedStatus() {
    try {
      const filepath = path.join(this.messagesDir, 'translation-check.json');
      const checkedData = {};
      
      // Collect all checked statuses
      for (const [key, data] of this.translations.entries()) {
        checkedData[key] = data.isChecked;
      }
      
      // Write to file
      const jsonContent = JSON.stringify(checkedData, null, 2);
      await fs.writeFile(filepath, jsonContent, 'utf8');
      
      console.error(`Saved checked status for ${this.translations.size} keys`);
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

    // updates is an object: { key: { locale: translation } }
    for (const [key, localeTranslations] of Object.entries(updates)) {
      if (!this.translations.has(key)) {
        continue;
      }

      const entry = this.translations.get(key);

      for (const [locale, translation] of Object.entries(localeTranslations)) {
        if (!this.locales.includes(locale)) {
          continue;
        }

        // Get the language code from locale (e.g., 'pl' from 'pl-pl')
        const language = getLanguageFromLocale(locale);

        // Apply non-breaking spaces if rules exist for this language
        const processedTranslation = insertNonBreakingSpaces(translation, language);

        entry.translations[locale] = processedTranslation;
        modifiedLocales.add(locale);
        updatedCount++;
      }
    }

    // Auto-save only the modified locales to disk
    if (modifiedLocales.size > 0) {
      try {
        await this.saveTranslationsToJsonForLocales(Array.from(modifiedLocales));
        console.error(`Auto-saved translations for locales: ${Array.from(modifiedLocales).join(', ')}`);
      } catch (error) {
        console.error(`Error auto-saving translations:`, error);
        return { success: false, error: error.message };
      }
    }

    return { success: true, updatedKeys: updatedCount };
  }

  async markChecked(keys) {
    // Handle both single key (string) and multiple keys (array)
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

    // Auto-save the checked status
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

    // Calculate pagination
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

  // Get translations by key prefix
  getTranslationByKeyPrefix(keyPrefix, page = 1, pageSize = 50) {
    const allResults = [];

    for (const [key, data] of this.translations.entries()) {
      if (key.startsWith(keyPrefix)) {
        allResults.push({ key, translations: data.translations });
      }
    }

    // Calculate pagination
    const totalCount = allResults.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedResults = allResults.slice(startIndex, endIndex);

    // Convert back to object format
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
  
  // Add new translations
  async addTranslations(newTranslations) {
    let addedKeys = 0;
    const addedLocales = new Set();

    // newTranslations is an object: { key: { locale: translation } }
    for (const [key, localeTranslations] of Object.entries(newTranslations)) {
      // Create new entry if key doesn't exist
      if (!this.translations.has(key)) {
        this.translations.set(key, {
          isChecked: false,
          translations: {}
        });
        addedKeys++;
      }

      const entry = this.translations.get(key);

      for (const [locale, translation] of Object.entries(localeTranslations)) {
        // Add locale if it doesn't exist
        if (!this.locales.includes(locale)) {
          this.locales.push(locale);
          this.locales.sort();
        }

        // Get the language code from locale (e.g., 'pl' from 'pl-pl')
        const language = getLanguageFromLocale(locale);

        // Apply non-breaking spaces if rules exist for this language
        const processedTranslation = insertNonBreakingSpaces(translation, language);

        entry.translations[locale] = processedTranslation;
        addedLocales.add(locale);
      }
    }

    // Auto-save to JSON files
    if (addedLocales.size > 0) {
      try {
        await this.saveTranslationsToJson();
        console.error(`Auto-saved translations for locales: ${Array.from(addedLocales).join(', ')}`);
      } catch (error) {
        console.error(`Error auto-saving translations:`, error);
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
      console.error(`Loaded previous translation state with ${Object.keys(this.previousState).length} keys`);
    } catch (error) {
      console.error('No previous translation state found, starting fresh');
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
      console.error(`Saved current translation state with ${Object.keys(state).length} keys`);
    } catch (error) {
      console.error('Error saving translation state:', error);
    }
  }
  
  // Get translation status summary
  getTranslationStatus() {
    let total = 0;
    let missingTranslations = 0;
    let waitingForCheck = 0;
    
    for (const [key, data] of this.translations.entries()) {
      total++;
      
      // Check if missing translations in any locale
      let hasMissingTranslation = false;
      for (const locale of this.locales) {
        if (!data.translations[locale] || data.translations[locale] === '') {
          hasMissingTranslation = true;
          break;
        }
      }
      
      if (hasMissingTranslation) {
        missingTranslations++;
      }
      
      if (!data.isChecked) {
        waitingForCheck++;
      }
    }
    
    return {
      total,
      missingTranslations,
      waitingForCheck
    };
  }

  // Apply non-breaking spaces to all translations
  applyNonBreakingSpacesToAll() {
    let updatedCount = 0;
    
    for (const [key, data] of this.translations.entries()) {
      for (const locale of this.locales) {
        if (data.translations[locale]) {
          const language = getLanguageFromLocale(locale);
          const original = data.translations[locale];
          const processed = insertNonBreakingSpaces(original, language);
          
          if (original !== processed) {
            data.translations[locale] = processed;
            updatedCount++;
          }
        }
      }
    }
    
    return {
      success: true,
      totalKeys: this.translations.size,
      totalLocales: this.locales.length,
      updatedTranslations: updatedCount
    };
  }

  // Delete all keys with a given prefix
  async deleteKeysByPrefix(prefix, locales = null) {
    if (!prefix) {
      throw new Error('Prefix is required');
    }

    let deletedCount = 0;
    const affectedLocales = new Set();

    if (locales && locales.length > 0) {
      // Delete keys only from specified locales
      for (const [key, data] of this.translations.entries()) {
        if (key.startsWith(prefix)) {
          for (const locale of locales) {
            if (data.translations[locale]) {
              delete data.translations[locale];
              affectedLocales.add(locale);
              deletedCount++;
            }
          }
          // If all translations are gone, remove the key entirely
          if (Object.keys(data.translations).length === 0) {
            this.translations.delete(key);
          }
        }
      }
    } else {
      // Delete entire keys
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

    // Automatically save to JSON files after deletion
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
  
  setupFileWatcher() {
    if (this.fileWatcher) {
      this.fileWatcher.close();
    }
    
    try {
      this.fileWatcher = watch(this.messagesDir, (eventType, filename) => {
        // Only watch JSON files, ignore backups and translation-check.json
        if (filename && filename.endsWith('.json') && 
            !filename.endsWith('.bak') && 
            filename !== 'translation-check.json') {
          
          console.error(`Detected change in ${filename}, scheduling reload...`);
          
          // Debounce reloads to avoid multiple rapid reloads
          if (this.reloadTimer) {
            clearTimeout(this.reloadTimer);
          }
          
          this.reloadTimer = setTimeout(async () => {
            console.error(`Reloading translations due to file change...`);
            try {
              await this.loadPreviousState();
              await this.loadTranslationsFromJson();
              console.error(`Translations reloaded successfully`);
            } catch (error) {
              console.error(`Error reloading translations:`, error);
            }
          }, 500); // Wait 500ms before reloading to batch multiple changes
        }
      });
      
      console.error(`File watcher set up for ${this.messagesDir}`);
    } catch (error) {
      console.error(`Error setting up file watcher:`, error);
    }
  }
  
  cleanup() {
    if (this.fileWatcher) {
      this.fileWatcher.close();
    }
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
    }
  }
}

// Create MCP Server
const translationManager = new TranslationManager();
const server = new Server(
  {
    name: 'translation-manager',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_messages_to_check',
        description: 'Get next N unchecked messages for review',
        inputSchema: {
          type: 'object',
          properties: {
            n: {
              type: 'number',
              description: 'Number of messages to return',
              default: 10
            }
          }
        }
      },
      {
        name: 'update_translations',
        description: 'Update translations for multiple keys and locales',
        inputSchema: {
          type: 'object',
          properties: {
            updates: {
              type: 'object',
              description: 'Object with keys as translation keys, values as objects with locale->translation mappings',
              additionalProperties: {
                type: 'object',
                additionalProperties: {
                  type: 'string'
                }
              }
            }
          },
          required: ['updates']
        }
      },
      {
        name: 'mark_checked',
        description: 'Mark translation keys as checked',
        inputSchema: {
          type: 'object',
          properties: {
            keys: {
              type: ['string', 'array'],
              description: 'Translation key(s) to mark as checked. Can be a single key or array of keys',
              items: {
                type: 'string'
              }
            }
          },
          required: ['keys']
        }
      },
      {
        name: 'get_checked_keys',
        description: 'Get list of keys that have been marked as checked',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'get_missing_translation_keys',
        description: 'Get list of keys missing translations in one or more locales with pagination',
        inputSchema: {
          type: 'object',
          properties: {
            page: {
              type: 'number',
              description: 'Page number (default: 1)',
              default: 1
            },
            pageSize: {
              type: 'number',
              description: 'Number of items per page (default: 50)',
              default: 50
            }
          }
        }
      },
      {
        name: 'get_translation_by_key_prefix',
        description: 'Get translations for all keys starting with given prefix with pagination',
        inputSchema: {
          type: 'object',
          properties: {
            keyPrefix: {
              type: 'string',
              description: 'Key prefix to search for'
            },
            page: {
              type: 'number',
              description: 'Page number (default: 1)',
              default: 1
            },
            pageSize: {
              type: 'number',
              description: 'Number of items per page (default: 50)',
              default: 50
            }
          },
          required: ['keyPrefix']
        }
      },
      {
        name: 'add_translations',
        description: 'Add new translations to the database',
        inputSchema: {
          type: 'object',
          properties: {
            translations: {
              type: 'object',
              description: 'Object with keys as translation keys, values as objects with locale->translation mappings',
              additionalProperties: {
                type: 'object',
                additionalProperties: {
                  type: 'string'
                }
              }
            }
          },
          required: ['translations']
        }
      },
      {
        name: 'get_translation_status',
        description: 'Get translation status summary',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'delete_keys_by_prefix',
        description: 'Delete translation keys with a given prefix. Can delete from all locales or specific locales only.',
        inputSchema: {
          type: 'object',
          properties: {
            prefix: {
              type: 'string',
              description: 'The prefix of keys to delete (e.g., "GalleryWalls.aboutFramky")'
            },
            locales: {
              type: 'array',
              description: 'Optional: array of locale codes to delete from (e.g., ["pl-pl", "en-gb"]). If not provided, deletes entire keys from all locales.',
              items: {
                type: 'string'
              }
            }
          },
          required: ['prefix']
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    switch (name) {
      case 'get_messages_to_check':
        const messages = translationManager.getMessagesToCheck(args.n || 10);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(messages, null, 2)
            }
          ]
        };
        
      case 'update_translations':
        const updateResult = await translationManager.updateTranslations(args.updates);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(updateResult, null, 2)
            }
          ]
        };
        
      case 'mark_checked':
        const markResult = await translationManager.markChecked(args.keys);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(markResult, null, 2)
            }
          ]
        };
        
      case 'get_checked_keys':
        const checkedKeys = translationManager.getCheckedKeys();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                count: checkedKeys.length,
                keys: checkedKeys
              }, null, 2)
            }
          ]
        };
        
      case 'get_missing_translation_keys':
        const missingKeys = translationManager.getMissingTranslationKeys(
          args.page || 1,
          args.pageSize || 50
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(missingKeys, null, 2)
            }
          ]
        };

      case 'get_translation_by_key_prefix':
        const translationsByKey = translationManager.getTranslationByKeyPrefix(
          args.keyPrefix,
          args.page || 1,
          args.pageSize || 50
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(translationsByKey, null, 2)
            }
          ]
        };

      case 'add_translations':
        const addResult = await translationManager.addTranslations(args.translations);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(addResult, null, 2)
            }
          ]
        };
        
      case 'get_translation_status':
        const status = translationManager.getTranslationStatus();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(status, null, 2)
            }
          ]
        };
        
      case 'delete_keys_by_prefix':
        const deleteResult = await translationManager.deleteKeysByPrefix(
          args.prefix,
          args.locales
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(deleteResult, null, 2)
            }
          ]
        };
        
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error.message
          }, null, 2)
        }
      ]
    };
  }
});

// Initialize and start server
async function main() {
  try {
    // Get messages directory from environment variable or use default
    const messagesDir = process.env.MESSAGES_DIR || null;

    if (messagesDir) {
      console.error(`Using messages directory from MESSAGES_DIR: ${messagesDir}`);
    } else {
      console.error(`Using default messages directory: ${path.join(process.cwd(), 'messages')}`);
    }

    // Initialize translation manager with custom directory if provided
    await translationManager.initialize(messagesDir);

    // Start server
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error('Translation Manager MCP Server running on stdio');
    console.error(`Loaded ${translationManager.translations.size} translation keys`);
    console.error(`Available locales: ${translationManager.locales.join(', ')}`);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.error('Shutting down Translation Manager MCP Server...');
      translationManager.cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.error('Shutting down Translation Manager MCP Server...');
      translationManager.cleanup();
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();