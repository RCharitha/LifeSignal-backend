const mysql = require('mysql2');
const dotenv = require('dotenv');

dotenv.config();

// Create connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Promisify pool queries
const promisePool = pool.promise();

// Create necessary tables
const createTables = async () => {
  try {
    // Create users table
    await promisePool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        fullName VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        phone VARCHAR(15) NOT NULL,
        password VARCHAR(255) NOT NULL,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        isVerified BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_phone (phone)
      )
    `);
    console.log('✅ Users table ready');

    // Create emergency_contacts table
    await promisePool.query(`
      CREATE TABLE IF NOT EXISTS emergency_contacts (
        id INT PRIMARY KEY AUTO_INCREMENT,
        userId INT NOT NULL,
        contactName VARCHAR(100) NOT NULL,
        contactPhone VARCHAR(15) NOT NULL,
        contactEmail VARCHAR(100),
        relationship VARCHAR(50),
        isPrimary BOOLEAN DEFAULT FALSE,
        contactOrder INT DEFAULT 1,
        receiveSMS BOOLEAN DEFAULT TRUE,
        receiveCall BOOLEAN DEFAULT FALSE,
        consentGiven BOOLEAN DEFAULT FALSE,
        consentDate TIMESTAMP NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_userId (userId),
        INDEX idx_phone (contactPhone)
      )
    `);
    console.log('✅ Emergency contacts table ready');

    // Create sos_alerts table
    await promisePool.query(`
      CREATE TABLE IF NOT EXISTS sos_alerts (
        id INT PRIMARY KEY AUTO_INCREMENT,
        userId INT NOT NULL,
        emergencyType VARCHAR(50),
        impactLevel VARCHAR(20),
        priority VARCHAR(20),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        status ENUM('active', 'resolved', 'cancelled') DEFAULT 'active',
        alertSentCount INT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolvedAt TIMESTAMP NULL,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_status (status),
        INDEX idx_createdAt (createdAt)
      )
    `);
    console.log('✅ SOS alerts table ready');

  } catch (error) {
    console.error('Error creating tables:', error.message);
  }
};

// Connect to database function
const connectDB = async () => {
  try {
    // Test connection
    const connection = await promisePool.getConnection();
    console.log('✅ MySQL Database connected successfully');
    
    // Create tables
    await createTables();
    
    connection.release();
    return promisePool;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error;
  }
};

// Export both the promise pool and the connectDB function
// Export both the promise pool and the connectDB function
module.exports = promisePool;
module.exports.connectDB = connectDB;
// Remove the duplicate module.exports = promisePool