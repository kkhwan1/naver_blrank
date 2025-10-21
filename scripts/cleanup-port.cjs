const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function cleanupPort(port = 5000) {
  try {
    console.log(`🔍 Checking port ${port}...`);

    // netstat으로 포트 사용 프로세스 찾기
    let stdout;
    try {
      const result = await execPromise(`netstat -ano | findstr :${port}`);
      stdout = result.stdout;
    } catch (error) {
      // findstr이 매칭 결과를 찾지 못하면 에러 코드 1을 반환
      if (error.code === 1 && !error.stdout.trim()) {
        console.log(`✅ Port ${port} is available`);
        return true;
      }
      throw error;
    }

    if (!stdout || !stdout.trim()) {
      console.log(`✅ Port ${port} is available`);
      return true;
    }

    console.log(`⚠️  Port ${port} is in use. Cleaning up...`);

    // PID 추출 및 종료
    const lines = stdout.split('\n');
    const pids = new Set();

    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0' && !isNaN(pid)) {
        pids.add(pid);
      }
    });

    if (pids.size === 0) {
      console.log(`✅ Port ${port} is available`);
      return true;
    }

    for (const pid of pids) {
      console.log(`🔪 Killing process ${pid}...`);
      try {
        await execPromise(`taskkill //F //PID ${pid}`);
      } catch (killError) {
        console.log(`   ⚠️  Could not kill process ${pid} (may already be dead)`);
      }
    }

    // 포트 해제 대기 (최대 5초)
    console.log(`⏳ Waiting for port ${port} to be released...`);
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        const { stdout: check } = await execPromise(`netstat -ano | findstr :${port}`);
        if (!check || !check.trim()) {
          console.log(`✅ Port ${port} released successfully`);
          return true;
        }
      } catch (error) {
        // findstr이 결과를 찾지 못하면 포트가 해제된 것
        if (error.code === 1) {
          console.log(`✅ Port ${port} released successfully`);
          return true;
        }
      }
    }

    console.error(`❌ Port ${port} still in use after cleanup`);
    return false;
  } catch (error) {
    console.error(`❌ Cleanup failed:`, error.message);
    return false;
  }
}

module.exports = { cleanupPort };

// CLI 실행 시
if (require.main === module) {
  const port = parseInt(process.argv[2]) || 6000;
  cleanupPort(port).then(success => {
    process.exit(success ? 0 : 1);
  });
}
