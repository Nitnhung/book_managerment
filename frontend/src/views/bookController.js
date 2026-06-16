const db = require('../config/db');

function sanitizeInput(data) {
  if (typeof data !== 'string') return data;
  return data.replace(/<[^>]*>?/gm, '');
}

exports.getAllBooks = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM books');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createBook = async (req, res) => {
  try {
    const nameBook = sanitizeInput(req.body.nameBook);
    const author = sanitizeInput(req.body.author);
    const { year, category } = req.body;
    const sql = 'INSERT INTO books (nameBook, author, year, category) VALUES (?, ?, ?, ?)';
    const [result] = await db.execute(sql, [nameBook, author, year, category]);
    res.json({ message: 'Thêm sách thành công!', id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateBook = async (req, res) => {
  try {
    const id = req.params.id;
    const nameBook = sanitizeInput(req.body.nameBook);
    const author = sanitizeInput(req.body.author);
    const { year, category } = req.body;
    const sql = 'UPDATE books SET nameBook = ?, author = ?, year = ?, category = ? WHERE IdBook = ?';
    await db.execute(sql, [nameBook, author, year, category, id]);
    res.json({ message: 'Cập nhật thông tin sách thành công!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteBook = async (req, res) => {
  try {
    const id = req.params.id;
    const [rows] = await db.execute('SELECT status FROM books WHERE IdBook = ?', [id]);
    
    if (rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy sách' });
    if (rows[0].status === 0 || rows[0].status === false) {
      return res.status(400).json({ error: 'Không thể xóa sách khi đang có sinh viên mượn!' });
    }

    await db.execute('DELETE FROM books WHERE IdBook = ?', [id]);
    res.json({ message: 'Xóa sách thành công!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.toggleStatus = async (req, res) => {
  try {
    const id = req.params.id;
    const [rows] = await db.execute('SELECT status FROM books WHERE IdBook = ?', [id]);
    
    if (rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy sách' });
    
    const newStatus = rows[0].status === 1 ? 0 : 1;
    await db.execute('UPDATE books SET status = ? WHERE IdBook = ?', [newStatus, id]);
    res.json({ message: 'Cập nhật thành công', newStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};