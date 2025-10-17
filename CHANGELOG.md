# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-01-16

Major release with breaking changes focused on token optimization and improved pagination.

### 🚨 Breaking Changes

#### Simplified API Responses (Token Optimization)
- **`update_translations`**: Now returns `{ success: true, updatedKeys: N }` instead of verbose per-key details
- **`mark_checked`**: Now returns `{ success: true, markedCount: N }` instead of array of objects
- **`add_translations`**: Now returns `{ success: true, addedKeys: N, addedLocales: [...] }` instead of verbose details
- **`delete_keys_by_prefix`**: Now returns `{ success: true, deletedCount: N }` instead of verbose key list

**Migration**: If you were parsing detailed response objects, update your code to use the summary counts instead.

#### Removed Tools
- **`load_from_json`**: Removed (happens automatically on initialization and file changes)
- **`save_to_json`**: Removed (happens automatically after all modifications)
- **`apply_non_breaking_spaces`**: Removed (happens automatically during save operations)

**Migration**: Remove any manual calls to these functions - they now work transparently in the background.

### ✨ New Features

#### Pagination Support
- **`get_missing_translation_keys`**: Added `page` and `pageSize` parameters
  - Returns: `{ count, totalPages, currentPage, pageSize, keys: [...] }`
- **`get_translation_by_key_prefix`**: Added `page` and `pageSize` parameters
  - Returns: `{ count, totalPages, currentPage, pageSize, keys: {...} }`

#### Enhanced Deletion
- **`delete_keys_by_prefix`**: New optional `locales` parameter
  - Without `locales`: Deletes entire keys from all locales (original behavior)
  - With `locales`: Deletes keys only from specified locales, keeping others intact

### 🔄 Changed

#### Auto-Save Everywhere
- `update_translations` - Already had auto-save (no change)
- `add_translations` - **Now auto-saves** (was manual before)
- `delete_keys_by_prefix` - Already had auto-save (no change)
- `mark_checked` - Already had auto-save (no change)

#### Backup System Removed
- No longer creates `backup/` directory
- No longer creates `.bak` files before saving
- **Recommendation**: Use Git or other version control for backups

### 🐛 Bug Fixes
- Fixed potential memory issues with large translation sets by implementing pagination
- Improved error handling in all auto-save operations

### 📊 Performance Improvements
- **85-90% reduction** in API response size for update/add/delete operations
- Pagination reduces memory usage for large translation queries
- Simplified response parsing on client side

### 🧪 Testing
- Added comprehensive test suite (41 automated tests)
- Tests cover all API changes and new functionality
- Run with `npm test`

---

## [1.0.0] - 2024-XX-XX

Initial release

### Features
- Translation management from JSON files
- Review workflow with checked/unchecked status
- Automatic non-breaking space insertion (9 languages)
- File watching for external changes
- Backup system for safety
- Missing translation detection
- Prefix-based operations
- Translation status reporting

### Tools
- `get_messages_to_check`
- `update_translations`
- `mark_checked`
- `get_checked_keys`
- `get_missing_translation_keys`
- `load_from_json`
- `save_to_json`
- `apply_non_breaking_spaces`
- `get_translation_by_key_prefix`
- `add_translations`
- `get_translation_status`
- `delete_keys_by_prefix`

---

## Migration Guide: v1.x → v2.0.0

### 1. Update Response Handling

**Before (v1.x):**
```javascript
const result = await update_translations(updates);
// result: { "key": { "locale": { success: true, translation: "...", ... } } }
```

**After (v2.0.0):**
```javascript
const result = await update_translations(updates);
// result: { success: true, updatedKeys: 5 }
```

### 2. Remove Manual Save/Load Calls

**Before (v1.x):**
```javascript
await add_translations(newTranslations);
await save_to_json(); // Manual save
```

**After (v2.0.0):**
```javascript
await add_translations(newTranslations); // Auto-saves
```

### 3. Add Pagination for Large Queries

**Before (v1.x):**
```javascript
const missing = await get_missing_translation_keys();
// Could return thousands of keys
```

**After (v2.0.0):**
```javascript
const missing = await get_missing_translation_keys({ page: 1, pageSize: 50 });
// Returns paginated results with metadata
```

### 4. Locale-Specific Deletion

**New in v2.0.0:**
```javascript
// Delete from specific locales only
await delete_keys_by_prefix({
  prefix: "HomePage.hero",
  locales: ["pl-pl", "de-de"]
});
// Keys remain in other locales
```

### 5. Remove Backup Cleanup Scripts

**Before (v1.x):**
- Manual cleanup of `backup/` directory needed

**After (v2.0.0):**
- No backups created - use Git instead
- Remove any backup cleanup automation

---

## Support

For questions or issues with upgrading, please:
- Check [TESTING.md](TESTING.md) for test examples
- Review [README.md](README.md) for updated API documentation
- Open an issue at https://github.com/lukaszolek/translation-manager-mcp/issues
