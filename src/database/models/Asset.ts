import mongoose, { Schema, Document } from 'mongoose';

export interface IAsset extends Document {
    symbol: string;
    name: string;
    currentPrice: number;
    lastPrice: number;
}

const AssetSchema: Schema = new Schema({
    symbol: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    currentPrice: { type: Number, required: true },
    lastPrice: { type: Number, required: true }
});

export default mongoose.models.Asset || mongoose.model<IAsset>('Asset', AssetSchema);
