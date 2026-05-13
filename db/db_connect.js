const mysql = require('mysql2');
require('dotenv').config();

const db_TGAT = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8',
});

db_TGAT.getConnection((err, connection) => {
  if (err) {
    console.error('❌❌❌ could not connect to TGAT database ❌❌❌');
    console.error(err);
    process.exit(1);
  }

  console.log('✅ Connected to database');

  connection.release();
});

module.exports = db_TGAT;