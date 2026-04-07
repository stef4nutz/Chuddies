import mongoose, { Schema, Document } from 'mongoose';

export interface IGuildConfig extends Document {
    guildId: string;
    participateChannelId: string;
    voteChannelId: string;
}

const GuildConfigSchema: Schema = new Schema({
    guildId: { type: String, required: true, unique: true },
    participateChannelId: { type: String, required: true },
    voteChannelId: { type: String, required: true }
});

export default mongoose.models.GuildConfig || mongoose.model<IGuildConfig>('GuildConfig', GuildConfigSchema);
