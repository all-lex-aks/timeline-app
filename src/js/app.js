import { parseCoords } from './coords.js';

// DOM элементы
const timeline = document.getElementById('timeline');
const postForm = document.getElementById('post-form');
const postText = document.getElementById('post-text');

const recordingForm = document.getElementById('recording-form');
const startAudioBtn = document.getElementById('start-audio');
const startVideoBtn = document.getElementById('start-video');
const stopRecordBtn = document.getElementById('stop-record');
const cancelRecordBtn = document.getElementById('cancel-record');
const timerEl = document.getElementById('timer');

const videoPreviewContainer = document.getElementById('video-preview-container');
const videoPreview = document.getElementById('video-preview');

const coordsModal = document.getElementById('coords-modal');
const manualCoords = document.getElementById('manual-coords');
const saveCoordsBtn = document.getElementById('save-coords');
const cancelCoordsBtn = document.getElementById('cancel-coords');
const modalError = document.getElementById('modal-error');

// Состояние
let pendingContent = null; // { type: 'text'|'audio'|'video', text: string, blob: Blob }
let mediaRecorder = null;
let mediaStream = null;
let recordedChunks = [];
let timerInterval = null;
let secondsRecorded = 0;
let currentRecordingType = null; // 'audio' или 'video'
let isRecordingCancelled = false;

// --- 1. Обработка текстовых сообщений ---
postForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = postText.value.trim();
    if (!text) return;

    pendingContent = { type: 'text', text: text, blob: null };
    postText.value = '';
    requestGeolocation();
});

// --- 2. Управление записью (Аудио и Видео) ---
startAudioBtn.addEventListener('click', () => startRecording('audio'));
startVideoBtn.addEventListener('click', () => startRecording('video'));
stopRecordBtn.addEventListener('click', () => stopRecording(true));
cancelRecordBtn.addEventListener('click', () => stopRecording(false));

async function startRecording(type) {
    isRecordingCancelled = false;
    pendingContent = null;
    currentRecordingType = type;
    recordedChunks = [];

    try {
        // Запрашиваем доступ к медиа
        const constraints = type === 'audio' ? { audio: true } : { audio: true, video: true };
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

        // Если видео — показываем превью (muted, чтобы не было эха)
        if (type === 'video') {
            videoPreview.srcObject = mediaStream;
            videoPreviewContainer.classList.remove('hidden');
        }

        mediaRecorder = new MediaRecorder(mediaStream);
        
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            // Останавливаем все треки камеры/микрофона
            mediaStream.getTracks().forEach(track => track.stop());
            
            if (!isRecordingCancelled) {
                const mimeType = type === 'audio' ? 'audio/webm' : 'video/webm';
                const blob = new Blob(recordedChunks, { type: mimeType });
                pendingContent = { type: type, text: null, blob: blob };
                requestGeolocation(); 
            } else {
                resetUI();
            }

        };

        // Меняем UI
        postForm.classList.add('hidden');
        recordingForm.classList.remove('hidden');
        
        // Запускаем таймер
        secondsRecorded = 0;
        updateTimerUI();
        timerInterval = setInterval(() => {
            secondsRecorded++;
            updateTimerUI();
        }, 1000);

        mediaRecorder.start();

    } catch (err) {
        alert('Не удалось получить доступ к камере или микрофону. Проверьте разрешения в браузере.');
        resetUI();
    }
}

function stopRecording(isConfirm) {
    if (!isConfirm) {
        isRecordingCancelled = true; // <--- СТАВИМ ФЛАГ ОТМЕНЫ
    }
    
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop(); // Это вызовет onstop
    } else {
        resetUI();
    }
}

function resetUI() {
    clearInterval(timerInterval);
    postForm.classList.remove('hidden');
    recordingForm.classList.add('hidden');
    videoPreviewContainer.classList.add('hidden');
    videoPreview.srcObject = null;
}

function updateTimerUI() {
    const mins = String(Math.floor(secondsRecorded / 60)).padStart(2, '0');
    const secs = String(secondsRecorded % 60).padStart(2, '0');
    timerEl.textContent = `${mins}:${secs}`;
}

// --- 3. Геолокация (работает для всех типов) ---
function requestGeolocation() {
    if (!navigator.geolocation) {
        showCoordsModal();
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const coords = {
                lat: position.coords.latitude.toFixed(5),
                lon: position.coords.longitude.toFixed(5)
            };
            createPost(pendingContent, coords);
            resetUI();
        },
        (error) => {
            console.warn('Geolocation error:', error);
            showCoordsModal();
        },
        { timeout: 5000 }
    );
}

// --- 4. Модальное окно координат ---
function showCoordsModal() {
    coordsModal.classList.remove('hidden');
    manualCoords.value = '';
    modalError.textContent = '';
    manualCoords.focus();
}

cancelCoordsBtn.addEventListener('click', () => {
    coordsModal.classList.add('hidden');
    pendingContent = null;
    resetUI();
});

saveCoordsBtn.addEventListener('click', () => {
    try {
        const coords = parseCoords(manualCoords.value);
        coordsModal.classList.add('hidden');
        createPost(pendingContent, coords);
        pendingContent = null;
        resetUI();
    } catch (err) {
        modalError.textContent = 'Неверный формат координат. Попробуйте еще раз.';
    }
});

// --- 5. Создание поста ---
function createPost(content, coords) {
    if (!content) return;

    const postEl = document.createElement('div');
    postEl.className = 'post';

    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth()+1).padStart(2, '0')}.${String(now.getFullYear()).slice(2)} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 1. Создаем шапку поста (дата)
    const headerEl = document.createElement('div');
    headerEl.className = 'post-header';
    headerEl.innerHTML = `<span>${dateStr}</span>`; // Здесь безопасно, дата генерируется нами
    postEl.appendChild(headerEl);

    // 2. Создаем контент (текст или медиа)
    if (content.type === 'text') {
        const textEl = document.createElement('div');
        textEl.className = 'post-text';
        // ВАЖНО: используем textContent, чтобы браузер не парсил HTML-теги
        textEl.textContent = content.text; 
        postEl.appendChild(textEl);
    } else if (content.type === 'audio' || content.type === 'video') {
        const mediaEl = document.createElement(content.type); // создаем <audio> или <video>
        mediaEl.className = 'post-media';
        mediaEl.controls = true;
        mediaEl.src = URL.createObjectURL(content.blob);
        postEl.appendChild(mediaEl);
    }

    // 3. Создаем блок с координатами
    const coordsEl = document.createElement('div');
    coordsEl.className = 'post-coords';
    coordsEl.textContent = `[${coords.lat}, ${coords.lon}] 👁️`;
    postEl.appendChild(coordsEl);

    // Добавляем готовый пост в начало ленты
    timeline.prepend(postEl);
}