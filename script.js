const video = document.getElementById('video');
const fileInput = document.getElementById('fileInput');
const connStatus = document.getElementById('connStatus');

const createRoomBtn = document.getElementById('createRoomBtn');
const shareBox = document.getElementById('shareBox');
const shareLink = document.getElementById('shareLink');
const copyBtn = document.getElementById('copyBtn');
const roomInput = document.getElementById('roomInput');
const joinRoomBtn = document.getElementById('joinRoomBtn');

const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');

let peer = null;
let conn = null;
let pendingRemote = null;

// event-based ignore flags — cleared only when the real event fires,
// no matter how long buffering/seeking takes
const ignore = { play: false, pause: false, seeked: false };

// ---------- Video file loading (local only, never transmitted) ----------
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  video.src = URL.createObjectURL(file);
  addSystemMessage('Loaded locally: ' + file.name);
});

video.addEventListener('loadedmetadata', () => {
  if (pendingRemote) {
    addSystemMessage('Video ready — applying the sync command that was waiting.');
    applyRemote(pendingRemote);
    pendingRemote = null;
  }
});

// ---------- PeerJS setup ----------
function initPeer(onOpenCallback) {
  peer = new Peer(undefined, {
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    }
  });
  peer.on('open', id => onOpenCallback(id));
  peer.on('connection', c => { conn = c; setupConnection(); });
  peer.on('error', err => {
    connStatus.textContent = 'Peer error: ' + err.type;
    addSystemMessage('⚠️ Peer error: ' + err.type);
  });
}

function setupConnection() {
  conn.on('open', () => {
    connStatus.textContent = 'Connected ✅';
    addSystemMessage('Connected. Load the same movie on both sides, then press play.');
  });
  conn.on('data', data => {
    try {
      handleRemoteData(data);
    } catch (e) {
      addSystemMessage('⚠️ Error handling incoming data: ' + e.message);
    }
  });
  conn.on('close', () => {
    connStatus.textContent = 'Disconnected';
    addSystemMessage('The other person disconnected.');
  });
  conn.on('error', err => addSystemMessage('⚠️ Connection error: ' + err));
}

createRoomBtn.addEventListener('click', () => {
  initPeer(id => {
    const url = `${location.origin}${location.pathname}?room=${id}`;
    shareLink.value = url;
    shareBox.classList.remove('hidden');
    connStatus.textContent = 'Waiting for her to join...';
  });
});

copyBtn.addEventListener('click', () => {
  shareLink.select();
  document.execCommand('copy');
  copyBtn.textContent = 'Copied!';
  setTimeout(() => copyBtn.textContent = 'Copy', 1500);
});

joinRoomBtn.addEventListener('click', () => {
  const roomId = roomInput.value.trim();
  if (!roomId) return;
  initPeer(() => {
    conn = peer.connect(roomId, { reliable: true });
    setupConnection();
  });
});

window.addEventListener('load', () => {
  const params = new URLSearchParams(location.search);
  const roomId = params.get('room');
  if (roomId) {
    roomInput.value = roomId;
    joinRoomBtn.click();
  }
});

// ---------- Outgoing sync ----------
function send(data) {
  if (conn && conn.open) {
    conn.send(data);
    addSystemMessage('→ Sent: ' + data.type + ' @ ' + (data.time !== undefined ? data.time.toFixed(1) + 's' : ''));
  } else {
    addSystemMessage('⚠️ Tried to sync but connection is not open.');
  }
}

video.addEventListener('play', () => {
  if (ignore.play) { ignore.play = false; return; }
  send({ type: 'play', time: video.currentTime });
});
video.addEventListener('pause', () => {
  if (ignore.pause) { ignore.pause = false; return; }
  send({ type: 'pause', time: video.currentTime });
});
video.addEventListener('seeked', () => {
  if (ignore.seeked) { ignore.seeked = false; return; }
  send({ type: 'seek', time: video.currentTime });
});

// ---------- Incoming sync ----------
function handleRemoteData(data) {
  if (data.type === 'chat') {
    addMessage(data.text, false);
    return;
  }

  addSystemMessage('← Received: ' + data.type + ' @ ' + (data.time !== undefined ? data.time.toFixed(1) + 's' : ''));

  if (!video.src) {
    addSystemMessage('⚠️ You haven\'t chosen a video file yet — pick the same file first.');
    pendingRemote = data;
    return;
  }

  if (video.readyState < 1) {
    pendingRemote = data;
    addSystemMessage('Your video isn\'t loaded yet — will apply once ready.');
    return;
  }

  applyRemote(data);
}

function applyRemote(data) {
  if (data.type === 'play') {
    ignore.play = true;
    if (Math.abs(video.currentTime - data.time) > 0.5) {
      ignore.seeked = true;
      video.currentTime = data.time;
    }
    video.play().catch(err => {
      ignore.play = false;
      addSystemMessage('⚠️ Browser blocked auto-play: ' + err.message + ' — click play once manually.');
    });
  } else if (data.type === 'pause') {
    ignore.pause = true;
    ignore.seeked = true;
    video.currentTime = data.time;
    video.pause();
  } else if (data.type === 'seek') {
    ignore.seeked = true;
    video.currentTime = data.time;
  }
}

// ---------- Chat ----------
function addMessage(text, isMe) {
  const div = document.createElement('div');
  div.className = 'msg ' + (isMe ? 'me' : 'them');
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
function addSystemMessage(text) {
  const div = document.createElement('div');
  div.className = 'msg system';
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
function sendChat() {
  const text = chatInput.value.trim();
  if (!text) return;
  addMessage(text, true);
  send({ type: 'chat', text });
  chatInput.value = '';
}
sendChatBtn.addEventListener('click', sendChat);
chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });
