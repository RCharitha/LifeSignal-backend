const express = require('express');
const { body } = require('express-validator');
const { 
  registerUser, 
  loginUser, 
  getMe, 
  updateLocation,
  updatePassword 
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Validation rules
const registerValidation = [
  body('fullName').notEmpty().withMessage('Full name is required').trim(),
  body('email').isEmail().withMessage('Please provide a valid email').normalizeEmail(),
  body('phone').isLength({ min: 10, max: 15 }).withMessage('Phone number must be 10-15 digits'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('latitude').optional().isFloat({ min: -90, max: 90 }),
  body('longitude').optional().isFloat({ min: -180, max: 180 })
];

const loginValidation = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
];

// ==================== PUBLIC ROUTES ====================
router.post('/register', registerValidation, registerUser);
router.post('/login', loginValidation, loginUser);

// ==================== PROTECTED ROUTES ====================
// User Routes
router.get('/me', protect, getMe);
router.put('/location', protect, updateLocation);
router.put('/password', protect, updatePassword);

// Emergency Contacts Routes
router.post('/contacts/add', protect, async (req, res) => {
  try {
    const { userId, contacts } = req.body;
    const db = require('../config/db');
    
    await db.query('DELETE FROM emergency_contacts WHERE userId = ?', [userId]);
    
    for (const contact of contacts) {
      await db.query(
        `INSERT INTO emergency_contacts (userId, contactName, contactPhone, contactEmail, relationship, isPrimary, contactOrder) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, contact.name, contact.phone, contact.email, contact.relationship, contact.isPrimary, contact.contactOrder]
      );
    }
    
    res.json({ success: true, message: 'Contacts saved successfully' });
  } catch (error) {
    console.error('Error saving contacts:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/contacts', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const db = require('../config/db');
    
    const [contacts] = await db.query(
      `SELECT id, contactName, contactPhone, contactEmail, relationship, isPrimary, contactOrder 
       FROM emergency_contacts 
       WHERE userId = ? 
       ORDER BY contactOrder ASC`,
      [userId]
    );
    
    res.json({ success: true, contacts });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ message: 'Failed to fetch contacts' });
  }
});

// Nearby Users Route
router.get('/nearby-users', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { latitude, longitude } = req.query;
    const db = require('../config/db');
    
    const [user] = await db.query(
      'SELECT latitude, longitude FROM users WHERE id = ?',
      [userId]
    );
    
    let userLat = latitude || user[0]?.latitude;
    let userLng = longitude || user[0]?.longitude;
    
    if (!userLat || !userLng) {
      return res.json({ 
        success: true, 
        nearbyUsers: [],
        message: 'Location not available'
      });
    }
    
    const [nearbyUsers] = await db.query(`
      SELECT 
        id,
        fullName,
        phone,
        latitude,
        longitude,
        (
          6371 * acos(
            cos(radians(?)) * cos(radians(latitude)) *
            cos(radians(longitude) - radians(?)) +
            sin(radians(?)) * sin(radians(latitude))
          )
        ) AS distance_km
      FROM users
      WHERE id != ?
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
        AND (
          6371 * acos(
            cos(radians(?)) * cos(radians(latitude)) *
            cos(radians(longitude) - radians(?)) +
            sin(radians(?)) * sin(radians(latitude))
          )
        ) <= 10
      ORDER BY distance_km ASC
      LIMIT 20
    `, [userLat, userLng, userLat, userId, userLat, userLng, userLat]);
    
    const formattedUsers = nearbyUsers.map(user => ({
      id: user.id,
      name: user.fullName,
      phone: user.phone,
      distance: user.distance_km.toFixed(2),
      distanceText: user.distance_km < 1 
        ? `${(user.distance_km * 1000).toFixed(0)} meters away`
        : `${user.distance_km.toFixed(2)} km away`
    }));
    
    res.json({ 
      success: true, 
      nearbyUsers: formattedUsers,
      totalNearby: formattedUsers.length
    });
    
  } catch (error) {
    console.error('Error fetching nearby users:', error);
    res.status(500).json({ message: 'Failed to fetch nearby users', error: error.message });
  }
});

// SOS Routes
router.post('/sos/send', protect, async (req, res) => {
  try {
    const { emergencyType, impactLevel, priority, alertCount, location, message } = req.body;
    const userId = req.user.id;
    const db = require('../config/db');
    
    console.log('🚨 SOS Alert received:', {
      userId,
      emergencyType,
      impactLevel,
      priority,
      alertCount,
      location
    });
    
    const [sender] = await db.query(
      'SELECT fullName, phone, latitude, longitude FROM users WHERE id = ?',
      [userId]
    );
    
    const [result] = await db.query(
      `INSERT INTO sos_alerts (userId, emergencyType, impactLevel, priority, latitude, longitude, alertSentCount, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
      [userId, emergencyType, impactLevel, priority, location?.lat, location?.lng, alertCount]
    );
    
    const alertId = result.insertId;
    
    const [contacts] = await db.query(
      `SELECT contactName, contactPhone, relationship, isPrimary 
       FROM emergency_contacts 
       WHERE userId = ? AND receiveSMS = TRUE`,
      [userId]
    );
    
    const alertMessage = `🚨 EMERGENCY! ${sender[0].fullName} needs help!\n\nType: ${emergencyType || 'Emergency'}\nPriority: ${priority || 'HIGH'}\n\n📍 Location: https://maps.google.com/?q=${location?.lat},${location?.lng}`;
    
    let nearbyAlertsSent = [];
    if (global.sendNearbyAlert) {
      nearbyAlertsSent = await global.sendNearbyAlert(
        userId,
        sender[0].fullName,
        emergencyType,
        impactLevel,
        location?.lat,
        location?.lng,
        alertMessage
      );
    }
    
    console.log(`📢 Nearby alerts sent to ${nearbyAlertsSent.length} people`);
    
    res.json({ 
      success: true, 
      message: 'SOS alert sent successfully',
      alertId: alertId,
      contactsNotified: contacts.length,
      nearbyNotified: nearbyAlertsSent.length,
      nearbyAlerts: nearbyAlertsSent
    });
    
  } catch (error) {
    console.error('❌ SOS error:', error);
    res.status(500).json({ message: 'Failed to send SOS alert', error: error.message });
  }
});

router.get('/sos/history', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const db = require('../config/db');
    
    const [alerts] = await db.query(
      `SELECT * FROM sos_alerts 
       WHERE userId = ? 
       ORDER BY createdAt DESC 
       LIMIT 50`,
      [userId]
    );
    
    res.json({ success: true, alerts });
  } catch (error) {
    console.error('Error fetching SOS history:', error);
    res.status(500).json({ message: 'Failed to fetch SOS history' });
  }
});

module.exports = router;