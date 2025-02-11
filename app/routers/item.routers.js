const express = require('express');
const router = express.Router();

const {
  createItem,
  getItems,
  updateItem,
  deleteItem,
} = require('../controllers/item.controller');

router.post('/', createItem);
router.get('/', getItems);
router.put('/:id', updateItem);
router.delete('/:id', deleteItem);

module.exports = router;