import mongoose, { Schema, Document } from 'mongoose';

export interface IFeedLogEntry {
    action: string;
    timestamp: Date;
}

export interface IKid extends Document {
    name: string;
    motherId: string;
    fatherId: string;
    guildId: string;
    createdAt: Date;
    birthDate: Date;
    gender: 'boy' | 'girl';
    hearts: number;
    age: number;
    lastFed: Date;
    isAlive: boolean;
    feedLog: IFeedLogEntry[];
    warningIssued: boolean; // tracks if the "your kid is hungry" DM was sent in the current cycle
}

const FeedLogSchema = new Schema({
    action: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
}, { _id: false });

const KidSchema: Schema = new Schema({
    name: { type: String, required: true },
    motherId: { type: String, required: true },
    fatherId: { type: String, required: true },
    guildId: { type: String, required: true },
    birthDate: { type: Date, default: Date.now },
    gender: { type: String, enum: ['boy', 'girl'], default: () => Math.random() < 0.5 ? 'boy' : 'girl' },
    hearts: { type: Number, default: 10, min: 0, max: 10 },
    age: { type: Number, default: 0 },
    lastFed: { type: Date, default: Date.now },
    isAlive: { type: Boolean, default: true },
    feedLog: { type: [FeedLogSchema], default: [] },
    warningIssued: { type: Boolean, default: false }
}, {
    timestamps: { createdAt: 'createdAt', updatedAt: false }
});

// Always re-register with the latest schema (safe for ts-node-dev hot reloads)
// Without this, a stale cached model from a previous load could silently use an old schema.
if (mongoose.models.Kid) {
    mongoose.deleteModel('Kid');
}
export default mongoose.model<IKid>('Kid', KidSchema);
