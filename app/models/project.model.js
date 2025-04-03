// models/Project.js
const { ObjectId } = require('mongodb');

class Project {
    constructor(data) {
        this.projectName = data.projectName;         
        this.year = data.year;                  
        this.backgroundImage = data.backgroundImage;
        this.clientName = data.clientName;
        this.locationName = data.locationName;
        this.description = data.description;
        this.images = data.images || []; 
    }

    toObject() {
        return {
            projectName: this.projectName,
            year: this.year,
            backgroundImage: this.backgroundImage,
            clientName: this.clientName,
            locationName: this.locationName,
            description: this.description,
            images: this.images,
        };
    }

    static async findAll(db) {
        return await db.collection('projects').find({}).toArray();
    }
    
    static async findProjectsWithFields(db, fields) {
        const projection = {};
        fields.forEach(field => projection[field] = 1); 
        return await db.collection('projects').find({}, { projection }).toArray();
    }

    // Phương thức tĩnh để lấy dự án theo ID
    static async fromMongo(db, id) {
        const data = await db.collection('projects').findOne({ _id: new ObjectId(id) });
        return data ? new Project(data) : null; // Tạo đối tượng Project từ dữ liệu
    }

    // Phương thức tĩnh để cập nhật dự án
    static async update(db, id, updatedData) {
        return await db.collection('projects').updateOne({ _id: new ObjectId(id) }, { $set: updatedData });
    }

    // Phương thức tĩnh để xóa dự án
    static async delete(db, id) {
        return await db.collection('projects').deleteOne({ _id: new ObjectId(id) });
    }
}  

module.exports = { Project, ObjectId };