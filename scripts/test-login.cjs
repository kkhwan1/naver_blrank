const http = require('http');

async function testLogin(username, password) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ username, password });

    const options = {
      hostname: 'localhost',
      port: 6000,
      path: '/api/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      const cookies = res.headers['set-cookie'] || [];

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = {
            statusCode: res.statusCode,
            body: data ? JSON.parse(data) : {},
            cookies: cookies
          };
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function testProtectedEndpoint(sessionCookie) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 6000,
      path: '/api/user',
      method: 'GET',
      headers: {
        'Cookie': sessionCookie
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = {
            statusCode: res.statusCode,
            body: data ? JSON.parse(data) : {}
          };
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function runTests() {
  console.log('');
  console.log('🧪 Starting Automated Login Tests');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const testResults = {
    admin1: { success: false, details: {} },
    admin2: { success: false, details: {} },
    sessionPersistence: { success: false, details: {} }
  };

  // Test 1: Admin Account 1
  console.log('📍 Test 1: Admin Account (lee.kkhwan@gmail.com)');
  try {
    const result1 = await testLogin('lee.kkhwan@gmail.com', 'test123');
    testResults.admin1.details = result1;

    if (result1.statusCode === 200 && result1.body.id && result1.cookies.length > 0) {
      testResults.admin1.success = true;
      console.log('   ✅ Login successful');
      console.log(`   📧 User ID: ${result1.body.id}`);
      console.log(`   🍪 Session cookie set: ${result1.cookies[0].substring(0, 50)}...`);
    } else {
      console.log('   ❌ Login failed');
      console.log(`   Status: ${result1.statusCode}`);
      console.log(`   Body: ${JSON.stringify(result1.body)}`);
    }
  } catch (error) {
    console.log('   ❌ Test failed:', error.message);
    testResults.admin1.details = { error: error.message };
  }
  console.log('');

  // Test 2: Admin Account 2
  console.log('📍 Test 2: Admin Account (keywordsolution)');
  try {
    const result2 = await testLogin('keywordsolution', 'test123');
    testResults.admin2.details = result2;

    if (result2.statusCode === 200 && result2.body.id && result2.cookies.length > 0) {
      testResults.admin2.success = true;
      console.log('   ✅ Login successful');
      console.log(`   📧 User ID: ${result2.body.id}`);
      console.log(`   🍪 Session cookie set: ${result2.cookies[0].substring(0, 50)}...`);
    } else {
      console.log('   ❌ Login failed');
      console.log(`   Status: ${result2.statusCode}`);
      console.log(`   Body: ${JSON.stringify(result2.body)}`);
    }
  } catch (error) {
    console.log('   ❌ Test failed:', error.message);
    testResults.admin2.details = { error: error.message };
  }
  console.log('');

  // Test 3: Session Persistence
  if (testResults.admin1.success) {
    console.log('📍 Test 3: Session Persistence');
    try {
      const sessionCookie = testResults.admin1.details.cookies[0];
      const result3 = await testProtectedEndpoint(sessionCookie);
      testResults.sessionPersistence.details = result3;

      if (result3.statusCode === 200 && result3.body.id) {
        testResults.sessionPersistence.success = true;
        console.log('   ✅ Session persisted successfully');
        console.log(`   👤 User authenticated as: ${result3.body.username}`);
        console.log(`   🔐 Role: ${result3.body.role}`);
      } else {
        console.log('   ❌ Session persistence failed');
        console.log(`   Status: ${result3.statusCode}`);
        console.log(`   Body: ${JSON.stringify(result3.body)}`);
      }
    } catch (error) {
      console.log('   ❌ Test failed:', error.message);
      testResults.sessionPersistence.details = { error: error.message };
    }
  } else {
    console.log('📍 Test 3: Session Persistence (Skipped - no valid session)');
  }
  console.log('');

  // Final Report
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Test Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`Admin Account 1:     ${testResults.admin1.success ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Admin Account 2:     ${testResults.admin2.success ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Session Persistence: ${testResults.sessionPersistence.success ? '✅ PASS' : '❌ FAIL'}`);
  console.log('');

  const allPassed = testResults.admin1.success &&
                    testResults.admin2.success &&
                    testResults.sessionPersistence.success;

  if (allPassed) {
    console.log('🎉 All tests passed! Supabase migration successful!');
    console.log('');
    console.log('✅ Database: Supabase PostgreSQL');
    console.log('✅ Authentication: Working');
    console.log('✅ Session Management: Working');
    console.log('✅ Admin Accounts: Both functional');
  } else {
    console.log('⚠️  Some tests failed. Review details above.');
  }
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  process.exit(allPassed ? 0 : 1);
}

runTests();
