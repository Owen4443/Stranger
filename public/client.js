const socket = io();
let peerConnection;
let localStream;
let isVideo = false;

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const messages = document.getElementById('messages');
const input = document.getElementById('input');
const nextBtn = document.getElementById('nextBtn');
const chatBox = document.getElementById('chat-box');
const modeSelection = document.getElementById('mode-selection');

const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

function startTextChat() {
    isVideo = false;
    modeSelection.classList.add('hidden');
    chatBox.classList.remove('hidden');
    socket.emit('find-partner', false);
}

function startVideoChat() {
    isVideo = true;
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
        localStream = stream;
        localVideo.srcObject = stream;
        modeSelection.classList.add('hidden');
        chatBox.classList.remove('hidden');
        socket.emit('find-partner', true);
    });
}

input.addEventListener('keypress', e => {
    if (e.key === 'Enter' && input.value) {
        const msg = input.value;
        socket.emit('message', msg);
        appendMessage('You: ' + msg);
        input.value = '';
    }
});

nextBtn.onclick = () => {
    socket.emit('next');
    resetConnection();
};

socket.on('reset-ui', () => {
    messages.innerHTML = '';
    remoteVideo.srcObject = null;
});

socket.on('message', msg => {
    appendMessage('Stranger: ' + msg);
});

socket.on('partner-found', async ({ initiator }) => {
    if (!isVideo) return;

    peerConnection = new RTCPeerConnection(config);

    peerConnection.onicecandidate = e => {
        if (e.candidate) socket.emit('ice-candidate', e.candidate);
    };

    peerConnection.ontrack = e => {
        remoteVideo.srcObject = e.streams[0];
    };

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    if (initiator) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('offer', offer);
    }
});

socket.on('offer', async offer => {
    peerConnection = new RTCPeerConnection(config);

    peerConnection.onicecandidate = e => {
        if (e.candidate) socket.emit('ice-candidate', e.candidate);
    };

    peerConnection.ontrack = e => {
        remoteVideo.srcObject = e.streams[0];
    };

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', answer);
});

socket.on('answer', answer => {
    peerConnection.setRemoteDescription(answer);
});

socket.on('ice-candidate', candidate => {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});

socket.on('partner-disconnected', () => {
    appendMessage('Stranger disconnected. Click "Next" to chat again.');
    if (peerConnection) peerConnection.close();
    remoteVideo.srcObject = null;
});

function appendMessage(msg) {
    const div = document.createElement('div');
    div.textContent = msg;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

function resetConnection() {
    if (peerConnection) peerConnection.close();
    peerConnection = null;
    remoteVideo.srcObject = null;
    messages.innerHTML = '';
}
