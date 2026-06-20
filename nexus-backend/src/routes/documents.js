const express = require('express');
const router = express.Router();
const {
  uploadDoc, getDocuments, getDocument,
  shareDocument, deleteDocument, downloadDocument,
} = require('../controllers/documentController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/upload', uploadDoc);
router.get('/', getDocuments);
router.get('/:id', getDocument);
router.post('/:id/share', shareDocument);
router.patch('/:id/download', downloadDocument);
router.delete('/:id', deleteDocument);

module.exports = router;
