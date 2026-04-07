import mongoose from 'mongoose';

export async function connectDatabase() {
    const uri = process.env.MONGO_URI;

    if (!uri || uri.includes('<username>')) {
        console.warn('[Database] MONGO_URI is missing or invalid in .env! Skipping MongoDB connection.');
        return;
    }

    try {
        await mongoose.connect(uri);
        console.log('[Database] Successfully connected to MongoDB!');
    } catch (error) {
        console.error('[Database] Error connecting to MongoDB:', error);
        process.exit(1);
    }
}
