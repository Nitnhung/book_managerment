-- Tạo bảng refresh_tokens để lưu trữ refresh tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(500) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_token (token(255))
);

-- Tạo bảng refresh_tokens cho librarians (nếu cần)
CREATE TABLE IF NOT EXISTS librarian_refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  librarian_id INT NOT NULL,
  token VARCHAR(500) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME NULL,
  FOREIGN KEY (librarian_id) REFERENCES librarians(id) ON DELETE CASCADE,
  INDEX idx_librarian_id (librarian_id),
  INDEX idx_token (token(255))
);
