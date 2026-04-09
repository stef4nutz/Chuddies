import mongoose, { Schema, Document } from 'mongoose';

export interface IInventory extends Document {
    discordId: string;
    guildId: string;
    items: Map<string, number>; // itemId -> quantity
}

const InventorySchema: Schema = new Schema({
    discordId: { type: String, required: true },
    guildId: { type: String, required: true },
    items: { type: Map, of: Number, default: {} }
});

InventorySchema.index({ discordId: 1, guildId: 1 }, { unique: true });

export default mongoose.models.Inventory || mongoose.model<IInventory>('Inventory', InventorySchema);
