import { MongoClient } from 'mongodb';

const sourceURI = "mongodb+srv://prashantkrjha1233_db_user:9vUK3vVXyQBCN1Ed@cluster0.egw7n93.mongodb.net/WhatappApi?retryWrites=true&w=majority";
const targetURI = "mongodb://admin:SecureWhatsApp123!@66.116.248.190:27017/whatappprimeapi?authSource=admin";

async function copyCollection(sourceDB, targetDB, collectionName) {
    const sourceCollection = sourceDB.collection(collectionName);
    const targetCollection = targetDB.collection(collectionName);

    try {
        await targetCollection.drop();
    } catch (err) {}

    const cursor = sourceCollection.find({});
    let batch = [];
    let totalCopied = 0;
    const batchSize = 1000;

    for await (const doc of cursor) {
        batch.push(doc);
        if (batch.length >= batchSize) {
            await targetCollection.insertMany(batch);
            totalCopied += batch.length;
            batch = [];
            console.log(`[${collectionName}] ⏳ Copied ${totalCopied}...`);
        }
    }

    if (batch.length > 0) {
        await targetCollection.insertMany(batch);
        totalCopied += batch.length;
    }

    if (totalCopied > 0) {
        console.log(`[${collectionName}] ✔️ Done. Total: ${totalCopied}`);
    } else {
        console.log(`[${collectionName}] ⚪ Empty.`);
    }
}

async function runParallelMigration() {
    let sourceClient, targetClient;
    try {
        console.log("⏳ Connecting to Databases...");
        sourceClient = new MongoClient(sourceURI, { maxPoolSize: 50 });
        targetClient = new MongoClient(targetURI, { maxPoolSize: 50 });
        
        await Promise.all([sourceClient.connect(), targetClient.connect()]);
        
        const sourceDB = sourceClient.db();
        const targetDB = targetClient.db();
        console.log("✅ Connected!");

        const collections = await sourceDB.listCollections().toArray();
        const copyPromises = [];

        for (const col of collections) {
            const name = col.name;
            if (name.startsWith("system.")) continue;

            console.log(`🚀 Starting parallel worker for: [${name}]`);
            copyPromises.push(copyCollection(sourceDB, targetDB, name));
        }

        console.log(`\n⚡ Running ${copyPromises.length} collections SIMULTANEOUSLY...\n`);
        await Promise.all(copyPromises);

        console.log("\n🎉 ALL COLLECTIONS COPIED SUCCESSFULLY IN PARALLEL!");

    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        if (sourceClient) await sourceClient.close();
        if (targetClient) await targetClient.close();
        console.log("🔌 Connections closed.");
    }
}

runParallelMigration();
