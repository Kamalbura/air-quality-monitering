const express = require('express');
const fs = require('fs');
const app = express();
const port = 3000;

// Middleware to handle incoming binary data
app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' }));

// Endpoint to upload the audio file
app.post('/upload', (req, res) => {
  const audioData = req.body;

  const fileName = `audio_${Date.now()}.raw`;
  fs.writeFile(`./audio_files/${fileName}`, audioData, (err) => {
    if (err) {
      console.error('Error saving audio:', err);
      return res.status(500).send('Error saving audio');
    }
    console.log('Audio saved:', fileName);
    res.status(200).send('Audio file received and saved');
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
