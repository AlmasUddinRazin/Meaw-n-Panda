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
let suppressSync = false;
let pendingRemote = null; // holds a sync command if the video isn't ready yet

// ---------- Video file loading (local only, never transmitted) ----------
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  video.src = URL.createObjectURL(file);
  addSystemMessage('Loaded: ' + file.name);
});

// Once metadata is ready, apply any sync command that arrived too early
video.addEventListener('loadedmetadata', () => {
  if (pendingRemote) {
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
    addSystemMessage('Connected! Try sending a chat message to double check, then press play.');
  });
  conn.on('data', data => {
    try {
      handleRemoteData(data);
    } catch (e) {
      addSystemMessage('⚠️ Error handling remote data: ' + e.message);
    }
  });
  conn.on('close', () => {
    connStatus.textContent = 'Disconnected';
    addSystemMessage('The other person disconnected.');
  });
  conn.on('error', err => {
    addSystemMessage('⚠️ Connection error: ' + err);
  });
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

// ---------- Sync outgoing ----------
function send(data) {
  if (conn && conn.open) {
    conn.send(data);
  } else {
    addSystemMessage('⚠️ Tried to sync but connection is not open.');
  }
}

video.addEventListener('play', () => {
  if (suppressSync) return;
  send({ type: 'play', time: video.currentTime });
});
video.addEventListener('pause', () => {
  if (suppressSync) return;
  send({ type: 'pause', time: video.currentTime });
});
video.addEventListener('seeked', () => {
  if (suppressSync) return;
  send({ type: 'seek', time: video.currentTime });
});

// ---------- Sync incoming ----------
function handleRemoteData(data) {
  if (data.type === 'chat') {
    addMessage(data.text, false);
    return;
  }

  // If the video has no metadata yet, queue the command instead of dropping it
  if (video.readyState < 1) {
    pendingRemote = data;
    addSystemMessage('Received a sync command before your video was ready — will apply once it loads.');
    return;
  }

  applyRemote(data);
}

function applyRemote(data) {
  suppressSync = true;

  if (data.type === 'play') {
    if (Math.abs(video.currentTime - data.time) > 0.5) video.currentTime = data.time;
    video.play().catch(err => {
      addSystemMessage('⚠️ Browser blocked auto-play: ' + err.message + ' — click play manually once, then it should sync fine after.');
    });
  } else if (data.type === 'pause') {
    video.currentTime = data.time;
    video.pause();
  } else if (data.type === 'seek') {
    video.currentTime = data.time;
  }

  setTimeout(() => { suppressSync = false; }, 400);
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
