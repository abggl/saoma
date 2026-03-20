/**
 * Excel导出工具类
 * 使用SheetJS库生成真正的Excel文件
 * 
 * 技术说明：
 * 1. 钉钉小程序使用FileSystemManager.writeFile写入文件
 * 2. Excel文件使用base64编码写入
 * 3. dd.openDocument在安卓端只支持PDF预览，Excel需转存钉盘
 * 4. 可使用dd.saveFileToDingTalk转存到钉盘
 */

let XLSX = null;

try {
  XLSX = require('./xlsx.core.min.js');
} catch (e) {
  console.warn('XLSX库未加载，Excel导出功能不可用', e);
}

function isXLSXAvailable() {
  return XLSX !== null && typeof XLSX.utils !== 'undefined';
}

function exportToExcel(data, options = {}) {
  return new Promise((resolve, reject) => {
    if (!isXLSXAvailable()) {
      reject(new Error('XLSX库未加载，请检查xlsx.core.min.js文件'));
      return;
    }

    const {
      sheetName = '数据导出',
      fileName = `export_${formatDateTimeForFile(new Date())}.xlsx`,
      columns = null
    } = options;

    try {
      let sheetData = [];
      
      if (columns && Array.isArray(columns)) {
        sheetData.push(columns.map(col => col.title));
        data.forEach(item => {
          const row = columns.map(col => {
            const value = item[col.key];
            if (value === null || value === undefined) return '';
            if (typeof value === 'object') {
              if (Array.isArray(value)) {
                return value.length > 0 ? value.join(';') : '';
              }
              return JSON.stringify(value);
            }
            return String(value);
          });
          sheetData.push(row);
        });
      } else {
        if (data.length > 0) {
          const headers = Object.keys(data[0]);
          sheetData.push(headers);
          data.forEach(item => {
            const row = headers.map(key => {
              const value = item[key];
              if (value === null || value === undefined) return '';
              if (typeof value === 'object') {
                if (Array.isArray(value)) {
                  return value.length > 0 ? value.join(';') : '';
                }
                return JSON.stringify(value);
              }
              return String(value);
            });
            sheetData.push(row);
          });
        }
      }

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      
      if (columns) {
        ws['!cols'] = columns.map(col => ({ wch: col.width || 15 }));
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      const fileData = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });

      const fs = dd.getFileSystemManager();
      const basePath = dd.env.USER_DATA_PATH;
      const filePath = `${basePath}/${fileName}`;

      fs.writeFile({
        filePath: filePath,
        data: fileData,
        encoding: 'base64',
        success: () => {
          console.log('Excel文件写入成功：', filePath);
          resolve(filePath);
        },
        fail: (err) => {
          console.error('Excel文件写入失败：', err);
          reject(err);
        }
      });

    } catch (err) {
      console.error('生成Excel失败：', err);
      reject(err);
    }
  });
}

