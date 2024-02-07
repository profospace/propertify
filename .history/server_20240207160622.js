const express = require('express');
const properties = require('./data'); // Import the properties data

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

app.get('/api/properties', (req, res) => {
    res.json(properties);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
