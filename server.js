require('dotenv').config();
const express = require('express');
const { connectToDatabase } = require('./app/config/db.config'); 
const itemRoutes = require('./app/routers/item.routers');
const cors = require('cors');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const projectRoutes = require('./app/routers/project.routers'); 
const middleware = require('./app/middleware/db.middleware');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(middleware);


// Phục vụ tệp tĩnh từ thư mục uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Sử dụng middleware CORS
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Xử lý form gửi
app.post('/send', (req, res) => {
    const { name, email, message } = req.body;

    const transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS    
        },
        debug: true
    });

    const mailOptions = {
        from: email,
        to: 'maiminhthin@gmail.com',
        subject: `Thông tin liên hệ từ ${name}`,
        text: `Họ và tên: ${name}\nEmail: ${email}\nTin nhắn: ${message}`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return res.status(500).send('Có lỗi xảy ra, vui lòng thử lại.');
        }
        res.send('Cảm ơn bạn! Tin nhắn của bạn đã được gửi.');
    });
});

connectToDatabase().catch(err => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1); 
});

// Routes
app.use('/projects', projectRoutes);

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});