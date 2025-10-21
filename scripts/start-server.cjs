const { spawn } = require('child_process');
const { cleanupPort } = require('./cleanup-port.cjs');
const http = require('http');

async function startServer() {
  console.log('');
  console.log('🚀 Starting Naver Blog Rank Tracker...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // Step 1: 포트 정리
  console.log('📍 Step 1: Cleaning up port 6000...');
  const portClean = await cleanupPort(6000);
  if (!portClean) {
    console.error('');
    console.error('❌ Failed to clean up port 6000');
    console.error('   Please manually kill processes using port 6000');
    console.error('');
    process.exit(1);
  }
  console.log('');

  // Step 2: 서버 시작
  console.log('📍 Step 2: Starting server...');
  const serverProcess = spawn('npx', ['tsx', 'server/index.ts'], {
    stdio: 'pipe',
    shell: true,
    env: { ...process.env, NODE_ENV: 'development' }
  });

  let serverOutput = '';
  let serverError = '';

  serverProcess.stdout.on('data', (data) => {
    const output = data.toString();
    serverOutput += output;
    process.stdout.write(output);
  });

  serverProcess.stderr.on('data', (data) => {
    const error = data.toString();
    serverError += error;
    process.stderr.write(error);
  });

  serverProcess.on('close', (code) => {
    console.log('');
    console.log(`⚠️  Server process exited with code ${code}`);
    console.log('');
    process.exit(code);
  });

  // Step 3: 헬스체크 (최대 15초 대기)
  console.log('');
  console.log('📍 Step 3: Waiting for server to start...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  let serverHealthy = false;
  for (let i = 0; i < 15; i++) {
    try {
      const isHealthy = await healthCheck();
      if (isHealthy) {
        serverHealthy = true;
        console.log('✅ Server is healthy!');
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log('🌐 Server running at http://localhost:6000');
        console.log('');
        console.log('📊 Admin accounts:');
        console.log('   - lee.kkhwan@gmail.com / test123');
        console.log('   - keywordsolution / test123');
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log('💡 Press Ctrl+C to stop the server');
        console.log('');
        break;
      }
    } catch (error) {
      // 서버가 아직 시작되지 않았거나 응답하지 않음
      if (i === 14) {
        console.error('');
        console.error('❌ Server failed to start within 15 seconds');
        console.error('');
        console.error('Server output:');
        console.error(serverOutput);
        console.error('');
        console.error('Server errors:');
        console.error(serverError);
        console.error('');
        serverProcess.kill();
        process.exit(1);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  if (!serverHealthy) {
    console.error('❌ Server health check failed');
    serverProcess.kill();
    process.exit(1);
  }

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('');
    console.log('');
    console.log('🛑 Shutting down server...');
    serverProcess.kill();
    process.exit(0);
  });

  // Windows에서도 Ctrl+C 처리
  process.on('SIGTERM', () => {
    console.log('');
    console.log('');
    console.log('🛑 Shutting down server...');
    serverProcess.kill();
    process.exit(0);
  });
}

function healthCheck() {
  return new Promise((resolve, reject) => {
    const req = http.get('http://localhost:6000/api/user', (res) => {
      // 401 (Unauthorized) 또는 200 (OK)이면 서버가 정상 작동 중
      if (res.statusCode === 401 || res.statusCode === 200) {
        resolve(true);
      } else {
        reject(new Error(`Unexpected status code: ${res.statusCode}`));
      }
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(2000, () => {
      req.destroy();
      reject(new Error('Health check timeout'));
    });
  });
}

// 에러 핸들링
process.on('unhandledRejection', (error) => {
  console.error('');
  console.error('❌ Unhandled error:', error);
  console.error('');
  process.exit(1);
});

startServer();
