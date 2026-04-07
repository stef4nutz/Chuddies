import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
    discordId: string;
    guildId: string;
    xp: number;
    level: number;
    age?: number;
    description?: string;
    abusiveBpd?: string;
    truecel?: string;
    racismLevel?: string;
    spouseId?: string;
    gender?: string;
}

const UserSchema: Schema = new Schema({
    discordId: { type: String, required: true },
    guildId: { type: String, required: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    age: { type: Number },
    description: { type: String },
    abusiveBpd: { type: String },
    truecel: { type: String },
    racismLevel: { type: String },
    spouseId: { type: String, default: null },
    gender: { type: String, default: 'Moid' }
});

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
