import postgres from 'postgres';
import bcrypt from 'bcrypt';

async function createUsers() {
  console.log('🔐 사용자 계정 생성 시작...');
  
  // 환경 변수에서 데이터베이스 URL 가져오기
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres.jgmvbfsibipqrvtvtxiy:rnrghks177300@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres';
  
  console.log('📡 데이터베이스 연결 중...');
  const sql = postgres(databaseUrl, {
    ssl: 'require',
    connection: {
      application_name: 'user_creation_script'
    }
  });

  try {
    // 사용자 테이블 구조 확인
    console.log('🔍 사용자 테이블 구조 확인 중...');
    const tables = await sql`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%user%' 
      ORDER BY table_name, ordinal_position;
    `;
    
    console.log('📋 사용자 관련 테이블:', tables);

    // users 테이블이 있는지 확인
    const userTableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `;

    if (!userTableExists[0].exists) {
      console.log('❌ users 테이블이 존재하지 않습니다.');
      console.log('📝 users 테이블을 생성합니다...');
      
      await sql`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          role VARCHAR(50) DEFAULT 'user',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;
      
      console.log('✅ users 테이블 생성 완료');
    }

    // 기존 사용자 확인
    console.log('👥 기존 사용자 확인 중...');
    const existingUsers = await sql`SELECT username FROM users`;
    console.log('기존 사용자:', existingUsers.map(u => u.username));

    // 관리자 계정들 생성
    const adminAccounts = [
      {
        username: 'lee.kkhwan@gmail.com',
        password: 'test123',
        role: 'admin'
      },
      {
        username: 'keywordsolution',
        password: 'test123',
        role: 'admin'
      }
    ];

    for (const account of adminAccounts) {
      // 이미 존재하는지 확인
      const existingUser = await sql`SELECT id FROM users WHERE username = ${account.username}`;
      
      if (existingUser.length > 0) {
        console.log(`⚠️  사용자 '${account.username}'이 이미 존재합니다.`);
        continue;
      }

      // 비밀번호 해시화
      console.log(`🔐 사용자 '${account.username}' 생성 중...`);
      const hashedPassword = await bcrypt.hash(account.password, 10);
      
      // 사용자 생성
      const newUser = await sql`
        INSERT INTO users (username, password, role)
        VALUES (${account.username}, ${hashedPassword}, ${account.role})
        RETURNING id, username, role;
      `;
      
      console.log(`✅ 사용자 생성 완료:`, newUser[0]);
    }

    // 최종 사용자 목록 확인
    console.log('📊 최종 사용자 목록:');
    const allUsers = await sql`SELECT id, username, role, created_at FROM users ORDER BY id`;
    allUsers.forEach(user => {
      console.log(`  - ID: ${user.id}, 사용자명: ${user.username}, 역할: ${user.role}, 생성일: ${user.created_at}`);
    });

    console.log('🎉 모든 사용자 계정 생성 완료!');

  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    await sql.end();
    console.log('🔌 데이터베이스 연결 종료');
  }
}

// 스크립트 실행
createUsers().catch(console.error);
