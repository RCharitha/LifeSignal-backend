const twilio = require('twilio');

// Add these to your .env file:
// TWILIO_ACCOUNT_SID=your_account_sid
// TWILIO_AUTH_TOKEN=your_auth_token
// TWILIO_PHONE_NUMBER=+1234567890

const sendSMS = async (toNumber, message) => {
  try {
    // Check if Twilio credentials are configured
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      console.log('📱 Demo mode: SMS would be sent to:', toNumber);
      console.log('📝 Message:', message);
      return { success: true, demo: true };
    }
    
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    
    const result = await client.messages.create({
      body: message,
      to: toNumber,
      from: process.env.TWILIO_PHONE_NUMBER
    });
    
    return { success: true, sid: result.sid };
  } catch (error) {
    console.error('SMS sending failed:', error);
    return { success: false, error: error.message };
  }
};

const sendBulkSMS = async (contacts, message) => {
  const results = [];
  for (const contact of contacts) {
    const result = await sendSMS(contact.contactPhone, message);
    results.push({ contact: contact.contactName, ...result });
  }
  return results;
};

module.exports = { sendSMS, sendBulkSMS };