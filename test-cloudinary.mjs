import fs from 'fs';

async function testCloudinary() {
  try {
    const cloudName = 'eldujqpd';
    const uploadPreset = 'iqbuuhzz';
    
    // Read favicon.png from public
    const fileBuffer = fs.readFileSync('public/favicon.png');
    const blob = new Blob([fileBuffer], { type: 'image/png' });
    
    const formData = new FormData();
    formData.append('file', blob, 'favicon.png');
    formData.append('upload_preset', uploadPreset);
    formData.append('folder', 'aeirmist_test');
    
    console.log("Uploading real PNG to Cloudinary...");
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData
    });
    const json = await res.json();
    console.log("Cloudinary response:", res.status, json.secure_url ? "SUCCESS: " + json.secure_url : json);
  } catch (err) {
    console.error("Cloudinary test failed:", err);
  }
}

testCloudinary();
