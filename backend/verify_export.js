const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testExport() {
    try {
        const form = new FormData();
        form.append('company', 'Test Company');
        form.append('employeeName', 'Test Employee');
        // Using an existing file as the "template"
        const templatePath = path.join(__dirname, 'test_download_template.xlsx');

        if (!fs.existsSync(templatePath)) {
            console.error('Test template not found, creating a dummy one...');
            // Create a dummy file just to test the upload mechanism
            fs.writeFileSync(templatePath, 'dummy content for xlsx test');
        }

        form.append('template', fs.createReadStream(templatePath));

        console.log('Sending request to localhost:3000...');
        const response = await axios.post('http://localhost:3000/api/export-template', form, {
            headers: {
                ...form.getHeaders()
            },
            responseType: 'arraybuffer'
        });

        console.log('Response Status:', response.status);
        console.log('Response Headers:', response.headers);

        if (response.status === 200) {
            fs.writeFileSync('verified_export_output.xlsx', response.data);
            console.log('SUCCESS: File downloaded to verified_export_output.xlsx');
        } else {
            console.log('FAILED: Status code', response.status);
        }

    } catch (error) {
        console.error('TEST FAILED:', error.message);
        if (error.response) {
            console.error('Data:', error.response.data.toString());
        }
    }
}

testExport();
