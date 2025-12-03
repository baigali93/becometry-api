const axios = require('axios');

const API_BASE = 'http://localhost:5001/api';
const ADMIN_BASE = `${API_BASE}/admin`;

// Test credentials
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Helper functions
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'blue');
}

function logSection(message) {
  console.log('\n' + '='.repeat(60));
  log(message, 'cyan');
  console.log('='.repeat(60));
}

// Store token and created IDs for cleanup
let authToken = null;
const createdIds = {
  categories: [],
  subcategories: [],
  profiles: []
};

// API client with auth header
const apiClient = axios.create({
  baseURL: ADMIN_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
apiClient.interceptors.request.use(config => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// Test functions
async function testAdminLogin() {
  logSection('TEST 1: ADMIN LOGIN');

  try {
    logInfo(`Attempting login to: ${ADMIN_BASE}/auth/login`);
    logInfo(`Credentials: username=${ADMIN_CREDENTIALS.username}`);

    const response = await axios.post(`${ADMIN_BASE}/auth/login`, ADMIN_CREDENTIALS);

    if (response.data.success && response.data.data.token) {
      authToken = response.data.data.token;
      logSuccess('Admin login successful');
      logInfo(`Token: ${authToken.substring(0, 20)}...`);
      return true;
    } else {
      logError('Login failed: No token received');
      console.error('Response:', response.data);
      return false;
    }
  } catch (error) {
    logError(`Login failed: ${error.message}`);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    } else if (error.request) {
      console.error('No response received. Request:', error.request);
    } else {
      console.error('Error details:', error);
    }
    return false;
  }
}

async function testCategoryCRUD() {
  logSection('TEST 2: CATEGORY CRUD OPERATIONS');

  let categoryId = null;

  try {
    // CREATE
    logInfo('Testing CREATE category...');
    const createResponse = await apiClient.post('/categories', {
      name: 'Test Category',
      slug: 'test-category'
    });

    if (createResponse.data.success && createResponse.data.data.id) {
      categoryId = createResponse.data.data.id;
      createdIds.categories.push(categoryId);
      logSuccess(`Category created with ID: ${categoryId}`);
    } else {
      logError('Category creation failed');
      return false;
    }

    // READ (List all)
    logInfo('Testing READ all categories...');
    const listResponse = await apiClient.get('/categories');

    if (listResponse.data.success && Array.isArray(listResponse.data.data)) {
      const found = listResponse.data.data.find(cat => cat.id === categoryId);
      if (found) {
        logSuccess(`Category found in list (${listResponse.data.data.length} total categories)`);
      } else {
        logError('Created category not found in list');
      }
    } else {
      logError('Failed to fetch categories');
    }

    // UPDATE
    logInfo('Testing UPDATE category...');
    const updateResponse = await apiClient.put(`/categories/${categoryId}`, {
      name: 'Test Category Updated',
      slug: 'test-category-updated'
    });

    if (updateResponse.data.success) {
      logSuccess('Category updated successfully');
    } else {
      logError('Category update failed');
    }

    // READ (Get updated category)
    const updatedListResponse = await apiClient.get('/categories');
    const updatedCat = updatedListResponse.data.data.find(cat => cat.id === categoryId);

    if (updatedCat && updatedCat.name === 'Test Category Updated') {
      logSuccess('Category update verified');
    } else {
      logError('Category update not reflected');
    }

    // DELETE
    logInfo('Testing DELETE category...');
    const deleteResponse = await apiClient.delete(`/categories/${categoryId}`);

    if (deleteResponse.data.success) {
      logSuccess('Category deleted successfully');
      createdIds.categories = createdIds.categories.filter(id => id !== categoryId);
    } else {
      logError('Category deletion failed');
    }

    // Verify deletion
    const afterDeleteResponse = await apiClient.get('/categories');
    const stillExists = afterDeleteResponse.data.data.find(cat => cat.id === categoryId);

    if (!stillExists) {
      logSuccess('Category deletion verified');
    } else {
      logError('Category still exists after deletion');
    }

    return true;

  } catch (error) {
    logError(`Category CRUD test failed: ${error.response?.data?.message || error.message}`);
    console.error(error.response?.data || error.message);
    return false;
  }
}

async function testSubcategoryCRUD() {
  logSection('TEST 3: SUBCATEGORY CRUD OPERATIONS');

  let parentCategoryId = null;
  let subcategoryId = null;

  try {
    // First, create a parent category
    logInfo('Creating parent category for subcategory tests...');
    const categoryResponse = await apiClient.post('/categories', {
      name: 'Test Parent Category',
      slug: 'test-parent-category'
    });

    if (categoryResponse.data.success) {
      parentCategoryId = categoryResponse.data.data.id;
      createdIds.categories.push(parentCategoryId);
      logSuccess(`Parent category created with ID: ${parentCategoryId}`);
    } else {
      logError('Failed to create parent category');
      return false;
    }

    // CREATE Subcategory
    logInfo('Testing CREATE subcategory...');
    const createResponse = await apiClient.post('/subcategories', {
      category_id: parentCategoryId,
      name: 'Test Subcategory',
      slug: 'test-subcategory'
    });

    if (createResponse.data.success && createResponse.data.data.id) {
      subcategoryId = createResponse.data.data.id;
      createdIds.subcategories.push(subcategoryId);
      logSuccess(`Subcategory created with ID: ${subcategoryId}`);
    } else {
      logError('Subcategory creation failed');
      return false;
    }

    // READ (List all)
    logInfo('Testing READ all subcategories...');
    const listResponse = await apiClient.get('/subcategories');

    if (listResponse.data.success && Array.isArray(listResponse.data.data)) {
      const found = listResponse.data.data.find(sub => sub.id === subcategoryId);
      if (found) {
        logSuccess(`Subcategory found in list (${listResponse.data.data.length} total subcategories)`);
      } else {
        logError('Created subcategory not found in list');
      }
    } else {
      logError('Failed to fetch subcategories');
    }

    // UPDATE
    logInfo('Testing UPDATE subcategory...');
    const updateResponse = await apiClient.put(`/subcategories/${subcategoryId}`, {
      category_id: parentCategoryId,
      name: 'Test Subcategory Updated',
      slug: 'test-subcategory-updated'
    });

    if (updateResponse.data.success) {
      logSuccess('Subcategory updated successfully');
    } else {
      logError('Subcategory update failed');
    }

    // READ (Get updated subcategory)
    const updatedListResponse = await apiClient.get('/subcategories');
    const updatedSub = updatedListResponse.data.data.find(sub => sub.id === subcategoryId);

    if (updatedSub && updatedSub.name === 'Test Subcategory Updated') {
      logSuccess('Subcategory update verified');
    } else {
      logError('Subcategory update not reflected');
    }

    // DELETE Subcategory
    logInfo('Testing DELETE subcategory...');
    const deleteResponse = await apiClient.delete(`/subcategories/${subcategoryId}`);

    if (deleteResponse.data.success) {
      logSuccess('Subcategory deleted successfully');
      createdIds.subcategories = createdIds.subcategories.filter(id => id !== subcategoryId);
    } else {
      logError('Subcategory deletion failed');
    }

    // Verify deletion
    const afterDeleteResponse = await apiClient.get('/subcategories');
    const stillExists = afterDeleteResponse.data.data.find(sub => sub.id === subcategoryId);

    if (!stillExists) {
      logSuccess('Subcategory deletion verified');
    } else {
      logError('Subcategory still exists after deletion');
    }

    // Cleanup: Delete parent category
    logInfo('Cleaning up parent category...');
    await apiClient.delete(`/categories/${parentCategoryId}`);
    createdIds.categories = createdIds.categories.filter(id => id !== parentCategoryId);

    return true;

  } catch (error) {
    logError(`Subcategory CRUD test failed: ${error.response?.data?.message || error.message}`);
    console.error(error.response?.data || error.message);
    return false;
  }
}

async function testProfileCRUD() {
  logSection('TEST 4: PROFILE CRUD OPERATIONS');

  let categoryId = null;
  let subcategoryId = null;
  let profileId = null;

  try {
    // Create category and subcategory for profile
    logInfo('Setting up category and subcategory for profile...');

    const categoryResponse = await apiClient.post('/categories', {
      name: 'Test Profile Category',
      slug: 'test-profile-category'
    });
    categoryId = categoryResponse.data.data.id;
    createdIds.categories.push(categoryId);

    const subcategoryResponse = await apiClient.post('/subcategories', {
      category_id: categoryId,
      name: 'Test Profile Subcategory',
      slug: 'test-profile-subcategory'
    });
    subcategoryId = subcategoryResponse.data.data.id;
    createdIds.subcategories.push(subcategoryId);

    logSuccess('Category and subcategory created for profile tests');

    // CREATE Profile
    logInfo('Testing CREATE profile...');
    const createResponse = await apiClient.post('/profiles', {
      name: 'Test Profile',
      category_id: categoryId,
      subcategory_id: subcategoryId,
      insight: 'This is a test profile',
      location: 'Test City',
      language: 'English',
      status: 'published',
      social_links: [
        { platform: 'youtube', url: 'https://youtube.com/@testuser' },
        { platform: 'instagram', url: 'https://instagram.com/testuser' }
      ],
      tags: ['test', 'automation', 'crud']
    });

    if (createResponse.data.success && createResponse.data.data.id) {
      profileId = createResponse.data.data.id;
      createdIds.profiles.push(profileId);
      logSuccess(`Profile created with ID: ${profileId}`);
    } else {
      logError('Profile creation failed');
      return false;
    }

    // READ (List all)
    logInfo('Testing READ all profiles...');
    const listResponse = await apiClient.get('/profiles');

    if (listResponse.data.success && listResponse.data.data.profiles && Array.isArray(listResponse.data.data.profiles)) {
      const found = listResponse.data.data.profiles.find(prof => prof.id === profileId);
      if (found) {
        logSuccess(`Profile found in list (${listResponse.data.data.profiles.length} total profiles)`);
      } else {
        logError('Created profile not found in list');
      }
    } else {
      logError('Failed to fetch profiles');
    }

    // UPDATE
    logInfo('Testing UPDATE profile...');
    const updateResponse = await apiClient.put(`/profiles/${profileId}`, {
      name: 'Test Profile Updated',
      category_id: categoryId,
      subcategory_id: subcategoryId,
      insight: 'This profile has been updated',
      location: 'Updated City',
      language: 'Spanish',
      status: 'published',
      social_links: [
        { platform: 'youtube', url: 'https://youtube.com/@testuserupdated' },
        { platform: 'twitter', url: 'https://twitter.com/testuser' }
      ],
      tags: ['test', 'updated', 'automation']
    });

    if (updateResponse.data.success) {
      logSuccess('Profile updated successfully');
    } else {
      logError('Profile update failed');
    }

    // READ (Get updated profile)
    const updatedListResponse = await apiClient.get('/profiles');
    const updatedProfile = updatedListResponse.data.data.profiles.find(prof => prof.id === profileId);

    if (updatedProfile && updatedProfile.name === 'Test Profile Updated') {
      logSuccess('Profile update verified');
    } else {
      logError('Profile update not reflected');
    }

    // DELETE Profile
    logInfo('Testing DELETE profile...');
    const deleteResponse = await apiClient.delete(`/profiles/${profileId}`);

    if (deleteResponse.data.success) {
      logSuccess('Profile deleted successfully');
      createdIds.profiles = createdIds.profiles.filter(id => id !== profileId);
    } else {
      logError('Profile deletion failed');
    }

    // Verify deletion
    const afterDeleteResponse = await apiClient.get('/profiles');
    const stillExists = afterDeleteResponse.data.data.profiles.find(prof => prof.id === profileId);

    if (!stillExists) {
      logSuccess('Profile deletion verified');
    } else {
      logError('Profile still exists after deletion');
    }

    // Cleanup
    logInfo('Cleaning up test data...');
    await apiClient.delete(`/subcategories/${subcategoryId}`);
    await apiClient.delete(`/categories/${categoryId}`);
    createdIds.subcategories = createdIds.subcategories.filter(id => id !== subcategoryId);
    createdIds.categories = createdIds.categories.filter(id => id !== categoryId);

    return true;

  } catch (error) {
    logError(`Profile CRUD test failed: ${error.response?.data?.message || error.message}`);
    console.error(error.response?.data || error.message);
    return false;
  }
}

async function cleanup() {
  logSection('CLEANUP: Removing any remaining test data');

  try {
    // Delete remaining profiles
    for (const id of createdIds.profiles) {
      try {
        await apiClient.delete(`/profiles/${id}`);
        logInfo(`Deleted profile ${id}`);
      } catch (err) {
        // Ignore errors during cleanup
      }
    }

    // Delete remaining subcategories
    for (const id of createdIds.subcategories) {
      try {
        await apiClient.delete(`/subcategories/${id}`);
        logInfo(`Deleted subcategory ${id}`);
      } catch (err) {
        // Ignore errors during cleanup
      }
    }

    // Delete remaining categories
    for (const id of createdIds.categories) {
      try {
        await apiClient.delete(`/categories/${id}`);
        logInfo(`Deleted category ${id}`);
      } catch (err) {
        // Ignore errors during cleanup
      }
    }

    logSuccess('Cleanup completed');
  } catch (error) {
    logError('Some cleanup operations failed (this is usually okay)');
  }
}

async function runAllTests() {
  log('\n' + '█'.repeat(60), 'cyan');
  log('   BECOMETRY ADMIN CRUD TEST SUITE', 'cyan');
  log('█'.repeat(60) + '\n', 'cyan');

  const results = {
    total: 4,
    passed: 0,
    failed: 0
  };

  try {
    // Test 1: Login
    const loginSuccess = await testAdminLogin();
    if (!loginSuccess) {
      logError('Cannot proceed without successful login');
      return;
    }
    results.passed++;

    // Test 2: Category CRUD
    const categoryCrudSuccess = await testCategoryCRUD();
    if (categoryCrudSuccess) results.passed++;
    else results.failed++;

    // Test 3: Subcategory CRUD
    const subcategoryCrudSuccess = await testSubcategoryCRUD();
    if (subcategoryCrudSuccess) results.passed++;
    else results.failed++;

    // Test 4: Profile CRUD
    const profileCrudSuccess = await testProfileCRUD();
    if (profileCrudSuccess) results.passed++;
    else results.failed++;

  } catch (error) {
    logError(`Test suite error: ${error.message}`);
    results.failed++;
  } finally {
    // Cleanup any remaining test data
    await cleanup();

    // Print summary
    logSection('TEST SUMMARY');
    log(`Total Tests: ${results.total}`, 'blue');
    log(`Passed: ${results.passed}`, 'green');
    log(`Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');

    const successRate = ((results.passed / results.total) * 100).toFixed(2);
    log(`Success Rate: ${successRate}%`, successRate === '100.00' ? 'green' : 'yellow');

    if (results.passed === results.total) {
      log('\n🎉 All tests passed! 🎉\n', 'green');
    } else {
      log('\n⚠️  Some tests failed. Please review the output above.\n', 'yellow');
    }
  }
}

// Run the tests
runAllTests().catch(error => {
  logError(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
