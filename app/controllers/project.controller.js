const multer = require('multer');
const path = require('path');
const { Project , ObjectId } = require('../models/project.model');


const uploadPath = path.join(__dirname, 'uploads');

// Kiểm tra xem thư mục có tồn tại không, nếu không thì tạo nó
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}
// Cấu hình lưu trữ cho multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // cb(null, 'D:/LIZ/liz_studio_backend/app/uploads/'); // Thư mục lưu trữ
        // const uploadPath = path.join(__dirname, 'uploads'); // Đường dẫn tuyệt đối đến thư mục uploads
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Tên tệp
    },
});

// Tạo middleware multer cho trường 'images' và 'imageBackground'
const upload = multer({ storage }).fields([
    { name: 'images', maxCount: 10 }, // Tối đa 10 tệp cho trường 'images'
    { name: 'imageBackground', maxCount: 1 } // Tối đa 1 tệp cho trường 'imageBackground'
]);


// CREATE: Tạo dự án mới với ảnh
const createProject = async (req, res) => {
    try {
        const images = req.files['images'] ? req.files['images'].map(file => file.path) : [];
        const imageBackground = req.files['imageBackground'] ? req.files['imageBackground'][0].path : '';
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
        console.error('Error creating project:', error); // Ghi log lỗi
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

// READ: Lấy dự án theo ID
const getProjectById = async (req, res) => {
    try {
        const project = await Project.fromMongo(req.db, req.params.id);
        if (!project) return res.status(404).send({ message: 'Project not found' });
        res.status(200).send(project);
    } catch (error) {
        res.status(500).send({ message: 'Error fetching project', error });
    }
};

// UPDATE: Cập nhật dự án
const updateProject = async (req, res) => {
    try {
        const images = req.files ? req.files.map(file => file.path) : [];
        const updatedData = {
            projectName: req.body.projectName,
            year: req.body.year,
            backgroundImage: req.body.backgroundImage,
            clientName: req.body.clientName,
            locationName: req.body.locationName,
            description: req.body.description,
            images: images.length > 0 ? images : undefined,
        };
        const result = await Project.update(req.db, req.params.id, updatedData);
        if (result.matchedCount === 0) return res.status(404).send({ message: 'Project not found' });
        res.status(200).send({ message: 'Project updated successfully' });
    } catch (error) {
        res.status(400).send({ message: 'Error updating project', error });
    }
};

// DELETE: Xóa dự án
const deleteProject = async (req, res) => {
    try {
        const result = await Project.delete(req.db, req.params.id);
        if (result.deletedCount === 0) return res.status(404).send({ message: 'Project not found' });
        res.status(204).send();
    } catch (error) {
        res.status(500).send({ message: 'Error deleting project', error });
    }
};

// Xuất các hàm và multer middleware
module.exports = {
    upload,
    createProject,
    getAllProjects,
    getProjectById,
    updateProject,
    deleteProject,
};