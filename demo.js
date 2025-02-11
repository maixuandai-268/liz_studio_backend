const {MongoClient} = require('mongodb');

async function main(){
    const uri = "mongodb+srv://Isagi:daicl123@isagi.g9q1p.mongodb.net/?retryWrites=true&w=majority&appName=Isagi";

    const client = new MongoClient(uri);

    try{
        await client.connect();
        console.log('Connected to MongoDB');

        await listDatabases(client);
    } catch (error){    
        console.error('Error connecting to MongoDB:', error);
    } finally {        
        await client.close();
    } 
}

main().catch(console.error);

async function listDatabases(client){
    databasesList = await client.db().admin().listDatabases();
    console.log("Databases:");
    databasesList.databases.forEach(db => console.log(` - ${db.name}`));
};