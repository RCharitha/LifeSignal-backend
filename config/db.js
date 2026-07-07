const mysql = require('mysql2');
const dotenv = require('dotenv');

dotenv.config();

// Create connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const promisePool = pool.promise();

// Create necessary tables
const createTables = async () => {
  try {

    // ================= USERS TABLE =================
    await promisePool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT NOT NULL AUTO_INCREMENT,
        fullName VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        phone VARCHAR(15) NOT NULL,
        password VARCHAR(255) NOT NULL,
        latitude DECIMAL(10,8) DEFAULT NULL,
        longitude DECIMAL(11,8) DEFAULT NULL,
        isVerified TINYINT(1) DEFAULT 0,
        createdAt TIMESTAMP NULL DEFAULT NULL,
        updatedAt TIMESTAMP NULL DEFAULT NULL,
        PRIMARY KEY (id),
        INDEX idx_email (email),
        INDEX idx_phone (phone)
      )
    `);

    console.log("✅ Users table ready");


    // ================= EMERGENCY CONTACTS =================
    await promisePool.query(`
      CREATE TABLE IF NOT EXISTS emergency_contacts (
        id INT NOT NULL AUTO_INCREMENT,
        userId INT NOT NULL,
        contactName VARCHAR(100) NOT NULL,
        contactPhone VARCHAR(15) NOT NULL,
        contactEmail VARCHAR(100),
        relationship VARCHAR(50),
        isPrimary TINYINT(1) DEFAULT 0,
        contactOrder INT DEFAULT 1,
        receiveSMS TINYINT(1) DEFAULT 1,
        receiveCall TINYINT(1) DEFAULT 0,
        consentGiven TINYINT(1) DEFAULT 0,
        consentDate TIMESTAMP NULL DEFAULT NULL,
        createdAt TIMESTAMP NULL DEFAULT NULL,
        updatedAt TIMESTAMP NULL DEFAULT NULL,
        PRIMARY KEY (id),
        INDEX idx_userId (userId),
        INDEX idx_phone (contactPhone),
        CONSTRAINT fk_user
        FOREIGN KEY (userId)
        REFERENCES users(id)
        ON DELETE CASCADE
      )
    `);

    console.log("✅ Emergency contacts table ready");


    // ================= SOS ALERTS =================
    await promisePool.query(`
      CREATE TABLE IF NOT EXISTS sos_alerts (
        id INT NOT NULL AUTO_INCREMENT,
        userId INT NOT NULL,
        emergencyType VARCHAR(50),
        impactLevel VARCHAR(20),
        priority VARCHAR(20),
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8),
        status ENUM('active','resolved','cancelled') DEFAULT 'active',
        alertSentCount INT DEFAULT 0,
        createdAt TIMESTAMP NULL DEFAULT NULL,
        resolvedAt TIMESTAMP NULL DEFAULT NULL,
        PRIMARY KEY (id),
        INDEX idx_status (status),
        INDEX idx_createdAt (createdAt),
        CONSTRAINT fk_alert_user
        FOREIGN KEY (userId)
        REFERENCES users(id)
        ON DELETE CASCADE
      )
    `);

    console.log("✅ SOS alerts table ready");

  } catch (error) {
    console.error("❌ Error creating tables:", error.message);
    throw error;
  }
};

// Connect to database
const connectDB = async () => {
  try {
    const connection = await promisePool.getConnection();

    console.log("✅ MySQL Database connected successfully");

    await createTables();

    connection.release();

    return promisePool;

  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    throw error;
  }
};

module.exports = promisePool;
module.exports.connectDB = connectDB;