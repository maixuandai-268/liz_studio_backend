const express = require('express');
const router = express.Router();

const { upload,
    createProject,
    getAllProjects,
    getProjectById,
    updateProject,
    deleteProject, } = require('../controllers/project.controller');

//Router for project
router.post('/',  upload, createProject);
router.get('/', getAllProjects);
router.get('/:id', getProjectById);
router.put('/:id', upload, updateProject);
router.delete('/:id', deleteProject);


module.exports = router;