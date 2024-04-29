const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const port = process.env.PORT || 3200;

app.listen(port, () => {
  console.log(`Your API is running on port ${port}`);
});
