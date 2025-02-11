const mongoose = require('mongoose');

// Schema cho chi tiết sản phẩm
const productDetailSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  location: { type: String, required: true },
  description: { type: String, required: true },
  images: [{ type: String }] // Mảng chứa tên tệp hình ảnh
});

// Schema cho dự án
const projectSchema = new mongoose.Schema({
  backgroundImage: { type: String, required: true }, // Tên tệp hình nền
  projectName: { type: String, required: true },
  year: { type: Number, required: true },
  productDetail: { type: productDetailSchema, required: true } // Tham chiếu đến productDetailSchema
});

// Xuất mô hình Project
module.exports = mongoose.model('Project', projectSchema);