// models/ProductDetail.js

class ProductDetail {
    constructor(data) {
        this.customerName = data.customerName; // Tên khách hàng
        this.location = data.location;           // Vị trí
        this.description = data.description;     // Mô tả
        this.images = data.images || [];         // Danh sách ID ảnh
    }

    static validate(data) {
        if (!data.customerName) {
            throw new Error('Customer name is required');
        }
        if (!data.location) {
            throw new Error('Location is required');
        }
        if (!data.description) {
            throw new Error('Description is required');
        }
        if (!Array.isArray(data.images)) {
            throw new Error('Images must be an array');
        }
        data.images.forEach(url => {
            if (typeof url !== 'string' || !url.startsWith('http')) {
                throw new Error(`Invalid URL in images: ${url}`);
            }
        });
    }
}

module.exports = ProductDetail;