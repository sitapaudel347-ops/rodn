# File Uploads - Vercel Blob Storage Implementation

## Problem: Local File System Doesn't Persist

In traditional servers:
```javascript
// This works - files saved to disk
const upload = multer({ dest: 'server/uploads/' });
app.post('/api/media/upload', upload.single('file'), (req, res) => {
    const filePath = req.file.path;  // /server/uploads/abc123
    // File exists forever
});
```

In Vercel serverless:
```javascript
// This BREAKS - disk is ephemeral
const upload = multer({ dest: 'server/uploads/' });
app.post('/api/media/upload', upload.single('file'), (req, res) => {
    const filePath = req.file.path;  // ❌ Files deleted after 15 min!
});
```

---

## Solution: Vercel Blob Storage

### Step 1: Install @vercel/blob

```bash
npm install @vercel/blob
```

Update `package.json`:
```json
"dependencies": {
    "@vercel/blob": "^0.21.0",
    ...
}
```

### Step 2: Add BLOB_READ_WRITE_TOKEN

#### In Development (Local)

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your project
3. **Storage** → **Blob** → **Create**
4. Copy token provided
5. Add to `.env`:

```bash
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_abc123xyz...
```

#### In Vercel Dashboard

1. Go to your project
2. **Settings** → **Environment Variables**
3. Add variable `BLOB_READ_WRITE_TOKEN`
4. Paste token
5. Select **Production** (or desired environment)
6. Click **Save**
7. Redeploy

---

## Implementation

### Create File Upload Service

File: `server/services/blobStorageService.js`

```javascript
const { put, del } = require('@vercel/blob');
const logger = require('../utils/logger');

class BlobStorageService {
    /**
     * Upload file to Vercel Blob Storage
     * @param {File} file - Express multer file object
     * @param {string} folder - Folder name (e.g., 'media', 'uploads')
     * @returns {Promise<string>} Public URL of uploaded file
     */
    async uploadFile(file, folder = 'uploads') {
        try {
            if (!file) {
                throw new Error('No file provided');
            }

            logger.info(`[BLOB] Uploading file: ${file.originalname}`);

            // Generate unique filename
            const timestamp = Date.now();
            const filename = `${folder}/${timestamp}-${file.originalname}`;

            // Upload to Blob storage
            const blob = await put(filename, file.buffer, {
                access: 'public',  // Makes file publicly accessible
                addRandomSuffix: false,  // Don't add random suffix
                contentType: file.mimetype,
            });

            logger.info(`[BLOB] Upload successful: ${blob.url}`);

            return {
                url: blob.url,
                filename: file.originalname,
                size: file.size,
                mimetype: file.mimetype,
                uploadedAt: new Date().toISOString(),
            };
        } catch (error) {
            logger.error('[BLOB] Upload failed:', error);
            throw error;
        }
    }

    /**
     * Upload multiple files
     * @param {Array} files - Array of Express multer file objects
     * @param {string} folder - Folder name
     * @returns {Promise<Array>} Array of upload results
     */
    async uploadMultipleFiles(files, folder = 'uploads') {
        try {
            if (!files || files.length === 0) {
                throw new Error('No files provided');
            }

            logger.info(`[BLOB] Uploading ${files.length} files`);

            const results = await Promise.all(
                files.map(file => this.uploadFile(file, folder))
            );

            logger.info(`[BLOB] Uploaded ${results.length} files successfully`);

            return results;
        } catch (error) {
            logger.error('[BLOB] Multiple upload failed:', error);
            throw error;
        }
    }

    /**
     * Delete file from Blob storage
     * @param {string} url - Public URL of file to delete
     * @returns {Promise<void>}
     */
    async deleteFile(url) {
        try {
            if (!url) {
                throw new Error('No URL provided');
            }

            logger.info(`[BLOB] Deleting file: ${url}`);

            await del(url);

            logger.info(`[BLOB] File deleted successfully: ${url}`);
        } catch (error) {
            logger.error('[BLOB] Delete failed:', error);
            throw error;
        }
    }

    /**
     * Delete multiple files
     * @param {Array} urls - Array of file URLs
     * @returns {Promise<void>}
     */
    async deleteMultipleFiles(urls) {
        try {
            if (!urls || urls.length === 0) {
                throw new Error('No URLs provided');
            }

            logger.info(`[BLOB] Deleting ${urls.length} files`);

            await Promise.all(urls.map(url => del(url)));

            logger.info(`[BLOB] Deleted ${urls.length} files successfully`);
        } catch (error) {
            logger.error('[BLOB] Multiple delete failed:', error);
            throw error;
        }
    }
}

module.exports = new BlobStorageService();
```

