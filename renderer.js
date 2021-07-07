const { desktopCapturer } = require("electron");

const socket = io("https://webrtc-server-one.herokuapp.com", {
  path: "/socket.io",
  transports: ["websocket"],
  secure: true,
  withCredentials: true,
});

const iceConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ],
};

const mediaConstraints = {
  video: true,
  audio: true,
};

let connection;
let remoteSid;

const createPeerConnection = () => {
  connection = new RTCPeerConnection(iceConfig);
  connection.onicecandidate = sendIceCandidate(remoteSid);
  connection.ontrack = (e) => {
    const remoteVid = document.getElementById("remote-video");
    if (remoteVid) {
      remoteVid.srcObject = e.streams[0];
    }
  };
  connection.onnegotiationneeded = () => {
    connection
      .createOffer()
      .then((newOffer) => {
        return connection.setLocalDescription(newOffer);
      })
      .then(() => {
        socket?.emit("offer", {
          offerieSid: remoteSid,
          sdp: connection.localDescription,
        });

        return true;
      })
      .catch(console.error);
  };
};

socket.on("ice:candidate:forward", ({ candidate }) => {
  try {
    connection.addIceCandidate(candidate);
  } catch (e) {
    console.log("Error", e);
  }
});

socket.on("connect", () => {
  socket.emit("join:room", { roomId: "dummy" });
});

socket.on("join:room:response", ({ alreadyConnectedSids }) => {
  if (connection) {
    return;
  }
  remoteSid = alreadyConnectedSids[0];

  if (remoteSid) {
    createPeerConnection();
    desktopCapturer.getSources({ types: ["screen"] }).then(async (sources) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: "desktop",
            },
          },
          video: {
            mandatory: {
              chromeMediaSource: "desktop",
            },
          },
        });
        const localVid = document.getElementById("local-video");

        if (localVid) {
          localVid.srcObject = stream;
        }
        stream
          .getTracks()
          .forEach((track) => connection.addTrack(track, stream));
      } catch (e) {
        console.error(e);
      }
      return;
    });
  }
});

socket.on("offer:forward", ({ sdp, offererSid }) => {
  if (offererSid !== remoteSid) {
    remoteSid = offererSid;
  }
  if (!connection) {
    createPeerConnection();
  }
  const desc = new RTCSessionDescription(sdp);

  connection
    .setRemoteDescription(desc)
    .then(() => {
      return navigator.mediaDevices.getUserMedia(mediaConstraints);
    })
    .then((stream) => {
      const localVid = document.getElementById("local-video");
      if (localVid) {
        localVid.srcObject = stream;
      }

      stream.getTracks().forEach((track) => {
        connection.addTrack(track, stream);
      });

      return true;
    })
    .then(() => {
      return connection.createAnswer();
    })
    .then((answer) => {
      return connection.setLocalDescription(answer);
    })
    .then(() => {
      socket.emit("answer", { sdp: connection.localDescription, offererSid });

      return true;
    })
    .catch(console.error);
});

socket.on("answer:forward", ({ sdp }) => {
  const desc = new RTCSessionDescription(sdp);
  connection.setRemoteDescription(desc);
});

const sendIceCandidate = (target) => (e) => {
  socket.emit("ice:candidate", { target, candidate: e.candidate });
};
