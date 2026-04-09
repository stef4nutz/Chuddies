import mongoose, { Schema, Document } from 'mongoose';

export interface IShopItem extends Document {
    itemId: string;    // unique slug e.g. "apple"
    name: string;
    description: string;
    price: number;
    stock: number;     // -1 = unlimited
    emoji: string;
    guildId: string;
}

const ShopItemSchema: Schema = new Schema({
    itemId: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: 'A tasty food item.' },
    price: { type: Number, required: true, min: 1 },
    stock: { type: Number, default: -1 }, // -1 = unlimited
    emoji: { type: String, default: '🍎' },
    guildId: { type: String, required: true }
});

// Unique per guild
ShopItemSchema.index({ itemId: 1, guildId: 1 }, { unique: true });

export default mongoose.models.ShopItem || mongoose.model<IShopItem>('ShopItem', ShopItemSchema);
