const mongoose = require('mongoose')

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: true,
    },
    firstName: {
      type: String,
      trim: true,
      required: true,
    },
    lastName: {
      type: String,
      trim: true,
      required: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      unique: true,
    },
    firm: {
      type: String,
      trim: true,
      required: true,
    },
    authSalt: {
      type: String,
      required: true,
    },
    authVerifier: {
      type: String,
      required: true,
    },
    kdfAlgorithm: {
      type: String,
      default: 'PBKDF2-SHA256',
    },
    kdfParams: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    keyVersion: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  },
)

module.exports = mongoose.models.User || mongoose.model('User', userSchema)
