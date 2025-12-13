const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

(async () => {
  try {
    const filePath = path.join(__dirname, 'public', 'template', 'TIMESHEET_NOVEMBER-SKP.xlsx');
    if (!fs.existsSync(filePath)) throw new Error('Template not found: ' + filePath);

    const form = new FormData();
    form.append('template', fs.createReadStream(filePath));

    console.log('Uploading:', filePath);
    const res = await axios.post('http://localhost:3000/api/upload-template', form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    console.log('STATUS', res.status);
    console.log('BODY', res.data);
  } catch (err) {
    if (err.response) {
      console.error('UPLOAD ERROR status', err.response.status, 'body', err.response.data);
    } else {
      console.error('UPLOAD ERROR', err.message);
    }
  }
})();
