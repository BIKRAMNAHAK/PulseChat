const mongoose = require('mongoose');

const statusSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    mediaUrl: {
      type: String,
      required: true,
    },
    mediaType: {
      type: String,
      enum: ['image', 'video', 'text'],
      default: 'image',
    },
    caption: {
      type: String,
      default: '',
      maxlength: 200,
    },
    viewers: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        viewedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours expiry
      index: { expires: 0 }, // TTL index in MongoDB: auto deletes document when expiresAt arrives
    },
  },
  {
    timestamps: true,
  }
);

const Status = mongoose.model('Status', statusSchema);
module.exports = Status;
