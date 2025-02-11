const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = "mongodb+srv://Isagi:daicl123@isagi.g9q1p.mongodb.net/?retryWrites=true&w=majority&appName=Isagi";
let client;
let db;

async function connectToDatabase() {
  if (!client) {
    client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      }
    });

    try {
      await client.connect();
      console.log('Connected to MongoDB');
      db = client.db('test'); // Thay thế bằng tên cơ sở dữ liệu của bạn
      await listDatabases();
    } catch (error) {
      console.error('Error connecting to MongoDB:', error);
      throw error; // Ném lỗi để có thể xử lý ở nơi khác
    }
  }
  return db;
}

async function listDatabases() {
  try {
    const databasesList = await client.db().admin().listDatabases();
    console.log("Databases:");
    databasesList.databases.forEach(db => console.log(` - ${db.name}`));
  } catch (error) {
    console.error('Error listing databases:', error);
  }
}

// Hàm đóng kết nối
async function closeConnection() {
  if (client) {
    await client.close();
    console.log('MongoDB connection closed.');
  }
}

// Đảm bảo đóng kết nối khi ứng dụng dừng
process.on('SIGINT', async () => {
  await closeConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeConnection();
  process.exit(0);
});

module.exports = { connectToDatabase, closeConnection };