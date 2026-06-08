// c:\Users\ASUS\OneDrive\Máy tính\frontend\book_managerment\frontend\src\composables\useValidation.js

export function useValidation() {
  /**
   * Hàm kiểm tra dữ liệu dựa trên các quy tắc đã định nghĩa.
   * @param {Object} data - Đối tượng dữ liệu cần kiểm tra (ví dụ: newStudent.value).
   * @param {Object} rules - Đối tượng chứa các quy tắc kiểm tra cho từng trường.
   *                         Ví dụ: { fieldName: [{ type: 'required', message: '...' }, { type: 'maxLength', value: 50, message: '...' }] }.
   * @returns {Object} - Trả về một object chứa lỗi theo từng field { field: message }. Nếu trống, data hợp lệ.
   */
  const validate = (data, rules) => {
    const errors = {}; // Object để lưu trữ lỗi theo key của trường

    for (const field in rules) {
      const value = data[field];
      const fieldRules = rules[field];

      for (const rule of fieldRules) {
        // Kiểm tra bắt buộc (required)
        if (rule.type === 'required' && (!value || (typeof value === 'string' && value.trim() === ''))) {
          errors[field] = rule.message;
          break; // Dừng kiểm tra các quy tắc khác cho trường này nếu nó không được điền
        }

        // Bỏ qua các kiểm tra khác nếu giá trị rỗng và không phải là kiểm tra 'required'
        // Điều này đảm bảo rằng các quy tắc như maxLength, isEmail chỉ áp dụng khi có giá trị
        if ((value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) && rule.type !== 'required') {
          continue;
        }

        // Kiểm tra độ dài tối đa (maxLength)
        if (rule.type === 'maxLength' && typeof value === 'string' && value.length > rule.value) {
          errors[field] = rule.message;
          break;
        }

        // Kiểm tra định dạng Email (isEmail)
        if (rule.type === 'isEmail' && typeof value === 'string') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            errors[field] = rule.message;
            break;
          }
        }

        // Kiểm tra năm (isInteger, minYear, maxYear) - có thể mở rộng thêm cho các loại dữ liệu khác
        if (rule.type === 'isInteger' && !Number.isInteger(value)) { errors[field] = rule.message; break; }
        if (rule.type === 'minYear' && value < rule.value) { errors[field] = rule.message; break; }
        if (rule.type === 'maxYear' && value > rule.value) { errors[field] = rule.message; break; }
      }
    }
    return errors; // Trả về object lỗi.
  };

  return { validate };
}