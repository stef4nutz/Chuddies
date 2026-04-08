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
    balance: number;
    job: string;
    lastWork?: Date;
    messageCount: number;
    portfolio: Map<string, number>;
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
    gender: { type: String, default: 'Moid' },
    balance: { type: Number, default: 0 },
    job: { type: String, default: 'Unemployed' },
    lastWork: { type: Date, default: null },
    messageCount: { type: Number, default: 0 },
    portfolio: { type: Map, of: Number, default: {} }
});

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
