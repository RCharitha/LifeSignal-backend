const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/userModel');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    console.log("📝 Registration request received:", req.body);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { fullName, email, phone, password, latitude, longitude } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    const existingPhone = await User.findByPhone(phone);
    if (existingPhone) {
      return res.status(400).json({ message: 'Phone number already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    console.log("🔐 Original password:", password);
    console.log("🔐 Hashed password:", hashedPassword);

    // Create user
    const userId = await User.create({
      fullName,
      email,
      phone,
      password: hashedPassword,
      latitude,
      longitude
    });

    console.log("✅ User created successfully with ID:", userId);

    const token = generateToken(userId);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: userId,
        fullName,
        email,
        phone,
        latitude,
        longitude
      }
    });
  } catch (error) {
    console.error("❌ Registration error:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    console.log("🔑 Login request received:", req.body);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findByEmail(email);
    if (!user) {
      console.log("❌ User not found with email:", email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log("✅ User found:", user.email);
    console.log("📦 Stored password hash:", user.password);
    console.log("🔑 Provided password:", password);

    // Check password
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    console.log("🔐 Password match result:", isPasswordMatch);

    if (!isPasswordMatch) {
      console.log("❌ Password does not match");
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log("✅ Login successful for:", user.email);

    // Generate token
    const token = generateToken(user.id);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        latitude: user.latitude,
        longitude: user.longitude,
        isVerified: user.isVerified
      }
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update user location
// @route   PUT /api/auth/location
// @access  Private
const updateLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    const updated = await User.updateLocation(req.user.id, latitude, longitude);
    
    if (!updated) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ success: true, message: 'Location updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update user password
// @route   PUT /api/auth/password
// @access  Private
const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Please provide current and new password' });
    }

    const user = await User.findByEmail(req.user.email);
    
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    await User.updatePassword(req.user.id, hashedPassword);
    
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  updateLocation,
  updatePassword
};