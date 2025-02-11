require('dotenv').config();
const express = require('express');
const { connectToDatabase } = require('./app/config/db.config'); // Đường dẫn đến db.config.js
const itemRoutes = require('./app/routers/item.routers');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());

// Sử dụng middleware CORS
app.use(cors());

// Kết nối MongoDB
connectToDatabase().catch(err => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1); // Dừng ứng dụng nếu kết nối không thành công
});

// Routes
app.use('/items', itemRoutes);

// Xử lý lỗi toàn cục
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

// Khởi động server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});