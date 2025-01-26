const dotenv = require('dotenv');
const fetch = require('node-fetch');
dotenv.config();

exports.handler = async function(event, context) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  try {
    const { smartTranscript } = JSON.parse(event.body);
    const HUBSPOT_BEARER = process.env.HUBSPOT_BEARER;

    // Call HubSpot's Notes API if bearer token is available
    if (HUBSPOT_BEARER) {
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
              to: { id: 94231077400 },
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
    }

    return {
      statusCode: 200,
      body: "Smart transcription saved successfully."
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}; 