### Update Media Routes

File: `server/routes/media.js`

```javascript
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate, requirePermission } = require('../middlewares/auth');
const blobStorage = require('../services/blobStorageService');
const database = require('../config/database');
const logger = require('../utils/logger');

// Configure multer to store in memory (not disk)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allowed file types
        const allowedMimes = [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/svg+xml',
            'application/pdf',
            'video/mp4',
            'video/webm',
        ];

        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`File type ${file.mimetype} not allowed`));
        }
    },
});

/**
 * Upload single file
 * POST /api/media/upload
 */
router.post('/upload', authenticate, requirePermission('media.upload'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        logger.info(`[MEDIA] Uploading file: ${req.file.originalname}`);

        // Upload to Blob storage
        const uploadResult = await blobStorage.uploadFile(req.file, 'media');

        // Store in database
        const result = await database.run(
            `INSERT INTO media (filename, url, mime_type, size, user_id, uploaded_at) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                req.file.originalname,
                uploadResult.url,
                req.file.mimetype,
                req.file.size,
                req.user.id,
                uploadResult.uploadedAt,
            ]
        );

        logger.info(`[MEDIA] File uploaded: ${uploadResult.url}`);

        res.json({
            id: result.lastID,
            url: uploadResult.url,
            filename: uploadResult.filename,
            size: uploadResult.size,
            mimetype: uploadResult.mimetype,
            uploadedAt: uploadResult.uploadedAt,
        });
    } catch (error) {
        logger.error('[MEDIA] Upload failed:', error);
        res.status(500).json({ error: 'Upload failed', message: error.message });
    }
});

/**
 * Upload multiple files
 * POST /api/media/upload-multiple
 */
