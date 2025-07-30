const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const multer = require("multer");
const path = require("path");


// Configuration for AWS S3 Client (v3)
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Custom storage engine for multer with AWS SDK v3
const s3Storage = {
  _handleFile: async (req, file, cb) => {
    try {
      // unique filename
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const fileExtension = path.extname(file.originalname);
      const fileName = `engagement-letters/${uniqueSuffix}${fileExtension}`;

      // chunks array to store file data
      const chunks = [];

      // Collect file data
      file.stream.on("data", (chunk) => {
        chunks.push(chunk);
      });

      file.stream.on("end", async () => {
        try {
          // Combining chunks into buffer
          const buffer = Buffer.concat(chunks);

          // Upload to S3
          const uploadParams = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: fileName,
            Body: buffer,
            ContentType: file.mimetype,
            ContentDisposition: "inline",
            Metadata: {
              originalName: file.originalname,
              uploadedBy: req.user?.memberId || "unknown",
              uploadDate: new Date().toISOString(),
            },
          };

          const command = new PutObjectCommand(uploadParams);
          await s3Client.send(command);

          // Construct file URL
          const fileUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

          cb(null, {
            bucket: process.env.S3_BUCKET_NAME,
            key: fileName,
            location: fileUrl,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: buffer.length,
          });
        } catch (uploadError) {
          cb(uploadError);
        }
      });

      file.stream.on("error", (error) => {
        cb(error);
      });
    } catch (error) {
      cb(error);
    }
  },

  _removeFile: async (req, file, cb) => {
    try {
      if (file.key) {
        const deleteParams = {
          Bucket: process.env.S3_BUCKET_NAME,
          Key: file.key,
        };

        const command = new DeleteObjectCommand(deleteParams);
        await s3Client.send(command);
      }
      cb(null);
    } catch (error) {
      cb(error);
    }
  },
};

// Configure multer with custom S3 storage
const upload = multer({
  storage: s3Storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Allow only PDF, DOC, DOCX files
    const allowedMimes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only PDF, DOC, and DOCX files are allowed."
        )
      );
    }
  },
});

// Middleware for single file upload
const uploadSingle = upload.single("engagementLetter");

// Function to generate presigned URL for file access
const generatePresignedUrl = async (fileKey, expiresIn = 3600) => {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileKey,
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: expiresIn, // URL expires in seconds (default 1 hour)
    });

    return signedUrl;
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    throw error;
  }
};

// Function to delete file from S3
const deleteFile = async (fileKey) => {
  try {
    const deleteParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileKey,
    };

    const command = new DeleteObjectCommand(deleteParams);
    await s3Client.send(command);
    return true;
  } catch (error) {
    console.error("Error deleting file from S3:", error);
    return false;
  }
};

// Function to check if file exists
const fileExists = async (fileKey) => {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileKey,
    });

    await s3Client.send(command);
    return true;
  } catch (error) {
    if (error.name === "NoSuchKey") {
      return false;
    }
    throw error;
  }
};

module.exports = {
  uploadSingle,
  generatePresignedUrl,
  deleteFile,
  fileExists,
  s3Client,
};
