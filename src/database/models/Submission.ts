import mongoose, { Schema, Document } from 'mongoose';

export interface ISubmission extends Document {
    discordId: string;
    guildId: string;
    messageId: string;
    channelId: string;
    createdAt: Date;
}

const SubmissionSchema: Schema = new Schema({
    discordId: { type: String, required: true },
    guildId: { type: String, required: true },
    messageId: { type: String, required: true },
    channelId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.Submission || mongoose.model<ISubmission>('Submission', SubmissionSchema);
