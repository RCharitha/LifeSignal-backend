const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { connectDB } = require('./config/db');
const http = require('http');
const socketIo = require('socket.io');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Make io accessible to routes
app.set('io', io);

// Store active users with their locations
const activeUsers = new Map();

// ============ HELPER FUNCTIONS (MOVE HERE - BEFORE initializeApp) ============
// Haversine formula to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Helper function to send alerts to nearby users
global.sendNearbyAlert = async (senderId, senderName, emergencyType, impactLevel, latitude, longitude, message) => {
  const alertsSent = [];
  
  console.log(`📢 Sending alerts from ${senderName} at (${latitude}, ${longitude})`);
  console.log(`📢 Active users count: ${activeUsers.size}`);
  
  for (const [socketId, user] of activeUsers.entries()) {
    // Don't send alert to the sender
    if (user.userId === senderId) continue;
    
    // Calculate distance
    const distance = calculateDistance(latitude, longitude, user.latitude, user.longitude);
    
    console.log(`📍 Distance to ${user.fullName}: ${distance.toFixed(2)} km`);
    
    // Send alert to users within 10km
    if (distance <= 10) {
      const alertData = {
        from: senderName,
        emergencyType: emergencyType || 'General Emergency',
        impactLevel: impactLevel || 'High',
        distance: distance.toFixed(2),
        distanceText: distance < 1 ? `${(distance * 1000).toFixed(0)} meters away` : `${distance.toFixed(2)} km away`,
        message: message,
        timestamp: new Date().toISOString()
      };
      
      io.to(socketId).emit('sos-alert', alertData);
      alertsSent.push({
        to: user.fullName,
        distance: distance.toFixed(2)
      });
      
      console.log(`📢 Alert sent to ${user.fullName} (${distance.toFixed(2)} km away)`);
    }
  }
  
  console.log(`✅ Total alerts sent: ${alertsSent.length}`);
  return alertsSent;
};
// ============ END HELPER FUNCTIONS ============

io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);
  
  socket.on('register-user', (data) => {
    const { userId, latitude, longitude, fullName } = data;
    activeUsers.set(socket.id, {
      userId,
      socketId: socket.id,
      latitude,
      longitude,
      fullName,
      lastSeen: new Date()
    });
    console.log(`✅ User ${fullName} (${userId}) registered for alerts`);
  });
  
  socket.on('update-location', (data) => {
    if (activeUsers.has(socket.id)) {
      const user = activeUsers.get(socket.id);
      user.latitude = data.latitude;
      user.longitude = data.longitude;
      user.lastSeen = new Date();
      activeUsers.set(socket.id, user);
      console.log(`📍 Location updated for ${user.fullName}`);
    }
  });
  
  socket.on('disconnect', () => {
    if (activeUsers.has(socket.id)) {
      const user = activeUsers.get(socket.id);
      console.log(`🔴 User ${user.fullName} disconnected`);
      activeUsers.delete(socket.id);
    }
  });
});

// Initialize database connection
const initializeApp = async () => {
  try {
    await connectDB();
    console.log('Database initialized successfully');
    
    // Routes
    app.use('/api/auth', require('./routes/authRoutes'));
    
    // Basic route
    app.get('/', (req, res) => {
      res.json({ message: 'Emergency Response Network API' });
    });
    
    // Error handling middleware
    app.use((err, req, res, next) => {
      console.error(err.stack);
      res.status(500).json({ message: 'Something went wrong!', error: err.message });
    });
    
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`WebSocket server ready for real-time alerts`);
    });
  } catch (error) {
    console.error('Failed to initialize app:', error);
    process.exit(1);
  }
};

initializeApp();