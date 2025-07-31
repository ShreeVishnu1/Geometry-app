const { MongoClient } = require('mongodb');

// Test different connection strings
const connections = [
    'mongodb+srv://dbUser:3x5jNN5Gff4tauy2@cluster0.daht0y8.mongodb.net/geometry-app',
    'mongodb+srv://dbUser:3x5jNN5Gff4tauy2@cluster0.daht0y8.mongodb.net/geometry-app?retryWrites=true&w=majority',
    'mongodb+srv://dbUser:3x5jNN5Gff4tauy2@cluster0.daht0y8.mongodb.net/?retryWrites=true&w=majority'
];

async function testConnection(uri, index) {
    console.log(`\nTesting connection ${index + 1}:`);
    console.log(`URI: ${uri}`);
    
    try {
        const client = new MongoClient(uri, {
            connectTimeoutMS: 10000,
            serverSelectionTimeoutMS: 10000,
        });
        
        await client.connect();
        console.log('✅ Connected successfully!');
        await client.close();
        return true;
    } catch (error) {
        console.log('❌ Connection failed:');
        console.log(error.message);
        return false;
    }
}

async function testAllConnections() {
    console.log('Testing MongoDB Atlas connections...\n');
    
    for (let i = 0; i < connections.length; i++) {
        const success = await testConnection(connections[i], i);
        if (success) {
            console.log(`\n🎉 Working connection found! Use connection ${i + 1}`);
            break;
        }
    }
}

testAllConnections().catch(console.error);
