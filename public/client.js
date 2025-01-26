const captions = window.document.getElementById("captions");

let finalTranscript = "";

async function getMicrophone() {
  const userMedia = await navigator.mediaDevices.getUserMedia({
    audio: true,
  });

  return new MediaRecorder(userMedia);
}

async function openMicrophone(microphone, socket) {
  await microphone.start(250);

  microphone.onstart = () => {
    console.log("client: microphone opened");
    document.body.classList.add("recording");
    finalTranscript = "";
  };

  microphone.onstop = async () => {
    console.log("client: microphone stopped");
    document.body.classList.remove("recording");
    
    if (finalTranscript.trim().length > 0) {
      try {
        const resp = await fetch("/saveTranscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ smartTranscript: finalTranscript }),
        });
        console.log("client: final transcript sent to server");
        console.log(await resp.text());
      } catch (err) {
        console.error("Error sending final transcript:", err);
      }
    }
  };

  microphone.ondataavailable = (e) => {
    const data = e.data;
    if (socket.getReadyState() === 1) {
      socket.send(data);
    }
  };
}

async function closeMicrophone(microphone) {
  microphone.stop();
}

async function start(socket) {
  const listenButton = document.getElementById("record");
  let microphone;

  console.log("client: waiting to open microphone");

  listenButton.addEventListener("click", async () => {
    if (!microphone) {
      microphone = await getMicrophone();
      await openMicrophone(microphone, socket);
    } else {
      await closeMicrophone(microphone);
      microphone = undefined;
    }
  });
}

async function getApiKey() {
  const response = await fetch("/key");
  const json = await response.json();
  return json.key;
}

window.addEventListener("load", async () => {
  const key = await getApiKey();
  const { createClient } = deepgram;
  const _deepgram = createClient(key);

  const socket = _deepgram.listen.live({
    model: "nova-2",
    diarize: true,
    smart_format: true,
  });

  socket.on("open", async () => {
    console.log("client: connected to websocket");

    socket.on("Results", (data) => {
      if (data.is_final) {
        const words = data.channel.alternatives[0].words || [];
        let chunk = "";
        let currentSpeaker = null;

        for (const w of words) {
          if (w.speaker !== currentSpeaker) {
            currentSpeaker = w.speaker;
            chunk += `\nSpeaker ${currentSpeaker + 1}: `;
          }
          chunk += w.punctuated_word + " ";
        }

        finalTranscript += chunk.trimEnd() + "\n";
      }

      const partial = data.channel.alternatives[0].transcript;
      if (partial) {
        captions.innerHTML = `<span>${partial}</span>`;
      }
    });

    socket.on("error", (e) => console.error(e));
    socket.on("warning", (e) => console.warn(e));
    socket.on("Metadata", (e) => console.log("Metadata:", e));
    socket.on("close", (e) => console.log("WebSocket closed:", e));

    await start(socket);
  });
});
