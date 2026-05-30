const mongoose = require('mongoose')

const documentSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    path: {
      type: String,
      required: true,
      unique: true,
    },
    layoutStrategy: {
      type: String,
      enum: ['ADVERSARIAL', 'HIERARCHICAL', 'TRANSACTIONAL'],
      default: 'TRANSACTIONAL',
    },
    ingestionStatus: {
      type: String,
      enum: ['pending', 'processing', 'indexed', 'failed'],
      default: 'pending',
      index: true,
    },
    ingestionError: {
      type: String,
      default: null,
    },
    ingestionRequestedAt: {
      type: Date,
      default: null,
    },
    ingestionCompletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
)

module.exports = mongoose.models.Document || mongoose.model('Document', documentSchema)
