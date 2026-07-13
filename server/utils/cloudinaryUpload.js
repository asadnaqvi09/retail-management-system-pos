const { getCloudinaryClient } = require('../config/cloudinary');
const AppError = require('./AppError');

function uploadImageBuffer(buffer, options) {
  const cloudinary = getCloudinaryClient();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        public_id: options.publicId,
        overwrite: false,
        resource_type: 'image',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      },
      (error, result) => {
        if (error) {
          reject(new AppError('Image upload failed', 500));
          return;
        }
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

async function removeCloudinaryImage(imageUrl) {
  if (!imageUrl) {
    return;
  }
  const cloudinary = getCloudinaryClient();
  const publicId = cloudinary.utils.public_id(imageUrl);
  if (!publicId) {
    return;
  }
  await cloudinary.uploader.destroy(publicId, { invalidate: true });
}

module.exports = {
  uploadImageBuffer,
  removeCloudinaryImage,
};