router.post('/upload-multiple', authenticate, requirePermission('media.upload'), upload.array('files', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files provided' });
        }

        logger.info(`[MEDIA] Uploading ${req.files.length} files`);

        // Upload all files
        const uploadResults = await blobStorage.uploadMultipleFiles(req.files, 'media');

        // Store all in database
        const mediaRecords = [];
        for (const uploadResult of uploadResults) {
            const result = await database.run(
                `INSERT INTO media (filename, url, mime_type, size, user_id, uploaded_at) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    uploadResult.filename,
                    uploadResult.url,
                    uploadResult.mimetype,
                    uploadResult.size,
                    req.user.id,
                    uploadResult.uploadedAt,
                ]
            );

            mediaRecords.push({
                id: result.lastID,
                url: uploadResult.url,
                filename: uploadResult.filename,
                size: uploadResult.size,
                mimetype: uploadResult.mimetype,
            });
        }

        logger.info(`[MEDIA] Uploaded ${mediaRecords.length} files`);

        res.json({
            count: mediaRecords.length,
            media: mediaRecords,
        });
    } catch (error) {
        logger.error('[MEDIA] Multiple upload failed:', error);
        res.status(500).json({ error: 'Upload failed', message: error.message });
    }
});

/**
 * Delete file
 * DELETE /api/media/:id
 */
router.delete('/:id', authenticate, requirePermission('media.manage'), async (req, res) => {
    try {
        const mediaId = req.params.id;

        // Get file from database
        const media = await database.get(
            'SELECT * FROM media WHERE id = ?',
            [mediaId]
        );

        if (!media) {
            return res.status(404).json({ error: 'File not found' });
        }

        logger.info(`[MEDIA] Deleting file: ${media.url}`);

        // Delete from Blob storage
        await blobStorage.deleteFile(media.url);

        // Delete from database
        await database.run('DELETE FROM media WHERE id = ?', [mediaId]);

        logger.info(`[MEDIA] File deleted: ${mediaId}`);

        res.json({ success: true, message: 'File deleted' });
    } catch (error) {
        logger.error('[MEDIA] Delete failed:', error);
        res.status(500).json({ error: 'Delete failed', message: error.message });
    }
});

/**
 * List all media
 * GET /api/media
 */
router.get('/', authenticate, requirePermission('media.read'), async (req, res) => {
    try {
        const media = await database.all('SELECT * FROM media ORDER BY uploaded_at DESC LIMIT 100');
        res.json(media);
    } catch (error) {
        logger.error('[MEDIA] List failed:', error);
        res.status(500).json({ error: 'Failed to list media' });
    }
});

/**
 * Get single media item
 * GET /api/media/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const media = await database.get('SELECT * FROM media WHERE id = ?', [req.params.id]);

        if (!media) {
            return res.status(404).json({ error: 'File not found' });
        }

        res.json(media);
    } catch (error) {
        logger.error('[MEDIA] Get failed:', error);
        res.status(500).json({ error: 'Failed to get media' });
    }
});

module.exports = router;
```

---

## Frontend Usage

### HTML Form Upload

```html
<form id="uploadForm">
    <input type="file" id="fileInput" name="file" accept="image/*" />
    <button type="submit">Upload</button>
</form>

<script>
document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const file = document.getElementById('fileInput').files[0];
    const formData = new FormData();
    formData.append('file', file);
    
    const token = localStorage.getItem('token');
    
    const response = await fetch('/api/media/upload', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
        body: formData,
    });
    
    const result = await response.json();
    console.log('Upload complete:', result);
    
    // Display image
    const img = document.createElement('img');
    img.src = result.url;
    document.body.appendChild(img);
});
</script>
```

### JavaScript (Fetch API)

```javascript
async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    const token = localStorage.getItem('token');
    
    const response = await fetch('/api/media/upload', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
        body: formData,
    });
    
    if (!response.ok) {
        throw new Error('Upload failed');
    }
    
    return response.json();
}

// Usage
const file = document.getElementById('fileInput').files[0];
const result = await uploadFile(file);
console.log('File URL:', result.url);
```

---

## Database Schema

You need to create a `media` table:

```sql
CREATE TABLE IF NOT EXISTS media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL UNIQUE,
    mime_type VARCHAR(100),
    size INTEGER,
    user_id INTEGER NOT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

Add to `server/config/schema.js`:

```javascript
await database.run(`
    CREATE TABLE IF NOT EXISTS media (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename VARCHAR(255) NOT NULL,
        url VARCHAR(500) NOT NULL UNIQUE,
        mime_type VARCHAR(100),
        size INTEGER,
        user_id INTEGER NOT NULL,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
`);
```

---

## Features of This Implementation

✅ **Works in Serverless**
- Files uploaded to Blob Storage (not local disk)
- URLs publicly accessible
- Persists forever (not deleted after 15 min)

✅ **Scalable**
- Handle large files (up to 50MB)
- Upload multiple files at once
- Automatic backup by Vercel

✅ **Secure**
- Requires authentication
- Requires permission (`media.upload`)
- File type validation
- Size limits

✅ **Flexible**
- Store metadata in database
- Link to users
- Easy to delete files
- Track upload timestamps

✅ **Cost-Effective**
- Vercel Blob: $0.50 per GB stored
- Typical: $5-20/month for 10-40GB

---

## Limitations & Workarounds

### Can't serve from /uploads anymore

```javascript
// ❌ Old way (doesn't work in serverless)
app.use('/uploads', express.static('server/uploads'));

// ✅ New way (use Blob URLs directly)
// Images stored at: https://your-app.vercel.app/media/{id}
```

### File URLs are Vercel domains

```javascript
// URLs look like:
// https://something.public.blob.vercel-storage.com/filename
// This is normal and expected

// Can't change domain (use Vercel's CDN)
```

### Deleting files manually

```javascript
// If file not tracked in database:
// Go to Vercel dashboard → Storage → Blob
// View all files and delete manually
```

---

## Testing

### Curl Upload

```bash
curl -X POST http://localhost:3000/api/media/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@./test-image.jpg"
```

### Response

```json
{
  "id": 1,
  "url": "https://something.public.blob.vercel-storage.com/media/1707662400-test-image.jpg",
  "filename": "test-image.jpg",
  "size": 102400,
  "mimetype": "image/jpeg",
  "uploadedAt": "2026-02-11T10:00:00.000Z"
}
```

---

## Troubleshooting

### "BLOB_READ_WRITE_TOKEN not found"

```
Error: Error: VERCEL_BLOB_API_TOKEN is not provided

Solution:
1. Go to Vercel Dashboard
2. Storage → Blob → Create
3. Copy token
4. Add to .env: BLOB_READ_WRITE_TOKEN=...
5. Or add to Vercel environment variables
6. Redeploy
```

### "File type not allowed"

```
Error: File type image/svg+xml not allowed

Solution:
1. Update fileFilter in media.js
2. Add your file type to allowedMimes
3. Restart server
4. Try again
```

### "File size too large"

```
Error: File too large

Solution:
1. Increase fileSize limit in multer config
2. Or compress file before uploading
3. Typical limit: 50MB
```

---

## References

- [Vercel Blob Storage](https://vercel.com/docs/storage/vercel-blob)
- [Multer Middleware](https://github.com/expressjs/multer)
- [@vercel/blob NPM](https://www.npmjs.com/package/@vercel/blob)

---

**Status**: Ready for Implementation  
**Last Updated**: February 12, 2026
