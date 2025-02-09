const { ObjectId } = require('mongodb');

class Item {
  constructor(name, description) {
    this.name = name;
    this.description = description;
  }

  toObject() {
    return {
      name: this.name,
      description: this.description,
    };
  }
}

module.exports = { Item, ObjectId };