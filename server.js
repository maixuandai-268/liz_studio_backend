const express = require('express');
const itemRoutes = require('./app/routers/item.routers');

const app = express();
const PORT = 3000;

// Middleware để phân tích dữ liệu JSON
app.use(express.json());

// Sử dụng router
app.use('/items', itemRoutes);

// Khởi động server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});