const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Sequelize, DataTypes } = require('sequelize');

const app = express();
const PORT = 8000;
const SECRET_KEY = 'super_secret_key_for_demo';

// Middleware
app.use(cors());
app.use(bodyParser.json());

// --- Database Setup (SQLite) ---
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite',
    logging: false
});

// --- Models ---
const User = sequelize.define('User', {
    email: { type: DataTypes.STRING, unique: true, allowNull: false },
    password: { type: DataTypes.STRING, allowNull: false }
});

const History = sequelize.define('History', {
    ip_address: { type: DataTypes.STRING, allowNull: false },
    geo_data: { type: DataTypes.JSON, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false }
});

// Relationships
User.hasMany(History, { foreignKey: 'userId' });
History.belongsTo(User, { foreignKey: 'userId' });

// --- Seeder ---
const seedDatabase = async () => {
    await sequelize.sync({ force: true }); 
    const hashedPassword = await bcrypt.hash('123456789', 10);
    await User.create({
        email: 'jcranes@gmail.com',
        password: hashedPassword
    });
    console.log('Database seeded! User: jcranes@gmail.com / 123456789');
};

// --- Middleware ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- Routes ---

// Login API
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });

    if (!user) return res.status(400).json({ message: 'User not found' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ token, user: { email: user.email } });
});

// Get History
app.get('/api/history', authenticateToken, async (req, res) => {
    const history = await History.findAll({ 
        where: { userId: req.user.id },
        order: [['createdAt', 'DESC']]
    });
    res.json(history);
});

// Add History
app.post('/api/history', authenticateToken, async (req, res) => {
    const { ip, geo } = req.body;
    const newHistory = await History.create({
        ip_address: ip,
        geo_data: geo,
        userId: req.user.id
    });
    res.json(newHistory);
});

// Delete History (Bulk)
app.post('/api/history/delete', authenticateToken, async (req, res) => {
    const { ids } = req.body; // Expects array of IDs
    await History.destroy({
        where: {
            id: ids,
            userId: req.user.id
        }
    });
    res.json({ success: true });
});

// --- Start Server ---
app.listen(PORT, async () => {
    await seedDatabase();
    console.log(`Server running on http://localhost:${PORT}`);
});