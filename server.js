const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { createWorker } = require("tesseract.js");
const fs = require("fs");

const app = express();
app.use(cors());
const upload = multer({ dest: "uploads/" });

app.post("/ocr", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const worker = createWorker({
    logger: function(m) { console.log("Tesseract:", m); } // <-- regular function
  });

  try {
    await worker.load();
    await worker.loadLanguage("eng");
    await worker.initialize("eng");

    const { data } = await worker.recognize(req.file.path);

    await worker.terminate();
    fs.unlinkSync(req.file.path);

    res.json({ text: data.text });
  } catch (error) {
    console.error("OCR Error:", error);
    res.status(500).json({ error: "OCR failed" });
  }
});

app.listen(5000, () => console.log("OCR server running on port 5000"));
