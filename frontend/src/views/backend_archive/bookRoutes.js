const express = require('express');
const router = express.Router();
const bookController = require('../controllers/bookController');
const { verifyToken } = require('../middleware/auth');

router.get('/', bookController.getAllBooks);
router.post('/', verifyToken, bookController.createBook);
router.put('/:id', verifyToken, bookController.updateBook);
router.delete('/:id', verifyToken, bookController.deleteBook);
router.patch('/:id/toggle', bookController.toggleStatus);

module.exports = router;