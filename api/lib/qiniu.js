const qiniu = require('qiniu');

const accessKey = process.env.QINIU_ACCESS_KEY;
const secretKey = process.env.QINIU_SECRET_KEY;
const bucket = process.env.QINIU_BUCKET;
const domain = process.env.QINIU_DOMAIN;

let mac = null;
let uploadPolicy = null;

function getMac() {
  if (!mac) {
    mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
  }
  return mac;
}

function getUploadToken() {
  const options = {
    scope: bucket,
    expires: 3600
  };
  const putPolicy = new qiniu.rs.PutPolicy(options);
  return putPolicy.uploadToken(getMac());
}

function getBucketManager() {
  const config = new qiniu.conf.Config();
  config.zone = qiniu.zone.Zone_z2;
  return new qiniu.rs.BucketManager(getMac(), config);
}

function getUploadManager() {
  const config = new qiniu.conf.Config();
  config.zone = qiniu.zone.Zone_z2;
  return new qiniu.form_up.FormUploader(config);
}

async function uploadBuffer(buffer, key) {
  return new Promise((resolve, reject) => {
    const uploader = getUploadManager();
    const token = getUploadToken();
    const putExtra = new qiniu.form_up.PutExtra();
    
    uploader.put(token, key, buffer, putExtra, (err, body, info) => {
      if (err) {
        reject(err);
        return;
      }
      if (info.statusCode === 200) {
        resolve({
          key: body.key,
          url: `${domain}/${body.key}`
        });
      } else {
        reject(new Error(`上传失败: ${info.statusCode}`));
      }
    });
  });
}

async function deleteFile(key) {
  return new Promise((resolve, reject) => {
    const bucketManager = getBucketManager();
    bucketManager.delete(bucket, key, (err, respBody, respInfo) => {
      if (err) {
        reject(err);
        return;
      }
      if (respInfo.statusCode === 200) {
        resolve(true);
      } else {
        reject(new Error(`删除失败: ${respInfo.statusCode}`));
      }
    });
  });
}

module.exports = {
  getUploadToken,
  uploadBuffer,
  deleteFile,
  getBucketManager,
  getDomain: () => domain,
  getBucket: () => bucket
};