function exportToCSV(data, options = {}) {
  return new Promise((resolve, reject) => {
    const {
      fileName = `export_${formatDateTimeForFile(new Date())}.csv`,
      columns = null,
      delimiter = ','
    } = options;

    try {
      let csvContent = '\uFEFF';

      if (columns && Array.isArray(columns)) {
        csvContent += columns.map(col => `"${col.title}"`).join(delimiter) + '\n';
        data.forEach(item => {
          const row = columns.map(col => {
            const value = item[col.key];
            if (value === null || value === undefined) return '""';
            const str = String(value).replace(/"/g, '""').replace(/\n/g, ' ');
            return `"${str}"`;
          });
          csvContent += row.join(delimiter) + '\n';
        });
      } else if (data.length > 0) {
        const headers = Object.keys(data[0]);
        csvContent += headers.map(h => `"${h}"`).join(delimiter) + '\n';
        data.forEach(item => {
          const row = headers.map(key => {
            const value = item[key];
            if (value === null || value === undefined) return '""';
            const str = String(value).replace(/"/g, '""').replace(/\n/g, ' ');
            return `"${str}"`;
          });
          csvContent += row.join(delimiter) + '\n';
        });
      }

      const fs = dd.getFileSystemManager();
      const basePath = dd.env.USER_DATA_PATH;
      const filePath = `${basePath}/${fileName}`;

      fs.writeFile({
        filePath: filePath,
        data: csvContent,
        encoding: 'utf8',
        success: () => {
          console.log('CSV文件写入成功：', filePath);
          resolve(filePath);
        },
        fail: (err) => {
          console.error('CSV文件写入失败：', err);
          reject(err);
        }
      });

    } catch (err) {
      console.error('生成CSV失败：', err);
      reject(err);
    }
  });
}

function importFromExcel(filePath) {
  return new Promise((resolve, reject) => {
    const fs = dd.getFileSystemManager();
    const fileExt = filePath.split('.').pop().toLowerCase();

    if (fileExt === 'csv') {
      parseCSV(filePath).then(resolve).catch(reject);
      return;
    }

    if (!isXLSXAvailable()) {
      parseCSV(filePath).then(resolve).catch(reject);
      return;
    }

    fs.readFile({
      filePath: filePath,
      encoding: 'base64',
      success: (res) => {
        try {
          const data = res.data;
          const workbook = XLSX.read(data, { type: 'base64' });
          
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length < 2) {
            reject(new Error('文件内容为空或只有表头'));
            return;
          }

          const headers = jsonData[0];
          const result = [];
          
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (row && row.length > 0) {
              const item = {};
              headers.forEach((header, index) => {
                if (header && row[index] !== undefined) {
                  item[header.toString().trim()] = row[index];
                }
              });
              
              if (Object.keys(item).length > 0) {
                result.push(item);
              }
            }
          }

          console.log('Excel解析成功，共', result.length, '条数据');
          resolve(result);
        } catch (err) {
          console.error('解析Excel失败：', err);
          reject(new Error('解析Excel失败: ' + err.message));
        }
      },
      fail: (err) => {
        console.error('读取文件失败：', err);
        reject(new Error('读取文件失败: ' + (err.errorMessage || err.message || '未知错误')));
      }
    });
  });
}

function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const fs = dd.getFileSystemManager();

    fs.readFile({
      filePath: filePath,
      encoding: 'utf8',
      success: (res) => {
        try {
          const content = res.data;
          const lines = content.split(/\r?\n/).filter(line => line.trim());
          
          if (lines.length < 1) {
            reject(new Error('文件内容为空'));
            return;
          }

          const headers = parseCSVLine(lines[0]);
          
          const data = [];
          for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            if (values.length === headers.length) {
              const row = {};
              headers.forEach((header, index) => {
                row[header] = values[index];
              });
              data.push(row);
            }
          }

          resolve(data);
        } catch (err) {
          reject(err);
        }
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

function formatDateTimeForFile(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

function saveToDingTalk(filePath, fileName) {
  return new Promise((resolve, reject) => {
    dd.saveFileToDingTalk({
      url: filePath,
      name: fileName,
      success: (res) => {
        console.log('保存到钉盘成功：', res);
        resolve(res);
      },
      fail: (err) => {
        console.error('保存到钉盘失败：', err);
        reject(err);
      }
    });
  });
}

function shareFile(filePath, fileName) {
  return new Promise((resolve, reject) => {
    dd.shareFileToMessage({
      filePath: filePath,
      fileName: fileName,
      success: (res) => {
        console.log('分享文件成功：', res);
        resolve(res);
      },
      fail: (err) => {
        console.error('分享文件失败：', err);
        reject(err);
      }
    });
  });
}

function openDocument(filePath, fileType) {
  return new Promise((resolve, reject) => {
    dd.openDocument({
      filePath: filePath,
      fileType: fileType,
      success: () => {
        console.log('打开文档成功');
        resolve();
      },
      fail: (err) => {
        console.error('打开文档失败：', err);
        reject(err);
      }
    });
  });
}

function saveFile(tempFilePath) {
  return new Promise((resolve, reject) => {
    dd.saveFile({
      tempFilePath: tempFilePath,
      success: (res) => {
        console.log('保存文件成功：', res.savedFilePath);
        resolve(res.savedFilePath);
      },
      fail: (err) => {
        console.error('保存文件失败：', err);
        reject(err);
      }
    });
  });
}

module.exports = {
  isXLSXAvailable,
  exportToExcel,
  exportToCSV,
  importFromExcel,
  parseCSV,
  parseCSVLine,
  formatDateTimeForFile,
  saveToDingTalk,
  shareFile,
  openDocument,
  saveFile
};
