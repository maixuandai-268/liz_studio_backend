const { connectToDatabase } = require('../config/db.config');
const { Item, ObjectId } = require('../models/item.model');

async function createItem(req, res) {
  const db = await connectToDatabase();
  const itemData = new Item(req.body.name, req.body.description);

  try {
    const result = await db.collection('items').insertOne(itemData.toObject());
    res.status(201).json(result.ops[0]);
  } catch (error) {
    res.status(500).json({ message: 'Error creating item', error });
  }
}

async function getItems(req, res) {
  const db = await connectToDatabase();

  try {
    const items = await db.collection('items').find({}).toArray();
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching items', error });
  }
}

async function updateItem(req, res) {
  const db = await connectToDatabase();
  const itemId = req.params.id;
  const updatedItem = req.body;

  try {
    const result = await db.collection('items').updateOne(
      { _id: new ObjectId(itemId) },
      { $set: updatedItem }
    );
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error updating item', error });
  }
}

async function deleteItem(req, res) {
  const db = await connectToDatabase();
  const itemId = req.params.id;

  try {
    const result = await db.collection('items').deleteOne({ _id: new ObjectId(itemId) });
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error deleting item', error });
  }
}

module.exports = { createItem, getItems, updateItem, deleteItem };