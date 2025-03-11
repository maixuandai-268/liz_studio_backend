const multer = require('multer');
const { Project, ObjectId } = require('../models/project.model');
const cloudinary = require('../config/cloudinary');
const { Readable } = require('stream');

// Cấu hình multer sử dụng memoryStorage (lưu file trong RAM dưới dạng buffer)
const storage = multer.memoryStorage();

// Tạo middleware multer cho trường 'images' và 'imageBackground'
const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // Giới hạn 10MB (tuỳ chỉnh nếu cần)
}).fields([
    { name: 'images', maxCount: 10 },
    { name: 'imageBackground', maxCount: 1 },
]);

// Hàm hỗ trợ để upload buffer lên Cloudinary
const uploadToCloudinary = (buffer, originalname) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { resource_type: 'auto', public_id: `${Date.now()}-${originalname.split('.')[0]}` },
            (error, result) => {
                if (error) return reject(error);
                resolve(result.secure_url);
            }
        );
        const readableStream = new Readable();
        readableStream.push(buffer);
        readableStream.push(null);
        readableStream.pipe(stream);
    });
};

// CREATE: Tạo dự án mới với ảnh
const createProject = async (req, res) => {
    try {
        // Upload images lên Cloudinary từ buffer
        const images = req.files['images']
            ? await Promise.all(
                  req.files['images'].map(file => uploadToCloudinary(file.buffer, file.originalname))
              )
            : [];

        // Upload imageBackground lên Cloudinary từ buffer
        const imageBackground = req.files['imageBackground']
            ? await uploadToCloudinary(req.files['imageBackground'][0].buffer, req.files['imageBackground'][0].originalname)
            : '';

        const projectData = {
            projectName: req.body.projectName,
            year: req.body.year,
            backgroundImage: imageBackground,
            clientName: req.body.clientName,
            locationName: req.body.locationName,
            description: req.body.description,
            images: images,
        };

        const result = await req.db.collection('projects').insertOne(projectData);
        res.status(201).send({ id: result.insertedId });
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(400).send({ message: 'Error creating project', error });
    }
};

// READ: Lấy tất cả dự án
const getAllProjects = async (req, res) => {
    try {
        const projects = await Project.findAll(req.db);
        res.status(200).send(projects);
    } catch (error) {
        res.status(500).send({ message: 'Error fetching projects', error });
    }
};

const getProjectById = async (req, res) => {
    try {
        const project = await Project.fromMongo(req.db, req.params.id);
        if (!project) return res.status(404).send({ message: 'Project not found' });
        res.status(200).send(project);
    } catch (error) {
        res.status(500).send({ message: 'Error fetching project', error });
    }
};

const updateProject = async (req, res) => {
    try {
        const project = await req.db.collection('projects').findOne({ _id: new ObjectId(req.params.id) });
        if (!project) return res.status(404).send({ message: 'Không tìm thấy dự án' });

        // Upload ảnh mới lên Cloudinary nếu có, nếu không giữ nguyên ảnh cũ
        const images = req.files['images']
            ? await Promise.all(
                req.files['images'].map(file => uploadToCloudinary(file.buffer, file.originalname))
            )
            : project.images;

        const imageBackground = req.files['imageBackground']
            ? await uploadToCloudinary(req.files['imageBackground'][0].buffer, req.files['imageBackground'][0].originalname)
            : project.backgroundImage;

        // Tạo object dữ liệu cập nhật, ưu tiên dữ liệu mới, nếu không thì giữ dữ liệu cũ
        const updatedData = {
            projectName: req.body.projectName || project.projectName,
            year: req.body.year || project.year,
            backgroundImage: imageBackground,
            clientName: req.body.clientName || project.clientName,
            locationName: req.body.locationName || project.locationName,
            description: req.body.description || project.description,
            images: images,
        };

        // Cập nhật vào MongoDB
        const result = await req.db.collection('projects').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: updatedData }
        );

        if (result.matchedCount === 0) return res.status(404).send({ message: 'Không tìm thấy dự án' });
        res.status(200).send({ message: 'Cập nhật dự án thành công' });
    } catch (error) {
        console.error('Lỗi khi cập nhật dự án:', error);
        res.status(400).send({ message: 'Lỗi khi cập nhật dự án', error });
    }
};

const deleteProject = async (req, res) => {
    try {
        const project = await Project.fromMongo(req.db, req.params.id);
        if (!project) return res.status(404).send({ message: 'Project not found' });

        // Xóa ảnh trên Cloudinary (nếu muốn)
        if (project.backgroundImage) {
            const publicId = project.backgroundImage.split('/').pop().split('.')[0];
            await cloudinary.uploader.destroy(publicId);
        }
        if (project.images && project.images.length > 0) {
            const deletePromises = project.images.map(image => {
                const publicId = image.split('/').pop().split('.')[0];
                return cloudinary.uploader.destroy(publicId);
            });
            await Promise.all(deletePromises);
        }

        const result = await Project.delete(req.db, req.params.id);
        if (result.deletedCount === 0) return res.status(404).send({ message: 'Project not found' });
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).send({ message: 'Error deleting project', error });
    }
};

module.exports = {
    upload,
    createProject,
    getAllProjects,
    getProjectById,
    updateProject,
    deleteProject,
};