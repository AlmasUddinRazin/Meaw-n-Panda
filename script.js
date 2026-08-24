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
let suppressSync = false; // prevents echo loops when a remote action triggers a local video event

// ---------- Video file loading (local only, never uploaded) ----------
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  video.src = url;
});

// ---------- PeerJS connection setup ----------
function initPeer(onOpenCallback) {
  peer = new Peer(); // uses PeerJS's free public signaling server
  peer.on('open', id => onOpenCallback(id));
  peer.on('connection', c => {
    conn = c;
    setupConnection();
  });
  peer.on('error', err => {
    connStatus.textContent = 'Connection error: ' + err.type;
  });
}

function setupConnection() {
  conn.on('open', () => {
    connStatus.textContent = 'Connected ✅';
    addSystemMessage('Connected! You can now watch together.');
  });
  conn.on('data', handleRemoteData);
  conn.on('close', () => {
    connStatus.textContent = 'Disconnected';
    addSystemMessage('The other person disconnected.');
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
    conn = peer.connect(roomId);
    setupConnection();
  });
});

// Auto-join if opened via a shared link (?room=xxxx)
window.addEventListener('load', () => {
  const params = new URLSearchParams(location.search);
  const roomId = params.get('room');
  if (roomId) {
    roomInput.value = roomId;
    joinRoomBtn.click();
  }
});

// ---------- Sync video actions ----------
function send(data) {
  if (conn && conn.open) conn.send(data);
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

function handleRemoteData(data) {
  if (data.type === 'chat') {
    addMessage(data.text, false);
    return;
  }

  suppressSync = true;

  if (data.type === 'play') {
    if (Math.abs(video.currentTime - data.time) > 0.5) video.currentTime = data.time;
    video.play();
  } else if (data.type === 'pause') {
    video.currentTime = data.time;
    video.pause();
  } else if (data.type === 'seek') {
    video.currentTime = data.time;
  }

  setTimeout(() => { suppressSync = false; }, 300);
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
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') sendChat();
});
