const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB Atlas'))
.catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});

// User schema
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    area: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    bloodGroup: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Blood Bank schema
const bloodBankSchema = new mongoose.Schema({
    name: { type: String, required: true },
    address: { type: String, required: true },
    phone: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    area: { type: String, required: true }
});

const BloodBank = mongoose.model('BloodBank', bloodBankSchema);

// Hospital schema
const hospitalSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    area: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const Hospital = mongoose.model('Hospital', hospitalSchema);

// Blood Inventory schema
const bloodInventorySchema = new mongoose.Schema({
    bloodBank: { type: String, required: true },
    area: { type: String, required: true },
    bloodGroup: { type: String, required: true },
    units: { type: Number, required: true, min: 0 },
    minLevel: { type: Number, required: true, min: 0 },
    updatedAt: { type: Date, default: Date.now }
});

const BloodInventory = mongoose.model('BloodInventory', bloodInventorySchema);

// Twilio client
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN ? 
    twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) : null;

// JWT Authentication Middleware
const authenticateHospital = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.hospital = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Routes

// Hospital Authentication
app.post('/api/hospital/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }
        
        // For demo purposes, using environment variables
        // In production, you would query the database
        const demoUsername = process.env.HOSPITAL_USERNAME || 'hospital';
        const demoPassword = process.env.HOSPITAL_PASSWORD || 'password123';
        const demoHospitalName = process.env.HOSPITAL_NAME || 'General Hospital';
        
        if (username === demoUsername && password === demoPassword) {
            const token = jwt.sign(
                { username: demoUsername, name: demoHospitalName }, 
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );
            
            res.json({ 
                message: 'Login successful', 
                token,
                hospitalName: demoHospitalName
            });
        } else {
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/api/register-donor', async (req, res) => {
    try {
        const { name, area, phone, bloodGroup } = req.body;
        
        // Validate input
        if (!name || !area || !phone || !bloodGroup) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        
        // Validate phone number format
        const phoneRegex = /^\+91\d{10}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({ message: 'Please enter a valid 10-digit Indian phone number (e.g., +919322659210)' });
        }
        
        // Check if phone number already exists
        const existingUser = await User.findOne({ phone });
        if (existingUser) {
            return res.status(400).json({ message: 'Phone number already registered' });
        }
        
        // Create new user
        const newUser = new User({ name, area, phone, bloodGroup });
        await newUser.save();
        
        res.status(201).json({ message: 'Donor registered successfully' });
    } catch (error) {
        console.error('Registration error:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Phone number already registered' });
        }
        
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/api/send-alert', async (req, res) => {
    try {
        const { hospitalName, area, bloodGroup, additionalInfo, token } = req.body;
        
        // Validate authentication
        if (!token) {
            return res.status(401).json({ message: 'Authentication required' });
        }
        
        try {
            jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            return res.status(401).json({ message: 'Invalid authentication token' });
        }
        
        // Validate other inputs
        if (!hospitalName || !area || !bloodGroup) {
            return res.status(400).json({ message: 'Hospital name, area, and blood group are required' });
        }
        
        // Find donors in the area with matching blood group
        let query = { area };
        if (bloodGroup !== 'Any') {
            query.bloodGroup = bloodGroup;
        }
        if (area === 'All') {
            delete query.area;
        }
        
        const donors = await User.find(query);
        
        if (donors.length === 0) {
            const specificAreaMessage = area === 'All' ? 'in any area' : `in the ${area} area`;
            return res.status(404).json({ message: `No donors found with the required blood group ${specificAreaMessage}.` });
        }
        
        // Send SMS to each donor if Twilio is configured
        if (twilioClient) {
            const message = `URGENT: Blood needed at ${hospitalName} in ${area}. Blood type: ${bloodGroup}. ${additionalInfo || ''} Please help if you can.`;
            
            let successfulSends = 0;
            let failedSends = 0;
            
            for (const donor of donors) {
                try {
                    await twilioClient.messages.create({
                        body: message,
                        from: process.env.TWILIO_PHONE_NUMBER,
                        to: donor.phone
                    });
                    console.log(`Message sent to ${donor.phone}`);
                    successfulSends++;
                } catch (twilioError) {
                    console.error(`Failed to send message to ${donor.phone}:`, twilioError.message);
                    failedSends++;
                    
                    if (twilioError.code === 21211) {
                        console.log(`Removing invalid number from database: ${donor.phone}`);
                        await User.deleteOne({ phone: donor.phone });
                    }
                }
            }
            
            res.json({ 
                message: `Alert sent to ${successfulSends} donor(s). ${failedSends > 0 ? `${failedSends} failed.` : ''}`, 
                successfulSends,
                failedSends
            });
        } else {
            // Twilio not configured, just return success
            res.json({ 
                message: `Alert would be sent to ${donors.length} donor(s). Twilio not configured.`,
                successfulSends: donors.length,
                failedSends: 0
            });
        }
    } catch (error) {
        console.error('Alert error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Additional API routes for management
app.get('/api/donors', async (req, res) => {
    try {
        const { area, bloodGroup } = req.query;
        let query = {};
        
        if (area && area !== 'All') query.area = area;
        if (bloodGroup && bloodGroup !== 'All') query.bloodGroup = bloodGroup;
        
        const donors = await User.find(query).sort({ createdAt: -1 });
        res.json(donors);
    } catch (error) {
        console.error('Get donors error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.delete('/api/donor/:phone', authenticateHospital, async (req, res) => {
    try {
        const { phone } = req.params;
        const result = await User.deleteOne({ phone });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Donor not found' });
        }
        
        // Check if we need to send low stock alerts after deletion
        await checkLowStockAlerts();
        
        res.json({ message: 'Donor deleted successfully' });
    } catch (error) {
        console.error('Delete donor error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.get('/api/bloodbanks', async (req, res) => {
    try {
        const { area } = req.query;
        let query = {};
        
        if (area && area !== 'All') query.area = area;
        
        const bloodBanks = await BloodBank.find(query);
        res.json(bloodBanks);
    } catch (error) {
        console.error('Get blood banks error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Blood Inventory Routes
app.get('/api/inventory', async (req, res) => {
    try {
        const inventory = await BloodInventory.find().sort({ updatedAt: -1 });
        res.json(inventory);
    } catch (error) {
        console.error('Get inventory error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/api/inventory', authenticateHospital, async (req, res) => {
    try {
        const { bloodBank, bloodGroup, units, minLevel } = req.body;
        
        // Validate input
        if (!bloodBank || !bloodGroup || units === undefined || minLevel === undefined) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        
        // Find blood bank to get area
        const bank = await BloodBank.findOne({ name: bloodBank });
        if (!bank) {
            return res.status(404).json({ message: 'Blood bank not found' });
        }
        
        // Check if inventory item already exists
        let inventoryItem = await BloodInventory.findOne({ 
            bloodBank, 
            bloodGroup 
        });
        
        if (inventoryItem) {
            // Update existing item
            inventoryItem.units = units;
            inventoryItem.minLevel = minLevel;
            inventoryItem.updatedAt = new Date();
        } else {
            // Create new inventory item
            inventoryItem = new BloodInventory({
                bloodBank,
                area: bank.area,
                bloodGroup,
                units,
                minLevel
            });
        }
        
        await inventoryItem.save();
        
        // Check if this update triggers low stock alert
        if (units < minLevel) {
            await sendLowStockAlert(inventoryItem);
        }
        
        res.status(201).json({ message: 'Inventory updated successfully' });
    } catch (error) {
        console.error('Add inventory error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.delete('/api/inventory/:id', authenticateHospital, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await BloodInventory.findByIdAndDelete(id);
        
        if (!result) {
            return res.status(404).json({ message: 'Inventory item not found' });
        }
        
        res.json({ message: 'Inventory item deleted successfully' });
    } catch (error) {
        console.error('Delete inventory error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Low Stock Alert Functionality
async function checkLowStockAlerts() {
    try {
        const inventory = await BloodInventory.find();
        const donors = await User.find();
        
        // Group donors by area and blood group
        const donorCounts = {};
        donors.forEach(donor => {
            const key = `${donor.area}-${donor.bloodGroup}`;
            donorCounts[key] = (donorCounts[key] || 0) + 1;
        });
        
        // Check each inventory item
        for (const item of inventory) {
            const donorKey = `${item.area}-${item.bloodGroup}`;
            const donorCount = donorCounts[donorKey] || 0;
            
            if (donorCount < 10) {
                await sendLowStockAlert(item, donorCount);
            }
        }
    } catch (error) {
        console.error('Error checking low stock alerts:', error);
    }
}

async function sendLowStockAlert(inventoryItem, donorCount = null) {
    try {
        // Find donors in the same area with the same blood group
        const donors = await User.find({ 
            area: inventoryItem.area, 
            bloodGroup: inventoryItem.bloodGroup 
        });
        
        if (donors.length === 0) {
            return;
        }
        
        const message = `URGENT: Low blood stock alert for ${inventoryItem.bloodGroup} at ${inventoryItem.bloodBank} in ${inventoryItem.area}. Current stock: ${inventoryItem.units} units. Only ${donorCount || donors.length} donors available in your area. Please consider donating.`;
        
        // Send SMS to donors if Twilio is configured
        if (twilioClient) {
            for (const donor of donors) {
                try {
                    await twilioClient.messages.create({
                        body: message,
                        from: process.env.TWILIO_PHONE_NUMBER,
                        to: donor.phone
                    });
                    console.log(`Low stock alert sent to ${donor.phone}`);
                } catch (twilioError) {
                    console.error(`Failed to send low stock alert to ${donor.phone}:`, twilioError.message);
                }
            }
        } else {
            console.log('Low stock alert (Twilio not configured):', message);
        }
    } catch (error) {
        console.error('Error sending low stock alert:', error);
    }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
    });
});

// Initialize sample data
async function initializeSampleData() {
    try {
        // Initialize blood banks
        const bankCount = await BloodBank.countDocuments();
        if (bankCount === 0) {
            console.log('Initializing sample blood banks...');
            
            const sampleBloodBanks = [
                {
                    name: "Ruby Hall Clinic Blood Bank",
                    address: "40, Sassoon Road, Pune, Maharashtra 411001",
                    phone: "+91-20-26122101",
                    lat: 18.5204,
                    lng: 73.8567,
                    area: "Shivajinagar"
                },
                {
                    name: "KEM Hospital Blood Bank",
                    address: "489, Rasta Peth, Sardar Moodliar Road, Pune, Maharashtra 411011",
                    phone: "+91-20-26122101",
                    lat: 18.5158,
                    lng: 73.8550,
                    area: "Shivajinagar"
                },
                {
                    name: "Sahyadri Hospital Blood Bank",
                    address: "Kothrud, Pune, Maharashtra 411038",
                    phone: "+91-20-67222222",
                    lat: 18.5081,
                    lng: 73.8165,
                    area: "Kothrud"
                },
                {
                    name: "Jehangir Hospital Blood Bank",
                    address: "32, Sasoon Road, Pune, Maharashtra 411001",
                    phone: "+91-20-66819999",
                    lat: 18.5236,
                    lng: 73.8478,
                    area: "Shivajinagar"
                },
                {
                    name: "Sanjeevan Hospital Blood Bank",
                    address: "2, Panchavati, Off Karve Road, Pune, Maharashtra 411037",
                    phone: "+91-20-25447777",
                    lat: 18.5154,
                    lng: 73.8298,
                    area: "Kothrud"
                },
                {
                    name: "Aditya Birla Memorial Hospital Blood Bank",
                    address: "Aditya Birla Hospital Marg, Thergaon, Pimpri-Chinchwad, Maharashtra 411033",
                    phone: "+91-20-30717100",
                    lat: 18.6279,
                    lng: 73.7997,
                    area: "Pimpri"
                },
                {
                    name: "Deenanath Mangeshkar Hospital Blood Bank",
                    address: "Erandwane, Pune, Maharashtra 411004",
                    phone: "+91-20-40151515",
                    lat: 18.5150,
                    lng: 73.8290,
                    area: "Kothrud"
                },
                {
                    name: "Sassoon General Hospital Blood Bank",
                    address: "Sassoon Road, Pune, Maharashtra 411001",
                    phone: "+91-20-26122101",
                    lat: 18.5236,
                    lng: 73.8478,
                    area: "Shivajinagar"
                }
            ];
            
            await BloodBank.insertMany(sampleBloodBanks);
            console.log('Sample blood banks initialized successfully');
        }

        // Initialize sample inventory
        const inventoryCount = await BloodInventory.countDocuments();
        if (inventoryCount === 0) {
            console.log('Initializing sample inventory...');
            
            const sampleInventory = [
                {
                    bloodBank: "Ruby Hall Clinic Blood Bank",
                    area: "Shivajinagar",
                    bloodGroup: "A+",
                    units: 15,
                    minLevel: 10
                },
                {
                    bloodBank: "Ruby Hall Clinic Blood Bank",
                    area: "Shivajinagar",
                    bloodGroup: "B+",
                    units: 8,
                    minLevel: 10
                },
                {
                    bloodBank: "Sahyadri Hospital Blood Bank",
                    area: "Kothrud",
                    bloodGroup: "O+",
                    units: 20,
                    minLevel: 10
                },
                {
                    bloodBank: "Sahyadri Hospital Blood Bank",
                    area: "Kothrud",
                    bloodGroup: "AB+",
                    units: 5,
                    minLevel: 10
                },
                {
                    bloodBank: "Aditya Birla Memorial Hospital Blood Bank",
                    area: "Pimpri",
                    bloodGroup: "A-",
                    units: 3,
                    minLevel: 5
                }
            ];
            
            await BloodInventory.insertMany(sampleInventory);
            console.log('Sample inventory initialized successfully');
        }
    } catch (error) {
        console.error('Error initializing sample data:', error);
    }
}

// Start server
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to access the application`);
    await initializeSampleData();
    
    // Set up periodic low stock check (every hour)
    setInterval(checkLowStockAlerts, 60 * 60 * 1000);
});
