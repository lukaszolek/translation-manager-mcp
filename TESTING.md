# Testing Guide

## Automated Tests

The project includes comprehensive automated tests for all v2.0.0 API changes.

### Running Tests

```bash
# Run all tests
npm test

# Or directly
node test-translation-manager.js
```

### Test Coverage

The test suite validates all major changes in v2.0.0:

#### 1. **Initialization** (3 tests)
- ✓ Translations loaded from JSON files
- ✓ Multiple locales detected (en-us, pl-pl)
- ✓ Proper data structure initialization

#### 2. **update_translations** (3 tests)
- ✓ Returns simplified response: `{ success: true, updatedKeys: N }`
- ✓ No verbose translation details (token optimization)
- ✓ Auto-saves changes to JSON files

#### 3. **mark_checked** (3 tests)
- ✓ Returns simplified response: `{ success: true, markedCount: N }`
- ✓ Does not return array (previously returned array of objects)
- ✓ Auto-saves checked status

#### 4. **get_missing_translation_keys** (7 tests)
- ✓ Returns pagination metadata (count, totalPages, currentPage, pageSize)
- ✓ Properly slices results based on page/pageSize
- ✓ Returns keys as array

#### 5. **get_translation_by_key_prefix** (7 tests)
- ✓ Returns pagination metadata
- ✓ Properly filters by key prefix
- ✓ Returns keys as object (not array)
- ✓ Correctly counts matching keys

#### 6. **add_translations** (6 tests)
- ✓ Returns simplified response: `{ success, addedKeys, addedLocales }`
- ✓ No verbose translation details
- ✓ Auto-saves to JSON files
- ✓ Verifies file was actually written to disk

#### 7. **delete_keys_by_prefix - All Locales** (4 tests)
- ✓ Returns simplified response: `{ success: true, deletedCount: N }`
- ✓ No verbose key list
- ✓ Deletes keys from memory
- ✓ Auto-saves changes

#### 8. **delete_keys_by_prefix - Specific Locales** (5 tests)
- ✓ Accepts optional `locales` parameter
- ✓ Deletes only from specified locales
- ✓ Keeps key alive if translations remain in other locales
- ✓ Removes key entirely if no translations remain

#### 9. **No Backup System** (1 test)
- ✓ Backup directory is NOT created (removed feature)

#### 10. **Non-breaking Spaces** (1 test)
- ✓ Automatically applies language-specific rules
- ✓ Works transparently during add/update operations

### Test Output

Successful test run shows:

```
============================================================
Test Summary
============================================================
✓ Passed: 41
✗ Failed: 0
Total: 41

🎉 All tests passed!
```

### Test Environment

Tests create a temporary directory structure:

```
test-messages/
├── en-us.json
├── pl-pl.json
└── translation-check.json (auto-generated)
```

All test files and state are automatically cleaned up after test execution.

## Manual Testing

### Basic Workflow Test

1. Create test directory:
```bash
mkdir test-translations
cd test-translations
```

2. Create test files:

**messages/en-us.json:**
```json
{
  "common": {
    "greeting": "Hello"
  }
}
```

**messages/pl-pl.json:**
```json
{
  "common": {
    "greeting": "Witaj"
  }
}
```

3. Start the MCP server:
```bash
MESSAGES_DIR=./messages translation-manager-mcp
```

4. Connect via MCP client and test tools:
- `get_messages_to_check` - Should return unchecked messages
- `update_translations` - Update a translation
- `mark_checked` - Mark as reviewed
- `get_missing_translation_keys` - Should show keys missing in some locales

### Integration Testing

For integration testing with Claude Desktop or other MCP clients:

1. Configure your MCP client with:
```json
{
  "mcpServers": {
    "translation-manager": {
      "command": "node",
      "args": ["/path/to/translation-manager-mcp/index.js"],
      "env": {
        "MESSAGES_DIR": "/path/to/your/messages"
      }
    }
  }
}
```

2. Restart your MCP client

3. Test each tool to verify:
   - Correct response format
   - Auto-save functionality
   - Pagination works as expected
   - Non-breaking spaces are applied

## Continuous Integration

To add these tests to CI/CD:

```yaml
# Example GitHub Actions
- name: Run tests
  run: npm test
```

The tests:
- Exit with code 0 on success
- Exit with code 1 on failure
- Provide detailed output for debugging
- Clean up after themselves

## Test Maintenance

When adding new features:

1. Add test case to `test-translation-manager.js`
2. Follow existing test structure
3. Use `assert()` function for validation
4. Include both positive and negative test cases
5. Update this document with new test coverage

## Troubleshooting

### Tests fail with "ENOENT: no such file or directory"
- Ensure you're running tests from the project root
- Check that `src/utils/non-breaking-spaces.js` exists

### Tests hang indefinitely
- May indicate file watcher not being cleaned up
- Check that cleanup() function is properly called

### Random test failures
- Ensure no other process is using the test-messages directory
- Verify sufficient disk space for test files
