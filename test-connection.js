require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ Database connection successful!');
    
    const result = await client.query('SELECT version()');
    console.log('PostgreSQL version:', result.rows[0].version);
    
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log('\nExisting tables:', tables.rows.map(r => r.table_name));
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
