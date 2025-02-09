const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = "mongodb+srv://Isagi:daicl123@isagi.g9q1p.mongodb.net/?retryWrites=true&w=majority&appName=Isagi";
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function connectToDatabase() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    await  listDatabases(client);
    return client.db('yourDatabaseName'); // Thay thế bằng tên cơ sở dữ liệu của bạn
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  }
  finally {
    await client.close();
}
}

async function listDatabases(client){
  databasesList = await client.db().admin().listDatabases();

  console.log("Databases:");
  databasesList.databases.forEach(db => console.log(` - ${db.name}`));
};

module.exports = { connectToDatabase, client };