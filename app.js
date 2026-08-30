/* ======================================================================
   Marquee — watch a local video file together, in perfect sync.

   How the sync works:
   - The movie file itself NEVER leaves your device. You each pick your
     own local copy from disk, and the browser plays it locally.
   - Only tiny playback events (play / pause / seek + timestamp) are sent
     through Firebase Realtime Database, which is free and instant.
   - Every event is tagged with a random "myId" for this tab, so a client
     always ignores its own echoes and only reacts to its partner's moves.
   ====================================================================== */

const myId = Math.random().toString(36).slice(2, 10);

let db = null;
let roomId = null;
let userName = null;
let stateRef = null;
let chatRef = null;
let presenceRef = null;

let suppressEvents = false; // true while we're applying a remote command
let objectUrl = null;       // current blob: URL for the locally loaded file

const els = {
  joinScreen: document.getElementById('join-screen'),
  appScreen: document.getElementById('app-screen'),
  inputName: document.getElementById('input-name'),
  inputRoom: document.getElementById('input-room'),
  btnJoin: document.getElementById('btn-join'),
  joinError: document.getElementById('join-error'),

  connDot: document.getElementById('conn-dot'),
  roomNameDisplay: document.getElementById('room-name-display'),
  partnerStatus: document.getElementById('partner-status'),
  btnLeave: document.getElementById('btn-leave'),

  player: document.getElementById('player'),
  emptyStage: document.getElementById('empty-stage'),
  inputFile: document.getElementById('input-file'),
  inputFile2: document.getElementById('input-file-2'),
  filenameDisplay: document.getElementById('filename-display'),
  btnResync: document.getElementById('btn-resync'),

  chatLog: document.getElementById('chat-log'),
  chatForm: document.getElementById('chat-form'),
  chatInput: document.getElementById('chat-input'),
};

/* ---------------- Boot ---------------- */

function slugify(s) {
  return s.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '');
}

function init() {
  if (typeof firebase === 'undefined' || !window.__marqueeConfigLoaded) {
    els.joinError.textContent =
      'Firebase isn\u2019t configured yet \u2014 open firebase-config.js and paste in your project keys.';
    els.btnJoin.disabled = true;
    return;
  }
  db = firebase.database();

  const savedName = localStorage.getItem('marquee-name');
  const savedRoom = localStorage.getItem('marquee-room');
  if (savedName) els.inputName.value = savedName;
  if (savedRoom) els.inputRoom.value = savedRoom;
}

els.btnJoin.addEventListener('click', () => {
  const name = els.inputName.value.trim();
  const room = slugify(els.inputRoom.value);
  if (!name) { els.joinError.textContent = 'Enter your name.'; return; }
  if (!room) { els.joinError.textContent = 'Enter a room code.'; return; }

  userName = name;
  roomId = room;
  localStorage.setItem('marquee-name', name);
  localStorage.setItem('marquee-room', room);

  enterRoom();
});

els.inputRoom.addEventListener('keydown', e => { if (e.key === 'Enter') els.btnJoin.click(); });
els.inputName.addEventListener('keydown', e => { if (e.key === 'Enter') els.btnJoin.click(); });

els.btnLeave.addEventListener('click', () => {
  window.location.reload();
});

/* ---------------- Room setup ---------------- */

function enterRoom() {
  els.joinScreen.classList.add('hidden');
  els.appScreen.classList.remove('hidden');
  els.roomNameDisplay.textContent = roomId;

  stateRef = db.ref(`rooms/${roomId}/state`);
  chatRef = db.ref(`rooms/${roomId}/chat`);
  presenceRef = db.ref(`rooms/${roomId}/presence/${myId}`);

  setupConnectionIndicator();
  setupPresence();
  setupSyncEngine();
  setupChat();
  setupFileLoading();

  els.btnResync.addEventListener('click', () => {
    stateRef.once('value').then(snap => applyRemoteState(snap.val(), true));
  });
}

function setupConnectionIndicator() {
  db.ref('.info/connected').on('value', snap => {
    els.connDot.classList.toggle('online', snap.val() === true);
  });
}

/* ---------------- Presence (is your partner even here?) ---------------- */

