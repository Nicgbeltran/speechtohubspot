const express = require("express");
const http = require("http");
const { createClient } = require("@deepgram/sdk");
const dotenv = require("dotenv");
const fs = require("fs");
const fetch = require("node-fetch");

dotenv.config();

// Use a stable key from .env
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
if (!DEEPGRAM_API_KEY) {
  throw new Error("No DEEPGRAM_API_KEY found in .env");
}

// Optional: store your HubSpot bearer token in .env
const HUBSPOT_BEARER = process.env.HUBSPOT_BEARER;

const client = createClient(DEEPGRAM_API_KEY);
const app = express();
const server = http.createServer(app);

// Use JSON body parsing
app.use(express.json());

// Serve static files
app.use(express.static("public/"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// When the client stops recording, it POSTs finalTranscript here
app.post("/saveTranscription", async (req, res) => {
  const { smartTranscript } = req.body;
  try {
    fs.writeFileSync("smart_transcription.txt", smartTranscript, "utf8");

    // Call HubSpot's Notes API
    try {
      const timestampMs = Date.now();
      const response = await fetch("https://api.hubapi.com/crm/v3/objects/notes", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HUBSPOT_BEARER}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: {
            hs_timestamp: timestampMs,
            hs_note_body: smartTranscript,
          },
          associations: [
            {
              to: { id: 94231077400 }, // Replace with your HubSpot object ID
              types: [
                {
                  associationCategory: "HUBSPOT_DEFINED",
                  associationTypeId: 202,
                },
              ],
            },
          ],
        }),
      });

      const hubspotData = await response.json();
      console.log("HubSpot response:", hubspotData);
    } catch (hubspotErr) {
      console.error("Error calling HubSpot:", hubspotErr);
    }

    return res.status(200).send("Smart transcription saved successfully.");
  } catch (err) {
    console.error("Error writing file:", err);
    return res.status(500).send("Error writing the transcription file.");
  }
});


// Return the single stable key
app.get("/key", (req, res) => {
  res.json({ key: DEEPGRAM_API_KEY });
});

server.listen(3000, () => {
  console.log("listening on http://localhost:3000");
});
