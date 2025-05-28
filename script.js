document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const cells = document.querySelectorAll('.cell');
    const statusMessage = document.getElementById('status-message');
    const resetButton = document.getElementById('reset-button');

    const playerNameInputs = [document.getElementById('player1-name'), document.getElementById('player2-name')];
    const imageInputs = document.querySelectorAll('.image-input');
    const previewImages = [document.getElementById('player1-preview'), document.getElementById('player2-preview')];

    const recordButtons = document.querySelectorAll('.record-button');
    const stopRecordButtons = document.querySelectorAll('.stop-record-button');
    const recordStatuses = document.querySelectorAll('.record-status');
    const playbackAudios = document.querySelectorAll('.playback-audio');

    const scorePlayer1NameDisplay = document.getElementById('score-player1-name');
    const scorePlayer2NameDisplay = document.getElementById('score-player2-name');
    const scorePlayer1ValueDisplay = document.getElementById('score-player1-value');
    const scorePlayer2ValueDisplay = document.getElementById('score-player2-value');

    const toggleConfigButton = document.getElementById('toggle-config-button');
    const playerSetupContainer = document.querySelector('.player-setup-container');
    const bodyElement = document.body;

    const cameraModal = document.getElementById('camera-modal');
    const cameraVideoStream = document.getElementById('camera-video-stream');
    const cameraCanvas = document.getElementById('camera-canvas');
    const captureImageButton = document.getElementById('capture-image-btn');
    const closeCameraButton = cameraModal.querySelector('.close-camera-btn');
    const takePhotoButtons = document.querySelectorAll('.take-photo-btn');
    const cameraModalPlayerName = document.getElementById('camera-modal-player-name');
    const cameraErrorMsg = cameraModal.querySelector('.camera-error-msg');

    const winMessageOverlay = document.getElementById('win-message-overlay');
    const winTextElement = document.getElementById('win-text');


    // --- Game State Variables ---
    let playerNames = ["Player 1", "Player 2"];
    let currentPlayer;
    let startingPlayerForNextGame = 0;
    let boardState = Array(9).fill(null);
    let playerImages = [null, null];
    let playerAudioBlobs = [null, null];
    let playerAudioURLs = [null, null];
    let gameActive = true;
    let scorePlayer1 = 0;
    let scorePlayer2 = 0;

    // --- Media State Variables ---
    let mediaRecorders = [null, null];
    let audioChunks = [[], []];
    let currentCameraStream = null;
    let activePlayerForCamera = null;
    let winAnimationTimeout = null;
	const synth = window.speechSynthesis; // <<< ADD THIS LINE (Speech synthesis object)


    const winningConditions = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];

    // --- Player Name Handling ---
    playerNameInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            playerNames[index] = e.target.value.trim() || `Player ${index + 1}`;
            if (playerNames[index].length > 15) playerNames[index] = playerNames[index].substring(0,15);
            e.target.value = playerNames[index];
            updateScoreboardDisplay();
            updateGameReadyStatus();
        });
    });

    // --- Scoreboard ---
    function updateScoreboardDisplay() {
        scorePlayer1NameDisplay.textContent = playerNames[0];
        scorePlayer2NameDisplay.textContent = playerNames[1];
        scorePlayer1ValueDisplay.textContent = scorePlayer1;
        scorePlayer2ValueDisplay.textContent = scorePlayer2;
    }

    // --- Collapsible Config ---
    toggleConfigButton.addEventListener('click', () => {
        playerSetupContainer.classList.toggle('collapsed');
        bodyElement.classList.toggle('config-collapsed');
        toggleConfigButton.textContent = playerSetupContainer.classList.contains('collapsed') ? 'Show Setup' : 'Hide Setup';
    });

    // --- Image Upload Handling ---
    function handleImageUpload(event) {
        const playerIndex = parseInt(event.target.dataset.player);
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                playerImages[playerIndex] = e.target.result;
                previewImages[playerIndex].src = e.target.result;
                previewImages[playerIndex].style.display = 'block';
                updateGameReadyStatus();
            };
            reader.readAsDataURL(file);
        }
    }
    imageInputs.forEach(input => input.addEventListener('change', handleImageUpload));

    // --- Camera Functionality ---
    takePhotoButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            activePlayerForCamera = parseInt(e.target.dataset.player);
            cameraModalPlayerName.textContent = playerNames[activePlayerForCamera];
            cameraErrorMsg.style.display = 'none';
            cameraModal.style.display = 'flex';
            startCamera();
        });
    });

    async function startCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            displayCameraError('Camera API not supported by your browser.');
            captureImageButton.disabled = true;
            return;
        }
        try {
            if (currentCameraStream) {
                currentCameraStream.getTracks().forEach(track => track.stop());
            }
            currentCameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
            cameraVideoStream.srcObject = currentCameraStream;
            cameraErrorMsg.style.display = 'none';
            captureImageButton.disabled = false;
        } catch (err) {
            console.error("Error accessing camera: ", err);
            let message = "Could not access the camera. ";
            if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") message += "No camera found.";
            else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") message += "Permission denied.";
            else if (err.name === "OverconstrainedError" || err.name === "ConstraintNotSatisfiedError") message += "Camera constraints not met.";
            else message += "Unknown error.";
            displayCameraError(message);
            captureImageButton.disabled = true;
        }
    }

    function displayCameraError(message) {
        cameraErrorMsg.textContent = message;
        cameraErrorMsg.style.display = 'block';
    }

    function stopCamera() {
        if (currentCameraStream) {
            currentCameraStream.getTracks().forEach(track => track.stop());
            currentCameraStream = null;
        }
        cameraVideoStream.srcObject = null;
        cameraModal.style.display = 'none';
        activePlayerForCamera = null;
    }

    closeCameraButton.addEventListener('click', stopCamera);
    cameraModal.addEventListener('click', (event) => {
        if (event.target === cameraModal) stopCamera();
    });

    captureImageButton.addEventListener('click', () => {
        if (activePlayerForCamera === null || !currentCameraStream || !cameraVideoStream.videoWidth) return;
        cameraCanvas.width = cameraVideoStream.videoWidth;
        cameraCanvas.height = cameraVideoStream.videoHeight;
        const context = cameraCanvas.getContext('2d');
        context.drawImage(cameraVideoStream, 0, 0, cameraCanvas.width, cameraCanvas.height);
        const imageDataURL = cameraCanvas.toDataURL('image/png');
        playerImages[activePlayerForCamera] = imageDataURL;
        previewImages[activePlayerForCamera].src = imageDataURL;
        previewImages[activePlayerForCamera].style.display = 'block';
        updateGameReadyStatus();
        stopCamera();
    });

    // --- Audio Recording Handling ---
    async function startRecording(playerIndex) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('Your browser does not support audio recording.');
            return;
        }
        recordButtons[playerIndex].disabled = true;
        stopRecordButtons[playerIndex].disabled = false;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' :
                             MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') ? 'audio/ogg;codecs=opus' : '';
            mediaRecorders[playerIndex] = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            audioChunks[playerIndex] = [];
            mediaRecorders[playerIndex].ondataavailable = event => audioChunks[playerIndex].push(event.data);
            mediaRecorders[playerIndex].onstop = () => {
                const audioBlob = new Blob(audioChunks[playerIndex], { type: mediaRecorders[playerIndex].mimeType || 'audio/webm' });
                playerAudioBlobs[playerIndex] = audioBlob;
                if (playerAudioURLs[playerIndex]) URL.revokeObjectURL(playerAudioURLs[playerIndex]);
                playerAudioURLs[playerIndex] = URL.createObjectURL(audioBlob);
                playbackAudios[playerIndex].src = playerAudioURLs[playerIndex];
                playbackAudios[playerIndex].style.display = 'block';
                recordStatuses[playerIndex].textContent = 'Sound recorded!';
                stopRecordButtons[playerIndex].style.display = 'none';
                recordButtons[playerIndex].style.display = 'inline-block';
                recordButtons[playerIndex].textContent = 'Re-record';
                stream.getTracks().forEach(track => track.stop());
                updateGameReadyStatus(); // Sound is optional, but update status if other things change
                recordButtons[playerIndex].disabled = false;
                stopRecordButtons[playerIndex].disabled = true;
            };
            mediaRecorders[playerIndex].start();
            recordButtons[playerIndex].style.display = 'none';
            stopRecordButtons[playerIndex].style.display = 'inline-block';
            recordStatuses[playerIndex].textContent = 'Recording...';
            playbackAudios[playerIndex].style.display = 'none';
        } catch (err) {
            console.error('Error accessing microphone:', err);
            recordStatuses[playerIndex].textContent = 'Mic access error.';
            recordButtons[playerIndex].style.display = 'inline-block';
            stopRecordButtons[playerIndex].style.display = 'none';
            recordButtons[playerIndex].disabled = false;
            stopRecordButtons[playerIndex].disabled = true;
        }
    }

    function stopRecording(playerIndex) {
        if (mediaRecorders[playerIndex] && mediaRecorders[playerIndex].state === "recording") {
            mediaRecorders[playerIndex].stop();
        }
    }
    recordButtons.forEach(button => button.addEventListener('click', (e) => startRecording(parseInt(e.target.dataset.player))));
    stopRecordButtons.forEach(button => button.addEventListener('click', (e) => stopRecording(parseInt(e.target.dataset.player))));

    // --- Game Logic ---
    function updateGameReadyStatus() {
        const imagesReady = playerImages[0] && playerImages[1];

        if (gameActive) {
            if (imagesReady) {
                statusMessage.textContent = `${playerNames[currentPlayer]}'s Turn`;
            } else {
                let missing = [];
                if (!playerImages[0]) missing.push("P1 Image");
                if (!playerImages[1]) missing.push("P2 Image");
                // Sound is optional, so not listed as missing.
                // Names are optional, could add logic to prompt if default.
                if (missing.length > 0) {
                    statusMessage.textContent = `Waiting for: ${missing.join(', ')}`;
                } else {
                    statusMessage.textContent = "Ready to play!"; // Should be covered by imagesReady
                }
            }
        }
        // If !gameActive, status message handled by win animation or draw message
    }

    function handleCellClick(event) {
        const clickedCell = event.target.closest('.cell');
        if (!clickedCell) return;
        const clickedCellIndex = parseInt(clickedCell.getAttribute('data-index'));

        if (!playerImages[0] || !playerImages[1]) {
            statusMessage.textContent = "Please set images for both players!";
            if (playerSetupContainer.classList.contains('collapsed')) {
                toggleConfigButton.click();
            }
            return;
        }

        if (boardState[clickedCellIndex] !== null || !gameActive) return;

        if (playerAudioURLs[currentPlayer]) { // Play sound only if available
            const moveSound = new Audio(playerAudioURLs[currentPlayer]);
            moveSound.play().catch(e => console.error("Error playing move sound:", e));
        }

        boardState[clickedCellIndex] = currentPlayer;
        const img = document.createElement('img');
        img.src = playerImages[currentPlayer];
        clickedCell.innerHTML = '';
        clickedCell.appendChild(img);
        checkResult();
    }
	
	// --- MODIFIED: speakText function (onEndCallback is now truly optional for other uses) ---
	function speakText(textToSpeak, onEndCallback) { // onEndCallback is optional
		if (!synth) {
			console.warn("Speech Synthesis not supported by this browser.");
			if (onEndCallback) onEndCallback(); // Call if provided for other reasons
			return;
		}
		synth.cancel();
		const utterance = new SpeechSynthesisUtterance(textToSpeak);
		utterance.pitch = 1.2;
		utterance.rate = 1;

		utterance.onend = () => {
			if (onEndCallback) {
				onEndCallback(); // Call if provided
			}
		};
		utterance.onerror = (event) => {
			console.error("Speech synthesis error:", event.error);
			if (onEndCallback) onEndCallback(); // Call if provided, even on error
		};
		synth.speak(utterance);
	}
	// --- END MODIFIED: speakText function ---
	
	// --- MODIFIED: playWinSound function (removed final callback) ---
	function playWinSound(playerIndex, winningPlayerName) { // Removed callbackAfterAllSounds
		let customSoundPlayed = false;

		function playComputerVoice() {
			speakText(`${winningPlayerName} wins`); // No game-reset callback passed here
		}

		if (playerAudioURLs[playerIndex]) {
			let playCount = 0;
			const maxPlays = 3;

			function playNextInstance() {
				if (playCount >= maxPlays || gameActive) {
					if (!customSoundPlayed && !gameActive) {
						playComputerVoice();
					}
					return;
				}
				const audio = new Audio(playerAudioURLs[playerIndex]);
				audio.playbackRate = 3.0;
				audio.onended = () => {
					playCount++;
					customSoundPlayed = true;
					if (playCount >= maxPlays) {
						playComputerVoice();
					} else {
						playNextInstance();
					}
				};
				audio.onerror = (e) => {
					console.error(`Error during win sound (instance ${playCount + 1}):`, e);
					playCount++;
					if (playCount >= maxPlays) {
						playComputerVoice();
					} else {
						playNextInstance();
					}
				};
				audio.play().catch(e => {
					console.error(`Error initiating win sound (instance ${playCount + 1}):`, e);
					playCount++;
					 if (playCount >= maxPlays) {
						playComputerVoice();
					} else {
						playNextInstance();
					}
				});
			}
			playNextInstance();
		} else {
			playComputerVoice();
		}
	}
	// --- END MODIFIED: playWinSound function ---

	// --- MODIFIED: showWinAnimation function ---
	function showWinAnimation(winningPlayerName) {
		winTextElement.textContent = `${winningPlayerName} Wins!`;
		winMessageOverlay.style.display = 'flex';
		winMessageOverlay.classList.add('visible'); // For CSS opacity transition on overlay
		winTextElement.style.animation = 'none';    // Reset animation
		void winTextElement.offsetWidth;           // Trigger reflow to restart animation
		winTextElement.style.animation = 'fireworks-text-animation 5s forwards';

		statusMessage.textContent = ""; // Clear normal status during animation

		// Clear any previous timeout to prevent multiple resets if called rapidly
		if (winAnimationTimeout) clearTimeout(winAnimationTimeout);

		const totalVisualDisplayTime = 5000; // This should match the CSS 'fireworks-text-animation' duration

		winAnimationTimeout = setTimeout(() => {
			winMessageOverlay.style.display = 'none';
			winMessageOverlay.classList.remove('visible');
			// The winTextElement.style.animation = ''; will be handled by resetGame
			if (!gameActive) { // Only reset if game wasn't already reset by a manual button click
				resetGame();
			}
		}, totalVisualDisplayTime);
	}
	// --- END MODIFIED: showWinAnimation function ---
	

	// --- MODIFIED: checkResult function (win condition block) ---
		function checkResult() {
			let roundWon = false;
			let winningPlayer = -1;

			for (let i = 0; i < winningConditions.length; i++) {
				const winCondition = winningConditions[i];
				let a = boardState[winCondition[0]];
				let b = boardState[winCondition[1]];
				let c = boardState[winCondition[2]];
				if (a === null || b === null || c === null) continue;
				if (a === b && b === c) {
					roundWon = true;
					winningPlayer = a;
					break;
				}
			}

			if (roundWon) {
				gameActive = false;
				const winnerName = playerNames[winningPlayer];
				playWinSound(winningPlayer, winnerName); // Call without the reset callback
				if (winningPlayer === 0) scorePlayer1++; else scorePlayer2++;
				updateScoreboardDisplay();
				startingPlayerForNextGame = startingPlayerForNextGame === 0 ? 1 : 0;
				showWinAnimation(winnerName); // This sets the timeout that will eventually reset the game
				return;
			}

			if (!boardState.includes(null) && gameActive) { // Draw
				statusMessage.textContent = "It's a Draw!";
				gameActive = false;
				startingPlayerForNextGame = startingPlayerForNextGame === 0 ? 1 : 0;
				if (winAnimationTimeout) clearTimeout(winAnimationTimeout); // Clear any win animation timeout
				winAnimationTimeout = setTimeout(() => { // Set a specific timeout for draw
					if (!gameActive) resetGame();
				}, 2000);
				return;
			}

			if (gameActive) switchPlayer();
		}
	// --- END MODIFIED: checkResult function ---

    function switchPlayer() {
        currentPlayer = currentPlayer === 0 ? 1 : 0;
        statusMessage.textContent = `${playerNames[currentPlayer]}'s Turn`;
    }

    function resetGame() {
        if (winAnimationTimeout) {
            clearTimeout(winAnimationTimeout);
            winMessageOverlay.style.display = 'none';
            winMessageOverlay.classList.remove('visible');
            winTextElement.style.animation = '';
        }
        boardState.fill(null);
        gameActive = true;
        currentPlayer = startingPlayerForNextGame;
        cells.forEach(cell => cell.innerHTML = '');
        updateGameReadyStatus();
    }

    // --- Event Listeners & Initial Setup ---
    cells.forEach(cell => cell.addEventListener('click', handleCellClick));
    resetButton.addEventListener('click', resetGame);

    stopRecordButtons.forEach(btn => btn.disabled = true);
    previewImages.forEach(img => {
        if (img.src.endsWith("#") || !img.getAttribute('src')) {
            img.src = "";
            img.style.display = 'none';
        }
    });
    
    currentPlayer = startingPlayerForNextGame;
    updateScoreboardDisplay();
    updateGameReadyStatus();
});