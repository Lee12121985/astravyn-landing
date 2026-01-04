const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testSkpExport() {
    try {
        const form = new FormData();
        form.append('templateId', 'skp-default');
        form.append('company', 'Test Corp');
        form.append('employeeName', 'John Doe');
        form.append('month', 'November');
        form.append('year', '2025');

        const rows = [];
        // Populate full month or at least some days
        for (let i = 1; i <= 30; i++) {
            rows.push({
                date: `2025-11-${String(i).padStart(2, '0')}`,
                status: i % 7 === 0 ? 'H' : 'P', // Some Ps and Hs
                day: 'Mon'
            });
        }
        form.append('attendanceRows', JSON.stringify(rows));

        console.log('Sending SKP Export request to localhost:3000...');
        const response = await axios.post('http://localhost:3000/api/export-template', form, {
            headers: {
                ...form.getHeaders()
            },
            responseType: 'arraybuffer'
        });

        console.log('Response Status:', response.status);

        if (response.status === 200) {
            fs.writeFileSync('skp_export_output.xlsx', response.data);
            console.log('SUCCESS: File downloaded to skp_export_output.xlsx');
        } else {
            console.log('FAILED: Status code', response.status);
        }

    } catch (error) {
        console.error('TEST FAILED:', error.message);
        if (error.response) {
            const data = Buffer.isBuffer(error.response.data) ? error.response.data.toString() : error.response.data;
            console.error('Data:', data);
        }
    }
}

testSkpExport();
