const db = require('../config/db');

class User {
  // Create new user
  static async create(userData) {
    const { fullName, email, phone, password, latitude, longitude } = userData;
    
    const [result] = await db.query(
      `INSERT INTO users (fullName, email, phone, password, latitude, longitude) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [fullName, email, phone, password, latitude || null, longitude || null]
    );
    
    return result.insertId;
  }

  // Find user by email
  static async findByEmail(email) {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0];
  }

  // Find user by ID
  static async findById(id) {
    const [rows] = await db.query('SELECT id, fullName, email, phone, latitude, longitude, isVerified, createdAt FROM users WHERE id = ?', [id]);
    return rows[0];
  }

  // Find user by phone
  static async findByPhone(phone) {
    const [rows] = await db.query('SELECT * FROM users WHERE phone = ?', [phone]);
    return rows[0];
  }

  // Update user location
  static async updateLocation(userId, latitude, longitude) {
    const [result] = await db.query(
      'UPDATE users SET latitude = ?, longitude = ? WHERE id = ?',
      [latitude, longitude, userId]
    );
    return result.affectedRows > 0;
  }

  // Verify user email
  static async verifyUser(userId) {
    const [result] = await db.query(
      'UPDATE users SET isVerified = TRUE WHERE id = ?',
      [userId]
    );
    return result.affectedRows > 0;
  }

  // Update user password
  static async updatePassword(userId, newPassword) {
    const [result] = await db.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [newPassword, userId]
    );
    return result.affectedRows > 0;
  }

  // Get all users (for admin)
  static async getAllUsers(limit = 100, offset = 0) {
    const [rows] = await db.query(
      'SELECT id, fullName, email, phone, latitude, longitude, isVerified, createdAt FROM users LIMIT ? OFFSET ?',
      [limit, offset]
    );
    return rows;
  }

  // Delete user
  static async deleteUser(userId) {
    const [result] = await db.query('DELETE FROM users WHERE id = ?', [userId]);
    return result.affectedRows > 0;
  }
}

module.exports = User;