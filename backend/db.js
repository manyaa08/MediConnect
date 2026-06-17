const { Pool } = require("pg");
require("dotenv").config();

const poolConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.PGHOST || process.env.DB_HOST || "localhost",
      user: process.env.PGUSER || process.env.DB_USER || "postgres",
      password: process.env.PGPASSWORD || process.env.DB_PASSWORD,
      database: process.env.PGDATABASE || process.env.DB_NAME || "mediconnect",
      port: process.env.PGPORT || process.env.DB_PORT || 5432,
    };

// Pool settings
poolConfig.max = parseInt(process.env.PGMAXPOOL || "10", 10);
poolConfig.idleTimeoutMillis = parseInt(process.env.PGIDLETIMEOUT || "30000", 10);
poolConfig.connectionTimeoutMillis = parseInt(process.env.PGCONNECTTIMEOUT || "2000", 10);

const db = new Pool(poolConfig);

// test connection
db.connect((err, client, release) => {
  if (err) {
    console.error("❌ DB Connection Failed:", err);
  } else {
    console.log("✅ PostgreSQL Pool Connected successfully to database:", poolConfig.database || "PostgreSQL");
    release();
  }
});

module.exports = db;