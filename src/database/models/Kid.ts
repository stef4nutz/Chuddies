import mongoose, { Schema, Document } from 'mongoose';

export interface IKid extends Document {
    name: string;
    motherId: string;
    fatherId: string;
    guildId: string;
    createdAt: Date;
}

const KidSchema: Schema = new Schema({
    name: { type: String, required: true },
    motherId: { type: String, required: true },
    fatherId: { type: String, required: true },
    guildId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.Kid || mongoose.model<IKid>('Kid', KidSchema);
