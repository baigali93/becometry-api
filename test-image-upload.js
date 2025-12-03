const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

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

let authToken = null;

// Create a simple test image (1x1 pixel PNG)
function createTestImage() {
  const testImagePath = path.join(__dirname, 'test-image.png');

  // This is a base64 encoded 1x1 red pixel PNG
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  const pngBuffer = Buffer.from(pngBase64, 'base64');

  fs.writeFileSync(testImagePath, pngBuffer);
  return testImagePath;
}

async function testAdminLogin() {
  logSection('STEP 1: Admin Login');

  try {
    logInfo('Logging in as admin...');
    const response = await axios.post(`${ADMIN_BASE}/auth/login`, ADMIN_CREDENTIALS);

    if (response.data.success && response.data.data.token) {
      authToken = response.data.data.token;
      logSuccess('Login successful');
      logInfo(`Token: ${authToken.substring(0, 20)}...`);
      return true;
    } else {
      logError('Login failed: No token received');
      return false;
    }
  } catch (error) {
    logError(`Login failed: ${error.message}`);
    console.error(error.response?.data || error.message);
    return false;
  }
}

async function testImageUpload() {
  logSection('STEP 2: Image Upload Test');

  let testImagePath = null;
  let uploadedUrl = null;

  try {
    // Create test image
    logInfo('Creating test image...');
    testImagePath = createTestImage();
    logSuccess(`Test image created: ${testImagePath}`);

    // Check if file exists
    if (!fs.existsSync(testImagePath)) {
      logError('Test image file not found');
      return null;
    }

    const fileStats = fs.statSync(testImagePath);
    logInfo(`Image file size: ${fileStats.size} bytes`);

    // Create form data
    const formData = new FormData();
    formData.append('image', fs.createReadStream(testImagePath));

    logInfo('Uploading image to Cloudinary...');

    // Upload image
    const response = await axios.post(`${ADMIN_BASE}/upload-image`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${authToken}`
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    if (response.data.success && response.data.url) {
      uploadedUrl = response.data.url;
      logSuccess('Image uploaded successfully');
      logInfo(`Cloudinary URL: ${uploadedUrl}`);

      // Verify it's a Cloudinary URL
      if (uploadedUrl.includes('cloudinary.com')) {
        logSuccess('URL is from Cloudinary CDN');
      } else {
        logError('URL is not from Cloudinary');
      }

      // Verify it's HTTPS
      if (uploadedUrl.startsWith('https://')) {
        logSuccess('URL uses HTTPS');
      } else {
        logError('URL does not use HTTPS');
      }

      // Check if it's in the correct folder
      if (uploadedUrl.includes('becometry/profile-images')) {
        logSuccess('Image stored in correct Cloudinary folder');
      } else {
        logError('Image not in expected Cloudinary folder');
      }

      return uploadedUrl;

    } else {
      logError('Upload failed: No URL received');
      console.error('Response:', response.data);
      return null;
    }

  } catch (error) {
    logError(`Image upload failed: ${error.message}`);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    } else {
      console.error('Error details:', error.message);
    }
    return null;
  } finally {
    // Cleanup test image
    if (testImagePath && fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
      logInfo('Test image cleaned up');
    }
  }
}

async function testProfileWithImage(imageUrl) {
  logSection('STEP 3: Create Profile with Uploaded Image');

  let profileId = null;
  let categoryId = null;
  let subcategoryId = null;

  try {
    // Create test category
    logInfo('Creating test category...');
    const categoryResponse = await axios.post(`${ADMIN_BASE}/categories`, {
      name: 'Image Test Category',
      slug: 'image-test-category'
    }, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!categoryResponse.data.success) {
      logError('Failed to create test category');
      return false;
    }

    categoryId = categoryResponse.data.data.id;
    logSuccess(`Test category created with ID: ${categoryId}`);

    // Create test subcategory
    logInfo('Creating test subcategory...');
    const subcategoryResponse = await axios.post(`${ADMIN_BASE}/subcategories`, {
      name: 'Image Test Subcategory',
      category_id: categoryId,
      slug: 'image-test-subcategory'
    }, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!subcategoryResponse.data.success) {
      logError('Failed to create test subcategory');
      return false;
    }

    subcategoryId = subcategoryResponse.data.data.id;
    logSuccess(`Test subcategory created with ID: ${subcategoryId}`);

    // Create profile with uploaded image
    logInfo('Creating profile with uploaded image...');
    const profileResponse = await axios.post(`${ADMIN_BASE}/profiles`, {
      name: 'Test Profile with Image',
      category_id: categoryId,
      subcategory_id: subcategoryId,
      image_url: imageUrl,
      insight: 'This profile was created to test image upload',
      location: 'Test City',
      language: 'English',
      status: 'published',
      social_links: [
        { platform: 'youtube', url: 'https://youtube.com/@testuser' }
      ],
      tags: ['test', 'image-upload']
    }, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (profileResponse.data.success && profileResponse.data.data.id) {
      profileId = profileResponse.data.data.id;
      logSuccess(`Profile created with ID: ${profileId}`);

      const profile = profileResponse.data.data;
      if (profile.image_url === imageUrl) {
        logSuccess('Profile image URL matches uploaded image');
      } else {
        logError('Profile image URL does not match');
      }

      // Cleanup
      logInfo('Cleaning up test data...');
      await axios.delete(`${ADMIN_BASE}/profiles/${profileId}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      logInfo(`Deleted profile ${profileId}`);

      await axios.delete(`${ADMIN_BASE}/subcategories/${subcategoryId}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      logInfo(`Deleted subcategory ${subcategoryId}`);

      await axios.delete(`${ADMIN_BASE}/categories/${categoryId}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      logInfo(`Deleted category ${categoryId}`);

      return true;
    } else {
      logError('Failed to create profile with image');
      return false;
    }

  } catch (error) {
    logError(`Profile creation failed: ${error.message}`);
    console.error(error.response?.data || error.message);

    // Cleanup on error
    try {
      if (profileId) {
        await axios.delete(`${ADMIN_BASE}/profiles/${profileId}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
      }
      if (subcategoryId) {
        await axios.delete(`${ADMIN_BASE}/subcategories/${subcategoryId}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
      }
      if (categoryId) {
        await axios.delete(`${ADMIN_BASE}/categories/${categoryId}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
      }
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    return false;
  }
}

async function runTests() {
  log('\n' + '█'.repeat(60), 'cyan');
  log('   BECOMETRY IMAGE UPLOAD TEST SUITE', 'cyan');
  log('█'.repeat(60) + '\n', 'cyan');

  const results = {
    total: 3,
    passed: 0,
    failed: 0
  };

  // Test 1: Login
  const loginSuccess = await testAdminLogin();
  if (!loginSuccess) {
    logError('Cannot proceed without successful login');
    results.failed = results.total;
  } else {
    results.passed++;

    // Test 2: Image Upload
    const uploadedUrl = await testImageUpload();
    if (uploadedUrl) {
      results.passed++;

      // Test 3: Create Profile with Image
      const profileSuccess = await testProfileWithImage(uploadedUrl);
      if (profileSuccess) {
        results.passed++;
      } else {
        results.failed++;
      }
    } else {
      results.failed += 2; // Upload and profile tests failed
    }
  }

  // Summary
  logSection('TEST SUMMARY');
  log(`Total Tests: ${results.total}`, 'blue');
  log(`Passed: ${results.passed}`, 'green');
  log(`Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');

  const successRate = ((results.passed / results.total) * 100).toFixed(2);
  log(`Success Rate: ${successRate}%`, successRate === '100.00' ? 'green' : 'yellow');

  if (results.passed === results.total) {
    log('\n🎉 All image upload tests passed! 🎉\n', 'green');
  } else {
    log('\n⚠️  Some tests failed. Please review the output above.\n', 'yellow');
  }
}

// Run the tests
runTests().catch(error => {
  logError(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