function setupPresence() {
  const myPresence = { name: userName, online: true, lastSeen: firebase.database.ServerValue.TIMESTAMP };
  presenceRef.set(myPresence);
  presenceRef.onDisconnect().set({ name: userName, online: false, lastSeen: firebase.database.ServerValue.TIMESTAMP });

  const allPresenceRef = db.ref(`rooms/${roomId}/presence`);
  allPresenceRef.on('value', snap => {
    const val = snap.val() || {};
    const others = Object.entries(val).filter(([id]) => id !== myId);
    if (others.length === 0) {
      els.partnerStatus.textContent = 'Waiting for your partner to join\u2026';
      return;
    }
    const anyOnline = others.some(([, v]) => v.online);
    if (anyOnline) {
      const name = others.find(([, v]) => v.online)[1].name || 'Your partner';
      els.partnerStatus.textContent = `${name} is here`;
    } else {
      els.partnerStatus.textContent = 'Your partner just stepped away';
    }
  });
}

/* ---------------- Sync engine ---------------- */

function pushState(action) {
  if (suppressEvents) return;
  stateRef.set({
    action,
    time: els.player.currentTime || 0,
    playing: !els.player.paused,
    fileName: currentFileLabel(),
    updatedBy: myId,
    updatedAt: firebase.database.ServerValue.TIMESTAMP,
  });
}

function currentFileLabel() {
  return els.filenameDisplay.dataset.name || '';
}

function applyRemoteState(s, force) {
  if (!s) return;
  if (!force && s.updatedBy === myId) return;
  if (!els.player.src) return; // haven't loaded a file locally yet

  suppressEvents = true;
  const drift = Math.abs((els.player.currentTime || 0) - (s.time || 0));
  if (force || drift > 0.75) {
    els.player.currentTime = s.time || 0;
  }
  if (s.playing && els.player.paused) {
    els.player.play().catch(() => {});
  } else if (!s.playing && !els.player.paused) {
    els.player.pause();
  }
  window.setTimeout(() => { suppressEvents = false; }, 350);
}

function setupSyncEngine() {
  els.player.addEventListener('play', () => pushState('play'));
  els.player.addEventListener('pause', () => pushState('pause'));
  els.player.addEventListener('seeked', () => pushState('seek'));

  stateRef.on('value', snap => applyRemoteState(snap.val(), false));
}

/* ---------------- Local file loading ---------------- */

function loadLocalFile(file) {
  if (!file) return;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  els.player.src = objectUrl;
  els.emptyStage.classList.add('hidden');
  els.filenameDisplay.textContent = `Playing: ${file.name}`;
  els.filenameDisplay.dataset.name = file.name;

  addSystemMessage(`${userName} loaded "${file.name}"`);

  // Pull the latest known room state so a late loader jumps straight
  // to where the movie currently is instead of starting from 0:00.
  stateRef.once('value').then(snap => applyRemoteState(snap.val(), true));
}

function setupFileLoading() {
  els.inputFile.addEventListener('change', e => loadLocalFile(e.target.files[0]));
  els.inputFile2.addEventListener('change', e => loadLocalFile(e.target.files[0]));
}

/* ---------------- Chat ---------------- */

function addSystemMessage(text) {
  const div = document.createElement('div');
  div.className = 'msg system';
  div.textContent = text;
  els.chatLog.appendChild(div);
  els.chatLog.scrollTop = els.chatLog.scrollHeight;
}

function renderChatMessage(msg) {
  const div = document.createElement('div');
  const mine = msg.senderId === myId;
  div.className = `msg ${mine ? 'me' : 'them'}`;
  const nameEl = document.createElement('span');
  nameEl.className = 'msg-name';
  nameEl.textContent = mine ? 'You' : (msg.name || 'Partner');
  const textEl = document.createElement('span');
  textEl.textContent = msg.text;
  div.appendChild(nameEl);
  div.appendChild(textEl);
  els.chatLog.appendChild(div);
  els.chatLog.scrollTop = els.chatLog.scrollHeight;
}

function setupChat() {
  chatRef.limitToLast(200).on('child_added', snap => renderChatMessage(snap.val()));

  els.chatForm.addEventListener('submit', e => {
    e.preventDefault();
    const text = els.chatInput.value.trim();
    if (!text) return;
    chatRef.push({
      name: userName,
      senderId: myId,
      text,
      ts: firebase.database.ServerValue.TIMESTAMP,
    });
    els.chatInput.value = '';
  });
}

init();
