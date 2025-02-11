// models/Project.js

const { ObjectId } = require('mongodb');
const ProductDetail = require('./ProductDetail');

class Project {
    constructor(data) {
        this.backgroundImage = data.backgroundImage; // Ảnh nền
        this.projectName = data.projectName;         // Tên dự án
        this.year = data.year;                         // Năm
        this.productDetails = (data.productDetails || []).map(detail => new ProductDetail(detail)); // Danh sách chi tiết sản phẩm
    }

    static fromMongo(db, id) {
        return db.collection('projects').findOne({ _id: new ObjectId(id) });
    }

    static create(db, data) {
        const project = new Project(data);
        return db.collection('projects').insertOne(project);
    }

    static update(db, id, data) {
        return db.collection('projects').updateOne(
            { _id: new ObjectId(id) },
            { $set: data }
        );
    }

    static delete(db, id) {
        return db.collection('projects').deleteOne({ _id: new ObjectId(id) });
    }

    static findAll(db) {
        return db.collection('projects').find().toArray();
    }
}

module.exports = Project;